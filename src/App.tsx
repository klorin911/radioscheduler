import { useState, useEffect } from 'react';
import './styles/App.css';
import './styles/layout.css';
import './styles/manage-dispatchers.css';
import { days, Day, Schedule, TimeSlot, Column } from './constants';

import { ExtendedDispatcher } from './types';
import ManageDispatchers from './components/ManageDispatchers';
import ScheduleTable from './components/ScheduleTable';
import { loadSchedule, saveSchedule, loadDispatchers, saveDispatchers, createEmptySchedule } from './scheduleUtils';
import { generateWeeklySchedule } from './solver/weekScheduler';
import { countSlotsPerDispatcher } from './solver/utils/scheduleUtils';
import { isSlotInShift } from './solver/utils/shiftUtils';

const MAX_HISTORY = 50;

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

  const applyScheduleUpdate = (producer: (prev: Schedule) => Schedule) => {
    setSchedule((prev) => {
      setHistory((h) => [prev, ...h].slice(0, MAX_HISTORY));
      return producer(prev);
    });
  };

  const undoLast = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const [prev, ...rest] = h;
      setSchedule(prev);
      return rest;
    });
  };

  // Normalize loaded dispatchers (badge string -> number, wantsExtraRadio -> minimumRadioOnly, defaults)
  const normalizeDispatcher = (d: any): ExtendedDispatcher => {
    const copy: any = { ...d };
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
    return copy as ExtendedDispatcher;
  };

  // Load dispatchers on mount
  useEffect(() => {
    const loadDispatchersAsync = async () => {
      const loadedDispatchers = await loadDispatchers();
      const normalized = (loadedDispatchers || []).map(normalizeDispatcher);
      setDispatchers(normalized as ExtendedDispatcher[]);
      setDispatchersLoaded(true);
    };
    loadDispatchersAsync();
  }, []);

  // Save schedule 
  useEffect(() => {
    saveSchedule(schedule);
  }, [schedule]);

  // Save dispatchers (only after initial load to prevent overwriting)
  useEffect(() => {
    if (dispatchersLoaded) {
      saveDispatchers(dispatchers);
    }
  }, [dispatchers, dispatchersLoaded]);

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

  const handleChange = (
    day: Day,
    time: keyof Schedule[Day],
    column: keyof Schedule[Day][keyof Schedule[Day]],
    value: string,
  ) => {
    // Allow clearing always
    if (!value) {
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
      return;
    }

    const timeSlot = time as TimeSlot;
    const col = column as Column;

    // Resolve participants from label(s) (supports "TRAINER/TRAINEE")
    const parts = value.includes('/') ? value.split('/').map(s => s.trim()).filter(Boolean) : [value.trim()];
    const findByLabel = (label: string) => dispatchers.find(d => d.id === label || d.name === label);
    const participants = parts.map(findByLabel).filter((d): d is ExtendedDispatcher => !!d);

    // Basic sanity: unknown label -> allow write so user can correct; no hard crash
    if (participants.length === 0) {
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
      return;
    }

    // 1) Prevent duplicate assignment in the same time slot across columns
    const row = schedule[day][timeSlot];
    const isDup = participants.some((p) => {
      const key = p.name || p.id;
      return Object.entries(row).some(([c, cell]) => {
        if (c === (col as string)) return false; // ignore current cell
        if (!cell) return false;
        const cells = cell.split('/').map(s => s.trim()).filter(Boolean);
        return cells.includes(key);
      });
    });
    if (isDup) {
      window.alert('Duplicate assignment: This person is already assigned in this time slot.');
      return;
    }

    // 2) Prevent assigning on non-work days or outside shift hours
    const trainer = participants[0];
    const trainee = participants.length > 1 ? participants[1] : undefined;
    const violatesDayOrShift = participants.some((person) => {
      // Effective work days (trainee may follow trainer)
      let effectiveDays = person.workDays;
      if (person === trainee && person.followTrainerSchedule && trainer) {
        effectiveDays = trainer.workDays;
      }
      const dayOk = !effectiveDays || effectiveDays.length === 0 || effectiveDays.includes(day);

      // Effective shift
      let shiftOk = true;
      if (person === trainee && person.followTrainerSchedule && trainer && trainer.shift) {
        shiftOk = isSlotInShift({ ...person, shift: trainer.shift }, timeSlot);
      } else {
        shiftOk = isSlotInShift(person, timeSlot);
      }

      return !(dayOk && shiftOk);
    });
    if (violatesDayOrShift) {
      window.alert('Invalid assignment: Person does not work this day or this time is outside their shift.');
      return;
    }

    // Passed validation: apply change
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
