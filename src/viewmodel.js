// src/viewmodel.js — DOM-free helpers for the list as a whole (scope, filters, order, distance, map pins),
// the time words and slider, the bar/axis math and the hours tables of the "더 보기" pictures.
// One card's values are composed in card-model.js; the saved filters live in ui-state.js.
import { dayRule, hasHours, inWinter, nthOfMonth, openIntervals, orderIntervals, slotOf } from './hours.js';
import { isSunlit, sunWindows } from './sun.js';
import { DAY_KEYS, DAY_KO, toMin, ymd } from './time.js';

// ---- time words ----
const p2 = (n) => String(n).padStart(2, '0');
export const fmtMin = (m) => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;

export const formatRanges = (ranges) =>
  ranges.length ? ranges.map(([a, b]) => `${fmtMin(a)}–${fmtMin(b)}`).join(', ') : '없음';

export const dayText = (d) => `${d.getMonth() + 1}/${d.getDate()}(${DAY_KO[d.getDay()]})`;

// Summary lead: "지금 ", "14:00에 " (today), "10/9(금) 14:00에 " (another day).
export const summaryLead = (at, now, isNow) =>
  (isNow ? '지금 ' : `${ymd(at) === ymd(now) ? '' : `${dayText(at)} `}${fmtMin(at.getHours() * 60 + at.getMinutes())}에 `);

// ---- slider ----
const SLIDER = { min: 360, max: 1410, step: 10 };
const round10 = (m) => Math.round(m / 10) * 10;
export const sliderValue = (m) => Math.min(Math.max(round10(m), SLIDER.min), SLIDER.max);
// A pick is "now" when the date is today and the slider sits on the real time (rounded to its 10-minute step).
export const isLivePick = (date, min, now) => date === ymd(now) && min === round10(now.getHours() * 60 + now.getMinutes());
// Slider label: the real time; "(지금)" when the live time sits outside the slider and the thumb rests at its end.
export const timeLabel = (min, live) => `${fmtMin(min)}${live && sliderValue(min) !== round10(min) ? ' (지금)' : ''}`;

// ---- 구분 (venue) ----
const venueOf = (wall) => wall.venue ?? 'outdoor';
const VENUE_OK = { indoor: ['indoor', 'both'], outdoor: ['outdoor', 'both'] };

// The wall as the chosen 구분 sees it; every status, bar, break and remaining time goes through this
// (buildList), so the list, the cards and the map never read different hours. `hours`/`winter` are the
// outdoor timetable. With 실내 picked, a 'both' wall uses its indoor_hours/indoor_winter and no sun
// (venue becomes 'indoor'); without indoor hours it has none (→ 미입력 group, "실내 시간 미입력").
// timeBasis: 'outdoor' marks a 'both' wall read on its outdoor hours ("실외 시간 기준"), else null.
export function viewOf(wall, venue = 'any') {
  if (wall.venue !== 'both') return { ...wall, timeBasis: null };
  if (venue !== 'indoor') return { ...wall, timeBasis: 'outdoor' };
  const has = Object.keys(wall.indoor_hours ?? {}).length > 0;
  return {
    ...wall,
    venue: 'indoor',
    hours: has ? wall.indoor_hours : {},
    winter: has ? wall.indoor_winter ?? { type: 'none' } : { type: 'none' },
    timeBasis: has ? 'indoor' : 'indoor-missing',
  };
}
export const unknownText = (wall) => (wall?.timeBasis === 'indoor-missing' ? '실내 시간 미입력' : '운영시간 미입력');

// ---- list: scope, filters, groups, order ----
export const hasParking = (wall) => wall.parking?.status === 'free' || wall.parking?.status === 'paid';

// Regions are the walls' `region` text ("서울 동작구"); the first word is the 시·도 they are grouped by.
export function regionList(walls) {
  return [...new Set(walls.map((w) => w.region).filter((r) => typeof r === 'string' && r.trim()))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
}
export function regionGroups(regions) {
  const groups = new Map();
  for (const r of regions) {
    const top = r.trim().split(/\s+/)[0];
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top).push(r);
  }
  return [...groups].map(([name, list]) => ({ name, regions: list }));
}

// The one place that narrows the walls themselves (every group, the map pins, the counts):
// 내 지역, 실내/실외, 주차 가능만. The sun / minimum-stay filters stay with filterRows (open group only).
export function scopeRows(rows, { regions = [], venue = 'any', parkOnly = false } = {}) {
  return rows.filter(({ wall }) =>
    (!regions.length || regions.includes(wall.region))
    && (!VENUE_OK[venue] || VENUE_OK[venue].includes(venueOf(wall)))
    && (!parkOnly || hasParking(wall)));
}

// Filters only reach the open group; closed/unknown stay as they are. A sun filter drops walls
// whose facing is unknown (lit === null), but not indoor-only ones (no sun to judge; shown as 실내);
// `short` (below the minimum stay) is dropped too.
export function filterRows(rows, sun) {
  const want = sun === 'sun' ? true : sun === 'shade' ? false : undefined;
  return rows.filter((r) => r.status.state !== 'open'
    || (!r.short && (want === undefined || r.lit === want || r.wall.venue === 'indoor')));
}

export function groupRows(rows) {
  return {
    open: rows.filter((r) => r.status.state === 'open'),
    closed: rows.filter((r) => r.status.state === 'closed'),
    unknown: rows.filter((r) => r.status.state === 'unknown'),
  };
}

export function sortRows(rows, mode) {
  const out = [...rows];
  if (mode !== 'distance') return out;
  const key = (r) => r.distanceKm ?? Infinity;
  return out.sort((a, b) => key(a) - key(b) || a.wall.name.localeCompare(b.wall.name, 'ko'));
}

// a break ahead is not a closing: no "soon" colour (list row, card, map pin)
export const endingSoon = (row) => row.status.state === 'open' && row.status.endKind !== 'break' && row.status.remainingMin <= 60;

export const shortName = (wall) => wall.short_name || wall.name;

// ---- position, distance, map pins ----
export function wallPosition(wall) {
  if (wall.location) return { lat: wall.location.lat, lng: wall.location.lng, approx: wall.location.approx === true };
  const { lat, lng } = wall.sun ?? {};
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, approx: false } : null;
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function withDistance(rows, origin) {
  return rows.map((r) => {
    const p = origin ? wallPosition(r.wall) : null;
    return { ...r, distanceKm: p ? distanceKm(origin, p) : null };
  });
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // Infinity-safe

/**
 * pickChips(walls, {favs, visits, limit = 3}) → wall[]: the chips of the 기록 추가 sheet. ♥ first (saved order), then the
 * walls logged most recently (newest last visit, then more visits). Names not in `walls` and repeats are dropped.
 * visits: Map name → {last: 'YYYY-MM-DD', count} (visitStats in log.js).
 */
export function pickChips(walls, { favs = [], visits = new Map(), limit = 3 } = {}) {
  const byName = new Map(walls.map((w) => [w.name, w]));
  const out = [];
  const take = (name) => {
    const w = byName.get(name);
    if (w && !out.includes(w)) out.push(w);
  };
  favs.forEach(take);
  [...visits].sort(([, a], [, b]) => cmp(b.last, a.last) || b.count - a.count).forEach(([name]) => take(name));
  return out.slice(0, limit);
}

/**
 * searchPicks(walls, q, {origin}) → [{wall, km}]: the walls whose name or region holds `q`. With an origin ({lat, lng} already
 * in memory) nearest first (no position: after those with one); otherwise 가나다 by name. km: null without a position.
 */
export function searchPicks(walls, q, { origin = null } = {}) {
  const k = String(q ?? '').trim().normalize('NFC').toLowerCase();
  const byName = (a, b) => a.wall.name.localeCompare(b.wall.name, 'ko');
  return walls
    .filter((w) => !k || w.name.toLowerCase().includes(k) || (w.region ?? '').toLowerCase().includes(k))
    .map((wall) => {
      const p = origin ? wallPosition(wall) : null;
      return { wall, km: p ? distanceKm(origin, p) : null };
    })
    .sort((a, b) => (origin ? cmp(a.km ?? Infinity, b.km ?? Infinity) : 0) || byName(a, b));
}

function pinState(status) {
  if (status.state === 'open') return endingSoon({ status }) ? 'soon' : 'open';
  return status.state === 'closed' ? 'closed' : 'unknown';
}

// Map markers: rows with a position become pins, the rest are listed by name.
export function mapPins(rows) {
  const pins = [];
  const unlocated = [];
  for (const row of rows) {
    const pos = wallPosition(row.wall);
    if (pos) pins.push({ row, ...pos, pin: pinState(row.status) });
    else unlocated.push(row.wall.name);
  }
  return { pins, unlocated };
}

// ---- one day's bar, the 06–24 axis ----
const SUN_STEP = 10;
export function sunIntervals(wall, date) {
  return sunWindows(wall, date, SUN_STEP).map(([a, b]) => [toMin(a), Math.min(toMin(b) + SUN_STEP, 1440)]);
}

export function dayBar(wall, at) {
  const open = openIntervals(wall, at);
  const sunKnown = isSunlit(wall, at).lit !== null;
  const sun = sunKnown ? sunIntervals(wall, at) : null;
  const nowMin = at.getHours() * 60 + at.getMinutes();
  const sunText = sun ? `양달 ${formatRanges(sun)}` : wall.venue === 'indoor' ? '실내' : '양달 정보 없음';
  return { open, sun, nowMin, label: `운영 ${formatRanges(open)}, ${sunText}, 현재 ${fmtMin(nowMin)}` };
}

// The timetable axis runs 06:00–24:00.
const AXIS = [360, 1440];
export const axisFrac = (m) => (Math.min(Math.max(m, AXIS[0]), AXIS[1]) - AXIS[0]) / (AXIS[1] - AXIS[0]);

// Open intervals cut at `nowMin` into [a, b, past] pieces on the axis; zero-width pieces are dropped.
export function barSegments(open, nowMin) {
  const clip = (m) => Math.min(Math.max(m, AXIS[0]), AXIS[1]);
  const out = [];
  for (const [a0, b0] of open) {
    const [a, b] = [clip(a0), clip(b0)];
    const cut = Math.min(Math.max(nowMin, a), b);
    if (cut > a) out.push([a, cut, true]);
    if (b > cut) out.push([cut, b, false]);
  }
  return out;
}

// ---- hours tables ('더 보기' grid, the picked day's line, seasonal sun) ----
// One row per weekday (Mon→Sun) plus 공휴일, read with slotOf, the same source as getStatus (dayRule).
// Each row: text ("10:30–14:00, 15:00–18:30"), range (first open–last close), minute intervals (an
// after-midnight close runs past 1440; 휴무 = []), breaks (gaps between intervals), closed (휴무),
// nth (둘째·넷째… closures of that weekday), today (the row the picked day follows, only in its own season).
// pick 'summer'/'winter' previews the other season (preview: true); without a winter rule there is one season.
// A winter closure is one line. closed_dates and nth closures of the day itself are not drawn here (dayLine says so).
const WEEK = [['mon', '월'], ['tue', '화'], ['wed', '수'], ['thu', '목'], ['fri', '금'], ['sat', '토'], ['sun', '일']];
function dayHours(v) {
  if (v === null) return { text: '휴무', range: '휴무', intervals: [] };
  const raw = typeof v[0] === 'string' ? [v] : v;
  const list = orderIntervals(raw) ?? raw;
  return {
    text: list.map(([a, b]) => `${a}–${b}`).join(', '),
    range: `${list[0][0]}–${list[list.length - 1][1]}`,
    intervals: list.map(([a, b]) => [toMin(a), toMin(b) > toMin(a) ? toMin(b) : toMin(b) + 1440]),
  };
}
export const NTH_KO = ['', '첫째', '둘째', '셋째', '넷째', '다섯째'];
const HOL_NONE = { weekday: '평소 요일대로' };
export function weeklyHours(wall, date, pick = null) {
  const rule = dayRule(wall, date);
  const hasWinter = (wall.winter?.type ?? 'none') !== 'none';
  const current = rule.winter ? 'winter' : 'summer';
  const season = hasWinter && (pick === 'summer' || pick === 'winter') ? pick : current;
  const winter = season === 'winter';
  const live = season === current;
  const base = { season, preview: !live, hasWinter };
  if (!hasHours(wall)) return { ...base, rows: [] };
  if (winter && wall.winter.type === 'closed') {
    return { ...base, rows: [{ key: 'winter', days: '동절기', text: '외벽 휴장', range: '외벽 휴장', today: live, intervals: [], breaks: [], closed: true, nth: null }] };
  }
  const rows = [...WEEK, ['hol', '공휴일']].map(([key, days]) => {
    const v = slotOf(wall, key, winter);
    const nth = wall.exceptions?.nth_closed?.find((r) => r.day === key)?.nth ?? null;
    const today = live && rule.key === key;
    if (v === undefined) {
      const text = key === 'hol' ? HOL_NONE[wall.holiday] ?? '운영 미확인' : '미입력';
      return { key, days, text, range: text, today, intervals: [], breaks: [], closed: false, nth };
    }
    const d = dayHours(v);
    return { key, days, today, ...d, breaks: d.intervals.slice(1).map(([a], i) => [d.intervals[i][1], a]), closed: v === null, nth };
  });
  return { ...base, rows };
}

// The picked day's hours for the first view, from openIntervals (the same source as getStatus), so
// closed_dates, nth closures, holidays, yesterday's after-midnight tail and winter hours read the same as the status.
// `closed`: the wall has hours but none on this day. `holiday`: "한글날 · 주말 시간" etc. on a public holiday.
const HOL_RULE_TEXT = { weekend: '공휴일은 주말 시간', closed: '공휴일 휴무', weekday: '공휴일도 평소 요일대로' };
export function dayLine(wall, date) {
  const rule = dayRule(wall, date);
  const season = rule.winter ? '동절기' : '';
  const intervals = openIntervals(wall, date);
  const holiday = rule.holiday && hasHours(wall)
    ? `${rule.holiday} · ${rule.key === 'hol' || wall.holiday === 'weekday' ? HOL_RULE_TEXT[wall.holiday] : wall.holiday ? '정기휴무일과 겹침' : '공휴일 운영 미확인'}`
    : null;
  if (intervals.length) return { season, closed: false, text: formatRanges(intervals), holiday };
  if (!hasHours(wall)) return { season, closed: false, text: unknownText(wall), holiday };
  let text = '휴무';
  if (rule.why === 'closed_date') text = '임시 휴장 · 휴무';
  else if (rule.why === 'nth') text = `${NTH_KO[nthOfMonth(date)]} ${DAY_KO[date.getDay()]}요일 휴무`;
  else if (season && wall.winter.type === 'closed') text = '외벽 휴장';
  else if (rule.key === 'hol' && wall.holiday === 'closed') text = '공휴일 휴무';
  else if (rule.slot === undefined) text = '운영시간 미입력';
  return { season, closed: true, text, holiday };
}

// Same-weekday sun at the three season days (seasonWindows), against that weekday's hours in that season
// (the current row: the picked date's season).
// on: sunny minutes inside the hours; current: the season row the picked date belongs to (6–8 / 12–2 / else).
const SEASON_DAYS = [['여름', '6/21', 5, 21], ['봄·가을', '3/21', 2, 21], ['겨울', '12/21', 11, 21]];
export function seasonWindows(wall, year) {
  return SEASON_DAYS.map(([name, date, mo, d]) => ({ name, date, windows: sunIntervals(wall, new Date(year, mo, d, 12)) }));
}
const overlap = (a, b) => a.flatMap(([s, e]) => b.map(([x, y]) => [Math.max(s, x), Math.min(e, y)])).filter(([s, e]) => e > s);
export function seasonSun(wall, at) {
  const key = DAY_KEYS[at.getDay()];
  const m = at.getMonth() + 1;
  const cur = m >= 6 && m <= 8 ? 0 : m === 12 || m <= 2 ? 2 : 1;
  return seasonWindows(wall, at.getFullYear()).map((s, i) => {
    const [, , mo, d] = SEASON_DAYS[i];
    // the picked date's own season for its row (봄·가을 spans both), else the season day's
    const v = slotOf(wall, key, inWinter(wall, i === cur ? at : new Date(at.getFullYear(), mo, d)));
    const open = v ? dayHours(v).intervals.map(([a, b]) => [a, Math.min(b, 1440)]) : [];
    const on = overlap(open, s.windows);
    return { ...s, open, on, closed: v === null, unknown: v === undefined, current: i === cur };
  });
}

// The winter rule's months as words ("11~2월"), or null without one (not "the same all year": just not known).
// Month granularity only: the data has from_month/to_month, no days.
const monthSpan = (a, b) => (a === b ? `${a}월` : `${a}~${b}월`);
export function winterSpan(wall) {
  const w = wall.winter;
  if (!w || w.type === 'none') return null;
  const allYear = (w.to_month - w.from_month + 12) % 12 === 11;
  return {
    closed: w.type === 'closed',
    winter: monthSpan(w.from_month, w.to_month),
    summer: allYear ? null : monthSpan((w.to_month % 12) + 1, ((w.from_month + 10) % 12) + 1),
  };
}
