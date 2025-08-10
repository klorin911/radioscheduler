import React, { useMemo } from 'react';
import '../styles/schedule-table.css';
import { columns, timeSlots, Column, TimeSlot, Day, Schedule } from '../constants';
import { ExtendedDispatcher } from '../types';
import DispatcherDropdown from './DispatcherDropdown';
import '../styles/dispatcher-dropdown.css';
import { isSlotInShift } from '../solver/utils/shiftUtils';

interface Props {
  day: Day;
  schedule: Schedule;
  dispatchers: ExtendedDispatcher[];
  onChange: (day: Day, time: TimeSlot, column: Column, value: string) => void;
  slotCounts: Record<string, number>;
}

const ScheduleTable: React.FC<Props> = ({ day, schedule, dispatchers, onChange, slotCounts }) => {
  // Resolve a display value to dispatcher objects (supports trainer/trainee pairs "A/B")
  const resolveParticipants = (value: string): ExtendedDispatcher[] => {
    if (!value) return [];
    const parts = value.includes('/') ? value.split('/').map((s) => s.trim()) : [value.trim()];
    const findByLabel = (label: string): ExtendedDispatcher | undefined =>
      dispatchers.find((d) => d.id === label || d.name === label);
    return parts.map(findByLabel).filter((d): d is ExtendedDispatcher => !!d);
  };

  // Build duplicate map per timeslot for current day (any person assigned more than once)
  const duplicateIdsByTimeSlot = useMemo(() => {
    const map: Record<TimeSlot, Set<string>> = {} as any;
    timeSlots.forEach((slot) => {
      const counts = new Map<string, number>();
      columns.forEach((col) => {
        const val = schedule[day][slot][col] || '';
        if (!val) return;
        const participants = resolveParticipants(val);
        participants.forEach((p) => {
          const key = p.id; // use short ID as unique key
          counts.set(key, (counts.get(key) || 0) + 1);
        });
      });
      const dups = new Set<string>();
      counts.forEach((count, id) => {
        if (count > 1) dups.add(id);
      });
      map[slot] = dups;
    });
    return map;
  }, [day, schedule, dispatchers]);

  // Compute cell status: 'error' (red), 'warning' (yellow), or undefined
  const getCellStatus = (timeSlot: TimeSlot, column: Column, value: string): 'error' | 'warning' | undefined => {
    if (!value) return undefined;
    const participants = resolveParticipants(value);
    if (participants.length === 0) return undefined;

    // Helper to determine effective day/shift if trainee follows trainer in a pair
    const trainer = participants[0];
    const trainee = participants.length > 1 ? participants[1] : undefined;

    const violatesDayOrShift = participants.some((person) => {
      // Day check
      let effectiveDays = person.workDays;
      if (person.followTrainerSchedule && trainee && person === trainee && trainer) {
        effectiveDays = trainer.workDays;
      }
      const dayOk = !effectiveDays || effectiveDays.length === 0 || effectiveDays.includes(day);

      // Shift check
      let shiftOk = true;
      if (person.followTrainerSchedule && trainee && person === trainee && trainer && trainer.shift) {
        shiftOk = isSlotInShift({ ...person, shift: trainer.shift }, timeSlot);
      } else {
        shiftOk = isSlotInShift(person, timeSlot);
      }

      return !(dayOk && shiftOk);
    });

    // Duplicate check (any participant duplicated in same timeslot)
    const dupSet = duplicateIdsByTimeSlot[timeSlot] || new Set<string>();
    const hasDuplicate = participants.some((p) => dupSet.has(p.id));

    if (hasDuplicate || violatesDayOrShift) return 'error';

    // Preference warning (skip UT column). If dispatcher has preferences defined and this slot doesn't match.
    if (column !== 'UT') {
      const subject = trainer; // evaluate preferences on primary selection
      const hasChannelPrefs = Array.isArray(subject.preferredChannels) && subject.preferredChannels.length > 0;
      const hasTimePrefs = Array.isArray(subject.preferredTimeBlocks) && subject.preferredTimeBlocks.length > 0;
      const channelOk = !hasChannelPrefs || subject.preferredChannels!.includes(column);
      const timeOk = !hasTimePrefs || subject.preferredTimeBlocks!.includes(timeSlot);
      if (hasChannelPrefs || hasTimePrefs) {
        if (!(channelOk && timeOk)) return 'warning';
      }
    }

    return undefined;
  };
  const onScheduleChange = (day: Day, timeSlot: TimeSlot, column: Column, value: string) => {
    onChange(day, timeSlot, column, value);
  };

  const assignedDispatchersWithCounts = Object.entries(slotCounts)
    .map(([dispatcherId, count]) => {
      const dispatcher = dispatchers.find((d) => d.id === dispatcherId);
      return dispatcher ? { ...dispatcher, count } : null;
    })
    .filter((d): d is ExtendedDispatcher & { count: number } => d !== null && d.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

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
              {columns.map((column) => {
                const value = schedule[day][timeSlot][column] || '';
                const status = getCellStatus(timeSlot as TimeSlot, column as Column, value);
                const className = status === 'error' ? 'error' : status === 'warning' ? 'warning' : '';
                return (
                  <td key={column} className="schedule-cell">
                    <DispatcherDropdown
                      value={value}
                      dispatchers={dispatchers}
                      onChange={(value) => onScheduleChange(day, timeSlot, column, value)}
                      day={day}
                      timeSlot={timeSlot}
                      column={column}
                      className={className}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="daily-counts-summary">
        <strong>Daily Counts:</strong>
        <div className="counts-container">
          {assignedDispatchersWithCounts.length > 0 ? (
            assignedDispatchersWithCounts.map((d) => (
              <div key={d.id} className="count-pill">
                {d.name}: <strong>{d.count}</strong>
              </div>
            ))
          ) : (
            <span>No assignments for this day.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleTable;
