// src/viewmodel.js
import { hasHours, inWinter, openIntervals, orderIntervals } from './hours.js';
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

export function dayBar(wall, at) {
  const open = openIntervals(wall, at);
  const sunKnown = isSunlit(wall, at).lit !== null;
  const sun = sunKnown ? sunIntervals(wall, at) : null;
  const nowMin = at.getHours() * 60 + at.getMinutes();
  const sunText = sun ? `양달 ${formatRanges(sun)}` : '양달 정보 없음';
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
  const sunText = sun ? `양달 ${formatRanges(sun)}` : '양달 정보 없음';
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
// whose facing is unknown (lit === null); `short` (below the minimum stay) is dropped too.
export function filterRows(rows, sun) {
  const want = sun === 'sun' ? true : sun === 'shade' ? false : undefined;
  return rows.filter((r) => r.status.state !== 'open' || (!r.short && (want === undefined || r.lit === want)));
}

const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
export function rowLeft(status, at) {
  if (status.state === 'unknown') return '운영시간 미입력';
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

// Hours for the whole week (Mon→Sun), runs of days with the same hours merged: '월', '토·일', '화–목'.
// Each row has its text and minute intervals (an after-midnight close runs past 1440; 휴무 = []).
// In the winter range the winter hours apply; a winter closure is one line. closed_dates stay out of this table.
const WEEK = [['mon', '월'], ['tue', '화'], ['wed', '수'], ['thu', '목'], ['fri', '금'], ['sat', '토'], ['sun', '일']];
function dayHours(v) {
  if (v === null) return { text: '휴무', intervals: [] };
  const raw = typeof v[0] === 'string' ? [v] : v;
  const list = orderIntervals(raw) ?? raw;
  return {
    text: list.map(([a, b]) => `${a}–${b}`).join(', '),
    intervals: list.map(([a, b]) => [toMin(a), toMin(b) > toMin(a) ? toMin(b) : toMin(b) + 1440]),
  };
}
export function weeklyHours(wall, date) {
  const season = inWinter(wall, date) ? '동절기' : '';
  if (season && wall.winter.type === 'closed') return { season, rows: [{ days: '동절기', text: '외벽 휴장', today: true, intervals: [] }] };
  const src = (season && wall.winter.type === 'changed' ? wall.winter.hours : wall.hours) ?? {};
  const todayKey = DAY_KEYS[date.getDay()];
  const runs = [];
  WEEK.forEach(([key], i) => {
    if (src[key] === undefined) return;
    const day = dayHours(src[key]);
    const last = runs[runs.length - 1];
    if (last && last.text === day.text && last.end === i - 1) last.end = i;
    else runs.push({ ...day, start: i, end: i });
  });
  const name = (i) => WEEK[i][1];
  return {
    season,
    rows: runs.map(({ text, intervals, start, end }) => ({
      days: start === end ? name(start) : `${name(start)}${end - start === 1 ? '·' : '–'}${name(end)}`,
      text,
      today: WEEK.slice(start, end + 1).some(([k]) => k === todayKey),
      intervals,
    })),
  };
}

// The picked day's hours for the first view, from openIntervals (the same source as getStatus), so
// closed_dates, yesterday's after-midnight tail and winter hours read the same as the status.
// `closed`: the wall has hours but none on this day.
export function dayLine(wall, date) {
  const season = inWinter(wall, date) ? '동절기' : '';
  const intervals = openIntervals(wall, date);
  if (intervals.length) return { season, closed: false, text: formatRanges(intervals) };
  if (!hasHours(wall)) return { season, closed: false, text: '운영시간 미입력' };
  const src = season && wall.winter.type === 'changed' ? wall.winter.hours : wall.hours;
  let text = '휴무';
  if (wall.exceptions?.closed_dates?.includes(ymd(date))) text = '임시 휴장 · 휴무';
  else if (season && wall.winter.type === 'closed') text = '외벽 휴장';
  else if (src?.[DAY_KEYS[date.getDay()]] === undefined) text = '운영시간 미입력';
  return { season, closed: true, text };
}

// Minimum stay: 상관없음 / 3 / 5 / 8 hours. Older saved choices (1h, 2h) map to the nearest sensible one.
export const MIN_HOURS = ['0', '3', '5', '8'];
export const migrateMinHours = (v) => ({ 1: '0', 2: '3' }[String(v)] ?? (MIN_HOURS.includes(String(v)) ? String(v) : '0'));

// Slider label: the real time; "(지금)" when the live time sits outside the slider and the thumb rests at its end.
export const timeLabel = (min, live) => `${fmtMin(min)}${live && sliderValue(min) !== round10(min) ? ' (지금)' : ''}`;

// The filters that can hide open walls, by name.
const activeFilters = ({ sun = 'any', minHours = '0', parkOnly = false }) =>
  [sun === 'sun' && '양달', sun === 'shade' && '응달', minHours !== '0' && `${minHours}시간+`, parkOnly && '주차 가능만'].filter(Boolean);

// Why the open group is empty: nothing open at all, or the active filters hid the open ones.
export function emptyText(f, openTotal, isNow = true) {
  const on = activeFilters(f);
  if (!openTotal || !on.length) return `${isNow ? '지금' : '이 시각에'} 열려 있는 곳이 없어요. 아래 닫힌 곳에서 다음 오픈 시간을 확인해 보세요.`;
  return `열린 곳 ${openTotal}곳 중 조건(${on.join(' · ')})에 맞는 곳이 없어요. 조건을 바꿔 보세요.`;
}

// "조건 지우기" is offered only when walls are open and a filter hid them (same test as emptyText).
export const filtersActive = (f, openTotal) => openTotal > 0 && activeFilters(f).length > 0;

// The sheet button counts only what the chips don't show: parking, and 휴게 합산 while a minimum stay is on.
export const sheetCount = ({ minHours = '0', withBreaks = false }, parkOnly) => Number(parkOnly) + Number(withBreaks && minHours !== '0');

export const dayText = (d) => `${d.getMonth() + 1}/${d.getDate()}(${DAY_KO[d.getDay()]})`;

// Summary lead: "지금 ", "14:00에 " (today), "10/9(금) 14:00에 " (another day).
export const summaryLead = (at, now, isNow) =>
  (isNow ? '지금 ' : `${ymd(at) === ymd(now) ? '' : `${dayText(at)} `}${fmtMin(at.getHours() * 60 + at.getMinutes())}에 `);

// Sun word on an open list row, so 응달 and "facing unknown" read apart too (not only the orange band).
export function sunTag(row) {
  if (row.status.state !== 'open') return null;
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
