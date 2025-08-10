#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import process from 'node:process';

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowsToRecords(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  const recs = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((v) => v === '')) continue;
    const rec = {};
    for (let j = 0; j < headers.length; j++) {
      rec[headers[j]] = (row[j] ?? '').trim();
    }
    recs.push(rec);
  }
  return recs;
}

function digitsToNumber(s) {
  if (!s) return undefined;
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

function parseDaysList(s) {
  if (!s) return undefined;
  const val = s.trim();
  if (!val) return undefined;
  if (/^trainee$/i.test(val)) return 'TRAINEE';
  return val.split(',').map((d) => d.trim()).filter(Boolean);
}

function parseWantsExtraUtility(s) {
  if (!s) return undefined;
  const v = s.trim().toLowerCase();
  if (!v) return undefined;
  return ['yes', 'y', 'true', '1'].includes(v) ? true : ['no', 'n', 'false', '0'].includes(v) ? false : undefined;
}

function buildFromRecord(rec) {
  const id = (rec['DISPLAY NAME'] || rec['Display Name'] || rec['display name'] || '').trim();
  const name = (rec['NAME'] || rec['Name'] || rec['name'] || '').trim();
  const badgeNumber = digitsToNumber(rec['BADGE NUMBER'] || rec['Badge Number'] || rec['badge number']);
  const seniority = digitsToNumber(rec['Seniority'] || rec['SENIORITY'] || rec['seniority']);
  const shift = (rec['SHIFT'] || rec['Shift'] || rec['shift'] || '').trim() || undefined;
  const workDaysParsed = parseDaysList(rec['WORK DAYS'] || rec['Work Days'] || rec['work days'] || rec['WORKDAYS']);
  const wantsExtraUtility = parseWantsExtraUtility(rec['Would you like to work extra utility if it is available?']);

  const base = {
    id,
    name,
    preferredChannels: [],
    preferredTimeBlocks: [],
    minimumRadioOnly: false,
  };
  if (typeof badgeNumber === 'number') base.badgeNumber = badgeNumber;
  if (typeof seniority === 'number') base.seniority = seniority;
  if (shift) base.shift = shift;
  if (typeof wantsExtraUtility === 'boolean') base.wantsExtraUtility = wantsExtraUtility;

  if (workDaysParsed === 'TRAINEE') {
    base.isTrainee = true;
    base.excludeFromAutoSchedule = true;
    base.followTrainerSchedule = true;
    // No workDays for trainees
  } else if (Array.isArray(workDaysParsed) && workDaysParsed.length) {
    base.workDays = workDaysParsed;
  }

  return base;
}

function mergePreserving(existing, incoming) {
  // Preserve fields from existing by badge match: traineeOf, preferred lists, wantsExtraUtility if not provided, minimumRadioOnly, excludeFromAutoSchedule if trainee wasn't detected
  const out = { ...incoming };
  if (existing) {
    if (existing.traineeOf != null) out.traineeOf = existing.traineeOf;
    if (Array.isArray(existing.preferredChannels) && existing.preferredChannels.length && (!out.preferredChannels || !out.preferredChannels.length)) out.preferredChannels = existing.preferredChannels;
    if (Array.isArray(existing.preferredTimeBlocks) && existing.preferredTimeBlocks.length && (!out.preferredTimeBlocks || !out.preferredTimeBlocks.length)) out.preferredTimeBlocks = existing.preferredTimeBlocks;
    if (existing.minimumRadioOnly === true) out.minimumRadioOnly = true;
    if (typeof out.wantsExtraUtility !== 'boolean' && typeof existing.wantsExtraUtility === 'boolean') out.wantsExtraUtility = existing.wantsExtraUtility;
    // Preserve existing seniority if incoming didn't provide it
    if (!(typeof out.seniority === 'number' && !Number.isNaN(out.seniority)) && typeof existing.seniority === 'number' && !Number.isNaN(existing.seniority)) {
      out.seniority = existing.seniority;
    }
    // If existing was trainee and incoming didn't mark trainee, keep trainee flags
    if (existing.isTrainee === true && out.isTrainee !== true) {
      out.isTrainee = true;
      out.excludeFromAutoSchedule = true;
      out.followTrainerSchedule = true;
      if ('workDays' in out) delete out.workDays;
    }
  }
  return out;
}

async function main() {
  const csvPath = process.argv[2] || 'DISPATCHERS - Sheet1.csv';
  const jsonPath = process.argv[3] || 'dispatchers.json';

  const absCsv = resolve(csvPath);
  const absJson = resolve(jsonPath);

  const csvText = await readFile(absCsv, 'utf8');
  const rows = parseCSV(csvText);
  const records = rowsToRecords(rows);
  // Build CSV seniority map by badge number
  const csvSeniorityByBadge = new Map();
  for (const rec of records) {
    const bn = digitsToNumber(rec['BADGE NUMBER'] || rec['Badge Number'] || rec['badge number']);
    const sr = digitsToNumber(rec['Seniority'] || rec['SENIORITY'] || rec['seniority']);
    if (typeof bn === 'number' && typeof sr === 'number') {
      csvSeniorityByBadge.set(bn, sr);
    }
  }
  let maxCsvSeniority = 0;
  for (const s of csvSeniorityByBadge.values()) {
    if (s > maxCsvSeniority) maxCsvSeniority = s;
  }

  const jsonText = await readFile(absJson, 'utf8');
  /** @type {Array<any>} */
  const existing = JSON.parse(jsonText);

  const byBadgeExisting = new Map();
  for (const d of existing) {
    if (d && typeof d.badgeNumber === 'number') byBadgeExisting.set(d.badgeNumber, d);
  }

  const built = [];
  for (const rec of records) {
    const d = buildFromRecord(rec);
    if (!d.id || typeof d.badgeNumber !== 'number') continue; // require id and badge
    const merged = mergePreserving(byBadgeExisting.get(d.badgeNumber), d);
    built.push(merged);
  }

  // Dedupe by badge, keep first occurrence (CSV order)
  const seenBadges = new Set();
  const deduped = [];
  for (const d of built) {
    if (seenBadges.has(d.badgeNumber)) continue;
    seenBadges.add(d.badgeNumber);
    deduped.push(d);
  }

  // NOTE: We no longer sort by badge number here.
  // Final sorting will be performed by seniority AFTER seniority values are assigned below.

  // Assign seniority from CSV exactly when provided (source of truth), ensuring uniqueness.
  // Then assign remaining without CSV seniority sequentially after the max used value.
  const used = new Set();
  // First pass: set seniority from CSV, bumping to next available if duplicate found
  for (const d of deduped) {
    const csvS = csvSeniorityByBadge.get(d.badgeNumber);
    if (typeof csvS === 'number') {
      let s = csvS;
      while (used.has(s)) s++;
      d.seniority = s;
      used.add(s);
    }
  }
  // Determine starting point for the rest
  let next = 1;
  if (used.size > 0) {
    let maxUsed = 0;
    for (const s of used) if (s > maxUsed) maxUsed = s;
    next = maxUsed + 1;
  } else if (maxCsvSeniority > 0) {
    next = maxCsvSeniority + 1;
  }
  // Second pass: assign to those without CSV seniority
  for (const d of deduped) {
    if (!(typeof d.seniority === 'number' && !Number.isNaN(d.seniority))) {
      while (used.has(next)) next++;
      d.seniority = next;
      used.add(next);
      next++;
    }
  }

  // Final sort: by seniority ascending (undefined goes last), then by id for stability
  const seniorityVal = (d) => (typeof d.seniority === 'number' ? d.seniority : Number.POSITIVE_INFINITY);
  deduped.sort((a, b) => {
    const sa = seniorityVal(a);
    const sb = seniorityVal(b);
    if (sa !== sb) return sa - sb;
    return (a.id || '').localeCompare(b.id || '');
  });

  // Compare to current content
  const beforeStr = JSON.stringify(existing);
  const afterStr = JSON.stringify(deduped);
  if (beforeStr === afterStr) {
    console.log('dispatchers.json already up to date.');
    return;
  }

  // Backup and write
  const backupPath = absJson.replace(/\.json$/, `.backup-${Date.now()}.json`);
  if (!existsSync(backupPath)) {
    await writeFile(backupPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    console.log(`Backup saved: ${basename(backupPath)}`);
  }

  await writeFile(absJson, JSON.stringify(deduped, null, 2) + '\n', 'utf8');

  console.log(`dispatchers.json updated from CSV. Total: ${deduped.length}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
