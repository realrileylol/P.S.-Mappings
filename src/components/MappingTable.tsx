import { useState } from 'react';
import { ChevronRight, Lock, Zap, AlertCircle, CheckCircle2, HelpCircle, Hash } from 'lucide-react';
import type { FieldMapping, MappingValueType, ConfidenceLevel } from '../types';

interface Props {
  mappings: FieldMapping[];
  clientHeaders: string[];
  onMappingsChange: (updated: FieldMapping[]) => void;
  onContinue: () => void;
}

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { label: string; color: string; icon: React.ReactNode }> = {
  'exact':       { label: 'Exact',       color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  'high':        { label: 'High',        color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',       icon: <CheckCircle2 className="w-3 h-3" /> },
  'medium':      { label: 'Medium',      color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: <AlertCircle className="w-3 h-3" /> },
  'low':         { label: 'Low',         color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', icon: <AlertCircle className="w-3 h-3" /> },
  'none':        { label: 'Null',        color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',    icon: <HelpCircle className="w-3 h-3" /> },
  'hardcoded':   { label: 'Hardcoded',   color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: <Hash className="w-3 h-3" /> },
  'computed':    { label: 'Computed',    color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',       icon: <Zap className="w-3 h-3" /> },
  'always-null': { label: 'Always Null', color: 'text-slate-600 bg-slate-600/10 border-slate-600/20',    icon: <Lock className="w-3 h-3" /> },
};

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

interface RowProps {
  mapping: FieldMapping;
  clientHeaders: string[];
  onChange: (updated: FieldMapping) => void;
}

function MappingRow({ mapping, clientHeaders, onChange }: RowProps) {
  const [editing, setEditing] = useState(false);
  const conf = CONFIDENCE_STYLES[mapping.confidence];

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    let newValue: MappingValueType;
    if (val === '__null__') {
      newValue = { type: 'null' };
    } else if (val === '__literal__') {
      const text = prompt(`Enter hardcoded value for ${mapping.templateField}:`) ?? '';
      newValue = text ? { type: 'literal', value: text } : mapping.value;
    } else {
      newValue = { type: 'column', name: val };
    }
    onChange({ ...mapping, value: newValue, confidence: 'high' });
    setEditing(false);
  }

  const isLocked = mapping.locked;

  return (
    <tr className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors group">
      {/* Template field */}
      <td className="py-2.5 px-4 w-64">
        <span className="text-slate-300 text-xs font-mono">{mapping.templateField}</span>
      </td>

      {/* Confidence badge */}
      <td className="py-2.5 px-3 w-28">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${conf.color}`}>
          {conf.icon}
          {conf.label}
        </span>
      </td>

      {/* Mapped value */}
      <td className="py-2.5 px-3">
        {editing && !isLocked ? (
          <select
            autoFocus
            onChange={handleSelect}
            onBlur={() => setEditing(false)}
            className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs text-white w-full focus:outline-none"
            defaultValue={mapping.value.type === 'column' ? mapping.value.name : '__null__'}
          >
            <option value="__null__">null</option>
            <option value="__literal__">-- Enter hardcoded value --</option>
            {clientHeaders.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        ) : (
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
        )}
      </td>
    </tr>
  );
}

export function MappingTable({ mappings, clientHeaders, onMappingsChange, onContinue }: Props) {
  const nullCount = mappings.filter(m => m.value.type === 'null').length;
  const matchedCount = mappings.filter(m => m.value.type !== 'null').length;
  const lowConfidence = mappings.filter(m => m.confidence === 'low' || m.confidence === 'medium').length;

  function handleChange(index: number, updated: FieldMapping) {
    const next = [...mappings];
    next[index] = updated;
    onMappingsChange(next);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Column Mapping</h2>
            <p className="text-slate-400 text-xs mt-0.5">Review and adjust mappings before generating output.</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Stats */}
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-400">{matchedCount} mapped</span>
              <span className="text-slate-500">{nullCount} null</span>
              {lowConfidence > 0 && <span className="text-yellow-400">{lowConfidence} to review</span>}
            </div>
            <button
              onClick={onContinue}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Generate Output
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-6 py-2 flex flex-wrap gap-3">
          {(Object.entries(CONFIDENCE_STYLES) as [ConfidenceLevel, typeof CONFIDENCE_STYLES[ConfidenceLevel]][]).map(([key, val]) => (
            <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${val.color}`}>
              {val.icon} {val.label}
            </span>
          ))}
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
                <th className="py-2 px-3 font-medium">Mapped To</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => (
                <MappingRow
                  key={m.templateField}
                  mapping={m}
                  clientHeaders={clientHeaders}
                  onChange={updated => handleChange(i, updated)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
