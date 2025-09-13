import { Day, TimeSlot, timeSlots } from '../../constants';
import { ExtendedDispatcher, extractBadgeNumber } from '../../appTypes';
import { ScheduleDay } from '../solverTypes';
import { getEligibleSlots, SHIFT_SLOTS } from './shiftUtils';
import { isDispatcherInTimeslot } from './scheduleOps';

// Debug logging toggle for UT assignment
const DEBUG = false;
const log = (...args: unknown[]) => { if (DEBUG) console.log(...args); };
const warn = (...args: unknown[]) => { if (DEBUG) console.warn(...args); };

// Seniority sort key (lower value = higher seniority)
function getSenioritySortKey(d: ExtendedDispatcher): number {
  const s = d.seniority;
  if (typeof s === 'number' && !Number.isNaN(s)) return s;
  if (typeof d.badgeNumber === 'number' && !Number.isNaN(d.badgeNumber)) return d.badgeNumber;
  const raw: unknown = (d as unknown as { badgeNumber?: unknown }).badgeNumber;
  if (typeof raw === 'string') {
    const m = raw.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return extractBadgeNumber(d.id);
}

/**
 * Assigns exactly one UT slot per dispatcher per work week
 * This is called after all regular scheduling is complete
 */
export function assignUTSlots(
  weekSchedule: Record<Day, ScheduleDay>,
  dispatchers: ExtendedDispatcher[]
): void {
  log('[UT Assignment] Starting UT slot assignment for the week');
  
  // Track UT assignments per dispatcher
  const utAssignments: Map<string, number> = new Map();
  // Map any identifier (id or name) to canonical id
  const idByAny = new Map<string, string>();
  dispatchers.forEach(d => {
    if (d.id) idByAny.set(d.id, d.id);
    if (d.name) idByAny.set(d.name, d.id);
  });
  
  // Count existing UT assignments
  Object.entries(weekSchedule).forEach(([, daySchedule]) => {
    timeSlots.forEach(slot => {
      const utAssignee = daySchedule[slot]['UT'];
      if (utAssignee) {
        const key = idByAny.get(utAssignee.trim()) || utAssignee.trim();
        const count = utAssignments.get(key) || 0;
        utAssignments.set(key, count + 1);
      }
    });
  });
  
  // Sort dispatchers by seniority for UT assignment priority
  const sortedDispatchers = [...dispatchers]
    .filter(d => d.workDays && d.workDays.length > 0 && !d.excludeFromAutoSchedule && !(d.isTrainee || d.traineeOf)) // Exclude trainees entirely
    .sort((a, b) => getSenioritySortKey(a) - getSenioritySortKey(b));
  
  // Assign exactly one UT slot to each dispatcher
  assignPrimaryUTSlots(weekSchedule, sortedDispatchers, utAssignments);
  
  // Verify all dispatchers got their UT slot
  const missingUT = sortedDispatchers.filter(d => (utAssignments.get(d.id) || 0) === 0);
  if (missingUT.length > 0) {
    warn(`[UT Assignment] ${missingUT.length} dispatchers did not receive a UT slot. Attempting fallback assignment.`);
    assignFallbackUTSlots(weekSchedule, missingUT, utAssignments);
  }
  
  // Assign extra UT slots to volunteers
  assignExtraUTSlots(weekSchedule, sortedDispatchers, utAssignments);
  
  log('[UT Assignment] UT slot assignment complete');
}

/**
 * Assigns primary UT slots (one per dispatcher)
 */
function assignPrimaryUTSlots(
  weekSchedule: Record<Day, ScheduleDay>,
  sortedDispatchers: ExtendedDispatcher[],
  utAssignments: Map<string, number>
): void {
  for (const dispatcher of sortedDispatchers) {
    const dispatcherKey = dispatcher.id;
    const currentUTCount = utAssignments.get(dispatcherKey) || 0;
    
    if (currentUTCount === 0) {
      // Find the first available UT slot on any of their work days
      let assigned = false;
      
      for (const workDay of dispatcher.workDays || []) {
        if (assigned) break;
        
        const daySchedule = weekSchedule[workDay as Day];
        if (!daySchedule) continue;
        
        // Get eligible slots based on their shift
        const eligibleSlots = getEligibleSlots(dispatcher);
        
        for (const slot of eligibleSlots) {
          if (daySchedule[slot]['UT'] === '' && !isDispatcherInTimeslot(dispatcherKey, daySchedule, slot)) {
            // Assign the UT slot
            daySchedule[slot]['UT'] = dispatcherKey;
            utAssignments.set(dispatcherKey, 1);
            assigned = true;
            log(`[UT Assignment] Assigned ${dispatcherKey} to UT on ${workDay} ${slot}`);
            break;
          }
        }
      }
      
      if (!assigned) {
        warn(`[UT Assignment] Could not assign UT slot to ${dispatcherKey} - no available slots`);
      }
    }
  }
}

/**
 * Assigns extra UT slots to volunteers
 */
/**
 * Fallback UT slot assignment for dispatchers who didn't get a slot in the first pass
 */
function assignFallbackUTSlots(
  weekSchedule: Record<Day, ScheduleDay>,
  missingDispatchers: ExtendedDispatcher[],
  utAssignments: Map<string, number>
): void {
  // Collect all empty UT slots across the week
  const emptySlots: Array<{ day: Day; slot: TimeSlot }> = [];
  Object.entries(weekSchedule).forEach(([dayName, daySchedule]) => {
    timeSlots.forEach(slot => {
      if (daySchedule[slot]['UT'] === '') {
        emptySlots.push({ day: dayName as Day, slot });
      }
    });
  });

  if (emptySlots.length === 0) {
    warn('[UT Assignment] No empty UT slots available for fallback assignment');
    return;
  }

  // Sort dispatchers by seniority (should already be sorted, but just to be safe)
  const sortedMissing = [...missingDispatchers].sort((a, b) => getSenioritySortKey(a) - getSenioritySortKey(b));

  // Try to assign one UT slot to each missing dispatcher
  for (const dispatcher of sortedMissing) {
    const dispatcherKey = dispatcher.id;
    
    // Find first available slot that matches their work days and shift
    const slotIndex = emptySlots.findIndex(({ day, slot }) => {
      // Check if dispatcher works this day
      if (dispatcher.workDays && dispatcher.workDays.length > 0 && !dispatcher.workDays.includes(day)) {
        return false;
      }
      
      // Check if slot is in their shift
      if (dispatcher.shift) {
        const shiftSlots = SHIFT_SLOTS[dispatcher.shift] || [];
        if (!shiftSlots.includes(slot)) {
          return false;
        }
      }
      
      // Avoid double-booking: ensure the dispatcher isn't already assigned in this slot
      const daySchedule = weekSchedule[day];
      if (!daySchedule) return false;
      if (isDispatcherInTimeslot(dispatcherKey, daySchedule, slot)) return false;
      return true;
    });
    
    if (slotIndex !== -1) {
      const { day, slot } = emptySlots[slotIndex];
      const daySchedule = weekSchedule[day];
      if (isDispatcherInTimeslot(dispatcherKey, daySchedule, slot)) {
        warn(`[UT Assignment] Attempted to double-book ${dispatcherKey} in ${day} ${slot}`);
        continue;
      }
      daySchedule[slot]['UT'] = dispatcherKey;
      utAssignments.set(dispatcherKey, 1);
      log(`[UT Assignment] Fallback assigned ${dispatcherKey} to UT on ${day} ${slot}`);
      emptySlots.splice(slotIndex, 1); // Remove assigned slot
    } else {
      warn(`[UT Assignment] Could not assign fallback UT slot to ${dispatcherKey} - no suitable slots`);
    }
  }
}

/**
 * Assigns extra UT slots to volunteers
 */
function assignExtraUTSlots(
  weekSchedule: Record<Day, ScheduleDay>,
  sortedDispatchers: ExtendedDispatcher[],
  utAssignments: Map<string, number>
): void {
  // Collect remaining empty UT slots across the week
  const remainingSlots: Array<{ day: Day; slot: TimeSlot }> = [];
  Object.entries(weekSchedule).forEach(([dayName, daySchedule]) => {
    timeSlots.forEach(slot => {
      if (daySchedule[slot]['UT'] === '') {
        remainingSlots.push({ day: dayName as Day, slot });
      }
    });
  });

  if (remainingSlots.length === 0) {
    log('[UT Assignment] No remaining UT slots to assign');
    return;
  }

  log(`[UT Assignment] ${remainingSlots.length} unfilled UT slots remain – assigning to volunteers`);

  // Dispatchers who volunteered for extra UT, sorted by seniority
  const extraUtDispatchers = sortedDispatchers.filter(d => d.wantsExtraUtility);

  if (extraUtDispatchers.length === 0) {
    log('[UT Assignment] No volunteers for extra UT slots');
    return;
  }

  let slotIndex = 0;
  // Iterate through dispatchers in seniority order, cycling until no slots remain or no assignment possible
  outer: while (slotIndex < remainingSlots.length) {
    let progress = false;

    for (const dispatcher of extraUtDispatchers) {
      if (slotIndex >= remainingSlots.length) break outer;

      const { day, slot } = remainingSlots[slotIndex];
      const daySchedule = weekSchedule[day];
      if (!daySchedule) continue;

      // Skip if dispatcher not working on that day
      if (dispatcher.workDays && dispatcher.workDays.length > 0 && !dispatcher.workDays.includes(day)) {
        continue;
      }

      // Respect shift when possible
      if (dispatcher.shift && !SHIFT_SLOTS[dispatcher.shift]?.includes(slot)) {
        continue;
      }

      // Avoid double-booking: ensure the dispatcher isn't already assigned in this slot
      const dispatcherKey = dispatcher.id;
      if (isDispatcherInTimeslot(dispatcherKey, daySchedule, slot)) {
        continue;
      }

      daySchedule[slot]['UT'] = dispatcherKey;
      const prev = utAssignments.get(dispatcherKey) || 0;
      utAssignments.set(dispatcherKey, prev + 1);
      console.log(`[UT Assignment] Assigned EXTRA UT to ${dispatcher.id} on ${day} ${slot}`);
      slotIndex++;
      progress = true;
    }

    // If no assignment was made in an iteration, break to avoid infinite loop
    if (!progress) {
      warn('[UT Assignment] Unable to fill remaining UT slots with available volunteers');
      break;
    }
  }
}

/**
 * Counts UT assignments for a dispatcher across the week
 */
// Removed unused: countUTAssignments, getUTAssignments
