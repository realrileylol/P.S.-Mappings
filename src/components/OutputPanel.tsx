import { useState } from 'react';
import { Copy, Check, RotateCcw, Download } from 'lucide-react';
import type { FieldMapping } from '../types';
import { generateOutput, generateADFFormat } from '../lib/outputGenerator';

interface Props {
  mappings: FieldMapping[];
  fileName: string;
  onReset: () => void;
  onBack: () => void;
}

type OutputMode = 'select' | 'adf';

export function OutputPanel({ mappings, fileName, onReset, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<OutputMode>('select');

  const selectOutput = generateOutput(mappings);
  const adfOutput = generateADFFormat(mappings);
  const displayOutput = mode === 'select' ? selectOutput : adfOutput;

  function copyToClipboard() {
    navigator.clipboard.writeText(displayOutput).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadTxt() {
    const blob = new Blob([displayOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapping_${fileName.replace(/\.[^/.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const nullCount = mappings.filter(m => m.value.type === 'null').length;
  const matchedCount = mappings.filter(m => m.value.type !== 'null').length;
  const computedCount = mappings.filter(m => m.value.type === 'computed').length;
  const hardcodedCount = mappings.filter(m => m.confidence === 'hardcoded').length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Generated Mapping</h2>
            <p className="text-slate-400 text-xs mt-0.5">{fileName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-slate-200 text-sm px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={downloadTxt}
              className="flex items-center gap-2 text-slate-300 hover:text-white text-sm px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-6 flex-1">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Mapped', value: matchedCount, color: 'text-emerald-400' },
            { label: 'Null', value: nullCount, color: 'text-slate-500' },
            { label: 'Computed', value: computedCount, color: 'text-cyan-400' },
            { label: 'Hardcoded', value: hardcodedCount, color: 'text-purple-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-slate-500 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Mode switcher */}
        <div className="flex gap-1 mb-4 bg-slate-800/50 border border-slate-700 rounded-lg p-1 w-fit">
          <button
            onClick={() => setMode('select')}
            className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'select' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            SELECT Format
          </button>
          <button
            onClick={() => setMode('adf')}
            className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'adf' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            ADF Raw Format
          </button>
        </div>

        {/* Output */}
        <div className="relative">
          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-xs font-mono text-slate-300 overflow-auto max-h-[60vh] leading-relaxed whitespace-pre-wrap">
            {displayOutput}
          </pre>
        </div>

        {/* Reset */}
        <div className="mt-6 text-center">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Start over with a new file
          </button>
        </div>
      </div>
    </div>
  );
}
