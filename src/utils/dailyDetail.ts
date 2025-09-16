import { Day, Schedule, columns, timeSlots, Column } from '../constants';
import type { DailyDetailDoc, DailyDetailGrid } from '../appStorage';
import type { ExtendedDispatcher } from '../appTypes';

// Default: exclude RELIEF from the top grid as it is typically empty in the detail sheet
export const detailColumns: Column[] = columns.filter((c) => c !== 'RELIEF') as Column[];

export function buildDailyDetailGrid(day: Day, schedule: Schedule): DailyDetailGrid {
  const headers = [String(day), ...detailColumns];
  const rows = timeSlots.map((slot) => [
    slot,
    ...detailColumns.map((c) => schedule[day][slot][c] || ''),
  ]);
  return { headers, rows };
}

function rosterHeaders(): string[] {
  return ['A SHIFT', 'B SHIFT', 'C SHIFT', 'E SHIFT', 'F SHIFT'];
}

// Extract a set of dispatcher IDs that appear anywhere in the schedule for a given day
function workingIdsForDay(day: Day, schedule: Schedule, dispatchers: ExtendedDispatcher[]): Set<string> {
  const validIds = new Set(dispatchers.map((d) => String(d.id || '').toUpperCase()));
  const seen = new Set<string>();
  timeSlots.forEach((slot) => {
    columns.forEach((col) => {
      const raw = schedule[day][slot][col];
      if (!raw) return;
      // Split on any non-letter to capture tokens like "KELL/AYAN (T)"
      const tokens = String(raw)
        .toUpperCase()
        .split(/[^A-Z]+/)
        .filter(Boolean);
      tokens.forEach((t) => {
        if (validIds.has(t)) seen.add(t);
      });
    });
  });
  return seen;
}

// Build rosters for the day: include only people working that day, ordered by seniority
function buildRosters(day: Day, schedule: Schedule, dispatchers: ExtendedDispatcher[]): { headers: string[]; rows: string[][] } {
  const working = workingIdsForDay(day, schedule, dispatchers);
  type Item = { id: string; name: string; seniority: number };
  const groups: Record<'A' | 'B' | 'C' | 'E' | 'F', Item[]> = { A: [], B: [], C: [], E: [], F: [] };

  dispatchers.forEach((d) => {
    const id = String(d.id || '').toUpperCase();
    if (!working.has(id)) return; // only show people working this day
    const shift = (d.shift || '').trim().toUpperCase();
    if (shift !== 'A' && shift !== 'B' && shift !== 'C' && shift !== 'E' && shift !== 'F') return;
    const s = typeof d.seniority === 'number' && !Number.isNaN(d.seniority) ? d.seniority : Number.POSITIVE_INFINITY;
    groups[shift].push({ id, name: d.name || id, seniority: s });
  });

  // Sort each group by seniority (1 = most senior), then by name for stability
  (Object.keys(groups) as Array<keyof typeof groups>).forEach((k) => {
    groups[k].sort((a, b) => {
      if (a.seniority !== b.seniority) return a.seniority - b.seniority;
      return a.name.localeCompare(b.name);
    });
  });

  const maxLen = Math.max(0, ...Object.values(groups).map((list) => list.length));
  const rows: string[][] = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push([
      groups.A[i]?.name || '',
      groups.B[i]?.name || '',
      groups.C[i]?.name || '',
      groups.E[i]?.name || '',
      groups.F[i]?.name || '',
    ]);
  }
  return { headers: rosterHeaders(), rows };
}

const STABILIZER_TIMES = ['0730','0930','1130','1330','1530','1730','1930','2130','2330','0130'];
const RELIEF_TIMES = ['1530','1730','1930','2130','2330','0130'];
// Teletype times shown in the reference layout
const TELETYPE_TIMES = ['0130-0330','0330-0530','0530-0730'];

export function buildDailyDetailDoc(day: Day, schedule: Schedule, dispatchers: ExtendedDispatcher[]): DailyDetailDoc {
  const grid = buildDailyDetailGrid(day, schedule);
  const rosters = buildRosters(day, schedule, dispatchers);
  const stabilizer = { headers: ['STABILIZER', '', ''] as [string, string, string], rows: STABILIZER_TIMES.map((t) => [t, '', '']) };
  const relief = { headers: ['RELIEF', '' ] as [string, string], rows: RELIEF_TIMES.map((t) => [t, '' ]) };
  const teletype = { headers: ['TELETYPE', '' ] as [string, string], rows: TELETYPE_TIMES.map((t) => [t, '' ]) };
  return { grid, rosters, stabilizer, relief, teletype };
}
