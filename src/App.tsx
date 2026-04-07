import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { DataPreview } from './components/DataPreview';
import { PromptDialog } from './components/PromptDialog';
import { MappingTable } from './components/MappingTable';
import { LearningReview } from './components/LearningReview';
import { OutputPanel } from './components/OutputPanel';
import { UpdateOverlay } from './components/UpdateOverlay';
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

export default function App() {
  const [updating, setUpdating]             = useState(false);
  const [step, setStep]                     = useState<AppStep>('upload');
  const [rawFile, setRawFile]               = useState<RawFileData | null>(null);
  const [rawHeaderRow, setRawHeaderRow]     = useState(0);
  const [parsedFile, setParsedFile]         = useState<ParsedFile | null>(null);
  const [promptNeeds, setPromptNeeds]       = useState<PromptNeeds | null>(null);
  const [mappings, setMappings]             = useState<FieldMapping[]>([]);
  const [sessionEdits, setSessionEdits]     = useState<SessionEdit[]>([]);
  const [existingLearnings, setExistingLearnings] = useState<LearnedSynonym[]>([]);
  const [profileMatch, setProfileMatch]     = useState<ProfileMatch | null>(null);
  const [detectedDistributorName, setDetectedDistributorName] = useState('');

  // Step 1: file upload → parse raw → show preview
  async function handleFileSelected(file: File) {
    const raw = await parseFileRaw(file);
    const guessedHeaderRow = detectHeaderRow(raw.rows);
    setRawFile(raw);
    setRawHeaderRow(guessedHeaderRow);
    setStep('preview');
  }

  // Step 2: preview confirmed → build ParsedFile → continue to mapping flow
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
    } else {
      saveProfile(profile);
    }
  }

  function handleReset() {
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

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {updating && <UpdateOverlay onCancel={() => setUpdating(false)} />}
      <button
        onClick={() => setUpdating(true)}
        title="Check for updates"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 backdrop-blur transition-colors"
      >
        ↻ Update
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
