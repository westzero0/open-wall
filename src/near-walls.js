// src/near-walls.js — 근처 외벽 (the crag card's row and sheet): the app's walls (data/national.json) near a crag, and the driving-route link
// from the crag to one of them. DOM 없음. The crag's position is its sun {lat, lng}; the user's own position is never used.
import { distanceKm, wallPosition } from './viewmodel.js';
import { bearingDeg } from './gear.js';

export const NEAR_WALLS_KM = 60;
export const VENUE_WORD = { indoor: '실내', outdoor: '외벽', both: '실내·외벽' };
const indoorish = (v) => v === 'indoor' || v === 'both';

/**
 * Up to `limit` walls within radiusKm of `position` ({lat, lng}), nearest first (same distance → 가나다순); with indoorFirst (rain at the crag),
 * walls with an indoor wall ('indoor' or 'both') come before the outdoor-only ones. → [{ name, km, bearing, venue ('' = not said), wall }]
 */
export function nearWalls(walls, position, { radiusKm = NEAR_WALLS_KM, limit = 2, indoorFirst = false } = {}) {
  if (!position) return [];
  return (walls ?? [])
    .map((w) => {
      const p = wallPosition(w);
      return p && { name: w.name, km: distanceKm(position, p), bearing: bearingDeg(position, p), venue: w.venue ?? '', wall: w };
    })
    .filter((x) => x && x.km <= radiusKm)
    .sort((a, b) => (indoorFirst ? indoorish(b.venue) - indoorish(a.venue) : 0) || a.km - b.km || a.name.localeCompare(b.name, 'ko'))
    .slice(0, limit);
}

/** The card's row: "클라임투게더 원주점 · 실내", with more "… 외 1곳" (no km: the sheet's chip has it); null when there is none. */
export function nearWallsLine(list) {
  if (!list?.length) return null;
  const [first] = list;
  const head = [first.name, VENUE_WORD[first.venue]].filter(Boolean).join(' · ');
  return list.length === 1 ? head : `${head} 외 ${list.length - 1}곳`;
}

/**
 * A driving route from `from` to `to` ({name, lat, lng}) in the picked map app ('naver', else Kakao).
 * Kakao: the documented /link/by/car/이름,위도,경도/이름,위도,경도 (apis.map.kakao.com/web/guide, URL 길찾기);
 * Naver: the web /p/directions/경도,위도,이름/경도,위도,이름/-/car, the start-filled form of the one card-model.js already uses.
 */
export function routeUrl(from, to, app = 'kakao') {
  const e = encodeURIComponent;
  return app === 'naver'
    ? `https://map.naver.com/p/directions/${from.lng},${from.lat},${e(from.name)}/${to.lng},${to.lat},${e(to.name)}/-/car`
    : `https://map.kakao.com/link/by/car/${e(from.name)},${from.lat},${from.lng}/${e(to.name)},${to.lat},${to.lng}`;
}
