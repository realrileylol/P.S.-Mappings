import { useState } from 'react';
import { ChevronRight, CheckSquare, Square, ArrowUpFromLine } from 'lucide-react';
import type { RawFileData } from '../types';
import { buildParsedFile } from '../lib/fileParser';
import type { ParsedFile } from '../types';
import { NewFileButton } from './NewFileButton';

interface Props {
  raw: RawFileData;
  initialHeaderRow: number;
  onConfirm: (file: ParsedFile) => void;
  onNewFile: () => void;
}

const MAX_COLS    = 8;   // columns visible before "+N more"
const TOP_ROWS    = 12;  // rows shown from top
const BOTTOM_ROWS = 5;   // rows always shown from bottom

export function DataPreview({ raw, initialHeaderRow, onConfirm, onNewFile }: Props) {
  const [headerRow, setHeaderRow]   = useState(initialHeaderRow);
  const [excluded, setExcluded]     = useState<Set<number>>(new Set());

  const totalRows = raw.rows.length;
  const colCount  = Math.max(...raw.rows.slice(0, 5).map(r => r.length));
  const visibleCols = Math.min(colCount, MAX_COLS);
  const extraCols   = colCount - visibleCols;

  // Which rows to show: top block + bottom block
  const topEnd      = Math.min(TOP_ROWS, totalRows);
  const bottomStart = Math.max(topEnd, totalRows - BOTTOM_ROWS);
  const hiddenCount = bottomStart - topEnd;

  const visibleRowIndices: Array<number | 'gap'> = [];
  for (let i = 0; i < topEnd; i++) visibleRowIndices.push(i);
  if (hiddenCount > 0) visibleRowIndices.push('gap');
  for (let i = bottomStart; i < totalRows; i++) visibleRowIndices.push(i);

  function toggleExclude(idx: number) {
    if (idx === headerRow) return; // can't exclude the header row
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function handleSetHeader(idx: number) {
    setHeaderRow(idx);
    // Un-exclude any row now at/above the new header
    setExcluded(prev => {
      const next = new Set(prev);
      for (let i = 0; i <= idx; i++) next.delete(i);
      return next;
    });
  }

  function handleConfirm() {
    const file = buildParsedFile(raw, headerRow, excluded);
    if (file.headers.length === 0) return;
    onConfirm(file);
  }

  const headerCount  = raw.rows[headerRow]?.filter(c => String(c ?? '').trim()).length ?? 0;
  const dataRowCount = totalRows - headerRow - 1 - excluded.size;
  const excludedCount = excluded.size;

  function cellText(val: string | undefined): string {
    return String(val ?? '').trim().slice(0, 28);
  }

  function renderRow(rowIdx: number) {
    const isHeader   = rowIdx === headerRow;
    const isAbove    = rowIdx < headerRow;
    const isExcluded = excluded.has(rowIdx);
    const rowData    = raw.rows[rowIdx] ?? [];

    const rowBg = isHeader
      ? 'bg-blue-950/60 border-blue-800/60'
      : isAbove
        ? 'border-slate-800/30 opacity-40'
        : isExcluded
          ? 'border-slate-800/30 bg-red-950/20 opacity-50'
          : 'border-slate-800/40 hover:bg-slate-800/20';

    return (
      <tr key={rowIdx} className={`border-b transition-colors group ${rowBg}`}>
        {/* Row number — click to set as header */}
        <td className="py-2 px-0 w-10 text-center border-r border-slate-800/50 flex-shrink-0">
          <button
            onClick={() => handleSetHeader(rowIdx)}
            title={isHeader ? 'Header row' : 'Set as header row'}
            className={`w-full h-full flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors
              ${isHeader ? 'cursor-default' : 'hover:bg-blue-500/10 cursor-pointer'}`}
          >
            <span className={`text-[10px] tabular-nums ${isHeader ? 'text-blue-400 font-bold' : 'text-slate-600 group-hover:text-slate-400'}`}>
              {rowIdx + 1}
            </span>
            {!isHeader && !isAbove && (
              <ArrowUpFromLine className="w-2.5 h-2.5 text-slate-700 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
            )}
          </button>
        </td>

        {/* Header badge OR exclude checkbox */}
        <td className="py-2 px-2 w-20 border-r border-slate-800/50 text-center">
          {isHeader ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[9px] font-bold uppercase tracking-wide">
              Header
            </span>
          ) : isAbove ? (
            <span className="text-[9px] text-slate-700 uppercase tracking-wide">skip</span>
          ) : (
            <button
              onClick={() => toggleExclude(rowIdx)}
              title={isExcluded ? 'Include this row' : 'Exclude this row'}
              className="flex items-center justify-center w-full transition-colors"
            >
              {isExcluded
                ? <CheckSquare className="w-3.5 h-3.5 text-red-400" />
                : <Square className="w-3.5 h-3.5 text-slate-700 hover:text-slate-400" />
              }
            </button>
          )}
        </td>

        {/* Data cells */}
        {Array.from({ length: visibleCols }, (_, j) => {
          const raw_val = cellText(rowData[j]);
          const empty   = raw_val === '';
          return (
            <td key={j} className="py-2 px-3 border-r border-slate-800/30 max-w-[130px] overflow-hidden">
              <span className={`text-xs truncate block
                ${isHeader    ? 'text-blue-300 font-medium' :
                  isExcluded  ? 'text-slate-600 line-through' :
                  isAbove     ? 'text-slate-600' :
                  empty       ? 'text-slate-700 italic' :
                                'text-slate-300'}`}
                title={String(rawData(rowData, j))}
              >
                {empty ? '—' : raw_val}
              </span>
            </td>
          );
        })}

        {extraCols > 0 && (
          <td className="py-2 px-2 text-[10px] text-slate-700">+{extraCols}</td>
        )}
      </tr>
    );
  }

  function rawData(row: string[], j: number): string {
    return String(row[j] ?? '');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f1e]">

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">Configure Data Range</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Click a row number to set it as the header row · Check data rows to exclude them
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NewFileButton onNewFile={onNewFile} />
            {/* Summary badges */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-blue-400">{headerCount} columns</span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">{dataRowCount} data rows</span>
              {excludedCount > 0 && <>
                <span className="text-slate-700">·</span>
                <span className="text-red-400">{excludedCount} excluded</span>
              </>}
            </div>
            <button
              onClick={handleConfirm}
              disabled={headerCount === 0}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Continue to Mapping
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-6xl mx-auto w-full px-6 pt-5 pb-2 flex items-start gap-6 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
          Blue row = headers sent to the mapper
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowUpFromLine className="w-3 h-3 text-blue-500" />
          Click any row number to promote it to header
        </span>
        <span className="flex items-center gap-1.5">
          <CheckSquare className="w-3 h-3 text-red-400" />
          Check rows to exclude (junk rows at top or bottom)
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl border border-slate-800 overflow-auto mt-2">
            <table className="text-sm w-max min-w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="py-2 px-0 w-10 text-[10px] text-slate-600 uppercase tracking-wider border-r border-slate-800 text-center font-medium">#</th>
                  <th className="py-2 px-2 w-20 text-[10px] text-slate-600 uppercase tracking-wider border-r border-slate-800 text-center font-medium">Role</th>
                  {Array.from({ length: visibleCols }, (_, j) => (
                    <th key={j} className="py-2 px-3 text-[10px] text-slate-600 font-medium text-left border-r border-slate-800/50 min-w-[110px] max-w-[130px]">
                      Col {j + 1}
                    </th>
                  ))}
                  {extraCols > 0 && <th className="py-2 px-2 text-[10px] text-slate-700 font-medium">+{extraCols} cols</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRowIndices.map((entry) => {
                  if (entry === 'gap') {
                    return (
                      <tr key="gap" className="border-b border-slate-800/40 bg-slate-900/20">
                        <td colSpan={visibleCols + 2 + (extraCols > 0 ? 1 : 0)} className="py-2 px-5 text-center text-xs text-slate-700 italic">
                          ··· {hiddenCount} rows not shown (middle of file) ···
                        </td>
                      </tr>
                    );
                  }
                  return renderRow(entry);
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-700 mt-3 text-center">
            Showing first {Math.min(TOP_ROWS, totalRows)} rows
            {hiddenCount > 0 ? ` + last ${Math.min(BOTTOM_ROWS, totalRows)} rows` : ''}
            {' '}of {totalRows} total · {raw.fileName}
          </p>
        </div>
      </div>
    </div>
  );
}
