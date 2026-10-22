// src/ui-state.js — the saved screen state (filters, sort, tab, theme): defaults, cleaning old/broken values,
// load/save through an injected storage, and what the filters add up to (counts, labels, empty text). No DOM.
// What is on screen but not saved (picked moment, open row, position) is view-state.js.
import { normalizeAreas } from './areas.js';
import { sharePageUrl } from './share-id.js';

export const UI_KEY = 'open-wall:ui';
const DEFAULTS = { minHours: '0', sun: 'any', parkingOnly: false, rentalOnly: false, withBreaks: false, sortMode: 'time', tab: 'list', regions: [], hidePick: false, venue: 'any', ropeM: '0', approachMax: '0', tempMin: '0', favOnly: false, theme: 'auto', textSize: 'normal', climberCardDone: false, climberFirstDay: '', introDone: false, mode: 'wall' };
export const TABS = ['list', 'map', 'log'];
// 화면: 자동 follows the phone; 라이트/다크 set html[data-theme] over prefers-color-scheme
export const cleanTheme = (v) => (['light', 'dark'].includes(v) ? v : 'auto');
// 글자 크기: html[data-text] scales the root font size (style.css), on top of the phone's own text-size setting
export const cleanTextSize = (v) => (['large', 'xlarge'].includes(v) ? v : 'normal');
// what "조건 지우기" resets (내 지역 has its own way back, 전국으로 보기; sort and 휴게 합산 stay)
export const CLEARED = Object.freeze({ sun: 'any', minHours: '0', parkingOnly: false, rentalOnly: false, venue: 'any', favOnly: false, tempMin: '0' });

const SUN_FILTERS = ['any', 'sun', 'shade'];
const VENUE_FILTERS = ['any', 'indoor', 'outdoor'];
// Minimum stay: 상관없음 / 3 / 5 / 8 hours. Older saved choices (1h, 2h) map to the nearest sensible one.
const MIN_HOURS = ['0', '3', '5', '8'];
const migrateMinHours = (v) => ({ 1: '0', 2: '3' }[String(v)] ?? (MIN_HOURS.includes(String(v)) ? String(v) : '0'));

export const cleanVenue = (v) => (VENUE_FILTERS.includes(v) ? v : 'any');
// 보기 종류: 외벽(wall)과 싱글피치(crag). 헤더 토글이 고르고 기기에 저장한다(싱글피치는 config.singlePitch가 켜진 동안만 쓰인다).
export const MODES = ['wall', 'crag'];
export const cleanMode = (v) => (MODES.includes(v) ? v : 'wall');
// 저장된 값이 crag여도 스위치가 꺼졌거나 불러온 암장이 없으면 외벽을 보여 준다(빈 화면이 되지 않게).
export const effectiveMode = (mode, { enabled, count }) => (mode === 'crag' && enabled && count > 0 ? 'crag' : 'wall');
// 내 로프 길이 (not a filter: it only tells the card whether the wall's height fits). '0' = not set.
export const ROPE_CHOICES = ['0', '40', '45', '50', '60', '70'];
// 기온 (°C at the arrival hour): outdoor walls below it go to the bottom of the open group, dimmed. '0' = off.
export const TEMP_CHOICES = ['0', '5', '10', '15'];
export const cleanTemp = (v) => (TEMP_CHOICES.includes(String(v)) ? String(v) : '0');
export const cleanRope = (v) => (ROPE_CHOICES.includes(String(v)) ? String(v) : '0');
// 어프로치 도보 (싱글피치만): 걸어 들어가는 분이 이보다 긴 암장을 목록에서 뺀다(분을 모르는 곳은 남긴다). '0' = 안 정함.
export const APPROACH_CHOICES = ['0', '10', '20', '30'];
export const cleanApproach = (v) => (APPROACH_CHOICES.includes(String(v)) ? String(v) : '0');
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
  if (!['time', 'distance', 'mygrade'].includes(ui.sortMode)) ui.sortMode = 'time';
  ui.parkingOnly = ui.parkingOnly === true;
  ui.rentalOnly = ui.rentalOnly === true;
  ui.withBreaks = ui.withBreaks === true;
  ui.regions = cleanRegions(ui.regions);
  ui.hidePick = ui.hidePick === true; // 이번 주말 추천 turned off in 내 정보
  ui.venue = cleanVenue(ui.venue);
  ui.ropeM = cleanRope(ui.ropeM);
  ui.approachMax = cleanApproach(ui.approachMax);
  ui.tempMin = cleanTemp(ui.tempMin);
  ui.mode = cleanMode(ui.mode);
  ui.favOnly = ui.favOnly === true;
  if (!TABS.includes(ui.tab)) ui.tab = 'list';
  ui.theme = cleanTheme(ui.theme);
  ui.textSize = cleanTextSize(ui.textSize);
  ui.climberCardDone = ui.climberCardDone === true; // the 클라이머 유형 테스트 intro card was closed
  ui.climberFirstDay = /^\d{4}-\d{2}-\d{2}$/.test(ui.climberFirstDay) ? ui.climberFirstDay : ''; // the day the app was first opened with the test on
  ui.introDone = ui.introDone === true; // the first-visit "how to read" card was closed
  return ui;
}

/** climberCardDue(ui, today, hasResult) → bool: the 클라이머 테스트 intro card shows from the first visit *after* the first day (a reload is not a second visit), until closed or the test is taken. */
export const climberCardDue = (ui, today, hasResult) => !ui.climberCardDone && !hasResult && ui.climberFirstDay !== '' && ui.climberFirstDay < today;

export function saveUi(storage, ui) {
  try {
    storage.setItem(UI_KEY, JSON.stringify(ui));
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
      sunOnly: ui.sun === 'sun', shadeOnly: ui.sun === 'shade',
      parkingOnly: ui.parkingOnly, rentalOnly: ui.rentalOnly, withBreaks: ui.withBreaks, favOnly: ui.favOnly,
    },
    regionLabel: label,
    regionChipLabel: `${label} 해제, 전국 보기`,
    // the sheet button counts what only the sheet shows: 최소 이용 시간, 가까운 순, parking, 휴게 합산 while a minimum stay is on, 구분, 내 지역 (one), 즐겨찾기만, 기온, 내 로프 길이 (a setting: it hides no wall)
    sheetCount: Number(ui.minHours !== '0') + Number(ui.sortMode === 'distance' || ui.sortMode === 'mygrade') + Number(parkOnly) + Number(rentalOnly) + Number(ui.withBreaks && ui.minHours !== '0') + Number(ui.venue !== 'any') + Number(ui.regions.length > 0) + Number(Boolean(ui.favOnly)) + Number(Number(ui.tempMin) > 0) + Number(Number(ui.ropeM) > 0),
    // why the open group is empty: nothing open at all, or the active filters hid the open ones
    emptyText: !openTotal || !on.length
      ? `${isNow ? '지금' : '이 시각에'} 열려 있는 곳이 없어요. 아래 닫힌 곳에서 다음 오픈 시간을 확인해 보세요.`
      : `열린 곳 ${openTotal}곳 중 조건(${on.join(' · ')})에 맞는 곳이 없어요. 조건을 바꿔 보세요.`,
    // "전국으로 보기" when 내 지역 hid open walls; "조건 지우기" when another filter did
    national: openTotal > 0 && ui.regions.length > 0,
    clear: openTotal > 0 && activeFilters({ ...f, regions: [] }).length > 0,
  };
}

/**
 * cragFilterView(ui, { hasGrade, query }) → the 싱글피치 list's 조건 count and empty-box buttons: only what cragList uses.
 * sheetCount: the sheet's own (가까운 순 / 내 그레이드 루트 많은 순 with a 내 그레이드, 내 지역, 즐겨찾기만, 내 로프 길이, 어프로치 도보 — cragList drops crags by the last two); 양달/응달 and the search sit outside the sheet, as for walls.
 * national: 내 지역 narrows the list (전국으로 보기). clear: 양달/응달, the search, 즐겨찾기만, a set 내 로프 길이 or 어프로치 도보 narrows it (조건 지우기 clears those five).
 */
export function cragFilterView(ui, { hasGrade = false, query = '' } = {}) {
  return {
    sheetCount: Number(ui.sortMode === 'distance' || (ui.sortMode === 'mygrade' && hasGrade)) + Number(ui.regions.length > 0) + Number(Boolean(ui.favOnly)) + Number(Number(ui.ropeM) > 0) + Number(Number(ui.approachMax) > 0),
    national: ui.regions.length > 0,
    clear: ui.sun !== 'any' || Boolean(ui.favOnly) || Number(ui.ropeM) > 0 || Number(ui.approachMax) > 0 || query.trim() !== '',
  };
}

// Share link: the wall's static share page next to the app, w/<id>/ (no ?edit, no hash). The page carries the wall's own
// link preview (og tags, made at deploy) and sends the visitor on to ?wall=<name>, which is where wallFromSearch takes over.
// A crag (kind 'crag') has no share page: the app address with ?crag=<name> only, read back by cragFromSearch.
export function shareUrl(href, name, kind = 'wall') {
  if (kind !== 'crag') return sharePageUrl(href, name).toString();
  const u = new URL(href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('crag', name);
  return u.toString();
}

/** does the link ask for the wall sheet's 게시판 tab (?wall=<name>&board)? */
export const boardRequested = (search) => new URLSearchParams(search).has('board');

/** does the link ask for the wall's info sheet (?wall=<name>&info)? */
export const infoRequested = (search) => new URLSearchParams(search).has('info');

// The wall a share link names: exact (NFC) name match in the loaded list, else null. Never trusted beyond that.
// Old ?wall=<name> links still land here directly.
export function wallFromSearch(walls, search) {
  const name = new URLSearchParams(search).get('wall')?.normalize('NFC').trim();
  return name ? walls.find((w) => w.name.normalize('NFC') === name) ?? null : null;
}

/** The crag a ?crag=<name> link names: exact (NFC) name match in the loaded crags, else null (wallFromSearch's shape). */
export function cragFromSearch(crags, search) {
  const name = new URLSearchParams(search).get('crag')?.normalize('NFC').trim();
  return name ? crags.find((c) => c.name.normalize('NFC') === name) ?? null : null;
}
