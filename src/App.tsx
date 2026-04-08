import { useEffect, useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { DataPreview } from './components/DataPreview';
import { PromptDialog } from './components/PromptDialog';
import { MappingTable } from './components/MappingTable';
import { LearningReview } from './components/LearningReview';
import { OutputPanel } from './components/OutputPanel';
import { ProfileManager } from './components/ProfileManager';
import { Toaster } from './components/Toaster';
import { toast } from './lib/toast';
import type { ParsedFile, RawFileData, FieldMapping, UserPrompts, AppStep, PromptNeeds } from './types';
import { parseFileRaw, detectHeaderRow } from './lib/fileParser';
import { detectPromptNeeds, buildMappings } from './lib/autoMapper';
import { loadLearnings, saveLearnings, applySessionEdits } from './lib/learnings';
import type { SessionEdit, LearnedSynonym } from './lib/learnings';
import {
  loadProfiles, saveProfile, detectProfile,
  applyProfile, buildProfileFromMappings,
} from './lib/profiles';
import type { ProfileMatch, DistributorProfile } from './lib/profiles';

// ── Session persistence helpers ────────────────────────────────────────────

const SS = {
  get<T>(key: string): T | null {
    try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  set(key: string, val: unknown) {
    try { sessionStorage.setItem(key, JSON.stringify(val)); } catch { /* quota exceeded – skip */ }
  },
  clear(...keys: string[]) {
    keys.forEach(k => { try { sessionStorage.removeItem(k); } catch {} });
  },
};

const KEYS = {
  step:        'ps_s_step',
  file:        'ps_s_file',
  mappings:    'ps_s_mappings',
  needs:       'ps_s_needs',
  profile:     'ps_s_profile',
  distributor: 'ps_s_distributor',
  edits:       'ps_s_edits',
};

function clearSession() {
  SS.clear(...Object.values(KEYS));
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [showProfiles, setShowProfiles] = useState(false);

  // Restore from sessionStorage on first render; fall back to defaults.
  // 'preview' can't be restored (rawFile is not persisted), so treat as 'upload'.
  const [step, setStep] = useState<AppStep>(() => {
    const s = SS.get<AppStep>(KEYS.step);
    return s && s !== 'preview' ? s : 'upload';
  });
  const [rawFile, setRawFile]           = useState<RawFileData | null>(null);
  const [rawHeaderRow, setRawHeaderRow] = useState(0);
  const [parsedFile, setParsedFile]     = useState<ParsedFile | null>(() => SS.get(KEYS.file));
  const [promptNeeds, setPromptNeeds]   = useState<PromptNeeds | null>(() => SS.get(KEYS.needs));
  const [mappings, setMappings]         = useState<FieldMapping[]>(() => SS.get(KEYS.mappings) ?? []);
  const [sessionEdits, setSessionEdits] = useState<SessionEdit[]>(() => SS.get(KEYS.edits) ?? []);
  const [existingLearnings, setExistingLearnings] = useState<LearnedSynonym[]>([]);
  const [profileMatch, setProfileMatch] = useState<ProfileMatch | null>(() => SS.get(KEYS.profile));
  const [detectedDistributorName, setDetectedDistributorName] = useState<string>(
    () => SS.get<string>(KEYS.distributor) ?? ''
  );

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    if (step === 'upload' || step === 'preview') { clearSession(); return; }
    SS.set(KEYS.step, step);
    if (parsedFile)   SS.set(KEYS.file, parsedFile);
    if (mappings.length) SS.set(KEYS.mappings, mappings);
    if (promptNeeds)  SS.set(KEYS.needs, promptNeeds);
    if (profileMatch) SS.set(KEYS.profile, profileMatch);
    SS.set(KEYS.distributor, detectedDistributorName);
    if (sessionEdits.length) SS.set(KEYS.edits, sessionEdits);
  }, [step, parsedFile, mappings, promptNeeds, profileMatch, detectedDistributorName, sessionEdits]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleFileSelected(file: File) {
    const raw = await parseFileRaw(file);
    const guessedHeaderRow = detectHeaderRow(raw.rows);
    setRawFile(raw);
    setRawHeaderRow(guessedHeaderRow);
    setStep('preview');
  }

  function handlePreviewConfirmed(file: ParsedFile) {
    setParsedFile(file);

    const profiles = loadProfiles();
    const match = detectProfile(file.fileName, file.headers, file.rows, profiles);
    setProfileMatch(match);

    const supplierHeader = file.headers.find(h => /vendor|supplier|distributor/i.test(h));
    const supplierFromData = supplierHeader && file.rows.length > 0
      ? String(file.rows[0][supplierHeader] ?? '') : '';
    setDetectedDistributorName(
      match?.profile.name ?? supplierFromData ?? file.fileName.replace(/\.[^/.]+$/, '')
    );

    const needs = detectPromptNeeds(file.headers, file.rows);
    setPromptNeeds(needs);

    if (match) {
      const profileMappings = applyProfile(match.profile, file.headers);
      const autoMappings    = buildMappings(file.headers, {}, needs, file.rows);
      const profileByField  = new Map(profileMappings.map(pm => [pm.templateField, pm]));
      const merged = autoMappings.map(am => {
        const pm = profileByField.get(am.templateField);
        return pm && pm.value.type !== 'null' ? pm : am;
      });
      setMappings(merged);
      setStep('mapping');
      toast(`Profile loaded — ${match.profile.name}`, 'info');
      return;
    }

    const anyNeeded = needs.needsFacilityId || needs.needsFacilityName || needs.needsDate || needs.needsSupplierName;
    if (!anyNeeded) {
      setMappings(buildMappings(file.headers, {}, needs, file.rows));
      setStep('mapping');
    } else {
      setStep('prompts');
    }
  }

  function handlePromptsComplete(prompts: UserPrompts) {
    if (!parsedFile || !promptNeeds) return;
    setMappings(buildMappings(parsedFile.headers, prompts, promptNeeds, parsedFile.rows));
    setStep('mapping');
  }

  function handleProfileOverride() {
    if (!parsedFile || !promptNeeds) return;
    setProfileMatch(null);
    const anyNeeded = promptNeeds.needsFacilityId || promptNeeds.needsFacilityName || promptNeeds.needsDate || promptNeeds.needsSupplierName;
    if (anyNeeded) {
      setStep('prompts');
    } else {
      setMappings(buildMappings(parsedFile.headers, {}, promptNeeds));
    }
  }

  function handleLoadProfile(profile: DistributorProfile) {
    if (!parsedFile || !promptNeeds) return;
    const profileMappings = applyProfile(profile, parsedFile.headers);
    const autoMappings    = buildMappings(parsedFile.headers, {}, promptNeeds, parsedFile.rows);
    const profileByField  = new Map(profileMappings.map(pm => [pm.templateField, pm]));
    const merged = autoMappings.map(am => {
      const pm = profileByField.get(am.templateField);
      return pm && pm.value.type !== 'null' ? pm : am;
    });
    setMappings(merged);
    setProfileMatch({ profile, score: 1.0, matchedOn: 'manual' });
    setStep('mapping');
    toast(`Profile loaded — ${profile.name}`, 'info');
  }

  function handleMappingContinue(edits: SessionEdit[]) {
    setSessionEdits(edits);
    const learnable = edits.filter(e => e.correctedHeader && e.correctedHeader !== e.originalHeader);
    if (learnable.length === 0) { setStep('output'); return; }
    setExistingLearnings(loadLearnings());
    setStep('learning');
  }

  function handleLearningConfirm(approved: SessionEdit[]) {
    const { updated } = applySessionEdits(approved, loadLearnings());
    saveLearnings(updated);
    setStep('output');
    if (approved.length > 0) {
      toast(`${approved.length} synonym${approved.length !== 1 ? 's' : ''} saved`);
    }
  }

  function handleSaveProfile(name: string) {
    const profile = buildProfileFromMappings(name, mappings);
    if (profileMatch) {
      const existing = profileMatch.profile;
      saveProfile({
        ...profile,
        id: existing.id,
        aliases: [...new Set([...existing.aliases, profile.aliases[0]])],
        usageCount: existing.usageCount + 1,
        createdAt: existing.createdAt,
      } as DistributorProfile);
      toast(`Profile updated — ${name}`);
    } else {
      saveProfile(profile);
      toast(`Profile saved — ${name}`);
    }
  }

  function handleReset() {
    clearSession();
    setRawFile(null);
    setParsedFile(null);
    setPromptNeeds(null);
    setMappings([]);
    setSessionEdits([]);
    setExistingLearnings([]);
    setProfileMatch(null);
    setDetectedDistributorName('');
    setStep('upload');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Toaster />
      {showProfiles && (
        <ProfileManager
          onClose={() => setShowProfiles(false)}
          onLoad={parsedFile && promptNeeds ? handleLoadProfile : undefined}
        />
      )}
      <button
        onClick={() => setShowProfiles(true)}
        title="Manage profiles"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 backdrop-blur transition-colors"
      >
        Profiles
      </button>

      {step === 'upload' && (
        <FileUpload onFileSelected={handleFileSelected} />
      )}

      {step === 'preview' && rawFile && (
        <DataPreview
          raw={rawFile}
          initialHeaderRow={rawHeaderRow}
          onConfirm={handlePreviewConfirmed}
          onNewFile={handleReset}
        />
      )}

      {step === 'prompts' && promptNeeds && (
        <PromptDialog needs={promptNeeds} onComplete={handlePromptsComplete} onNewFile={handleReset} />
      )}

      {step === 'mapping' && parsedFile && (
        <MappingTable
          mappings={mappings}
          clientHeaders={parsedFile.headers}
          sampleData={parsedFile.rows}
          profileMatch={profileMatch}
          onMappingsChange={setMappings}
          onContinue={handleMappingContinue}
          onProfileOverride={handleProfileOverride}
          onNewFile={handleReset}
        />
      )}

      {step === 'learning' && (
        <LearningReview
          edits={sessionEdits}
          existingLearnings={existingLearnings}
          onConfirm={handleLearningConfirm}
          onSkip={() => setStep('output')}
          onNewFile={handleReset}
        />
      )}

      {step === 'output' && parsedFile && (
        <OutputPanel
          mappings={mappings}
          fileName={parsedFile.fileName}
          detectedDistributorName={detectedDistributorName}
          existingProfile={profileMatch?.profile}
          onSaveProfile={handleSaveProfile}
          onReset={handleReset}
          onBack={() => setStep('mapping')}
          onNewFile={handleReset}
        />
      )}
    </div>
  );
}
