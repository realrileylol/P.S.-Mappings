import { useState } from 'react';
import { BookMarked, CheckCircle2, ChevronRight, X, Sparkles } from 'lucide-react';
import type { ProfileMatch, DistributorProfile } from '../lib/profiles';

// ── Matched profile banner (shown at top of mapping table) ─────────────────
interface MatchedBannerProps {
  match: ProfileMatch;
  onDismiss: () => void;
  onOverride: () => void; // user wants to re-map from scratch
}

export function MatchedProfileBanner({ match, onDismiss, onOverride }: MatchedBannerProps) {
  const matchLabel = match.matchedOn === 'filename'
    ? 'matched from file name'
    : 'matched from supplier column';

  return (
    <div className="bg-emerald-900/20 border-b border-emerald-700/40 px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <BookMarked className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-300 text-sm font-medium">
                {match.profile.name} profile applied
              </span>
              <span className="text-emerald-600 text-xs">({matchLabel})</span>
            </div>
            <p className="text-emerald-600 text-xs mt-0.5">
              {match.profile.fieldMappings.filter(f => f.valueType !== 'null').length} fields auto-mapped
              · used {match.profile.usageCount} time{match.profile.usageCount !== 1 ? 's' : ''} before
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onOverride}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            Re-map from scratch
          </button>
          <button onClick={onDismiss} className="text-slate-600 hover:text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Save profile prompt (shown in output panel) ─────────────────────────────
interface SaveProfilePromptProps {
  detectedName: string;
  existingProfile?: DistributorProfile;
  onSave: (name: string) => void;
  onDismiss: () => void;
}

export function SaveProfilePrompt({ detectedName, existingProfile, onSave, onDismiss }: SaveProfilePromptProps) {
  const [name, setName] = useState(detectedName);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim());
    setSaved(true);
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>
          <strong>{name}</strong> profile saved — next file from this distributor maps instantly.
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-violet-300 text-sm font-medium mb-1">
            {existingProfile ? `Update ${existingProfile.name} profile?` : 'Save as distributor profile?'}
          </p>
          <p className="text-violet-500 text-xs mb-3">
            Next time a file from this distributor comes in, all {'{'}50{'}'} fields map instantly.
          </p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Distributor name..."
              className="flex-1 bg-slate-900 border border-violet-500/40 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-400 transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              Save
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={onDismiss}
              className="text-slate-500 hover:text-slate-300 text-sm px-2 py-1.5 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
