import { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { parseFile } from '../lib/fileParser';
import type { ParsedFile } from '../types';

interface Props {
  onFileParsed: (file: ParsedFile) => void;
}

export function FileUpload({ onFileParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleFile = useCallback(async (file: File) => {
    setError('');
    setLoading(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.headers.length === 0) throw new Error('No column headers detected in file.');
      onFileParsed(parsed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  }, [onFileParsed]);

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
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-5">
            <FileSpreadsheet className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">P.S. Column Mapper</h1>
          <p className="text-slate-400 text-base">Upload a client pre-sales file to auto-generate the ADF column mapping.</p>
        </div>

        {/* Drop zone */}
        <label
          className={`relative flex flex-col items-center justify-center w-full h-64 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
            ${dragging
              ? 'border-blue-400 bg-blue-500/10'
              : 'border-slate-600 bg-slate-800/40 hover:border-blue-500/60 hover:bg-slate-800/60'
            }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={onInputChange}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Parsing file...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 pointer-events-none">
              <UploadCloud className={`w-12 h-12 ${dragging ? 'text-blue-400' : 'text-slate-500'}`} />
              <div className="text-center">
                <p className="text-slate-300 font-medium">Drop your file here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse</p>
              </div>
              <div className="flex gap-2 mt-1">
                {['CSV', 'XLSX', 'XLS'].map(ext => (
                  <span key={ext} className="px-2 py-0.5 rounded text-xs font-mono bg-slate-700 text-slate-400">.{ext.toLowerCase()}</span>
                ))}
              </div>
            </div>
          )}
        </label>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
