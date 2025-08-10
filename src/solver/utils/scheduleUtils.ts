import { TimeSlot, Column, timeSlots, columns, days, Schedule } from '../../constants';
import { ExtendedDispatcher } from '../../types';
import { ScheduleDay, OperationResult } from '../types';

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
export function countDispatcherAssignments(
  day: ScheduleDay, 
  dispatcherKey: string, 
  excludeColumns: Column[] = []
): number {
  let count = 0;
  timeSlots.forEach(slot => {
    columns.forEach(col => {
      if (!excludeColumns.includes(col) && day[slot][col] === dispatcherKey) {
        count++;
      }
    });
  });
  return count;
}

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
 * Finds the first available slot (any column) from a list of time slots
 */
export function findFirstAvailableSlot(
  slots: TimeSlot[],
  schedule: ScheduleDay
): { slot: TimeSlot; col: Column } | null {
  for (const slot of slots) {
    for (const col of columns) {
      if (!schedule[slot][col]) {
        return { slot, col };
      }
    }
  }
  return null;
}

/**
 * Validates that a schedule day has the correct structure
 */
export function validateScheduleDay(day: ScheduleDay): OperationResult {
  try {
    for (const slot of timeSlots) {
      if (!day[slot]) {
        return { success: false, error: `Missing slot: ${slot}` };
      }
      // Structural + semantic checks per slot
      const seen = new Set<string>();
      const seenParticipants = new Set<string>();
      for (const col of columns) {
        if (day[slot][col] === undefined) {
          return { success: false, error: `Missing column ${col} in slot ${slot}` };
        }
        const value = day[slot][col];
        if (typeof value !== 'string') {
          return { success: false, error: `Invalid value type at ${slot}/${col}` };
        }
        // Reject whitespace-only values
        if (value.length > 0 && value.trim().length === 0) {
          return { success: false, error: `Whitespace-only value at ${slot}/${col}` };
        }
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          if (seen.has(trimmed)) {
            return { success: false, error: `Duplicate assignment in ${slot}: ${trimmed} appears in multiple columns` };
          }
          seen.add(trimmed);

          // Also prevent duplicate participants when composite values are used (e.g., TRAINER/TRAINEE)
          const parts = trimmed.split('/').map(p => p.trim()).filter(Boolean);
          for (const part of parts) {
            if (seenParticipants.has(part)) {
              return { success: false, error: `Duplicate person in ${slot}: ${part} appears in multiple columns` };
            }
            seenParticipants.add(part);
          }
        }
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: `Validation error: ${error}` };
  }
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
