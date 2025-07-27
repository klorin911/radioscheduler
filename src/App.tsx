import { useState, useEffect } from 'react';
import './styles/App.css';
import './styles/layout.css';
import './styles/manage-dispatchers.css';
import { days, Day, Schedule } from './constants';
import { Dispatcher } from './types';
import ManageDispatchers from './components/ManageDispatchers';
import ScheduleTable from './components/ScheduleTable';
import { loadSchedule, saveSchedule, loadDispatchers, saveDispatchers } from './scheduleUtils';

function App() {
  const [schedule, setSchedule] = useState<Schedule>(() => loadSchedule());
  const [selectedDay, setSelectedDay] = useState<Day>('Monday');
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>(() => loadDispatchers());
  const [showDispatchersPage, setShowDispatchersPage] = useState(false);

  // Save schedule 
  useEffect(() => {
    saveSchedule(schedule);
  }, [schedule]);

  // Save dispatchers
  useEffect(() => {
    saveDispatchers(dispatchers);
  }, [dispatchers]);

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
          dispatchers={dispatchers.map((d) => d.id)}
          onChange={handleChange}
        />
      )}
    </div>
  );
}

export default App
