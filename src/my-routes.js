// src/my-routes.js — 내 루트(목록에 없는 루트를 곳별로 적어 둔 것): place key, per-place list, name lookup. No DOM, no storage.
import { norm } from './plan-routes.js';

export const MY_ROUTE_NAME_MAX = 40;
export const MAX_MY_ROUTES = 500;

/** placeKeyOf({ cragId, place }) → 'crag:<cragId>' | 'mine:<id>' | null (a typed-name place has nowhere to keep a route). */
export function placeKeyOf({ cragId, place } = {}) {
  if (cragId) return `crag:${cragId}`;
  return place?.kind === 'mine' && place.id ? `mine:${place.id}` : null;
}

/** routesAt(list, place) → that place's routes, oldest first. */
export const routesAt = (list, place) => (Array.isArray(list) ? list : []).filter((r) => r.place === place).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

/** findMyRoute(list, place, name) → the route of that place with the same normalized name, or null. */
export function findMyRoute(list, place, name) {
  const k = norm(name);
  return (k && (Array.isArray(list) ? list : []).find((r) => r.place === place && norm(r.name) === k)) || null;
}
