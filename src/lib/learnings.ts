// Persisted synonym learnings: clientHeader → templateField
// Stored in localStorage so they survive sessions

const STORAGE_KEY = 'ps_mappings_learnings_v1';

export interface LearnedSynonym {
  clientHeader: string;       // e.g. "Distributor Name"
  templateField: string;      // e.g. "SupplierName"
  timesConfirmed: number;
  lastSeen: string;           // ISO date
}

export interface SessionEdit {
  templateField: string;
  originalHeader: string | null;  // what the auto-mapper suggested
  correctedHeader: string | null; // what the user changed it to
}

export function loadLearnings(): LearnedSynonym[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLearnings(learnings: LearnedSynonym[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(learnings));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function applySessionEdits(
  edits: SessionEdit[],
  existing: LearnedSynonym[]
): { updated: LearnedSynonym[]; newThisSession: LearnedSynonym[] } {
  const updated = [...existing];
  const newThisSession: LearnedSynonym[] = [];

  for (const edit of edits) {
    // Only learn when user actively mapped to a real column (not null, not no-change)
    if (!edit.correctedHeader) continue;
    if (edit.correctedHeader === edit.originalHeader) continue;

    const key = edit.correctedHeader.toLowerCase().trim();
    const existing_idx = updated.findIndex(
      l => l.clientHeader.toLowerCase().trim() === key && l.templateField === edit.templateField
    );

    if (existing_idx >= 0) {
      updated[existing_idx] = {
        ...updated[existing_idx],
        timesConfirmed: updated[existing_idx].timesConfirmed + 1,
        lastSeen: new Date().toISOString(),
      };
    } else {
      const newLearning: LearnedSynonym = {
        clientHeader: edit.correctedHeader,
        templateField: edit.templateField,
        timesConfirmed: 1,
        lastSeen: new Date().toISOString(),
      };
      updated.push(newLearning);
      newThisSession.push(newLearning);
    }
  }

  return { updated, newThisSession };
}

export function getLearningsForField(
  templateField: string,
  learnings: LearnedSynonym[]
): string[] {
  return learnings
    .filter(l => l.templateField === templateField)
    .sort((a, b) => b.timesConfirmed - a.timesConfirmed)
    .map(l => l.clientHeader);
}
