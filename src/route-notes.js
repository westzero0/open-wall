// src/route-notes.js — 루트 메모(나만 보는 루트별 한 줄): key, lookup and the merge of typed routes into the route list. No DOM, no storage.
// A note belongs to a crag (cragId = wallPageId) and a route: routeId when the route is in the data, else the typed name (normalized).
import { norm } from './plan-routes.js';

export const ROUTE_NOTE_MAX = 100; // what the input takes
export const ROUTE_NOTE_KEEP = 200; // what is kept: two notes joined when a typed route meets its listed one

export const noteKey = ({ cragId, routeId, routeName }) => (routeId ? `${cragId}|${routeId}` : `${cragId}|n:${norm(routeName)}`);

/** findNote(notes, { cragId, routeId, routeName }) → the note of that route (by id first, then by normalized name), or null. */
export function findNote(notes, { cragId, routeId = null, routeName = '' }) {
  const list = Array.isArray(notes) ? notes : [];
  const same = list.filter((n) => n.cragId === cragId);
  if (routeId) { const byId = same.find((n) => n.routeId === routeId); if (byId) return byId; }
  const key = norm(routeName);
  return (key && same.find((n) => !n.routeId && norm(n.routeName) === key)) || null;
}

// 온사이트 > 플래시 > 레드포인트 > 탑로프 > 시도만: which line stays when two lines of one record turn out to be the same route
const RANK = { onsight: 4, flash: 3, redpoint: 2, toprope: 1 };
const strength = (a) => (a.result === 'sent' ? 10 + (RANK[a.style] ?? 0) : (a.tries ?? 1) / 100);
function keepStronger(a, b) {
  const [win, lose] = strength(b) > strength(a) ? [b, a] : [a, b];
  return win.note || !lose.note ? win : { ...win, note: lose.note };
}

/**
 * adoptRoutes(db, { cragId, routes, inCrag }) → db: typed routes (no routeId) whose normalized name is exactly one listed route's
 * get that routeId — the crag's notes and the ascents of the plans inCrag(plan) says are at this crag. A name two listed routes share
 * is left alone. Returns the same db when nothing changed; never changes its input.
 */
export function adoptRoutes(db, { cragId, routes, inCrag }) {
  const byName = new Map(), shared = new Set();
  for (const r of Array.isArray(routes) ? routes : []) {
    const k = norm(r?.name);
    if (!k || !r.id) continue;
    if (byName.has(k)) shared.add(k); else byName.set(k, r.id);
  }
  for (const k of shared) byName.delete(k);
  if (!byName.size) return db;
  const idOf = (name) => byName.get(norm(name)) ?? null;
  let changed = false;

  // notes: re-key the typed ones; one note per route, an id note first and a differing name note joined after it
  const notes = db.routeNotes ?? [];
  const out = [];
  for (const n of notes) {
    const id = n.cragId === cragId && !n.routeId ? idOf(n.routeName) : null;
    const m = id ? { ...n, routeId: id } : n;
    if (id) changed = true;
    const at = out.findIndex((x) => x.cragId === m.cragId && x.routeId && x.routeId === m.routeId);
    if (at < 0) { out.push(m); continue; }
    const first = out[at].routeId === m.routeId && !id ? m : out[at]; // the note that already had the id leads
    const second = first === m ? out[at] : m;
    const text = first.text === second.text ? first.text : [...`${first.text} / ${second.text}`].slice(0, ROUTE_NOTE_KEEP).join('');
    out[at] = { ...first, text };
  }

  const plans = (db.plans ?? []).map((p) => {
    const list = p?.record?.ascents;
    if (!Array.isArray(list) || !list.length || !inCrag(p)) return p;
    let touched = false;
    const lines = [];
    for (const a of list) {
      const id = !a.routeId ? idOf(a.routeName) : null;
      const line = id ? { ...a, routeId: id } : a;
      if (id) touched = true;
      const at = line.routeId ? lines.findIndex((x) => x.routeId === line.routeId) : -1;
      if (at < 0) lines.push(line); else lines[at] = keepStronger(lines[at], line);
    }
    if (!touched) return p;
    changed = true;
    return { ...p, record: { ...p.record, ascents: lines } };
  });

  // my routes the list now has under the same name: the listed route stands in for them
  const myAll = db.myRoutes ?? [];
  const myRoutes = myAll.filter((m) => !(m.place === `crag:${cragId}` && byName.has(norm(m.name))));
  if (myRoutes.length !== myAll.length) changed = true;

  return changed ? { ...db, routeNotes: out, plans, myRoutes } : db;
}
