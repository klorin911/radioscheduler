import { days, timeSlots, columns, Schedule, TimeSlot, Column, Day } from './constants';
import { Dispatcher } from './appTypes';

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
      // Debug log to confirm renderer is invoking the IPC save path
      console.log('Renderer: invoking dispatcherAPI.saveDispatchers with', dispatchers.length, 'items');
      const result = await window.dispatcherAPI.saveDispatchers(dispatchers);
      console.log('Renderer: dispatcherAPI.saveDispatchers result:', result);
      return;
    }
    // Fallback to localStorage for web version
    console.log('Renderer: dispatcherAPI not available; saving dispatchers to localStorage');
    localStorage.setItem('dispatchers', JSON.stringify(dispatchers));
  } catch (error) {
    console.error('Error saving dispatchers:', error);
    // Fallback to localStorage on error
    try {
      localStorage.setItem('dispatchers', JSON.stringify(dispatchers));
      console.log('Renderer: fallback save to localStorage succeeded');
    } catch (e) {
      console.error('Renderer: fallback save to localStorage failed:', e);
    }
  }
};

// DAILY DETAIL --------------------------------------------------
export type DailyDetailGrid = {
  headers: string[];
  rows: string[][]; // each row must have same length as headers
};

export type DailyDetailDoc = {
  grid: DailyDetailGrid;
  // Shift rosters under the grid
  rosters: {
    headers: string[]; // e.g., ["A SHIFT","B SHIFT","C SHIFT","E SHIFT","F SHIFT"]
    rows: string[][];  // columns correspond to headers
  };
  // Right-side panels
  stabilizer: { headers: [string, string, string]; rows: string[][] }; // [time, name1, name2]
  relief: { headers: [string, string]; rows: string[][] };             // [time, name]
  teletype: { headers: [string, string]; rows: string[][] };           // [time, name]
};

const detailKey = (day: Day) => `dailyDetail:${day}`;

export const loadDailyDetail = (day: Day): DailyDetailDoc | DailyDetailGrid | null => {
  try {
    const str = localStorage.getItem(detailKey(day));
    if (str) return JSON.parse(str) as DailyDetailDoc;
  } catch {
    // ignore
  }
  return null;
};

export const saveDailyDetail = (day: Day, doc: DailyDetailDoc) => {
  localStorage.setItem(detailKey(day), JSON.stringify(doc));
};
