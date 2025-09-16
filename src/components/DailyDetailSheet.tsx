import { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { Day, Schedule, TimeSlot, Column, isCellDisabled } from '../constants';
import { ExtendedDispatcher } from '../appTypes';
import { loadDailyDetail, saveDailyDetail, type DailyDetailDoc, type DailyDetailGrid } from '../appStorage';
import { buildDailyDetailDoc } from '../utils/dailyDetail';
import '../styles/daily-detail.css';
import SheetGrid from './SheetGrid';
import DispatcherDropdown from './DispatcherDropdown';
import type { RowInput, Styles, CellHookData } from 'jspdf-autotable';
import type { jsPDF } from 'jspdf';

export interface DailyDetailHandle {
  generateFromSchedule: () => void;
  exportCSV: () => void;
  exportPDF: () => Promise<void>;
  print: () => void;
}

interface Props {
  day: Day;
  schedule: Schedule;
  dispatchers: ExtendedDispatcher[];
}

const csvQuote = (val: string) => '"' + (val ?? '').replace(/"/g, '""') + '"';

const isDailyDetailDoc = (value: unknown): value is DailyDetailDoc => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DailyDetailDoc>;
  return !!candidate.grid && !!candidate.rosters && !!candidate.stabilizer && !!candidate.relief && !!candidate.teletype;
};

const isDailyDetailGrid = (value: unknown): value is DailyDetailGrid => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DailyDetailGrid>;
  return Array.isArray(candidate.headers) && Array.isArray(candidate.rows);
};

const DailyDetailSheet = forwardRef<DailyDetailHandle, Props>(function DailyDetailSheet(
  { day, schedule, dispatchers },
  ref
) {
  const formatTimeDisplay = useCallback((value: string): string => {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) return '';
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-').map((part) => {
        const digits = part.replace(/\D+/g, '');
        if (!digits) return part.trim();
        return digits.padStart(4, '0');
      });
      return parts.join('-');
    }
    const digits = trimmed.replace(/\D+/g, '');
    if (!digits) return trimmed;
    return digits.padStart(4, '0');
  }, []);

  const normalizePanelTimes = useCallback((d: DailyDetailDoc): DailyDetailDoc => {
    const normalizeRows = (rows: string[][]) =>
      (rows || []).map((row) => {
        if (!row) return row;
        const next = row.slice();
        next[0] = formatTimeDisplay(next[0] ?? '');
        return next;
      });

    return {
      ...d,
      stabilizer: {
        ...d.stabilizer,
        rows: normalizeRows(d.stabilizer?.rows || []),
      },
      relief: {
        ...d.relief,
        rows: normalizeRows(d.relief?.rows || []),
      },
      teletype: {
        ...d.teletype,
        rows: normalizeRows(d.teletype?.rows || []),
      },
    };
  }, [formatTimeDisplay]);

  const [doc, setDoc] = useState<DailyDetailDoc>(() => normalizePanelTimes(buildDailyDetailDoc(day, schedule, dispatchers)));

  // Load or initialize on day change
  useEffect(() => {
    const saved = loadDailyDetail(day);
    if (isDailyDetailDoc(saved)) {
      let d = saved;
      // Normalize: ensure F SHIFT exists in rosters
      if (d.rosters && !d.rosters.headers.includes('F SHIFT')) {
        d = {
          ...d,
          rosters: {
            headers: [...d.rosters.headers, 'F SHIFT'],
            rows: (d.rosters.rows || []).map((r) => [...r, ''])
          }
        };
      }
      // Normalize: stabilizer should have 3 columns [time, name1, name2]
      if ((d.stabilizer?.headers?.length ?? 0) < 3) {
        d = {
          ...d,
          stabilizer: {
            headers: ['STABILIZER', '', ''],
            rows: (d.stabilizer?.rows || []).map((r) => [r[0] ?? '', r[1] ?? '', ''])
          }
        } as DailyDetailDoc;
      }
      // Normalize: teletype should have 2 columns [time, name]
      if ((d.teletype?.headers?.length ?? 0) < 2) {
        d = {
          ...d,
          teletype: {
            headers: ['TELETYPE', ''],
            rows: (d.teletype?.rows || []).map((r) => [r[0] ?? '', ''])
          }
        } as DailyDetailDoc;
      }
      setDoc(normalizePanelTimes(d));
    }
    else if (isDailyDetailGrid(saved)) {
      // Back-compat: old saved grid only
      const grid = saved;
      setDoc(normalizePanelTimes({
        grid,
        rosters: { headers: ['A SHIFT','B SHIFT','C SHIFT','E SHIFT','F SHIFT'], rows: [] },
        stabilizer: { headers: ['STABILIZER','',''], rows: [] },
        relief: { headers: ['RELIEF',''], rows: [] },
        teletype: { headers: ['TELETYPE',''], rows: [] },
      }));
    } else {
      setDoc(normalizePanelTimes(buildDailyDetailDoc(day, schedule, dispatchers)));
    }
  }, [day, schedule, dispatchers, normalizePanelTimes]);

  const persist = useCallback((d: DailyDetailDoc) => {
    saveDailyDetail(day, d);
  }, [day]);

  const setGridCell = (rowIndex: number, colIndex: number, value: string) => {
    setDoc((prev) => {
      const next: DailyDetailDoc = {
        ...prev,
        grid: {
          headers: prev.grid.headers.slice(),
          rows: prev.grid.rows.map((r, i) => (i === rowIndex ? r.slice() : r)),
        },
      };
      next.grid.rows[rowIndex][colIndex] = value;
      persist(next);
      return next;
    });
  };

  const setRosterCell = (rowIndex: number, colIndex: number, value: string) => {
    setDoc((prev) => {
      const next: DailyDetailDoc = {
        ...prev,
        rosters: {
          headers: prev.rosters.headers.slice(),
          rows: prev.rosters.rows.map((r, i) => (i === rowIndex ? r.slice() : r)),
        },
      };
      while (next.rosters.rows.length <= rowIndex) next.rosters.rows.push(new Array(next.rosters.headers.length).fill(''));
      next.rosters.rows[rowIndex][colIndex] = value;
      persist(next);
      return next;
    });
  };

  const setPanelCell = (panel: 'stabilizer' | 'relief' | 'teletype', rowIndex: number, colIndex: number, value: string) => {
    setDoc((prev) => {
      const cloneRows = (rows: string[][], headersLen: number) => {
        const nextRows = rows.map((row) => row.slice());
        while (nextRows.length <= rowIndex) {
          nextRows.push(new Array(headersLen).fill(''));
        }
        const row = nextRows[rowIndex];
        row[colIndex] = value;
        return nextRows;
      };

      if (panel === 'stabilizer') {
        const next: DailyDetailDoc = {
          ...prev,
          stabilizer: {
            ...prev.stabilizer,
            rows: cloneRows(prev.stabilizer.rows, prev.stabilizer.headers.length),
          },
        };
        persist(next);
        return next;
      }

      if (panel === 'relief') {
        const next: DailyDetailDoc = {
          ...prev,
          relief: {
            ...prev.relief,
            rows: cloneRows(prev.relief.rows, prev.relief.headers.length),
          },
        };
        persist(next);
        return next;
      }

      const next: DailyDetailDoc = {
        ...prev,
        teletype: {
          ...prev.teletype,
          rows: cloneRows(prev.teletype.rows, prev.teletype.headers.length),
        },
      };
      persist(next);
      return next;
    });
  };

  const generateFromSchedule = useCallback(() => {
    const fresh = normalizePanelTimes(buildDailyDetailDoc(day, schedule, dispatchers));
    setDoc(fresh);
    persist(fresh);
  }, [day, schedule, dispatchers, persist, normalizePanelTimes]);

  const exportCSV = useCallback(() => {
    // Build a single-sheet CSV that mirrors the on-screen layout:
    // - Row 1: [Day, SW, CE, SE, NE, NW, MT, UT]
    // - Next 12: time rows
    // - Blank row
    // - Rosters headers under columns B..(B+rosters-1)
    // - Roster rows below
    // - Blank row
    // - STABILIZER header in columns [MT, UT], then its rows
    // - RELIEF header below, then its rows
    // - TELETYPE header below, then its rows

    const cols = doc.grid.headers.length; // includes Time + 7 channels
    const emptyRow = () => new Array(cols).fill('');
    const rows: string[][] = [];

    // Top grid
    rows.push(doc.grid.headers);
    rows.push(...doc.grid.rows);

    // Spacer
    rows.push(emptyRow());

    // Rosters header aligned to columns B..(B+n-1)
    const rosterStartCol = 1; // after Time column
    const rosterCols = doc.rosters.headers.length;
    const rosterHeaderRow = emptyRow();
    for (let i = 0; i < rosterCols; i++) rosterHeaderRow[rosterStartCol + i] = doc.rosters.headers[i];
    rows.push(rosterHeaderRow);

    // Roster body (ensure at least 20 rows like the sheet)
    const rosterRowCount = Math.max(20, doc.rosters.rows.length);
    for (let r = 0; r < rosterRowCount; r++) {
      const row = emptyRow();
      for (let c = 0; c < rosterCols; c++) row[rosterStartCol + c] = doc.rosters.rows[r]?.[c] ?? '';
      rows.push(row);
    }

    // Right-side start column = MT index (last two columns)
    let startRight = Math.max(0, cols - 2);

    // STABILIZER
    rows.push(emptyRow());
    const stabHeader = emptyRow();
    // If stabilizer needs two names, we may require an extra CSV column.
    // Expand the row to fit three cells when necessary.
    if (doc.stabilizer.headers.length >= 3 && startRight + 2 >= cols) {
      // expand the sheet width by one column
      startRight = cols - 2; // start stays the same
    }
    while (stabHeader.length <= startRight + 2) stabHeader.push('');
    stabHeader[startRight] = 'STABILIZER';
    rows.push(stabHeader);
    for (const one of doc.stabilizer.rows) {
      const r = emptyRow();
      while (r.length <= startRight + 2) r.push('');
      r[startRight] = one[0] ?? '';
      r[startRight + 1] = one[1] ?? '';
      r[startRight + 2] = one[2] ?? '';
      rows.push(r);
    }

    // RELIEF
    rows.push(emptyRow());
    const relHeader = emptyRow();
    relHeader[startRight] = 'RELIEF';
    rows.push(relHeader);
    for (const [time, name] of doc.relief.rows) {
      const r = emptyRow();
      r[startRight] = time;
      r[startRight + 1] = name || '';
      rows.push(r);
    }

    // TELETYPE
    rows.push(emptyRow());
    const telHeader = emptyRow();
    while (telHeader.length <= startRight + 1) telHeader.push('');
    telHeader[startRight] = 'TELETYPE';
    rows.push(telHeader);
    for (const [time, name] of doc.teletype.rows) {
      const r = emptyRow();
      while (r.length <= startRight + 1) r.push('');
      r[startRight] = time;
      r[startRight + 1] = name || '';
      rows.push(r);
    }

    const csv = rows.map((r) => r.map(csvQuote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-detail-${day}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [doc, day]);

  const exportPDF = useCallback(async () => {
    const { default: JsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const pdf: jsPDF = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const margin = 12; // slight margin reduction to widen columns
    const pageWidth = pdf.internal.pageSize.getWidth();
    const available = pageWidth - margin * 2;

    // Compute widths: Time + columns to align all sub-tables
    const timeCol = 58; // give a bit more width to channel columns
    const channelCount = doc.grid.headers.length - 1;
    const channelCol = Math.max(60, Math.floor((available - timeCol) / channelCount) - 1);

    // Top grid
    autoTable(pdf, {
      startY: 20,
      margin: { left: margin, right: margin },
      head: [doc.grid.headers],
      body: doc.grid.rows,
      styles: { fontSize: 9, halign: 'center', valign: 'middle', cellPadding: 2, lineWidth: 0.6, lineColor: [60, 60, 60], overflow: 'ellipsize' },
      headStyles: { fontStyle: 'bold', fontSize: 10, fillColor: [230, 230, 230], textColor: 20, overflow: 'ellipsize' },
      columnStyles: Object.fromEntries(
        doc.grid.headers.map((_, idx) => [idx, { cellWidth: idx === 0 ? timeCol : channelCol, fontSize: 10 }])
      ) as Record<number, { cellWidth: number; fontSize: number }>,
      tableWidth: timeCol + channelCol * channelCount,
      theme: 'grid',
      didParseCell: (data: CellHookData) => {
        const { cell, row, column, section } = data;
        if (section !== 'body') return;
        const mtIndex = doc.grid.headers.indexOf('MT');
        if (mtIndex <= 0) return; // 0 is Time column
        if (column.index !== mtIndex) return;
        const slot = doc.grid.rows[row.index]?.[0] as TimeSlot | undefined;
        if (!slot) return;
        if (isCellDisabled(day, slot, 'MT')) {
          cell.styles.fillColor = [0, 0, 0];
          cell.styles.textColor = [255, 255, 255];
        }
      },
    });

    type PdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };
    const pdfWithAutoTable = pdf as PdfWithAutoTable;
    const endGridY = pdfWithAutoTable.lastAutoTable?.finalY ?? 48;
    const colX = (idx: number) => margin + timeCol + idx * channelCol; // idx over channel columns (0..6)

    // Rosters (A/B/C/E) under columns B..E
    const rosterLeft = colX(0);
    const rosterWidth = channelCol * doc.rosters.headers.length;
    const rosterColumnStyles = doc.rosters.headers.reduce<Record<number, Partial<Styles>>>((acc, _, index) => {
      acc[index] = { cellWidth: channelCol };
      return acc;
    }, {});
    autoTable(pdf, {
      startY: endGridY + 8,
      margin: { left: rosterLeft, right: margin },
      tableWidth: rosterWidth,
      head: [doc.rosters.headers],
      body: (doc.rosters.rows.length ? doc.rosters.rows : [['']]).map(r => r.length === doc.rosters.headers.length ? r : [...r, ...Array(doc.rosters.headers.length - r.length).fill('')]),
      styles: { fontSize: 9, halign: 'left', valign: 'middle', cellPadding: 2, lineWidth: 0.6, lineColor: [60,60,60] },
      bodyStyles: { overflow: 'linebreak' },
      headStyles: { fontStyle: 'bold', fontSize: 10, fillColor: [230,230,230], textColor: 20, halign: 'center', overflow: 'ellipsize' },
      columnStyles: rosterColumnStyles,
      theme: 'grid',
    });

    // Right panels (STABILIZER, RELIEF, TELETYPE) across columns MT..UT area
    const rightLeft = colX(doc.rosters.headers.length) + 8; // small gutter between rosters and stabilizer
    const rightWidth = channelCol * 2;
    // STABILIZER: time + two names -> 3 internal columns inside 2-channel width
    const stabTime = Math.round(rightWidth * 0.28);
    const stabName1 = Math.round(rightWidth * 0.36);
    const stabName2 = rightWidth - stabTime - stabName1;
    const stabilizerHead: RowInput = [{ content: 'STABILIZER', colSpan: 3 }];
    const stabilizerColumnStyles: Record<number, Partial<Styles>> = {
      0: { cellWidth: stabTime },
      1: { cellWidth: stabName1 },
      2: { cellWidth: stabName2 },
    };
    autoTable(pdf, {
      startY: endGridY + 8,
      margin: { left: rightLeft, right: margin },
      tableWidth: rightWidth,
      head: [stabilizerHead],
      body: doc.stabilizer.rows.length ? doc.stabilizer.rows : [['', '', '']],
      styles: { fontSize: 9, cellPadding: 4, halign: 'left', valign: 'middle', lineWidth: 0.6, lineColor: [60,60,60], overflow: 'ellipsize' },
      headStyles: { fontStyle: 'bold', fontSize: 10, fillColor: [230,230,230], textColor: 20, halign: 'center', overflow: 'ellipsize' },
      columnStyles: stabilizerColumnStyles,
      theme: 'grid',
    });
    const endStabY = pdfWithAutoTable.lastAutoTable?.finalY ?? endGridY + 8;
    // RELIEF: time + one wide name column
    const relTime = Math.round(rightWidth * 0.32);
    const relName = rightWidth - relTime;
    const reliefHead: RowInput = [{ content: 'RELIEF', colSpan: 2 }];
    const reliefColumnStyles: Record<number, Partial<Styles>> = {
      0: { cellWidth: relTime },
      1: { cellWidth: relName },
    };
    autoTable(pdf, {
      startY: endStabY + 6,
      margin: { left: rightLeft, right: margin },
      tableWidth: rightWidth,
      head: [reliefHead],
      body: doc.relief.rows.length ? doc.relief.rows : [['', '']],
      styles: { fontSize: 9, cellPadding: 4, halign: 'left', valign: 'middle', lineWidth: 0.6, lineColor: [60,60,60], overflow: 'ellipsize' },
      headStyles: { fontStyle: 'bold', fontSize: 10, fillColor: [230,230,230], textColor: 20, halign: 'center', overflow: 'ellipsize' },
      columnStyles: reliefColumnStyles,
      theme: 'grid',
    });
    const endReliefY = pdfWithAutoTable.lastAutoTable?.finalY ?? endStabY + 6;
    // TELETYPE: time + one wide name column
    const telTime = Math.round(rightWidth * 0.38);
    const telName = rightWidth - telTime;
    const teletypeHead: RowInput = [{ content: 'TELETYPE', colSpan: 2 }];
    const teletypeColumnStyles: Record<number, Partial<Styles>> = {
      0: { cellWidth: telTime },
      1: { cellWidth: telName },
    };
    autoTable(pdf, {
      startY: endReliefY + 6,
      margin: { left: rightLeft, right: margin },
      tableWidth: rightWidth,
      head: [teletypeHead],
      body: doc.teletype.rows.length ? doc.teletype.rows : [['', '']],
      styles: { fontSize: 9, cellPadding: 4, halign: 'left', valign: 'middle', lineWidth: 0.6, lineColor: [60,60,60], overflow: 'ellipsize' },
      headStyles: { fontStyle: 'bold', fontSize: 10, fillColor: [230,230,230], textColor: 20, halign: 'center', overflow: 'ellipsize' },
      columnStyles: teletypeColumnStyles,
      theme: 'grid',
    });

    pdf.save(`daily-detail-${day}.pdf`);
  }, [doc, day]);

  const doPrint = useCallback(() => {
    window.print();
  }, []);

  useImperativeHandle(ref, () => ({
    generateFromSchedule,
    exportCSV,
    exportPDF,
    print: doPrint,
  }));

  // Memoize a function for cell class to black-out disabled MT cells in the main grid
  const mainCellClass = useCallback((r: number, c: number) => {
    if (c === 0) return undefined;
    const mtIndex = doc.grid.headers.indexOf('MT');
    if (c !== mtIndex) return undefined;
    const slot = doc.grid.rows[r]?.[0] as TimeSlot | undefined;
    if (!slot) return undefined;
    return isCellDisabled(day, slot, 'MT') ? 'disabled-mt' : undefined;
  }, [doc.grid.headers, doc.grid.rows, day]);

  // Provide width hints so multi-table layout lines up by pixels when possible.
  // timeCol ~70px; remaining columns share remaining space by CSS; here we hint but
  // keep CSS as the ultimate source of truth when container resizes.
  const colWidthsPx = useMemo(() => {
    // Only set first column width; others auto by CSS
    return [96, ...Array.from({ length: doc.grid.headers.length - 1 }, () => 0)];
  }, [doc.grid.headers.length]);

  return (
    <div className="daily-detail">
      <div className="detail-note">
        Edits here are independent of the scheduler. Use “Generate from Schedule” to refresh.
      </div>
      <div className="detail-layout">
        <div className="detail-grid">
          <SheetGrid
            id="main"
            headers={doc.grid.headers}
            rows={doc.grid.rows}
            readOnlyCols={new Set([0])}
            onChange={setGridCell}
            cellClassName={mainCellClass}
            className="detail-table detail-grid-table"
            colWidthsPx={colWidthsPx}
            renderCell={(r, c, value, change) => {
              if (c === 0) return <span>{value}</span>;
              const col = doc.grid.headers[c] as Column;
              const slot = doc.grid.rows[r]?.[0] as TimeSlot;
              const disabled = col === 'MT' && isCellDisabled(day, slot, 'MT');
              return (
                <DispatcherDropdown
                  value={value || ''}
                  dispatchers={dispatchers}
                  onChange={(v) => change(v)}
                  day={day}
                  timeSlot={slot}
                  column={col}
                  disabled={disabled}
                />
              );
            }}
          />
        </div>
        <div className="detail-sections">
          <div className="detail-rosters">
            <SheetGrid
              id="rosters"
              headers={doc.rosters.headers}
              rows={Array.from({ length: Math.max(20, doc.rosters.rows.length) }).map((_, i) => (
                doc.rosters.rows[i] ?? new Array(doc.rosters.headers.length).fill('')
              ))}
              onChange={setRosterCell}
              className="detail-table detail-roster-table"
              renderCell={(_, __, value, change) => (
                <DispatcherDropdown
                  value={value || ''}
                  dispatchers={dispatchers}
                  onChange={(v) => change(v)}
                />
              )}
            />
          </div>
          <div className="detail-side">
            <table className="detail-table detail-panel-table detail-panel-table--stabilizer">
              <thead>
                <tr>
                  <th colSpan={3}>STABILIZER</th>
                </tr>
              </thead>
              <tbody>
                {doc.stabilizer.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r[0]}</td>
                    <td>
                      <DispatcherDropdown
                        value={r[1] || ''}
                        dispatchers={dispatchers}
                        onChange={(v) => setPanelCell('stabilizer', i, 1, v)}
                      />
                    </td>
                    <td>
                      <DispatcherDropdown
                        value={r[2] || ''}
                        dispatchers={dispatchers}
                        onChange={(v) => setPanelCell('stabilizer', i, 2, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="detail-table detail-panel-table detail-panel-table--relief">
              <thead>
                <tr>
                  <th colSpan={2}>RELIEF</th>
                </tr>
              </thead>
              <tbody>
                {doc.relief.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r[0]}</td>
                    <td>
                      <DispatcherDropdown
                        value={r[1] || ''}
                        dispatchers={dispatchers}
                        onChange={(v) => setPanelCell('relief', i, 1, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="detail-table detail-panel-table detail-panel-table--teletype">
              <thead>
                <tr>
                  <th colSpan={2}>TELETYPE</th>
                </tr>
              </thead>
              <tbody>
                {doc.teletype.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r[0]}</td>
                    <td>
                      <DispatcherDropdown
                        value={r[1] || ''}
                        dispatchers={dispatchers}
                        onChange={(v) => setPanelCell('teletype', i, 1, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DailyDetailSheet;
