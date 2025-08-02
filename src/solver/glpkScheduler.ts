import { Day, TimeSlot, Column, timeSlots, columns } from '../constants';
import { ExtendedDispatcher, extractBadgeNumber } from '../types';

// Define shift time slots for each shift letter
const SHIFT_SLOTS: Record<string, TimeSlot[]> = {
  A: ['0330-0530','0530-0730','0730-0930','0930-1130','1130-1330'],
  B: ['0730-0930','0930-1130','1130-1330','1330-1530','1530-1730'],
  C: ['1130-1330','1330-1530','1530-1730','1730-1930','1930-2130'],
  D: ['1330-1530','1530-1730','1730-1930','1930-2130','2130-2330'],
  E: ['1730-1930','1930-2130','2130-2330','2330-0130','0130-0330'],
  F: ['2130-2330','2330-0130','0130-0330','0330-0530','0530-0730'],
};

export type ScheduleDay = Record<TimeSlot, Record<Column, string>>;

// Assignment interface for better type safety
interface Assignment {
  slot: TimeSlot;
  col: Column;
  priority: number;
}

/**
 * Creates an empty schedule for a day with all slots unassigned
 */
function createEmptyDay(): ScheduleDay {
  const day = {} as Record<TimeSlot, Record<Column, string>>;
  timeSlots.forEach((slot) => {
    const row = {} as Record<Column, string>;
    columns.forEach((col) => {
      row[col] = '';
    });
    day[slot] = row;
  });
  return day as ScheduleDay;
}

/**
 * Gets eligible time slots for a dispatcher based on their shift
 */
function getEligibleSlots(dispatcher: ExtendedDispatcher): TimeSlot[] {
  return dispatcher.shift ? SHIFT_SLOTS[dispatcher.shift] || [...timeSlots] : [...timeSlots];
}

/**
 * Finds the first available slot from a list of slots
 */
function findFirstAvailableSlot(
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
 * Assigns a minimum slot to a dispatcher without preferences
 * Returns true if successful, false otherwise
 */
function assignMinimumSlot(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay,
  day: Day
): boolean {
  console.log(`[Scheduler] ${day}: ${dispatcher.id} has no preferences, assigning minimum slot`);
  
  // Try to assign within shift hours first
  const eligibleSlots = getEligibleSlots(dispatcher);
  let assignment = findFirstAvailableSlot(eligibleSlots, schedule);
  
  // If dispatcher has shift but no eligible slots available within shift, try any slot
  if (!assignment && dispatcher.shift) {
    console.log(`[Scheduler] ${day}: ${dispatcher.id} has shift ${dispatcher.shift} but no slots available, trying any slot`);
    assignment = findFirstAvailableSlot([...timeSlots], schedule);
  }
  
  if (assignment) {
    schedule[assignment.slot][assignment.col] = dispatcher.name || dispatcher.id;
    console.log(`[Scheduler] ${day}: Assigned ${dispatcher.id} minimum slot at ${assignment.slot}/${assignment.col}`);
    return true;
  }
  
  console.log(`[Scheduler] ${day}: ${dispatcher.id} could not be assigned any slot`);
  return false;
}

/**
 * Generates all possible assignments for a dispatcher with preferences
 * Sorted by priority (lower = better)
 */
function generatePreferredAssignments(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay
): Assignment[] {
  const hasChannelPrefs = dispatcher.preferredChannels && dispatcher.preferredChannels.length > 0;
  const hasTimePrefs = dispatcher.preferredTimeBlocks && dispatcher.preferredTimeBlocks.length > 0;
  
  const channelPrefs = hasChannelPrefs ? (dispatcher.preferredChannels! as Column[]) : [...columns];
  const timePrefs = hasTimePrefs ? (dispatcher.preferredTimeBlocks! as TimeSlot[]) : [...timeSlots];
  
  const assignments: Assignment[] = [];
  
  timePrefs.forEach((slot, timeIdx) => {
    // Respect shift restrictions
    if (dispatcher.shift && !SHIFT_SLOTS[dispatcher.shift]?.includes(slot)) {
      return;
    }
    
    channelPrefs.forEach((col, channelIdx) => {
      // Skip if slot already filled
      if (schedule[slot][col]) {
        return;
      }
      
      // Calculate priority: time preference rank + channel preference rank (lower = better)
      const priority = timeIdx + channelIdx;
      assignments.push({ slot, col, priority });
    });
  });
  
  // Sort by priority (best preferences first)
  return assignments.sort((a, b) => a.priority - b.priority);
}

/**
 * Assigns preferred slot to a dispatcher with preferences
 * Returns true if successful, false otherwise
 */
function assignPreferredSlot(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay,
  day: Day
): boolean {
  const preferredAssignments = generatePreferredAssignments(dispatcher, schedule);
  
  console.log(`[Scheduler] ${day}: ${dispatcher.id} has ${preferredAssignments.length} preferred options`);
  
  if (preferredAssignments.length > 0) {
    const assignment = preferredAssignments[0];
    schedule[assignment.slot][assignment.col] = dispatcher.name || dispatcher.id;
    console.log(`[Scheduler] ${day}: Assigned ${dispatcher.id} to ${assignment.slot}/${assignment.col} (priority ${assignment.priority})`);
    return true;
  }
  
  console.log(`[Scheduler] ${day}: No available preferred slots for ${dispatcher.id}`);
  return false;
}

/**
 * Processes a single dispatcher assignment
 * Returns true if dispatcher was assigned, false otherwise
 */
function processDispatcherAssignment(
  dispatcher: ExtendedDispatcher,
  schedule: ScheduleDay,
  day: Day
): boolean {
  console.log(`[Scheduler] ${day}: Processing ${dispatcher.id}`);
  
  const hasChannelPrefs = dispatcher.preferredChannels && dispatcher.preferredChannels.length > 0;
  const hasTimePrefs = dispatcher.preferredTimeBlocks && dispatcher.preferredTimeBlocks.length > 0;
  
  // Handle dispatchers without preferences - assign minimum slot
  if (!hasChannelPrefs && !hasTimePrefs) {
    const assigned = assignMinimumSlot(dispatcher, schedule, day);
    if (assigned) {
      console.log(`[Scheduler] ${day}: ${dispatcher.id} assigned minimum slot, skipping preference assignment`);
    }
    return assigned;
  }
  
  // Handle dispatchers with preferences
  return assignPreferredSlot(dispatcher, schedule, day);
}

/**
 * Filters and sorts dispatchers by availability and seniority
 */
function prepareDispatchers(dispatchers: ExtendedDispatcher[], day: Day): ExtendedDispatcher[] {
  // Filter dispatchers available for this day
  const availableDispatchers = dispatchers.filter(d => {
    if (d.workDays && d.workDays.length && !d.workDays.includes(day)) {
      console.log(`[Scheduler] ${day}: Skipping ${d.id} - not available on ${day}`);
      return false;
    }
    return true;
  });
  
  // Sort by seniority (lower badge number = higher seniority)
  const sortedDispatchers = availableDispatchers.sort((a, b) => {
    const badgeA = extractBadgeNumber(a.id);
    const badgeB = extractBadgeNumber(b.id);
    return badgeA - badgeB; // ascending order (lower numbers first)
  });
  
  console.log(`[Scheduler] ${day}: Processing ${sortedDispatchers.length} dispatchers by seniority:`);
  sortedDispatchers.forEach(d => {
    console.log(`  - ${d.id} (badge: ${extractBadgeNumber(d.id)})`);
  });
  
  return sortedDispatchers;
}

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
  console.log(`[Scheduler] ${day}: Starting schedule generation`);
  
  // Start with existing locked assignments
  const schedule: ScheduleDay = locked ? JSON.parse(JSON.stringify(locked)) : createEmptyDay();
  
  // Prepare dispatchers (filter and sort by seniority)
  const sortedDispatchers = prepareDispatchers(dispatchers, day);
  
  // Process each dispatcher in seniority order
  let assignedCount = 0;
  for (const dispatcher of sortedDispatchers) {
    if (processDispatcherAssignment(dispatcher, schedule, day)) {
      assignedCount++;
    }
  }
  
  console.log(`[Scheduler] ${day}: Assignment complete - ${assignedCount}/${sortedDispatchers.length} dispatchers assigned`);
  return schedule;
}
