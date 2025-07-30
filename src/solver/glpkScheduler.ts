import { Day, TimeSlot, Column, timeSlots, columns } from '../constants';
import { Dispatcher } from '../types';

export type ExtendedDispatcher = Dispatcher & {
  workDays?: string[];
  preferredChannels?: string[];
  preferredTimeBlocks?: string[];
  shift?: string;
};

const shiftSlots: Record<string, TimeSlot[]> = {
  A: ['0330-0530','0530-0730','0730-0930','0930-1130','1130-1330'],
  B: ['0730-0930','0930-1130','1130-1330','1330-1530','1530-1730'],
  C: ['1130-1330','1330-1530','1530-1730','1730-1930','1930-2130'],
  D: ['1330-1530','1530-1730','1730-1930','1930-2130','2130-2330'],
  E: ['1730-1930','1930-2130','2130-2330','2330-0130','0130-0330'],
  F: ['2130-2330','2330-0130','0130-0330','0330-0530','0530-0730'],
};



export type ScheduleDay = Record<TimeSlot, Record<Column, string>>;



function createEmptyDay(): ScheduleDay {
  const day = {} as Record<TimeSlot, Record<Column, string>>;
  timeSlots.forEach((slot) => {
    const row = {} as Record<Column, string>;
    columns.forEach((c) => {
      row[c] = '';
    });
    day[slot] = row;
  });
  return day as ScheduleDay;
}

/**
 * Generate a schedule for a single day using MILP solved by glpk.js.
 * @param day Day of week
 * @param dispatchers list including availability information (workDays, prefs)
 */
function extractBadgeNumber(id: string): number {
  const match = id.match(/\d+/);
  return match ? parseInt(match[0]) : 9999; // default high number for non-standard IDs
}

export async function generateScheduleForDay(
  day: Day,
  dispatchers: ExtendedDispatcher[],
  locked?: ScheduleDay // existing assignments to keep
): Promise<ScheduleDay> {

  // Start with existing locked assignments
  const schedule: ScheduleDay = locked ? JSON.parse(JSON.stringify(locked)) : createEmptyDay();
  
  // Filter dispatchers available for this day
  const availableDispatchers = dispatchers.filter(d => {
    if (d.workDays && d.workDays.length && !d.workDays.includes(day)) {
      console.log(`[Sequential] ${day}: Skipping ${d.id} - not available on ${day}`);
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
  
  console.log(`[Sequential] ${day}: Processing ${sortedDispatchers.length} dispatchers by seniority:`);
  sortedDispatchers.forEach(d => {
    console.log(`  - ${d.id} (badge: ${extractBadgeNumber(d.id)})`);
  });

  // Sequential assignment by seniority
  for (const dispatcher of sortedDispatchers) {
    console.log(`\n[Sequential] ${day}: Processing ${dispatcher.id}`);
    
    // Skip if dispatcher has no preferences (they get nothing)
    const hasChannelPrefs = dispatcher.preferredChannels && dispatcher.preferredChannels.length > 0;
    const hasTimePrefs = dispatcher.preferredTimeBlocks && dispatcher.preferredTimeBlocks.length > 0;
    
    if (!hasChannelPrefs && !hasTimePrefs) {
      console.log(`[Sequential] ${day}: ${dispatcher.id} has no preferences, skipping`);
      continue;
    }
    
    // Generate all preferred slot combinations
    const preferredAssignments: { slot: TimeSlot; col: Column; priority: number }[] = [];
    
    const channelPrefs = hasChannelPrefs ? (dispatcher.preferredChannels! as Column[]) : [...columns];
    const timePrefs = hasTimePrefs ? (dispatcher.preferredTimeBlocks! as TimeSlot[]) : [...timeSlots];
    
    timePrefs.forEach((slot, timeIdx) => {
      // Check shift restrictions
      if (dispatcher.shift && !shiftSlots[dispatcher.shift]?.includes(slot)) {
        return;
      }
      
      channelPrefs.forEach((col, channelIdx) => {
        // Skip if slot already filled
        if (schedule[slot][col]) {
          return;
        }
        
        // Calculate priority (lower = better): time preference rank + channel preference rank
        const priority = timeIdx + channelIdx;
        preferredAssignments.push({ slot, col, priority });
      });
    });
    
    // Sort by priority (best preferences first)
    preferredAssignments.sort((a, b) => a.priority - b.priority);
    
    console.log(`[Sequential] ${day}: ${dispatcher.id} has ${preferredAssignments.length} preferred options`);
    
    // Assign the best available preference
    if (preferredAssignments.length > 0) {
      const assignment = preferredAssignments[0];
      schedule[assignment.slot][assignment.col] = dispatcher.name || dispatcher.id;
      console.log(`[Sequential] ${day}: Assigned ${dispatcher.id} to ${assignment.slot}/${assignment.col} (priority ${assignment.priority})`);
    } else {
      console.log(`[Sequential] ${day}: No available preferred slots for ${dispatcher.id}`);
    }
  }

  console.log(`[Sequential] ${day}: Assignment complete`);
  return schedule;
}
