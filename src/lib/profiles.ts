const STORAGE_KEY = 'ps_mappings_profiles_v1';

export interface SavedFieldMapping {
  templateField: string;
  valueType: 'column' | 'literal' | 'null' | 'computed';
  columnName?: string;       // client column name for type=column
  literalValue?: string;     // for type=literal
  computedExpression?: string;
  computedDescription?: string;
}

export interface DistributorProfile {
  id: string;
  name: string;              // e.g. "Cardinal Health"
  aliases: string[];         // e.g. ["cardinal", "cardinalhealth", "cardinal health"]
  fieldMappings: SavedFieldMapping[];
  usageCount: number;
  lastUsed: string;
  createdAt: string;
}

// ── Storage ────────────────────────────────────────────────────────────────

export function loadProfiles(): DistributorProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: DistributorProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {}
}

export function saveProfile(profile: DistributorProfile): void {
  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  saveProfiles(profiles);
}

export function deleteProfile(id: string): void {
  saveProfiles(loadProfiles().filter(p => p.id !== id));
}

// ── Detection ──────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function scoreMatch(candidate: string, profile: DistributorProfile): number {
  const nc = normalize(candidate);
  const np = normalize(profile.name);

  if (nc === np) return 1.0;
  if (nc.includes(np) || np.includes(nc)) return 0.9;

  for (const alias of profile.aliases) {
    const na = normalize(alias);
    if (nc === na) return 0.95;
    if (nc.includes(na) || na.includes(nc)) return 0.85;
  }

  // Word overlap
  const cWords = new Set(nc.split(' ').filter(w => w.length > 2));
  const pWords = new Set(np.split(' ').filter(w => w.length > 2));
  const overlap = [...cWords].filter(w => pWords.has(w)).length;
  if (overlap > 0) return 0.5 + (overlap / Math.max(cWords.size, pWords.size)) * 0.3;

  return 0;
}

export interface ProfileMatch {
  profile: DistributorProfile;
  score: number;
  matchedOn: 'filename' | 'supplier-column' | 'manual';
}

export function detectProfile(
  fileName: string,
  headers: string[],
  rows: Record<string, string>[],
  profiles: DistributorProfile[]
): ProfileMatch | null {
  if (profiles.length === 0) return null;

  let best: ProfileMatch | null = null;

  // 1. Try file name
  for (const profile of profiles) {
    const score = scoreMatch(fileName, profile);
    if (score > 0.5 && (!best || score > best.score)) {
      best = { profile, score, matchedOn: 'filename' };
    }
  }

  // 2. Try supplier/vendor column values in data
  const supplierHeaders = headers.filter(h => {
    const n = normalize(h);
    return ['vendor', 'supplier', 'distributor'].some(k => n.includes(k));
  });

  if (supplierHeaders.length > 0 && rows.length > 0) {
    const sampleValues = supplierHeaders.flatMap(h =>
      rows.slice(0, 5).map(r => r[h]).filter(Boolean)
    );
    for (const val of sampleValues) {
      for (const profile of profiles) {
        const score = scoreMatch(val, profile);
        if (score > 0.7 && (!best || score > best.score)) {
          best = { profile, score, matchedOn: 'supplier-column' };
        }
      }
    }
  }

  return best && best.score >= 0.5 ? best : null;
}

// ── Apply profile to produce FieldMappings ─────────────────────────────────

import type { FieldMapping } from '../types';

export function applyProfile(
  profile: DistributorProfile,
  currentHeaders: string[]
): FieldMapping[] {
  return profile.fieldMappings.map(saved => {
    // For column mappings, verify the column still exists in this file
    if (saved.valueType === 'column' && saved.columnName) {
      const exists = currentHeaders.find(
        h => h.toLowerCase().trim() === saved.columnName!.toLowerCase().trim()
      );
      if (exists) {
        return {
          templateField: saved.templateField,
          value: { type: 'column', name: exists },
          confidence: 'exact' as const,
        };
      }
      // Column not found in this file — fall back to null, let autoMapper handle it
      return {
        templateField: saved.templateField,
        value: { type: 'null' },
        confidence: 'none' as const,
      };
    }

    if (saved.valueType === 'literal' && saved.literalValue !== undefined) {
      return {
        templateField: saved.templateField,
        value: { type: 'literal', value: saved.literalValue },
        confidence: 'hardcoded' as const,
      };
    }

    if (saved.valueType === 'computed' && saved.computedExpression) {
      return {
        templateField: saved.templateField,
        value: {
          type: 'computed',
          expression: saved.computedExpression,
          description: saved.computedDescription ?? 'computed',
        },
        confidence: 'computed' as const,
      };
    }

    return {
      templateField: saved.templateField,
      value: { type: 'null' },
      confidence: 'none' as const,
    };
  });
}

// ── Build profile from a completed mapping session ─────────────────────────

export function buildProfileFromMappings(
  name: string,
  mappings: FieldMapping[]
): DistributorProfile {
  const fieldMappings: SavedFieldMapping[] = mappings.map(m => {
    const base = { templateField: m.templateField };
    switch (m.value.type) {
      case 'column':
        return { ...base, valueType: 'column', columnName: m.value.name };
      case 'literal':
        return { ...base, valueType: 'literal', literalValue: m.value.value };
      case 'computed':
        return {
          ...base,
          valueType: 'computed',
          computedExpression: m.value.expression,
          computedDescription: m.value.description,
        };
      default:
        return { ...base, valueType: 'null' };
    }
  });

  return {
    id: `profile_${Date.now()}`,
    name,
    aliases: [normalize(name)],
    fieldMappings,
    usageCount: 1,
    lastUsed: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}
