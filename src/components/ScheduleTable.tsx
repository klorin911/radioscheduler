import React from 'react';
import '../styles/schedule-table.css';
import { columns, timeSlots, Column, TimeSlot, Day, Schedule } from '../constants';
import { ExtendedDispatcher } from '../types';
import DispatcherDropdown from './DispatcherDropdown';
import '../styles/dispatcher-dropdown.css';

interface Props {
  day: Day;
  schedule: Schedule;
  dispatchers: ExtendedDispatcher[];
  onChange: (day: Day, time: TimeSlot, column: Column, value: string) => void;
}

const ScheduleTable: React.FC<Props> = ({ day, schedule, dispatchers, onChange }) => {
  const onScheduleChange = (day: Day, timeSlot: TimeSlot, column: Column, value: string) => {
    onChange(day, timeSlot, column, value);
  };

  return (
    <div className="schedule-table-wrapper">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Time</th>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((timeSlot) => (
            <tr key={timeSlot}>
              <td>{timeSlot}</td>
              {columns.map((column) => (
                <td key={column} className="schedule-cell">
                  <DispatcherDropdown
                    value={schedule[day][timeSlot][column] || ''}
                    dispatchers={dispatchers}
                    onChange={(value) => onScheduleChange(day, timeSlot, column, value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleTable;
