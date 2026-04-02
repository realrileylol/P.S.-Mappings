import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { PromptDialog } from './components/PromptDialog';
import { MappingTable } from './components/MappingTable';
import { LearningReview } from './components/LearningReview';
import { OutputPanel } from './components/OutputPanel';
import type { ParsedFile, FieldMapping, UserPrompts, AppStep, PromptNeeds } from './types';
import { detectPromptNeeds, buildMappings } from './lib/autoMapper';
import { loadLearnings, saveLearnings, applySessionEdits } from './lib/learnings';
import type { SessionEdit, LearnedSynonym } from './lib/learnings';
import {
  loadProfiles, saveProfile, detectProfile,
  applyProfile, buildProfileFromMappings,
} from './lib/profiles';
import type { ProfileMatch, DistributorProfile } from './lib/profiles';

export default function App() {
  const [step, setStep] = useState<AppStep>('upload');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [promptNeeds, setPromptNeeds] = useState<PromptNeeds | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [sessionEdits, setSessionEdits] = useState<SessionEdit[]>([]);
  const [existingLearnings, setExistingLearnings] = useState<LearnedSynonym[]>([]);
  const [profileMatch, setProfileMatch] = useState<ProfileMatch | null>(null);
  const [detectedDistributorName, setDetectedDistributorName] = useState('');

  function handleFileParsed(file: ParsedFile) {
    setParsedFile(file);

    // Try to match a known distributor profile
    const profiles = loadProfiles();
    const match = detectProfile(file.fileName, file.headers, file.rows, profiles);
    setProfileMatch(match);

    // Detect what distributor name to suggest when saving
    const supplierHeader = file.headers.find(h =>
      /vendor|supplier|distributor/i.test(h)
    );
    const supplierFromData = supplierHeader && file.rows.length > 0
      ? String(file.rows[0][supplierHeader] ?? '')
      : '';
    setDetectedDistributorName(
      match?.profile.name ?? supplierFromData ?? file.fileName.replace(/\.[^/.]+$/, '')
    );

    const needs = detectPromptNeeds(file.headers, file.rows);
    setPromptNeeds(needs);

    if (match) {
      // Apply profile directly — skip prompts if profile covers facility/date
      const profileMappings = applyProfile(match.profile, file.headers);
      // Merge: fill in any null fields from autoMapper
      const autoMappings = buildMappings(file.headers, {}, needs, file.rows);
      const merged = profileMappings.map((pm, i) =>
        pm.value.type === 'null' ? autoMappings[i] : pm
      );
      setMappings(merged);
      setStep('mapping');
      return;
    }

    const anyNeeded = needs.needsFacilityId || needs.needsFacilityName || needs.needsDate || needs.needsSupplierName;
    if (!anyNeeded) {
      const built = buildMappings(file.headers, {}, needs, file.rows);
      setMappings(built);
      setStep('mapping');
    } else {
      setStep('prompts');
    }
  }

  function handlePromptsComplete(prompts: UserPrompts) {
    if (!parsedFile || !promptNeeds) return;
    const built = buildMappings(parsedFile.headers, prompts, promptNeeds, parsedFile.rows);
    setMappings(built);
    setStep('mapping');
  }

  function handleProfileOverride() {
    // User wants to ignore the profile and re-map from scratch
    if (!parsedFile || !promptNeeds) return;
    setProfileMatch(null);
    const anyNeeded = promptNeeds.needsFacilityId || promptNeeds.needsFacilityName || promptNeeds.needsDate || promptNeeds.needsSupplierName;
    if (anyNeeded) {
      setStep('prompts');
    } else {
      const built = buildMappings(parsedFile.headers, {}, promptNeeds);
      setMappings(built);
    }
  }

  function handleMappingContinue(edits: SessionEdit[]) {
    setSessionEdits(edits);
    const learnable = edits.filter(e => e.correctedHeader && e.correctedHeader !== e.originalHeader);
    if (learnable.length === 0) {
      setStep('output');
      return;
    }
    const current = loadLearnings();
    setExistingLearnings(current);
    setStep('learning');
  }

  function handleLearningConfirm(approved: SessionEdit[]) {
    const current = loadLearnings();
    const { updated } = applySessionEdits(approved, current);
    saveLearnings(updated);
    setStep('output');
  }

  function handleSaveProfile(name: string) {
    const profile = buildProfileFromMappings(name, mappings);

    // Merge with existing profile if one was matched
    if (profileMatch) {
      const existing = profileMatch.profile;
      const updated: DistributorProfile = {
        ...profile,
        id: existing.id,
        aliases: [...new Set([...existing.aliases, profile.aliases[0]])],
        usageCount: existing.usageCount + 1,
        createdAt: existing.createdAt,
      };
      saveProfile(updated);
    } else {
      saveProfile(profile);
    }
  }

  function handleReset() {
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
      {step === 'upload' && (
        <FileUpload onFileParsed={handleFileParsed} />
      )}

      {step === 'prompts' && promptNeeds && (
        <PromptDialog needs={promptNeeds} onComplete={handlePromptsComplete} />
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
        />
      )}

      {step === 'learning' && (
        <LearningReview
          edits={sessionEdits}
          existingLearnings={existingLearnings}
          onConfirm={handleLearningConfirm}
          onSkip={() => setStep('output')}
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
        />
      )}
    </div>
  );
}
