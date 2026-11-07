// src/trips.js — 날짜형 일정 (docs/superpowers/specs/2026-11-06-schedule-tab-flow-design.md): where and on which days a visitor plans to climb.
// 일정 1건 = 장소 1곳. In this browser only. No DOM.
import { ID_RE, dayParts, validDate } from './log.js';
import { ymd } from './time.js';

export const TRIPS_KEY = 'open-wall:trips';
export const MAX_TRIPS = 10;
export const TRIP_KEEP_DAYS = 14; // a trip is forgotten this many days after its last day

const dayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8)) / 86400000; // UTC day count, like schedule.js keyDay
const sortTrips = (a) => a.sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : 0));

/** cleanTrips(v, today) → Trip[]: only well-formed trips, oldest `from` first, at most MAX_TRIPS. */
export function cleanTrips(v, today) {
  if (!Array.isArray(v) || !validDate(today)) return [];
  const seen = new Set();
  const out = [];
  for (const e of v) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !ID_RE.test(e.id) || seen.has(e.id)) continue;
    const p = e.place;
    if (!p || (p.type !== 'zone' && p.type !== 'wall') || typeof p.id !== 'string' || !ID_RE.test(p.id)) continue;
    if (typeof e.authorId !== 'string' || !ID_RE.test(e.authorId) || !validDate(e.from) || !validDate(e.to)) continue;
    const to = e.to < e.from ? e.from : e.to;
    if (dayNum(today) - dayNum(to) > TRIP_KEEP_DAYS) continue;
    seen.add(e.id);
    const t = { id: e.id, authorId: e.authorId, place: { type: p.type, id: p.id }, from: e.from, to, createdAt: Number.isFinite(e.createdAt) ? e.createdAt : 0 };
    if (e.status === 'skipped') t.status = 'skipped';
    if (e.rainAck === true) t.rainAck = true;
    out.push(t);
  }
  return sortTrips(out).slice(0, MAX_TRIPS);
}

/** loadTrips(storage, today, places?) — places = { zones: [{id}], walls: [{id}] }: a trip to a place not listed is left out. */
export function loadTrips(storage, today, places) {
  try {
    const list = cleanTrips(JSON.parse(storage.getItem(TRIPS_KEY)), today);
    if (!places) return list;
    const ids = { zone: new Set((places.zones || []).map((z) => z.id)), wall: new Set((places.walls || []).map((w) => w.id)) };
    return list.filter((t) => ids[t.place.type].has(t.place.id));
  } catch {
    return [];
  }
}

export function saveTrips(storage, trips, today) {
  try {
    storage.setItem(TRIPS_KEY, JSON.stringify(cleanTrips(trips, today)));
  } catch { /* storage full or blocked: the plan lives until the page closes */ }
}

/** addTrip(trips, { place, from, to, authorId, id, now }) → { trips, error? }. 'full' at MAX_TRIPS, 'bad' for an unusable trip. */
export function addTrip(trips, { place, from, to, authorId, id, now }) {
  if (trips.length >= MAX_TRIPS) return { trips, error: 'full' };
  const added = cleanTrips([{ id, authorId, place, from, to, createdAt: now }], from);
  if (!added.length) return { trips, error: 'bad' };
  return { trips: sortTrips([...trips, added[0]]) };
}

const edit = (trips, id, fn) => trips.map((t) => (t.id === id ? fn(t) : t));
export const removeTrip = (trips, id) => trips.filter((t) => t.id !== id);
export const moveTrip = (trips, id, { from, to }) => sortTrips(edit(trips, id, ({ rainAck, ...t }) => ({ ...t, from, to: to < from ? from : to }))); // new days: their rain is asked again
export const skipTrip = (trips, id) => edit(trips, id, (t) => ({ ...t, status: 'skipped' }));
export const ackRain = (trips, id) => edit(trips, id, (t) => ({ ...t, rainAck: true }));
export const swapPlace = (trips, id, place) => edit(trips, id, ({ rainAck, ...t }) => ({ ...t, place }));

/** 'plan' before the first day, 'day' on it, 'logged'|'back' after (a record exists or not); 'skipped' wins. */
export function tripState(trip, today, hasRecord) {
  if (trip.status === 'skipped') return 'skipped';
  if (today < trip.from) return 'plan';
  if (today <= trip.to) return 'day';
  return hasRecord ? 'logged' : 'back';
}

/** comingWeekend(today) → { sat, sun }: this week's Saturday and Sunday (a Saturday is its own weekend); on a Sunday the next one, since the day is already going. */
export function comingWeekend(today) {
  const [y, m, d] = today.split('-').map(Number);
  const toSat = (6 - new Date(y, m - 1, d).getDay() + 7) % 7; // Sat 0, Sun 6, Wed 3
  const at = (o) => ymd(new Date(y, m - 1, d + o));
  return { sat: at(toSat), sun: at(toSat + 1) };
}

/**
 * homeDays(today, trips = []) → [{ label, date, plan?: true, add?: true }]: 홈의 날짜 칩 오늘·내일·모레(고정) + 일정이 잡힌 날짜(plan: true, 날짜순, 같은 날은 칩 하나, 이미 있는 칩과 같은 날이면 그 칩에 plan만)
 * + 끝의 '+ 일정 잡기'(add: true). 앞으로의 일정(plan)과 진행 중인 일정(day: 오늘 칩)만 센다. Weekdays are not assumed: 요일은 일정이 있는 날의 이름으로만 나온다.
 */
export function homeDays(today, trips = []) {
  const [y, m, d] = today.split('-').map(Number);
  const at = (o) => ymd(new Date(y, m - 1, d + o));
  const chips = [{ label: '오늘', date: today }, { label: '내일', date: at(1) }, { label: '모레', date: at(2) }];
  const dates = trips.map((t) => [tripState(t, today, false), t]).filter(([s]) => s === 'plan' || s === 'day')
    .map(([s, t]) => (s === 'day' ? today : t.from)).sort();
  for (const date of dates) {
    const hit = chips.find((c) => c.date === date);
    if (hit) hit.plan = true;
    else { const p = dayParts(date); chips.push({ label: `${p.dow} ${p.month}/${p.day}`, date, plan: true }); }
  }
  return [...chips, { label: '+ 일정 잡기', date: '', add: true }];
}

export const tripsOnDate = (trips, date) => trips.filter((t) => t.from <= date && date <= t.to);
export const dday = (trip, today) => dayNum(trip.from) - dayNum(today);
/** backWhen(trip, today) → '어제' | 'N일 전': how long ago a past trip's last day was (the 다녀온 card's badge and question). */
export const backWhen = (trip, today) => { const n = dayNum(today) - dayNum(trip.to); return n === 1 ? '어제' : `${n}일 전`; };

/** placeChoices({ walls, crags, singlePitchOn }) → [{ type, id, name, kind }]: 싱글피치 first when on, then every 외벽. */
export function placeChoices({ walls, crags, singlePitchOn }) {
  const w = walls.map((x) => ({ type: 'wall', id: x.id, name: x.name, kind: '외벽' }));
  if (!singlePitchOn) return w;
  return [...crags.map((x) => ({ type: 'zone', id: x.id, name: x.name, kind: '싱글피치' })), ...w];
}
