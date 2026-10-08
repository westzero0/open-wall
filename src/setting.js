// src/setting.js — "세팅일이 바뀌었어요" on ♥ walls: the setting.last this browser last saw per wall. No DOM.
// Stored as { name: 'YYYY-MM-DD' } under SEEN_KEY, in this browser only (never sent).
import { isDateStr } from './store.js';

export const SEEN_KEY = 'open-wall:setting-seen';
export const MAX_SEEN = 100;
const MAX_NAME = 100;

// Anything stored is untrusted: a plain object of NFC name (1–100 chars) → real date, the last MAX_SEEN kept.
export function cleanSeen(v) {
  const out = new Map();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, d] of Object.entries(v)) {
    const n = k.normalize('NFC').trim();
    if (n && n.length <= MAX_NAME && isDateStr(d)) out.set(n, d);
  }
  return new Map([...out].slice(-MAX_SEEN));
}

export function loadSeen(storage) {
  try {
    return cleanSeen(JSON.parse(storage.getItem(SEEN_KEY)));
  } catch {
    return new Map();
  }
}

export function saveSeen(storage, seen) {
  try {
    storage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(seen)));
  } catch { /* storage full or blocked: the badge comes back next visit */ }
}

/** settingChanged(wall, favs, seen) → true for a ♥ wall whose setting.last differs from a value seen before. */
export function settingChanged(wall, favs, seen) {
  const last = wall?.setting?.last;
  return Boolean(last) && favs.includes(wall.name) && seen.has(wall.name) && seen.get(wall.name) !== last;
}

// `seen` with name → last (moved to the newest end, oldest dropped past MAX_SEEN). No last: unchanged.
export function markSeen(seen, name, last) {
  if (!isDateStr(last) || seen.get(name) === last) return seen;
  const out = new Map(seen);
  out.delete(name);
  out.set(name, last);
  return new Map([...out].slice(-MAX_SEEN));
}

// ♥ walls with a setting.last but no seen value yet are recorded as seen (a first look shows no badge).
export function recordFirstSeen(seen, walls, favs) {
  let out = seen;
  for (const w of walls) if (w.setting?.last && favs.includes(w.name) && !out.has(w.name)) out = markSeen(out, w.name, w.setting.last);
  return out;
}
