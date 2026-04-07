import { useEffect, useRef, useState } from 'react';
import { loadProfiles } from '../lib/profiles';
import { loadLearnings } from '../lib/learnings';

interface Props {
  onCancel: () => void;
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

export function UpdateOverlay({ onCancel }: Props) {
  const [completedLines, setCompletedLines] = useState<{ text: string; ok: boolean }[]>([]);
  const [typingLine, setTypingLine]         = useState('');
  const [pct, setPct]                       = useState(0);
  const [cancelled, setCancelled]           = useState(false);
  const cancelRef = useRef(false);
  const logRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cancelRef.current = false;

    async function type(text: string) {
      for (let i = 0; i <= text.length; i++) {
        if (cancelRef.current) return false;
        setTypingLine(text.slice(0, i));
        await sleep(16 + Math.random() * 18);
      }
      await sleep(160);
      return true;
    }

    async function addLine(text: string, ok = true) {
      const ok_ = await type(text);
      if (!ok_) return;
      setCompletedLines(prev => [...prev, { text, ok }]);
      setTypingLine('');
      // auto-scroll
      setTimeout(() => logRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 30);
    }

    async function run() {
      const profiles  = loadProfiles();
      const learnings = loadLearnings();

      // --- build message list ---
      const msgs: { text: string; pct: number; ok?: boolean }[] = [
        { text: 'Connecting to update server…',                                            pct: 10 },
        { text: `Loading profiles — ${profiles.length} distributor${profiles.length !== 1 ? 's' : ''} saved`, pct: 22 },
        { text: `Loading learnings — ${learnings.length} synonym${learnings.length !== 1 ? 's' : ''}`,        pct: 34 },
        { text: 'Refreshing 50-field BroadJump template…',                                 pct: 48 },
      ];

      // version check
      let isNew = false;
      try {
        const res  = await fetch(`/P.S.-Mappings/version.json?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json() as { buildTime: string };
        isNew = data.buildTime !== __BUILD_TIME__;
      } catch { /* network offline — proceed anyway */ }

      if (isNew) {
        msgs.push({ text: 'New version detected — applying changes…', pct: 62 });
        msgs.push({ text: 'Patching client-side assets…',              pct: 75 });
        msgs.push({ text: 'Clearing browser cache…',                   pct: 87 });
        msgs.push({ text: 'Verifying integrity…',                      pct: 94 });
        msgs.push({ text: 'Done! Reloading into latest version…',      pct: 100 });
      } else {
        msgs.push({ text: 'No new version found — already up to date', pct: 70, ok: false });
        msgs.push({ text: 'Refreshing local cache anyway…',            pct: 84 });
        msgs.push({ text: 'All good — reloading…',                     pct: 100 });
      }

      // --- run messages ---
      for (const msg of msgs) {
        if (cancelRef.current) return;
        await addLine(msg.text, msg.ok !== false);
        setPct(msg.pct);
        await sleep(msg.pct === 100 ? 100 : 80);
      }

      await sleep(420);
      window.location.reload();
    }

    run();

    return () => { cancelRef.current = true; };
  }, []);

  function handleCancel() {
    cancelRef.current = true;
    setCancelled(true);
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 backdrop-blur-sm">
      <div className="w-full max-w-md mx-6">

        {/* Header */}
        <div className="mb-4">
          <p className="text-white text-sm font-semibold tracking-tight">Updating P.S. Column Mapper</p>
          <p className="text-slate-500 text-xs mt-0.5">Fetching latest version from GitHub Pages</p>
        </div>

        {/* Terminal log */}
        <div
          ref={logRef}
          className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs mb-4 h-48 overflow-y-auto space-y-1 scroll-smooth"
        >
          {completedLines.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={line.ok ? 'text-emerald-500' : 'text-slate-600'}>
                {line.ok ? '✓' : '—'}
              </span>
              <span className={line.ok ? 'text-slate-300' : 'text-slate-600'}>{line.text}</span>
            </div>
          ))}
          {typingLine !== '' && (
            <div className="flex items-start gap-2">
              <span className="text-blue-400">›</span>
              <span className="text-slate-200">
                {typingLine}
                <span className="inline-block w-1.5 h-3 bg-blue-400 ml-0.5 align-middle animate-pulse" />
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600 text-[10px] font-mono">{pct}%</span>
          {!cancelled && pct < 94 && (
            <button onClick={handleCancel} className="text-slate-700 hover:text-slate-500 text-[10px] transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
