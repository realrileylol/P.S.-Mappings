import { useEffect, useState } from 'react';
import { loadProfiles } from '../lib/profiles';
import { loadLearnings } from '../lib/learnings';

interface Step {
  message: string;
  targetPct: number;
}

function buildSteps(): Step[] {
  const profiles = loadProfiles();
  const learnings = loadLearnings();
  const profileCount = profiles.length;
  const learningCount = learnings.length;

  return [
    { message: 'Connecting…',                                                                       targetPct: 12 },
    { message: `Loading distributor profiles… (${profileCount} saved)`,                             targetPct: 30 },
    { message: `Loading learnings… (${learningCount} synonym${learningCount !== 1 ? 's' : ''})`,    targetPct: 50 },
    { message: 'Refreshing 50-field template…',                                                      targetPct: 68 },
    { message: 'Clearing cached assets…',                                                            targetPct: 84 },
    { message: 'Applying latest update…',                                                            targetPct: 97 },
    { message: 'Done! Reloading…',                                                                   targetPct: 100 },
  ];
}

interface Props {
  onCancel: () => void;
}

export function UpdateOverlay({ onCancel }: Props) {
  const [pct, setPct] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const steps = buildSteps();

  useEffect(() => {
    let raf: number;
    let current = 0;

    const stepDurations = [600, 700, 800, 700, 700, 600, 400];

    function animateToTarget(target: number, duration: number, onDone: () => void) {
      const start = performance.now();
      const from = current;

      function tick(now: number) {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        current = from + (target - from) * ease;
        setPct(Math.round(current));
        if (t < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          current = target;
          setPct(target);
          onDone();
        }
      }
      raf = requestAnimationFrame(tick);
    }

    function runStep(idx: number) {
      if (idx >= steps.length) return;
      setStepIdx(idx);
      animateToTarget(steps[idx].targetPct, stepDurations[idx] ?? 600, () => {
        if (idx < steps.length - 1) {
          setTimeout(() => runStep(idx + 1), 120);
        } else {
          setTimeout(() => window.location.reload(), 350);
        }
      });
    }

    runStep(0);
    return () => cancelAnimationFrame(raf);
  }, []);

  const currentMessage = steps[stepIdx]?.message ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-6">
        <div className="mb-6 text-center">
          <p className="text-white text-base font-semibold">Updating P.S. Column Mapper</p>
          <p className="text-slate-500 text-xs mt-1">Fetching latest version from GitHub Pages</p>
        </div>

        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-blue-500 rounded-full transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between mb-1">
          <p className="text-slate-400 text-xs">{currentMessage}</p>
          <span className="text-slate-500 text-xs font-mono">{pct}%</span>
        </div>

        {pct < 97 && (
          <div className="mt-5 text-center">
            <button
              onClick={onCancel}
              className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Version check hook ─────────────────────────────────────────────────────

export type VersionStatus = 'checking' | 'up-to-date' | 'update-available' | 'unknown';

export function useVersionCheck(): VersionStatus {
  const [status, setStatus] = useState<VersionStatus>('checking');

  useEffect(() => {
    const current = __BUILD_TIME__;

    fetch(`/P.S.-Mappings/version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: { buildTime: string }) => {
        if (data.buildTime === current) {
          setStatus('up-to-date');
        } else {
          setStatus('update-available');
        }
      })
      .catch(() => setStatus('unknown'));
  }, []);

  return status;
}
