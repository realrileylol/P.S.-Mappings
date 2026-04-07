import { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';

interface Props {
  onFileSelected: (file: File) => Promise<void>;
}

export function FileUpload({ onFileSelected }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setLoading(true);
    try {
      await onFileSelected(file);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to parse file.');
      setLoading(false);
    }
  }, [onFileSelected]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-5">
            <FileSpreadsheet className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">P.S. Column Mapper</h1>
          <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
            Drop a client pre-sales file to auto-generate the ADF column mapping for BroadJump.
          </p>
        </div>

        {/* Drop zone */}
        <label
          className={`relative flex flex-col items-center justify-center w-full h-52 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
            ${dragging
              ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
            }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onInputChange} />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Parsing file…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 pointer-events-none">
              <UploadCloud className={`w-10 h-10 transition-colors ${dragging ? 'text-blue-400' : 'text-slate-600'}`} />
              <div className="text-center">
                <p className="text-slate-300 text-sm font-medium">Drop your file here</p>
                <p className="text-slate-600 text-xs mt-1">or click to browse</p>
              </div>
              <div className="flex gap-1.5 mt-1">
                {['csv', 'xlsx', 'xls'].map(ext => (
                  <span key={ext} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-500">.{ext}</span>
                ))}
              </div>
            </div>
          )}
        </label>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <p className="text-center text-slate-700 text-xs mt-6">
          50-field BroadJump template · Learns from your corrections
        </p>
      </div>
    </div>
  );
}
