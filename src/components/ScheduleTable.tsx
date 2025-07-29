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
import { ExtendedDispatcher } from '../solver/glpkScheduler';
import DispatcherTooltip from './DispatcherTooltip';

interface Props {
  day: Day;
  schedule: Schedule;
  dispatchers: ExtendedDispatcher[];
  onChange: (day: Day, time: TimeSlot, column: Column, value: string) => void;
}

const ScheduleTable: React.FC<Props> = ({ day, schedule, dispatchers, onChange }) => {
  const getDispatcherByName = (name: string) => {
    return dispatchers.find(d => (d.name || d.id) === name);
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
          {timeSlots.map((slot) => (
            <tr key={slot}>
              <td>{slot}</td>
              {columns.map((col) => (
                <td key={col}>
                  {schedule[day][slot][col] ? (
                    <DispatcherTooltip dispatcher={getDispatcherByName(schedule[day][slot][col])!}>
                      <select
                        value={schedule[day][slot][col]}
                        onChange={(e) => onChange(day, slot, col, e.target.value)}
                        className="dispatcher-select-filled"
                      >
                        <option value=""></option>
                        {dispatchers.map((d) => {
                          const name = d.name || d.id;
                          return (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          );
                        })}
                      </select>
                    </DispatcherTooltip>
                  ) : (
                    <select
                      value={schedule[day][slot][col]}
                      onChange={(e) => onChange(day, slot, col, e.target.value)}
                      className="dispatcher-select-empty"
                    >
                      <option value=""></option>
                      {dispatchers.map((d) => {
                        const name = d.name || d.id;
                        return (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        );
                      })}
                    </select>
                  )}
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
