import { useState, useEffect } from 'react';
import { X, Pencil, Trash2, BookOpen, Download } from 'lucide-react';
import { loadProfiles, saveProfiles, deleteProfile } from '../lib/profiles';
import type { DistributorProfile } from '../lib/profiles';

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-blue-600', 'bg-violet-600',
  'bg-amber-600',   'bg-rose-600', 'bg-cyan-600',
];

function avatarColor(id: string) {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

interface Props {
  onClose: () => void;
  onLoad?: (profile: DistributorProfile) => void; // undefined = no file loaded yet
}

export function ProfileManager({ onClose, onLoad }: Props) {
  const [profiles, setProfiles] = useState<DistributorProfile[]>([]);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editName, setEditName]         = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function reload() {
    setProfiles(
      loadProfiles().sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
    );
  }

  useEffect(() => { reload(); }, []);

  function startEdit(p: DistributorProfile) {
    setEditingId(p.id);
    setEditName(p.name);
    setConfirmDeleteId(null);
  }

  function commitEdit(id: string) {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    const all = loadProfiles();
    const p = all.find(x => x.id === id);
    if (p) { p.name = name; saveProfiles(all); reload(); }
    setEditingId(null);
  }

  function handleDelete(id: string) {
    deleteProfile(id);
    reload();
    setConfirmDeleteId(null);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 px-4">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-white">Saved Profiles</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {profiles.length} distributor{profiles.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[60vh]">
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                  <BookOpen className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-slate-400 text-sm">No profiles saved yet</p>
                <p className="text-slate-600 text-xs mt-1">
                  Profiles are created when you save a completed mapping
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {profiles.map(p => {
                  const mappedCount = p.fieldMappings.filter(fm => fm.valueType !== 'null').length;
                  const isEditing    = editingId === p.id;
                  const isConfirming = confirmDeleteId === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3.5 px-5 py-3.5 group transition-colors ${
                        isConfirming ? 'bg-red-950/20' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${avatarColor(p.id)}`}>
                        {initials(p.name)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit(p.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onBlur={() => commitEdit(p.id)}
                            className="w-full bg-slate-800 border border-slate-600 focus:border-blue-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none transition-colors"
                          />
                        ) : isConfirming ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-red-400">Delete &ldquo;{p.name}&rdquo;?</span>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="text-[11px] px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-slate-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-white truncate">{p.name}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {mappedCount} fields mapped · Used {p.usageCount}× · {timeAgo(p.lastUsed)}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Actions — only visible on hover when not in edit/confirm mode */}
                      {!isEditing && !isConfirming && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {onLoad && (
                            <button
                              onClick={() => { onLoad(p); onClose(); }}
                              title="Apply to current file"
                              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-blue-400 hover:text-white hover:bg-blue-600 border border-blue-700/50 hover:border-blue-600 transition-colors mr-1"
                            >
                              <Download className="w-3 h-3" />
                              Load
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(p)}
                            title="Rename"
                            className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            title="Delete"
                            className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
