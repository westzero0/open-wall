// src/schedule.js — 운동 스케줄 비 알림 (docs/superpowers/specs/2026-10-27-schedule-rain-alert-design.md): the walls and weekdays a visitor
// trains on, the week's rain for them, and where else to go on a wet day. In this browser only. No DOM.
import { staleness } from './card-model.js';
import { hasHours, openIntervals } from './hours.js';
import { wallPageId } from './share-id.js';
import { DAY_KO, ymd } from './time.js';
import { distanceKm, wallPosition } from './viewmodel.js';
import { dayKey, dayWeather } from './weather.js';

export const SCHEDULE_KEY = 'open-wall:schedule';
export const MAX_SCHEDULE = 5; // walls
const MAX_NAME = 60; // a stored wall name longer than this is not a wall
export const NEAR_KM = 30; // an alternative wall within this distance of the scheduled one
export const MAX_ALTS = 3;
export const STRIP_DAYS = 7;

const nfc = (s) => s.normalize('NFC').trim();

// Anything stored is untrusted: [{ wall, days }] with a wall name, days 0 (일) – 6 (토) unique and sorted, one entry per wall, capped.
export function cleanSchedule(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const e of v) {
    if (!e || typeof e !== 'object' || typeof e.wall !== 'string') continue;
    const wall = nfc(e.wall);
    if (!wall || wall.length > MAX_NAME || out.some((x) => x.wall === wall)) continue;
    const days = [...new Set((Array.isArray(e.days) ? e.days : []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
    out.push({ wall, days });
  }
  return out.slice(0, MAX_SCHEDULE);
}

// The store keeps each wall's id (a rename does not lose the schedule), like the favorites; without `walls` an id stays as it is, with them an unknown wall is dropped.
export function loadSchedule(storage, walls = []) {
  try {
    const byId = new Map(walls.map((w) => [wallPageId(w), w.name]));
    const raw = JSON.parse(storage.getItem(SCHEDULE_KEY));
    const list = cleanSchedule(Array.isArray(raw) ? raw.map((e) => (e && typeof e === 'object' ? { ...e, wall: byId.get(e.wall) ?? e.wall } : e)) : raw);
    return walls.length ? list.filter((e) => walls.some((w) => w.name === e.wall)) : list; // with the list in hand, a wall that is not in it is gone: it must not take one of the five places unseen
  } catch {
    return [];
  }
}

export function saveSchedule(storage, schedule, walls = []) {
  try {
    const byName = new Map(walls.map((w) => [w.name, wallPageId(w)]));
    storage.setItem(SCHEDULE_KEY, JSON.stringify(cleanSchedule(schedule).map((e) => ({ ...e, wall: byName.get(e.wall) ?? e.wall }))));
  } catch { /* storage full or blocked: keep in memory */ }
}

/** addWall(schedule, name) → the list with the wall added (no days yet); a wall already there, or the cap, leaves it as it is. */
export function addWall(schedule, name) {
  const n = nfc(String(name));
  return !n || schedule.length >= MAX_SCHEDULE || schedule.some((e) => e.wall === n) ? schedule : [...schedule, { wall: n, days: [] }];
}

export const removeWall = (schedule, name) => schedule.filter((e) => e.wall !== name);

/** toggleDay(schedule, name, dow) → the wall's day switched on / off (a wall not in the list: unchanged). */
export const toggleDay = (schedule, name, dow) => schedule.map((e) => (e.wall !== name ? e
  : { ...e, days: (e.days.includes(dow) ? e.days.filter((d) => d !== dow) : [...e.days, dow]).sort((a, b) => a - b) }));

const dayAt = (today, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);

/**
 * weekStrip(entry, forecast, today) → seven days from today: { date, dow, label (오늘 / 월…일), mine (a 운동 요일), known (the forecast has the day),
 * rain, text ('비 예보 70%' or null), p }. forecast: Map 'YYYY-MM-DD' → { mm, p, g } for the entry's wall (weather.js parseDaily); the rain is dayWeather's.
 */
export function weekStrip(entry, forecast, today) {
  return Array.from({ length: STRIP_DAYS }, (_, i) => {
    const date = dayAt(today, i);
    const f = forecast?.get(dayKey(date)) ?? null;
    const wx = dayWeather(f);
    return { date, dow: date.getDay(), label: i === 0 ? '오늘' : DAY_KO[date.getDay()], mine: entry.days.includes(date.getDay()), known: !!f, rain: !!wx?.rain, text: wx?.rainText ?? null, p: f?.p ?? null };
  });
}

/** nextDryDay(strip, i) → the index of the first day after i with a forecast and no rain, or null. An unknown day is not a dry one. */
export function nextDryDay(strip, i) {
  const j = strip.findIndex((d, k) => k > i && d.known && !d.rain);
  return j < 0 ? null : j;
}

/**
 * alternatives(wall, date, { walls, favs, forecasts, now }) → up to three walls to go to instead, [{ wall, km, fav }]: dry that day, outdoor, open that day
 * (today: still open after `now`; a timetable that is out of date does not count, as in the weekend picks), within NEAR_KM of `wall`, nearest first;
 * what is missing is filled with dry ♥ walls at any distance. forecasts: Map wall name → parseDaily's day Map.
 */
export function alternatives(wall, date, { walls, favs = [], forecasts, now = null }) {
  const key = dayKey(date);
  const origin = wallPosition(wall);
  const nowMin = now && dayKey(now) === key ? now.getHours() * 60 + now.getMinutes() : 0;
  const ok = (w) => {
    if (w.name === wall.name || w.venue === 'indoor' || w.suspended || !hasHours(w) || staleness(w, now ?? date).stale
      || !openIntervals(w, date).some(([, end]) => end > nowMin) || !wallPosition(w)) return false;
    const f = forecasts.get(w.name)?.get(key);
    return !!f && !dayWeather(f).rain;
  };
  const km = (w) => (origin ? distanceKm(origin, wallPosition(w)) : null);
  const row = (w) => ({ wall: w, km: km(w), fav: favs.includes(w.name) });
  const byKm = (a, b) => (a.km ?? Infinity) - (b.km ?? Infinity);
  const pool = walls.filter(ok).map(row);
  const near = pool.filter((r) => r.km !== null && r.km <= NEAR_KM).sort(byKm).slice(0, MAX_ALTS);
  const fill = pool.filter((r) => r.fav && !near.includes(r)).sort(byKm).slice(0, MAX_ALTS - near.length);
  return [...near, ...fill];
}

/**
 * rainAlerts(schedule, { walls, forecasts, today }) → one per scheduled outdoor wall that has rain on a 운동 요일 this week:
 * { entry, wall, strip, pick } with pick the strip index of the first such day. Walls not in the list, with no days or indoors say nothing.
 */
export function rainAlerts(schedule, { walls, forecasts, today }) {
  const out = [];
  for (const entry of schedule) {
    const wall = walls.find((w) => w.name === entry.wall);
    if (!wall || wall.venue === 'indoor' || !entry.days.length) continue;
    const strip = weekStrip(entry, forecasts.get(wall.name), today);
    const pick = strip.findIndex((d) => d.mine && d.rain);
    if (pick >= 0) out.push({ entry, wall, strip, pick });
  }
  return out;
}

/** hintOf(alerts) → the folded card's line: the first wall, its first rainy day and the words, "외 N곳" for the rest; '' without alerts. */
export function hintOf(alerts) {
  if (!alerts.length) return '';
  const [a] = alerts;
  const d = a.strip[a.pick];
  const day = a.pick === 0 ? '오늘' : a.pick === 1 ? '내일' : `${DAY_KO[d.dow]}요일`;
  return `${a.wall.short_name || a.wall.name} · ${day} ${d.text}${alerts.length > 1 ? ` 외 ${alerts.length - 1}곳` : ''}`;
}

// ---- 어제 다녀왔어요? (spec 2단계): once a 운동 요일 has passed with no record, ask for it the next time the app opens. Never records by itself:
// a stamp is what the visitor says they did (the app knows no position, and stamps count toward what the 기록 tab opens).
export const SKIP_KEY = 'open-wall:schedule-skip';
export const SKIP_DAYS = 14; // an answer is kept this long, then forgotten
export const MAX_SKIPPED = 50;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (s) => typeof s === 'string' && DAY_RE.test(s) && ymd(new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8))) === s;

/** cleanSkipped(v, today) → [{ wall, date }]: a wall name and a real day from the last SKIP_DAYS days up to today; no repeats; the newest MAX_SKIPPED. */
export function cleanSkipped(v, today) {
  if (!Array.isArray(v)) return [];
  const from = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - SKIP_DAYS));
  const to = ymd(today);
  const out = [];
  for (const e of v) {
    if (!e || typeof e !== 'object' || typeof e.wall !== 'string' || !realDay(e.date) || e.date < from || e.date > to) continue;
    const wall = nfc(e.wall);
    if (wall && !out.some((x) => x.wall === wall && x.date === e.date)) out.push({ wall, date: e.date });
  }
  return out.slice(-MAX_SKIPPED);
}

export function loadSkipped(storage, today) {
  try {
    return cleanSkipped(JSON.parse(storage.getItem(SKIP_KEY)), today);
  } catch {
    return [];
  }
}

export function saveSkipped(storage, skipped, today) {
  try {
    storage.setItem(SKIP_KEY, JSON.stringify(cleanSkipped(skipped, today)));
  } catch { /* storage full or blocked: asked again next visit */ }
}

export const addSkipped = (skipped, wall, date, today) => cleanSkipped([...skipped, { wall, date }], today);

/**
 * askYesterday({ schedule, walls, recordsFor(name), skipped, today }) → { wall, date, label } for the first scheduled wall that had yesterday as a 운동 요일,
 * has no record for that day and was not answered 안 갔어요; else null. One at a time, and only yesterday: an older day is not asked about.
 */
export function askYesterday({ schedule, walls, recordsFor, skipped, today }) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const date = ymd(day);
  for (const e of schedule) {
    const wall = walls.find((w) => w.name === e.wall);
    if (!wall || wall.venue === 'indoor' || !e.days.includes(day.getDay())) continue;
    if (recordsFor(wall.name).some((r) => r.date === date) || skipped.some((x) => x.wall === wall.name && x.date === date)) continue;
    return { wall, date, label: `어제(${DAY_KO[day.getDay()]})` };
  }
  return null;
}

// ---- 기록 달력의 운동 예정 (spec 2단계): the dot on a day to come and the line under the picked day
/**
 * plannedOn(schedule, { walls, forecasts, date, today }) → [{ name, rain }] for the scheduled walls whose 운동 요일 is `date` ('YYYY-MM-DD', today or later);
 * rain is the 비 예보 words when the forecast has the day and it is wet (an indoor wall: null), else null. Walls not in the list are left out.
 */
export function plannedOn(schedule, { walls, forecasts, date, today }) {
  if (!realDay(date) || date < ymd(today)) return [];
  const dow = new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8)).getDay();
  return schedule.filter((e) => e.days.includes(dow)).flatMap((e) => {
    const wall = walls.find((w) => w.name === e.wall);
    if (!wall) return [];
    const wx = wall.venue === 'indoor' ? null : dayWeather(forecasts.get(wall.name)?.get(date));
    return [{ name: wall.name, short: wall.short_name || wall.name, rain: wx?.rainText ?? null }];
  });
}
