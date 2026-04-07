import { useState, useRef } from 'react';
import { ChevronRight, ArrowUpFromLine, CheckSquare, Square, Pencil } from 'lucide-react';
import type { RawFileData, ParsedFile } from '../types';
import { buildParsedFile } from '../lib/fileParser';
import { NewFileButton } from './NewFileButton';

interface Props {
  raw: RawFileData;
  initialHeaderRow: number;
  onConfirm: (file: ParsedFile) => void;
  onNewFile: () => void;
}

const DEFAULT_SHOW = 20;  // rows shown before "show all" is needed
const ALWAYS_BOTTOM = 8;  // always show last N rows

// ── Inline editor for a single header cell ────────────────────────────────

function HeaderCellEditor({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  onCommit: (val: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  return (
    <input
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onCommit(val)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(val); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      placeholder="Column name…"
      className="w-full min-w-[100px] bg-blue-950/80 border border-blue-400/80 rounded px-2 py-0.5 text-xs text-blue-200 focus:outline-none"
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function DataPreview({ raw, initialHeaderRow, onConfirm, onNewFile }: Props) {
  const [headerRow, setHeaderRow]         = useState(initialHeaderRow);
  const [excluded, setExcluded]           = useState<Set<number>>(new Set());
  const [headerEdits, setHeaderEdits]     = useState<Record<number, string>>({});
  const [editingCell, setEditingCell]     = useState<number | null>(null); // col index being edited
  const [showAll, setShowAll]             = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const totalRows = raw.rows.length;
  const totalCols = Math.max(...raw.rows.slice(0, Math.min(20, totalRows)).map(r => r.length), 0);

  // Which rows to render
  const topEnd      = showAll ? totalRows : Math.min(DEFAULT_SHOW, totalRows);
  const bottomStart = showAll ? totalRows : Math.max(topEnd, totalRows - ALWAYS_BOTTOM);
  const hiddenCount = Math.max(0, bottomStart - topEnd);

  const visibleIndices: Array<number | 'gap'> = [];
  for (let i = 0; i < topEnd; i++) visibleIndices.push(i);
  if (hiddenCount > 0) visibleIndices.push('gap');
  for (let i = bottomStart; i < totalRows; i++) visibleIndices.push(i);

  // Get display value for a header column
  function headerVal(colIdx: number): string {
    if (headerEdits[colIdx] !== undefined) return headerEdits[colIdx];
    return String(raw.rows[headerRow]?.[colIdx] ?? '').trim();
  }

  function toggleExclude(idx: number) {
    if (idx === headerRow) return;
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function handleSetHeader(idx: number) {
    setHeaderRow(idx);
    setHeaderEdits({});
    setEditingCell(null);
    setExcluded(prev => {
      const next = new Set(prev);
      for (let i = 0; i <= idx; i++) next.delete(i);
      return next;
    });
  }

  function commitHeaderEdit(colIdx: number, val: string) {
    setHeaderEdits(prev => ({ ...prev, [colIdx]: val.trim() }));
    setEditingCell(null);
  }

  function handleConfirm() {
    // Apply any header cell edits to a copy of the raw rows
    const modifiedRows = raw.rows.map((row, i) => {
      if (i !== headerRow) return row;
      return row.map((cell, j) =>
        headerEdits[j] !== undefined ? headerEdits[j] : cell
      );
    });
    const file = buildParsedFile({ ...raw, rows: modifiedRows }, headerRow, excluded);
    if (file.headers.length === 0) return;
    onConfirm(file);
  }

  const headerCount  = Array.from({ length: totalCols }, (_, j) => headerVal(j)).filter(Boolean).length;
  const dataRowCount = totalRows - headerRow - 1 - excluded.size;
  const blankHeaders = Array.from({ length: totalCols }, (_, j) => headerVal(j)).filter(v => !v).length;

  // Cell text helper
  function cellText(row: string[], colIdx: number): string {
    return String(row[colIdx] ?? '').trim();
  }

  function renderRow(rowIdx: number) {
    const isHeader   = rowIdx === headerRow;
    const isAbove    = rowIdx < headerRow;
    const isExcluded = excluded.has(rowIdx);
    const rowData    = raw.rows[rowIdx] ?? [];

    const rowClass = isHeader
      ? 'bg-blue-950/50 border-blue-800/50'
      : isAbove
      ? 'border-slate-800/20 opacity-35'
      : isExcluded
      ? 'border-slate-800/30 bg-red-950/20 opacity-40'
      : 'border-slate-800/40 hover:bg-slate-800/20';

    return (
      <tr key={rowIdx} className={`border-b transition-colors group ${rowClass}`}>

        {/* Sticky: row number */}
        <td className="sticky left-0 z-10 w-10 py-1.5 text-center border-r border-slate-800/60 bg-inherit"
          style={{ background: isHeader ? 'rgb(23 37 84 / 0.5)' : isExcluded ? 'rgb(69 10 10 / 0.2)' : '#0a0f1e' }}>
          <button
            onClick={() => handleSetHeader(rowIdx)}
            title={isHeader ? 'Header row' : 'Click to use as header row'}
            className={`w-full flex flex-col items-center justify-center gap-px py-1 transition-colors
              ${isHeader ? 'cursor-default' : 'hover:bg-blue-500/10 cursor-pointer'}`}
          >
            <span className={`text-[10px] tabular-nums leading-none
              ${isHeader ? 'text-blue-400 font-bold' : 'text-slate-600 group-hover:text-slate-400'}`}>
              {rowIdx + 1}
            </span>
            {!isHeader && (
              <ArrowUpFromLine className="w-2.5 h-2.5 text-slate-700 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
            )}
          </button>
        </td>

        {/* Sticky: role badge / exclude checkbox */}
        <td className="sticky left-10 z-10 w-[72px] py-1.5 px-1.5 text-center border-r border-slate-800/60"
          style={{ background: isHeader ? 'rgb(23 37 84 / 0.5)' : isExcluded ? 'rgb(69 10 10 / 0.2)' : '#0a0f1e' }}>
          {isHeader ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[9px] font-bold uppercase tracking-wide">
              Header
            </span>
          ) : isAbove ? (
            <span className="text-[9px] text-slate-700 uppercase tracking-wide">skip</span>
          ) : (
            <button
              onClick={() => toggleExclude(rowIdx)}
              title={isExcluded ? 'Include this row' : 'Exclude this row'}
              className="flex items-center justify-center w-full"
            >
              {isExcluded
                ? <CheckSquare className="w-3.5 h-3.5 text-red-400" />
                : <Square className="w-3.5 h-3.5 text-slate-700 hover:text-slate-400" />}
            </button>
          )}
        </td>

        {/* Data cells */}
        {Array.from({ length: totalCols }, (_, j) => {
          const raw_val = cellText(rowData, j);

          // Header row: editable cells
          if (isHeader) {
            const displayVal = headerVal(j);
            const isEmpty    = !displayVal;
            const isEditing  = editingCell === j;
            return (
              <td key={j} className="py-1 px-1.5 border-r border-blue-800/30 min-w-[100px]">
                {isEditing ? (
                  <HeaderCellEditor
                    initialValue={displayVal}
                    onCommit={val => commitHeaderEdit(j, val)}
                    onCancel={() => setEditingCell(null)}
                  />
                ) : (
                  <button
                    onClick={() => setEditingCell(j)}
                    title="Click to edit column name"
                    className={`w-full text-left px-1 py-0.5 rounded text-xs transition-colors flex items-center gap-1 group/cell
                      ${isEmpty
                        ? 'text-slate-600 hover:text-slate-300 border border-dashed border-slate-700/60 hover:border-blue-500/50 hover:bg-blue-950/30'
                        : 'text-blue-300 font-medium hover:bg-blue-900/20'}`}
                  >
                    <span className="truncate flex-1">{isEmpty ? 'unnamed' : displayVal}</span>
                    <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/cell:opacity-60 flex-shrink-0" />
                  </button>
                )}
              </td>
            );
          }

          // Regular data cell
          const empty = raw_val === '';
          return (
            <td key={j} className="py-1.5 px-2.5 border-r border-slate-800/25 min-w-[100px] max-w-[180px] overflow-hidden">
              <span className={`text-xs truncate block
                ${isExcluded ? 'text-slate-600 line-through' : isAbove ? 'text-slate-600' : empty ? 'text-slate-700' : 'text-slate-300'}`}
                title={raw_val}
              >
                {empty ? '—' : raw_val.slice(0, 40)}
              </span>
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f1e]">

      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-3.5">
        <div className="max-w-full mx-auto flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">Configure Data Range</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Click a row number to set headers · Click any header cell to rename it · Check rows to exclude
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <NewFileButton onNewFile={onNewFile} />
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-blue-400">{headerCount} columns</span>
              {blankHeaders > 0 && <>
                <span className="text-slate-700">·</span>
                <span className="text-yellow-400">{blankHeaders} unnamed</span>
              </>}
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">{dataRowCount} data rows</span>
              {excluded.size > 0 && <>
                <span className="text-slate-700">·</span>
                <span className="text-red-400">{excluded.size} excluded</span>
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

      {/* Legend */}
      <div className="border-b border-slate-800/60 px-6 py-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <ArrowUpFromLine className="w-3 h-3 text-blue-400" />
          Click row # to set as header
        </span>
        <span className="flex items-center gap-1.5">
          <Pencil className="w-3 h-3 text-blue-400" />
          Click any header cell to rename (fix unnamed/blank columns)
        </span>
        <span className="flex items-center gap-1.5">
          <CheckSquare className="w-3 h-3 text-red-400" />
          Check data rows to exclude them
        </span>
        {blankHeaders > 0 && (
          <span className="text-yellow-500 font-medium">
            ⚠ {blankHeaders} unnamed column{blankHeaders > 1 ? 's' : ''} — click to name before continuing
          </span>
        )}
      </div>

      {/* Scrollable table */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        <table className="text-sm border-collapse w-max" style={{ minWidth: '100%' }}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-700 bg-slate-900">
              <th className="sticky left-0 z-20 bg-slate-900 w-10 py-2 px-0 text-center border-r border-slate-700">
                <span className="text-[9px] text-slate-600 uppercase tracking-wider">#</span>
              </th>
              <th className="sticky left-10 z-20 bg-slate-900 w-[72px] py-2 px-1 text-center border-r border-slate-700">
                <span className="text-[9px] text-slate-600 uppercase tracking-wider">Role</span>
              </th>
              {Array.from({ length: totalCols }, (_, j) => (
                <th key={j} className="py-2 px-2.5 text-left border-r border-slate-800/50 min-w-[100px]">
                  <span className="text-[9px] text-slate-700 font-medium">Col {j + 1}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleIndices.map(entry => {
              if (entry === 'gap') {
                return (
                  <tr key="gap" className="border-b border-slate-800/40">
                    <td
                      colSpan={totalCols + 2}
                      className="py-3 px-6 text-center"
                    >
                      <button
                        onClick={() => setShowAll(true)}
                        className="text-xs text-blue-500 hover:text-blue-400 underline transition-colors"
                      >
                        ··· {hiddenCount} rows not shown — click to show all {totalRows} rows ···
                      </button>
                    </td>
                  </tr>
                );
              }
              return renderRow(entry);
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/60 px-6 py-2 flex items-center justify-between">
        <p className="text-[11px] text-slate-700">
          {raw.fileName} · {totalRows} rows · {totalCols} columns
        </p>
        {!showAll && totalRows > DEFAULT_SHOW + ALWAYS_BOTTOM && (
          <button onClick={() => setShowAll(true)} className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
            Show all {totalRows} rows
          </button>
        )}
      </div>
    </div>
  );
}
