// src/crag-sheet-model.js — which tabs a 싱글피치 crag's sheet (src/wall-sheet.js, kind 'crag') has, and what its sky head says (no DOM).
// 컨디션 is always there; the others only when there is something to show. The keys are the address flags (?crag=<name>&cond|way|routes|board).
export const CRAG_SHEET_TABS = ['cond', 'way', 'routes', 'board'];
export const CRAG_TAB_LABEL = { cond: '컨디션', way: '가는 길', routes: '루트', board: '게시판' };
export const CRAG_TAB_ICON = { cond: 'sun', way: 'map', routes: 'route', board: 'chat' };
// the report kinds each tab offers (wall-sheet.js uses a tab's own `kinds` before the wall's TAB_KINDS: the wall's 루트 tab means other kinds)
export const CRAG_TAB_KINDS = { routes: ['루트·개념도'], board: ['기타'] };

// Crags whose names are on the board Worker's allowed list (worker/walls.json). None yet: the Worker knows walls only, so a crag has no 한 줄 board
// and its 게시판 tab / card row hold the 블로그 후기. Add a name here in the same change that adds it to the Worker's list.
const CRAG_BOARD = new Set();
export const cragBoardListed = (name) => CRAG_BOARD.has(name);

export function cragSheetTabs({ hasWay = false, hasRoutes = false, hasBoard = false } = {}) {
  const has = { cond: true, way: hasWay, routes: hasRoutes, board: hasBoard };
  return CRAG_SHEET_TABS.filter((k) => has[k]).map((key) => ({ key, label: CRAG_TAB_LABEL[key], ...(CRAG_TAB_KINDS[key] ? { kinds: CRAG_TAB_KINDS[key] } : {}) }));
}

// The sheet's sky head: where the sun sits on the day's arc, and the chip.
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const SINK = 0.15; // past sunrise/sunset the disc sinks under the band's ground and stays there (the arc's sine would bring it back up)
/** sunT(day, at) → the viewed time on the day's arc: 0 = sunrise (cragModel's day.from), 1 = sunset, clamped to −0.15…1.15; null without a day. */
export function sunT(day, at) {
  if (!day) return null;
  const rise = toMin(day.from), set = toMin(day.to);
  if (!(set > rise)) return null;
  const t = (at.getHours() * 60 + at.getMinutes() - rise) / (set - rise);
  return Math.min(1 + SINK, Math.max(-SINK, t));
}
/** skyChip(tone, live) → the head's chip from the sun box's tone (sceneTone: 'k-lit' / 'k-lit low' / 'k-shade' / 'k-night' / ''): 지금|그 시각 양달·응달, 해 진 뒤, or null. */
export function skyChip(tone, live) {
  if (/\bk-night\b/.test(tone)) return '해 진 뒤';
  const w = /\bk-lit\b/.test(tone) ? '양달' : /\bk-shade\b/.test(tone) ? '응달' : null;
  return w && `${live ? '지금' : '그 시각'} ${w}`;
}
