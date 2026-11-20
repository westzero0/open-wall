// src/plan-seen.js — "예보 바뀜": the weather level the app last showed per plan vs now. Pure: no DOM, no storage (plan-api.js loadSeen/saveSeen).
// seen = { [planId]: { k, level } }; k = date|min|place (a moved plan is not a forecast change).
const LEVELS = ['ok', 'caution', 'hard'];
const WORD = { ok: '가능', caution: '주의', hard: '어려움' };
const MAX_SEEN = 200;
const MAX_K = 300;

export const seenKey = (plan) => `${plan.date}|${plan.min ?? ''}|${JSON.stringify(plan.place ?? null)}`;

export function cleanSeen(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const [id, v] of Object.entries(raw)) {
    if (n >= MAX_SEEN) break;
    if (!v || typeof v.k !== 'string' || v.k.length > MAX_K || !LEVELS.includes(v.level)) continue;
    out[id] = { k: v.k, level: v.level };
    n++;
  }
  return out;
}

/**
 * diffSeen(seen, items, prevChanged, today, keepIds) → { seen, changed }
 * items: [{ id, k, level, date }] (targets only). keepIds: Set of every live plan id (their stored values survive even when not a target now).
 * changed: Map planId → { from, to } (this session; from stays the first level, back to it = removed).
 */
export function diffSeen(seen, items, prevChanged = new Map(), today = '', keepIds = new Set()) {
  const next = {};
  for (const [id, v] of Object.entries(seen ?? {})) if (keepIds.has(id) && v.k.slice(0, 10) >= today) next[id] = v;
  const changed = new Map([...prevChanged].filter(([id]) => keepIds.has(id)));
  for (const it of items) {
    const old = next[it.id];
    next[it.id] = { k: it.k, level: it.level };
    if (!old || old.k !== it.k) { changed.delete(it.id); continue; }
    const prev = changed.get(it.id);
    if (old.level === it.level) { if (prev) changed.set(it.id, { from: prev.from, to: it.level }); continue; }
    const from = prev ? prev.from : old.level;
    if (from === it.level) changed.delete(it.id); else changed.set(it.id, { from, to: it.level });
  }
  return { seen: next, changed };
}

export const changeLine = (from, to) => `예보 바뀜 · ${WORD[from]} → ${WORD[to]}`; // breaks only after ·: 예보 바뀜 · / 어려움 → 가능 (ui-designer 2026-11-20)
export const changeAria = (from, to) => `예보 바뀜, 전에는 ${WORD[from]}, 지금은 ${WORD[to]}`;
