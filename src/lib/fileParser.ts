import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedFile, RawFileData } from '../types';

// ── Raw parse (no header processing) ──────────────────────────────────────

export async function parseFileRaw(file: File): Promise<RawFileData> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: false,
        complete: (results) => {
          resolve({ rows: results.data as string[][], fileName: file.name });
        },
        error: reject,
      });
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][];
          resolve({ rows, fileName: file.name });
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

// ── Build ParsedFile from raw data + user selections ──────────────────────

export function buildParsedFile(
  raw: RawFileData,
  headerRowIndex: number,
  excludedRowIndices: Set<number>
): ParsedFile {
  const headerRow = raw.rows[headerRowIndex] ?? [];
  const headers = headerRow
    .map(h => String(h ?? '').trim())
    .filter(Boolean);

  const rows: Record<string, string>[] = [];
  for (let i = headerRowIndex + 1; i < raw.rows.length; i++) {
    if (excludedRowIndices.has(i)) continue;
    const row = raw.rows[i];
    // Skip rows that are entirely empty
    if (row.every(c => String(c ?? '').trim() === '')) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, j) => {
      record[h] = String(row[j] ?? '');
    });
    rows.push(record);
  }

  return { headers, rows, fileName: raw.fileName };
}

// ── Auto-detect most likely header row ────────────────────────────────────

export function detectHeaderRow(rows: string[][]): number {
  // Score each row: headers are usually non-numeric strings
  // with mostly unique, non-empty values
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const nonEmpty = row.filter(c => String(c ?? '').trim() !== '');
    if (nonEmpty.length < 2) continue;
    const nonNumeric = nonEmpty.filter(c => isNaN(Number(c)));
    // If 60%+ of cells are non-numeric text, likely a header row
    if (nonNumeric.length / nonEmpty.length >= 0.6) return i;
  }
  return 0;
}

// ── Legacy full parse (kept for fallback if needed) ───────────────────────

export async function parseFile(file: File): Promise<ParsedFile> {
  const raw = await parseFileRaw(file);
  const headerRow = detectHeaderRow(raw.rows);
  return buildParsedFile(raw, headerRow, new Set());
}
