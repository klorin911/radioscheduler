import { days, Day, Schedule } from '../constants';
import { ExtendedDispatcher } from '../appTypes';
import { generateScheduleForDay } from './dayScheduler';
import { ScheduleDay } from './solverTypes';
import { assignUTSlots } from './utils/utAssignmentUtils';
import { cloneScheduleDay, mergeScheduleDays, hasAnyAssignments, normalizeScheduleWeekToIds } from './utils/scheduleOps';
import { applyShiftAwareFallback } from './utils/fallbackUtils';

export async function generateWeeklySchedule(
  current: Schedule,
  dispatchers: ExtendedDispatcher[]
): Promise<Schedule> {
  console.log('[WeekScheduler] Starting weekly schedule generation');
  
  const newSchedule: Schedule = cloneWeeklySchedule(current);
  
  // Process each day
  for (const day of days) {
    const dayResult = await processDaySchedule(day, dispatchers, current[day]);
    newSchedule[day] = dayResult;
  }
  
  // Normalize to IDs then assign exactly one UT slot per dispatcher per work week
  const normalized = normalizeScheduleWeekToIds(newSchedule, dispatchers);
  assignUTSlots(normalized, dispatchers);
  // Replace newSchedule with normalized (mutated by UT assignment)
  days.forEach((d) => {
    newSchedule[d] = normalized[d];
  });
  
  console.log('[WeekScheduler] Weekly schedule generation complete');
  return newSchedule;
}

/**
 * Creates a deep clone of the weekly schedule
 */
function cloneWeeklySchedule(schedule: Schedule): Schedule {
  const cloned = {} as Schedule;
  days.forEach(day => {
    cloned[day] = cloneScheduleDay(schedule[day]);
  });
  return cloned;
}

/**
 * Processes scheduling for a single day
 */
async function processDaySchedule(
  day: Day,
  dispatchers: ExtendedDispatcher[],
  currentDaySchedule: ScheduleDay
): Promise<ScheduleDay> {
  console.log(`[WeekScheduler] Processing ${day}`);

  // Generate new schedule for the day using the current schedule as locked
  const solvedDay = await generateScheduleForDay(day, dispatchers, currentDaySchedule);
  
  // Merge with existing schedule (solved takes precedence for non-empty values)
  const mergedDay = mergeScheduleDays(currentDaySchedule, solvedDay);
  
  // Check if we have any assignments
  const hasAssignments = hasAnyAssignments(mergedDay);
  console.log(`[WeekScheduler] ${day}: hasAssignment=${hasAssignments}`);
  
  // Apply fallback if no assignments were made (respect shifts and work days)
  if (!hasAssignments) {
    return applyShiftAwareFallback(day, dispatchers, mergedDay);
  }
  
  return mergedDay;
}
