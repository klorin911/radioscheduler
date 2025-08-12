import { useState, useEffect, useCallback, useRef } from 'react';
import './styles/App.css';
import './styles/layout.css';
import './styles/manage-dispatchers.css';
import { days, Day, Schedule, TimeSlot, Column, columns, timeSlots } from './constants';

import { ExtendedDispatcher } from './types';
import ManageDispatchers from './components/ManageDispatchers';
import ScheduleTable from './components/ScheduleTable';
import { loadSchedule, saveSchedule, loadDispatchers, saveDispatchers, createEmptySchedule } from './scheduleUtils';
import { generateWeeklySchedule } from './solver/weekScheduler';
import { countSlotsPerDispatcher } from './solver/utils/scheduleUtils';

const MAX_HISTORY = 50;

// --- Utilities ---
const pad2 = (n: number) => String(n).padStart(2, '0');
const timestampedFileName = (prefix: string, ext: 'csv' | 'pdf') => {
  const ts = new Date();
  return `${prefix}-${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}-${pad2(ts.getHours())}${pad2(ts.getMinutes())}.${ext}`;
};

function App() {
  const [schedule, setSchedule] = useState<Schedule>(() => loadSchedule());
  const [selectedDay, setSelectedDay] = useState<Day>('Monday');
  const [dispatchers, setDispatchers] = useState<ExtendedDispatcher[]>([]);
  const [showDispatchersPage, setShowDispatchersPage] = useState(false);
  const [solving, setSolving] = useState(false);
  const [dispatchersLoaded, setDispatchersLoaded] = useState(false);
  const [slotCounts, setSlotCounts] = useState<Record<Day, Record<string, number>>>(
    () => Object.fromEntries(days.map((d) => [d, {}])) as Record<Day, Record<string, number>>
  );
  const [history, setHistory] = useState<Schedule[]>([]);
  const scheduleRef = useRef(schedule);

  const applyScheduleUpdate = (producer: (prev: Schedule) => Schedule) => {
    setSchedule((prev) => {
      setHistory((h) => [prev, ...h].slice(0, MAX_HISTORY));
      return producer(prev);
    });
  };

  // --- Export to CSV helpers ---
  const buildCSVForWeek = useCallback((sched: Schedule): string => {
    const csvQuote = (val: string) => '"' + (val ?? '').replace(/"/g, '""') + '"';
    // Day-separated blocks. For each day:
    //  - Row 1: headers with Day name in the top-left cell (e.g., [Monday, SW, CE, ...])
    //  - Rows : first column are times, followed by assignments
    //  - Blank line between days for a clean break
    const lines: string[] = [];
    days.forEach((d, idx) => {
      if (idx > 0) lines.push(''); // separator blank line
      // Header row with Day in A1
      const dayHeader = [d, ...columns];
      lines.push(dayHeader.map(csvQuote).join(','));
      // Data rows
      timeSlots.forEach((slot) => {
        const row = [slot, ...columns.map((c) => sched[d][slot][c] || '')];
        lines.push(row.map(csvQuote).join(','));
      });
    });
    return lines.join('\n');
  }, []);

  // Removed single-day CSV export builder

  const downloadCSV = (fileName: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportWeek = useCallback(() => {
    const csv = buildCSVForWeek(scheduleRef.current);
    const file = timestampedFileName('radioschedule-week', 'csv');
    downloadCSV(file, csv);
  }, [buildCSVForWeek]);

  // Removed single-day CSV export handler

  // --- Export Week to PDF (Mon-Thu on page 1; Fri-Sun on page 2) ---
  const handleExportWeekPDF = useCallback(async () => {
    const { default: JsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth(); // ~612pt in portrait
    const margin = 10; // Minimal margins to maximize space
    const spacing = 20; // A bit more room between days

    // Exclude RELIEF column since it's always empty
    const pdfColumns = columns.filter(col => col !== 'RELIEF');

    // Optimized column width calculation for portrait
    const available = pageWidth - margin * 2; // ~588pt available
    const timeCol = 60; // Narrowest practical time column
    const channelCount = pdfColumns.length; // 7 columns (excluding RELIEF)
    const restWidth = available - timeCol;
    const channelCol = Math.max(60, Math.floor(restWidth / channelCount) - 1);
    const totalWidth = timeCol + channelCol * channelCount;

    const makeDayTable = (day: Day, startY: number) => {
      // Day title centered above table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const title = String(day);
      const titleWidth = doc.getTextWidth(title);
      doc.text(title, margin + (available - titleWidth) / 2, startY);

      // Create table body with current schedule data (excluding RELIEF)
      const tableBody = timeSlots.map((slot) => [
        slot,
        ...pdfColumns.map((c) => scheduleRef.current[day][slot][c] || ''),
      ]);

      autoTable(doc, {
        startY: startY + 17, // Accommodate larger title
        margin: { left: margin, right: margin },
        head: [['Time', ...pdfColumns]],
        body: tableBody,
        styles: {
          halign: 'center',
          valign: 'middle',
          fontSize: 8,
          cellPadding: 1,
          lineWidth: 0.3,
          lineColor: [180, 180, 180],
          overflow: 'linebreak',
        },
        headStyles: {
          halign: 'center',
          fillColor: [235, 235, 235],
          textColor: 20,
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: Object.fromEntries(
          [0, ...pdfColumns.map((_, i) => i + 1)].map((idx) => [
            idx,
            { cellWidth: idx === 0 ? timeCol : channelCol, fontSize: 8 },
          ])
        ) as Record<number, { cellWidth: number; fontSize: number }>,
        tableWidth: totalWidth,
        theme: 'grid',
        showHead: true,
      });

      const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 22;
      return lastY + spacing;
    };

    let y = 40; // Start with a top margin
    // First 4 days on page 1
    days.slice(0, 4).forEach((d) => {
      y = makeDayTable(d, y);
    });

    // New page for remaining 3 days
    doc.addPage();
    y = 40; // Reset Y for new page with top margin
    days.slice(4).forEach((d) => {
      y = makeDayTable(d, y);
    });

    const file = timestampedFileName('radioschedule-week', 'pdf');
    doc.save(file);
  }, []);

  const undoLast = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const [prev, ...rest] = h;
      setSchedule(prev);
      return rest;
    });
  };

  // Normalize loaded dispatchers (badge string -> number, wantsExtraRadio -> minimumRadioOnly, defaults)
  type LegacyDispatcher = Omit<ExtendedDispatcher, 'badgeNumber' | 'minimumRadioOnly'> & {
    badgeNumber?: number | string;
    wantsExtraRadio?: boolean;
    minimumRadioOnly?: boolean;
  };

  const normalizeDispatcher = useCallback((d: LegacyDispatcher): ExtendedDispatcher => {
    const copy: LegacyDispatcher = { ...d };
    // Normalize badgeNumber from strings like "D3045" or numeric strings
    if (typeof copy.badgeNumber === 'string') {
      const m = copy.badgeNumber.match(/\d+/);
      copy.badgeNumber = m ? parseInt(m[0], 10) : undefined;
    }
    // Map legacy wantsExtraRadio to minimumRadioOnly (default extra radio)
    if (typeof copy.wantsExtraRadio === 'boolean') {
      if (copy.wantsExtraRadio === false) copy.minimumRadioOnly = true;
      if (copy.wantsExtraRadio === true && typeof copy.minimumRadioOnly !== 'boolean') copy.minimumRadioOnly = false;
      delete copy.wantsExtraRadio;
    }
    if (typeof copy.minimumRadioOnly !== 'boolean') copy.minimumRadioOnly = false;
    // Defensive: if not a trainee, ensure trainee linkage fields are cleared
    if (copy.isTrainee !== true) {
      copy.traineeOf = undefined;
      copy.followTrainerSchedule = false;
    }
    return copy as ExtendedDispatcher;
  }, []);

  // Compute and normalize seniority ranks (1 = most senior).
  // - Preserves CSV/manual seniority values when unique
  // - Resolves duplicates deterministically by bumping to next available number
  // - Assigns missing seniority sequentially after the max used value
  // Does not reorder the returned list; only updates the `seniority` field where needed.
  const computeSeniority = useCallback((list: ExtendedDispatcher[]): ExtendedDispatcher[] => {
    if (!Array.isArray(list) || list.length === 0) return list;

    const numBadge = (d: ExtendedDispatcher): number => {
      const raw = d.badgeNumber;
      if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
      // Fallback: extract digits from ID if present
      const idm = String(d.id || '').match(/\d+/);
      return idm ? parseInt(idm[0], 10) : Number.POSITIVE_INFINITY;
    };

    const senVal = (d: ExtendedDispatcher): number => {
      const s = d.seniority;
      return typeof s === 'number' && !Number.isNaN(s) ? s : Number.POSITIVE_INFINITY;
    };

    // Stable order for dedupe: by existing seniority asc, then badge asc, then id
    const ordered = [...list].sort((a, b) => {
      const sa = senVal(a), sb = senVal(b);
      if (sa !== sb) return sa - sb;
      const ba = numBadge(a), bb = numBadge(b);
      if (ba !== bb) return ba - bb;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    // Determine starting point for filling in new numbers
    let maxSeen = 0;
    for (const d of ordered) {
      const s = d.seniority;
      if (typeof s === 'number' && !Number.isNaN(s) && s > maxSeen) maxSeen = s;
    }
    const used = new Set<number>();
    let next = maxSeen + 1;

    // Compute new seniority assignments without mutating original list
    const newSenById = new Map<string, number>();
    for (const d of ordered) {
      const s = d.seniority;
      if (typeof s === 'number' && !Number.isNaN(s)) {
        // Keep if unique; otherwise bump to next available
        let target = s;
        while (used.has(target)) target++;
        used.add(target);
        if (target !== s) newSenById.set(d.id, target);
      } else {
        // Missing seniority: assign sequentially after max
        while (used.has(next)) next++;
        newSenById.set(d.id, next);
        used.add(next);
        next++;
      }
    }

    // Apply changes in original order only where needed
    let changed = false;
    const result = list.map((d) => {
      const assigned = newSenById.get(d.id);
      if (assigned == null) return d;
      const current = d.seniority;
      if (current !== assigned) {
        changed = true;
        return { ...d, seniority: assigned } as ExtendedDispatcher;
      }
      return d;
    });
    return changed ? result : list;
  }, []);

  // Load dispatchers on mount
  useEffect(() => {
    const loadDispatchersAsync = async () => {
      const loadedDispatchers = await loadDispatchers();
      const normalized = (loadedDispatchers || []).map(normalizeDispatcher) as ExtendedDispatcher[];
      const ranked = computeSeniority(normalized);
      setDispatchers(ranked);
      setDispatchersLoaded(true);
    };
    loadDispatchersAsync();
  }, [normalizeDispatcher, computeSeniority]);

  // Save schedule 
  useEffect(() => {
    saveSchedule(schedule);
  }, [schedule]);

  // Keep a ref of the latest schedule for stable export callbacks
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  // Save dispatchers (only after initial load to prevent overwriting)
  useEffect(() => {
    if (dispatchersLoaded) {
      saveDispatchers(dispatchers);
    }
  }, [dispatchers, dispatchersLoaded]);

  // Keep seniority updated whenever dispatchers change (e.g., badge edits, add/remove)
  useEffect(() => {
    if (!dispatchersLoaded || dispatchers.length === 0) return;
    const ranked = computeSeniority(dispatchers);
    // Only update state if something changed (computeSeniority returns same array if no change)
    if (ranked !== dispatchers) {
      setDispatchers(ranked);
    }
  }, [dispatchers, dispatchersLoaded, computeSeniority]);

  // Calculate slot counts when schedule or dispatchers change
  useEffect(() => {
    if (dispatchers.length > 0) {
      const newCounts = {} as Record<Day, Record<string, number>>;
      days.forEach((day) => {
        newCounts[day] = countSlotsPerDispatcher(schedule[day], dispatchers);
      });
      setSlotCounts(newCounts);
    }
  }, [schedule, dispatchers]);

  // Listen for menu events from main
  useEffect(() => {
    const onExportCSV = () => {
      handleExportWeek();
    };
    const onExportPDF = () => {
      handleExportWeekPDF();
    };
    
    window.ipcRenderer?.on('menu:export-csv', onExportCSV);
    window.ipcRenderer?.on('menu:export-pdf', onExportPDF);
    
    return () => {
      window.ipcRenderer?.off('menu:export-csv', onExportCSV);
      window.ipcRenderer?.off('menu:export-pdf', onExportPDF);
    };
  }, [handleExportWeek, handleExportWeekPDF]);

  const handleChange = (
    day: Day,
    time: TimeSlot,
    column: Column,
    value: string,
  ) => {
    // Always apply the change. Validation is visual (red/yellow) in ScheduleTable.getCellStatus().
    applyScheduleUpdate((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [time]: {
          ...prev[day][time],
          [column]: value,
        },
      },
    }));
  };

  return (
    <div className="app">
      <h1>Radio Scheduler</h1>
      <button onClick={() => setShowDispatchersPage((v) => !v)}>
        {showDispatchersPage ? 'Back to Schedule' : 'Manage Dispatchers'}
      </button>
      {!showDispatchersPage && (
        <>
          <button onClick={() => applyScheduleUpdate(() => createEmptySchedule())}>
            Reset Schedule
          </button>
          <button disabled={history.length === 0} onClick={undoLast}>
            Undo
          </button>
          <button disabled={solving} onClick={async () => {
            setSolving(true);
            const newSched = await generateWeeklySchedule(schedule, dispatchers);
            applyScheduleUpdate(() => newSched);
            setSolving(false);
          }}>
            {solving ? 'Generating...' : 'Auto Schedule'}
          </button>

        </>
      )}

      <div className="day-tabs">
        {!showDispatchersPage &&
          days.map((d) => (
          <button
            key={d}
            className={d === selectedDay ? 'active' : ''}
            onClick={() => setSelectedDay(d)}
          >
            {d}
          </button>
        ))}
      </div>

      {showDispatchersPage ? (
        <ManageDispatchers
          dispatchers={dispatchers}
          onChange={setDispatchers}
        />
      ) : (
        <ScheduleTable
          day={selectedDay}
          schedule={schedule}
          dispatchers={dispatchers}
          onChange={handleChange}
          slotCounts={slotCounts[selectedDay] || {}}
        />
      )}
    </div>
  );
}

export default App
