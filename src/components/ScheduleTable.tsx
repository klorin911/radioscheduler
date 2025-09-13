import React, { useMemo, useCallback } from 'react';
import '../styles/schedule-table.css';
import { columns, timeSlots, Column, TimeSlot, Day, Schedule, isCellDisabled } from '../constants';
import { ExtendedDispatcher } from '../appTypes';
import DispatcherDropdown from './DispatcherDropdown';
import '../styles/dispatcher-dropdown.css';
import { isSlotInShift, isEligibleOnDayForSlot, getPreviousDay } from '../solver/utils/shiftUtils';

interface Props {
  day: Day;
  schedule: Schedule;
  dispatchers: ExtendedDispatcher[];
  onChange: (day: Day, time: TimeSlot, column: Column, value: string) => void;
  slotCounts: Record<string, number>;
}

const ScheduleTable: React.FC<Props> = ({ day, schedule, dispatchers, onChange, slotCounts }) => {
  // Resolve a display value to dispatcher objects (supports trainer/trainee pairs "A/B")
  const resolveParticipants = useCallback((value: string): ExtendedDispatcher[] => {
    if (!value) return [];
    const parts = value.includes('/') ? value.split('/').map((s) => s.trim()) : [value.trim()];
    const findByLabel = (label: string): ExtendedDispatcher | undefined =>
      dispatchers.find((d) => d.id === label || d.name === label);
    return parts.map(findByLabel).filter((d): d is ExtendedDispatcher => !!d);
  }, [dispatchers]);

  // Build duplicate map per timeslot for current day (any person assigned more than once)
  const duplicateIdsByTimeSlot = useMemo(() => {
    const map: Record<TimeSlot, Set<string>> = {} as Record<TimeSlot, Set<string>>;
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
  }, [day, schedule, resolveParticipants]);

  // Compute cell status: 'error' (red), 'warning' (yellow), or undefined
  const getCellStatus = (timeSlot: TimeSlot, column: Column, value: string): 'error' | 'warning' | undefined => {
    if (!value) return undefined;
    const participants = resolveParticipants(value);
    if (participants.length === 0) return undefined;

    // Helper to determine effective day/shift if trainee follows trainer in a pair
    const trainer = participants[0];
    const trainee = participants.length > 1 ? participants[1] : undefined;

    const violatesDayOrShift = participants.some((person) => {
      // Day+spillover check
      const trainerForTrainee = person.followTrainerSchedule && trainee && person === trainee ? trainer : undefined;
      const dayOk = isEligibleOnDayForSlot(person, day, timeSlot, trainerForTrainee);

      // Shift check (consider effective shift for follow-trainer)
      const shiftOk = trainerForTrainee && trainerForTrainee.shift
        ? isSlotInShift({ ...person, shift: trainerForTrainee.shift }, timeSlot)
        : isSlotInShift(person, timeSlot);

      return !(dayOk && shiftOk);
    });

    // Duplicate check (any participant duplicated in same timeslot)
    const dupSet = duplicateIdsByTimeSlot[timeSlot] || new Set<string>();
    const hasDuplicate = participants.some((p) => dupSet.has(p.id));

    if (hasDuplicate || violatesDayOrShift) return 'error';

    // Preference warning (skip UT and RELIEF columns). If dispatcher has preferences defined and this slot doesn't match.
    if (column !== 'UT' && column !== 'RELIEF') {
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
    // Prevent writes to disabled cells
    if (isCellDisabled(day, timeSlot, column)) return;

    // Enforce day eligibility (including E/F spillover cutoff like F not after 0730 on first day off)
    // Parse participants (supports trainer/trainee pairs "A/B")
    const participants = resolveParticipants(value);
    if (participants.length > 0) {
      const trainer = participants[0];
      const trainee = participants.length > 1 ? participants[1] : undefined;
      const violatesDayEligibility = participants.some((person) => {
        const trainerForTrainee = person.followTrainerSchedule && trainee && person === trainee ? trainer : undefined;
        const dayOk = isEligibleOnDayForSlot(person, day, timeSlot, trainerForTrainee);
        return !dayOk;
      });
      if (violatesDayEligibility) return;
    }

    onChange(day, timeSlot, column, value);
  };

  const scheduledDispatchersWithCounts = useMemo(() => {
    const findTrainer = (traineeOf?: string) => dispatchers.find(d => d.id === traineeOf);
    const worksOnDay = (person: ExtendedDispatcher): boolean => {
      // Treat someone as working on this day if their workDays include it
      // or if they're E/F shift and worked the previous day (spillover eligibility)
      let daysFor = person.workDays;
      let shift = person.shift;
      if (person.followTrainerSchedule && person.isTrainee && person.traineeOf) {
        const trainer = findTrainer(person.traineeOf);
        daysFor = trainer?.workDays ?? daysFor;
        shift = trainer?.shift ?? shift;
      }
      if (!daysFor || daysFor.length === 0) return true;
      if (daysFor.includes(day)) return true;
      const prev = getPreviousDay(day);
      return (shift === 'E' || shift === 'F') && daysFor.includes(prev);
    };
    return dispatchers
      .filter(d => worksOnDay(d))
      .map(d => ({ ...d, count: slotCounts[d.id] ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dispatchers, day, slotCounts]);

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
                const disabled = isCellDisabled(day, timeSlot as TimeSlot, column as Column);
                const dropdownClassName = `${status === 'error' ? 'error' : status === 'warning' ? 'warning' : ''} ${disabled ? 'disabled' : ''}`.trim();
                const cellClassName = `schedule-cell${disabled ? ' disabled-cell' : ''}`;
                return (
                  <td key={column} className={cellClassName}>
                    <DispatcherDropdown
                      value={value}
                      dispatchers={dispatchers}
                      onChange={(value) => onScheduleChange(day, timeSlot, column, value)}
                      day={day}
                      timeSlot={timeSlot}
                      column={column}
                      className={dropdownClassName}
                      disabled={disabled}
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
        <div className="counts-legend">
          <span className="legend-item"><span className="swatch zero" />0</span>
          <span className="legend-item"><span className="swatch one" />1</span>
          <span className="legend-item"><span className="swatch two" />2</span>
          <span className="legend-item"><span className="swatch three-plus" />3+</span>
        </div>
        <div className="counts-container">
          {scheduledDispatchersWithCounts.length > 0 ? (
            scheduledDispatchersWithCounts.map((d) => {
              const countClass =
                d.count === 0 ? 'count-pill--zero' :
                d.count === 1 ? 'count-pill--one' :
                d.count === 2 ? 'count-pill--two' : 'count-pill--three-plus';
              return (
                <div key={d.id} className={`count-pill ${countClass}`}>
                  {d.name}: <strong>{d.count}</strong>
                </div>
              );
            })
          ) : (
            <span>No assignments for this day.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleTable;
