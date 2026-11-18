// Same-day alternatives for a plan at risk. Not homeSuggest (src/home-suggest.js): that one is favs/log-based "today" picks; this reuses its parts (staleness, openIntervals, wallPosition, distanceKm) for a plan's date.
// Official walls only: natural crags have no hours, so they are not candidates in this version. DOM-free.
import { staleness } from './card-model.js';
import { hasHours, openIntervals } from './hours.js';
import { distanceKm, wallPosition } from './viewmodel.js';
import { wallPageId } from './share-id.js';
import { riskOf } from './plan-risk.js';
import { pickHour } from './weather.js';

export const WALL_KM = 60; // wall candidates farther than this from the original place are not shown (user decision 2026-11-16; near-walls.js uses the same 60)
export const ROCK_KM = 60; // "다른 바위": same reach as walls (user decision 2026-11-16: 99~121km picks were too far)
export const NEAR_WALLS = 3; // outdoor walls whose weather is loaded per plan place: the nearest 3 within WALL_KM (user decision 2026-11-16; 60km alone was up to 30 points)
const RAIN = /비|눈|뇌우/; // wall reasons; a crag's reason is its cond state ('rain'; 'frozen' is not rain)

export function alternatives(plan, resolved, opts) {
  const { walls, wx, now = Date.now(), limit = 2 } = opts ?? {};
  const none = { picks: [], rest: true };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plan?.date ?? '');
  if (!m || !(resolved?.located && resolved.pos)) return none;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (new Date(+m[1], +m[2] - 1, +m[3]) < today) return none;
  const day = new Date(+m[1], +m[2] - 1, +m[3]);
  const nowD = new Date(now);
  const min = Number.isFinite(plan.min) ? plan.min : null;
  const self = resolved?.wall ? wallPageId(resolved.wall) : null;
  const rainy = (() => { const r = riskOf(resolved, plan, wx, now); return r.level === 'hard' && (RAIN.test(r.reason ?? '') || r.reason === 'rain'); })();

  const rows = [];
  for (const w of Array.isArray(walls) ? walls : []) {
    if (!w || typeof w !== 'object' || typeof w.name !== 'string' || !w.name) continue;
    if (w === resolved?.wall || (self && wallPageId(w) === self) || w.name === resolved?.name) continue;
    if (w.suspended || !hasHours(w) || staleness(w, nowD).stale) continue;
    const stretch = openIntervals(w, day).find(([, end]) => min === null || end > min);
    if (!stretch) continue;
    const at = wallPosition(w);
    const indoor = w.venue === 'indoor';
    const cand = { kind: 'wall', name: w.name, venue: indoor ? 'indoor' : 'outdoor', pos: at, located: !!at, reported: false, wall: w };
    const risk = riskOf(cand, plan, wx, now);
    if (indoor ? risk.level === 'hard' : risk.level !== 'ok') continue; // outdoor only with a real no-rain forecast (none/caution left out, user pick 2026-11-16)
    const km = at ? distanceKm(resolved.pos, at) : null;
    if (!Number.isFinite(km) || km > WALL_KM) continue; // unknown distance cannot be shown to be near
    rows.push({ wall: w, km, indoor, startMin: stretch[0], endMin: stretch[1], risk });
  }
  // one outdoor wall at most: the one with the calmest weather at the plan hour (weaker gusts, then temperature nearer 18°, then nearer). Weather facts only.
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), min === null ? 12 : Math.floor(min / 60), min === null ? 0 : min % 60);
  const hourOf = (w) => { const hs = wx?.hourly?.get?.(w.name); return hs ? pickHour(hs, at) : null; };
  const calm = (r) => { const h = hourOf(r.wall); return [Math.round(h?.g ?? Infinity), Math.abs((h?.t ?? Infinity) - 18), r.km]; };
  const best = rows.filter((r) => !r.indoor).map((r) => [r, calm(r)])
    .sort(([, x], [, y]) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2])[0]?.[0];
  for (let i = rows.length - 1; i >= 0; i--) if (!rows[i].indoor && rows[i] !== best) rows.splice(i, 1);
  rows.sort((a, b) => (rainy ? (b.indoor - a.indoor) : 0) || (a.km ?? Infinity) - (b.km ?? Infinity));
  return { picks: rows.slice(0, Math.max(0, limit)), rest: true };
}

export const NOT_ROCK = new Set(['ice', 'mountain']);

/**
 * "다른 바위" (plan board D1): for a crag plan at risk, other crags with coordinates whose forecast for that day is 'ok' (no rain, no recent-rain caution, not frozen).
 * No forecast = not a pick (only crags whose weather is already in wx.crag can show). Pending crags (csv_geo pins) are kept, flagged pending. Nearest first.
 * Says nothing about the rock itself: the row reads only '비 예보 없음' (plan-view rockRow).
 */
export function rockAlternatives(plan, resolved, opts) {
  const { crags, wx, now = Date.now(), limit = 2 } = opts ?? {};
  const none = { picks: [] };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plan?.date ?? '');
  if (!m || resolved?.kind !== 'crag' || !(resolved.located && resolved.pos)) return none;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (new Date(+m[1], +m[2] - 1, +m[3]) < today) return none;
  const rows = [];
  for (const c of Array.isArray(crags) ? crags : []) {
    if (!c || typeof c !== 'object' || typeof c.name !== 'string' || !c.name) continue;
    if (c === resolved.crag || c.name === resolved.name || NOT_ROCK.has(c.type)) continue;
    const at = wallPosition(c);
    if (!at) continue;
    const risk = riskOf({ kind: 'crag', name: c.name, venue: 'natural', pos: at, located: true, reported: false, crag: c }, plan, wx, now);
    if (risk.level !== 'ok') continue;
    const km = distanceKm(resolved.pos, at);
    if (!Number.isFinite(km) || km > ROCK_KM) continue;
    rows.push({ crag: c, km, pending: c.pending === true, risk });
  }
  rows.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  return { picks: rows.slice(0, Math.max(0, limit)) };
}

/** cragsNear(origins, crags, km = ROCK_KM) → the crags (not ice/mountain, with coordinates, not an origin) within km of any origin crag: whose weather the planner loads so "다른 바위" can be judged. */
export function cragsNear(origins, crags, km = ROCK_KM) {
  const from = (Array.isArray(origins) ? origins : []).map((o) => o && wallPosition(o)).filter(Boolean);
  if (!from.length) return [];
  return (Array.isArray(crags) ? crags : []).filter((c) => c && typeof c === 'object' && !origins.includes(c) && !NOT_ROCK.has(c.type)
    && (() => { const at = wallPosition(c); return !!at && from.some((p) => distanceKm(p, at) <= km); })());
}

/** wallsNear(origins, walls, km = WALL_KM, n = NEAR_WALLS) → for each origin place, its n nearest outdoor walls (not indoor, with coordinates, not an origin) within km, merged: whose hourly weather the planner loads so outdoor wall alternatives can be judged. */
export function wallsNear(origins, walls, km = WALL_KM, n = NEAR_WALLS) {
  const from = (Array.isArray(origins) ? origins : []).map((o) => o && wallPosition(o)).filter(Boolean);
  const outdoor = (Array.isArray(walls) ? walls : []).filter((w) => w && typeof w === 'object' && w.venue !== 'indoor' && !origins.includes(w))
    .map((w) => [w, wallPosition(w)]).filter(([, at]) => at);
  const out = new Set();
  for (const p of from) {
    outdoor.map(([w, at]) => [w, distanceKm(p, at)]).filter(([, km0]) => km0 <= km)
      .sort((x, y) => x[1] - y[1]).slice(0, n).forEach(([w]) => out.add(w));
  }
  return [...out];
}
