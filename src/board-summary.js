// src/board-summary.js — what the card knows about a wall's 한 줄 타임라인 without opening it: how many posts and whether one is new.
// The Worker's GET /v1/summary (worker/API.md) answers { walls: { name: { n, last } }, wallsById: { id: { n, last } } } (top-level posts only, hidden ones left out). Pure, no DOM:
// everything read back (the response, the saved "seen" times) is untrusted and goes through parseSummary / cleanSeen.
export const NEW_DAYS = 3;                       // a wall never opened on this device counts as new only for this long after its last post
export const K_SEEN = 'open-wall:board-seen';    // { wall id (older saves: wall name): the `last` the device saw when it last opened the board }
export const SUMMARY_TTL = 5 * 60 * 1000;        // the summary is asked once per session and kept this long
const MAX_WALLS = 200;
const DAY = 86_400_000;

/**
 * the Worker's answer → Map<NFC wall name, { n, last }>; anything malformed is dropped (an old Worker without the route gives an empty map).
 * wallsById (id keys) is read through nameOf(id) → the wall's current name (an id the app does not know is dropped); an answer without it
 * (an older Worker), or an id the app cannot name yet (its wall list had not loaded when the answer came), is read by name from `walls`.
 */
export function parseSummary(raw, { nameOf = () => null } = {}) {
  const out = new Map();
  if (raw?.wallsById && typeof raw.wallsById === 'object' && !Array.isArray(raw.wallsById)) {
    for (const [id, v] of Object.entries(raw.wallsById).slice(0, MAX_WALLS)) {
      const name = nameOf(id);
      if (!name || !Number.isInteger(v?.n) || v.n < 1 || v.n > 100000 || !Number.isInteger(v?.last) || v.last < 1) continue;
      out.set(name.normalize('NFC'), { n: v.n, last: v.last });
    }
  }
  const walls = raw?.walls;
  if (!walls || typeof walls !== 'object' || Array.isArray(walls)) return out;
  for (const [name, v] of Object.entries(walls).slice(0, MAX_WALLS)) {
    if (typeof name !== 'string' || !name || name.length > 60) continue;
    if (!Number.isInteger(v?.n) || v.n < 1 || v.n > 100000 || !Number.isInteger(v?.last) || v.last < 1) continue;
    if (!out.has(name.normalize('NFC'))) out.set(name.normalize('NFC'), { n: v.n, last: v.last }); // the id route wins; the name keys fill in what ids could not name (wall list not loaded yet)
  }
  return out;
}

/** saved seen-times are untrusted storage: { name: positive whole ms }, at most MAX_WALLS entries (the newest by insertion). */
export function cleanSeen(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const pairs = Object.entries(raw).filter(([k, v]) => typeof k === 'string' && k.length <= 60 && Number.isInteger(v) && v > 0);
  return Object.fromEntries(pairs.slice(-MAX_WALLS).map(([k, v]) => [k.normalize('NFC'), v]));
}

/** is there a post this device has not seen? With a saved time: a newer last. Without: only a post from the last NEW_DAYS days. */
export function hasNew(entry, seen, now) {
  if (!entry) return false;
  return Number.isInteger(seen) ? entry.last > seen : now - entry.last <= NEW_DAYS * DAY;
}

/** the number shown on the card: 99+ from a hundred posts up. */
export const countLabel = (n) => (n >= 100 ? '99+' : String(n));

/**
 * What the card draws for one wall, or null when it should draw nothing (the board is off, the summary has not come or failed).
 * kind: 'none' (no post yet: an invitation), 'has' (n posts), 'new' (n posts and one the device has not seen).
 */
export function boardNotice(summary, name, seen, now) {
  if (!summary) return null;
  const entry = summary.get(name.normalize('NFC'));
  if (!entry) return { kind: 'none', n: 0 };
  return { kind: hasNew(entry, seen?.[name.normalize('NFC')], now) ? 'new' : 'has', n: entry.n, last: entry.last }; // last: when the newest post was written (ms), for "5분 전 새 글"
}

/**
 * The runtime state: one request per session (kept SUMMARY_TTL), the seen-times in storage. api.summary() → the raw answer; storage {get,set};
 * listeners hear every change (the card's pills repaint). A failed request leaves summary null: no pill, nothing else changes.
 */
export function createBoardNotice({ api, storage, now = Date.now, idOf = () => null, nameOf = () => null }) {
  let summary = null, at = 0, pending = null;
  let seen = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f());
  const readSeen = () => { try { return cleanSeen(JSON.parse(storage.get(K_SEEN) || '{}')); } catch { return {}; } };
  return {
    /** ask the Worker (once per TTL); resolves when the answer or the failure is in. */
    load() {
      if (summary && now() - at < SUMMARY_TTL) return Promise.resolve();
      pending ??= Promise.resolve().then(() => api.summary()).then((raw) => { summary = parseSummary(raw, { nameOf }); at = now(); }, () => { /* silent: no pill */ })
        .finally(() => { pending = null; emit(); });
      return pending;
    },
    /** what to draw for this wall (null = nothing). */
    notice(name) {
      seen ??= readSeen();
      const key = idOf(name) ?? name.normalize('NFC');
      return boardNotice(summary, name, { [name.normalize('NFC')]: seen[key] ?? seen[name.normalize('NFC')] }, now()); // an older save keyed by name still counts
    },
    /** the board of this wall was opened: its newest post is now seen. */
    markSeen(name) {
      const entry = summary?.get(name.normalize('NFC'));
      if (!entry) return;
      seen ??= readSeen();
      const nm = name.normalize('NFC'), key = idOf(name) ?? nm;
      if (seen[key] === entry.last && !(key !== nm && nm in seen)) return;
      const { [nm]: _old, ...rest } = seen; // the save moves from the name to the id
      seen = { ...(key === nm ? seen : rest), [key]: entry.last };
      try { storage.set(K_SEEN, JSON.stringify(cleanSeen(seen))); } catch { /* storage may be blocked */ }
      emit();
    },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
  };
}
