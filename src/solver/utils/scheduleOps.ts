import { TimeSlot, Column, timeSlots, columns, days, Schedule } from '../../constants';
import { ExtendedDispatcher } from '../../appTypes';
import { ScheduleDay } from '../solverTypes';

/**
 * Creates a deep clone of a schedule day without using JSON methods
 */
export function cloneScheduleDay(day: ScheduleDay): ScheduleDay {
  const cloned = {} as ScheduleDay;
  timeSlots.forEach((slot) => {
    cloned[slot] = {} as Record<Column, string>;
    columns.forEach((col) => {
      cloned[slot][col] = day[slot][col];
    });
  });
  return cloned;
}

/**
 * Creates an empty schedule day with all slots unassigned
 */
export function createEmptyScheduleDay(): ScheduleDay {
  const day = {} as ScheduleDay;
  timeSlots.forEach((slot) => {
    const row = {} as Record<Column, string>;
    columns.forEach((col) => {
      row[col] = '';
    });
    day[slot] = row;
  });
  return day;
}

/**
 * Finds a dispatcher from a list by their ID or name.
 * The schedule can store either the ID or the name.
 */
export function findDispatcherByIdentifier(
  identifier: string,
  dispatchers: ExtendedDispatcher[],
): ExtendedDispatcher | undefined {
  // Support composite values like "TRAINER/TRAINEE" by resolving the first participant
  const base = identifier && identifier.includes('/') ? identifier.split('/')[0].trim() : identifier;
  return dispatchers.find((d) => d.id === base || d.name === base);
}

/**
 * Counts the number of slots assigned to each dispatcher for a given day.
 * @param scheduleDay The schedule for the day.
 * @param dispatchers The list of all dispatchers.
 * @returns A record mapping dispatcher ID to their slot count.
 */
export function countSlotsPerDispatcher(
  scheduleDay: ScheduleDay,
  dispatchers: ExtendedDispatcher[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  timeSlots.forEach((slot) => {
    columns.forEach((col) => {
      const identifier = scheduleDay[slot][col];
      if (identifier) {
        // Count only the trainer for composite values
        const base = identifier.includes('/') ? identifier.split('/')[0].trim() : identifier;
        const dispatcher = findDispatcherByIdentifier(base, dispatchers);
        if (dispatcher) {
          counts[dispatcher.id] = (counts[dispatcher.id] || 0) + 1;
        }
      }
    });
  });

  return counts;
}

/**
 * Checks if a schedule day has any assignments
 */
export function hasAnyAssignments(day: ScheduleDay): boolean {
  return timeSlots.some(slot =>
    columns.some(col => day[slot][col].length > 0)
  );
}

/**
 * Counts the number of assignments for a specific dispatcher in a day
 */
/**
 * Checks if a dispatcher is assigned to any column at a specific time slot
 */
export function isDispatcherInTimeslot(
  dispatcherKey: string,
  schedule: ScheduleDay,
  slot: TimeSlot
): boolean {
  return columns.some(col => {
    const cell = schedule[slot][col];
    if (!cell) return false;
    const parts = cell.split('/').map(p => p.trim()).filter(Boolean);
    return parts.includes(dispatcherKey);
  });
}

/**
 * Merges two schedule days, with the second taking precedence for non-empty values
 */
export function mergeScheduleDays(base: ScheduleDay, overlay: ScheduleDay): ScheduleDay {
  const merged = cloneScheduleDay(base);
  timeSlots.forEach((slot) => {
    columns.forEach((col) => {
      const overlayValue = overlay[slot][col];
      if (overlayValue && overlayValue.trim().length > 0) {
        merged[slot][col] = overlayValue;
      }
    });
  });
  return merged;
}

/**
 * Normalizes a single identifier (ID or name) to canonical dispatcher ID when resolvable.
 */
export function normalizeIdentifierToId(identifier: string, dispatchers: ExtendedDispatcher[]): string {
  if (!identifier) return identifier;
  const trimmed = identifier.trim();
  const match = dispatchers.find(d => d.id === trimmed || d.name === trimmed);
  return match ? match.id : trimmed;
}

/**
 * Converts all cell values in a day to canonical IDs when possible.
 * Preserves composite values by converting each participant.
 */
export function normalizeScheduleDayToIds(day: ScheduleDay, dispatchers: ExtendedDispatcher[]): ScheduleDay {
  const normalized = cloneScheduleDay(day);
  timeSlots.forEach(slot => {
    columns.forEach(col => {
      const val = normalized[slot][col];
      if (!val) return;
      const parts = val.split('/').map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) return;
      const normalizedParts = parts.map(p => normalizeIdentifierToId(p, dispatchers));
      normalized[slot][col] = normalizedParts.join('/');
    });
  });
  return normalized;
}

/**
 * Converts all days in a weekly schedule to canonical IDs when possible.
 */
export function normalizeScheduleWeekToIds(week: Schedule, dispatchers: ExtendedDispatcher[]): Schedule {
  const cloned: Schedule = {} as Schedule;
  days.forEach(d => {
    cloned[d] = normalizeScheduleDayToIds(week[d], dispatchers);
  });
  return cloned;
}
