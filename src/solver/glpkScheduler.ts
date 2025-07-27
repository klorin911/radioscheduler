import { Day, TimeSlot, Column, timeSlots, columns } from '../constants';
import { Dispatcher } from '../types';
import GLPKFactory from 'glpk.js';

/** Weight helpers */
function channelWeight(dispatcher: Dispatcher & { preferredChannels?: string[] }, col: Column) {
  if (!dispatcher.preferredChannels || dispatcher.preferredChannels.length === 0) return 0;
  const idx = dispatcher.preferredChannels.indexOf(col);
  if (idx === -1) return 0;
  // Higher rank (0) should get bigger weight
  return 10 - idx;
}

function timeWeight(dispatcher: Dispatcher & { preferredTimeBlocks?: string[] }, slot: TimeSlot) {
  if (!dispatcher.preferredTimeBlocks || dispatcher.preferredTimeBlocks.length === 0) return 0;
  const idx = dispatcher.preferredTimeBlocks.indexOf(slot);
  if (idx === -1) return 0;
  return 10 - idx;
}

export interface ScheduleDay {
  [T in TimeSlot]: { [C in Column]: string };
}

/**
 * Generate a schedule for a single day using MILP solved by glpk.js.
 * @param day Day of week
 * @param dispatchers list including availability information (workDays, prefs)
 */
export async function generateScheduleForDay(
  day: Day,
  dispatchers: Array<Dispatcher & {
    workDays?: string[];
    preferredChannels?: string[];
    preferredTimeBlocks?: string[];
  }>,
  locked?: ScheduleDay // existing assignments to keep
): Promise<ScheduleDay> {
  const glpk = await GLPKFactory();

  type VarKey = `${string}_${TimeSlot}_${Column}`;
  const variables: VarKey[] = [];

  // Build objective vars
  const objVars: { name: string; coef: number }[] = [];

  // map var name to dispatcher index for later
  const varToDispatcher: Record<string, number> = {};

  // Precompute slots already taken per dispatcher
  const lockedSlotsByDispatcher: Record<string, Set<TimeSlot>> = {};
  if (locked) {
    timeSlots.forEach((slot) => {
      columns.forEach((col) => {
        const val = locked[slot]?.[col];
        if (val) {
          lockedSlotsByDispatcher[val] = lockedSlotsByDispatcher[val] || new Set();
          lockedSlotsByDispatcher[val].add(slot);
        }
      });
    });
  }

  dispatchers.forEach((d, di) => {
    if (d.workDays && !d.workDays.includes(day)) {
      return; // not available
    }
    timeSlots.forEach((slot) => {
      if (d.preferredTimeBlocks && d.preferredTimeBlocks.length && !d.preferredTimeBlocks.includes(slot)) {
        return; // not preferred; skip assignment to reduce search size
      }
      columns.forEach((col) => {
        if (locked && locked[slot]?.[col]) return; // already filled, skip variable
        const name: VarKey = `${d.id}_${slot}_${col}` as VarKey;
        variables.push(name);
        varToDispatcher[name] = di;
        const coef = channelWeight(d, col) + timeWeight(d, slot);
        objVars.push({ name, coef });
      });
    });
  });

  // Build constraints
  const subjectTo: Array<any> = [];

  // 1. Each slot/col filled by at most 1 dispatcher
  timeSlots.forEach((slot) => {
    columns.forEach((col) => {
      const vars = variables.filter((v) => v.includes(`_${slot}_${col}`));
      if (vars.length === 0) return;
      subjectTo.push({
        name: `fill_${slot}_${col}`,
        vars: vars.map((n) => ({ name: n, coef: 1 })),
        bnds: { type: glpk.GLP_UP, ub: 1 },
      });
    });
  });

  // 2. Dispatcher per timeslot at most 1
  dispatchers.forEach((d) => {
    timeSlots.forEach((slot) => {
      if (lockedSlotsByDispatcher[d.name] && lockedSlotsByDispatcher[d.name].has(slot)) return; // already assigned
      const vars = variables.filter((v) => v.startsWith(`${d.id}_${slot}`));
      if (vars.length === 0) return;
      subjectTo.push({
        name: `onecol_${d.id}_${slot}`,
        vars: vars.map((n) => ({ name: n, coef: 1 })),
        bnds: { type: glpk.GLP_UP, ub: 1 },
      });
    });
  });

  const lp = {
    name: 'dispatch_schedule',
    objective: {
      direction: glpk.GLP_MAX,
      name: 'obj',
      vars: objVars,
    },
    subjectTo,
    binaries: variables,
  } as const;

  if (variables.length === 0) {
    // nothing to solve
    const empty: ScheduleDay = {} as any;
    timeSlots.forEach((slot) => {
      empty[slot] = {} as any;
      columns.forEach((col) => {
        empty[slot][col] = '';
      });
    });
    return empty;
  }

  const result = glpk.solve(lp, { msgLevel: glpk.GLP_MSG_ERR });

  // Build schedule structure default empty
  const schedule: ScheduleDay = {} as any;
  timeSlots.forEach((slot) => {
    schedule[slot] = {} as any;
    columns.forEach((col) => {
      schedule[slot][col] = '';
    });
  });

  if (!result.result || (result.result.status !== glpk.GLP_OPT && result.result.status !== glpk.GLP_FEAS))
    return schedule; // return empty if infeasible

  const chosen = result.result.vars as Record<string, number>;
  Object.entries(chosen).forEach(([varName, val]) => {
    if (val < 0.5) return;
    const [did, slot, col] = varName.split('_') as [string, TimeSlot, Column];
    schedule[slot][col] = dispatchers[varToDispatcher[varName]].name || did;
  });

  return schedule;
}
