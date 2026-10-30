// src/schedule.js — 운동 스케줄 비 알림 (docs/superpowers/specs/2026-10-27-schedule-rain-alert-design.md): the walls and weekdays a visitor
// trains on, the week's rain for them, and where else to go on a wet day. In this browser only. No DOM.
import { staleness } from './card-model.js';
import { dayRule, hasHours, openIntervals } from './hours.js';
import { wallPageId } from './share-id.js';
import { DAY_KEYS, DAY_KO, ymd } from './time.js';
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

const NTH_KO = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
/**
 * closedWeekdays(wall) → { days: [dow], nth: [{ dow, words: ['둘째', '넷째'] }] } — the weekly closing weekdays (hours.js: a weekday whose hours are null)
 * and the nth-of-month ones, which close a day only some weeks. A wall with no hours (or hours without a null day) closes nothing.
 */
export function closedWeekdays(wall) {
  const days = hasHours(wall) ? DAY_KEYS.flatMap((k, dow) => (wall.hours?.[k] === null ? [dow] : [])) : [];
  const nth = (wall.exceptions?.nth_closed ?? []).map((n) => ({ dow: DAY_KEYS.indexOf(n.day), words: (n.nth ?? []).filter((i) => i > 0).map((i) => NTH_KO[i - 1]).filter(Boolean) })).filter((n) => n.dow >= 0 && n.words.length && !days.includes(n.dow));
  return { days, nth };
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
export function weekStrip(entry, forecast, today, moves = []) {
  return Array.from({ length: STRIP_DAYS }, (_, i) => {
    const date = dayAt(today, i);
    const f = forecast?.get(dayKey(date)) ?? null;
    const wx = dayWeather(f);
    return { date, dow: date.getDay(), label: i === 0 ? '오늘' : DAY_KO[date.getDay()], mine: isPlanned(entry, date, moves), known: !!f, rain: !!wx?.rain, text: wx?.rainText ?? null, p: f?.p ?? null };
  });
}

/** nextDryDay(strip, i) → the index of the first day after i with a forecast and no rain, or null. An unknown day is not a dry one. */
export function nextDryDay(strip, i) {
  const j = strip.findIndex((d, k) => k > i && d.known && !d.rain);
  return j < 0 ? null : j;
}

/**
 * alternatives(wall, date, { walls, favs, forecasts, now }) → up to `limit` (MAX_ALTS) walls to go to instead, [{ wall, km, fav }]: dry that day (an indoor wall is dry by itself and needs no forecast), open that day
 * (today: still open after `now`; a timetable that is out of date does not count, as in the weekend picks), within NEAR_KM of `wall`, nearest first;
 * what is missing is filled with dry ♥ walls at any distance. forecasts: Map wall name → parseDaily's day Map.
 */
export function alternatives(wall, date, { walls, favs = [], forecasts, now = null, limit = MAX_ALTS }) {
  const key = dayKey(date);
  const origin = wallPosition(wall);
  const nowMin = now && dayKey(now) === key ? now.getHours() * 60 + now.getMinutes() : 0;
  const ok = (w) => {
    if (w.name === wall.name || w.suspended || !hasHours(w) || staleness(w, now ?? date).stale
      || !openIntervals(w, date).some(([, end]) => end > nowMin) || !wallPosition(w)) return false;
    if (w.venue === 'indoor') return true;
    const f = forecasts.get(w.name)?.get(key);
    return !!f && !dayWeather(f).rain;
  };
  const km = (w) => (origin ? distanceKm(origin, wallPosition(w)) : null);
  const row = (w) => ({ wall: w, km: km(w), fav: favs.includes(w.name) });
  const byKm = (a, b) => (a.km ?? Infinity) - (b.km ?? Infinity);
  const pool = walls.filter(ok).map(row);
  const near = pool.filter((r) => r.km !== null && r.km <= NEAR_KM).sort(byKm).slice(0, limit);
  const fill = pool.filter((r) => r.fav && !near.includes(r)).sort(byKm).slice(0, limit - near.length);
  return [...near, ...fill];
}

/**
 * weekPlan(schedule, moves, { walls, forecasts, today }) → seven cells from today, the home card's week (spec 2026-10-30-week-schedule-card-design §2·§3):
 * { date, dow, label (오늘 / 월…일), items, out, bad, text, icon }. items: the walls trained on that day (moves applied), shut and rainy first, then the schedule's order,
 * each { entry, wall, indoor, state: 'suspended' | 'closed' | 'rain' | 'dry' | 'unknown', text, moved }; a shut wall says nothing of its rain, an indoor wall is dry.
 * out: the walls moved away from the day, [{ wall, to: Date }]. bad: a shut or rainy item. text: the worst item's words, icon: 'alert' | 'sky-rain' | 'check' | 'dash'.
 * A weekly or nth-of-month closing is the timetable, not news, so it is no state. Walls not in the list are left out.
 */
export function weekPlan(schedule, moves, { walls, forecasts, today }) {
  const rank = { suspended: 0, closed: 0, rain: 1, dry: 2, unknown: 2 };
  return Array.from({ length: STRIP_DAYS }, (_, i) => {
    const date = dayAt(today, i);
    const key = ymd(date);
    const items = [];
    const out = [];
    for (const entry of schedule) {
      const wall = walls.find((w) => w.name === entry.wall);
      if (!wall) continue;
      if (isPlanned(entry, date, moves)) {
        const why = dayRule(wall, date).why;
        const indoor = wall.venue === 'indoor';
        const wx = indoor ? null : dayWeather(forecasts.get(wall.name)?.get(dayKey(date)));
        const [state, text] = why === 'suspended' ? ['suspended', '휴관 중이에요'] : why === 'closed_date' ? ['closed', '임시휴무']
          : indoor ? ['dry', '실내'] : !wx ? ['unknown', '예보 없어요'] : wx.rain ? ['rain', wx.rainText] : ['dry', '비 없어요'];
        const mv = moves.find((m) => m.wall === entry.wall && m.to === key);
        items.push({ entry, wall, indoor, state, text, moved: !!mv, ...(mv && { from: mv.from }) });
      } else {
        const m = moves.find((x) => x.wall === entry.wall && x.from === key);
        if (m) out.push({ wall, to: new Date(+m.to.slice(0, 4), +m.to.slice(5, 7) - 1, +m.to.slice(8)) });
      }
    }
    items.sort((a, b) => rank[a.state] - rank[b.state]);
    const states = items.map((x) => x.state);
    const worst = states[0];
    const bad = rank[worst] < 2 && items.length > 0;
    const text = !items.length ? '' : worst === 'suspended' ? '휴관' : worst === 'closed' ? '임시휴무' : worst === 'rain' ? items[0].text : states.includes('dry') ? '비 없어요' : '예보 없어요';
    const icon = !items.length ? null : bad ? (worst === 'rain' ? 'sky-rain' : 'alert') : states.includes('dry') ? 'check' : 'dash';
    return { date, dow: date.getDay(), label: i === 0 ? '오늘' : DAY_KO[date.getDay()], items, out, bad, text, icon };
  });
}

export const dayWord = (date, pick) => (pick === 0 ? '오늘' : pick === 1 ? '내일' : `${DAY_KO[date.getDay()]}요일`);

/**
 * weekHint(plan) → { text, icon } for the folded card, '' / null without a 운동일. The earliest day with a shut or rainy wall, its first wall and words ("외 N곳" for the other
 * walls with trouble that week); without trouble the nearest 운동일 ("비 없어요", or just "운동" when there is no forecast; "외 N곳" for the walls of that day).
 */
export function weekHint(plan) {
  const name = (it) => it.wall.short_name || it.wall.name;
  const i = plan.findIndex((c) => c.bad);
  if (i >= 0) {
    const [first] = plan[i].items;
    const others = new Set(plan.flatMap((c) => c.items.filter((it) => it.state !== 'dry' && it.state !== 'unknown')).map(name));
    others.delete(name(first));
    return { text: `${dayWord(plan[i].date, i)} ${name(first)} · ${first.text}${others.size ? ` 외 ${others.size}곳` : ''}`, icon: plan[i].icon };
  }
  const j = plan.findIndex((c) => c.items.length);
  if (j < 0) return { text: '', icon: null };
  const [first, ...rest] = plan[j].items;
  return { text: `${dayWord(plan[j].date, j)} ${name(first)}${first.state === 'unknown' ? ' 운동' : ` · ${first.text}`}${rest.length ? ` 외 ${rest.length}곳` : ''}`, icon: 'check' };
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
export function askYesterday({ schedule, walls, recordsFor, skipped, today, moves = [] }) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const date = ymd(day);
  for (const e of schedule) {
    const wall = walls.find((w) => w.name === e.wall);
    if (!wall || !isPlanned(e, day, moves)) continue;
    if (recordsFor(wall.name).some((r) => r.date === date) || skipped.some((x) => x.wall === wall.name && x.date === date)) continue;
    return { wall, date, label: `어제(${DAY_KO[day.getDay()]})` };
  }
  return null;
}

// ---- 기록 달력의 운동 예정 (spec 2단계): the dot on a day to come and the line under the picked day
/**
 * plannedOn(schedule, { walls, forecasts, date, today, moves }) → [{ name, rain, moved? }] for the scheduled walls whose 운동 요일 is `date` ('YYYY-MM-DD', today or later);
 * rain is the 비 예보 words when the forecast has the day and it is wet (an indoor wall: null), else null. Walls not in the list are left out.
 */
export function plannedOn(schedule, { walls, forecasts, date, today, moves = [] }) {
  if (!realDay(date) || date < ymd(today)) return [];
  const day = new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8));
  return schedule.filter((e) => isPlanned(e, day, moves)).flatMap((e) => {
    const wall = walls.find((w) => w.name === e.wall);
    if (!wall) return [];
    const wx = wall.venue === 'indoor' ? null : dayWeather(forecasts.get(wall.name)?.get(date));
    return [{ name: wall.name, short: wall.short_name || wall.name, rain: wx?.rainText ?? null, ...(moves.some((m) => m.wall === e.wall && m.to === date) && { moved: true }) }];
  });
}

// ---- 이번 주만 옮기기 (spec 2026-10-30-week-schedule-card-design §6): one 운동일 of one wall moved a day or so; the weekly `days` stay as they are
export const SCHEDULE_MOVES_KEY = 'open-wall:schedule-moves';
export const MAX_MOVES = 20;
export const MOVE_KEEP_DAYS = 14; // a move whose days are both older than this is forgotten
export const MOVE_SPAN = 6; // a day is moved at most this far from where it was

const dayNo = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8)) / 864e5;

/** cleanMoves(v, today) → [{ wall, from, to }]: real, different days at most MOVE_SPAN apart, not both older than MOVE_KEEP_DAYS; one per (wall, from) and (wall, to), the later wins; the newest MAX_MOVES. */
export function cleanMoves(v, today) {
  if (!Array.isArray(v)) return [];
  const oldest = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - MOVE_KEEP_DAYS));
  let out = [];
  for (const e of v) {
    if (!e || typeof e !== 'object' || typeof e.wall !== 'string' || !realDay(e.from) || !realDay(e.to) || e.from === e.to) continue;
    const wall = nfc(e.wall);
    if (!wall || wall.length > MAX_NAME || Math.abs(dayNo(e.to) - dayNo(e.from)) > MOVE_SPAN || (e.from < oldest && e.to < oldest)) continue;
    out = out.filter((x) => x.wall !== wall || (x.from !== e.from && x.to !== e.to));
    out.push({ wall, from: e.from, to: e.to });
  }
  return out.slice(-MAX_MOVES);
}

// Stored with the wall's id like the schedule; without `walls` an id stays as it is, with them a wall that is not in the list is dropped.
export function loadMoves(storage, walls = [], today = new Date()) {
  try {
    const byId = new Map(walls.map((w) => [wallPageId(w), w.name]));
    const raw = JSON.parse(storage.getItem(SCHEDULE_MOVES_KEY));
    const list = cleanMoves(Array.isArray(raw) ? raw.map((e) => (e && typeof e === 'object' ? { ...e, wall: byId.get(e.wall) ?? e.wall } : e)) : raw, today);
    return walls.length ? list.filter((m) => walls.some((w) => w.name === m.wall)) : list;
  } catch {
    return [];
  }
}

export function saveMoves(storage, moves, walls = [], today = new Date()) {
  try {
    const byName = new Map(walls.map((w) => [w.name, wallPageId(w)]));
    storage.setItem(SCHEDULE_MOVES_KEY, JSON.stringify(cleanMoves(moves, today).map((m) => ({ ...m, wall: byName.get(m.wall) ?? m.wall }))));
  } catch { /* storage full or blocked: keep in memory */ }
}

const dowOf = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8)).getDay();

/** liveMoves(schedule, moves, today) → the moves that still mean something: the wall is scheduled, `from` is one of its 운동 요일 and `to` is not, no two onto one day. Stored as they are. */
export function liveMoves(schedule, moves, today) {
  const out = [];
  for (const m of cleanMoves(moves, today)) {
    const e = schedule.find((x) => x.wall === m.wall);
    if (e && e.days.includes(dowOf(m.from)) && !e.days.includes(dowOf(m.to)) && !out.some((x) => x.wall === m.wall && x.to === m.to)) out.push(m);
  }
  return out;
}

/** isPlanned(entry, date, moves) → is `date` a 운동 day of the entry's wall: moved onto, or its weekday and not moved away. moves: liveMoves'. The one place that decides it. */
export function isPlanned(entry, date, moves = []) {
  const key = ymd(date);
  const mine = moves.filter((m) => m.wall === entry.wall);
  return mine.some((m) => m.to === key) || (entry.days.includes(date.getDay()) && !mine.some((m) => m.from === key));
}

/** setMove(moves, { wall, from, to }) → the list with that day moved (the same (wall, from) is moved again; two onto one day keep the later); to === from is the day put back. */
export function setMove(moves, { wall, from, to }) {
  const rest = moves.filter((m) => m.wall !== wall || (m.from !== from && m.to !== to));
  return from === to ? rest : [...rest, { wall, from, to }].slice(-MAX_MOVES);
}

export const clearMove = (moves, wall, from) => moves.filter((m) => m.wall !== wall || m.from !== from);

export const keyDay = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8));

/**
 * moveTargets(item, date, { today, moves, forecasts }) → the two moves of a weekPlan item on `date`, [{ dir: -1 | 1, date, disabled, reason, sunny }]: a day before and a day after.
 * disabled with `reason` (a line to show): a past day, beyond the strip's last day, a day the wall is already trained on, a closing day (dayRule slot null), too far from where the day started (MOVE_SPAN).
 * sunny: the item is rainy or shut and this day has a forecast without rain (an indoor wall never; no forecast is no tip).
 */
export function moveTargets(item, date, { today, moves = [], forecasts }) {
  const { entry, wall } = item;
  const first = ymd(today);
  const last = ymd(dayAt(today, STRIP_DAYS - 1));
  const from = item.from ?? ymd(date); // where this day started: a moved day goes on from its first place
  const bad = item.state === 'suspended' || item.state === 'closed' || item.state === 'rain';
  return [-1, 1].map((dir) => {
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate() + dir);
    const key = ymd(to);
    const word = `${DAY_KO[to.getDay()]}요일`;
    const reason = key < first ? '지난 날이에요'
      : key > last ? '이번 주 줄 밖이에요'
      : isPlanned(entry, to, moves) ? `${word}에 이미 있어요`
      : key !== from && entry.days.includes(to.getDay()) ? `${word}은 옮겨 둔 날이에요`
      : dayRule(wall, to).slot === null ? `${word}은 쉬는 날이에요`
      : Math.abs(dayNo(key) - dayNo(from)) > MOVE_SPAN ? '너무 멀리 옮길 수 없어요' : null;
    const wx = item.indoor ? null : dayWeather(forecasts.get(wall.name)?.get(dayKey(to)));
    return { dir, date: to, disabled: !!reason, reason, sunny: bad && !item.indoor && !reason && !!wx && !wx.rain };
  });
}
