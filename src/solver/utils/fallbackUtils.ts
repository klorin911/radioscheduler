import { Day, timeSlots, columns, isCellDisabled } from '../../constants';
import { ExtendedDispatcher } from '../../appTypes';
import { ScheduleDay } from '../solverTypes';
import { isDispatcherInTimeslot, normalizeScheduleDayToIds } from './scheduleOps';
import { isEligibleOnDayForSlot, isSlotInShift, getPreviousDay } from './shiftUtils';

/**
 * Applies a simple round-robin fallback when no assignments were made
 */
export function applyRoundRobinFallback(
  day: Day,
  dispatchers: ExtendedDispatcher[],
  schedule: ScheduleDay
): ScheduleDay {
  // Base availability: enforce work day, exclude trainees and excluded
  const availableDispatchers = dispatchers.filter(d => {
    if (d.excludeFromAutoSchedule) return false;
    if (d.isTrainee || d.traineeOf) return false;
    if (d.workDays && d.workDays.length > 0 && !d.workDays.includes(day)) {
      const prev = getPreviousDay(day);
      const spilloverEligible = (d.shift === 'E' || d.shift === 'F') && d.workDays.includes(prev);
      if (!spilloverEligible) return false;
    }
    return true;
  });
  
  if (availableDispatchers.length === 0) {
    console.log(`[WeekScheduler] ${day}: No available dispatchers for fallback`);
    return schedule;
  }
  
  console.log(`[WeekScheduler] ${day}: Using round-robin fallback with ${availableDispatchers.length} dispatchers`);
  
  const fallbackSchedule = normalizeScheduleDayToIds(schedule, dispatchers);
  
  timeSlots.forEach((slot) => {
    // Track used participants in this slot to avoid duplicates
    const used = new Set<string>();

    // Build eligible list for this slot respecting shift + day
    const eligibleForSlot = availableDispatchers.filter(d => isSlotInShift(d, slot) && isEligibleOnDayForSlot(d, day, slot));
    if (eligibleForSlot.length === 0) return;

    // Exclude UT and RELIEF; ensure target cell not disabled
    columns.filter((c) => c !== 'UT' && c !== 'RELIEF' && !isCellDisabled(day, slot, c)).forEach((col) => {
      // Skip if locked already
      if (fallbackSchedule[slot][col] && fallbackSchedule[slot][col].trim().length > 0) return;

      // Find next eligible dispatcher not used in this timeslot and not already scheduled elsewhere in this slot
      const pick = eligibleForSlot.find(d => {
        const key = d.id;
        return !used.has(key) && !isDispatcherInTimeslot(key, fallbackSchedule, slot);
      });
      if (pick) {
        const key = pick.id;
        fallbackSchedule[slot][col] = key;
        used.add(key);
      }
    });
  });
  
  return fallbackSchedule;
}

/**
 * Applies a more intelligent fallback that respects shift preferences
 */
export function applyShiftAwareFallback(
  day: Day,
  dispatchers: ExtendedDispatcher[],
  schedule: ScheduleDay
): ScheduleDay {
  // Base availability: enforce work day, exclude trainees and excluded
  const availableDispatchers = dispatchers.filter(d => {
    if (d.excludeFromAutoSchedule) return false;
    if (d.isTrainee || d.traineeOf) return false;
    if (!d.workDays || d.workDays.length === 0) return true;
    if (d.workDays.includes(day)) return true;
    const prev = getPreviousDay(day);
    return (d.shift === 'E' || d.shift === 'F') && d.workDays.includes(prev);
  });

  if (availableDispatchers.length === 0) {
    console.log(`[WeekScheduler] ${day}: No available dispatchers for shift-aware fallback`);
    return schedule;
  }

  console.log(`[WeekScheduler] ${day}: Using shift-aware fallback with ${availableDispatchers.length} dispatchers`);

  const fallbackSchedule = normalizeScheduleDayToIds(schedule, dispatchers);

  // Round-robin cursor to avoid always starting with the same person
  let rrCursor = 0;

  timeSlots.forEach((slot, slotIdx) => {
    // Build eligible list for this slot based on shift and day
    const eligibleForSlot = availableDispatchers.filter(d => isSlotInShift(d, slot) && isEligibleOnDayForSlot(d, day, slot));

    if (eligibleForSlot.length === 0) {
      // Nothing we can do for this slot
      return;
    }

    // Track who is already placed in this timeslot
    const used = new Set<string>();
    columns.forEach(col => {
      const cell = fallbackSchedule[slot][col];
      if (cell) {
        cell.split('/').map(s => s.trim()).filter(Boolean).forEach(p => used.add(p));
      }
    });

    // Assign across non-UT and non-RELIEF columns
    columns.filter(c => c !== 'UT' && c !== 'RELIEF' && !isCellDisabled(day, slot, c)).forEach((col) => {
      // Skip if locked already
      if (fallbackSchedule[slot][col] && fallbackSchedule[slot][col].trim().length > 0) return;

      // Find next eligible dispatcher not already used in this slot
      const N = eligibleForSlot.length;
      let picked: ExtendedDispatcher | null = null;
      for (let k = 0; k < N; k++) {
        const idx = (rrCursor + slotIdx + k) % N; // vary by slot to spread load
        const d = eligibleForSlot[idx];
        const key = d.id;
        if (!used.has(key) && !isDispatcherInTimeslot(key, fallbackSchedule, slot)) {
          picked = d;
          rrCursor = (idx + 1) % N; // advance cursor
          break;
        }
      }

      if (picked) {
        const key = picked.id;
        fallbackSchedule[slot][col] = key;
        used.add(key);
      }
    });
  });

  return fallbackSchedule;
}

// Removed unused applyWeightedFallback
