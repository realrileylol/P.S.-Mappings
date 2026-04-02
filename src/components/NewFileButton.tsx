import { UploadCloud } from 'lucide-react';

interface Props {
  onNewFile: () => void;
}

export function NewFileButton({ onNewFile }: Props) {
  return (
    <button
      onClick={onNewFile}
      className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all"
    >
      <UploadCloud className="w-3.5 h-3.5" />
      New file
    </button>
  );
}
