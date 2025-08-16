export const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const timeSlots = [
  '0330-0530',
  '0530-0730',
  '0730-0930',
  '0930-1130',
  '1130-1330',
  '1330-1530',
  '1530-1730',
  '1730-1930',
  '1930-2130',
  '2130-2330',
  '2330-0130',
  '0130-0330',
] as const;

export const columns = [
  'SW',
  'CE',
  'SE',
  'NE',
  'NW',
  'MT',
  'UT',
  'RELIEF',
] as const;

// Selectable channels for preferences (exclude UT and RELIEF from preferences)
export const selectableChannels = [
  'SW',
  'CE',
  'SE',
  'NE',
  'NW',
  'MT',
] as const;

export type Day = typeof days[number];
export type TimeSlot = typeof timeSlots[number];
export type Column = typeof columns[number];

export type Schedule = {
  [D in Day]: {
    [T in TimeSlot]: {
      [C in Column]: string;
    };
  };
};

/**
 * Business rule: Disable MT assignments during specific time ranges
 * - Mon-Fri: no MT at 0330-0530 or 0530-0730
 * - Sat-Sun: no MT from 0330 through 1530 start, i.e. disable up to and including 1330-1530
 */
const WEEKDAY_MT_DISABLED: ReadonlyArray<TimeSlot> = ['0330-0530', '0530-0730'];
const WEEKEND_MT_DISABLED: ReadonlyArray<TimeSlot> = [
  '0330-0530',
  '0530-0730',
  '0730-0930',
  '0930-1130',
  '1130-1330',
  '1330-1530',
];

/**
 * Returns true if a given cell should be disabled (unassignable) in the UI and auto-scheduler.
 */
export function isCellDisabled(day: Day, slot: TimeSlot, column: Column): boolean {
  if (column !== 'MT') return false;
  const isWeekend = day === 'Saturday' || day === 'Sunday';
  return isWeekend ? WEEKEND_MT_DISABLED.includes(slot) : WEEKDAY_MT_DISABLED.includes(slot);
}
