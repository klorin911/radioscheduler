import { useState, useEffect, useCallback, useRef } from 'react';
import './styles/App.css';
import './styles/layout.css';
import './styles/manage-dispatchers.css';
import { days, Day, Schedule, TimeSlot, Column } from './constants';

import { ExtendedDispatcher } from './appTypes';
import ManageDispatchers from './components/ManageDispatchers';
import ScheduleTable from './components/ScheduleTable';
import DailyDetailSheet from './components/DailyDetailSheet';
import { loadSchedule, saveSchedule, loadDispatchers, saveDispatchers, createEmptySchedule, loadDailyDetail, type DailyDetailDoc } from './appStorage';
import { buildDailyDetailDoc } from './utils/dailyDetail';
import { generateWeeklySchedule } from './solver/weekScheduler';
import { countSlotsPerDispatcher } from './solver/utils/scheduleOps';

const MAX_HISTORY = 50;
type AppView = 'scheduler' | 'detail' | 'dispatchers';

// =============================
// Utilities
// =============================
const defaultWorkbookTitle = () => {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  return `RADIO SCHEDULE ${month} ${now.getFullYear()}`;
};

const isDailyDetailDoc = (value: unknown): value is DailyDetailDoc => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DailyDetailDoc>;
  return !!candidate.grid && !!candidate.rosters && !!candidate.stabilizer && !!candidate.relief && !!candidate.teletype;
};

const normalizeDailyDetailDoc = (doc: DailyDetailDoc): DailyDetailDoc => {
  let next = doc;
  if (next.rosters && !next.rosters.headers.includes('F SHIFT')) {
    next = {
      ...next,
      rosters: {
        headers: [...next.rosters.headers, 'F SHIFT'],
        rows: (next.rosters.rows || []).map((row) => [...row, '']),
      },
    };
  }
  if ((next.stabilizer?.headers?.length ?? 0) < 3) {
    next = {
      ...next,
      stabilizer: {
        headers: ['STABILIZER', '', ''],
        rows: (next.stabilizer?.rows || []).map((row) => [row[0] ?? '', row[1] ?? '', '']),
      },
    };
  }
  if ((next.teletype?.headers?.length ?? 0) < 2) {
    next = {
      ...next,
      teletype: {
        headers: ['TELETYPE', ''],
        rows: (next.teletype?.rows || []).map((row) => [row[0] ?? '', '']),
      },
    };
  }
  return next;
};

function App() {
  // =============================
  // State
  // =============================
  const [schedule, setSchedule] = useState<Schedule>(() => loadSchedule());
  const [selectedDay, setSelectedDay] = useState<Day>('Monday');
  const [dispatchers, setDispatchers] = useState<ExtendedDispatcher[]>([]);
  const [appView, setAppView] = useState<AppView>('scheduler');
  const [solving, setSolving] = useState(false);
  const [workbookPromptOpen, setWorkbookPromptOpen] = useState(false);
  const [workbookTitle, setWorkbookTitle] = useState(() => defaultWorkbookTitle());
  const [workbookExporting, setWorkbookExporting] = useState(false);
  const [workbookExportError, setWorkbookExportError] = useState<string | null>(null);
  const [dispatchersLoaded, setDispatchersLoaded] = useState(false);
  const [slotCounts, setSlotCounts] = useState<Record<Day, Record<string, number>>>(
    () => Object.fromEntries(days.map((d) => [d, {}])) as Record<Day, Record<string, number>>
  );
  const [history, setHistory] = useState<Schedule[]>([]);
  const scheduleRef = useRef(schedule);

  // =============================
  // Schedule state helpers
  // =============================
  const applyScheduleUpdate = (producer: (prev: Schedule) => Schedule) => {
    setSchedule((prev) => {
      setHistory((h) => [prev, ...h].slice(0, MAX_HISTORY));
      return producer(prev);
    });
  };

  const handleExportWeekWorkbook = useCallback(() => {
    setWorkbookTitle(defaultWorkbookTitle());
    setWorkbookExportError(null);
    setWorkbookPromptOpen(true);
  }, []);

  const buildWorkbookDetailPayload = useCallback(() => {
    return days.reduce((details, day) => {
      const freshFromSchedule = buildDailyDetailDoc(day, scheduleRef.current, dispatchers);
      const saved = loadDailyDetail(day);

      if (isDailyDetailDoc(saved)) {
        details[day] = normalizeDailyDetailDoc({
          ...saved,
          // Keep exported detail sheets aligned with the current radio schedule.
          // Only side-panel detail edits come from saved local detail data.
          grid: freshFromSchedule.grid,
          rosters: freshFromSchedule.rosters,
        });
        return details;
      }

      details[day] = freshFromSchedule;
      return details;
    }, {} as Partial<Record<Day, DailyDetailDoc>>);
  }, [dispatchers]);

  const confirmExportWeekWorkbook = useCallback(async () => {
    const trimmedTitle = workbookTitle.trim() || defaultWorkbookTitle();
    if (!window.scheduleExportAPI?.exportWeekWorkbook) {
      setWorkbookExportError('Excel export is not available in this build.');
      return;
    }

    setWorkbookExporting(true);
    setWorkbookExportError(null);
    try {
      const result = await window.scheduleExportAPI.exportWeekWorkbook({
        title: trimmedTitle,
        schedule: scheduleRef.current,
        dailyDetails: buildWorkbookDetailPayload(),
      });

      if (result.canceled) return;
      if (!result.success) {
        setWorkbookExportError(`Excel export failed: ${result.error || 'Unknown error'}`);
        return;
      }

      setWorkbookPromptOpen(false);
    } catch (error) {
      setWorkbookExportError(`Excel export failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setWorkbookExporting(false);
    }
  }, [buildWorkbookDetailPayload, workbookTitle]);

  // =============================
  // Undo
  // =============================
  const undoLast = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const [prev, ...rest] = h;
      setSchedule(prev);
      return rest;
    });
  }, []);

  // =============================
  // Dispatchers: normalization and seniority
  // =============================
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

  // =============================
  // Effects: load/save, refs, derived counts
  // =============================
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

  // Toggle full-width body class on dispatchers page
  useEffect(() => {
    if (appView === 'dispatchers') {
      document.body.classList.add('dispatchers-page');
    } else {
      document.body.classList.remove('dispatchers-page');
    }
    return () => {
      document.body.classList.remove('dispatchers-page');
    };
  }, [appView]);

  // Listen for menu events from main
  useEffect(() => {
    const onExportWorkbook = () => {
      void handleExportWeekWorkbook();
    };
    
    window.ipcRenderer?.on('menu:export-workbook', onExportWorkbook);
    
    return () => {
      window.ipcRenderer?.off('menu:export-workbook', onExportWorkbook);
    };
  }, [handleExportWeekWorkbook]);

  // =============================
  // Handlers
  // =============================
  const handleChange = useCallback((
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
  }, []);

  return (
    <div className="app">
      <div className="app-header">
        <nav className="mode-switch" aria-label="Primary navigation">
          <button
            type="button"
            className={appView === 'scheduler' ? 'active' : ''}
            onClick={() => setAppView('scheduler')}
          >
            Scheduler
          </button>
          <button
            type="button"
            className={appView === 'detail' ? 'active' : ''}
            onClick={() => setAppView('detail')}
          >
            Detail
          </button>
          <button
            type="button"
            className={appView === 'dispatchers' ? 'active' : ''}
            onClick={() => setAppView('dispatchers')}
          >
            Dispatchers
          </button>
        </nav>

        <div className="header-spacer" />

        <div className="header-toolbar">
          {appView === 'scheduler' && (
            <>
              <div className="toolbar-group" aria-label="Editing actions">
                <span className="toolbar-group-label">Editing</span>
                <div className="toolbar-buttons">
                  <button
                    className="btn-ghost"
                    type="button"
                    disabled={history.length === 0}
                    onClick={undoLast}
                  >
                    Undo
                  </button>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => applyScheduleUpdate(() => createEmptySchedule())}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="toolbar-group" aria-label="Automation actions">
                <span className="toolbar-group-label">Automation</span>
                <div className="toolbar-buttons">
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={solving}
                    onClick={async () => {
                      setSolving(true);
                      const newSched = await generateWeeklySchedule(schedule, dispatchers);
                      applyScheduleUpdate(() => newSched);
                      setSolving(false);
                    }}
                  >
                    {solving ? 'Generating...' : 'Auto Schedule'}
                  </button>
                </div>
              </div>

              <div className="toolbar-group" aria-label="Output actions">
                <span className="toolbar-group-label">Output</span>
                <div className="toolbar-buttons">
                  <button className="btn-primary" type="button" onClick={() => void handleExportWeekWorkbook()}>
                    Export
                  </button>
                </div>
              </div>
            </>
          )}
          {appView === 'detail' && (
            <>
              <div className="toolbar-group" aria-label="Output actions">
                <span className="toolbar-group-label">Output</span>
                <div className="toolbar-buttons">
                  <button className="btn-primary" type="button" onClick={() => void handleExportWeekWorkbook()}>
                    Export
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {workbookPromptOpen && (
        <div className="export-dialog-backdrop" role="presentation">
          <form
            className="export-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void confirmExportWeekWorkbook();
            }}
          >
            <div className="export-dialog-header">
              <h2>Export Excel Schedule</h2>
              <button
                aria-label="Close"
                className="export-dialog-close"
                disabled={workbookExporting}
                type="button"
                onClick={() => setWorkbookPromptOpen(false)}
              >
                &times;
              </button>
            </div>
            <label className="export-title-field">
              <span>Workbook title</span>
              <input
                autoFocus
                disabled={workbookExporting}
                value={workbookTitle}
                onChange={(event) => setWorkbookTitle(event.target.value)}
              />
            </label>
            {workbookExportError ? (
              <div className="export-dialog-error" role="alert">
                {workbookExportError}
              </div>
            ) : null}
            <div className="export-dialog-actions">
              <button
                className="btn-ghost"
                disabled={workbookExporting}
                type="button"
                onClick={() => setWorkbookPromptOpen(false)}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={workbookExporting} type="submit">
                {workbookExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </form>
        </div>
      )}

      {appView === 'scheduler' || appView === 'detail' ? (
        <div className="day-tabs">
          {days.map((d) => (
            <button
              key={d}
              className={d === selectedDay ? 'active' : ''}
              onClick={() => setSelectedDay(d)}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}

      {appView === 'scheduler' && (
        <ScheduleTable
          day={selectedDay}
          schedule={schedule}
          dispatchers={dispatchers}
          onChange={handleChange}
          slotCounts={slotCounts[selectedDay] || {}}
        />
      )}

      {appView === 'detail' && (
        <DailyDetailSheet
          day={selectedDay}
          schedule={schedule}
          dispatchers={dispatchers}
        />
      )}

      {appView === 'dispatchers' && (
        <ManageDispatchers
          dispatchers={dispatchers}
          onChange={setDispatchers}
        />
      )}
    </div>
  );
}

export default App;
