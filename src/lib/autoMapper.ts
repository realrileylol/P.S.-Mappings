import { TEMPLATE_FIELDS } from './templateFields';
import type { TemplateFieldConfig } from './templateFields';
import type { FieldMapping, MappingValueType, PromptNeeds, UserPrompts } from '../types';
import { loadLearnings, getLearningsForField } from './learnings';

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
  if (normalize(config.field) === nh) return 1.0;
  if (!config.synonyms) return 0;
  if (config.isConvFactor && /conv/i.test(header)) return 0.95;
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
  return [
    'ext sales', 'extended amount', 'extended price', 'sales dollars',
    'total amount', 'total', 'extended invoice', 'invoice sales',
    'extended sales', 'invoice total',
  ].some(t => n.includes(t));
}

function isQuantityHeader(header: string): boolean {
  const n = normalize(header);
  return ['qty', 'quantity', 'units'].some(t => n.includes(t));
}

function isPriceHeader(header: string): boolean {
  const n = normalize(header);
  return ['price', 'unit price', 'cost'].some(t => n.includes(t));
}

// ── Date range parser ───────────────────────────────────────────────────────
// Handles values like "03/2025-01/2026" → "01-31-2026"
function parseDateRangeValue(value: string): string | null {
  const match = value.match(/(\d{1,2})[\/\-](\d{4})\s*[-–]\s*(\d{1,2})[\/\-](\d{4})/);
  if (!match) return null;
  const endMonth = parseInt(match[3], 10);
  const endYear = parseInt(match[4], 10);
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const mm = String(endMonth).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${mm}-${dd}-${endYear}`;
}

export function detectDateRangeInColumn(
  header: string,
  rows: Record<string, string>[]
): string | null {
  for (const row of rows.slice(0, 5)) {
    const val = String(row[header] ?? '').trim();
    const parsed = parseDateRangeValue(val);
    if (parsed) return parsed;
  }
  return null;
}

// ── Excel serial date detection ─────────────────────────────────────────────
// Excel stores dates as integers counting days since 1900-01-01
// e.g. 46066 = 02-12-2026
// Valid range: 40000–60000 covers roughly 2009–2064
function isExcelSerial(value: string): boolean {
  const n = Number(value.trim());
  return Number.isInteger(n) && n >= 40000 && n <= 60000;
}

export function detectExcelSerialDatesInColumn(
  header: string,
  rows: Record<string, string>[]
): boolean {
  const samples = rows.slice(0, 5).map(r => String(r[header] ?? '').trim()).filter(Boolean);
  return samples.length > 0 && samples.every(isExcelSerial);
}

function makeExcelDateComputed(columnName: string): MappingValueType {
  return {
    type: 'computed',
    expression: `DATEADD(day, [${columnName}] - 2, '1900-01-01')`,
    description: `DATEADD([${columnName}])`,
  };
}

// ── Price computation expression ────────────────────────────────────────────
function makePriceComputed(totalCol: string, qtyCol: string): MappingValueType {
  return {
    type: 'computed',
    expression: `TRY_CAST([${totalCol}] AS FLOAT) / NULLIF(TRY_CAST([${qtyCol}] AS FLOAT), 0)`,
    description: `[${totalCol}] ÷ [${qtyCol}]`,
  };
}

// After all fields are mapped, ensure price is computed if total+qty exist but no price
function resolveComputedPrice(mappings: FieldMapping[]): FieldMapping[] {
  const totalMapping = mappings.find(m => m.templateField === 'TotalInvoiceAmount');
  const qtyMapping = mappings.find(m => m.templateField === 'InvoiceUnitofMeasureQuantity');
  const priceMapping = mappings.find(m => m.templateField === 'InvoiceUnitofMeasurePrice');
  const poPriceMapping = mappings.find(m => m.templateField === 'POUnitofMeasurePrice');

  const totalCol = totalMapping?.value.type === 'column' ? totalMapping.value.name : null;
  const qtyCol = qtyMapping?.value.type === 'column' ? qtyMapping.value.name : null;

  if (!totalCol || !qtyCol) return mappings;

  // Only compute if price isn't already a direct column or computed
  const priceNeedsCompute =
    !priceMapping ||
    priceMapping.value.type === 'null' ||
    (priceMapping.value.type === 'column' && isTotalHeader(priceMapping.value.name));

  if (!priceNeedsCompute) return mappings;

  const computed = makePriceComputed(totalCol, qtyCol);

  return mappings.map(m => {
    if (m.templateField === 'InvoiceUnitofMeasurePrice' && priceNeedsCompute) {
      return { ...m, value: computed, confidence: 'computed' as const };
    }
    if (m.templateField === 'POUnitofMeasurePrice' &&
      (!poPriceMapping || poPriceMapping.value.type === 'null' ||
        (poPriceMapping.value.type === 'column' && isTotalHeader(poPriceMapping.value.name)))) {
      return { ...m, value: computed, confidence: 'computed' as const };
    }
    return m;
  });
}

export function detectPromptNeeds(
  headers: string[],
  rows: Record<string, string>[] = []
): PromptNeeds {
  const needs: PromptNeeds = {
    needsFacilityId: true,
    needsFacilityName: true,
    needsDate: true,
    needsSupplierName: true,
  };

  for (const h of headers) {
    const n = normalize(h);
    if (['facility id', 'facility_id', 'account number', 'customer id', 'site id'].some(s => n.includes(s))) {
      needs.needsFacilityId = false;
      needs.detectedFacilityId = h;
    }
    if (['facility name', 'customer name', 'hospital name', 'account name', 'site name', 'client name'].some(s => n.includes(s))) {
      needs.needsFacilityName = false;
      needs.detectedFacilityName = h;
    }
    if (['date', 'invoice date', 'po date', 'posting date', 'order date'].some(s => n.includes(s))) {
      // Check if values are date ranges — if so, parse and hardcode
      const rangeDate = rows.length > 0 ? detectDateRangeInColumn(h, rows) : null;
      if (rangeDate) {
        // Treat as a hardcoded date — no column mapping needed
        needs.needsDate = false;
        needs.detectedDate = h;
        needs.resolvedDate = rangeDate; // parsed last-day-of-range
      } else {
        needs.needsDate = false;
        needs.detectedDate = h;
      }
    }
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
  promptNeeds: PromptNeeds,
  _rows: Record<string, string>[] = []
): FieldMapping[] {
  const convHeaders = headers.filter(isConvHeader);
  const totalHeaders = headers.filter(isTotalHeader);

  const mappings: FieldMapping[] = TEMPLATE_FIELDS.map(config => {
    const { field } = config;

    // 1. Always null
    if (config.alwaysNull) {
      return { templateField: field, value: { type: 'null' }, confidence: 'always-null', locked: true };
    }

    // 2. Mirror fields — resolved in second pass
    if (config.mirrorOf) {
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

    // 4. Date fields — handle range values and Excel serial dates
    if (config.isDate && (field === 'InvoiceDate' || field === 'PODate')) {
      // Date range already resolved (e.g. "03/2025-01/2026" → "01-31-2026")
      if (promptNeeds.resolvedDate) {
        return { templateField: field, value: { type: 'literal', value: promptNeeds.resolvedDate }, confidence: 'hardcoded' };
      }
      if (!promptNeeds.needsDate && promptNeeds.detectedDate) {
        // Check for Excel serial dates in the column
        if (_rows.length > 0 && detectExcelSerialDatesInColumn(promptNeeds.detectedDate, _rows)) {
          return { templateField: field, value: makeExcelDateComputed(promptNeeds.detectedDate), confidence: 'computed' };
        }
        return { templateField: field, value: { type: 'column', name: promptNeeds.detectedDate }, confidence: 'high' };
      }
      if (userPrompts.date) {
        return { templateField: field, value: { type: 'literal', value: userPrompts.date }, confidence: 'hardcoded' };
      }
      return { templateField: field, value: { type: 'null' }, confidence: 'none' };
    }
    // PostingDate stays as a mirror — handled in second pass
    if (config.isDate && field === 'PostingDate') {
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

    // 6. Conv factor
    if (config.isConvFactor) {
      if (convHeaders.length > 0) {
        return { templateField: field, value: { type: 'column', name: convHeaders[0] }, confidence: 'high' };
      }
    }

    // 7. Price — try direct price column first, compute deferred to post-pass
    if (config.isPrice && field === 'InvoiceUnitofMeasurePrice') {
      const directPrice = headers.find(h => isPriceHeader(h) && !isTotalHeader(h) && !isConvHeader(h));
      if (directPrice) {
        return { templateField: field, value: { type: 'column', name: directPrice }, confidence: 'high' };
      }
      // Defer — resolveComputedPrice will handle after all fields mapped
      return { templateField: field, value: { type: 'null' }, confidence: 'none' };
    }

    // 8. Quantity
    if (config.isQuantity && field === 'InvoiceUnitofMeasureQuantity') {
      const qtyOnly = headers.filter(h => isQuantityHeader(h) && !isConvHeader(h));
      if (qtyOnly.length > 0) {
        return { templateField: field, value: { type: 'column', name: qtyOnly[0] }, confidence: 'high' };
      }
    }

    // 9. Total amount
    if (config.isTotal && field === 'TotalInvoiceAmount') {
      if (totalHeaders.length > 0) {
        return { templateField: field, value: { type: 'column', name: totalHeaders[0] }, confidence: 'high' };
      }
    }

    // 10. Learned synonyms
    const learnedHeaders = getLearningsForField(field, loadLearnings());
    for (const learned of learnedHeaders) {
      const match = headers.find(h => h.toLowerCase().trim() === learned.toLowerCase().trim());
      if (match) {
        return { templateField: field, value: { type: 'column', name: match }, confidence: 'exact' };
      }
    }

    // 11. Generic fuzzy matching
    let bestHeader = '';
    let bestScore = 0;
    for (const h of headers) {
      if (!config.isConvFactor && isConvHeader(h)) continue;
      const score = matchHeaderToField(h, config);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = h;
      }
    }

    if (bestScore >= 0.99) return { templateField: field, value: { type: 'column', name: bestHeader }, confidence: 'exact' };
    if (bestScore >= 0.7)  return { templateField: field, value: { type: 'column', name: bestHeader }, confidence: 'high' };
    if (bestScore >= 0.45) return { templateField: field, value: { type: 'column', name: bestHeader }, confidence: 'medium' };
    if (bestScore >= 0.25) return { templateField: field, value: { type: 'column', name: bestHeader }, confidence: 'low' };

    return { templateField: field, value: { type: 'null' }, confidence: 'none' };
  });

  // Second pass: resolve mirrors
  const primaryMap: Record<string, MappingValueType> = {};
  for (const m of mappings) primaryMap[m.templateField] = m.value;

  const withMirrors = mappings.map(m => {
    const config = TEMPLATE_FIELDS.find(f => f.field === m.templateField)!;
    if (!config.mirrorOf) return m;

    const source = primaryMap[config.mirrorOf];
    if (!source) return m;

    if (config.isDate) {
      // Date mirrors: use resolvedDate or userPrompts.date if available
      const dateVal = promptNeeds.resolvedDate ?? userPrompts.date;
      if (dateVal) return { ...m, value: { type: 'literal' as const, value: dateVal }, confidence: 'hardcoded' as const };
    }

    if (source.type !== 'null') {
      return { ...m, value: source, confidence: m.confidence === 'none' ? 'high' as const : m.confidence };
    }

    return m;
  });

  // Third pass: compute price from total ÷ qty if price is still unresolved
  return resolveComputedPrice(withMirrors);
}
