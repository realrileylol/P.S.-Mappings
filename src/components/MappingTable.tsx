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

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { label: string; color: string; icon: React.ReactNode }> = {
  'exact':       { label: 'Exact',       color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  'high':        { label: 'High',        color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',         icon: <CheckCircle2 className="w-3 h-3" /> },
  'medium':      { label: 'Medium',      color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',   icon: <AlertCircle className="w-3 h-3" /> },
  'low':         { label: 'Low',         color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',   icon: <AlertCircle className="w-3 h-3" /> },
  'none':        { label: 'Null',        color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',      icon: <HelpCircle className="w-3 h-3" /> },
  'hardcoded':   { label: 'Hardcoded',   color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',   icon: <Hash className="w-3 h-3" /> },
  'computed':    { label: 'Computed',    color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',         icon: <Zap className="w-3 h-3" /> },
  'always-null': { label: 'Always Null', color: 'text-slate-600 bg-slate-600/10 border-slate-600/20',      icon: <Lock className="w-3 h-3" /> },
};

// Required BroadJump fields
const REQUIRED_FIELDS = new Set(['InvoiceDate', 'InvoiceUnitofMeasurePrice', 'InvoiceUnitofMeasureQuantity']);

function ValueDisplay({ value }: { value: MappingValueType }) {
  switch (value.type) {
    case 'null':
      return <span className="text-slate-500 italic text-xs">null</span>;
    case 'literal':
      return <span className="text-purple-300 font-mono text-xs">'{value.value}'</span>;
    case 'column':
      return <span className="text-emerald-300 font-mono text-xs">[{value.name}]</span>;
    case 'computed':
      return (
        <span className="text-cyan-300 font-mono text-xs truncate" title={value.expression}>
          {value.description}
        </span>
      );
  }
}

function SampleValues({ value, sampleData }: { value: MappingValueType; sampleData: Record<string, string>[] }) {
  if (value.type !== 'column' || sampleData.length === 0) return null;

  const samples = sampleData
    .slice(0, 3)
    .map(row => row[value.name])
    .filter(v => v !== undefined && v !== '' && v !== null)
    .slice(0, 3);

  if (samples.length === 0) return null;

  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {samples.map((s, i) => (
        <span key={i} className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]" title={String(s)}>
          {String(s)}
        </span>
      ))}
    </div>
  );
}

interface RowProps {
  mapping: FieldMapping;
  clientHeaders: string[];
  sampleData: Record<string, string>[];
  wasEdited: boolean;
  onChange: (updated: FieldMapping, originalHeader: string | null) => void;
}

function MappingRow({ mapping, clientHeaders, sampleData, wasEdited, onChange }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [literalInput, setLiteralInput] = useState('');
  const [showLiteralInput, setShowLiteralInput] = useState(false);
  const conf = CONFIDENCE_STYLES[mapping.confidence];
  const isLocked = mapping.locked;
  const isRequired = REQUIRED_FIELDS.has(mapping.templateField);
  const isMissingRequired = isRequired && mapping.value.type === 'null';

  const originalHeader = mapping.value.type === 'column' ? mapping.value.name : null;

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === '__literal__') {
      setShowLiteralInput(true);
      return;
    }
    let newValue: MappingValueType;
    if (val === '__null__') {
      newValue = { type: 'null' };
    } else {
      // If this is a date field, check for range or Excel serial values
      if (DATE_FIELDS.has(mapping.templateField)) {
        const resolvedDate = detectDateRangeInColumn(val, sampleData);
        if (resolvedDate) {
          onChange({ ...mapping, value: { type: 'literal', value: resolvedDate }, confidence: 'hardcoded' }, originalHeader);
          setEditing(false);
          return;
        }
      }
      if (EXCEL_DATE_FIELDS.has(mapping.templateField) && detectExcelSerialDatesInColumn(val, sampleData)) {
        onChange({
          ...mapping,
          value: { type: 'computed', expression: `DATEADD(day, [${val}] - 2, '1900-01-01')`, description: `DATEADD([${val}])` },
          confidence: 'computed',
        }, originalHeader);
        setEditing(false);
        return;
      }
      newValue = { type: 'column', name: val };
    }
    onChange({ ...mapping, value: newValue, confidence: 'high' }, originalHeader);
    setEditing(false);
  }

  function commitLiteral() {
    if (literalInput.trim()) {
      onChange({ ...mapping, value: { type: 'literal', value: literalInput.trim() }, confidence: 'hardcoded' }, originalHeader);
    }
    setShowLiteralInput(false);
    setLiteralInput('');
    setEditing(false);
  }

  return (
    <tr className={`border-b border-slate-800/60 transition-colors group
      ${isMissingRequired ? 'bg-red-900/10' : 'hover:bg-slate-800/30'}
    `}>
      {/* Template field */}
      <td className="py-2.5 px-4 w-56">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-300 text-xs font-mono">{mapping.templateField}</span>
          {isRequired && (
            <span className="text-red-400 text-xs font-bold" title="Required by BroadJump">*</span>
          )}
          {wasEdited && (
            <span title="You edited this — will be learned">
              <Brain className="w-3 h-3 text-violet-400" />
            </span>
          )}
        </div>
      </td>

      {/* Confidence badge */}
      <td className="py-2.5 px-3 w-28">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${conf.color}`}>
          {conf.icon}
          {conf.label}
        </span>
        {isMissingRequired && (
          <div className="text-red-400 text-xs mt-0.5 font-medium">Required!</div>
        )}
      </td>

      {/* Mapped value + sample data */}
      <td className="py-2.5 px-3">
        {showLiteralInput ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={literalInput}
              onChange={e => setLiteralInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitLiteral()}
              placeholder="Enter hardcoded value..."
              className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs text-white flex-1 focus:outline-none"
            />
            <button onClick={commitLiteral} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 rounded">OK</button>
            <button onClick={() => { setShowLiteralInput(false); setEditing(false); }} className="text-xs text-slate-400 px-1">✕</button>
          </div>
        ) : editing && !isLocked ? (
          <select
            autoFocus
            onChange={handleSelect}
            onBlur={() => setEditing(false)}
            className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs text-white w-full focus:outline-none"
            defaultValue={mapping.value.type === 'column' ? mapping.value.name : '__null__'}
          >
            <option value="__null__">null</option>
            <option value="__literal__">── Enter hardcoded value ──</option>
            {clientHeaders.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <ValueDisplay value={mapping.value} />
              {!isLocked && (
                <button
                  onClick={() => setEditing(true)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all text-xs ml-1 px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                >
                  edit
                </button>
              )}
              {isLocked && <Lock className="w-3 h-3 text-slate-600 ml-1" />}
            </div>
            <SampleValues value={mapping.value} sampleData={sampleData} />
          </div>
        )}
      </td>
    </tr>
  );
}

export function MappingTable({ mappings, clientHeaders, sampleData, profileMatch, onMappingsChange, onContinue, onProfileOverride, onNewFile }: Props) {
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);
  const editsRef = useRef<Map<string, SessionEdit>>(new Map());

  // Real-time: auto-fill TotalInvoiceAmount + AmountPaid when qty × price both mapped
  useEffect(() => {
    const qtyM  = mappings.find(m => m.templateField === 'InvoiceUnitofMeasureQuantity');
    const priceM = mappings.find(m => m.templateField === 'InvoiceUnitofMeasurePrice');

    const qtyCol   = qtyM?.value.type   === 'column' ? qtyM.value.name   : null;
    const priceCol = priceM?.value.type === 'column' ? priceM.value.name : null;

    if (!qtyCol || !priceCol) return;

    const expr = `TRY_CAST([${qtyCol}] AS FLOAT) * TRY_CAST([${priceCol}] AS FLOAT)`;
    const desc = `[${qtyCol}] × [${priceCol}]`;
    const computed = { type: 'computed' as const, expression: expr, description: desc };

    let changed = false;
    const next = mappings.map(m => {
      // Only fill if currently null or was previously auto-computed (not manually set to a real column)
      if (
        (m.templateField === 'TotalInvoiceAmount' || m.templateField === 'AmountPaid') &&
        (m.value.type === 'null' || m.confidence === 'computed')
      ) {
        changed = true;
        return { ...m, value: computed, confidence: 'computed' as const };
      }
      return m;
    });

    if (changed) onMappingsChange(next);
  }, [
    mappings.find(m => m.templateField === 'InvoiceUnitofMeasureQuantity')?.value,
    mappings.find(m => m.templateField === 'InvoiceUnitofMeasurePrice')?.value,
  ]);

  const nullCount = mappings.filter(m => m.value.type === 'null').length;
  const matchedCount = mappings.filter(m => m.value.type !== 'null').length;
  const lowConfidence = mappings.filter(m => m.confidence === 'low' || m.confidence === 'medium').length;
  const missingRequired = mappings.filter(m => REQUIRED_FIELDS.has(m.templateField) && m.value.type === 'null').length;
  const editCount = editsRef.current.size;

  function handleChange(index: number, updated: FieldMapping, originalHeader: string | null) {
    const next = [...mappings];
    next[index] = updated;
    onMappingsChange(next);

    // Track the edit
    const correctedHeader = updated.value.type === 'column' ? updated.value.name : null;
    editsRef.current.set(updated.templateField, {
      templateField: updated.templateField,
      originalHeader,
      correctedHeader,
    });
  }

  function handleContinue() {
    onContinue(Array.from(editsRef.current.values()));
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Column Mapping</h2>
            <p className="text-slate-400 text-xs mt-0.5">Review and adjust. Sample values shown below each mapping.</p>
          </div>
          <div className="flex items-center gap-4">
            <NewFileButton onNewFile={onNewFile} />
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-400">{matchedCount} mapped</span>
              <span className="text-slate-500">{nullCount} null</span>
              {lowConfidence > 0 && <span className="text-yellow-400">{lowConfidence} to review</span>}
              {editCount > 0 && (
                <span className="text-violet-400 flex items-center gap-1">
                  <Brain className="w-3 h-3" />{editCount} to learn
                </span>
              )}
            </div>
            <button
              onClick={handleContinue}
              className={`flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors
                ${missingRequired > 0 ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
              {missingRequired > 0 ? `${missingRequired} Required Field${missingRequired > 1 ? 's' : ''} Missing` : 'Generate Output'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Profile matched banner */}
      {profileMatch && !profileBannerDismissed && (
        <MatchedProfileBanner
          match={profileMatch}
          onDismiss={() => setProfileBannerDismissed(true)}
          onOverride={() => { setProfileBannerDismissed(true); onProfileOverride(); }}
        />
      )}

      {/* Required field alert banner */}
      {missingRequired > 0 && (
        <div className="bg-red-900/20 border-b border-red-800/50 px-6 py-2.5">
          <div className="max-w-5xl mx-auto text-red-400 text-xs font-medium">
            ⚠ BroadJump requires InvoiceDate, InvoiceUnitofMeasurePrice, and InvoiceUnitofMeasureQuantity — {missingRequired} still null. You can still continue but the file may fail to process.
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-6 py-2 flex flex-wrap gap-3">
          {(Object.entries(CONFIDENCE_STYLES) as [ConfidenceLevel, typeof CONFIDENCE_STYLES[ConfidenceLevel]][]).map(([key, val]) => (
            <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${val.color}`}>
              {val.icon} {val.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs text-violet-400 bg-violet-400/10 border-violet-400/20">
            <Brain className="w-3 h-3" /> Will Learn
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 pb-8">
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="py-2 px-4 font-medium">Template Field</th>
                <th className="py-2 px-3 font-medium">Confidence</th>
                <th className="py-2 px-3 font-medium">Mapped To / Sample Values</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => (
                <MappingRow
                  key={m.templateField}
                  mapping={m}
                  clientHeaders={clientHeaders}
                  sampleData={sampleData}
                  wasEdited={editsRef.current.has(m.templateField)}
                  onChange={(updated, orig) => handleChange(i, updated, orig)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
