// src/home-suggest.js — 일정이 0개인 홈의 추천 (docs/superpowers/specs/2026-11-07-home-schedule-record-frame.md, "일정 0개 홈의 추천"): no DOM.
// 위에서부터 첫 해당 하나만: (0) ♥ 내 암장 (1) 기록이 있는 암장 (2) 위치가 있으면 가까운 곳 (3) 없음 + 안내. 최근 본 암장·유저 관심 암장은 쓰지 않는다.
// A wall is a candidate when it can still be gone to today (not suspended, hours known and fresh, an open stretch that has not ended): row.open says whether it is open now.
import { staleness } from './card-model.js';
import { hasHours, openIntervals } from './hours.js';
import { NEAR_KM } from './schedule.js';
import { isSunlit } from './sun.js';
import { distanceKm, wallPosition } from './viewmodel.js';

const str = (v) => (typeof v === 'string' ? v.normalize('NFC').trim() : '');

/**
 * homeSuggest({ walls, favs, log, here, now, nearKm = NEAR_KM, limit = 2 }) → { kind: 'fav' | 'visited' | 'near' | 'none', rows, note: 'far' | 'locate' | null }.
 * rows: [{ wall, km: number | null (null without `here`), open: boolean, startMin, endMin, last?: 'YYYY-MM-DD' }] (the stretch that is open now, or the next one today).
 * fav: ♥ walls that are candidates, nearest first with `here`, else in ♥ order. visited: walls named in log, most visits first, then newest. near: candidates within nearKm, nearest first.
 * none: note 'far' (a position, but nothing within nearKm) or 'locate' (no position). A kind with no candidate falls through to the next.
 */
export function homeSuggest({ walls, favs, log, here = null, now, nearKm = NEAR_KM, limit = 2 }) {
  const list = (Array.isArray(walls) ? walls : []).filter((w) => w && typeof w === 'object' && str(w.name));
  const byName = new Map();
  for (const w of list) if (!byName.has(w.name)) byName.set(w.name, w);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const row = (w, extra = {}) => {
    if (w.suspended || !hasHours(w) || staleness(w, now).stale) return null;
    const stretch = openIntervals(w, now).find(([, end]) => end > nowMin);
    const at = wallPosition(w);
    if (!stretch) return null;
    const lit = w.venue === 'indoor' ? null : isSunlit(w, now).lit; // true 양달 / false 응달 / null: indoor or direction unknown
    return { wall: w, km: here && at ? distanceKm(here, at) : null, sun: w.venue === 'indoor' ? '실내' : lit === true ? '양달' : lit === false ? '응달' : null, open: stretch[0] <= nowMin, startMin: stretch[0], endMin: stretch[1], ...extra };
  };
  const nearestFirst = (rows) => (here ? [...rows].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)) : rows);

  const favRows = [...new Set((Array.isArray(favs) ? favs : []).map(str).filter(Boolean))].map((n) => byName.get(n)).filter(Boolean).map((w) => row(w)).filter(Boolean);
  if (favRows.length) return { kind: 'fav', rows: nearestFirst(favRows).slice(0, limit), note: null };

  const seen = new Map(); // wall name → { n, last }
  for (const r of Array.isArray(log) ? log : []) {
    const name = str(r?.wall);
    if (!name || !byName.has(name)) continue;
    const s = seen.get(name) ?? { n: 0, last: '' };
    s.n += 1;
    if (typeof r.date === 'string' && r.date > s.last) s.last = r.date;
    seen.set(name, s);
  }
  const visited = [...seen].sort(([, a], [, b]) => b.n - a.n || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
    .map(([name, s]) => row(byName.get(name), s.last ? { last: s.last } : {})).filter(Boolean);
  if (visited.length) return { kind: 'visited', rows: visited.slice(0, limit), note: null };

  if (!here) return { kind: 'none', rows: [], note: 'locate' };
  const near = nearestFirst(list.map((w) => row(w)).filter((r) => r && r.km !== null && r.km <= nearKm)).slice(0, limit);
  return near.length ? { kind: 'near', rows: near, note: null } : { kind: 'none', rows: [], note: 'far' };
}
