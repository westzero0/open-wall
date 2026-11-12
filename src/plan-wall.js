// src/plan-wall.js — model of the 암장 시트 (wall sheet) in the planner. DOM-free.
import { hasHours, openIntervals } from './hours.js';
import { fmtMin, distanceKm, wallPosition, weeklyHours, groupWeekRows, shortName } from './viewmodel.js';
import { feeWord } from './card-model.js';
import { wallPageId } from './share-id.js';

const dateOf = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

// 이름 표기 규칙: 목록·검색·근처 목록은 짧은 이름, 암장 시트 제목은 공식 이름. 단 공식 이름이 TITLE_MAX자를 넘으면(큰 글자에서 제목이 줄바꿈될 만큼 길면) 짧은 이름. 
export const TITLE_MAX = 16;
export const wallTitle = (wall) => (String(wall.name).length <= TITLE_MAX ? wall.name : shortName(wall));

/** Open state of a wall on `date` at `min` (null = whole day): '' when unknown, else a short phrase. */
export function openLabel(wall, date, min) {
  const day = dateOf(date);
  if (!wall || typeof wall !== 'object' || !day || !hasHours(wall)) return '';
  if (wall.suspended) return '임시 휴관';
  const iv = openIntervals(wall, day);
  if (!iv.length) return '그날 쉼';
  if (Number.isFinite(min)) return iv.some(([a, b]) => min >= a && min < b) ? '그 시간 열림' : '그 시간 닫힘';
  return `그날 ${iv.map(([a, b]) => `${fmtMin(a)}~${fmtMin(b)}`).join(', ')}`;
}

export const findWall = (walls, id) => (Array.isArray(walls) ? walls.find((w) => w && wallPageId(w) === id) ?? null : null);

/** Nearest walls to `wall` (self, 임시 휴관 and unlocated out): [{ wall, km }]. */
export function nearbyWalls(wall, walls, limit = 3) {
  const at = wall ? wallPosition(wall) : null;
  if (!at) return [];
  const self = wallPageId(wall);
  const rows = [];
  for (const w of Array.isArray(walls) ? walls : []) {
    if (!w || typeof w !== 'object' || w.suspended || wallPageId(w) === self) continue;
    const p = wallPosition(w);
    if (!p) continue;
    const km = distanceKm(at, p);
    if (Number.isFinite(km)) rows.push({ wall: w, km });
  }
  return rows.sort((a, b) => a.km - b.km).slice(0, Math.max(0, limit));
}

export function wallSheetModel(wall, { date, min = null, walls = [] } = {}) {
  const day = dateOf(date) ?? new Date();
  const hours = hasHours(wall);
  return {
    id: wallPageId(wall),
    name: wallTitle(wall), // the sheet is where the official name shows (see TITLE_MAX)
    region: wall.region ?? '',
    open: openLabel(wall, date, min),
    week: hours ? groupWeekRows(weeklyHours(wall, day).rows) : null,
    fee: feeWord(wall, day) || null,
    address: typeof wall.address === 'string' && wall.address ? wall.address : null,
    nearby: nearbyWalls(wall, walls).map(({ wall: w, km }) => ({ id: wallPageId(w), name: shortName(w), region: w.region ?? '', km, open: openLabel(w, date, min) })),
  };
}

/** Links to the utility page (old app): { list, map, wall }; null when utilUrl is empty. `?wall=` takes a wall NAME. */
export function utilLinks(utilUrl, wallName) {
  if (!utilUrl) return null;
  return { list: utilUrl, map: `${utilUrl}?tab=map`, wall: wallName ? `${utilUrl}?wall=${encodeURIComponent(wallName)}` : null };
}
