import { days, Day, TimeSlot, Column, timeSlots, columns } from '../constants';
import { Dispatcher } from '../types';
import GLPKFactory from 'glpk.js';

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

export type ScheduleDay = Record<TimeSlot, Record<Column, string>>;

type Bounds = { type: number; ub: number; lb: number };

interface Constraint {
  name: string;
  vars: { name: string; coef: number }[];
  bnds: Bounds;
}

function createBounds(type: number, ub: number, lb: number): Bounds {
  return { type, ub, lb };
}

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
export async function generateScheduleForDay(
  day: Day,
  dispatchers: ExtendedDispatcher[],
  locked?: ScheduleDay // existing assignments to keep
): Promise<ScheduleDay> {
  const glpk = await GLPKFactory();

  // Validate dispatcher workDays, preferredTimeBlocks, and preferredChannels
  const validDays = new Set<string>(days);
  const validSlots = new Set<string>(timeSlots);
  const validCols = new Set<string>(columns);
  dispatchers.forEach((d) => {
    if (d.workDays) {
      d.workDays = d.workDays.filter(w => {
        if (!validDays.has(w)) {
          console.warn(`[Scheduler] dispatcher ${d.id} invalid workDay: "${w}"`);
          return false;
        }
        return true;
      });
    }
    if (d.preferredTimeBlocks) {
      d.preferredTimeBlocks = d.preferredTimeBlocks.filter(s => {
        if (!validSlots.has(s)) {
          console.warn(`[Scheduler] dispatcher ${d.id} invalid preferredTimeBlock: "${s}"`);
          return false;
        }
        return true;
      });
    }
    if (d.preferredChannels) {
      d.preferredChannels = d.preferredChannels.filter(c => {
        if (!validCols.has(c)) {
          console.warn(`[Scheduler] dispatcher ${d.id} invalid preferredChannel: "${c}"`);
          return false;
        }
        return true;
      });
    }
  });

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
    if (d.workDays && d.workDays.length && !d.workDays.includes(day)) {
      console.log(`[GLPK] ${day}: Skipping ${d.id} - not available on ${day}`);
      return; // not available
    }
    timeSlots.forEach((slot) => {
      // skip if outside dispatcher’s shift hours
      if (d.shift && !shiftSlots[d.shift]?.includes(slot)) {
        return; // not in shift
      }

      columns.forEach((col) => {
        if (locked && locked[slot]?.[col]) return; // already filled, skip variable
        const name: VarKey = `${d.id}_${slot}_${col}` as VarKey;
        variables.push(name);
        varToDispatcher[name] = di;
        const coef = 1 + channelWeight(d, col) + timeWeight(d, slot);
        objVars.push({ name, coef });
      });
    });
  });

  // Build constraints
  const subjectTo: Constraint[] = [];

  // 1. Each slot/col filled by at most 1 dispatcher
  timeSlots.forEach((slot) => {
    columns.forEach((col) => {
      const vars = variables.filter((v) => v.includes(`_${slot}_${col}`));
      if (vars.length === 0) return;
      subjectTo.push({
        name: `fill_${slot}_${col}`,
        vars: vars.map((n) => ({ name: n, coef: 1 })),
        bnds: createBounds(glpk.GLP_UP, 1, 0),
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
        bnds: createBounds(glpk.GLP_UP, 1, 0),
      });
    });
  });

  

  // 3. Ensure each dispatcher gets at least one slot per work day (DISABLED - too restrictive)
  // dispatchers.forEach((d, di) => {
  //   if (d.workDays && d.workDays.length && d.workDays.includes(day)) {
  //     const varsForD = variables.filter(v => varToDispatcher[v] === di);
  //     if (varsForD.length > 0) {
  //       subjectTo.push({
  //         name: `min1_${d.id}_${day}`,
  //         vars: varsForD.map(n => ({ name: n, coef: 1 })),
  //         bnds: createBounds(glpk.GLP_LO, 0, 1),
  //       });
  //     }
  //   }
  // });
  


  // Validate constraints
  subjectTo.forEach((constraint, i) => {
    if (constraint.vars.length === 0) {
      console.warn(`[GLPK] ${day}: Constraint ${i} (${constraint.name}) has no variables`);
    }
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
    return createEmptyDay();
  }

  console.log(`[GLPK] ${day}: variables=${variables.length}, constraints=${subjectTo.length}`);
  if (variables.length === 0) {
    console.log(`[GLPK] ${day}: No variables generated - all dispatchers filtered out`);
  }

  console.log(`[GLPK] ${day}: Calling solver...`);
  const result = await glpk.solve(lp, { msglev: glpk.GLP_MSG_ERR });
  console.log(`[GLPK] ${day}: Solver result:`, result);

  // Build schedule structure default empty
  const schedule: ScheduleDay = createEmptyDay();

  if (!result || !result.result) {
    console.log(`[GLPK] ${day}: Solver returned no result object:`, result);
    return schedule;
  }
  
  if (result.result.status !== glpk.GLP_OPT && result.result.status !== glpk.GLP_FEAS) {
    console.log(`[GLPK] ${day}: Solver failed - status: ${result.result.status} (OPT=${glpk.GLP_OPT}, FEAS=${glpk.GLP_FEAS})`);
    return schedule; // return empty if infeasible
  }
  
  console.log(`[GLPK] ${day}: Solver succeeded with status: ${result.result.status}`);

  const chosen = result.result.vars as Record<string, number>;
  console.log(`[GLPK] ${day}: Solution found with ${Object.keys(chosen).filter(k => chosen[k] >= 0.5).length} assignments`);
  Object.entries(chosen).forEach(([varName, val]) => {
    if (val < 0.5) return;
    const parts = varName.split('_');
    const col = parts.pop() as Column;
    const slot = parts.pop() as TimeSlot;
    const did = parts.join('_');
    if (schedule[slot] && schedule[slot][col] !== undefined) {
      schedule[slot][col] = dispatchers[varToDispatcher[varName]].name || did;
    }
  });

  console.log(`[GLPK] ${day}: Returning schedule`);
  return schedule;
}
