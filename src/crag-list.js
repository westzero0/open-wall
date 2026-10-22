// 싱글피치 목록: 내 지역(권역)과 내 로프로 거르고, 선택한 날의 컨디션이 좋은 곳부터, 같으면 가까운 곳부터 놓는다.
// 순수 함수, DOM 없음 (docs/superpowers/specs/2026-10-21-crag-ui-design.md 2절). 권역·거리 계산은 외벽 목록과 같은 함수를 쓴다.
import { cragRow } from './crag-model.js';
import { ropeNeeded } from './card-model.js';
import { scopeRows, withDistance } from './viewmodel.js';
import { routeSummary } from './crag-grades.js';
import { approachModel } from './crag-approach.js';

// 컨디션 순위: 좋음 → 마르는 중 → 최근 비(dry_days 없음, 비 온 지 오래된 곳부터) → 비 예보 → 모름·예보 범위 밖 (모르는 곳은 맨 아래)
const RANK = { good: 0, drying: 1, recent: 2, rain: 3, unknown: 4, out: 4 };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // Infinity-safe

/**
 * cragList(crags, at, { regions, ropeM, approachMax, origin, now, daily, hourly, sun, query, sortMode, myGrade, routes, favs, favOnly }) → cragRow & { distanceKm: number|null } in list order.
 * regions: 권역 names (empty = all). ropeM: my rope in metres (0 = not set): a crag whose longest route asks for more is dropped,
 * a crag with no known height stays. approachMax: walk minutes (0 = not set): a crag whose known walk (approachModel totalMin) is longer is dropped,
 * a crag with unknown minutes stays. origin: {lat, lng} or null (no distance, then ties go by name).
 * sun: 'any'|'sun'|'shade' keeps rows whose row.sun matches. query: substring of name or region. sortMode 'distance' + origin: nearest first, then condition.
 * favOnly + favs (names with a ♥, the wall's 즐겨찾기 store): only those (the wall list's 즐겨찾기만; no other order change, as on the wall).
 * sortMode 'mygrade' + myGrade ({from,to}): most routes inside my range first (routes: Map name → {routes}; no table = -1, last), then condition, then nearest. Without myGrade it is 'time'.
 */
export function cragList(crags, at, { regions = [], ropeM = 0, approachMax = 0, origin = null, now = new Date(), daily = null, hourly = null, sun = 'any', query = '', sortMode = 'time', myGrade = null, routes = null, favs = [], favOnly = false } = {}) {
  const inRegion = scopeRows(crags.map((wall) => ({ wall })), { regions });
  const fits = inRegion.filter(({ wall }) => !favOnly || favs.includes(wall.name)).filter(({ wall }) => {
    const need = ropeNeeded(wall.height_m);
    const walk = approachModel(wall)?.totalMin;
    return !(ropeM > 0 && need && need.need > ropeM) && !(approachMax > 0 && walk > approachMax); // null/unknown walk never hides
  });
  const q = query.trim().toLowerCase();
  const byDist = (a, b) => cmp(a.distanceKm ?? Infinity, b.distanceKm ?? Infinity);
  const byCond = (a, b) => cmp(RANK[a.cond.state], RANK[b.cond.state]) || (a.cond.state === 'recent' ? b.cond.daysSince - a.cond.daysSince : 0);
  const mineN = (r) => routeSummary(routes?.get(r.name)?.routes ?? [], myGrade)?.mineCount ?? -1; // no table → bottom
  const byMine = (a, b) => mineN(b) - mineN(a);
  const order = sortMode === 'mygrade' && myGrade ? [byMine, byCond, byDist]
    : sortMode === 'distance' && origin ? [byDist, byCond] : [byCond, byDist];
  return withDistance(fits, origin)
    .map(({ wall, distanceKm }) => ({ ...cragRow(wall, at, { now, daily, hourly }), distanceKm }))
    .filter((r) => (sun === 'sun' || sun === 'shade' ? r.sun === sun : true)
      && (!q || `${r.name} ${r.crag.region ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => order.reduce((d, f) => d || f(a, b), 0) || cmp(a.name, b.name));
}
