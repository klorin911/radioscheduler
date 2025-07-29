import { days, Day, Schedule, timeSlots, columns } from '../constants';
import { Dispatcher } from '../types';
import { generateScheduleForDay, ScheduleDay } from './glpkScheduler';

export async function generateWeeklySchedule(
  current: Schedule,
  dispatchers: Array<Dispatcher & {
    workDays?: string[];
    preferredChannels?: string[];
    preferredTimeBlocks?: string[];
  }>
): Promise<Schedule> {
  const newSchedule: Schedule = JSON.parse(JSON.stringify(current));
  for (const day of days) {
    const solved: ScheduleDay = await generateScheduleForDay(day as Day, dispatchers, current[day]);
    // merge intelligently
    const mergedDay: ScheduleDay = JSON.parse(JSON.stringify(current[day]));
    timeSlots.forEach((slot) => {
      columns.forEach((col) => {
        const val: string = solved[slot][col];
        if (val) mergedDay[slot][col] = val;
      });
    });
    // If solver returned no assignments, apply simple round-robin fallback
    const hasAssignment = timeSlots.some(slot =>
      columns.some(col => mergedDay[slot][col].length > 0)
    );
    console.log(`[WeekScheduler] ${day}: hasAssignment=${hasAssignment}`);
    const availableDispatchers = dispatchers.filter(d => !d.workDays || d.workDays.length === 0 || d.workDays.includes(day));
    if (!hasAssignment && availableDispatchers.length > 0) {
      console.log(`[WeekScheduler] ${day}: Using round-robin fallback with ${availableDispatchers.length} dispatchers`);
      timeSlots.forEach((slot) => {
        let ai = 0;
        columns.forEach((col) => {
          if (ai < availableDispatchers.length) {
            mergedDay[slot][col] = availableDispatchers[ai].name || availableDispatchers[ai].id;
            ai++;
          } else {
            mergedDay[slot][col] = '';
          }
        });
      });
    }
    newSchedule[day] = mergedDay;
  }
  return newSchedule;
}
