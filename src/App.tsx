import { useState, useEffect } from 'react';
import './styles/App.css';
import './styles/layout.css';
import './styles/manage-dispatchers.css';
import { days, Day, Schedule } from './constants';

import { ExtendedDispatcher } from './types';
import ManageDispatchers from './components/ManageDispatchers';
import ScheduleTable from './components/ScheduleTable';
import { loadSchedule, saveSchedule, loadDispatchers, saveDispatchers, createEmptySchedule } from './scheduleUtils';
import { generateWeeklySchedule } from './solver/weekScheduler';

function App() {
  const [schedule, setSchedule] = useState<Schedule>(() => loadSchedule());
  const [selectedDay, setSelectedDay] = useState<Day>('Monday');
  const [dispatchers, setDispatchers] = useState<ExtendedDispatcher[]>([]);
  const [showDispatchersPage, setShowDispatchersPage] = useState(false);
  const [solving, setSolving] = useState(false);
  const [dispatchersLoaded, setDispatchersLoaded] = useState(false);

  // Load dispatchers on mount
  useEffect(() => {
    const loadDispatchersAsync = async () => {
      const loadedDispatchers = await loadDispatchers();
      setDispatchers(loadedDispatchers as ExtendedDispatcher[]);
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

  const handleChange = (
    day: Day,
    time: keyof Schedule[Day],
    column: keyof Schedule[Day][keyof Schedule[Day]],
    value: string,
  ) => {
    setSchedule((prev) => ({
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
          <button onClick={() => setSchedule(createEmptySchedule())}>
            Reset Schedule
          </button>
          <button disabled={solving} onClick={async () => {
            setSolving(true);
            const newSched = await generateWeeklySchedule(schedule, dispatchers);
            setSchedule(newSched);
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
        />
      )}
    </div>
  );
}

export default App
