// src/viewmodel.js
import { dayRule, hasHours, inWinter, nthOfMonth, openIntervals, orderIntervals, slotOf } from './hours.js';
import { isSunlit, sunWindows } from './sun.js';
import { DAY_KEYS, DAY_KO, toMin, ymd } from './time.js';

const SUN_STEP = 10;
const p2 = (n) => String(n).padStart(2, '0');
const fmtMin = (m) => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;

export const formatRanges = (ranges) =>
  ranges.length ? ranges.map(([a, b]) => `${fmtMin(a)}–${fmtMin(b)}`).join(', ') : '없음';

export function sunIntervals(wall, date) {
  return sunWindows(wall, date, SUN_STEP).map(([a, b]) => [toMin(a), Math.min(toMin(b) + SUN_STEP, 1440)]);
}

const noSunText = (wall) => (wall.venue === 'indoor' ? '실내' : '양달 정보 없음');

export function dayBar(wall, at) {
  const open = openIntervals(wall, at);
  const sunKnown = isSunlit(wall, at).lit !== null;
  const sun = sunKnown ? sunIntervals(wall, at) : null;
  const nowMin = at.getHours() * 60 + at.getMinutes();
  const sunText = sun ? `양달 ${formatRanges(sun)}` : noSunText(wall);
  return { open, sun, nowMin, label: `운영 ${formatRanges(open)}, ${sunText}, 현재 ${fmtMin(nowMin)}` };
}

// Timetable row bar. A closed row whose next opening falls on a later day draws that day's hours
// (openIntervals of nextOpenAt's day, the same source as getStatus), so "10/8 10:00 오픈" sits on
// 10/8's bar. `ahead` is that day; it has no "now" (nowMin null) and nothing is past.
export function rowBar(wall, status, at) {
  const next = status.state === 'closed' ? status.nextOpenAt : null;
  if (!next || ymd(next) === ymd(at)) return { ...dayBar(wall, at), ahead: null };
  const day = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const { open, sun } = dayBar(wall, day);
  const sunText = sun ? `양달 ${formatRanges(sun)}` : noSunText(wall);
  return { open, sun, nowMin: null, ahead: day, label: `${day.getMonth() + 1}/${day.getDate()} 운영 ${formatRanges(open)}, ${sunText}` };
}

// Gaps between today's open intervals (lunch break etc.), as [start, end] minutes.
export function breakRanges(wall, at) {
  const open = openIntervals(wall, at);
  return open.slice(1).map(([a], i) => [open[i][1], a]).filter(([x, y]) => y > x);
}

export function groupRows(rows) {
  return {
    open: rows.filter((r) => r.status.state === 'open'),
    closed: rows.filter((r) => r.status.state === 'closed'),
    unknown: rows.filter((r) => r.status.state === 'unknown'),
  };
}

// a break ahead is not a closing: no "soon" colour
export const endingSoon = (row) => row.status.state === 'open' && row.status.endKind !== 'break' && row.status.remainingMin <= 60;

export function pinState(status) {
  if (status.state === 'open') return endingSoon({ status }) ? 'soon' : 'open'; // a break ahead is not "soon"
  return status.state === 'closed' ? 'closed' : 'unknown';
}

export function nextOpening(rows) {
  let best = null;
  for (const r of rows) {
    if (r.status.state !== 'closed' || !r.status.nextOpenAt) continue;
    if (!best || r.status.nextOpenAt < best.status.nextOpenAt) best = r;
  }
  return best;
}

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km) {
  if (km < 1) {
    const m = Math.round(km * 100) * 10;
    return m >= 1000 ? '1.0km' : `${m}m`;
  }
  return `${km.toFixed(1)}km`;
}

export function wallPosition(wall) {
  if (wall.location) return { lat: wall.location.lat, lng: wall.location.lng, approx: wall.location.approx === true };
  const { lat, lng } = wall.sun ?? {};
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, approx: false } : null;
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

export function withDistance(rows, origin) {
  return rows.map((r) => {
    const p = origin ? wallPosition(r.wall) : null;
    return { ...r, distanceKm: p ? distanceKm(origin, p) : null };
  });
}

export function sortRows(rows, mode) {
  const out = [...rows];
  if (mode !== 'distance') return out;
  const key = (r) => r.distanceKm ?? Infinity;
  return out.sort((a, b) => key(a) - key(b) || a.wall.name.localeCompare(b.wall.name, 'ko'));
}

const PARKING_TEXT = {
  free: ['주차 무료', 'good'],
  paid: ['주차 유료', 'neutral'],
  none: ['주차 불가', 'warn'],
};
export function parkingLabel(parking) {
  const [text, tone] = PARKING_TEXT[parking?.status] ?? ['주차 확인 필요', 'muted'];
  return { text, tone, note: parking?.note ?? '' };
}

export const hasParking = (wall) => wall.parking?.status === 'free' || wall.parking?.status === 'paid';

export const shortName = (wall) => wall.short_name || wall.name;

export const photoSrc = (wall) => (wall.photo ? `data/${wall.photo}` : null);

export function placeholderText(wall) {
  const tags = wall.tags ?? [];
  return {
    primary: wall.height_m ? `${wall.height_m}m` : '외벽',
    secondary: ['스피드월', '리드', '볼더', '실내벽'].find((t) => tags.includes(t)) ?? '',
  };
}

// ---- timetable ----
// Filters only reach the open group; closed/unknown stay as they are. A sun filter drops walls
// whose facing is unknown (lit === null), but not indoor-only ones (no sun to judge; shown as 실내);
// `short` (below the minimum stay) is dropped too.
export function filterRows(rows, sun) {
  const want = sun === 'sun' ? true : sun === 'shade' ? false : undefined;
  return rows.filter((r) => r.status.state !== 'open'
    || (!r.short && (want === undefined || r.lit === want || r.wall.venue === 'indoor')));
}

// ---- 내 지역 / 구분 ----
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
// Saved selection (open-wall:ui): strings only, no repeats, and (when the list is known) only regions that exist.
export function cleanRegions(v, known = null) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((r) => typeof r === 'string' && (!known || known.includes(r))))];
}

export const VENUE_FILTERS = ['any', 'indoor', 'outdoor'];
export const cleanVenue = (v) => (VENUE_FILTERS.includes(v) ? v : 'any');
export const venueOf = (wall) => wall.venue ?? 'outdoor';
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

// The one place that narrows the walls themselves (every group, the map pins, the counts):
// 내 지역, 실내/실외, 주차 가능만. The sun / minimum-stay filters stay with filterRows (open group only).
export function scopeRows(rows, { regions = [], venue = 'any', parkOnly = false } = {}) {
  return rows.filter(({ wall }) =>
    (!regions.length || regions.includes(wall.region))
    && (!VENUE_OK[venue] || VENUE_OK[venue].includes(venueOf(wall)))
    && (!parkOnly || hasParking(wall)));
}

export const regionLabel = (regions) =>
  (!regions?.length ? '' : regions.length === 1 ? `내 지역: ${regions[0]}` : `내 지역 ${regions.length}곳`);

const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
export function rowLeft(status, at, wall) {
  if (status.state === 'unknown') return unknownText(wall);
  if (status.state === 'closed') {
    const d = status.nextOpenAt;
    if (!d) return '다음 오픈 정보 없음';
    const t = fmtMin(d.getHours() * 60 + d.getMinutes());
    return `${ymd(d) === ymd(at) ? '' : `${md(d)} `}${t} 오픈`;
  }
  const r = status.remainingMin;
  const brk = status.endKind === 'break';
  if (r <= 60) return brk ? `곧 휴게 · ${r}분 후` : `곧 마감 · ${r}분 남음`;
  return `${Math.floor(r / 60)}시간${r % 60 ? ` ${r % 60}분` : ''} ${brk ? '뒤 휴게' : '남음'}`;
}

// The timetable axis runs 06:00–24:00.
export const AXIS = [360, 1440];
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

export const SLIDER = { min: 360, max: 1410, step: 10 };
const round10 = (m) => Math.round(m / 10) * 10;
export const sliderValue = (m) => Math.min(Math.max(round10(m), SLIDER.min), SLIDER.max);
// A pick is "now" when the date is today and the slider sits on the real time (rounded to its 10-minute step).
export const isLivePick = (date, min, now) => date === ymd(now) && min === round10(now.getHours() * 60 + now.getMinutes());
export { fmtMin };

// Hours older than a year may have changed (seasonal schedules, notices): flag them. Only walls with hours are judged.
export const STALE_DAYS = 365;
export function staleness(wall, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wall.checked_at ?? '');
  const days = m ? Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5) : null;
  const stale = hasHours(wall) && (days === null || days > STALE_DAYS);
  return { stale, label: m ? `${m[1]}-${m[2]}` : '확인일 없음' };
}

// ---- timetable grid ('더 보기') ----
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

// ---- memo, sorted into what the UI draws ----
// address: the 주소 line; sizes: 폭 (from "폭 30m") and 높이 (height_m) as numbers; rest: the other lines as 안내,
// closures and warnings first, then lines about hours/seasons, then the rest (each group in memo order).
const SIZE_RE = /^(\d+(?:\.\d+)?)\s*m$/;
export const WARN_RE = /주의|금지|제한|불가|⚠/;
const TIME_RE = /휴게|하계|동계|하절기|동절기|평일|주말|운영|개장|재개|\d:\d\d|\d시(?!간)/;
const restRank = (l) => (l.key || WARN_RE.test(l.value) ? 0 : TIME_RE.test(`${l.label ?? ''} ${l.value}`) ? 1 : 2);
export function memoFacts(wall) {
  let address = null;
  const sizes = [];
  const rest = [];
  for (const l of memoLines(wall.memo)) {
    if (l.label === '주소' && !address) address = l.value;
    else if (l.label === '폭' && SIZE_RE.test(l.value)) sizes.push({ label: '폭', value: l.value.match(SIZE_RE)[1], unit: 'm' });
    else rest.push(l);
  }
  if (wall.height_m) sizes.push({ label: '높이', value: String(wall.height_m), unit: 'm' });
  return { address, sizes, rest: rest.sort((a, b) => restRank(a) - restRank(b)) };
}

// 안내 lines in the first view: the first `limit` show, the rest fold. Warning/closure lines come first
// (memoFacts sorts them to the front), so a run of them longer than `limit` is shown whole.
export function splitInfo(lines, limit = 3) {
  let warn = 0;
  while (warn < lines.length && (lines[warn].key || WARN_RE.test(lines[warn].value))) warn++;
  const n = Math.max(limit, warn);
  return { shown: lines.slice(0, n), folded: lines.slice(n) };
}

// Parking names from the note ("외벽 앞 · 롯데몰 · 공영주차장").
export const parkingNames = (parking) => (parking?.note ?? '').split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);

// Minimum stay: 상관없음 / 3 / 5 / 8 hours. Older saved choices (1h, 2h) map to the nearest sensible one.
export const MIN_HOURS = ['0', '3', '5', '8'];
export const migrateMinHours = (v) => ({ 1: '0', 2: '3' }[String(v)] ?? (MIN_HOURS.includes(String(v)) ? String(v) : '0'));

// Slider label: the real time; "(지금)" when the live time sits outside the slider and the thumb rests at its end.
export const timeLabel = (min, live) => `${fmtMin(min)}${live && sliderValue(min) !== round10(min) ? ' (지금)' : ''}`;

// The filters that can hide open walls, by name.
const activeFilters = ({ sun = 'any', minHours = '0', parkOnly = false, venue = 'any', regions = [] }) =>
  [regionLabel(regions), venue === 'indoor' && '실내', venue === 'outdoor' && '실외',
    sun === 'sun' && '양달', sun === 'shade' && '응달', minHours !== '0' && `${minHours}시간+`, parkOnly && '주차 가능만'].filter(Boolean);

// Why the open group is empty: nothing open at all, or the active filters hid the open ones.
export function emptyText(f, openTotal, isNow = true) {
  const on = activeFilters(f);
  if (!openTotal || !on.length) return `${isNow ? '지금' : '이 시각에'} 열려 있는 곳이 없어요. 아래 닫힌 곳에서 다음 오픈 시간을 확인해 보세요.`;
  return `열린 곳 ${openTotal}곳 중 조건(${on.join(' · ')})에 맞는 곳이 없어요. 조건을 바꿔 보세요.`;
}

// "조건 지우기" is offered only when walls are open and a filter other than 내 지역 hid them;
// 내 지역 has its own way back, "전국으로 보기" (regionActive).
export const filtersActive = (f, openTotal) => openTotal > 0 && activeFilters({ ...f, regions: [] }).length > 0;
export const regionActive = (f, openTotal) => openTotal > 0 && (f.regions?.length ?? 0) > 0;

// The sheet button counts parking, 휴게 합산 while a minimum stay is on, and 내 지역 (one, however many regions).
export const sheetCount = ({ minHours = '0', withBreaks = false, regions = [] }, parkOnly) =>
  Number(parkOnly) + Number(withBreaks && minHours !== '0') + Number(regions.length > 0);

export const dayText = (d) => `${d.getMonth() + 1}/${d.getDate()}(${DAY_KO[d.getDay()]})`;

// Summary lead: "지금 ", "14:00에 " (today), "10/9(금) 14:00에 " (another day).
export const summaryLead = (at, now, isNow) =>
  (isNow ? '지금 ' : `${ymd(at) === ymd(now) ? '' : `${dayText(at)} `}${fmtMin(at.getHours() * 60 + at.getMinutes())}에 `);

// Sun word on an open list row, so 응달 and "facing unknown" read apart too (not only the orange band).
export function sunTag(row) {
  if (row.status.state !== 'open') return null;
  if (row.wall?.venue === 'indoor') return { text: '실내', tone: 'indoor' }; // no sun indoors
  if (row.lit === true) return { text: '양달', tone: 'sun' };
  if (row.lit === false) return { text: '응달', tone: 'shade' };
  return { text: '방향 모름', tone: 'unknown' };
}

// Memo text → [{label, value, key}] lines. Lines split on newlines, then on sentence-ending periods
// (not "..." and not after a single letter/digit like "A. B."); a known word at the start becomes the
// label, "짧은 말: 값" too (a colon followed by a space, so "11:00" stays a time). Closures
// (휴무·휴관·휴장·미운영) go first, unless the line says there is none ("정기휴무 없음").
const MEMO_LABEL = /^(?:(주소|폭|정기휴무|겨울 휴장|이용료|문의)(?=[\s(])\s*|([^:()]{1,12}):\s+)(.*)$/;
const MEMO_KEY = /휴무|휴관|휴장|미운영/;
const MEMO_NONE = /(휴무|휴관|휴장|미운영)\S*\s*없/;
export function memoLines(memo) {
  const parts = String(memo ?? '').split('\n')
    .flatMap((l) => l.split(/(?<=(?:[^.\s]{2}|[가-힣])\.)\s+/))
    .map((s) => s.trim().replace(/(?<!\.)\.$/, ''))
    .filter(Boolean);
  const lines = parts.map((s) => {
    const key = MEMO_KEY.test(s) && !MEMO_NONE.test(s);
    const m = s.match(MEMO_LABEL);
    const label = (m?.[1] ?? m?.[2])?.trim();
    const value = m?.[3].replace(/^\(([^()]*)\)$/, '$1').trim();
    return label && value ? { label, value, key } : { label: null, value: s, key };
  });
  return [...lines.filter((l) => l.key), ...lines.filter((l) => !l.key)];
}
