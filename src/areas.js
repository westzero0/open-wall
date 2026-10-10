// src/areas.js — 내 지역 is picked by 권역 (5 of them), not by 구·시: 63 walls sit in 56 of those, so a 구 filter was a wall picker. No DOM.
// A wall's `region` text ("서울 동작구") keeps its 구·시; its first word, the 시·도, decides the 권역.
export const AREAS = [
  { name: '서울', sido: ['서울'] },
  { name: '경기·인천', sido: ['경기', '인천'] },
  { name: '강원·충청', sido: ['강원', '충북', '충남', '대전', '세종'] },
  { name: '영남', sido: ['경북', '경남', '대구', '부산', '울산'] },
  { name: '호남·제주', sido: ['전북', '전남', '광주', '제주'] },
];
export const AREA_NAMES = AREAS.map((a) => a.name);

const first = (s) => String(s ?? '').trim().split(/\s+/)[0];
/** areaOf("서울 동작구") → "서울"; a region outside the table (or empty) → "" (only 전국 shows it). */
export const areaOf = (region) => AREAS.find((a) => a.sido.includes(first(region)))?.name ?? '';

/** Saved picks → 권역 names: a 권역 stays, an old "서울 동작구" becomes its 권역; anything else is dropped; no repeats. */
export const normalizeAreas = (v) => {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((r) => typeof r === 'string').map((r) => (AREA_NAMES.includes(r) ? r : areaOf(r))).filter(Boolean))];
};

/** The 권역 the walls are in, in table order, with how many walls each holds: [{name, total}]. */
export function areaList(walls) {
  const n = new Map();
  for (const w of walls) { const a = areaOf(w.region); if (a) n.set(a, (n.get(a) ?? 0) + 1); }
  return AREAS.filter((a) => n.has(a.name)).map((a) => ({ name: a.name, total: n.get(a.name) }));
}
