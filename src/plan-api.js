// src/plan-api.js — the one place the planner reads/writes storage (and the optional alias list). No DOM; storage is injected
// ({ getItem, setItem }). Reads never throw (broken data -> empty); writes return { ok } instead of throwing.
import { cleanAll, cleanPlan, cleanPartner, cleanMineWall, cleanSettings, cleanRouteNote, cleanMyRoute, randomId } from './plan-model.js';
import { noteKey, adoptRoutes } from './route-notes.js';
import { norm } from './plan-routes.js';
import { MAX_MY_ROUTES } from './my-routes.js';
import { getAuthorId } from './author-id.js';
import { getJson } from './remote.js';
import { config } from './config.js';
import { WALL_ID_RE } from './store.js';
import { cleanSent } from './crowd.js';
import { parseRecord, planImport, planFromRecord, linkPatch } from './record-import.js';

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

/** 루트 메모 one route: same route (noteKey) → overwritten, its id kept; empty text → that note removed. → { ok, routeNotes } */
export function saveRouteNote(storage, { cragId, routeId = null, routeName = '', text = '' }, opts) {
  const state = loadAll(storage, opts);
  const key = noteKey({ cragId, routeId, routeName });
  const i = state.routeNotes.findIndex((n) => noteKey(n) === key);
  const c = cleanRouteNote({ id: i >= 0 ? state.routeNotes[i].id : randomId(), authorId: i >= 0 ? state.routeNotes[i].authorId : deviceId(storage),
    cragId, routeId, routeName, text, updatedAt: opts?.now ?? Date.now() });
  if (!c) {
    if (i < 0) return { ok: true, routeNotes: state.routeNotes };
    state.routeNotes.splice(i, 1);
  } else if (i >= 0) state.routeNotes[i] = c; else state.routeNotes.push(c);
  return { ...write(storage, state), routeNotes: state.routeNotes };
}

/** 내 루트 one route: same place + same normalized name → overwritten (id, authorId, createdAt kept). → { ok, myRoutes } */
export function saveMyRoute(storage, { place, name = '', grade = null }, opts) {
  const state = loadAll(storage, opts);
  const key = norm(name);
  const i = key ? state.myRoutes.findIndex((r) => r.place === place && norm(r.name) === key) : -1;
  const now = opts?.now ?? Date.now();
  const old = i >= 0 ? state.myRoutes[i] : null;
  const c = cleanMyRoute({ id: old?.id ?? randomId(), authorId: old?.authorId ?? deviceId(storage), place, name, grade, createdAt: old?.createdAt ?? now, updatedAt: now });
  if (!c || (!old && state.myRoutes.length >= MAX_MY_ROUTES)) return { ok: false, myRoutes: state.myRoutes };
  if (old) state.myRoutes[i] = c; else state.myRoutes.push(c);
  return { ...write(storage, state), myRoutes: state.myRoutes };
}
export const removeMyRoute = (storage, id) => remove(storage, 'myRoutes', id);

/** The whole db written at once (adoptRoutes' result), cleaned first. → { ok } */
export const saveDb = (storage, db, opts) => write(storage, cleanAll(db, opts));

/** Typed routes of this crag that the route list now has → merged and saved (route-notes.js adoptRoutes). → { saved } (false: nothing to do, or the write failed) */
export function adoptAndSave(storage, cragId, routes, inCrag, opts) {
  const db = loadAll(storage, opts);
  const next = adoptRoutes(db, { cragId, routes, inCrag });
  return { saved: next !== db && saveDb(storage, next, opts).ok };
}

export const MAX_IMPORT = 200;
/**
 * 피치 기록 가져오기 (spec 2026-11-18-record-format §6): file texts → new past plans / links, one write.
 * places: { walls, crags, ice, aliases } from the planner state. opts.dryRun: count only. Files past MAX_IMPORT count as bad.
 * → { ok, created, linked, statusChanged, same, bad, latestId } (latestId: the newest created plan, or null)
 */
export function importRecords(storage, texts, places, opts = {}) {
  const now = opts.now ?? Date.now();
  const list = Array.isArray(texts) ? texts : [];
  const parsed = list.slice(0, MAX_IMPORT).map(parseRecord);
  const recs = parsed.filter((r) => r.ok).map((r) => r.rec);
  const bad = parsed.length - recs.length + Math.max(0, list.length - MAX_IMPORT);
  const state = loadAll(storage, opts);
  const plan = planImport(recs, state.plans, places);
  const counts = { created: plan.create.length, linked: plan.link.length, statusChanged: plan.link.filter((l) => l.statusChanged).length, same: plan.same.length, bad };
  if (opts.dryRun || (!plan.create.length && !plan.link.length)) return { ok: true, ...counts, latestId: null };
  const authorId = deviceId(storage);
  for (const l of plan.link) {
    const i = state.plans.findIndex((p) => p.id === l.planId);
    const c = cleanPlan({ ...linkPatch(state.plans[i], l.rec), updatedAt: now }, opts);
    if (c) state.plans[i] = c;
  }
  let latest = null;
  for (const { rec, placeId } of plan.create) {
    const c = cleanPlan(planFromRecord(rec, placeId, { id: randomId(), authorId, now }), opts);
    if (!c) continue;
    state.plans.push(c);
    if (!latest || c.date > latest.date) latest = c;
  }
  return { ...write(storage, state), ...counts, latestId: latest?.id ?? null };
}

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
