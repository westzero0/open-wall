// src/log.js — 기록: the walls a visitor says they went to, kept in this browser only (never sent anywhere).
// A record is {id, wall (the wall's name), date 'YYYY-MM-DD', memo ≤100 chars}. No DOM; storage and "today" are passed in.
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

const cleanText = (v, max) => (typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const newestFirst = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

// One record or null. today: 'YYYY-MM-DD' (local); a later date is dropped.
function cleanRecord(r, today) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const wall = cleanText(r.wall, MAX_WALL);
  if (typeof r.id !== 'string' || !ID_RE.test(r.id) ||!wall || !validDate(r.date) || r.date > today) return null;
  const memo = cleanText(r.memo, MAX_MEMO);
  return memo ? { id: r.id, wall, date: r.date, memo } : { id: r.id, wall, date: r.date };
}

/** normalizeLog(v, today) → clean records, newest first: bad items dropped, repeated ids kept once, at most MAX_RECORDS (newest). */
export function normalizeLog(v, today) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const item of v) {
    const r = cleanRecord(item, today);
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.sort(newestFirst).slice(0, MAX_RECORDS);
}

export function loadLog(storage, today) {
  try {
    return normalizeLog(JSON.parse(storage.getItem(LOG_KEY)), today);
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
 * addRecord(log, {wall, date, memo}, {today, id}) → {log, record} or {error} (Korean, shown as is).
 * id comes from the caller (crypto.randomUUID in the browser).
 */
export function addRecord(log, input, { today, id }) {
  const wall = cleanText(input?.wall, MAX_WALL);
  if (!wall) return { error: '암장을 골라 주세요.' };
  if (!validDate(input?.date)) return { error: '날짜를 골라 주세요.' };
  if (input.date > today) return { error: '오늘 이후 날짜는 기록할 수 없어요.' };
  if (log.length >= MAX_RECORDS) return { error: `기록은 ${MAX_RECORDS}개까지 저장돼요.` };
  const record = cleanRecord({ id, wall, date: input.date, memo: input.memo }, today);
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

/**
 * stampLook(date) → {tilt, ink}: the same day always gets the same stamp (no randomness). tilt in degrees, -5..5;
 * ink = opacity, .85..1. Hash of the date's digits (FNV-1a), so neighbouring days differ.
 */
export function stampLook(date) {
  let h = 2166136261;
  for (const ch of String(date)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { tilt: Math.round(((h % 101) / 10 - 5) * 10) / 10, ink: Math.round((0.85 + (((h >>> 8) % 16) / 100)) * 100) / 100 };
}

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
export function parseImport(text, today) {
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
  const records = normalizeLog(list, today);
  if (!records.length) return { ok: false, error: '가져올 수 있는 기록이 없어요.' };
  return { ok: true, records, dropped: list.length - records.length };
}

/** mergeLog(log, incoming) → {log, added}: same id or the same wall+date+memo is not added twice. */
export function mergeLog(log, incoming) {
  const ids = new Set(log.map((r) => r.id));
  const keys = new Set(log.map((r) => `${r.wall}\n${r.date}\n${r.memo ?? ''}`));
  const fresh = [];
  for (const r of incoming) {
    const k = `${r.wall}\n${r.date}\n${r.memo ?? ''}`;
    if (ids.has(r.id) || keys.has(k)) continue;
    ids.add(r.id);
    keys.add(k);
    fresh.push(r);
  }
  const merged = [...log, ...fresh].sort(newestFirst);
  const kept = merged.slice(0, MAX_RECORDS);
  return { log: kept, added: fresh.filter((r) => kept.includes(r)).length };
}
