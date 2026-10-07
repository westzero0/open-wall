// 혼잡도: visitors report 여유/보통/혼잡 through a Google Form; the app reads the sheet's published CSV
// (제보시각, 암장, 단계) and summarises it. No DOM, no network: app.js fetches and draws.
import { parseCsv } from './csv.js';
import { isHoliday as krHoliday } from './holidays.js';

export const LEVELS = ['여유', '보통', '혼잡'];
export const MAX_ROWS = 20000;
export const MAX_CHARS = 500_000;
export const WINDOW_DAYS = 56; // 8주
export const NEAR_MIN = 60; // ± minutes of the picked time
export const RECENT_MIN = 90; // "방금 제보" window while the pick is now
export const MIN_REPORTS = 3;
export const RESEND_MS = 30 * 60e3;
const SKEW_MS = 5 * 60e3; // the form's clock vs this device: a few minutes ahead is still "now"
const DAY = 864e5;

const n = Number;
// a real calendar moment in local time, or null (2026-02-30, 25:00 … fail the round trip)
function local(y, mo, d, h, mi, s = 0) {
  const t = new Date(y, mo - 1, d, h, mi, s);
  return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d && t.getHours() === h && t.getMinutes() === mi && s < 60 ? t : null;
}

// '2026-10-08 13:17' (the TEXT() column the setup guide asks for), the Korean sheet locale
// '2026. 10. 8 오후 1:17:30', or the US one '10/8/2026 13:17:30'. Read in this browser's time zone.
export function parseWhen(v) {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) return local(n(m[1]), n(m[2]), n(m[3]), n(m[4]), n(m[5]), n(m[6] ?? 0));
  m = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s+(오전|오후)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) {
    const h12 = n(m[5]);
    if (h12 < 1 || h12 > 12) return null;
    return local(n(m[1]), n(m[2]), n(m[3]), (h12 % 12) + (m[4] === '오후' ? 12 : 0), n(m[6]), n(m[7] ?? 0));
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) return local(n(m[3]), n(m[1]), n(m[2]), n(m[4]), n(m[5]), n(m[6] ?? 0));
  return null;
}

/**
 * parseCrowdCsv(text, names, now) → [{ t (ms), wall, score 0|1|2 }], oldest first.
 * Untrusted: only the newest MAX_CHARS / MAX_ROWS are read (the sheet appends at the bottom), the wall must be
 * one of `names` (NFC), the level one of LEVELS, the time parseable, not in the future and within 8 weeks.
 * Anything else (the header row too) is dropped.
 */
export function parseCrowdCsv(text, names, now = new Date()) {
  if (typeof text !== 'string' || !text) return [];
  let src = text;
  if (src.length > MAX_CHARS) src = src.slice(src.length - MAX_CHARS).replace(/^[^\n]*\n/, ''); // drop the cut line
  const known = new Set([...(names ?? [])].map((x) => String(x).normalize('NFC')));
  const hi = +now + SKEW_MS;
  const lo = +now - WINDOW_DAYS * DAY;
  const out = [];
  for (const row of parseCsv(src).slice(-MAX_ROWS)) {
    const when = parseWhen(row[0]);
    const wall = String(row[1] ?? '').normalize('NFC').trim();
    const score = LEVELS.indexOf(String(row[2] ?? '').normalize('NFC').trim());
    if (!when || score < 0 || !known.has(wall) || +when > hi || +when < lo) continue;
    out.push({ t: +when, wall, score });
  }
  return out.sort((a, b) => a.t - b.t);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
// 0 여유 · 1 보통 · 2 혼잡: the median keeps one prank (or one odd day) from moving the answer
export const levelOf = (scores) => {
  const md = median(scores);
  return md < 0.5 ? '여유' : md > 1.5 ? '혼잡' : '보통';
};
const minuteOf = (d) => d.getHours() * 60 + d.getMinutes();
const restDay = (d, isHoliday) => d.getDay() === 0 || d.getDay() === 6 || isHoliday(d);
const PARTS = [[360, '새벽'], [720, '오전'], [1020, '오후'], [1260, '저녁'], [1440, '밤']];
export const basisLabel = (at, isHoliday = krHoliday) =>
  `${restDay(at, isHoliday) ? '주말·공휴일' : '평일'} ${PARTS.find(([end]) => minuteOf(at) < end)[1]} 기준`;

/**
 * aggregate(reports, wall, at, {isHoliday, live, now}) → { level, n, basis, recent }
 * The last 8 weeks (before `now`), the same kind of day as `at` (평일 vs 주말·공휴일), within ±60 min of its time of day.
 * level: null while fewer than 3 reports (제보 모으는 중). recent: while `live`, the reports of the last 90 minutes
 * when there are 2 or more ({level, n}), else null.
 */
export function aggregate(reports, wall, at, { isHoliday = krHoliday, live = false, now = at } = {}) {
  const lo = +now - WINDOW_DAYS * DAY;
  const rest = restDay(at, isHoliday);
  const min = minuteOf(at);
  const mine = (reports ?? []).filter((r) => r.wall === wall && r.t >= lo && r.t <= +now + SKEW_MS);
  const near = mine.filter((r) => {
    const d = new Date(r.t);
    return restDay(d, isHoliday) === rest && Math.abs(minuteOf(d) - min) <= NEAR_MIN;
  }).map((r) => r.score);
  const fresh = live ? mine.filter((r) => r.t > +at - RECENT_MIN * 60e3).map((r) => r.score) : [];
  return {
    level: near.length >= MIN_REPORTS ? levelOf(near) : null,
    n: near.length,
    basis: basisLabel(at, isHoliday),
    recent: fresh.length >= 2 ? { level: levelOf(fresh), n: fresh.length } : null,
  };
}

// ---- sending ----
// The record of this device's own reports ({wall: {t, level}}), as read back from localStorage: only sane
// entries of the last 30 minutes, at most 50.
export function cleanSent(raw, now = Date.now()) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [wall, v] of Object.entries(raw).slice(0, 500)) {
    if (Object.keys(out).length >= 50) break;
    if (!wall || wall.length > 100 || !v || typeof v !== 'object') continue;
    const t = Number(v.t);
    if (!Number.isFinite(t) || t > now + SKEW_MS || t <= now - RESEND_MS || !LEVELS.includes(v.level)) continue;
    out[wall] = { t, level: v.level };
  }
  return out;
}
// one report per wall per 30 minutes from this device
export const canReport = (sent, wall, now = Date.now()) => !cleanSent(sent, now)[wall];
export const sentLevel = (sent, wall, now = Date.now()) => cleanSent(sent, now)[wall]?.level ?? null;
export const markSent = (sent, wall, level, now = Date.now()) => cleanSent({ ...cleanSent(sent, now), [wall]: { t: now, level } }, now);

// fields: { wall: 'entry.…', level: 'entry.…', kind?: 'entry.…' } — kind is for a shared form whose 종류 gets '혼잡도'
export const crowdReady = (endpoint, fields) => /^https?:\/\//.test(endpoint ?? '') && /^entry\.\d+$/.test(fields?.wall ?? '') && /^entry\.\d+$/.test(fields?.level ?? '');
export function crowdPayload(fields, wall, level) {
  const p = new URLSearchParams();
  p.set(fields.wall, wall);
  p.set(fields.level, level);
  if (/^entry\.\d+$/.test(fields.kind ?? '')) p.set(fields.kind, '혼잡도');
  return p.toString();
}
