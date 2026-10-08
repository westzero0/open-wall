// src/ui-state.js — the saved screen state (filters, sort, tab, theme): defaults, cleaning old/broken values,
// load/save through an injected storage, and what the filters add up to (counts, labels, empty text). No DOM.
// What is on screen but not saved (picked moment, open row, position) is view-state.js.

export const UI_KEY = 'open-wall:ui';
const DEFAULTS = { minHours: '0', sun: 'any', parkingOnly: false, withBreaks: false, sortMode: 'time', tab: 'list', regions: [], venue: 'any', favOnly: false, theme: 'auto' };
export const TABS = ['list', 'map', 'log'];
// 화면: 자동 follows the phone; 라이트/다크 set html[data-theme] over prefers-color-scheme
export const cleanTheme = (v) => (['light', 'dark'].includes(v) ? v : 'auto');
// what "조건 지우기" resets (내 지역 has its own way back, 전국으로 보기; sort and 휴게 합산 stay)
export const CLEARED = Object.freeze({ sun: 'any', minHours: '0', parkingOnly: false, venue: 'any', favOnly: false });

const SUN_FILTERS = ['any', 'sun', 'shade'];
const VENUE_FILTERS = ['any', 'indoor', 'outdoor'];
// Minimum stay: 상관없음 / 3 / 5 / 8 hours. Older saved choices (1h, 2h) map to the nearest sensible one.
const MIN_HOURS = ['0', '3', '5', '8'];
const migrateMinHours = (v) => ({ 1: '0', 2: '3' }[String(v)] ?? (MIN_HOURS.includes(String(v)) ? String(v) : '0'));

export const cleanVenue = (v) => (VENUE_FILTERS.includes(v) ? v : 'any');
// Saved selection: strings only, no repeats, and (when the list is known) only regions that exist.
export function cleanRegions(v, known = null) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((r) => typeof r === 'string' && (!known || known.includes(r))))];
}

// The saved state over the defaults, every value checked. Bad JSON, no storage or a throwing one: defaults.
// Regions are pruned to the walls' regions later, once the list has loaded (cleanRegions with `known`).
export function loadUi(storage) {
  const ui = structuredClone(DEFAULTS);
  try {
    const saved = JSON.parse(storage.getItem(UI_KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) Object.assign(ui, saved);
  } catch { /* bad JSON or no storage: defaults */ }
  // `sun` used to be a sort preference ('sun'/'shade' first); the same values now mean the 양달/응달 filter.
  if (!SUN_FILTERS.includes(ui.sun)) ui.sun = 'any';
  ui.minHours = migrateMinHours(ui.minHours); // 1h/2h choices from before 3·5·8
  if (!['time', 'distance'].includes(ui.sortMode)) ui.sortMode = 'time';
  ui.parkingOnly = ui.parkingOnly === true;
  ui.withBreaks = ui.withBreaks === true;
  ui.regions = cleanRegions(ui.regions);
  ui.venue = cleanVenue(ui.venue);
  ui.favOnly = ui.favOnly === true;
  if (!TABS.includes(ui.tab)) ui.tab = 'list';
  ui.theme = cleanTheme(ui.theme);
  return ui;
}

export function saveUi(storage, ui) {
  try {
    storage.setItem(UI_KEY, JSON.stringify(ui));
  } catch { /* storage full or blocked: keep in memory */ }
}

const regionLabel = (regions) =>
  (!regions?.length ? '' : regions.length === 1 ? `내 지역: ${regions[0]}` : `내 지역 ${regions.length}곳`);

// The filters that can hide open walls, by name.
const activeFilters = ({ sun, minHours, parkOnly, venue, regions, favOnly }) =>
  [regionLabel(regions), venue === 'indoor' && '실내', venue === 'outdoor' && '실외',
    sun === 'sun' && '양달', sun === 'shade' && '응달', minHours !== '0' && `${minHours}시간+`, parkOnly && '주차 가능만',
    favOnly && '즐겨찾기만'].filter(Boolean);

/**
 * filterView(ui, {canPark, openTotal, isNow}) → what the filter controls and the empty open group show.
 * canPark: some wall has parking data (else the stored 주차 가능만 is ignored, not deleted).
 * openTotal: walls open before the filters; isNow: the live clock (wording).
 */
export function filterView(ui, { canPark, openTotal, isNow }) {
  const parkOnly = ui.parkingOnly && canPark;
  const f = { sun: ui.sun, minHours: ui.minHours, parkOnly, venue: ui.venue, regions: ui.regions, favOnly: ui.favOnly };
  const on = activeFilters(f);
  const label = regionLabel(ui.regions);
  return {
    parkOnly,
    pressed: {
      sunOnly: ui.sun === 'sun', shadeOnly: ui.sun === 'shade', longOnly: ui.minHours !== '0',
      nearFirst: ui.sortMode === 'distance', parkingOnly: ui.parkingOnly, withBreaks: ui.withBreaks, favOnly: ui.favOnly,
    },
    longLabel: `${ui.minHours === '0' ? '3' : ui.minHours}시간+`, // the chip and the sheet share one value
    regionLabel: label,
    regionChipLabel: `${label} 해제, 전국 보기`,
    // the sheet button counts what only the sheet shows: parking, 휴게 합산 while a minimum stay is on, 구분, 내 지역 (one), 즐겨찾기만
    sheetCount: Number(parkOnly) + Number(ui.withBreaks && ui.minHours !== '0') + Number(ui.venue !== 'any') + Number(ui.regions.length > 0) + Number(Boolean(ui.favOnly)),
    // why the open group is empty: nothing open at all, or the active filters hid the open ones
    emptyText: !openTotal || !on.length
      ? `${isNow ? '지금' : '이 시각에'} 열려 있는 곳이 없어요. 아래 닫힌 곳에서 다음 오픈 시간을 확인해 보세요.`
      : `열린 곳 ${openTotal}곳 중 조건(${on.join(' · ')})에 맞는 곳이 없어요. 조건을 바꿔 보세요.`,
    // "전국으로 보기" when 내 지역 hid open walls; "조건 지우기" when another filter did
    national: openTotal > 0 && ui.regions.length > 0,
    clear: openTotal > 0 && activeFilters({ ...f, regions: [] }).length > 0,
  };
}

// Share link: the page's own address with just ?wall=<name> (no ?edit, no hash). Names are the wall identity.
export function shareUrl(href, name) {
  const u = new URL(href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('wall', name);
  return u.toString();
}

// The wall a share link names: exact (NFC) name match in the loaded list, else null. Never trusted beyond that.
export function wallFromSearch(walls, search) {
  const name = new URLSearchParams(search).get('wall')?.normalize('NFC').trim();
  return name ? walls.find((w) => w.name.normalize('NFC') === name) ?? null : null;
}
