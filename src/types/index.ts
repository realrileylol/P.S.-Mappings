export type MappingValueType =
  | { type: 'null' }
  | { type: 'literal'; value: string }
  | { type: 'column'; name: string }
  | { type: 'computed'; expression: string; description: string };

export type ConfidenceLevel = 'exact' | 'high' | 'medium' | 'low' | 'none' | 'hardcoded' | 'computed' | 'always-null';

export interface FieldMapping {
  templateField: string;
  value: MappingValueType;
  confidence: ConfidenceLevel;
  locked?: boolean; // always-null fields like InvoiceExtractDate
}

export interface UserPrompts {
  facilityId?: string;
  facilityName?: string;
  date?: string;
  supplierName?: string;
}

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
}

export type AppStep = 'upload' | 'prompts' | 'mapping' | 'learning' | 'output';

export interface PromptNeeds {
  needsFacilityId: boolean;
  needsFacilityName: boolean;
  needsDate: boolean;
  needsSupplierName: boolean;
  detectedFacilityName?: string;
  detectedFacilityId?: string;
  detectedDate?: string;
  detectedSupplierName?: string;
}
