// src/tap.js — 운영시간 "맞아요/달라요" 한 번 탭 제보 (docs/superpowers/specs/2026-10-29-report-tap-design.md). Pure logic, no DOM.
// The Worker (worker/taps.js) validates the same shapes again; this side builds the request and cleans what comes back.

export const TAP_KINDS = ['wall', 'crag'];
export const TAP_ITEMS = { wall: ['hours'], crag: ['approach', 'season'] };
export const TAP_CLAIMS = ['closed', 'short', 'long'];
export const TAP_WHY = ['regular', 'holiday', 'exception', 'winter'];
export const TAPPED_KEY = 'open-wall:taps';
const MAX_TAPPED = 60;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isRealDate = (s) => {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** What the sheet showed for one day → the `shown` field: {open, close} or {closed: true}. `intervals`: openIntervals() minutes, clipped to 0..1440. */
export function shownFromIntervals(intervals) {
  const list = Array.isArray(intervals) ? intervals.filter((i) => Array.isArray(i) && i[1] > i[0]) : [];
  if (!list.length) return { closed: true };
  const hm = (min) => { const m = Math.min(Math.max(Math.round(min), 0), 1439); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  return { open: hm(list[0][0]), close: hm(list[list.length - 1][1]) };
}

/** cleanShown(v) → {open, close} | {closed: true, why?} | null. Anything else is null (the request is not sent). */
export function cleanShown(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (v.closed === true) return TAP_WHY.includes(v.why) ? { closed: true, why: v.why } : { closed: true };
  return HHMM.test(v.open) && HHMM.test(v.close) ? { open: v.open, close: v.close } : null;
}

/** buildTap({kind, wall, item, answer, claim, forDate, shown, onsite}) → the JSON body, or null when something is off. */
export function buildTap({ kind = 'wall', wall, item = 'hours', answer, claim = null, forDate, shown = null, onsite } = {}) {
  if (!TAP_KINDS.includes(kind) || !TAP_ITEMS[kind].includes(item)) return null;
  if (typeof wall !== 'string' || !wall.trim() || wall.length > 100) return null;
  if (answer !== 'ok' && answer !== 'wrong') return null;
  if (!isRealDate(forDate)) return null;
  const s = item === 'hours' ? cleanShown(shown) : {};
  if (!s) return null;
  const out = { kind, wall: wall.normalize('NFC'), item, answer, for_date: forDate, shown: s };
  if (answer === 'wrong' && TAP_CLAIMS.includes(claim)) out.claim = claim;
  if (typeof onsite === 'boolean') out.onsite = onsite;
  return out;
}

const cnt = (n) => (Number.isInteger(n) && n >= 0 && n <= 100000 ? n : 0);

/** parseTapSummary(raw, names) → { 'wall name': { 'YYYY-MM-DD': { hours: {ok, wrong, claims, onsite_wrong, last, shown} } } }. `names`: the walls in the list (others are dropped). Bad items are dropped one by one. */
export function parseTapSummary(raw, names) {
  const out = {};
  const walls = raw && typeof raw === 'object' && raw.walls && typeof raw.walls === 'object' && !Array.isArray(raw.walls) ? raw.walls : {};
  const known = new Set((names ?? []).map((n) => String(n).normalize('NFC')));
  for (const [name, days] of Object.entries(walls)) {
    const nm = name.normalize('NFC');
    if (!known.has(nm) || !days || typeof days !== 'object') continue;
    for (const [date, items] of Object.entries(days)) {
      const h = items && typeof items === 'object' ? items.hours : null;
      if (!isRealDate(date) || !h || typeof h !== 'object') continue;
      const c = h.claims && typeof h.claims === 'object' ? h.claims : {};
      const entry = { ok: cnt(h.ok), wrong: cnt(h.wrong), claims: { closed: cnt(c.closed), short: cnt(c.short), long: cnt(c.long) }, onsite_wrong: cnt(h.onsite_wrong), last: Number.isInteger(h.last) && h.last > 0 ? h.last : 0, shown: cleanShown(h.shown) };
      (out[nm] ??= {})[date] = { hours: entry };
    }
  }
  return out;
}

export const tappedKey = (kind, wall, item, forDate) => `${kind}|${wall}|${item}|${forDate}`;

/** cleanTapped(raw, today) → {key: {a: 'ok'|'wrong', t}}: only well-formed keys, today or later, at most MAX_TAPPED. Run on every read (the value is untrusted). */
export function cleanTapped(raw, today) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const [kind, wall, item, date, extra] = k.split('|');
    if (extra !== undefined || !TAP_KINDS.includes(kind) || !wall || !TAP_ITEMS[kind].includes(item) || !isRealDate(date) || date < today) continue;
    if (!v || (v.a !== 'ok' && v.a !== 'wrong') || !Number.isInteger(v.t) || v.t <= 0) continue;
    out[k] = { a: v.a, t: v.t };
    if (Object.keys(out).length >= MAX_TAPPED) break;
  }
  return out;
}

export function loadTapped(storage, today) {
  try { return cleanTapped(JSON.parse(storage.getItem(TAPPED_KEY)), today); } catch { return {}; }
}
export function saveTapped(storage, map) {
  try { storage.setItem(TAPPED_KEY, JSON.stringify(map)); return true; } catch { return false; }
}

// ---- 제보 횟수: shown as 제보자 · N회 next to the nickname (count only; no rank, tier or badge). This device only, never sent. ----
export const TAP_COUNT_KEY = 'open-wall:tap-count';
const MAX_COUNT = 100000;
export function loadTapCount(storage) {
  try { const n = Number(storage.getItem(TAP_COUNT_KEY)); return Number.isInteger(n) && n > 0 && n <= MAX_COUNT ? n : 0; } catch { return 0; }
}
/** +1 (kept at MAX_COUNT); storage that throws keeps nothing. Returns the new count. */
export function bumpTapCount(storage) {
  const next = Math.min(loadTapCount(storage) + 1, MAX_COUNT);
  try { storage.setItem(TAP_COUNT_KEY, String(next)); } catch { /* private mode: not counted */ }
  return next;
}
