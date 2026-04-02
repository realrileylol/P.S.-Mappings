import { useState } from 'react';
import { Brain, Check, X, ChevronRight, Sparkles } from 'lucide-react';
import type { SessionEdit, LearnedSynonym } from '../lib/learnings';
import { NewFileButton } from './NewFileButton';

interface Props {
  edits: SessionEdit[];
  existingLearnings: LearnedSynonym[];
  onConfirm: (approved: SessionEdit[]) => void;
  onSkip: () => void;
  onNewFile: () => void;
}

export function LearningReview({ edits, existingLearnings, onConfirm, onSkip, onNewFile }: Props) {
  // Only show edits where user actually changed to a real column
  const learnableEdits = edits.filter(e =>
    e.correctedHeader &&
    e.correctedHeader !== e.originalHeader
  );

  // Check if already known
  function isAlreadyKnown(edit: SessionEdit): boolean {
    return existingLearnings.some(
      l =>
        l.clientHeader.toLowerCase().trim() === (edit.correctedHeader ?? '').toLowerCase().trim() &&
        l.templateField === edit.templateField
    );
  }

  const newEdits = learnableEdits.filter(e => !isAlreadyKnown(e));
  const reinforcedEdits = learnableEdits.filter(e => isAlreadyKnown(e));

  const [approved, setApproved] = useState<Set<string>>(
    new Set(newEdits.map(e => e.templateField))
  );

  if (learnableEdits.length === 0) {
    // Nothing to learn — go straight to output
    onSkip();
    return null;
  }

  function toggle(field: string) {
    setApproved(prev => {
      const next = new Set(prev);
      next.has(field) ? next.delete(field) : next.add(field);
      return next;
    });
  }

  function handleConfirm() {
    const approvedEdits = learnableEdits.filter(e => approved.has(e.templateField));
    onConfirm(approvedEdits);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <NewFileButton onNewFile={onNewFile} />
        </div>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-4">
            <Brain className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Review What I Learned</h2>
          <p className="text-slate-400 text-sm">
            You corrected {learnableEdits.length} mapping{learnableEdits.length !== 1 ? 's' : ''} this session.<br />
            Approve the ones you want remembered for future files.
          </p>
        </div>

        {/* New learnings */}
        {newEdits.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">New synonyms to learn</span>
            </div>
            <div className="space-y-2">
              {newEdits.map(edit => (
                <div
                  key={edit.templateField}
                  onClick={() => toggle(edit.templateField)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-150
                    ${approved.has(edit.templateField)
                      ? 'bg-violet-500/10 border-violet-500/40'
                      : 'bg-slate-800/40 border-slate-700 opacity-50'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors
                      ${approved.has(edit.templateField) ? 'bg-violet-500' : 'bg-slate-700'}`}>
                      {approved.has(edit.templateField) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-emerald-300 font-mono text-xs">[{edit.correctedHeader}]</span>
                        <span className="text-slate-500 text-xs">→</span>
                        <span className="text-slate-300 font-mono text-xs">{edit.templateField}</span>
                      </div>
                      {edit.originalHeader && edit.originalHeader !== edit.correctedHeader && (
                        <div className="text-slate-600 text-xs mt-0.5">
                          was: <span className="line-through">[{edit.originalHeader}]</span>
                        </div>
                      )}
                      {!edit.originalHeader && (
                        <div className="text-slate-600 text-xs mt-0.5">was: null</div>
                      )}
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded transition-colors flex-shrink-0
                    ${approved.has(edit.templateField) ? 'text-violet-400' : 'text-slate-600'}`}>
                    {approved.has(edit.templateField) ? 'Remember' : 'Skip'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reinforced learnings (already known, just showing confirmation) */}
        {reinforcedEdits.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">Already known — reinforced</span>
            </div>
            <div className="space-y-2">
              {reinforcedEdits.map(edit => (
                <div key={edit.templateField} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="text-emerald-300 font-mono text-xs">[{edit.correctedHeader}]</span>
                    <span className="text-slate-500 text-xs mx-2">→</span>
                    <span className="text-slate-300 font-mono text-xs">{edit.templateField}</span>
                    <span className="text-slate-600 text-xs ml-2">(confidence increased)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onSkip}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
            Skip learning
          </button>
          <button
            onClick={handleConfirm}
            disabled={approved.size === 0 && reinforcedEdits.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Brain className="w-4 h-4" />
            Save {approved.size} learning{approved.size !== 1 ? 's' : ''} & Generate Output
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
