// src/plan-record.js — pure helpers for the record's route list (자연암장 ascents). No DOM, no storage. Cleaning stays in plan-model.
import { STYLE_NAME, routeHistory } from './plan-fields.js';

export const MAX_ASCENTS = 20; // same ceiling as cleanAscents
/** One line per route: routeId when the route is in the data, else the typed name. */
export const ascentKey = (a) => a.routeId ?? `n:${a.routeName}`;

/** A route + a style button → the ascent line. style 'tried' = 시도만 (no style, tries 1). */
export function ascentOf(route, style, note = '') {
  const base = { routeId: route.id ?? null, routeName: route.name, note };
  return style === 'tried' ? { ...base, result: 'tried', style: null, tries: 1 } : { ...base, result: 'sent', style, tries: null };
}

/** Add or replace the line of the same route (the note stays). Full list: unchanged. */
export function putAscent(list, a) {
  const i = list.findIndex((x) => ascentKey(x) === ascentKey(a));
  if (i >= 0) return list.map((x, j) => (j === i ? { ...a, note: x.note ?? a.note ?? '' } : x));
  return list.length >= MAX_ASCENTS ? list : [...list, a];
}
export const dropAscent = (list, key) => list.filter((x) => ascentKey(x) !== key);
export const patchAscent = (list, key, patch) => list.map((x) => (ascentKey(x) === key ? { ...x, ...patch } : x));

/** What a chosen route row says: '✓ 온사이트' / '시도만 했어요'. */
export const ascentLabel = (a) => (a.result === 'tried' ? '시도만 했어요' : `✓ ${STYLE_NAME[a.style] ?? ''}`.trim());

/** Earlier tries of each route on the OTHER plans that were 갔다 (this plan's own lines, and plans never gone to, must not turn a route into a project). */
export function historyMap(plans, planId, routes) {
  const others = plans.filter((p) => p.id !== planId && p.status === '갔다'); // only trips that happened count as earlier tries
  return new Map(routes.map((r) => [r.id, routeHistory(others, r.id)]));
}
