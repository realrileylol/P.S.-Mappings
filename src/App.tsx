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

export default function App() {
  const [step, setStep] = useState<AppStep>('upload');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [promptNeeds, setPromptNeeds] = useState<PromptNeeds | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [sessionEdits, setSessionEdits] = useState<SessionEdit[]>([]);
  const [existingLearnings, setExistingLearnings] = useState<LearnedSynonym[]>([]);

  function handleFileParsed(file: ParsedFile) {
    setParsedFile(file);
    const needs = detectPromptNeeds(file.headers);
    setPromptNeeds(needs);

    const anyNeeded = needs.needsFacilityId || needs.needsFacilityName || needs.needsDate || needs.needsSupplierName;
    if (!anyNeeded) {
      const built = buildMappings(file.headers, {}, needs);
      setMappings(built);
      setStep('mapping');
    } else {
      setStep('prompts');
    }
  }

  function handlePromptsComplete(prompts: UserPrompts) {
    if (!parsedFile || !promptNeeds) return;
    const built = buildMappings(parsedFile.headers, prompts, promptNeeds);
    setMappings(built);
    setStep('mapping');
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

  function handleReset() {
    setParsedFile(null);
    setPromptNeeds(null);
    setMappings([]);
    setSessionEdits([]);
    setExistingLearnings([]);
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
          onMappingsChange={setMappings}
          onContinue={handleMappingContinue}
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
          onReset={handleReset}
          onBack={() => setStep('mapping')}
        />
      )}
    </div>
  );
}
