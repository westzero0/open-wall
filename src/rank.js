// src/rank.js — 내 활동: the 등급 (by how many different walls of the current list were logged), the 기록 tab's numbers and
// this device's 혼잡도 제보 count. All counted on this device; nothing is sent. No DOM; storage and "today" are passed in.
import { visitedCount } from './log.js';

// at: different walls needed. A tier whose `at` is not below the list's size is skipped — 전국 완주 (every wall) stands there.
export const RANKS = [
  { key: 'first', name: '첫 외벽', at: 1 },
  { key: 'intro', name: '외벽 입문', at: 3 },
  { key: 'regular', name: '외벽 단골', at: 6 },
  { key: 'explorer', name: '외벽 탐험가', at: 12 },
  { key: 'master', name: '외벽 마스터', at: 25 },
];
export const COMPLETE = { key: 'complete', name: '전국 완주' };

/**
 * rankOf(visited, total) → {key, name, level, next: {name, need} | null, progress 0..1}.
 * level: the tier's place in RANKS (0..4), 5 for 전국 완주, -1 before the first wall (key 'none', name '').
 * progress: visited / the next tier's count (a fresh tier never shows an empty bar), 1 at 전국 완주.
 */
export function rankOf(visited, total) {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const v = Math.min(Math.max(0, Math.floor(Number(visited) || 0)), t);
  const ladder = [...RANKS.map((r, level) => ({ ...r, level })).filter((r) => r.at < t), ...(t ? [{ ...COMPLETE, at: t, level: 5 }] : [])];
  let i = -1;
  while (i + 1 < ladder.length && v >= ladder[i + 1].at) i += 1;
  const cur = ladder[i] ?? { key: 'none', name: '', at: 0, level: -1 };
  const nx = ladder[i + 1];
  return {
    key: cur.key, name: cur.name, level: cur.level,
    next: nx ? { name: nx.name, need: nx.at - v } : null,
    progress: nx ? v / nx.at : 1,
  };
}

/**
 * activityStats(log, names, today) → {places, visits, month}. places: different walls of `names` (the current list);
 * visits: every record (two on one day at one wall count twice); month: records in today's month ('YYYY-MM-DD', local).
 */
export function activityStats(log, names, today) {
  const ym = `${String(today).slice(0, 7)}-`;
  return { places: visitedCount(log, names).visited, visits: log.length, month: log.filter((r) => r.date.startsWith(ym)).length };
}

// ---- 혼잡도 제보 count: {crowd: n}, +1 only when a report actually went out (app.js sendCrowd) ----
export const CONTRIB_KEY = 'open-wall:contrib';
export const MAX_CONTRIB = 100000;
const cleanCount = (n) => (Number.isInteger(n) && n >= 0 && n <= MAX_CONTRIB ? n : 0);
/** cleanContrib(v) → {crowd}: a whole number 0..MAX_CONTRIB, anything else 0. */
export const cleanContrib = (v) => ({ crowd: cleanCount(v && typeof v === 'object' ? v.crowd : null) });
export function loadContrib(storage) {
  try {
    return cleanContrib(JSON.parse(storage.getItem(CONTRIB_KEY)));
  } catch {
    return { crowd: 0 };
  }
}
/** bumpCrowd(storage) → the new count (kept at MAX_CONTRIB); with storage that throws nothing is kept. */
export function bumpCrowd(storage) {
  const next = { crowd: Math.min(loadContrib(storage).crowd + 1, MAX_CONTRIB) };
  try {
    storage.setItem(CONTRIB_KEY, JSON.stringify(next));
  } catch { /* private mode: not counted */ }
  return next.crowd;
}
