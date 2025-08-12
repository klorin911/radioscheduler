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
  } catch {
    // ignore
  }
  return createEmptySchedule();
};

export const saveSchedule = (schedule: Schedule) => {
  localStorage.setItem('schedule', JSON.stringify(schedule));
};

// DISPATCHERS --------------------------------------------------
export const loadDispatchers = async (): Promise<Dispatcher[]> => {
  try {
    if (window.dispatcherAPI?.getDispatchers) {
      return (await window.dispatcherAPI.getDispatchers()) as Dispatcher[];
    }
    // Fallback to localStorage for web version
    const str = localStorage.getItem('dispatchers');
    if (str) {
      return JSON.parse(str);
    }
  } catch (error) {
    console.error('Error loading dispatchers:', error);
  }
  return [];
};

export const saveDispatchers = async (dispatchers: Dispatcher[]) => {
  try {
    if (window.dispatcherAPI?.saveDispatchers) {
      await window.dispatcherAPI.saveDispatchers(dispatchers);
      return;
    }
    // Fallback to localStorage for web version
    localStorage.setItem('dispatchers', JSON.stringify(dispatchers));
  } catch (error) {
    console.error('Error saving dispatchers:', error);
    // Fallback to localStorage on error
    localStorage.setItem('dispatchers', JSON.stringify(dispatchers));
  }
};
