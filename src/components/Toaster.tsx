import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { _registerToastListener } from '../lib/toast';

type ToastType = 'success' | 'info' | 'warning';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
  leaving: boolean;
}

let _nextId = 0;

const STYLES: Record<ToastType, { icon: React.ReactNode }> = {
  success: { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> },
  info:    { icon: <Info          className="w-3.5 h-3.5 text-blue-400 flex-shrink-0"    /> },
  warning: { icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0"  /> },
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
  }, []);

  const addToast = useCallback((msg: string, type: ToastType) => {
    const id = ++_nextId;
    setToasts(prev => [...prev.slice(-2), { id, msg, type, leaving: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    }, 2800);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3150);
  }, []);

  useEffect(() => {
    _registerToastListener(addToast);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2.5 shadow-2xl text-xs text-slate-200 max-w-xs transition-all duration-300 ${
            t.leaving ? 'opacity-0 translate-x-3' : 'opacity-100 translate-x-0'
          }`}
        >
          {STYLES[t.type].icon}
          <span className="flex-1 leading-snug">{t.msg}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-600 hover:text-slate-400 transition-colors ml-1 flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
