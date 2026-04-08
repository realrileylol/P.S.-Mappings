import { useState, useRef, useEffect } from 'react';
import { ChevronRight, Lock, Zap, AlertCircle, CheckCircle2, HelpCircle, Hash, Brain } from 'lucide-react';
import type { FieldMapping, MappingValueType, ConfidenceLevel } from '../types';
import type { SessionEdit } from '../lib/learnings';
import type { ProfileMatch } from '../lib/profiles';
import { MatchedProfileBanner } from './ProfileBanner';
import { NewFileButton } from './NewFileButton';
import { detectDateRangeInColumn, detectExcelSerialDatesInColumn } from '../lib/autoMapper';

const DATE_FIELDS = new Set(['InvoiceDate', 'PODate', 'PostingDate']);
const EXCEL_DATE_FIELDS = new Set(['InvoiceDate', 'PODate']);

interface Props {
  mappings: FieldMapping[];
  clientHeaders: string[];
  sampleData: Record<string, string>[];
  profileMatch: ProfileMatch | null;
  onMappingsChange: (updated: FieldMapping[]) => void;
  onContinue: (edits: SessionEdit[]) => void;
  onProfileOverride: () => void;
  onNewFile: () => void;
}

// ── Section groupings ──────────────────────────────────────────────────────

const FIELD_SECTION: Record<string, string> = {
  FacilityID: 'Facility', FacilityName: 'Facility',
  InvoiceExtractDate: 'Invoice', InvoiceDate: 'Invoice',
  InvoiceNumber: 'Invoice', InvoiceLineNumber: 'Invoice',
  TotalInvoiceAmount: 'Invoice', AmountPaid: 'Invoice',
  InvoiceSupplierId: 'Supplier', SupplierName: 'Supplier',
  SupplierCatalogNumber: 'Supplier', SupplierCatalogDescription: 'Supplier',
  InvoiceUnitofMeasure: 'Line Item', InvoiceUnitofMeasurePrice: 'Line Item',
  InvoiceUnitofMeasureQuantity: 'Line Item',
  DepartmentCode: 'GL / Dept', DepartmentName: 'GL / Dept',
  DepartmentSubAccountCode: 'GL / Dept', DepartmentSubAccountName: 'GL / Dept',
  GLAccountNumber: 'GL / Dept', GLAccountName: 'GL / Dept',
  GLSubAccountNumber: 'GL / Dept', GLSubAccountName: 'GL / Dept',
  GLDescription: 'GL / Dept',
  PODate: 'Purchase Order', PONumber: 'Purchase Order',
  POLineNumber: 'Purchase Order', POUnitofMeasure: 'Purchase Order',
  POUnitofMeasurePrice: 'Purchase Order', POUnitofMeasureQuantity: 'Purchase Order',
  MMISQuantityPerPurchaseUnitofMeasure: 'MMIS', MMISItemNumber: 'MMIS',
  MMISManufacturerID: 'MMIS', MMISManufacturerDivision: 'MMIS',
  MMISManufacturerName: 'MMIS', MMISManufacturerCatalogNumber: 'MMIS',
  ItemType: 'MMIS', MMISFacilityCategoryID: 'MMIS',
  MMISFacilityCategoryDescription: 'MMIS', MMISSubCategoryID: 'MMIS',
  MMISSubCategoryDescription: 'MMIS',
  PostingDate: 'Contract & Other', ContractIndicator: 'Contract & Other',
  ContractNumber: 'Contract & Other', ContractName: 'Contract & Other',
  TransactionType: 'Contract & Other', CheckNumber: 'Contract & Other',
  CheckDate: 'Contract & Other', UNSPSC: 'Contract & Other',
  GTIN: 'Contract & Other', NDC: 'Contract & Other',
};

// Readable labels for long camelCase field names
const FIELD_LABEL: Record<string, string> = {
  InvoiceUnitofMeasurePrice:    'Invoice Unit Price',
  InvoiceUnitofMeasureQuantity: 'Invoice Quantity',
  InvoiceUnitofMeasure:         'Invoice UoM',
  POUnitofMeasurePrice:         'PO Unit Price',
  POUnitofMeasureQuantity:      'PO Quantity',
  POUnitofMeasure:              'PO UoM',
  MMISQuantityPerPurchaseUnitofMeasure: 'MMIS Conv Factor',
  MMISManufacturerCatalogNumber: 'Mfr Catalog #',
  MMISFacilityCategoryDescription: 'MMIS Category Desc',
  MMISSubCategoryDescription:   'MMIS SubCategory Desc',
  SupplierCatalogDescription:   'Supplier Description',
  DepartmentSubAccountCode:     'Dept Sub-Account Code',
  DepartmentSubAccountName:     'Dept Sub-Account Name',
  InvoiceSupplierId:            'Invoice Supplier ID',
};

function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

// ── Confidence styles ──────────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  'exact':       { label: 'Exact',       dot: 'bg-emerald-400', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  'high':        { label: 'High',        dot: 'bg-blue-400',    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',         icon: <CheckCircle2 className="w-3 h-3" /> },
  'medium':      { label: 'Medium',      dot: 'bg-yellow-400',  color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',   icon: <AlertCircle className="w-3 h-3" /> },
  'low':         { label: 'Low',         dot: 'bg-orange-400',  color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',   icon: <AlertCircle className="w-3 h-3" /> },
  'none':        { label: 'Null',        dot: 'bg-slate-600',   color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',      icon: <HelpCircle className="w-3 h-3" /> },
  'hardcoded':   { label: 'Hardcoded',   dot: 'bg-purple-400',  color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',   icon: <Hash className="w-3 h-3" /> },
  'computed':    { label: 'Computed',    dot: 'bg-cyan-400',    color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',         icon: <Zap className="w-3 h-3" /> },
  'always-null': { label: 'Always Null', dot: 'bg-slate-700',   color: 'text-slate-600 bg-slate-600/10 border-slate-600/20',      icon: <Lock className="w-3 h-3" /> },
};

const REQUIRED_FIELDS = new Set(['InvoiceDate', 'InvoiceUnitofMeasurePrice', 'InvoiceUnitofMeasureQuantity']);

// ── Value display ──────────────────────────────────────────────────────────

function ValueDisplay({ value }: { value: MappingValueType }) {
  switch (value.type) {
    case 'null':
      return <span className="text-slate-600 text-xs select-none">—</span>;
    case 'literal':
      return (
        <span className="inline-flex items-center gap-1">
          <span className="text-slate-500 text-xs">'</span>
          <span className="text-purple-300 font-mono text-xs">{value.value}</span>
          <span className="text-slate-500 text-xs">'</span>
        </span>
      );
    case 'column':
      return (
        <span className="inline-flex items-center gap-1">
          <span className="text-slate-600 text-xs">[</span>
          <span className="text-emerald-300 font-mono text-xs">{value.name}</span>
          <span className="text-slate-600 text-xs">]</span>
        </span>
      );
    case 'computed':
      return (
        <span className="text-cyan-300 font-mono text-xs truncate max-w-xs" title={value.expression}>
          {value.description}
        </span>
      );
  }
}

function SampleChips({ value, sampleData }: { value: MappingValueType; sampleData: Record<string, string>[] }) {
  if (value.type !== 'column' || sampleData.length === 0) return null;
  const samples = sampleData
    .slice(0, 4)
    .map(row => row[value.name])
    .filter(v => v !== undefined && v !== '' && v !== null)
    .slice(0, 3);
  if (samples.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap mt-1.5">
      {samples.map((s, i) => (
        <span key={i} className="text-[10px] text-slate-500 bg-slate-800/80 border border-slate-700/50 px-1.5 py-0.5 rounded font-mono truncate max-w-[110px]" title={String(s)}>
          {String(s)}
        </span>
      ))}
    </div>
  );
}

// ── Mapping row ────────────────────────────────────────────────────────────

interface RowProps {
  mapping: FieldMapping;
  clientHeaders: string[];
  sampleData: Record<string, string>[];
  wasEdited: boolean;
  onChange: (updated: FieldMapping, originalHeader: string | null) => void;
}

function MappingRow({ mapping, clientHeaders, sampleData, wasEdited, onChange }: RowProps) {
  const [editing, setEditing]           = useState(false);
  const [literalInput, setLiteralInput] = useState('');
  const [showLiteralInput, setShowLiteralInput] = useState(false);
  const [showFormula, setShowFormula]   = useState(false);
  const [fCol1, setFCol1]               = useState('');
  const [fCol2, setFCol2]               = useState('');
  const [fOp, setFOp]                   = useState<'÷' | '×'>('÷');

  const conf = CONFIDENCE_STYLES[mapping.confidence];
  const isLocked = mapping.locked;
  const isRequired = REQUIRED_FIELDS.has(mapping.templateField);
  const isNull = mapping.value.type === 'null';
  const isMissingRequired = isRequired && isNull;
  const originalHeader = mapping.value.type === 'column' ? mapping.value.name : null;

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (!val) return;
    if (val === '__literal__') { setShowLiteralInput(true); return; }
    if (val === '__formula__') { setShowFormula(true); setEditing(false); return; }
    let newValue: MappingValueType;
    if (DATE_FIELDS.has(mapping.templateField)) {
      const resolvedDate = detectDateRangeInColumn(val, sampleData);
      if (resolvedDate) {
        onChange({ ...mapping, value: { type: 'literal', value: resolvedDate }, confidence: 'hardcoded' }, originalHeader);
        setEditing(false); return;
      }
    }
    if (EXCEL_DATE_FIELDS.has(mapping.templateField) && detectExcelSerialDatesInColumn(val, sampleData)) {
      onChange({
        ...mapping,
        value: { type: 'computed', expression: `DATEADD(day, [${val}] - 2, '1900-01-01')`, description: `DATEADD([${val}])` },
        confidence: 'computed',
      }, originalHeader);
      setEditing(false); return;
    }
    newValue = { type: 'column', name: val };
    onChange({ ...mapping, value: newValue, confidence: 'high' }, originalHeader);
    setEditing(false);
  }

  function commitLiteral() {
    if (literalInput.trim()) {
      onChange({ ...mapping, value: { type: 'literal', value: literalInput.trim() }, confidence: 'hardcoded' }, originalHeader);
    }
    setShowLiteralInput(false); setLiteralInput(''); setEditing(false);
  }

  function commitFormula() {
    if (!fCol1 || !fCol2) return;
    let expression: string;
    let description: string;
    if (fOp === '÷') {
      expression  = `TRY_CAST([${fCol1}] AS FLOAT) / NULLIF(TRY_CAST([${fCol2}] AS FLOAT), 0)`;
      description = `[${fCol1}] ÷ [${fCol2}]`;
    } else {
      expression  = `TRY_CAST([${fCol1}] AS FLOAT) * TRY_CAST([${fCol2}] AS FLOAT)`;
      description = `[${fCol1}] × [${fCol2}]`;
    }
    onChange({
      ...mapping,
      value: { type: 'computed', expression, description },
      confidence: 'computed',
    }, originalHeader);
    setShowFormula(false);
  }

  const selectClass = "bg-slate-900 border border-blue-500/60 rounded px-2 py-1 text-xs text-white focus:outline-none";

  return (
    <tr className={`border-b transition-colors group
      ${isMissingRequired
        ? 'border-red-900/40 bg-red-950/20'
        : isNull
          ? 'border-slate-800/30 hover:bg-slate-800/20'
          : 'border-slate-800/50 hover:bg-slate-800/30'
      }`}
    >
      {/* Field name */}
      <td className="py-2.5 px-5 w-52">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-mono ${isNull ? 'text-slate-500' : 'text-slate-200'}`}>
            {fieldLabel(mapping.templateField)}
          </span>
          {isRequired && <span className="text-red-400 text-[10px] font-bold leading-none" title="Required">*</span>}
          {wasEdited && (
            <span title="Will be learned"><Brain className="w-3 h-3 text-violet-400 flex-shrink-0" /></span>
          )}
          {isLocked && <Lock className="w-3 h-3 text-slate-700 flex-shrink-0" />}
        </div>
        {isMissingRequired && <p className="text-red-500 text-[10px] mt-0.5 font-medium">Required field</p>}
      </td>

      {/* Confidence */}
      <td className="py-2.5 px-3 w-28">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${conf.color}`}>
          {conf.icon}{conf.label}
        </span>
      </td>

      {/* Value */}
      <td className="py-2 px-3">
        {showFormula ? (
          /* ── Formula builder ── */
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={fCol1} onChange={e => setFCol1(e.target.value)} className={selectClass}>
              <option value="">Column 1…</option>
              {clientHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <div className="flex rounded overflow-hidden border border-slate-600">
              <button
                onClick={() => setFOp('÷')}
                className={`px-2.5 py-1 text-xs font-bold transition-colors ${fOp === '÷' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800'}`}
              >÷</button>
              <button
                onClick={() => setFOp('×')}
                className={`px-2.5 py-1 text-xs font-bold transition-colors ${fOp === '×' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800'}`}
              >×</button>
            </div>
            <select value={fCol2} onChange={e => setFCol2(e.target.value)} className={selectClass}>
              <option value="">Column 2…</option>
              {clientHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <button
              onClick={commitFormula}
              disabled={!fCol1 || !fCol2}
              className="text-[11px] bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white px-2.5 py-1 rounded transition-colors font-medium"
            >
              Build
            </button>
            <button
              onClick={() => setShowFormula(false)}
              className="text-[11px] text-slate-500 hover:text-slate-300 px-1 transition-colors"
            >✕</button>
          </div>
        ) : showLiteralInput ? (
          <div className="flex gap-1.5 items-center">
            <input
              autoFocus
              value={literalInput}
              onChange={e => setLiteralInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitLiteral()}
              placeholder="Enter hardcoded value…"
              className="bg-slate-900 border border-blue-500/60 rounded px-2.5 py-1 text-xs text-white flex-1 focus:outline-none focus:border-blue-400"
            />
            <button onClick={commitLiteral} className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors">OK</button>
            <button onClick={() => { setShowLiteralInput(false); setEditing(false); }} className="text-[11px] text-slate-500 hover:text-slate-300 px-1 transition-colors">✕</button>
          </div>
        ) : editing && !isLocked ? (
          <select
            autoFocus
            onChange={handleSelect}
            onBlur={() => setEditing(false)}
            className={`${selectClass} w-full`}
            defaultValue={mapping.value.type === 'column' ? mapping.value.name : ''}
          >
            <option value="" disabled>Select a column…</option>
            <option value="__literal__">── Hardcode a value ──</option>
            <option value="__formula__">── Build formula (÷ ×) ──</option>
            {clientHeaders.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <ValueDisplay value={mapping.value} />
                {!isLocked && (
                  <button
                    onClick={() => setEditing(true)}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 transition-all text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 flex-shrink-0"
                  >
                    edit
                  </button>
                )}
                {/* One-click null — only show when field has a value */}
                {!isLocked && mapping.value.type !== 'null' && (
                  <button
                    onClick={() => onChange({ ...mapping, value: { type: 'null' }, confidence: 'none' }, originalHeader)}
                    title="Clear to null"
                    className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all text-[10px] px-1 py-0.5 rounded hover:bg-red-950/40 flex-shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
              <SampleChips value={mapping.value} sampleData={sampleData} />
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Section header row ─────────────────────────────────────────────────────

function SectionRow({ label, mappedCount, total }: { label: string; mappedCount: number; total: number }) {
  return (
    <tr className="border-b border-slate-700/40">
      <td colSpan={3} className="px-5 py-2 bg-slate-800/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
          <span className="text-[10px] text-slate-600">{mappedCount}/{total} mapped</span>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MappingTable({ mappings, clientHeaders, sampleData, profileMatch, onMappingsChange, onContinue, onProfileOverride, onNewFile }: Props) {
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);
  const editsRef = useRef<Map<string, SessionEdit>>(new Map());

  const MIRRORS: Record<string, string> = {
    'POUnitofMeasurePrice':    'InvoiceUnitofMeasurePrice',
    'POUnitofMeasureQuantity': 'InvoiceUnitofMeasureQuantity',
    'POUnitofMeasure':         'InvoiceUnitofMeasure',
    'AmountPaid':              'TotalInvoiceAmount',
  };

  const mirrorSourceKey = ['InvoiceUnitofMeasurePrice','InvoiceUnitofMeasureQuantity','InvoiceUnitofMeasure','TotalInvoiceAmount']
    .map(f => JSON.stringify(mappings.find(m => m.templateField === f)?.value ?? null))
    .join('|');

  useEffect(() => {
    const sourceMap: Record<string, MappingValueType | undefined> = {};
    for (const m of mappings) sourceMap[m.templateField] = m.value;
    let changed = false;
    const next = mappings.map(m => {
      const sourceField = MIRRORS[m.templateField];
      if (!sourceField) return m;
      const sourceVal = sourceMap[sourceField];
      if (!sourceVal || sourceVal.type === 'null') return m;
      if (m.value.type === 'null' || m.confidence === 'computed' || m.confidence === 'high' || m.confidence === 'none') {
        changed = true;
        return { ...m, value: sourceVal, confidence: m.confidence };
      }
      return m;
    });
    if (changed) onMappingsChange(next);
  }, [mirrorSourceKey]);

  const qtyPriceKey = [
    JSON.stringify(mappings.find(m => m.templateField === 'InvoiceUnitofMeasureQuantity')?.value ?? null),
    JSON.stringify(mappings.find(m => m.templateField === 'InvoiceUnitofMeasurePrice')?.value ?? null),
  ].join('|');

  useEffect(() => {
    const qtyM   = mappings.find(m => m.templateField === 'InvoiceUnitofMeasureQuantity');
    const priceM = mappings.find(m => m.templateField === 'InvoiceUnitofMeasurePrice');
    const qtyCol   = qtyM?.value.type   === 'column' ? qtyM.value.name   : null;
    const priceCol = priceM?.value.type === 'column' ? priceM.value.name : null;
    if (!qtyCol || !priceCol) return;
    const expr = `TRY_CAST([${qtyCol}] AS FLOAT) * TRY_CAST([${priceCol}] AS FLOAT)`;
    const computed = { type: 'computed' as const, expression: expr, description: `[${qtyCol}] × [${priceCol}]` };
    let changed = false;
    const next = mappings.map(m => {
      if (m.templateField === 'TotalInvoiceAmount' && (m.value.type === 'null' || m.confidence === 'computed')) {
        changed = true;
        return { ...m, value: computed, confidence: 'computed' as const };
      }
      return m;
    });
    if (changed) onMappingsChange(next);
  }, [qtyPriceKey]);

  const nullCount          = mappings.filter(m => m.value.type === 'null').length;
  const matchedCount       = mappings.filter(m => m.value.type !== 'null').length;
  const lowConfidence      = mappings.filter(m => m.confidence === 'low' || m.confidence === 'medium').length;
  const missingRequired    = mappings.filter(m => REQUIRED_FIELDS.has(m.templateField) && m.value.type === 'null').length;
  const editCount          = editsRef.current.size;

  function handleChange(index: number, updated: FieldMapping, originalHeader: string | null) {
    const next = [...mappings];
    next[index] = updated;
    onMappingsChange(next);
    const correctedHeader = updated.value.type === 'column' ? updated.value.name : null;
    editsRef.current.set(updated.templateField, { templateField: updated.templateField, originalHeader, correctedHeader });
  }

  // Build section-aware render list
  const rendered: React.ReactNode[] = [];
  let lastSection = '';

  mappings.forEach((m, i) => {
    const section = FIELD_SECTION[m.templateField] ?? 'Other';
    if (section !== lastSection) {
      const sectionMappings = mappings.filter(x => (FIELD_SECTION[x.templateField] ?? 'Other') === section);
      const sectionMapped   = sectionMappings.filter(x => x.value.type !== 'null').length;
      rendered.push(
        <SectionRow key={`section-${section}`} label={section} mappedCount={sectionMapped} total={sectionMappings.length} />
      );
      lastSection = section;
    }
    rendered.push(
      <MappingRow
        key={m.templateField}
        mapping={m}
        clientHeaders={clientHeaders}
        sampleData={sampleData}
        wasEdited={editsRef.current.has(m.templateField)}
        onChange={(updated, orig) => handleChange(i, updated, orig)}
      />
    );
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">Column Mapping</h2>
            <p className="text-slate-500 text-xs mt-0.5">Review and adjust. Sample values shown below each mapping.</p>
          </div>
          <div className="flex items-center gap-3">
            <NewFileButton onNewFile={onNewFile} />
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {matchedCount} mapped
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-500">{nullCount} null</span>
              {lowConfidence > 0 && <>
                <span className="text-slate-700">·</span>
                <span className="text-yellow-400">{lowConfidence} to review</span>
              </>}
              {editCount > 0 && <>
                <span className="text-slate-700">·</span>
                <span className="text-violet-400 flex items-center gap-1">
                  <Brain className="w-3 h-3" />{editCount} to learn
                </span>
              </>}
            </div>
            <button
              onClick={() => onContinue(Array.from(editsRef.current.values()))}
              className={`flex items-center gap-1.5 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors
                ${missingRequired > 0 ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
              {missingRequired > 0
                ? `${missingRequired} Required Missing`
                : 'Generate Output'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Profile banner */}
      {profileMatch && !profileBannerDismissed && (
        <MatchedProfileBanner
          match={profileMatch}
          onDismiss={() => setProfileBannerDismissed(true)}
          onOverride={() => { setProfileBannerDismissed(true); onProfileOverride(); }}
        />
      )}

      {/* Required field warning */}
      {missingRequired > 0 && (
        <div className="bg-red-950/40 border-b border-red-900/40 px-6 py-2">
          <p className="max-w-5xl mx-auto text-red-400 text-xs">
            ⚠ BroadJump requires InvoiceDate, InvoiceUnitofMeasurePrice, and InvoiceUnitofMeasureQuantity — {missingRequired} still unmapped.
          </p>
        </div>
      )}

      {/* Legend strip */}
      <div className="border-b border-slate-800/60 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-5 py-2 flex flex-wrap gap-x-4 gap-y-1">
          {(Object.entries(CONFIDENCE_STYLES) as [ConfidenceLevel, typeof CONFIDENCE_STYLES[ConfidenceLevel]][]).map(([key, val]) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${val.dot}`} />
              {val.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
            <Brain className="w-3 h-3 text-violet-400" />
            Will Learn
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-left">
                <th className="py-2.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-600 w-52">Field</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600 w-28">Confidence</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Mapped To</th>
              </tr>
            </thead>
            <tbody>{rendered}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
