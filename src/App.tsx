import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { PromptDialog } from './components/PromptDialog';
import { MappingTable } from './components/MappingTable';
import { OutputPanel } from './components/OutputPanel';
import type { ParsedFile, FieldMapping, UserPrompts, AppStep, PromptNeeds } from './types';
import { detectPromptNeeds, buildMappings } from './lib/autoMapper';

export default function App() {
  const [step, setStep] = useState<AppStep>('upload');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [promptNeeds, setPromptNeeds] = useState<PromptNeeds | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);

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

  function handleReset() {
    setParsedFile(null);
    setPromptNeeds(null);
    setMappings([]);
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
          onMappingsChange={setMappings}
          onContinue={() => setStep('output')}
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
