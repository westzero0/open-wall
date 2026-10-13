// src/pledge.js — 안전수칙 약속: the day this browser's owner pledged to keep the rules (open-wall:pledge). No DOM.
// Stays on this device; the only thing that leaves is the invite tag 'pledge', which the invite sheet offers after a pledge.
export const PLEDGE_KEY = 'open-wall:pledge';

/** cleanPledge(v) → 'YYYY-MM-DD' for a real calendar day, else null (storage is not trusted). */
export function cleanPledge(v) {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? v : null;
}

export function loadPledge(storage) {
  try { return cleanPledge(storage.getItem(PLEDGE_KEY)); } catch { return null; }
}

/** savePledge(storage, day) → true when stored; false for a bad day or a store that refuses (private mode). */
export function savePledge(storage, day) {
  const d = cleanPledge(day);
  if (!d) return false;
  try { storage.setItem(PLEDGE_KEY, d); return true; } catch { return false; }
}

/** dayLabel('2026-10-03') → '10월 3일' */
export const dayLabel = (day) => { const [, m, d] = day.split('-').map(Number); return `${m}월 ${d}일`; };
