// 싱글피치 목록: 내 지역(권역)과 어프로치 도보로 거르고, 선택한 날의 컨디션이 좋은 곳부터, 같으면 가까운 곳부터 놓는다.
// 순수 함수, DOM 없음 (docs/superpowers/specs/2026-10-21-crag-ui-design.md 2절). 권역·거리 계산은 외벽 목록과 같은 함수를 쓴다.
import { cragRow, cragModel } from './crag-model.js';
import { scopeRows, withDistance } from './viewmodel.js';
import { routeSummary } from './crag-grades.js';
import { approachModel } from './crag-approach.js';

// 컨디션 순위: 좋음 → 마르는 중 → 최근 비(dry_days 없음, 비 온 지 오래된 곳부터) → 젖음·얼음 → 비 예보 → 모름·예보 범위 밖 (모르는 곳은 맨 아래)
// 같은 상태끼리: 비 온 지 오래된 순(fallback의 daysSince도 같은 뜻), 젖음 계산이면 그다음 그날 양달이 긴 순
const RANK = { good: 0, drying: 1, recent: 2, wet: 3, frozen: 4, rain: 5, unknown: 6, out: 6 };
const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const litMin = (bar) => bar.filter((s) => s.lit).reduce((a, s) => a + mins(s.to) - mins(s.from), 0);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // Infinity-safe

/**
 * cragList(crags, at, { regions, approachMax, origin, now, daily, hourly, wet, sun, query, sortMode, myGrade, routes, favs, favOnly }) → cragRow & { distanceKm: number|null } in list order.
 * regions: 권역 names (empty = all). My rope is no filter (as on the walls): the card's rope chip says whether it fits. approachMax: walk minutes (0 = not set): a crag whose known walk (approachModel totalMin) is longer is dropped,
 * a crag with unknown minutes stays. origin: {lat, lng} or null (no distance, then ties go by name).
 * sun: 'any'|'sun'|'shade' keeps rows whose row.sun matches. query: substring of name or region. sortMode 'distance' + origin: nearest first, then condition.
 * favOnly + favs (names with a ♥, the wall's 즐겨찾기 store): only those (the wall list's 즐겨찾기만; no other order change, as on the wall).
 * sortMode 'mygrade' + myGrade ({from,to}): most routes inside my range first (routes: Map name → {routes}; no table = -1, last), then condition, then nearest. Without myGrade it is 'time'.
 */
export function cragList(crags, at, { regions = [], approachMax = 0, origin = null, now = new Date(), daily = null, hourly = null, wet = null, sun = 'any', query = '', sortMode = 'time', myGrade = null, routes = null, favs = [], favOnly = false } = {}) {
  const inRegion = scopeRows(crags.map((wall) => ({ wall })), { regions });
  const fits = inRegion.filter(({ wall }) => !favOnly || favs.includes(wall.name)).filter(({ wall }) => {
    const walk = approachModel(wall)?.totalMin;
    return !(approachMax > 0 && walk > approachMax); // null/unknown walk never hides
  });
  const q = query.trim().toLowerCase();
  const byDist = (a, b) => cmp(a.distanceKm ?? Infinity, b.distanceKm ?? Infinity);
  const ago = (r) => (r.cond.state === 'recent' ? r.cond.daysSince : r.cond.ago ?? 0);
  const byCond = (a, b) => cmp(RANK[a.cond.state], RANK[b.cond.state]) || cmp(ago(b), ago(a)) || (a.cond.basis === 'wetness' && b.cond.basis === 'wetness' ? cmp(b.litMin, a.litMin) : 0);
  const mineN = (r) => routeSummary(routes?.get(r.name)?.routes ?? [], myGrade)?.mineCount ?? -1; // no table → bottom
  const byMine = (a, b) => mineN(b) - mineN(a);
  const order = sortMode === 'mygrade' && myGrade ? [byMine, byCond, byDist]
    : sortMode === 'distance' && origin ? [byDist, byCond] : [byCond, byDist];
  return withDistance(fits, origin)
    .map(({ wall, distanceKm }) => {
      const row = cragRow(wall, at, { now, daily, hourly, wet });
      return { ...row, distanceKm, litMin: row.cond.basis === 'wetness' ? litMin(cragModel(wall, at).bar) : 0 };
    })
    .filter((r) => (sun === 'sun' || sun === 'shade' ? r.sun === sun : true)
      && (!q || `${r.name} ${r.crag.region ?? ''} ${r.peaks.join(' ')}`.toLowerCase().includes(q)))
    .sort((a, b) => order.reduce((d, f) => d || f(a, b), 0) || cmp(a.name, b.name));
}
