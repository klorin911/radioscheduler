import React from 'react';
import '../styles/schedule-table.css';
import {
  columns,
  timeSlots,
  Column,
  TimeSlot,
  Day,
  Schedule,
} from '../constants';

interface Props {
  day: Day;
  schedule: Schedule;
  dispatchers: string[];
  onChange: (day: Day, time: TimeSlot, column: Column, value: string) => void;
}

const ScheduleTable: React.FC<Props> = ({ day, schedule, dispatchers, onChange }) => {
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
          {timeSlots.map((slot) => (
            <tr key={slot}>
              <td>{slot}</td>
              {columns.map((col) => (
                <td key={col}>
                  <select
                    value={schedule[day][slot][col]}
                    onChange={(e) => onChange(day, slot, col, e.target.value)}
                  >
                    <option value=""></option>
                    {dispatchers.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
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
