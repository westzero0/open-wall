// src/ui-state.js — the saved screen state (filters, sort, view, theme): defaults, cleaning old/broken values,
// load/save through an injected storage, and what the filters add up to (counts, labels, empty text). No DOM.
// What is on screen but not saved (picked moment, open row, position) is view-state.js.
import { normalizeAreas } from './areas.js';
import { sharePageUrl, wallShareId } from './share-id.js';

export const UI_KEY = 'open-wall:ui';
const DEFAULTS = { scrubHinted: false, minHours: '0', sun: 'any', parkingOnly: false, rentalOnly: false, withBreaks: false, sortMode: 'time', regions: [], venue: 'any', tempMin: '0', favOnly: false, theme: 'auto', textSize: 'normal', introDone: false, homeView: 'list' };
// keys of features this page no longer has (일정·기록 탭, 싱글피치, 주말 추천, 유형 테스트, 내 로프·어프로치): dropped on read, so the next save leaves them out
const GONE = ['tab', 'mode', 'schedView', 'hidePick', 'climberCardDone', 'climberFirstDay', 'ropeM', 'approachMax'];
// 화면: 자동 follows the phone; 라이트/다크 set html[data-theme] over prefers-color-scheme
export const cleanTheme = (v) => (['light', 'dark'].includes(v) ? v : 'auto');
// 글자 크기: html[data-text] scales the root font size (style.css), on top of the phone's own text-size setting
export const cleanTextSize = (v) => (['large', 'xlarge'].includes(v) ? v : 'normal');
// what "조건 지우기" resets (내 지역 has its own way back, 전국으로 보기; sort and 휴게 합산 stay)
export const CLEARED = Object.freeze({ sun: 'any', minHours: '0', parkingOnly: false, rentalOnly: false, venue: 'any', favOnly: false, tempMin: '0' });

const SUN_FILTERS = ['any', 'sun', 'shade'];
export const cleanSun = (v) => (SUN_FILTERS.includes(v) ? v : 'any');
const VENUE_FILTERS = ['any', 'indoor', 'outdoor'];
// Minimum stay: 상관없음 / 3 / 5 / 8 hours. Older saved choices (1h, 2h) map to the nearest sensible one.
const MIN_HOURS = ['0', '3', '5', '8'];
const migrateMinHours = (v) => ({ 1: '0', 2: '3' }[String(v)] ?? (MIN_HOURS.includes(String(v)) ? String(v) : '0'));

export const cleanVenue = (v) => (VENUE_FILTERS.includes(v) ? v : 'any');
// 홈 보기: 목록(list, 기본) ⇄ 지도(map). 넓은 화면은 둘을 나란히 두므로 이 값을 쓰지 않는다(app.js).
export const cleanHomeView = (v) => (v === 'map' ? 'map' : 'list');
// 기온 (°C at the arrival hour): outdoor walls below it go to the bottom of the open group, dimmed. '0' = off.
export const TEMP_CHOICES = ['0', '5', '10', '15'];
export const cleanTemp = (v) => (TEMP_CHOICES.includes(String(v)) ? String(v) : '0');
// Saved selection: 권역 names only (areas.js; an old "서울 동작구" becomes "서울"), no repeats, and (when the list is known) only 권역 that exist.
export function cleanRegions(v, known = null) {
  return normalizeAreas(v).filter((r) => !known || known.includes(r));
}

// The saved state over the defaults, every value checked. Bad JSON, no storage or a throwing one: defaults.
// Regions are pruned to the 권역 the walls are in later, once the list has loaded (cleanRegions with `known`).
export function loadUi(storage) {
  const ui = structuredClone(DEFAULTS);
  try {
    const saved = JSON.parse(storage.getItem(UI_KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) Object.assign(ui, saved);
  } catch { /* bad JSON or no storage: defaults */ }
  // `sun` used to be a sort preference ('sun'/'shade' first); the same values now mean the 양달/응달 filter.
  if (!SUN_FILTERS.includes(ui.sun)) ui.sun = 'any';
  ui.minHours = migrateMinHours(ui.minHours); // 1h/2h choices from before 3·5·8
  if (!['time', 'distance'].includes(ui.sortMode)) ui.sortMode = 'time'; // an old 'mygrade' (a crag-list order) too
  ui.scrubHinted = ui.scrubHinted === true; // the first-visit slider hint was seen (scrub-hint.js)
  ui.parkingOnly = ui.parkingOnly === true;
  ui.rentalOnly = ui.rentalOnly === true;
  ui.withBreaks = ui.withBreaks === true;
  ui.regions = cleanRegions(ui.regions);
  ui.venue = cleanVenue(ui.venue);
  ui.tempMin = cleanTemp(ui.tempMin);
  ui.favOnly = ui.favOnly === true;
  ui.homeView = ui.tab === 'map' ? 'map' : cleanHomeView(ui.homeView); // the old 지도 tab is now 홈's 지도 view
  ui.theme = cleanTheme(ui.theme);
  ui.textSize = cleanTextSize(ui.textSize);
  ui.introDone = ui.introDone === true; // the first-visit "how to read" card was closed
  for (const k of GONE) delete ui[k];
  return ui;
}

// A shared link shows its wall over the saved filters (in memory only). holdLinkView applies that view and returns what it
// replaced; saveUi writes the saved value back for every key the visitor has not changed since, so opening a link and then
// touching one control never wipes 내 지역 or the other saved filters.
export function holdLinkView(ui, patch) {
  const held = {};
  for (const k of Object.keys(patch)) held[k] = { saved: structuredClone(ui[k]), link: structuredClone(patch[k]) };
  Object.assign(ui, patch);
  return held;
}

export function saveUi(storage, ui, held = {}) {
  const out = { ...ui };
  for (const [k, h] of Object.entries(held)) if (JSON.stringify(ui[k]) === JSON.stringify(h.link)) out[k] = h.saved;
  try {
    storage.setItem(UI_KEY, JSON.stringify(out));
  } catch { /* storage full or blocked: keep in memory */ }
}

const regionLabel = (regions) =>
  (!regions?.length ? '' : regions.length === 1 ? `내 지역: ${regions[0]}` : `내 지역 ${regions.length}곳`);

// The filters that can hide open walls, by name.
const activeFilters = ({ sun, minHours, parkOnly, rentalOnly, venue, regions, favOnly }) =>
  [regionLabel(regions), venue === 'indoor' && '실내', venue === 'outdoor' && '실외',
    sun === 'sun' && '양달', sun === 'shade' && '응달', minHours !== '0' && `${minHours}시간+`, parkOnly && '주차 가능만', rentalOnly && '장비 대여만',
    favOnly && '즐겨찾기만'].filter(Boolean);

/**
 * filterView(ui, {canPark, openTotal, isNow}) → what the filter controls and the empty open group show.
 * canPark: some wall has parking data (else the stored 주차 가능만 is ignored, not deleted).
 * openTotal: walls open before the filters; isNow: the live clock (wording).
 */
export function filterView(ui, { canPark, canRent = false, openTotal, isNow }) {
  const parkOnly = ui.parkingOnly && canPark;
  const rentalOnly = ui.rentalOnly && canRent;
  const f = { sun: ui.sun, minHours: ui.minHours, parkOnly, rentalOnly, venue: ui.venue, regions: ui.regions, favOnly: ui.favOnly };
  const on = activeFilters(f);
  const label = regionLabel(ui.regions);
  return {
    parkOnly,
    rentalOnly,
    pressed: {
      parkingOnly: ui.parkingOnly, rentalOnly: ui.rentalOnly, withBreaks: ui.withBreaks, favOnly: ui.favOnly,
    },
    regionLabel: label,
    regionChipLabel: `${label} 해제, 전국 보기`,
    // the sheet button counts what only the sheet shows: 양달/응달 (the 해 row), 최소 이용 시간, 가까운 순, parking, 휴게 합산 while a minimum stay is on, 구분, 내 지역 (one), 즐겨찾기만, 기온, 내 로프 길이 (a setting: it hides no wall)
    sheetCount: Number(ui.minHours !== '0') + Number(ui.sortMode === 'distance') + Number(parkOnly) + Number(rentalOnly) + Number(ui.withBreaks && ui.minHours !== '0') + Number(ui.venue !== 'any') + Number(ui.regions.length > 0) + Number(Boolean(ui.favOnly)) + Number(Number(ui.tempMin) > 0) + Number(ui.sun !== 'any'),
    // why the open group is empty: nothing open at all, or the active filters hid the open ones
    emptyText: !openTotal || !on.length
      ? '아래 닫힌 곳에서 곳마다 다음 오픈 시간을 볼 수 있어요.'
      : `열린 곳 ${openTotal}곳 중 조건(${on.join(' · ')})에 맞는 곳이 없어요. 조건을 바꿔 보세요.`,
    // "전국으로 보기" when 내 지역 hid open walls; "조건 지우기" when another filter did
    national: openTotal > 0 && ui.regions.length > 0,
    clear: openTotal > 0 && activeFilters({ ...f, regions: [] }).length > 0,
  };
}

// Share link: the wall's static share page next to the app, w/<id>/ (no ?edit, no hash). The page carries the wall's own
// link preview (og tags, made at deploy) and sends the visitor on to ?wall=<name>, which is where wallFromSearch takes over.
// A crag (kind 'crag') has no share page: the app address with ?crag=<name> only, read back by cragFromSearch.
export function shareUrl(href, name, kind = 'wall', id = wallShareId(name)) { // id: the wall's stored id
  if (kind !== 'crag') return sharePageUrl(href, id).toString();
  const u = new URL(href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('crag', name);
  return u.toString();
}

/** does the link ask for the wall sheet's 게시판 tab (?wall=<name>&board)? */
export const boardRequested = (search) => new URLSearchParams(search).has('board');

/** ?tab=map (from the utility links) opens the old app on its map view: 'map' only for exactly that, else null. */
export const homeViewFromSearch = (search) => (new URLSearchParams(search).get('tab') === 'map' ? 'map' : null);

/** does the link ask for the wall's info sheet (?wall=<name>&info)? */
export const infoRequested = (search) => new URLSearchParams(search).has('info');

// The wall a share link names: exact (NFC) name match in the loaded list, else null. Never trusted beyond that.
// Old ?wall=<name> links still land here directly.
export function wallFromSearch(walls, search) {
  const name = new URLSearchParams(search).get('wall')?.normalize('NFC').trim();
  return name ? walls.find((w) => w.name.normalize('NFC') === name) ?? null : null;
}

/** plannerLink(plannerUrl, wallId) → the planner's "new plan at this wall" address (the wall sheet's 일정 잡기), or null when either is empty. */
export const plannerLink = (plannerUrl, wallId) =>
  (typeof plannerUrl === 'string' && plannerUrl && typeof wallId === 'string' && wallId ? `${plannerUrl}?new&wall=${encodeURIComponent(wallId)}` : null);
