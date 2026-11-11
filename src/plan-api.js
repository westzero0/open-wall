// src/plan-api.js — the one place the planner reads/writes storage (and the optional alias list). No DOM; storage is injected
// ({ getItem, setItem }). Reads never throw (broken data -> empty); writes return { ok } instead of throwing.
import { cleanAll, cleanPlan, cleanPartner, cleanMineWall, cleanSettings } from './plan-model.js';
import { getAuthorId } from './author-id.js';
import { getJson } from './remote.js';
import { config } from './config.js';
import { WALL_ID_RE } from './store.js';
import { cleanSent } from './crowd.js';

export const PLAN_KEY = 'open-wall:planner:v1';

export function loadAll(storage, opts) {
  let raw = null;
  try { const s = storage.getItem(PLAN_KEY); raw = s ? JSON.parse(s) : null; } catch { raw = null; }
  return cleanAll(raw, opts);
}

function write(storage, state) {
  try { storage.setItem(PLAN_KEY, JSON.stringify({ version: 1, ...state })); return { ok: true }; } catch { return { ok: false }; }
}

const deviceId = (storage) => getAuthorId({ get: (k) => storage.getItem(k), set: (k, v) => { storage.setItem(k, v); return true; } }) ?? '';
const withAuthor = (storage, e) => (e && e.authorId ? e : { ...e, authorId: deviceId(storage) });

function upsert(storage, listKey, clean, item, opts) {
  const state = loadAll(storage, opts);
  const c = clean({ ...withAuthor(storage, item), updatedAt: opts?.now ?? Date.now() }, opts); // opts.now: epoch ms, injectable
  if (!c) return { ok: false, [listKey]: state[listKey] };
  const list = state[listKey];
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.push(c);
  return { ...write(storage, state), [listKey]: list };
}

// ponytail: delete = drop from list; once a server syncs, turn this into a deletedAt tombstone here.
function remove(storage, listKey, id) {
  const state = loadAll(storage);
  state[listKey] = state[listKey].filter((x) => x.id !== id);
  return { ...write(storage, state), [listKey]: state[listKey] };
}

export const savePlan = (storage, plan, opts) => upsert(storage, 'plans', cleanPlan, plan, opts);
export const removePlan = (storage, id) => remove(storage, 'plans', id);
export const savePartner = (storage, partner, opts) => upsert(storage, 'partners', cleanPartner, partner, opts);
export const removePartner = (storage, id) => remove(storage, 'partners', id); // plans keep participants as they were
export const saveMine = (storage, wall, opts) => upsert(storage, 'mine', cleanMineWall, wall, opts);

export function saveSettings(storage, patch) {
  const state = loadAll(storage);
  state.settings = cleanSettings({ ...state.settings, ...patch });
  return { ...write(storage, state), settings: state.settings };
}

/** loadAliases({fetchFn, url}) → Map<fromId, officialId>. Empty url -> no request; any failure -> empty Map. */
export async function loadAliases({ fetchFn, url = config.data.aliases } = {}) {
  const out = new Map();
  if (!url) return out;
  try {
    const j = await getJson(url, { fetchFn });
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      for (const [from, to] of Object.entries(j)) if (from && from.length <= 64 && typeof to === 'string' && WALL_ID_RE.test(to)) out.set(from, to);
    }
  } catch { /* offline or bad JSON: no aliases */ }
  return out;
}

/** A mine/name place whose id (mine) or name (name) is aliased reads as the official wall; storage stays as written. */
export function resolveAlias(aliases, place) {
  const key = place?.kind === 'mine' ? place.id : place?.kind === 'name' ? place.name : null;
  const to = key != null ? aliases.get(key) : null;
  return to ? { kind: 'official', id: to } : place;
}

// The crowd form's send log (limits per wall/day/visit) is shared with the main app's key, so both screens count the same reports.
export const SENT_KEY = 'open-wall:crowd-sent';
export function loadSent(storage) { try { return cleanSent(JSON.parse(storage.getItem(SENT_KEY) ?? 'null')); } catch { return {}; } }
export function saveSent(storage, sent) { try { storage.setItem(SENT_KEY, JSON.stringify(sent)); return { ok: true }; } catch { return { ok: false }; } }
