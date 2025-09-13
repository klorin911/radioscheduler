import { Day, TimeSlot, timeSlots, days } from '../../constants';
import { ExtendedDispatcher } from '../../appTypes';

/**
 * Define shift time slots for each shift letter
 */
export const SHIFT_SLOTS: Record<string, TimeSlot[]> = {
  A: ['0330-0530','0530-0730','0730-0930','0930-1130','1130-1330'],
  B: ['0730-0930','0930-1130','1130-1330','1330-1530','1530-1730'],
  C: ['1130-1330','1330-1530','1530-1730','1730-1930','1930-2130'],
  D: ['1330-1530','1530-1730','1730-1930','1930-2130','2130-2330'],
  E: ['1730-1930','1930-2130','2130-2330','2330-0130','0130-0330'],
  F: ['2130-2330','2330-0130','0130-0330','0330-0530','0530-0730'],
};

/**
 * Gets eligible time slots for a dispatcher based on their shift
 * If no shift is specified, returns all time slots
 */
export function getEligibleSlots(dispatcher: ExtendedDispatcher): TimeSlot[] {
  return dispatcher.shift ? SHIFT_SLOTS[dispatcher.shift] || [...timeSlots] : [...timeSlots];
}

/**
 * Checks if a time slot is within a dispatcher's shift
 */
export function isSlotInShift(dispatcher: ExtendedDispatcher, slot: TimeSlot): boolean {
  if (!dispatcher.shift) return true;
  const shiftSlots = SHIFT_SLOTS[dispatcher.shift];
  return shiftSlots ? shiftSlots.includes(slot) : true;
}

// Removed unused helper exports: getShiftsForSlot, isValidShift, getShiftSlots

/**
 * Returns the previous day in the week (Monday -> Sunday, etc.)
 */
export function getPreviousDay(day: Day): Day {
  const idx = days.indexOf(day);
  const prevIdx = (idx - 1 + days.length) % days.length;
  return days[prevIdx] as Day;
}

// Overnight spillover time slots by shift for the NEXT calendar day
const OVERNIGHT_SLOTS_E: ReadonlyArray<TimeSlot> = ['2330-0130', '0130-0330'];
const OVERNIGHT_SLOTS_F: ReadonlyArray<TimeSlot> = ['2330-0130', '0130-0330', '0330-0530', '0530-0730'];

/**
 * Checks if a next-day time slot counts as spillover for a given shift (E or F).
 */
export function isSpilloverSlotForShift(shift: string | undefined, slot: TimeSlot): boolean {
  if (!shift) return false;
  if (shift === 'E') return OVERNIGHT_SLOTS_E.includes(slot);
  if (shift === 'F') return OVERNIGHT_SLOTS_F.includes(slot);
  return false;
}

/**
 * Determines if a dispatcher is eligible to work a specific timeslot on the given day.
 * Rules:
 * - If no workDays are defined, they are available every day.
 * - If the selected day is in workDays, it's valid.
 * - If not, allow overnight spillover for E/F shifts when the previous day is in workDays
 *   and the chosen slot is one of the spillover slots for that shift.
 * - If followTrainerSchedule applies, trainer's days/shift are used.
 */
export function isEligibleOnDayForSlot(
  dispatcher: ExtendedDispatcher,
  day: Day,
  slot: TimeSlot,
  trainer?: ExtendedDispatcher
): boolean {
  // Resolve effective work days and shift (trainer may override for trainees following trainer schedule)
  let effectiveDays = dispatcher.workDays;
  let effectiveShift = dispatcher.shift as string | undefined;

  if (dispatcher.followTrainerSchedule && trainer) {
    effectiveDays = trainer.workDays ?? effectiveDays;
    effectiveShift = trainer.shift ?? effectiveShift;
  }

  // No workDays set -> available all days
  if (!effectiveDays || effectiveDays.length === 0) return true;

  // Same calendar day is always valid
  if (effectiveDays.includes(day)) return true;

  // Allow overnight spillover for E/F shifts into the next calendar day
  const prev = getPreviousDay(day);
  if (effectiveShift && isSpilloverSlotForShift(effectiveShift, slot) && effectiveDays.includes(prev)) {
    return true;
  }

  return false;
}
