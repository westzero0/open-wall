// src/log.js — 기록: the walls a visitor says they went to, kept in this browser only (never sent anywhere).
// A record is {id, wall (the wall's name), date 'YYYY-MM-DD', time? 'HH:mm' (30-minute steps), memo? ≤100 chars}.
// No DOM; storage and "today" are passed in.
// Everything read (localStorage, an imported file) is untrusted and goes through normalizeLog.

export const LOG_KEY = 'open-wall:log';
export const TIP_KEY = 'open-wall:log-tip'; // '1' once the "back it up" note was closed
export const MAX_RECORDS = 2000;
export const MAX_MEMO = 100;
export const MAX_WALL = 100;
export const MAX_IMPORT_BYTES = 1_000_000;
export const TIP_AT = 5; // the backup note shows once this many records exist

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// A real calendar day (no 2026-02-30), from 2000 on.
export function validDate(s) {
  const m = DATE_RE.exec(typeof s === 'string' ? s : '');
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return +m[1] >= 2000 && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// The visit time: 'HH:mm' on the half hour, 06:00–23:30 (the sheet's bar runs 06–24).
const TIME_RE = /^(0[6-9]|1\d|2[0-3]):(00|30)$/;
export const validTime = (s) => typeof s === 'string' && TIME_RE.test(s);

const cleanText = (v, max) => (typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, max) : '');
// newest day first; within a day the later visit first (a record without a time after those with one)
const newestFirst = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.time ?? '').localeCompare(a.time ?? ''));

// A visit time later than now (+5 minutes of clock skew) on today's date can't have happened yet.
export const CLOCK_SKEW_MIN = 5;
const isAhead = (date, time, today, nowMin) => nowMin != null && date === today && minOfTime(time) > nowMin + CLOCK_SKEW_MIN;

// One record or null. today: 'YYYY-MM-DD' (local); a later date is dropped. A bad time — or, with nowMin (minutes of
// the day now), a time still to come today — is dropped, the record kept.
function cleanRecord(r, today, nowMin = null) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const wall = cleanText(r.wall, MAX_WALL);
  if (typeof r.id !== 'string' || !ID_RE.test(r.id) ||!wall || !validDate(r.date) || r.date > today) return null;
  const memo = cleanText(r.memo, MAX_MEMO);
  return { id: r.id, wall, date: r.date, ...(validTime(r.time) && !isAhead(r.date, r.time, today, nowMin) ? { time: r.time } : {}), ...(memo ? { memo } : {}) };
}

// "15:00 · 메모": what a record's line shows under its wall (either part may be missing)
export const recordNote = (r) => [r.time, r.memo].filter(Boolean).join(' · ');

// ---- the visit-time bar of the 기록 추가 sheet (minutes of the day) ----
export const SLOT_MIN = 30;
export const VISIT_FIRST = 360; // 06:00
export const VISIT_LAST = 1410; // 23:30
const floorSlot = (m) => Math.floor(m / SLOT_MIN) * SLOT_MIN;
export const minOfTime = (t) => (validTime(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
export const timeOfMin = (m) => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
/** visitMax(nowMin) → the latest half hour a visit of today can be picked at (now, rounded down), or null before 06:00. */
export const visitMax = (nowMin) => (floorSlot(nowMin) < VISIT_FIRST ? null : Math.min(floorSlot(nowMin), VISIT_LAST));
/** snapVisit(min) → the half hour at or before it, kept within 06:00–23:30 (the range input can report 24:00). */
export const snapVisit = (m) => Math.min(Math.max(floorSlot(m), VISIT_FIRST), VISIT_LAST);
/**
 * minuteAtFrac(frac, nowMin, isToday) → the half hour under a tap/drag on the bar (frac 0..1 across the 06–24 axis,
 * clamped), to the nearest 30 minutes within 06:00–23:30; today it is kept at or before now (visitMax), and before
 * 06:00 today there is none: null.
 */
export function minuteAtFrac(frac, nowMin, isToday) {
  const f = Math.min(Math.max(Number(frac) || 0, 0), 1);
  const m = Math.min(Math.max(Math.round((VISIT_FIRST + f * (1440 - VISIT_FIRST)) / SLOT_MIN) * SLOT_MIN, VISIT_FIRST), VISIT_LAST);
  if (!isToday) return m;
  const last = visitMax(nowMin);
  return last == null ? null : Math.min(m, last);
}
/** timeSpeech(min) → '오후 3시', '오전 9시 30분' (aria-valuetext); 12:00 is 오후 12시. */
export function timeSpeech(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${mm ? ` ${mm}분` : ''}`;
}
/**
 * visitBreaks(open) → the gaps between a day's open intervals (휴게), on the 06–24 axis. The tail of the night before
 * (an interval from 00:00) is not the day's own, so the gap after it is not a break.
 */
export function visitBreaks(open) {
  const own = open.filter(([a]) => a > 0);
  return own.slice(1).map(([a], i) => [Math.max(own[i][1], VISIT_FIRST), a]).filter(([a, b]) => b > a);
}
/**
 * visitDefault(open, nowMin) → the default visit time (minutes) for a record of today: half an hour ago, on the half
 * hour, moved into the day's open hours when it falls outside them (the nearest open half hour not after now).
 * Before 06:00 (the bar's first half hour) or before the day's first opening there is no such half hour: null (시간 모름)
 * rather than a time still to come.
 * open: openIntervals of the day; none (휴무, no hours) → the time as is.
 */
export function visitDefault(open, nowMin) {
  if (visitMax(nowMin) == null) return null;
  const m = snapVisit(nowMin - SLOT_MIN);
  const slots = open.map(([a, b]) => [Math.max(Math.ceil(a / SLOT_MIN) * SLOT_MIN, VISIT_FIRST), Math.min(floorSlot(b - 1), VISIT_LAST)])
    .filter(([a, b]) => b >= a);
  if (!slots.length || slots.some(([a, b]) => m >= a && m <= b)) return m;
  const past = slots.flat().filter((x) => x <= nowMin);
  return past.length ? past.reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best)) : null;
}

/** normalizeLog(v, today, nowMin?) → clean records, newest first: bad items dropped, repeated ids kept once, at most MAX_RECORDS (newest). */
export function normalizeLog(v, today, nowMin = null) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const item of v) {
    const r = cleanRecord(item, today, nowMin);
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.sort(newestFirst).slice(0, MAX_RECORDS);
}

export function loadLog(storage, today, nowMin = null) {
  try {
    return normalizeLog(JSON.parse(storage.getItem(LOG_KEY)), today, nowMin);
  } catch {
    return [];
  }
}

export function saveLog(storage, log) {
  try {
    storage.setItem(LOG_KEY, JSON.stringify(log));
    return true;
  } catch {
    return false; // full or blocked: kept in memory for this visit
  }
}

/**
 * addRecord(log, {wall, date, time, memo}, {today, id}) → {log, record} or {error} (Korean, shown as is).
 * time: 'HH:mm' or empty (시간 모름); anything else is left off the record.
 * id comes from the caller (crypto.randomUUID in the browser). nowMin (minutes of the day now): today's date with a later
 * time is refused ({error, field: 'time'}).
 */
export function addRecord(log, input, { today, id, nowMin = null }) {
  const wall = cleanText(input?.wall, MAX_WALL);
  if (!wall) return { error: '암장을 골라 주세요.' };
  if (!validDate(input?.date)) return { error: '날짜를 골라 주세요.' };
  if (input.date > today) return { error: '오늘 이후 날짜는 기록할 수 없어요.' };
  if (validTime(input.time) && isAhead(input.date, input.time, today, nowMin)) return { error: '지금보다 뒤의 시각은 기록할 수 없어요.', field: 'time' };
  if (log.length >= MAX_RECORDS) return { error: `기록은 ${MAX_RECORDS}개까지 저장돼요.` };
  const record = cleanRecord({ id, wall, date: input.date, time: input.time, memo: input.memo }, today);
  if (!record) return { error: '저장하지 못했어요.' };
  return { log: [...log, record].sort(newestFirst), record };
}

export const removeRecord = (log, id) => log.filter((r) => r.id !== id);

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
// "10월 5일 일요일" parts for a record date (local calendar; the string is a plain day, no time zone)
export function dayParts(date) {
  const [y, m, d] = date.split('-').map(Number);
  return { year: y, month: m, day: d, dow: DAY_KO[new Date(y, m - 1, d).getDay()] };
}

const p2 = (n) => String(n).padStart(2, '0');
export const dateOf = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;

/**
 * monthGrid(year, month) → {year, month, label, weeks}: month 1–12, weeks of 7 cells, Sunday first (일~토).
 * A cell is null before the 1st / after the last day, else {date:'YYYY-MM-DD', day}.
 */
export function monthGrid(year, month) {
  const lead = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ({ date: dateOf(year, month, i + 1), day: i + 1 }))];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, label: `${year}년 ${month}월`, weeks };
}

// the month before/after: {year, month}
export const shiftMonth = (year, month, by) => {
  const d = new Date(year, month - 1 + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

/** recordsByDay(log) → Map 'YYYY-MM-DD' → records of that day (in log order). */
export function recordsByDay(log) {
  const days = new Map();
  for (const r of log) {
    if (!days.has(r.date)) days.set(r.date, []);
    days.get(r.date).push(r);
  }
  return days;
}

/** monthSummary(log, year, month) → {visits, walls}: "이번 달 N번 · M곳". */
export function monthSummary(log, year, month) {
  const inMonth = log.filter((r) => r.date.startsWith(`${year}-${p2(month)}-`));
  return { visits: inMonth.length, walls: new Set(inMonth.map((r) => r.wall)).size };
}

/**
 * visitedCount(log, names) → {visited, total, outside}. names: the current list's wall names (the denominator).
 * A wall counts once however often it was logged; a logged name not in the list counts in `outside` only.
 */
export function visitedCount(log, names) {
  const known = new Set(names);
  const walls = new Set(log.map((r) => r.wall));
  const visited = [...walls].filter((w) => known.has(w)).length;
  return { visited, total: known.size, outside: walls.size - visited };
}

/** firstVisits(log) → Set of record ids: per wall the earliest record (date, then time; a record without time first). The 도장 with the double rim. */
export function firstVisits(log) {
  const best = new Map();
  for (const r of log) {
    const b = best.get(r.wall);
    const k = `${r.date} ${r.time ?? ''}`;
    if (!b || k < b.k || (k === b.k && r.id < b.id)) best.set(r.wall, { k, id: r.id });
  }
  return new Set([...best.values()].map((b) => b.id));
}

/** visitStats(log) → Map wall name → {last: the newest record date, count: records (several on one day count each)}. */
export function visitStats(log) {
  const m = new Map();
  for (const r of log) {
    if (typeof r?.wall !== 'string' || !r.wall) continue;
    const s = m.get(r.wall);
    if (!s) m.set(r.wall, { last: r.date, count: 1 });
    else {
      s.count += 1;
      if (r.date > s.last) s.last = r.date;
    }
  }
  return m;
}

export const countFor = (log, wall) => log.filter((r) => r.wall === wall).length;
export const recentFor = (log, wall, n = 3) => log.filter((r) => r.wall === wall).sort(newestFirst).slice(0, n);

// ---- backup file ----
export function exportLog(log, now = new Date()) {
  const at = `${dateOf(now.getFullYear(), now.getMonth() + 1, now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`; // local time
  return JSON.stringify({ app: 'open-wall', kind: 'log', version: 1, exported_at: at, records: log }, null, 2);
}

/**
 * parseImport(text, today) → {ok: true, records, dropped} or {ok: false, error}.
 * Takes our export ({kind:'log', records}) or a bare array; anything else is refused with the reason.
 */
export function parseImport(text, today, nowMin = null) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: '빈 파일이에요.' };
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: '파일이 너무 커요(1MB까지).' };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '기록 백업 파일(JSON)이 아니에요.' };
  }
  const list = Array.isArray(data) ? data : data && typeof data === 'object' && data.kind === 'log' ? data.records : null;
  if (!Array.isArray(list)) return { ok: false, error: '해벽 기록 백업 파일이 아니에요.' };
  const records = normalizeLog(list, today, nowMin);
  if (!records.length) return { ok: false, error: '가져올 수 있는 기록이 없어요.' };
  return { ok: true, records, dropped: list.length - records.length };
}

/** mergeLog(log, incoming) → {log, added}: same id or the same wall+date+time+memo is not added twice. */
export function mergeLog(log, incoming) {
  const keyOf = (r) => `${r.wall}\n${r.date}\n${r.time ?? ''}\n${r.memo ?? ''}`;
  const ids = new Set(log.map((r) => r.id));
  const keys = new Set(log.map(keyOf));
  const fresh = [];
  for (const r of incoming) {
    const k = keyOf(r);
    if (ids.has(r.id) || keys.has(k)) continue;
    ids.add(r.id);
    keys.add(k);
    fresh.push(r);
  }
  const merged = [...log, ...fresh].sort(newestFirst);
  const kept = merged.slice(0, MAX_RECORDS);
  return { log: kept, added: fresh.filter((r) => kept.includes(r)).length };
}
