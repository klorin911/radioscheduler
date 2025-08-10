import { Day, timeSlots, columns } from '../../constants';
import { ExtendedDispatcher } from '../../types';
import { ScheduleDay } from '../types';
import { isDispatcherInTimeslot, normalizeScheduleDayToIds } from './scheduleUtils';
import { SHIFT_SLOTS } from './shiftUtils';

/**
 * Applies a simple round-robin fallback when no assignments were made
 */
export function applyRoundRobinFallback(
  day: Day,
  dispatchers: ExtendedDispatcher[],
  schedule: ScheduleDay
): ScheduleDay {
  const availableDispatchers = dispatchers.filter(d => 
    (!d.workDays || d.workDays.length === 0 || d.workDays.includes(day)) &&
    !d.excludeFromAutoSchedule &&
    !(d.isTrainee || d.traineeOf)
  );
  
  if (availableDispatchers.length === 0) {
    console.log(`[WeekScheduler] ${day}: No available dispatchers for fallback`);
    return schedule;
  }
  
  console.log(`[WeekScheduler] ${day}: Using round-robin fallback with ${availableDispatchers.length} dispatchers`);
  
  const fallbackSchedule = normalizeScheduleDayToIds(schedule, dispatchers);
  
  timeSlots.forEach((slot) => {
    let dispatcherIndex = 0;
    // Exclude UT and RELIEF from fallback; UT handled by weekly util and RELIEF is manual-only
    columns.filter((c) => c !== 'UT' && c !== 'RELIEF').forEach((col) => {
      if (dispatcherIndex < availableDispatchers.length) {
        const dispatcher = availableDispatchers[dispatcherIndex];
        fallbackSchedule[slot][col] = dispatcher.id;
        dispatcherIndex++;
      } else {
        fallbackSchedule[slot][col] = '';
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
  const availableDispatchers = dispatchers.filter(d => 
    (!d.workDays || d.workDays.length === 0 || d.workDays.includes(day)) &&
    !d.excludeFromAutoSchedule &&
    !(d.isTrainee || d.traineeOf)
  );

  if (availableDispatchers.length === 0) {
    console.log(`[WeekScheduler] ${day}: No available dispatchers for shift-aware fallback`);
    return schedule;
  }

  console.log(`[WeekScheduler] ${day}: Using shift-aware fallback with ${availableDispatchers.length} dispatchers`);

  const fallbackSchedule = normalizeScheduleDayToIds(schedule, dispatchers);

  // Round-robin cursor to avoid always starting with the same person
  let rrCursor = 0;

  timeSlots.forEach((slot, slotIdx) => {
    // Build eligible list for this slot based on shift
    const eligibleForSlot = availableDispatchers.filter(d => {
      if (!d.shift) return true; // no shift -> eligible for all
      const slots = SHIFT_SLOTS[d.shift] || [];
      return slots.includes(slot);
    });

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
    columns.filter(c => c !== 'UT' && c !== 'RELIEF').forEach((col) => {
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

/**
 * Applies a weighted fallback based on dispatcher preferences and seniority
 */
export function applyWeightedFallback(
  day: Day,
  dispatchers: ExtendedDispatcher[],
  schedule: ScheduleDay
): ScheduleDay {
  const availableDispatchers = dispatchers.filter(d => 
    (!d.workDays || d.workDays.length === 0 || d.workDays.includes(day)) &&
    !d.excludeFromAutoSchedule &&
    !(d.isTrainee || d.traineeOf)
  );
  
  if (availableDispatchers.length === 0) {
    console.log(`[WeekScheduler] ${day}: No available dispatchers for weighted fallback`);
    return schedule;
  }
  
  console.log(`[WeekScheduler] ${day}: Using weighted fallback with ${availableDispatchers.length} dispatchers`);
  
  // TODO: Implement weighted assignment logic based on preferences and seniority
  // For now, fall back to round-robin
  return applyRoundRobinFallback(day, dispatchers, schedule);
}
