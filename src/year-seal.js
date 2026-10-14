// src/year-seal.js — the geometry and colours of the 올해 도장 (no DOM). One visit = one short arc on a ring:
// angle = the day (Jan 1 at the top, clockwise), ring = the hour (05 inside … 23 outside), colour = what the sun did to that wall then.
import { dayWindow, isSunlit } from './sun.js';

export const FIRST_HOUR = 5;
export const RINGS = 18;                                  // 05:00 … 22:59, one ring per hour
const MIDDAY_ROW = 7;                                     // 12:30: where a visit without a time sits
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const TAU = 2 * Math.PI;

export const KIND_TEXT = { sun: '양달', shade: '응달', night: '해 진 뒤', unknown: '확인 불가' };

const utc = (date) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysInYear = (year) => (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365);
const dayIndex = (date) => Math.round((utc(date) - Date.UTC(Number(date.slice(0, 4)), 0, 1)) / 864e5);

/** Radians of day number `index` (0 = Jan 1) of a year with `n` days (SVG angle: 0 = 3 o'clock, so Jan 1 sits at −π/2, the middle of its day). */
export const indexAngle = (index, n) => ((index + 0.5) / n) * TAU - Math.PI / 2;
/** Radians for a 'YYYY-MM-DD'. */
export const dayAngle = (date) => indexAngle(dayIndex(date), daysInYear(Number(date.slice(0, 4))));
export const dayIndexOf = dayIndex;

/** Index of the point nearest to (x, y) within `reach`, else -1 (the earlier point wins a tie). Pressing the seal picks the mark closest to the finger. */
export function nearestPoint(points, x, y, reach) {
  let best = -1, bestD = Infinity;
  points.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (d <= reach && d < bestD) { best = i; bestD = d; } });
  return best;
}

/** The ring of a 'HH:mm': 0 (05:xx) … 17 (22:xx); earlier and later times collapse onto the first and last ring; no time → midday. */
export function hourRow(time) {
  const m = /^(\d{2}):(\d{2})$/.exec(typeof time === 'string' ? time : '');
  if (!m) return MIDDAY_ROW;
  return Math.max(0, Math.min(RINGS - 1, Math.floor(Number(m[1]) + Number(m[2]) / 60 - FIRST_HOUR)));
}
/** Radius of a ring's centre between r0 (inner) and r1 (outer). */
export const rowRadius = (row, r0, r1) => r0 + ((row + 0.5) / RINGS) * (r1 - r0);

/** 'sun' | 'shade' (facing or terrain) | 'night' | 'unknown' (no time, no wall, indoors or no direction). */
export function kindOf(wall, at) {
  if (!wall || !(at instanceof Date)) return 'unknown';
  const r = isSunlit(wall, at);
  if (r.lit === true) return 'sun';
  if (r.lit === false) return r.reason === 'night' ? 'night' : 'shade';
  return 'unknown';
}

/** "10월 17일 토 · 11:00 · 양달" */
export function markLabel(date, time, kind) {
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 ${DOW[new Date(utc(date)).getUTCDay()]} · ${time ?? '시각 미입력'} · ${KIND_TEXT[kind]}`;
}

/** The year's visits as marks, by date then time. A mark sits exactly on its own date and ring; nothing is moved apart. */
export function marks(log, year, walls) {
  const byName = new Map((walls ?? []).map((w) => [w.name, w]));
  return log
    .filter((r) => r.date.startsWith(`${year}-`))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time ?? '').localeCompare(b.time ?? '')))
    .map((r) => {
      const [y, mo, d] = r.date.split('-').map(Number);
      const at = r.time ? new Date(y, mo - 1, d, Number(r.time.slice(0, 2)), Number(r.time.slice(3))) : null;
      const kind = kindOf(byName.get(r.wall), at);
      return { id: r.id, wall: r.wall, date: r.date, time: r.time ?? null, hasTime: !!r.time, angle: dayAngle(r.date), row: hourRow(r.time), kind, label: markLabel(r.date, r.time ?? null, kind) };
    });
}

export function monthCounts(log, year) {
  const c = Array(12).fill(0);
  for (const r of log) if (r.date.startsWith(`${year}-`)) c[Number(r.date.slice(5, 7)) - 1]++;
  return c;
}

/** One tick per month: where it starts and where its middle is (for the label). */
export function monthStarts(year) {
  const n = daysInYear(year);
  const start = Array.from({ length: 12 }, (_, i) => Math.round((Date.UTC(year, i, 1) - Date.UTC(year, 0, 1)) / 864e5));
  return start.map((s, i) => ({
    month: i + 1,
    angle: (s / n) * TAU - Math.PI / 2,
    mid: (((s + (i < 11 ? start[i + 1] : n)) / 2) / n) * TAU - Math.PI / 2,
  }));
}

/** Sunrise and sunset (hours) every `step` days: the band of daylight behind the marks. dayWindow scans a whole day by the minute, so this is meant to be computed once per year. */
export function bandSamples(year, step = 5, windowFn = dayWindow) {
  const out = [];
  for (let index = 0; index < daysInYear(year); index += step) {
    const w = windowFn({}, new Date(year, 0, 1 + index));
    if (w) out.push({ index, rise: w.sunrise / 60, set: w.sunset / 60 });
  }
  return out;
}

/** For a screen reader: the total and each month that has visits. */
export function sealLabel(year, counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return `${year}년 방문 기록이 없어요`;
  return `${year}년 방문 ${total}번: ${counts.map((c, i) => (c ? `${i + 1}월 ${c}번` : null)).filter(Boolean).join(', ')}`;
}
