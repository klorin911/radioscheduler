import { days, timeSlots, columns, Schedule, TimeSlot, Column } from './constants';
import { Dispatcher } from './types';

export const createEmptySchedule = (): Schedule => {
  const schedule = {} as Schedule;
  days.forEach((d) => {
    const dayObj = {} as { [T in TimeSlot]: { [C in Column]: string } };
    timeSlots.forEach((t) => {
      const slotObj = {} as { [C in Column]: string };
      columns.forEach((c) => {
        slotObj[c] = '';
      });
      dayObj[t] = slotObj;
    });
    schedule[d] = dayObj;
  });
  return schedule;
};

// SCHEDULE --------------------------------------------------
export const loadSchedule = (): Schedule => {
  try {
    const str = localStorage.getItem('schedule');
    if (str) return JSON.parse(str);
  } catch (_) {
    // ignore
  }
  return createEmptySchedule();
};

export const saveSchedule = (schedule: Schedule) => {
  localStorage.setItem('schedule', JSON.stringify(schedule));
};

// DISPATCHERS --------------------------------------------------
export const loadDispatchers = (): Dispatcher[] => {
  try {
    const str = localStorage.getItem('dispatchers');
    if (str) return JSON.parse(str);
  } catch (_) {
    // ignore
  }
  return [];
};

export const saveDispatchers = (dispatchers: Dispatcher[]) => {
  localStorage.setItem('dispatchers', JSON.stringify(dispatchers));
};
