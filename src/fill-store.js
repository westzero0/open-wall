// src/fill-store.js — which blanks this device filled (docs/superpowers/specs/2026-10-30-contribution-fill-in-design.md 6절): the last 200,
// kept only to count "내가 채운 암장". No DOM: the caller passes the storage accessors, as in author-id.js.
import { FILL_FIELDS } from './fill-fields.js';
import { AUTHOR_RE, AUTHOR_KEY, peekAuthorId } from './author-id.js';

export const FILLS_SENT_KEY = 'open-wall:fills-sent';
const MAX = 200;

const ok = (e) => e && typeof e.wall_id === 'string' && e.wall_id && e.wall_id.length <= 64 && FILL_FIELDS.includes(e.field) && Number.isFinite(e.at);

/** a list of entries → the well-formed ones ({wall_id, field, at}), newest 200. */
export const cleanFillsSent = (v) => (Array.isArray(v) ? v.filter(ok).map(({ wall_id, field, at }) => ({ wall_id, field, at })).slice(-MAX) : []);

/** the saved entries [{wall_id, field, at}] (only well-formed ones, newest 200); anything unreadable is []. */
export function loadFillsSent({ get }) {
  try { return cleanFillsSent(JSON.parse(get(FILLS_SENT_KEY))); } catch { return []; }
}

export function addFillSent({ get, set }, entry) {
  if (!ok(entry)) return;
  try { set(FILLS_SENT_KEY, JSON.stringify([...loadFillsSent({ get }), { wall_id: entry.wall_id, field: entry.field, at: entry.at }].slice(-MAX))); } catch { /* full or blocked: the record is only a count */ }
}

/** how many different walls this device filled something for. */
export const filledWallCount = (store) => new Set(loadFillsSent(store).map((e) => e.wall_id)).size;

/** the backup file's `contrib` block for this device: { author_id?, fills }, or null when there is nothing to carry. */
export function exportContrib(store) {
  const author_id = peekAuthorId(store);
  const fills = loadFillsSent(store);
  return author_id || fills.length ? { ...(author_id ? { author_id } : {}), fills } : null;
}

/** a block read from a backup file → its safe part: { author_id?, fills }; anything that is not a block is null. */
export function cleanContrib(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return { ...(typeof v.author_id === 'string' && AUTHOR_RE.test(v.author_id) ? { author_id: v.author_id } : {}), fills: cleanFillsSent(v.fills) };
}

/** put a backup's contrib block back: the authorId only on a device that has none (never overwritten), the fills without doubles. */
export function restoreContrib(store, contrib) {
  const c = cleanContrib(contrib);
  if (!c) return;
  try {
    if (c.author_id && !peekAuthorId(store)) store.set(AUTHOR_KEY, c.author_id);
    const have = loadFillsSent(store);
    const key = (e) => `${e.wall_id}
${e.field}
${e.at}`;
    const seen = new Set(have.map(key));
    const merged = [...have, ...c.fills.filter((e) => !seen.has(key(e)) && seen.add(key(e)))].sort((a, b) => a.at - b.at).slice(-MAX);
    store.set(FILLS_SENT_KEY, JSON.stringify(merged));
  } catch { /* blocked storage: the backup's other records are already restored */ }
}
