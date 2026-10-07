// 혼잡도: visitors report 여유/보통/혼잡 (with the visit's time) from the 기록 추가 sheet through a Google Form; the app
// reads the sheet's published CSV (제보시각, 암장, 단계[, 방문시각]) and summarises it. No DOM, no network: app.js fetches and draws.
import { parseCsv } from './csv.js';
import { isHoliday as krHoliday } from './holidays.js';

export const LEVELS = ['여유', '보통', '혼잡'];
export const MAX_ROWS = 20000;
export const MAX_CHARS = 500_000;
export const WINDOW_DAYS = 56; // 8주
export const NEAR_MIN = 60; // ± minutes of the picked time
export const RECENT_MIN = 90; // "방금 제보" window while the pick is now
export const MIN_REPORTS = 3;
export const ASK_DAYS = 7; // the sheet asks about a visit up to a week back
const SKEW_MS = 5 * 60e3; // the form's clock vs this device: a few minutes ahead is still "now"
const DAY = 864e5;
const LATE_MS = (ASK_DAYS + 1) * DAY; // a 방문시각 may be this much older than its 제보시각 (a day of slack)

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
 * t is the 4th column 방문시각 when the row has one, else the 1st (제보시각; sheets made before 방문시각 existed).
 * Untrusted: only the newest MAX_CHARS / MAX_ROWS are read (the sheet appends at the bottom), the wall must be
 * one of `names` (NFC), the level one of LEVELS, the time parseable, not in the future and within 8 weeks.
 * A 방문시각 must also be parseable and lie between 8 days before its 제보시각 and (a few minutes past) it.
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
    const filed = parseWhen(row[0]);
    const visitCell = String(row[3] ?? '').trim();
    const visit = visitCell ? parseWhen(visitCell) : null;
    if (!filed || +filed > hi || (visitCell && (!visit || +visit > +filed + SKEW_MS || +visit < +filed - LATE_MS))) continue;
    const when = visit ?? filed;
    const wall = String(row[1] ?? '').normalize('NFC').trim();
    const score = LEVELS.indexOf(String(row[2] ?? '').normalize('NFC').trim());
    if (score < 0 || !known.has(wall) || +when > hi || +when < lo) continue;
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

// ---- asking (the 기록 추가 sheet) ----
const pad = (x) => String(x).padStart(2, '0');
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/**
 * askable(date 'YYYY-MM-DD', time 'HH:mm', now) → true when the sheet may ask how crowded that visit was:
 * a real moment, not after now, on a day at most ASK_DAYS back (today counts as 0).
 */
export function askable(date, time, now = new Date()) {
  const at = parseWhen(`${date} ${time}`);
  return Boolean(at) && +at <= +now && date >= dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ASK_DAYS));
}

// ---- sending ----
// This device's own reports, {'<wall>': [sent-at ms, …, 'YYYY-MM-DD HH:mm' visit, …]}, as read back from localStorage.
// Limits: COOLDOWN_MIN minutes between two reports of a wall, WALL_DAY_CAP a day per wall, DAY_CAP a day in all (the
// day = the day it was sent, local midnight resets), and one report per visit (wall + date + 30-minute slot), whenever
// sent. On read only sane sent times (numbers, not in the future) of today or still cooling down are kept, at most
// DAY_CAP; visits only as real 'YYYY-MM-DD HH:mm' slots (minutes floored to :00/:30) not after now and at most
// ASK_DAYS + 1 days back (the sheet asks a week back), at most VISITS_KEPT; junk dropped; at most 200 walls.
export const COOLDOWN_MIN = 30;
export const WALL_DAY_CAP = 2;
export const DAY_CAP = 5;
const VISITS_KEPT = 20; // WALL_DAY_CAP × (ASK_DAYS + 1) plus slack
const COOLDOWN_MS = COOLDOWN_MIN * 60e3;
// 'YYYY-MM-DD HH:mm' → the same visit on its half hour ('… 14:17' → '… 14:00'), or null
export function visitSlot(when) {
  const at = typeof when === 'string' ? parseWhen(when) : null;
  if (!at) return null;
  return `${dayOf(at)} ${pad(at.getHours())}:${pad(at.getMinutes() < 30 ? 0 : 30)}`;
}
export function cleanSent(raw, now = Date.now()) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const d = new Date(now);
  const today = dayOf(d);
  const oldest = dayOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ASK_DAYS - 1));
  for (const [wall, list] of Object.entries(raw).slice(0, 1000)) {
    if (Object.keys(out).length >= 200) break;
    if (!wall || wall.length > 100 || !Array.isArray(list)) continue;
    const items = list.slice(0, 50);
    const ts = items.filter((t) => typeof t === 'number' && Number.isFinite(t) && t <= now && (t > now - COOLDOWN_MS || dayOf(new Date(t)) === today))
      .sort((x, y) => x - y).slice(-DAY_CAP);
    const vs = [...new Set(items.filter((v) => typeof v === 'string' && v.length <= 16).map(visitSlot)
      .filter((v) => v && v.slice(0, 10) >= oldest && +parseWhen(v) <= now + SKEW_MS))].sort().slice(-VISITS_KEPT);
    if (ts.length || vs.length) out[wall] = [...ts, ...vs];
  }
  return out;
}
const sentTimes = (list) => (list ?? []).filter((t) => typeof t === 'number');
/** canReport(sent, wall, now, visit?) → {ok, reason, waitMin}: reason 'dup' (this visit — 'YYYY-MM-DD HH:mm', same 30-minute
 *  slot — was reported already), 'cap' (DAY_CAP today), 'wall' (WALL_DAY_CAP for this wall today), 'wait' (cooling down;
 *  waitMin whole minutes left, rounded up) or null. */
export function canReport(sent, wall, now = Date.now(), visit = null) {
  const s = cleanSent(sent, now);
  const today = dayOf(new Date(now));
  const isToday = (t) => dayOf(new Date(t)) === today;
  const mine = sentTimes(s[wall]);
  const last = mine.length ? mine[mine.length - 1] : null;
  const slot = visitSlot(visit);
  if (slot && s[wall]?.includes(slot)) return { ok: false, reason: 'dup', waitMin: 0 };
  if (Object.values(s).flatMap(sentTimes).filter(isToday).length >= DAY_CAP) return { ok: false, reason: 'cap', waitMin: 0 };
  if (mine.filter(isToday).length >= WALL_DAY_CAP) return { ok: false, reason: 'wall', waitMin: 0 };
  if (last !== null && now - last < COOLDOWN_MS) return { ok: false, reason: 'wait', waitMin: Math.ceil((last + COOLDOWN_MS - now) / 60e3) };
  return { ok: true, reason: null, waitMin: 0 };
}
/** markSent(sent, wall, now, visit?) → the store with this report added (its visit slot too, when given). */
export const markSent = (sent, wall, now = Date.now(), visit = null) => {
  const s = cleanSent(sent, now);
  const slot = visitSlot(visit);
  return cleanSent({ ...s, [wall]: [...(s[wall] ?? []), now, ...(slot ? [slot] : [])] }, now);
};

// fields: { wall: 'entry.…', level: 'entry.…', kind?: 'entry.…', when?: 'entry.…' } — kind is for a shared form whose
// 종류 gets '혼잡도'; when (방문시각, a short-answer question) gets 'YYYY-MM-DD HH:mm'. Without it the form's own
// timestamp stands for the visit.
const ENTRY_RE = /^entry\.\d+$/;
export const crowdReady = (endpoint, fields) => /^https?:\/\//.test(endpoint ?? '') && ENTRY_RE.test(fields?.wall ?? '') && ENTRY_RE.test(fields?.level ?? '');
export function crowdPayload(fields, wall, level, when = '') {
  const p = new URLSearchParams();
  p.set(fields.wall, wall);
  p.set(fields.level, level);
  if (ENTRY_RE.test(fields.kind ?? '')) p.set(fields.kind, '혼잡도');
  if (ENTRY_RE.test(fields.when ?? '') && parseWhen(when)) p.set(fields.when, when);
  return p.toString();
}
