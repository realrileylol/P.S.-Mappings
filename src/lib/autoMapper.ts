import { TEMPLATE_FIELDS } from './templateFields';
import type { TemplateFieldConfig } from './templateFields';
import type { FieldMapping, MappingValueType, PromptNeeds, UserPrompts } from '../types';

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\[\]_\-\(\)#]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarityScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const aWords = new Set(na.split(' '));
  const bWords = new Set(nb.split(' '));
  const intersection = [...aWords].filter(w => bWords.has(w) && w.length > 2).length;
  const union = new Set([...aWords, ...bWords]).size;
  return union > 0 ? intersection / union : 0;
}

function matchHeaderToField(header: string, config: TemplateFieldConfig): number {
  const nh = normalize(header);
  // Exact field name match
  if (normalize(config.field) === nh) return 1.0;
  if (!config.synonyms) return 0;
  // Conv factor override: if header contains 'conv' → very high score for isConvFactor field
  if (config.isConvFactor && /conv/i.test(header)) return 0.95;
  // Check synonyms
  let best = 0;
  for (const syn of config.synonyms) {
    const score = similarityScore(nh, syn);
    if (score > best) best = score;
  }
  return best;
}

function isConvHeader(header: string): boolean {
  return /conv/i.test(header);
}

function isTotalHeader(header: string): boolean {
  const n = normalize(header);
  return ['ext sales', 'extended amount', 'extended price', 'sales dollars', 'total amount', 'total'].some(t => n.includes(t));
}

function isQuantityHeader(header: string): boolean {
  const n = normalize(header);
  return ['qty', 'quantity', 'units'].some(t => n.includes(t));
}

function isPriceHeader(header: string): boolean {
  const n = normalize(header);
  return ['price', 'unit price', 'cost'].some(t => n.includes(t));
}

export function detectPromptNeeds(headers: string[]): PromptNeeds {
  const needs: PromptNeeds = {
    needsFacilityId: true,
    needsFacilityName: true,
    needsDate: true,
    needsSupplierName: true,
  };

  for (const h of headers) {
    const n = normalize(h);
    // Facility detection
    if (['facility id', 'facility_id', 'account number', 'customer id', 'site id'].some(s => n.includes(s))) {
      needs.needsFacilityId = false;
      needs.detectedFacilityId = h;
    }
    if (['facility name', 'customer name', 'hospital name', 'account name', 'site name', 'client name'].some(s => n.includes(s))) {
      needs.needsFacilityName = false;
      needs.detectedFacilityName = h;
    }
    // Date detection
    if (['date', 'invoice date', 'po date', 'posting date', 'order date'].some(s => n.includes(s))) {
      needs.needsDate = false;
      needs.detectedDate = h;
    }
    // Supplier detection
    if (['vendor name', 'supplier name', 'distributor name', 'vendor', 'supplier', 'distributor'].some(s => n === s || n.includes(s))) {
      needs.needsSupplierName = false;
      needs.detectedSupplierName = h;
    }
  }

  return needs;
}

export function buildMappings(
  headers: string[],
  userPrompts: UserPrompts,
  promptNeeds: PromptNeeds
): FieldMapping[] {
  // Pre-classify headers
  const convHeaders = headers.filter(isConvHeader);
  const totalHeaders = headers.filter(isTotalHeader);
  const quantityHeaders = headers.filter(h => isQuantityHeader(h) && !isConvHeader(h));
  const mappings: FieldMapping[] = TEMPLATE_FIELDS.map(config => {
    const { field } = config;

    // 1. Always null
    if (config.alwaysNull) {
      return { templateField: field, value: { type: 'null' }, confidence: 'always-null', locked: true };
    }

    // 2. Mirror fields — resolved after primary
    if (config.mirrorOf) {
      // Will be resolved after first pass
      return { templateField: field, value: { type: 'null' }, confidence: 'none' };
    }

    // 3. Facility fields
    if (config.isFacility) {
      if (field === 'FacilityID') {
        if (!promptNeeds.needsFacilityId && promptNeeds.detectedFacilityId) {
          return { templateField: field, value: { type: 'column', name: promptNeeds.detectedFacilityId }, confidence: 'high' };
        }
        if (userPrompts.facilityId) {
          return { templateField: field, value: { type: 'literal', value: userPrompts.facilityId }, confidence: 'hardcoded' };
        }
        if (userPrompts.facilityName) {
          return { templateField: field, value: { type: 'literal', value: userPrompts.facilityName }, confidence: 'hardcoded' };
        }
      }
      if (field === 'FacilityName') {
        if (!promptNeeds.needsFacilityName && promptNeeds.detectedFacilityName) {
          return { templateField: field, value: { type: 'column', name: promptNeeds.detectedFacilityName }, confidence: 'high' };
        }
        if (userPrompts.facilityName) {
          return { templateField: field, value: { type: 'literal', value: userPrompts.facilityName }, confidence: 'hardcoded' };
        }
      }
      return { templateField: field, value: { type: 'null' }, confidence: 'none' };
    }

    // 4. Date fields
    if (config.isDate && field === 'InvoiceDate') {
      if (!promptNeeds.needsDate && promptNeeds.detectedDate) {
        return { templateField: field, value: { type: 'column', name: promptNeeds.detectedDate }, confidence: 'high' };
      }
      if (userPrompts.date) {
        return { templateField: field, value: { type: 'literal', value: userPrompts.date }, confidence: 'hardcoded' };
      }
      return { templateField: field, value: { type: 'null' }, confidence: 'none' };
    }

    // 5. Supplier name
    if (config.isSupplier) {
      if (!promptNeeds.needsSupplierName && promptNeeds.detectedSupplierName) {
        return { templateField: field, value: { type: 'column', name: promptNeeds.detectedSupplierName }, confidence: 'high' };
      }
      if (userPrompts.supplierName) {
        return { templateField: field, value: { type: 'literal', value: userPrompts.supplierName }, confidence: 'hardcoded' };
      }
      return { templateField: field, value: { type: 'null' }, confidence: 'none' };
    }

    // 6. Conv factor field — always prefer conv headers
    if (config.isConvFactor) {
      if (convHeaders.length > 0) {
        return { templateField: field, value: { type: 'column', name: convHeaders[0] }, confidence: 'high' };
      }
    }

    // 7. Price field — compute if needed
    if (config.isPrice && field === 'InvoiceUnitofMeasurePrice') {
      // First try direct price column (excluding total-type columns)
      const directPrice = headers.find(h => isPriceHeader(h) && !isTotalHeader(h) && !isConvHeader(h));
      if (directPrice) {
        return { templateField: field, value: { type: 'column', name: directPrice }, confidence: 'high' };
      }
      // Compute from total / qty
      if (totalHeaders.length > 0 && quantityHeaders.length > 0) {
        const totalCol = totalHeaders[0];
        const qtyCol = quantityHeaders[0];
        const expr = `TRY_CAST([${totalCol}] AS FLOAT) / NULLIF(TRY_CAST([${qtyCol}] AS FLOAT), 0)`;
        return {
          templateField: field,
          value: { type: 'computed', expression: expr, description: `[${totalCol}] ÷ [${qtyCol}]` },
          confidence: 'computed',
        };
      }
    }

    // 8. Quantity fields — prefer non-conv quantity headers
    if (config.isQuantity && field === 'InvoiceUnitofMeasureQuantity') {
      // Exclude conv headers from quantity candidates
      const qtyOnly = headers.filter(h => isQuantityHeader(h) && !isConvHeader(h));
      if (qtyOnly.length > 0) {
        return { templateField: field, value: { type: 'column', name: qtyOnly[0] }, confidence: 'high' };
      }
    }

    // 9. Total amount fields
    if (config.isTotal && field === 'TotalInvoiceAmount') {
      if (totalHeaders.length > 0) {
        return { templateField: field, value: { type: 'column', name: totalHeaders[0] }, confidence: 'high' };
      }
    }

    // 10. Generic fuzzy matching
    let bestHeader = '';
    let bestScore = 0;
    for (const h of headers) {
      // Skip conv headers for non-conv fields
      if (!config.isConvFactor && isConvHeader(h)) continue;
      const score = matchHeaderToField(h, config);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = h;
      }
    }

    if (bestScore >= 0.99) {
      return { templateField: field, value: { type: 'column', name: bestHeader }, confidence: 'exact' };
    } else if (bestScore >= 0.7) {
      return { templateField: field, value: { type: 'column', name: bestHeader }, confidence: 'high' };
    } else if (bestScore >= 0.45) {
      return { templateField: field, value: { type: 'column', name: bestHeader }, confidence: 'medium' };
    } else if (bestScore >= 0.25) {
      return { templateField: field, value: { type: 'column', name: bestHeader }, confidence: 'low' };
    }

    return { templateField: field, value: { type: 'null' }, confidence: 'none' };
  });

  // Second pass: resolve mirrors
  const primaryMap: Record<string, MappingValueType> = {};
  for (const m of mappings) {
    primaryMap[m.templateField] = m.value;
  }

  return mappings.map(m => {
    const config = TEMPLATE_FIELDS.find(f => f.field === m.templateField)!;
    if (!config.mirrorOf) return m;

    const source = primaryMap[config.mirrorOf];
    if (!source) return m;

    // Date mirrors always use the hardcoded date if set
    if (config.isDate && userPrompts.date && !promptNeeds.needsDate === false) {
      return { ...m, value: { type: 'literal', value: userPrompts.date }, confidence: 'hardcoded' };
    }

    // For price/qty/uom mirrors, mirror the source value
    if (source.type !== 'null') {
      return { ...m, value: source, confidence: m.confidence === 'none' ? 'high' : m.confidence };
    }

    return m;
  });
}
