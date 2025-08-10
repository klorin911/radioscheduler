import { Day } from '../constants';
import { ExtendedDispatcher } from '../types';
import { ScheduleDay } from './types';
import { createEmptyScheduleDay, cloneScheduleDay, normalizeScheduleDayToIds } from './utils/scheduleUtils';
import { prepareDispatchers, assignMinimumSlot, assignPreferredSlot, assignExtraRadioSlot, hasPreferences } from './utils/assignmentUtils';

// Debug logging toggle for day scheduler
const DEBUG = false;
const log = (...args: unknown[]) => { if (DEBUG) console.log(...args); };
const warn = (...args: unknown[]) => { if (DEBUG) console.warn(...args); };

/**
 * Generate a schedule for a single day using optimized sequential assignment.
 * 
 * SCHEDULING RULES:
 * 1. Every dispatcher gets at least one slot per day
 * 2. Assignments respect dispatcher seniority (lower badge number = higher priority)
 * 3. Shift-based slot assignment (dispatchers assigned within their shift hours when possible)
 * 4. Preference handling for channels and time blocks
 * 5. Tooltip consistency (store dispatcher.name || dispatcher.id)
 * 
 * @param day Day of week
 * @param dispatchers list including availability information (workDays, preferences)
 * @param locked existing assignments to keep
 */
export async function generateScheduleForDay(
  day: Day,
  dispatchers: ExtendedDispatcher[],
  locked?: ScheduleDay
): Promise<ScheduleDay> {
  log(`[Scheduler] ${day}: Starting schedule generation`);
  
  // Start with existing locked assignments or create empty schedule, then normalize to IDs
  let schedule: ScheduleDay = locked ? cloneScheduleDay(locked) : createEmptyScheduleDay();
  schedule = normalizeScheduleDayToIds(schedule, dispatchers);
  
  // Prepare dispatchers (filter and sort by seniority)
  const sortedDispatchers = prepareDispatchers(dispatchers, day);
  
  // Process each dispatcher in seniority order
  const assignmentResults = processDispatcherAssignments(schedule, sortedDispatchers, day);
  
  // Second pass: assign extra radio slots to dispatchers who want them
  const extraAssignmentResults = processExtraRadioAssignments(schedule, sortedDispatchers, day);
  
  log(`[Scheduler] ${day}: Assignment complete - ${assignmentResults.assigned}/${sortedDispatchers.length} dispatchers assigned, ${extraAssignmentResults.assigned} extra radio slots assigned`);
  return schedule;
}

/**
 * Processes primary assignments for all dispatchers
 */
function processDispatcherAssignments(
  schedule: ScheduleDay,
  dispatchers: ExtendedDispatcher[],
  day: Day
): { assigned: number; failed: number } {
  let assignedCount = 0;
  let failedCount = 0;
  
  for (const dispatcher of dispatchers) {
    const result = processDispatcherAssignment(dispatcher, schedule, day);
    if (result.success) {
      assignedCount++;
    } else {
      failedCount++;
      warn(`[Scheduler] ${day}: Failed to assign ${dispatcher.id}: ${result.error}`);
    }
  }
  
  return { assigned: assignedCount, failed: failedCount };
}

/**
 * Processes a single dispatcher assignment
 */
function processDispatcherAssignment(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay,
  day: Day
) {
  log(`[Scheduler] ${day}: Processing ${dispatcher.id}`);
  
  // Handle dispatchers without preferences - assign minimum slot
  if (!hasPreferences(dispatcher)) {
    const result = assignMinimumSlot(dispatcher, schedule, day);
    if (result.success) {
      log(`[Scheduler] ${day}: ${dispatcher.id} assigned minimum slot, skipping preference assignment`);
    }
    return result;
  }
  
  // Handle dispatchers with preferences: try preferred, then rescue with minimum slot
  const preferred = assignPreferredSlot(dispatcher, schedule, day);
  if (preferred.success) {
    return preferred;
  }
  const fallback = assignMinimumSlot(dispatcher, schedule, day);
  if (fallback.success) {
    log(`[Scheduler] ${day}: ${dispatcher.id} fallback to minimum slot after preferred options unavailable`);
  }
  return fallback;
}

/**
 * Processes extra radio assignments for dispatchers who want them
 */
function processExtraRadioAssignments(
  schedule: ScheduleDay,
  dispatchers: ExtendedDispatcher[],
  day: Day
): { assigned: number; failed: number } {
  // Default: everyone is eligible for extra radio unless they choose Minimum Radio
  const extraRadioDispatchers = dispatchers.filter(d => !d.minimumRadioOnly);
  let assignedCount = 0;
  let failedCount = 0;
  
  for (const dispatcher of extraRadioDispatchers) {
    const result = assignExtraRadioSlot(dispatcher, schedule, day);
    if (result.success) {
      assignedCount++;
    } else {
      failedCount++;
    }
  }
  
  return { assigned: assignedCount, failed: failedCount };
}
