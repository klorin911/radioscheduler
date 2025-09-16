import React, { useCallback } from 'react';

type Props = {
  id: string; // grid id for focus navigation
  headers: string[];
  rows: string[][];
  readOnlyCols?: Set<number>; // indices that are read-only (e.g., time column)
  className?: string;
  onChange: (rowIndex: number, colIndex: number, value: string) => void;
  // Optional cellClass for dynamic styling (e.g., disabled MT)
  cellClassName?: (rowIndex: number, colIndex: number) => string | undefined;
  // Width hints in px for colgroup; if not provided, CSS governs
  colWidthsPx?: number[];
  // Optional custom renderer for editable cells
  renderCell?: (
    rowIndex: number,
    colIndex: number,
    value: string,
    onChange: (value: string) => void,
  ) => React.ReactNode;
};

/**
 * Minimal spreadsheet-like grid:
 * - Fixed col widths via colgroup so multiple tables can align perfectly
 * - Editable cells (except those in readOnlyCols)
 * - Arrow-key navigation across inputs
 */
export default function SheetGrid({
  id,
  headers,
  rows,
  readOnlyCols,
  className,
  onChange,
  cellClassName,
  colWidthsPx,
  renderCell,
}: Props) {
  const isReadOnly = useCallback((c: number) => !!readOnlyCols?.has(c), [readOnlyCols]);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number,
  ) => {
    const key = e.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(key)) return;
    // Allow Enter to move down; Shift+Enter up. Tab behaves normally across inputs too,
    // but we steer it so movement stays inside the grid.
    e.preventDefault();
    let nr = r;
    let nc = c;
    if (key === 'ArrowUp' || (key === 'Enter' && e.shiftKey)) nr = Math.max(0, r - 1);
    else if (key === 'ArrowDown' || key === 'Enter') nr = Math.min(rows.length - 1, r + 1);
    else if (key === 'ArrowLeft' || (key === 'Tab' && e.shiftKey)) nc = Math.max(0, c - 1);
    else if (key === 'ArrowRight' || key === 'Tab') nc = Math.min(headers.length - 1, c + 1);

    // Skip read-only columns when moving horizontally
    if (isReadOnly(nc)) {
      if (nc < c) {
        // move left until we find editable or hit 0
        while (nc > 0 && isReadOnly(nc)) nc--;
      } else if (nc > c) {
        while (nc < headers.length - 1 && isReadOnly(nc)) nc++;
      }
    }

    const next = document.querySelector<HTMLInputElement>(
      `input[data-grid="${id}"][data-r="${nr}"][data-c="${nc}"]`
    );
    if (next) next.focus();
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    r: number,
    c: number,
  ) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return; // allow default
    e.preventDefault();
    const lines = text.replace(/\r/g, '').split(/\n/).filter((l) => l.length > 0);
    const grid = lines.map((line) => line.split(/\t|,/) );
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const rr = r + i;
        const cc = c + j;
        if (rr >= rows.length || cc >= headers.length) continue;
        if (isReadOnly(cc)) continue;
        onChange(rr, cc, grid[i][j]);
      }
    }
  };

  return (
    <table className={className || 'detail-table'}>
      {colWidthsPx && colWidthsPx.length ? (
        <colgroup>
          {colWidthsPx.map((w, i) => (
            <col key={i} style={{ width: w ? `${w}px` : undefined }} />
          ))}
        </colgroup>
      ) : null}
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => {
              const cls = cellClassName?.(r, c);
              const readOnly = isReadOnly(c);
              return (
                <td key={c} className={cls}>
                  {readOnly ? (
                    <span>{cell}</span>
                  ) : (
                    <>
                      {renderCell ? (
                        renderCell(r, c, cell, (v) => onChange(r, c, v))
                      ) : (
                        <input
                          data-grid={id}
                          data-r={r}
                          data-c={c}
                          className={(cell && String(cell).trim()) ? 'detail-input filled' : 'detail-input empty'}
                          value={cell}
                          onChange={(e) => onChange(r, c, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, r, c)}
                          onPaste={(e) => handlePaste(e, r, c)}
                        />
                      )}
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
