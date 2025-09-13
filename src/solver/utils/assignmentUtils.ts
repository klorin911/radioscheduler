import { Day, TimeSlot, Column, columns, timeSlots, isCellDisabled } from '../../constants';
import { ExtendedDispatcher, extractBadgeNumber } from '../../appTypes';
import { ScheduleDay, Assignment, AssignmentResult } from '../solverTypes';
import { getEligibleSlots, isEligibleOnDayForSlot, getPreviousDay } from './shiftUtils';
import { isDispatcherInTimeslot } from './scheduleOps';

// Debug logging toggle for scheduler utils
const DEBUG = false;
const log = (...args: unknown[]) => { if (DEBUG) console.log(...args); };

/**
 * Computes seniority rank (lower value = more senior).
 * Prefers explicit dispatcher.seniority (1 = most senior).
 * Falls back to numeric badgeNumber, then digits parsed from string badgeNumber (e.g., "D3016" -> 3016),
 * and finally falls back to extractBadgeNumber(id).
 */
function getSeniorityRank(d: ExtendedDispatcher): number {
  // Prefer explicit seniority rank if present
  if (typeof d.seniority === 'number' && !Number.isNaN(d.seniority)) {
    return d.seniority;
  }
  // Prefer numeric badgeNumber if available
  if (typeof d.badgeNumber === 'number' && !Number.isNaN(d.badgeNumber)) {
    return d.badgeNumber;
  }
  // Handle string badge formats in persisted data (e.g., "D3045")
  const raw: unknown = (d as unknown as { badgeNumber?: unknown }).badgeNumber;
  if (typeof raw === 'string') {
    const m = raw.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  // Fallback: derive a stable numeric ordering from the ID
  return extractBadgeNumber(d.id);
}

/**
 * Filters and sorts dispatchers by availability and seniority
 */
export function prepareDispatchers(dispatchers: ExtendedDispatcher[], day: Day): ExtendedDispatcher[] {
  // Filter dispatchers available for this day
  const availableDispatchers = dispatchers.filter(d => {
    if (d.excludeFromAutoSchedule) {
      log(`[Scheduler] ${day}: Skipping ${d.id} - excluded from auto schedule`);
      return false;
    }
    // Trainees never get radio assignments (auto or manual)
    if (d.isTrainee || d.traineeOf) {
      log(`[Scheduler] ${day}: Skipping ${d.id} - trainee`);
      return false;
    }
    if (d.workDays && d.workDays.length > 0 && !d.workDays.includes(day)) {
      // Allow E/F shift spillover eligibility if they worked the previous day
      const prev = getPreviousDay(day);
      const spilloverEligible = (d.shift === 'E' || d.shift === 'F') && d.workDays.includes(prev);
      if (!spilloverEligible) {
        log(`[Scheduler] ${day}: Skipping ${d.id} - not a work day`);
        return false;
      }
    }
    return true;
  });
  
  // Sort by seniority (lower badge number = higher seniority)
  const sortedDispatchers = availableDispatchers.sort((a, b) => getSeniorityRank(a) - getSeniorityRank(b));
  
  log(`[Scheduler] ${day}: Processing ${sortedDispatchers.length} dispatchers by seniority:`);
  sortedDispatchers.forEach(d => {
    log(`  - ${d.id} (badge: ${extractBadgeNumber(d.id)})`);
  });
  
  return sortedDispatchers;
}

/**
 * Generates all possible assignments for a dispatcher with preferences
 * Sorted by priority (lower = better)
 */
export function generatePreferredAssignments(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay
): Assignment[] {
  const hasChannelPrefs = dispatcher.preferredChannels && dispatcher.preferredChannels.length > 0;
  const hasTimePrefs = dispatcher.preferredTimeBlocks && dispatcher.preferredTimeBlocks.length > 0;

  // Hoist eligible slots; this also acts as the default for time preferences
  const eligibleSlots = getEligibleSlots(dispatcher);

  // Start from UI-provided or all columns, then exclude UT robustly
  const rawChannelPrefs = hasChannelPrefs ? (dispatcher.preferredChannels! as Column[]) : [...columns];
  const channelPrefs = rawChannelPrefs.filter((col) => col !== 'UT' && col !== 'RELIEF') as Column[];

  // Use provided time preferences or default to eligible shift slots
  const timePrefs = hasTimePrefs ? (dispatcher.preferredTimeBlocks! as TimeSlot[]) : eligibleSlots;
  
  const assignments: Assignment[] = [];

  // Weight time rank over channel rank deterministically
  const channelWeightBase = channelPrefs.length + 1;

  timePrefs.forEach((slot, timeIdx) => {
    // Respect shift restrictions when custom time preferences exist
    if (!eligibleSlots.includes(slot)) {
      return;
    }
    
    channelPrefs.forEach((col, channelIdx) => {
      // Skip if slot already filled
      if (schedule[slot][col]) {
        return;
      }
      
      // Calculate priority: time-weighted rank + channel rank (lower = better)
      const priority = timeIdx * channelWeightBase + channelIdx;
      assignments.push({ slot, col, priority });
    });
  });
  
  // Sort by priority (best preferences first)
  return assignments.sort((a, b) => a.priority - b.priority);
}

/**
 * Assigns a minimum slot to a dispatcher without preferences
 */
export function assignMinimumSlot(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay,
  day: Day
): AssignmentResult {
  log(`[Scheduler] ${day}: ${dispatcher.id} has no preferences, assigning minimum slot`);
  
  // Determine eligible time slots strictly within the dispatcher's shift hours (or all if no shift defined)
  const eligibleSlots = getEligibleSlots(dispatcher);
  const dispatcherKey = dispatcher.id;

  // Build balancing counts (exclude UT) to reduce first-available bias
  const colFillCount: Record<Column, number> = {} as Record<Column, number>;
  columns.forEach((c) => { if (c !== 'UT' && c !== 'RELIEF') colFillCount[c] = 0 as number; });

  const slotFillCount: Record<TimeSlot, number> = {} as Record<TimeSlot, number>;
  timeSlots.forEach((s) => { slotFillCount[s] = 0 as number; });

  timeSlots.forEach((s) => {
    columns.forEach((c) => {
      if (c === 'UT' || c === 'RELIEF') return;
      const v = schedule[s][c];
      if (v && v.trim().length > 0) {
        slotFillCount[s]++;
        colFillCount[c] = (colFillCount[c] || 0) + 1;
      }
    });
  });

  // Sort eligible slots by current fill (ascending) to favor emptier time blocks
  const sortedEligibleSlots = [...eligibleSlots].sort((a, b) => slotFillCount[a] - slotFillCount[b]);

  // Select the emptiest valid slot, then the least-used column within that slot (excluding UT)
  let assignment: { slot: TimeSlot; col: Column } | null = null;
  for (const slot of sortedEligibleSlots) {
    // Respect day availability (no spillover)
    if (!isEligibleOnDayForSlot(dispatcher, day, slot)) continue;
    if (isDispatcherInTimeslot(dispatcherKey, schedule, slot)) continue;

    // Find candidate columns: non-UT, empty, and not disabled by business rule
    const candidateCols = columns.filter((c) =>
      c !== 'UT' &&
      c !== 'RELIEF' &&
      !schedule[slot][c] &&
      !isCellDisabled(day, slot, c)
    );
    if (candidateCols.length === 0) continue;

    // Pick least-used column for the day (tie-breaker: original order)
    candidateCols.sort((c1, c2) => (colFillCount[c1] || 0) - (colFillCount[c2] || 0));
    const chosenCol = candidateCols[0];
    assignment = { slot, col: chosenCol };
    break;
  }

  if (assignment) {
    schedule[assignment.slot][assignment.col] = dispatcherKey;
    log(`[Scheduler] ${day}: Assigned ${dispatcher.id} minimum slot at ${assignment.slot}/${assignment.col}`);
    return {
      success: true,
      assignment: { ...assignment, priority: 0 },
      dispatcherKey
    };
  }
  
  log(`[Scheduler] ${day}: ${dispatcher.id} could not be assigned any slot`);
  return { success: false, error: 'No available slots' };
}

/**
 * Assigns preferred slot to a dispatcher with preferences
 */
export function assignPreferredSlot(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay,
  day: Day
): AssignmentResult {
  const preferredAssignments = generatePreferredAssignments(dispatcher, schedule);
  
  log(`[Scheduler] ${day}: ${dispatcher.id} has ${preferredAssignments.length} preferred options`);

  const dispatcherKey = dispatcher.id;
  for (const a of preferredAssignments) {
    // Respect day availability (no spillover)
    if (!isEligibleOnDayForSlot(dispatcher, day, a.slot)) continue;
    // Respect business rule: skip disabled cells (e.g., MT blocked times)
    if (isCellDisabled(day, a.slot, a.col)) continue;
    // Ensure dispatcher is not already in the chosen timeslot
    if (isDispatcherInTimeslot(dispatcherKey, schedule, a.slot)) continue;
    // Re-check that the target cell is still empty (schedule may have changed since generation)
    const current = schedule[a.slot][a.col];
    if (current && current.trim().length > 0) continue;

    schedule[a.slot][a.col] = dispatcherKey;
    log(`[Scheduler] ${day}: Assigned ${dispatcher.id} to ${a.slot}/${a.col} (priority ${a.priority})`);
    return {
      success: true,
      assignment: a,
      dispatcherKey
    };
  }
  
  log(`[Scheduler] ${day}: No available preferred slots for ${dispatcher.id}`);
  return { success: false, error: 'No available preferred slots' };
}

/**
 * Assigns an additional radio slot to a dispatcher who wants extra radio
 */
export function assignExtraRadioSlot(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay,
  day: Day
): AssignmentResult {
  log(`[ExtraRadio] ${day}: Attempting extra radio assignment for ${dispatcher.id}`);

  const dispatcherKey = dispatcher.id;

  // 1) If dispatcher has preferences, try to assign a preferred slot first.
  if (hasPreferences(dispatcher)) {
    const preferredAssignments = generatePreferredAssignments(dispatcher, schedule).filter(a => a.col !== 'UT' && a.col !== 'RELIEF');
    for (const assignment of preferredAssignments) {
      if (
        // Ensure the assignment is valid for this calendar day (handles E/F spillover rules)
        isEligibleOnDayForSlot(dispatcher, day, assignment.slot) &&
        schedule[assignment.slot][assignment.col] === '' &&
        !isDispatcherInTimeslot(dispatcherKey, schedule, assignment.slot) &&
        !isCellDisabled(day, assignment.slot, assignment.col)
      ) {
        schedule[assignment.slot][assignment.col] = dispatcherKey;
        log(
          `[ExtraRadio] ${day}: Assigned preferred extra slot to ${dispatcher.id} at ${assignment.slot} ${assignment.col}`
        );
        return { success: true, assignment, dispatcherKey };
      }
    }
    log(`[ExtraRadio] ${day}: All preferred slots for ${dispatcher.id} were taken. Trying fallback.`);
  }

  // 2) Fallback – If no preferences OR all preferred slots were taken, find any available radio slot.
  const eligibleSlots = getEligibleSlots(dispatcher);

  // Build balancing counts (exclude UT and RELIEF) similar to minimum-slot assignment
  const colFillCount: Record<Column, number> = {} as Record<Column, number>;
  columns.forEach((c) => { if (c !== 'UT' && c !== 'RELIEF') colFillCount[c] = 0 as number; });

  const slotFillCount: Record<TimeSlot, number> = {} as Record<TimeSlot, number>;
  timeSlots.forEach((s) => { slotFillCount[s] = 0 as number; });

  timeSlots.forEach((s) => {
    columns.forEach((c) => {
      if (c === 'UT' || c === 'RELIEF') return;
      const v = schedule[s][c];
      if (v && v.trim().length > 0) {
        slotFillCount[s]++;
        colFillCount[c] = (colFillCount[c] || 0) + 1;
      }
    });
  });

  const sortedEligibleSlots = [...eligibleSlots].sort((a, b) => slotFillCount[a] - slotFillCount[b]);

  for (const slot of sortedEligibleSlots) {
    // Respect day availability (no spillover)
    if (!isEligibleOnDayForSlot(dispatcher, day, slot)) continue;
    if (isDispatcherInTimeslot(dispatcherKey, schedule, slot)) continue;

    const candidateCols = columns.filter((c) =>
      c !== 'UT' &&
      c !== 'RELIEF' &&
      !schedule[slot][c] &&
      !isCellDisabled(day, slot, c)
    );
    if (candidateCols.length === 0) continue;

    candidateCols.sort((c1, c2) => (colFillCount[c1] || 0) - (colFillCount[c2] || 0));
    const col = candidateCols[0];
    schedule[slot][col] = dispatcherKey;
    log(`[ExtraRadio] ${day}: Assigned balanced fallback extra slot to ${dispatcher.id} at ${slot} ${col}`);
    return {
      success: true,
      assignment: { slot, col, priority: 0 },
      dispatcherKey
    };
  }

  log(`[ExtraRadio] ${day}: No available extra slots for ${dispatcher.id}`);
  return { success: false, error: 'No available extra slots' };
}

/**
 * Checks if a dispatcher has preferences
 */
export function hasPreferences(dispatcher: ExtendedDispatcher): boolean {
  const hasChannelPrefs = !!(dispatcher.preferredChannels && dispatcher.preferredChannels.length > 0);
  const hasTimePrefs = !!(dispatcher.preferredTimeBlocks && dispatcher.preferredTimeBlocks.length > 0);
  return hasChannelPrefs || hasTimePrefs;
}
