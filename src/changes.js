// src/changes.js — "이번 주 변경": the walls' operating changes that matter to a visitor, gathered from fields the data already has
// (suspended, exceptions.closed_dates). Only the walls a visitor follows (♥ or a 내 지역) count. No DOM.
import { areaOf } from './areas.js';
import { ymd } from './time.js';

export const SEEN_KEY = 'open-wall:changes-seen';
export const MAX_SEEN = 100;
export const WINDOW_DAYS = 7;

const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const nextDay = (s) => ymd(addDays(new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)), 1));

// The winter season's two edges that fall in [today, today + days]: it starts on the 1st of from_month and ends with to_month (the day after).
// A wall with no winter, or winter type none, has none.
function winterEdges(wall, today, days) {
  const w = wall.winter;
  if (!w?.type || w.type === 'none' || !(w.from_month >= 1 && w.to_month >= 1)) return [];
  const from = ymd(today), until = ymd(addDays(today, days)), out = [];
  for (let y = today.getFullYear() - 1; y <= today.getFullYear() + 1; y++) {
    const start = ymd(new Date(y, w.from_month - 1, 1));
    const end = ymd(new Date(w.from_month <= w.to_month ? y : y + 1, w.to_month, 1)); // the day after the last winter month
    if (start >= from && start <= until) out.push({ season: 'start', date: start });
    if (end >= from && end <= until) out.push({ season: 'end', date: end });
  }
  return out;
}

// closed dates inside [today, today + days] as runs of consecutive days: ['2026-10-20', '2026-10-21'] → one { from, to }
function closedRuns(dates, today, days) {
  const from = ymd(today), until = ymd(addDays(today, days));
  const inside = [...new Set((dates ?? []).filter(isDateStr))].filter((d) => d >= from && d <= until).sort();
  const runs = [];
  for (const d of inside) {
    const last = runs[runs.length - 1];
    if (last && nextDay(last.to) === d) last.to = d;
    else runs.push({ from: d, to: d });
  }
  return runs;
}

// What changed for the walls in `favs` (names) or in `regions` (area names). Neither chosen: nothing (a first visit sees no line).
// → [{ key, name, kind: 'suspended' | 'closed' | 'winter' (+ season 'start' | 'end'), from, to, note }], the suspended ones first, then by date. `key` is stable per change,
// so a dismissed one stays dismissed and a changed reason comes back.
export function weekChanges(walls, today, { favs = [], regions = [] } = {}) {
  if (!favs.length && !regions.length) return [];
  const out = [];
  for (const w of walls ?? []) {
    if (!favs.includes(w.name) && !regions.includes(areaOf(w.region))) continue;
    if (w.suspended) {
      const since = w.suspended.since ?? null, note = w.suspended.note ?? '';
      out.push({ key: `${w.name}|s|${since ?? ''}|${note}`, name: w.name, kind: 'suspended', from: since, to: null, note });
    }
    for (const r of closedRuns(w.exceptions?.closed_dates, today, WINDOW_DAYS)) {
      out.push({ key: `${w.name}|c|${r.from}|${r.to}`, name: w.name, kind: 'closed', from: r.from, to: r.to, note: '' });
    }
    for (const e of winterEdges(w, today, WINDOW_DAYS)) {
      const note = e.season === 'start' ? (w.winter.type === 'closed' ? '실외 휴관' : '운영시간 변경') : '평소 시간으로';
      out.push({ key: `${w.name}|w|${e.date}|${e.season}`, name: w.name, kind: 'winter', season: e.season, from: e.date, to: null, note });
    }
  }
  const rank = (c) => (c.kind === 'suspended' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || (a.from ?? '').localeCompare(b.from ?? '') || a.name.localeCompare(b.name, 'ko'));
}

// The ones not yet dismissed.
export const unseen = (changes, seen) => changes.filter((c) => !seen.includes(c.key));

// Stored dismissals are untrusted: strings only, no repeats, capped (the newest kept).
export function cleanSeen(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((k) => typeof k === 'string' && k.length < 200))].slice(-MAX_SEEN);
}
export function loadSeen(storage) {
  try { return cleanSeen(JSON.parse(storage.getItem(SEEN_KEY))); } catch { return []; }
}
export function saveSeen(storage, seen) {
  try { storage.setItem(SEEN_KEY, JSON.stringify(cleanSeen(seen))); } catch { /* storage full or blocked: dismissed for this visit only */ }
}
