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
