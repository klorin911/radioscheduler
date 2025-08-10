import { TimeSlot, timeSlots } from '../../constants';
import { ExtendedDispatcher } from '../../types';

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

/**
 * Gets all shifts that include a specific time slot
 */
export function getShiftsForSlot(slot: TimeSlot): string[] {
  return Object.entries(SHIFT_SLOTS)
    .filter(([, slots]) => slots.includes(slot))
    .map(([shift]) => shift);
}

/**
 * Validates that a shift letter is valid
 */
export function isValidShift(shift: string): boolean {
  return Object.keys(SHIFT_SLOTS).includes(shift);
}

/**
 * Gets the time slots for a specific shift
 */
export function getShiftSlots(shift: string): TimeSlot[] {
  return SHIFT_SLOTS[shift] || [];
}
