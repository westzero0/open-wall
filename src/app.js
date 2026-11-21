import './dialog-back.js';
import { buildList } from './listing.js';
import { DAY_KO, hhmm, isNight, ymd } from './time.js';
import { fetchNational, loadWalls } from './store.js';
import { state, storage, onChange } from './state.js';
import { config, boardOn, tapOn, fillOn, contactOn, plannerOn } from './config.js';
import { idByName } from './share-id.js';
import { safeStorage, getStr, setStr } from './storage.js';
import { addPoint, loadPoints, savePoints } from './points.js';
import { idOf, nameOf, setWalls } from './wall-ids.js';
import { getAuthorId } from './author-id.js';
import { getJson, getText } from './remote.js';
import { wxCache } from './wx-cache.js';
import { createMap } from './map.js';
import { dialModel, sunWordOf } from './dial.js';
import { dayWindow, sunPosition } from './sun.js';
import { chipOf, fcChip, WX_WORD } from './wx-chip.js';
import { sceneTone } from './sun-scene.js';
import { getStatus, hasHours, inWinter, openIntervals } from './hours.js';
import { isHoliday } from './holidays.js';
import { buildTap, bumpTapCount, loadTapped, saveTapped, shownFromIntervals, tappedKey } from './tap.js';
import { createTapApi } from './tap-api.js';
import { tapRow } from './tap-view.js';
import { AXIS_LABELS, DAYPARTS, axisFrac, axisHourAt, barSegments, dayLine, dayText, filterRows, fmtMin, formatRanges, groupRows, hasParking, hasRental, mapPins, NTH_KO, scopeRows, searchPicks, seasonSun, shortName, sortRows, stepMinute, summaryLead, summaryParts, askText, planWxLine, whenText, groupWeekRows, timeLabel, wallPosition, weeklyHours, winterSpan, withDistance } from './viewmodel.js';
import { cardModel, entryFee, feeTable, shortenDates } from './card-model.js';
import { NOTE_MAX } from './parking-rate.js';
import { feeTableEl } from './fee-table-view.js';
import { loadFavs, saveFavs, toggleFav } from './favorites.js';
import { syncFound, weekChanges } from './changes.js';
import { loadSeen, markSeen, recordFirstSeen, saveSeen, settingChanged } from './setting.js';
import { createContactView } from './contact-view.js';
import { CLEARED, plannerLink, cleanRegions, cleanTemp, cleanTextSize, cleanTheme, cleanVenue, filterView, holdLinkView, loadUi, saveUi as storeUi, shareUrl, wallFromSearch, boardRequested, homeViewFromSearch } from './ui-state.js';
import { clockView, startView, step } from './view-state.js';
import { areaList } from './areas.js';
import { mountScrubHint } from './scrub-hint.js';
import { crossfadeRows, el, tightParens } from './dom.js';
import { homeDays } from './trips.js';

// the picked day is shown by the day chips (drawDays) in the time box's first line; there is no separate date text
function setSub(at) {
  drawDays(at);
}
// 날짜 칩 오늘·내일·주말 (trips.js homeDays without its trips and its '+ 일정 잡기' chip). Made again only when the day turns, so the minute re-render keeps the focus.
let daysFor = '';
let finderReady = false; // placeFinder runs once start-up has built the page
let bandRO = null; // ResizeObserver on the sort band
function drawDays(at) {
  const box = $('scrubDays');
  if (!box) return; // a cached older page
  const today = ymd(new Date());
  if (daysFor !== today) {
    daysFor = today;
    box.replaceChildren(...homeDays(today).filter((c) => !c.add).map(({ label, date }) => {
      const [, m, d] = date.split('-').map(Number);
      const b = el('button', { type: 'button', 'data-date': date, 'aria-label': `${label} ${m}월 ${d}일` }, label);
      b.addEventListener('click', () => go({ type: 'pick', date, min: Math.min(Number($('time').value), 1380) })); // the same time on that day
      return b;
    }));
  }
  for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.date === ymd(at)));
}
import { arrow, wxBox, axisX, boardRow, cameraBtn, goRow, infoRow, noticeLine, setBoardRow, telButton, capCls, chipBar, dock, gaugeBar, gaugeEnds, heroCap, placeholderHero, remainPill, reserveBand, sheetCard, sheetLine, span, warnNote, warnPill, whyBubble, wxSet } from './card-parts.js';
import { startTour } from './tour.js';
import { toast } from './log-view.js';
import { applyTextSize, applyTheme } from './profile-view.js';
import { buildLabel } from './build-label.js';
import { aggregate, parseCrowdCsv } from './crowd.js';
import { CURRENT_MS, RAIN_MM, belowTempMin, countWx, sinkBad, dayKey, dayWeather, forecastTrusted, forecastUrl, listForecastUrl, parseCurrent, parseDaily, parseForecast, parseListForecast, pickHour, hoursAhead, skyKind, weatherFresh, weekendForecastUrl, windy, rowWeather, wxKind, skyVeils } from './weather.js';
import { boardBox } from './board-view.js';
import { createBoardApi } from './board-api.js';
import { agoText, warningOf } from './closure-warning.js';
import { createFillApi } from './fill-api.js';
import { applyFills } from './fill-fields.js';
import { fillRows } from './fill-view.js';
import { addFillSent } from './fill-store.js';
import { NICK_KEY, loadNick } from './report.js';
import { createBoardNotice } from './board-summary.js';
import { openWallSheet, registerWallSheet, updateWallHead, segmentPane } from './wall-sheet.js';
import { tagGapMin, estimatePlotPx } from './axis-gap.js';
import { sheetModel, TAB_KINDS } from './wall-sheet-model.js';
import { overviewSection } from './overview-view.js';
import { loadPartners, nearGear, gearLine } from './gear.js';
import { gearBody } from './gear-view.js';
import { routeView } from './routes.js';
import { loadMyGrade } from './my-grade.js';
import { openGallery } from './gallery-view.js';
import { closeInApp, closeInstall, entryHref, externalOpenUrl, fromKakao, howtoDue, inAppClosed, installClosed, isKakaoInApp } from './inapp.js';
import { currentInstallMode, promptInstall } from './install.js';
import { openStateText } from './home-arrive.js';

const $ = (id) => document.getElementById(id);
let loadFailed = false;


// Inline icons on a 24px grid, drawn in the text colour; the button or link around one carries its name.
const ICONS = {
  share: ['M12 3v12', 'M8 7l4-4 4 4', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7'],
  nav: ['M3 11L22 2l-9 19-2-8-8-2z'],
  check: ['M5 12l5 5 9-10'],
  close: ['M6 6l12 12', 'M18 6L6 18'], // the sheets' close
  stamp: ['M5 22h14', 'M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77', 'M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-3-3c-1.66 0-3 1-3 3s1 2 1 3.5V13'],
  download: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'], // 싱글피치 카드: 길 사진을 기기에 저장
  // 싱글피치 어프로치 시트의 방향(approach_steps[].turn): 왼쪽·오른쪽 꺾기, 직진, 오르막, 내리막
  'turn-left': ['M9 14 4 9l5-5', 'M20 20v-7a4 4 0 0 0-4-4H4'],
  'turn-right': ['m15 14 5-5-5-5', 'M4 20v-7a4 4 0 0 1 4-4h12'],
  'turn-straight': ['M12 19V5', 'm5 12 7-7 7 7'],
  'turn-up': ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'],
  'turn-down': ['M22 17 13.5 8.5 8.5 13.5 2 7', 'M16 17h6v-6'],
  megaphone: ['M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 6a9 9 0 0 1 0 12'],
  chat: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
  camera: ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z', 'M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'],
  'camera-plus': ['M14.5 5h-5L7 8H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4', 'M11 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19 1v6', 'M16 4h6'],
  'camera-swap': ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z', 'M15.4 11.2A3.5 3.5 0 0 0 9 12.3', 'M9 9.9v2.4h2.4', 'M8.6 15.6A3.5 3.5 0 0 0 15 14.5', 'M15 16.9v-2.4h-2.4'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  sort: ['M7 4v16', 'M3 16l4 4 4-4', 'M17 20V4', 'M13 8l4-4 4 4'], // ⇅: the list's order, on its own button
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  'sky-partly': ['M12 2v2', 'm4.93 4.93 1.41 1.41', 'M20 12h2', 'm19.07 4.93-1.41 1.41', 'M15.947 12.65a4 4 0 0 0-5.925-4.128', 'M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z'],
  'sky-cloud': ['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'],
  'sky-fog': ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M16 17H7', 'M17 21H9'],
  'sky-rain': ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M16 14v6', 'M8 14v6', 'M12 16v6'],
  'sky-snow': ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M8 15h.01', 'M8 19h.01', 'M12 17h.01', 'M12 21h.01', 'M16 15h.01', 'M16 19h.01'],
  snow: ['M2 12h20', 'M12 2v20', 'm20 16-4-4 4-4', 'm4 8 4 4-4 4', 'm16 4-4 4-4-4', 'm8 20 4-4 4 4'], // a snowflake: 눈 as the chip's picture (the cloud with dots, sky-snow, is the sun picture's sky)
  'thermo-hot': ['M12 9a4 4 0 0 0-2 7.5', 'M12 3v2', 'm6.6 18.4-1.4 1.4', 'M20 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z', 'M4 13H2', 'M6.34 7.34 4.93 5.93'], // 폭염: the chip's picture
  'thermo-cold': ['M20 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z', 'M7 3v8', 'm3.54 5 6.92 4', 'm3.54 9 6.92-4'], // 한파
  'sky-storm': ['M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973', 'm13 12-3 5h4l-3 5'],
  heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  car: ['M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2', 'M9 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z', 'M9 17h6', 'M19 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'], // the 주차 chip
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  external: ['M15 3h6v6', 'M10 14L21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'], // a link that leaves the app (the blog reviews)
  pencil: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'], // 정보 수정 요청
  calendar: ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18'],
  ticket: ['M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z', 'M13 5v2', 'M13 11v2', 'M13 17v2'],
  wind: ['M17.5 8a2.5 2.5 0 1 1 2 4H2', 'M12.8 19.6A2 2 0 1 0 14 16H2'], // the 컨디션 tab's gust pill
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'], // the wall sheet's tabs: 시간 (this), 이용 (ticket), 루트 (route), 게시판 (chat)
  route: ['M3 19l6-10 4 6 3-4 5 8z'],
  walk: ['M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0z', 'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0z', 'M16 17h4', 'M4 13h4'], // footprints: the 접근로 row's walking time
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'], // ! in a triangle: my rope is too short for the wall (the rope chip)
  map: ['M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z', 'M15 5.764v15', 'M9 3.236v15'],
  gear: ['m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7', 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4', 'M2 7h20', 'M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7'], // a shopfront with an awning: the kind 장비점 (the 스토어 link has the bag)
  carabiner: ['M14.33 16.03 18.01 12.35A4.5 4.5 0 0 0 11.65 5.99L5.99 11.65A4.5 4.5 0 0 0 12.35 18.01L13.4 17'], // 장비 대여 칩: an open-gate carabiner
  bag: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'], // 근처 장비점 sheet: 지도 / 스토어
  copy: ['M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  // 양달 / 응달: a sun with rays; the same sun struck through. Same pair as the invitation picture (src/share-image.js drawIcon).
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  // 방향 모름: a ring drawn dashed by CSS (the first path) with a question mark; 실내: a roof over walls (no sun matters indoors)
  unknown: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8', 'M12 17h.01'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  indoor: ['M3 12l9-9 9 9', 'M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'], // 일정 탭: 목록 보기 (달력 보기는 calendar)
  shade: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M3 21L21 3'],
};
// a glyph drawn small in its 24 grid (the megaphone is 18 x 12) is cut closer so it reads as big as its neighbours; the stroke is thinned by the same factor
const ICON_BOX = { megaphone: { box: '1.8 1.8 20.4 20.4', stroke: '1.7' } };
function icon(name, filled = false) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const cut = ICON_BOX[name];
  for (const [k, v] of Object.entries({ viewBox: cut?.box ?? '0 0 24 24', fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': cut?.stroke ?? '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  for (const d of ICONS[name]) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

// The weather chip at the front of a list row (card-parts wxSet): the weather as one neutral picture, the temperature under it. The 양달/응달 lives in the wall sheet's 시간 탭.
// c: wx-chip chipOf's result (the 외벽 row), or a {t, kind} forecast (the 싱글피치 row passes its own through deps).
function sunChip(_sun, c = null) {
  return wxSet(c?.pic ? c : fcChip(c), { icon });
}

// ---- UI state: filters persist in localStorage (ui-state.js), location stays in memory ----
const ui = loadUi(storage); // regions are pruned to existing ones once the list loads (syncRegions)
let linkHeld = {}; // what a shared link's view replaced (holdLinkView): saved back until the visitor changes it
const saveUi = () => storeUi(storage, ui, linkHeld);
// the headline: strong pieces (time, count) are <b>; a count of 0 is muted (style.css #summary b.zero)
const drawSummary = (parts) => {
  $('summary').classList.toggle('none', parts.every(([, strong]) => !strong)); // nothing to count (0곳): the whole headline is muted
  const lead = parts[0][1] && parts.length > 1 ? parts[0][0] : null; // the picked time shows in the box's question line (#timeOut); the visible answer is only "갈 수 있는 외벽 N곳", screen readers still hear the time
  const draw = ([t, strong, small], i) => (small ? [' ', el('small', {}, t)] : strong ? el('b', { class: i === 2 && t.startsWith('0') ? 'zero' : null }, t) : t);
  $('summary').replaceChildren(...(lead ? [el('span', { class: 'sr-only' }, `${lead} `)] : []), ...parts.flatMap((p, i) => (lead && i === 0 ? [] : lead && i === 1 ? draw([p[0].replace(/^ · /, ''), p[1], p[2]], i) : draw(p, i))));
};
let showHowtoAuto = () => {}; // set by the 화면 읽는 법 block below; render() calls it, so it must exist before the first render
let theme; // what applyTheme last got: 자동 turns 'dark' from 23:00 to 08:00 (src/boot-theme.js does the same for the first paint)
function syncTheme() {
  const next = ui.theme === 'auto' && isNight(new Date()) ? 'dark' : ui.theme; // the real clock, not the picked moment
  if (next !== theme) applyTheme((theme = next));
}
syncTheme();
applyTextSize(ui.textSize);
/// 화면 · 글자 크기 (설정 sheet, 머리 톱니): saved as they are picked, in open-wall:ui as before
const settingsSheet = $('settings-sheet');
const settingsForm = settingsSheet.querySelector('form');
settingsForm.addEventListener('change', (e) => {
  if (e.target.name === 'theme') { ui.theme = cleanTheme(e.target.value); saveUi(); syncTheme(); }
  if (e.target.name === 'textSize') { ui.textSize = cleanTextSize(e.target.value); saveUi(); applyTextSize(ui.textSize); }
});
let settingsOpener = null;
settingsSheet.addEventListener('close', () => settingsOpener?.focus());
// 홈 화면에 추가 row: re-read the install mode each time the sheet opens (hidden when already installed / not possible)
let setInstallMode = 'none';
$('set-install-go')?.addEventListener('click', async () => {
  if (setInstallMode === 'inapp') { location.href = externalOpenUrl(entryHref); return; }
  if (setInstallMode === 'prompt' && await promptInstall()) {
    $('set-install').hidden = true; closeInstall();
    const bn = $('install-banner'); if (bn) bn.hidden = true;
  }
});
const fillInstallRow = () => {
  const row = $('set-install'); if (!row) return;
  setInstallMode = currentInstallMode();
  const go = $('set-install-go');
  const copy = { prompt: ['앱처럼 바로 열려요.', '홈 화면에 추가'], ios: ['공유 버튼 ▸ ‘홈 화면에 추가’를 누르세요.', ''], android: ['⋮ 메뉴 ▸ ‘홈 화면에 추가’를 누르세요.', ''], inapp: ['카카오톡 안에서는 추가할 수 없어요.', '기본 브라우저로 열기'] }[setInstallMode];
  row.hidden = !copy;
  if (!copy) return;
  $('set-install-text').textContent = copy[0];
  go.textContent = copy[1]; go.hidden = !copy[1];
};
const openSettings = (from) => { settingsOpener = from; settingsForm.elements.theme.value = ui.theme; settingsForm.elements.textSize.value = ui.textSize; fillInstallRow(); settingsSheet.showModal(); };
$('settingsBtn')?.addEventListener('click', (e) => openSettings(e.currentTarget));
// 앱 정보 sheet: opened from the footer (and 내 정보); focus returns to whatever opened it
const about = $('about-sheet');
let aboutOpener = null;
about.addEventListener('close', () => aboutOpener?.focus());
const openAbout = (from) => { aboutOpener = from; about.showModal(); };
$('aboutOpen')?.addEventListener('click', (e) => openAbout(e.currentTarget));
{ const build = buildLabel(); if (build && config.stage === 'beta') { $('foot-build-id').textContent = build; $('foot-build').hidden = false; } } // stamped by the deploy; a dev copy has none
if (config.points) { // 참여 포인트 적립: 글(+10)·제보(+15)가 성공으로 나갈 때 쌓는다(기존 성공 이벤트만 구독, 제출 로직은 그대로). 랭킹은 나중.
  const earn = (src) => {
    const store = safeStorage();
    if (!store) return; // 막힌 저장소: 이번 방문엔 못 쌓는다
    const id = crypto.randomUUID?.() ?? `p${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    savePoints(store, addPoint(loadPoints(store), src, { id, at: ymd(new Date()) }));
  };
  document.addEventListener('stats:report-send', () => earn('report'));
  document.addEventListener('stats:board-post', () => earn('board'));
}
// ---- view state (view-state.js): the picked moment / live clock, the open row and its folds, the position ----
// Every change goes through go(event): view-state.js decides the next state and the follow-ups, run here in order.
let vs = startView(new Date());
const FX = {
  render: () => render(),
  crowd: () => loadCrowd(),
  sortDistance: () => {
    ui.sortMode = 'distance';
    saveUi();
  },
  setUser: () => mapApi?.setUser(vs.origin),
};
function go(ev) {
  const r = step(vs, ev, new Date());
  vs = r.vs;
  for (const f of r.fx) FX[f]();
  return r.fx;
}
let partners = { info: [], sponsored: [] }; // data/partners.json (src/gear.js); the 근처 장비점 line of a card and its sheet
let allRows = []; // last built rows before any filter: the 내 암장 strip shows a favorite whatever the filters hide
let shown = { rows: [], at: null }; // last rendered rows (all groups, with distance) for the map
let mapApi = null; // created the first time the map tab opens
let mapFailed = false;

// ---- card ----
// Every value below comes from cardModel (card-model.js); these functions only draw it.
// 입장 유료/무료 as a ticket icon + the one word (the full phrase stays for screen readers); 무료 in the accent colour

// 길찾기 · 공지 · 전화 …: one hairline strip of icon + word cells (flat like the list rows, no pills); 길찾기 first
const LINK_ICON = { 길찾기: 'nav', '공지 보기': 'megaphone', 예약: 'calendar', 오픈채팅: 'chat', 전화: 'phone' };
const LINK_WORD = { '공지 보기': '공지' }; // the cell says the short word (the link's own label keeps the long one for the model and the picker)
// 길찾기: the first tap asks which map app (the web cannot see what is installed); the pick is remembered, later taps open it directly.
const NAV_KEY = 'open-wall:nav-app';
const navPref = () => getStr(NAV_KEY);
function openNav(choice, copyText, nav, choices) {
  setStr(NAV_KEY, choice.id); // private mode: asks again next time
  window.open(choice.href, '_blank', 'noopener,noreferrer');
  if (copyText) navigator.clipboard?.writeText(copyText).catch(() => {});
  toast(`${choice.label} 열었어요${copyText ? ' · 주소도 복사했어요' : ''}`, nav ? () => pickNav(nav, choices, copyText) : null, nav ? '바꾸기' : null);
}
// the one 주소 복사 toast (길찾기 앱 chooser, the sheet's route row and the row card all say the same thing)
const copyAddress = (text) => navigator.clipboard?.writeText(text ?? '').then(() => toast('주소를 복사했어요 · 길찾기 앱에서 붙여 넣으세요'), () => {});
function pickNav(nav, choices, copyText, ask = null) { // ask: the cell's word (공지, 전화): plain links to pick from, nothing remembered or copied
  nav.parentElement.querySelector('.nav-pick')?.remove();
  const btn = (text, run, cls = null) => {
    const b = el('button', { type: 'button', ...(cls ? { class: cls } : {}) }, text);
    b.addEventListener('click', () => { panel.remove(); run(); });
    return b;
  };
  const panel = el('div', { class: 'nav-pick', role: 'group', 'aria-label': ask ? `${ask} 고르기` : '길찾기 앱 고르기' },
    ...choices.map((c) => btn(c.label, () => (ask ? (c.href.startsWith('tel:') ? location.assign(c.href) : window.open(c.href, '_blank', 'noopener,noreferrer')) : openNav(c, copyText, nav, choices)))),
    ask ? null : btn('주소 복사', () => copyAddress(copyText), 'plain'));
  nav.after(panel);
  panel.firstChild.focus();
  const off = (e) => { if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener('click', off, true); } };
  setTimeout(() => document.addEventListener('click', off, true));
}
// 길찾기 (the map link, not 공지 / 전화): a small dialog titled with the address, "지도에서 보기" (Android: a geo: link, so the phone lists only the map apps it
// has, and opens the only one at once; iPhone: Apple Maps; elsewhere the remembered app, else the first) and "복사"; "다른 지도 앱으로" lists the apps.
function openNavDialog(choices, copyText, geo) {
  const dlg = el('dialog', { class: 'nav-dlg', 'aria-label': '길찾기' });
  const close = () => { dlg.close(); dlg.remove(); };
  const row = (text, run, extra = null) => {
    const b = el('button', { type: 'button', class: 'nd-opt' }, el('span', {}, text), extra);
    b.addEventListener('click', () => { close(); run(); });
    return b;
  };
  const q = geo ? `${geo.lat},${geo.lng}` : null;
  const place = q ? `geo:${q}?q=${q}(${encodeURIComponent(geo.name)})` : `geo:0,0?q=${encodeURIComponent(copyText ?? '')}`;
  const apple = `https://maps.apple.com/?${q ? `ll=${q}&` : ''}q=${encodeURIComponent(q ? geo.name : copyText ?? '')}`;
  const android = /Android/i.test(navigator.userAgent), ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const view = () => {
    if (android) return location.assign(place);
    if (ios) return location.assign(apple);
    const mine = choices.find((c) => c.id === navPref()) ?? choices[0];
    if (mine) window.open(mine.href, '_blank', 'noopener,noreferrer');
  };
  const copy = () => copyAddress(copyText);
  const list = el('div', { class: 'nd-list' });
  const main = () => {
    list.replaceChildren(row('지도에서 보기', view), row('복사', copy),
      (() => { const m = el('button', { type: 'button', class: 'nd-more' }, el('span', {}, '다른 지도 앱으로'), el('span', { 'aria-hidden': 'true' }, '›')); m.addEventListener('click', apps); return m; })());
  };
  const apps = () => {
    list.replaceChildren(...choices.map((c) => row(c.label, () => openNav(c, copyText, null, choices), c.id === navPref() ? el('em', { class: 'nd-def' }, '기본') : null)), row('주소 복사', copy));
    list.firstChild?.focus();
  };
  dlg.append(el('h3', { class: 'nd-title' }, copyText || '주소 정보가 없어요'), list);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => dlg.remove());
  main();
  document.body.append(dlg);
  dlg.showModal();
}
// 길찾기 as a dock button: the link strip's cell without the strip (the same map-app dialog, remembered app and address copy)
function navButton(link, copyText, geo) {
  const a = el('a', { class: 'dock-go', href: link.href, target: '_blank', rel: 'noopener noreferrer' }, icon('pin'), el('span', {}, '길찾기')); // the card's main action: a labelled pill on the soft --sunken fill (2026-11-14 결정 B); 전화·공유 stay icon squares
  if (link.choices) a.addEventListener('click', (e) => { e.preventDefault(); openNavDialog(link.choices, copyText, geo); });
  return a;
}
// the card does not draw the strip for now (the sheet's 연락 section will); it stays for that
function linkBar(links, copyText = null, edge = null, geo = null) { // copyText: 길찾기 also copies it (the link may open no app); the nav address wins. edge: {start, end} cells at the two ends (♥ and share)
  if (!links.length && !edge) return null;
  const ordered = [...links.filter((l) => l.primary), ...links.filter((l) => !l.primary)];
  const nav = el('nav', { class: 'linkbar', 'aria-label': '길찾기와 연락' },
    edge?.start ?? null,
    ...ordered.map(({ label, href, sub, primary, choices, ask }) => {
      const a = el('a', { class: 'lb-item', href, target: '_blank', rel: 'noopener noreferrer', ...(sub ? { 'aria-label': `${label} · ${sub} 열기`, title: sub } : {}) },
        LINK_ICON[label] ? icon(LINK_ICON[label]) : null, LINK_ICON[label] ? el('span', { class: 'sr-only' }, LINK_WORD[label] ?? label) : (LINK_WORD[label] ?? label)); // icon cells say it with the icon (the word is for screen readers); a link without an icon keeps its word
      if (choices) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const mine = ask ? null : choices.find((c) => c.id === navPref());
          if (!ask) openNavDialog(choices, copyText, geo);
          else if (mine) openNav(mine, copyText, nav, choices); else pickNav(nav, choices, copyText, label);
        });
      } else if (primary && copyText) a.addEventListener('click', () => copyAddress(copyText));
      return a;
    }),
    edge?.end ?? null);
  return nav;
}

const rowButtons = (...extra) => { const kids = extra.filter(Boolean); return kids.length ? el('div', { class: 'row-actions' }, ...kids) : null; }; // the utility is view-only: no 수정 · 삭제 (data is fixed through 제보 and 빈칸 채우기)
// The map's selected pin: the list row's own header (rowHead), then the list card's dock without 다녀왔어요 (길찾기 · 전화 · 공유), its chips and the line into the wall sheet. No photo.
function card(row, at) {
  const m = modelOf(row, at);
  const { btn, heart, cls } = rowHead(row, at, m, true);
  btn.removeAttribute('aria-controls');
  btn.removeAttribute('aria-expanded');
  btn.addEventListener('click', (e) => { e.stopPropagation(); openWallSheet(m.name, btn); }); // not the list's open / close: the header leads to the sheet too
  const { dock: actions, chips } = cardActions(m, row.wall, true); // 길찾기 · 전화 · 공유, then the chips (plain here: only 암장 정보 자세히 leads on)
  const said = openStateText(row.status, at); // the open state in the 홈 list's own words (열림 · 22시까지), first under the name
  return el('li', { class: `row ${cls} pin-row` }, btn, heart,
    el('div', { class: 'expand' }, el('div', { class: 'expand-in' }, said ? el('p', { class: `ln-v pin-state${row.status?.state === 'open' ? ' open' : ''}` }, said) : null, actions, chips, sheetRowOf(m))));
}

function safeCard(row, at) {
  try {
    return card(row, at);
  } catch {
    const name = row.wall.name;
    return el('li', { class: 'card broken' },
      el('h3', { class: 'name' }, name),
      el('p', { class: 'note' }, '표시 중 오류가 발생했어요.'),
      rowButtons());
  }
}

// ---- timetable row ----
// (the bar itself — axisX, span, capCls, gaugeBar — lives in card-parts.js, shared by every kind of card)
// 13:30 → "13:30", 9:00 → "9": an hour told the short way, for a day with too many stretches to label each bar
const hourWord = (m) => (m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(m / 60));
// The hours of one open stretch, on one line over its bar: "10:00–14:00". A stretch that a break follows ends its label at the break's start
// (right-aligned to its bar's end); the last stretch starts its label where its bar starts. Kept inside the track by the ch width.
const barLabel = (a, b, text, endsAtBreak) => {
  const t = el('span', { class: 'g-txt' }, text);
  const room = `calc(100% - ${text.length}ch - 6px)`; // the label's own width: the track minus it is the furthest it may start
  if (endsAtBreak) t.style.right = `min(${(1 - axisFrac(b)) * 100}%, ${room})`;
  else t.style.left = `min(${axisFrac(a) * 100}%, ${room})`;
  return t;
};

// bottom-right chip on the photo; the credit comes from data, so it goes in as text only
function creditChip(c) {
  if (!c) return null;
  return c.url
    ? el('a', { class: 'credit', href: c.url, target: '_blank', rel: 'noopener noreferrer' }, c.text)
    : el('span', { class: 'credit' }, c.text);
}

// no photo yet: a quiet link at the right end of the name row opens the 제보 sheet on 암장 사진 for this wall (needs the board Worker: config.boardUrl; empty = no link)
function photoLink(m) {
  return m.photo || !boardOn() ? null : cameraBtn(m.name, { icon });
}

// An open row with a photo wears it: the photo sits behind the row's own line and bar (style.css .row.has-photo),
// today's hours ride on its foot. The photo and its credit leave the expanded part, which would repeat them.
// A crag row wears it too (crag-view.js deps.rowPhoto): the same camera, noun '암장', onFail draws its hero block back. Its 제보 flow is not open yet (the sheet takes wall names): the camera answers with cragCameraSoon.
const CARD_PHOTOS = 5; // the card swipes the main photo and the newest four; the gallery has them all (at most 10)
const CARD_DOTS = 5;
function rowPhoto(m, li, { canAdd = true, noun = '외벽', onFail = null, corner = null, onAdd = null } = {}) { // corner: ♥ / share buttons for the top-right of the photo (a wall; a crag has its own)
  const list = m.photos.slice(0, CARD_PHOTOS), many = m.photos.length > 1;
  const imgs = list.map((p, i) => el('img', { src: p.src, decoding: 'async', loading: 'lazy', alt: `${m.name} ${noun} 사진${many ? ` ${i + 1}/${list.length}` : ''}` }));
  const track = el('div', { class: 'rhero-track', ...(many ? { tabindex: '0', role: 'group', 'aria-roledescription': 'carousel', 'aria-label': `${m.name} 사진, 좌우로 넘기기` } : {}) },
    ...imgs.map((img) => el('div', { class: 'rhero-slide' }, img)));
  let credit = null;
  const line = el('div', { class: 'rhero-line' }, heroCap(m)); // a suspended wall: just the small 임시 휴관 중 pill on the photo; an open day's hours are on the gauge
  const setCredit = (c) => { // our own photos need no credit; a licensed one or a nickname keeps its line
    const nameless = !c?.text || ['사진 · 직접 촬영', '사진 출처', '사진 · 사진 출처'].includes(c.text.trim()); // no name to show: no line
    const next = creditChip(nameless ? null : c);
    if (next && c.text.length > 16) next.textContent = '사진 출처'; // a long credit (a licence line) shrinks to a link; the whole text is in the tooltip and the gallery
    next?.setAttribute('title', c.text);
    if (credit) credit.replaceWith(...(next ? [next] : [])); else if (next) (canAdd ? wrap : line).append(next); // a wall's credit stands under the camera (style.css), a crag's stays on the hours line
    credit = next;
  };
  const wrap = el('div', { class: 'herowrap rhero' }, track, el('div', { class: 'rhero-foot' }, line));
  setCredit(list[0].credit ?? m.credit);
  const withCorner = (w) => (corner ? (w.append(corner), w) : w); // share comes after the camera in the tab order (the corner is appended last)
  // the photo sits in a hidden box until the row opens (lazy never loads it): fetch the first when the row nears the screen, so opening shows it at once
  const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { imgs[0].loading = 'eager'; near.disconnect(); } }, { rootMargin: '300px' });
  near.observe(li);
  imgs[0].addEventListener('error', () => { li.classList.remove('has-photo'); wrap.remove(); onFail?.(); }, { once: true });
  imgs.slice(1).forEach((img, k) => img.addEventListener('error', () => img.closest('.rhero-slide')?.remove(), { once: true }));
  const add = canAdd && boardOn() ? cameraBtn(m.name, { more: true, icon, noun, onPress: onAdd }) : null;
  if (!many && !add) return withCorner(wrap);
  // right-bottom: faint dots say where we are (the current one stretches out when it changes), the camera sends one more
  const dots = el('span', { class: 'rhero-dots', 'aria-hidden': 'true' });
  const count = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  let cur = 0;
  const paint = (i) => { // at most CARD_DOTS dots: a window that follows the photo; a smaller dot at an end says there are more
    const n = list.length, d = Math.min(n, CARD_DOTS), start = n <= CARD_DOTS ? 0 : Math.max(0, Math.min(n - CARD_DOTS, i - 2));
    if (dots.children.length !== d) dots.replaceChildren(...Array.from({ length: d }, () => el('i')));
    [...dots.children].forEach((x, k) => { x.classList.toggle('on', start + k === i); x.classList.toggle('edge', n > CARD_DOTS && ((k === 0 && start > 0) || (k === d - 1 && start + d < n))); });
    count.textContent = `${i + 1} / ${n}`;
    setCredit(list[i].credit ?? (i === 0 ? m.credit : null));
  };
  const goTo = (i, smooth) => track.scrollTo({ left: Math.max(0, Math.min(list.length - 1, i)) * track.clientWidth, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
  if (many) {
    paint(0);
    track.addEventListener('scroll', () => { const i = Math.max(0, Math.min(list.length - 1, Math.round(track.scrollLeft / track.clientWidth))); if (i !== cur) { cur = i; paint(i); } }, { passive: true });
    const open = () => openGallery({ name: m.name, photos: m.photos, index: cur, canSend: boardOn(), onClose: (i) => { cur = Math.min(i, list.length - 1); goTo(cur, false); paint(cur); } });
    track.addEventListener('click', open);
    track.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); else if (e.key === 'ArrowRight') goTo(cur + 1, true); else if (e.key === 'ArrowLeft') goTo(cur - 1, true); });
  }
  wrap.classList.add('has-tools');
  wrap.append(el('div', { class: 'rhero-tools' }, many ? dots : null, many ? count : null, add));
  return withCorner(wrap);
}

// ---- '더 보기' pictures (mockup 2026-10-08): hours grid, seasonal sun, month strip, memo, parking ----
// 06–24 axis; with nowMin a time tag replaces the hour numbers next to it.
function gridAxis(nowMin, plotPx = null) {
  const ax = el('div', { class: 'g-axis', 'aria-hidden': 'true' });
  const scale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16; // the tag widens with the text size
  const px = plotPx ?? estimatePlotPx(document.querySelector('.wall-sheet')?.clientWidth || Math.min(window.innerWidth, 720), scale); // the strip, measured once it is on screen
  const gap = tagGapMin(px, scale, 8 + 9); // the labels the tag would cover (or touch) are left out; +9: the tag's ‹ › marks make it 18px wider
  for (const h of AXIS_LABELS) {
    if (nowMin != null && Math.abs(h * 60 - nowMin) < gap) continue;
    const t = el('span', { class: h === 6 ? 'first' : h === 24 ? 'last' : null }, String(h).padStart(2, '0'));
    t.style.left = axisX(h * 60);
    ax.append(t);
  }
  for (const d of DAYPARTS) { // 오전 · 오후 · 저녁 between the numbers (the time tag hides the one it sits on)
    const mid = (d.from + d.to) * 30;
    if (nowMin != null && Math.abs(mid - nowMin) < tagGapMin(px, scale, 14 + 9)) continue;
    const w = el('span', { class: 'dp' }, d.text);
    w.style.left = axisX(mid);
    ax.append(w);
  }
  if (nowMin != null) {
    const tag = el('span', { class: 'nowtag' }, fmtMin(nowMin));
    tag.style.left = `clamp(calc(1.5em + 16px), ${axisX(nowMin)}, calc(100% - 1.5em - 15px))`; // half the tag (with its ‹ › marks): stays inside the card at 06 and 24, like the list's tag
    ax.append(tag);
  }
  return ax;
}
const clipDay = (list) => list.map(([a, b]) => [a, Math.min(b, 1440)]).filter(([a, b]) => axisFrac(b) > axisFrac(a));

// the sheet's sky follows the axis while it is dragged: the same head, for the picked minute (nothing happens when no sheet is open).
function scrubHead(wall, at, min, nowMin) {
  const row = allRows.find((r) => r.wall.name === wall.name);
  if (!row) return;
  const there = new Date(at);
  there.setHours(Math.floor(min / 60), Math.round(min % 60), 0, 0);
  const mm = modelOf({ ...row, status: getStatus(row.wall, there) }, there);
  const isNow = vs.live && Math.round(min) === nowMin;
  const d = dialModel(wall, there, { isNow, dayLabel: mm.dayLabel });
  updateWallHead(sheetHead(wall, there, d, isNow));
}
// The 운영시간 card's one status line for the minute the axis tag shows: "운영 중 · 22:00 마감 · 양달" ({ state, head, tail }; no time prefix, the tag has it).
function verdictOf(wall, at, min, nowMin) {
  const row = allRows.find((r) => r.wall.name === wall.name);
  if (!row) return null;
  const t = new Date(at); t.setHours(Math.floor(min / 60), Math.round(min % 60), 0, 0);
  const mm = modelOf({ ...row, status: getStatus(row.wall, t) }, t);
  const word = wall.venue === 'indoor' ? null : sunWordOf(dialModel(wall, t, { isNow: vs.live && Math.round(min) === nowMin, dayLabel: mm.dayLabel }), Boolean(mm.closedDay), min);
  let sky = null; // under cloud or rain "양달" alone misleads: add the list forecast's sky word for that minute
  if (word === '양달') {
    const h = forecastTrusted(t, new Date()) ? wxEntry(wall, t) : null;
    if (h) {
      const k = wxKind(h, { noWet: wall.venue === 'both' || !!wall.tags?.includes('지붕'), noWind: wall.venue === 'both' });
      sky = ['rain', 'snow', 'storm'].includes(k) ? WX_WORD[k] : skyVeils(h.c) ? '흐림' : null;
    }
  }
  return { state: mm.state, head: mm.statusLine, tail: [word ? word.replace(/ /g, ' ') : null, sky].filter(Boolean) };
}
// head + one unbreakable " · 양달 · 흐림 ⓘ" tail, so a wrapped line never strands the sky word or the ⓘ alone.
const verdictKids = (v, why) => (v.tail.length ? [v.head, ' · ', el('span', { class: 'g-vtail' }, v.tail.join(' · '), why)] : [v.head, why]);

// Hours grid: Mon–Sun + 공휴일 on 06–24. Today's row: highlighted, the time line, today's sun over it (solid where
// it meets the real open hours of the day). 휴게·휴무 hatched. Previewing the other season hides the time line.
function hoursGrid(wall, at) {
  const wk = weeklyHours(wall, at, vs.season[wall.name]); // a season being previewed, else the picked day's own
  if (!wk.rows.length) return null;
  const ws = winterSpan(wall);
  const live = !wk.preview;
  const nowMin = minuteOf(at);
  const sec = el('section', { class: 'hgrid', 'aria-label': '요일별 운영시간' });

  const seg = wk.hasWinter && ws ? el('div', { class: 'g-seg', role: 'group', 'aria-label': '계절 운영시간' },
    ...[['summer', '하계', ws.summer], ['winter', '동계', ws.winter]].map(([k, label, months]) => {
      // the months sit inside the switch ("하계 4~9월 · 동계 10~3월"); a winter closure reads in the warning colour
      const shut = k === 'winter' && ws.closed;
      const nowShut = shut && weeklyHours(wall, at).season === 'winter'; // the warning colour only while the wall is shut right now; otherwise the closure is a quiet word
      const b = el('button', { type: 'button', 'data-season': k, 'aria-pressed': String(wk.season === k), class: shut ? `shut${nowShut ? ' now' : ''}` : null, 'aria-label': `${label} ${months ?? '연중'}${shut ? ' 외벽 휴무' : ''}` },
        el('span', { class: 'sw-k' }, label), months ? el('span', { class: 'sw-m' }, shut ? `${months} · 휴무` : months) : null);
      b.addEventListener('click', () => {
        go({ type: 'season', name: wall.name, pick: k, current: weeklyHours(wall, at).season });
        const next = hoursGrid(wall, at);
        sec.replaceWith(next);
        const sun = next.closest('.ws-hours')?.querySelector('.ssun'); // the seasonal sun under it follows the switch
        if (sun) sun.replaceWith(seasonSunBlock(wall, at, sun._d, true));
        next.querySelector(`[data-season="${k}"]`)?.focus();
      });
      return b;
    })) : null;
  const segRow = seg ? el('div', { class: 'g-segrow' }, seg) : null;

  const day = live ? dayLine(wall, at) : null; // a closed_date / nth closure isn't in the weekly rows: say it here
  const lead = live
    ? (day.closed ? el('p', { class: 'g-lead' }, `${dayText(at)} `, el('b', {}, day.full ?? day.text)) : null) // the day's sun is under 계절별 양달
    : el('p', { class: 'g-lead preview' }, `${wk.season === 'winter' ? '동계' : '하계'} 시간표 미리 보기`);

  const body = el('div', { class: 'g-body', role: 'list' });
  const plot = el('div', { class: 'g-plot', 'aria-hidden': 'true' });
  for (const h of [9, 12, 15, 18, 21]) {
    const g = el('span', { class: 'gl' });
    g.style.left = axisX(h * 60);
    plot.append(g);
  }
  if (live) {
    const nl = el('span', { class: 'nowl' });
    nl.style.left = axisX(nowMin);
    plot.append(nl);
  }
  body.append(plot);
  const nl = plot.querySelector('.nowl');

  const holNone = wk.rows.some((r) => r.key === 'hol' && r.text === '운영 미확인'); // told once in the check-date line (with its 제보), not as a row of its own
  const weekRows = groupWeekRows(wk.rows);
  const quiet = weekRows.some((r) => !r.closed && r.intervals.length) ? weekRows.filter((r) => r.closed && !r.today && r.key !== 'winter') : []; // closed days are one line under the rows, not a bar row each
  for (const r of weekRows) { // days with the same hours share one row
    if (r.key === 'hol' && r.text === '운영 미확인') continue;
    if (quiet.includes(r)) continue;
    const trk = el('span', { class: 'g-trk' });
    const open = clipDay(r.intervals);
    if (r.closed) trk.append(el('span', { class: 'g-closed' }, r.text)); // a closed day is the word 휴무 alone: no hatched bar
    else if (!open.length) trk.append(el('span', { class: 'g-closed none' }, r.text));
    else {
      // today's row is drawn like the list's bar: the part before the time line is paler and outlined, the halves of a split interval meet square
      const bars = r.today && live ? barSegments(open, nowMin) : open.map(([a, b]) => [a, b, false]);
      trk.append(...bars.map(([a, b, past], i, all) => span(`g-bar${past ? ' past' : ''}${all[i + 1]?.[0] === b ? ' j-end' : ''}${all[i - 1]?.[1] === a ? ' j-start' : ''}`, a, b)), ...clipDay(r.breaks).map(([a, b]) => span('g-brk', a, b)));
      // every open stretch carries its own hours right above its bar (24h, zero-padded, as in the list and the notes)
      const parts = r.text.split(', ');
      const stretches = r.intervals.map(([a, b0], i) => [a, Math.min(b0, 1440), parts[i]]).filter(([a, b, text]) => text && axisFrac(b) > axisFrac(a));
      // two or more stretches leave no room for a label each over its bar (two 11ch labels overlap on a phone's track, worse on large text): the day's hours then go in one short line at the left
      if (stretches.length > 1) trk.append(el('span', { class: 'g-note' }, `${stretches.map(([a, b]) => `${hourWord(a)}–${hourWord(b)}`).join(' · ')}시`));
      else trk.append(...stretches.map(([a, b, text], i) => barLabel(a, b, text, i < stretches.length - 1)));
    }
    // today closed by a closed_date / nth closure: the weekday's usual bar fades under the day's own word
    const shut = r.today && day?.closed && open.length;
    if (shut) trk.append(el('span', { class: 'g-closed' }, day.text));
    const said = `${r.days}${r.today ? (r.members > 1 ? '(오늘 포함)' : '(오늘)') : ''} ${r.text}${r.breaks.length ? `, 휴게 ${formatRanges(r.breaks)}` : ''}${shut ? `, 오늘은 ${day.text}` : ''}`;
    body.append(el('div', { class: `g-row${r.today ? ' g-today' : ''}${shut ? ' shut' : ''}`, role: 'listitem', 'aria-label': said },
      el('span', { class: 'g-lab', 'aria-hidden': 'true' }, r.days.replace(/·/g, '·​').replace(/–/g, '–⁠'), null), // a zero-width space after · lets 월·화·목·토 wrap in the narrow label column
      el('span', { class: 'g-wrap', 'aria-hidden': 'true' }, trk)));
  }

  const breaks = [...new Map(wk.rows.flatMap((r) => r.breaks).map((b) => [formatRanges([b]), b])).entries()].sort(([, a], [, b]) => a[0] - b[0]).map(([t]) => t); // one of each, earliest first
  const row = allRows.find((r) => r.wall.name === wall.name);
  const closedFull = row ? modelOf(row, at).closureFull : null; // the memo's whole closing line: one small note, which already says the weekdays the quiet-days note would repeat
  const shutSeason = wk.rows.every((r) => r.key === 'winter'); // a season the wall is shut: the grid says so, no other rules apply
  const notes = shutSeason ? [] : [
    closedFull ? `${closedFull.k} ${closedFull.v}` : quiet.length ? `휴무 ${quiet.map((r) => r.days).join(' · ')}` : null,
    breaks.length ? `휴게 ${breaks.join(', ')}` : null,
    ...wk.rows.filter((r) => r.nth).map((r) => `${r.nth.map((n) => NTH_KO[n]).join('·')} ${r.days}요일 휴무`),
    wall.holiday === 'weekend' && !closedFull ? '공휴일은 토요일 시간 · 정기휴무 요일과 겹치면 휴무로 표시' : null,
  ].filter(Boolean);
  const susp = wall.suspended ? el('p', { class: 'g-lead susp' }, '임시 휴관 중이라 아래 시간은 재개 후 기준이에요.') : null;

  // The time line starts at the picked moment; dragging the axis moves it (touch-action: pan-y keeps the sheet's sideways tab
  // swipe out of this zone). The line follows the finger; on release the grid and the one-line answer are drawn again for that
  // time. Only this sheet changes: the picked moment of the list (view state) is not touched, and closing the sheet drops it.
  // A range input in the zone is the keyboard and screen-reader way to the same thing.
  let axis = gridAxis(live ? nowMin : null);
  let zone = [axis, body];
  if (live) {
    const hourOf = (m) => Math.min(1380, Math.max(360, Math.round(m / 60) * 60)); // by the hour, 06:00–23:00: the list's own time slider moves the same way
    const range = el('input', { type: 'range', class: 'sr-only g-range', min: '360', max: '1380', step: '60', value: String(hourOf(nowMin)), 'aria-label': '보는 시각' });
    const showAt = (m, raw = m) => {
      scrubHead(wall, at, raw, nowMin); // the sky and the sun follow the finger minute by minute; the axis tag and the status line keep to the hour
      const v = verdict && verdictOf(wall, at, m, nowMin);
      if (v && v.state !== 'unknown') { verdict.className = `g-verdict ${v.state}`; verdict.replaceChildren(...verdictKids(v, verdictWhy)); }
      nl.style.left = axisX(m);
      const next = gridAxis(m, plot.getBoundingClientRect().width || null);
      axis.replaceWith(next);
      axis = next;
      range.value = String(m);
      range.setAttribute('aria-valuetext', fmtMin(m));
    };
    const rawAt = (x) => { // the axis is 06:00–24:00 across the plot
      const r = plot.getBoundingClientRect();
      return 360 + Math.min(1, Math.max(0, (x - r.left) / r.width)) * 1080;
    };
    const minAt = (x) => hourOf(rawAt(x));
    const commit = (m, byKey) => { // the sheet only: the grid is drawn again for that time of the same day; the list behind keeps its own moment
      if (m === hourOf(nowMin)) return;
      document.dispatchEvent(new CustomEvent('stats:time-slide')); // stats.js counts it once per visit (name only)
      const there = new Date(at);
      there.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const next = hoursGrid(wall, there);
      sec.replaceWith(next);
      if (byKey) next.querySelector('.g-range')?.focus();
    };
    let from = null; // the minute a drag started on: cancelling it (the page began to scroll) puts the line back
    const zoneEl = el('div', { class: 'g-zone', 'data-hold-fold': '' }, axis, range); // data-hold-fold: the sheet's head keeps its fold while this is dragged (wall-sheet.js) // only the axis strip is dragged: the bars below stay free for the tab swipe
    zoneEl.addEventListener('pointerdown', (e) => {
      if (e.button || e.clientX < plot.getBoundingClientRect().left) return; // the label column left of the axis is not part of the time scale
      from = nowMin;
      zoneEl.setPointerCapture(e.pointerId);
      showAt(minAt(e.clientX), rawAt(e.clientX));
    });
    zoneEl.addEventListener('pointermove', (e) => { if (from !== null) showAt(minAt(e.clientX), rawAt(e.clientX)); });
    zoneEl.addEventListener('pointerup', (e) => { if (from === null) return; from = null; commit(minAt(e.clientX), false); });
    zoneEl.addEventListener('pointercancel', () => { if (from !== null) { showAt(from); from = null; } });
    range.addEventListener('input', () => showAt(Number(range.value)));
    range.addEventListener('change', () => commit(Number(range.value), true));
    zone = [zoneEl];
  }
  // the answer for this time, in words; the row's status was made for the list's moment, so it is read again for `at` (the sheet's own time)
  const m = live && !susp && row ? modelOf({ ...row, status: getStatus(row.wall, at) }, at) : null;
  const verdictWhy = whyBubble('눈금 사용법', '눈금을 좌우로 끌어 시각을 바꿔요. 위 그림과 요약도 그 시각으로 바뀌어요.');
  const v0 = m && verdictOf(wall, at, nowMin, nowMin);
  const verdict = v0 && v0.state !== 'unknown' ? el('p', { class: `g-verdict ${v0.state}` }, ...verdictKids(v0, verdictWhy)) : null;
  // one legend only: the hatch is explained here; the sun colours are explained once, under 계절별 양달 (same colours)
  sec.dataset.holNone = holNone ? '1' : '';
  sec.append(...[segRow, susp, verdict, sunNoteEl(wall), susp ? null : lead, ...zone,
    ...(live ? [body] : []),
    notes.length ? el('ul', { class: 'g-notes' }, ...notes.map((n) => el('li', {}, n))) : null].filter(Boolean));
  return sec;
}

// Seasonal sun: 여름 / 봄·가을 / 겨울, each "여름 6/21 · 12:40–19:40" over a bar against the same weekday's hours
// in that season (solid where they meet). One legend line under the rows.
function seasonSunBlock(wall, at, d, shared = false) { // shared: it sits under the hours grid and reads that grid's axis
  if (noSunMath(d)) return null;
  const sel = weeklyHours(wall, at, vs.season[wall.name]).season; // with a 하계/동계 switch only that season's rows show (a switch that leaves none keeps all)
  const all = seasonSun(wall, at);
  const rows = all.some((r) => r.winter === (sel === 'winter')) ? all.filter((r) => r.winter === (sel === 'winter')) : all;
  const fold = false;
  const texts = []; // what each bar says in words (the bars are aria-hidden): kept for screen readers, a line a season
  const why = whyBubble('계산 기준', sunLimit().textContent, ' 지금 계절은 고른 날짜의 해로, 나머지 계절은 6/21(여름) · 3/21(봄·가을) · 12/21(겨울)의 해를 기준으로 계산해요.'); // the caveat is a ! bubble, as on the sun card
  const block = el('section', { class: 'ssun', 'aria-label': `계절마다 양달인 시간, ${DAY_KO[at.getDay()]}요일 운영시간 기준` },
    shared ? el('h4', { class: 'ssun-h' }, '계절별 양달', why) : gridAxis(null),
    ...rows.map((s) => {
      const open = s.open.length > 0; // with open hours only the sun inside them is told; a closed / unknown day keeps the day's whole window for reference
      const openClip = clipDay(s.open);
      const shown = open ? s.on : s.windows;
      const sunText = s.closed ? '휴무' : shown.length ? formatRanges(shown).replaceAll(', ', ' · ') : open ? '운영 중 양달 없음' : '하루 종일 응달';
      const hint = s.closed ? '' : s.unknown ? ' · 시간 미입력' : '';
      texts.push(el('li', { class: s.current ? 'cur' : null, hidden: fold && !s.current ? '' : null }, `${s.name} ${sunText}${hint}`));
      const trk = el('span', { class: 'g-trk', 'aria-hidden': 'true' },
        ...openClip.map(([a, b]) => span('g-bar', a, b)), // the same open bar as the hours grid, orange where sunny
        ...clipDay(s.on).map(([a, b]) => span(`g-sunon${capCls(a, b, openClip)}`, a, b)),
        // the sunny hours inside the open hours go over their orange part; none, or a closed day, is a quiet word at the left
        ...(open && s.on.length ? clipDay(s.on).map(([a, b], i, all) => barLabel(a, b, formatRanges([[a, b]]), i < all.length - 1)) : [el('span', { class: 'g-note' }, `${sunText}${hint}`)]));
      // the same two columns as the hours grid (name on the left, bar on the right), so both axes are as wide
      return el('div', { class: `s-row${s.current ? ' cur' : ''}`, hidden: fold && !s.current ? '' : null, 'aria-hidden': 'true' }, // read once, by the list below
        el('span', { class: 'g-lab' }, el('b', {}, s.name), s.current ? el('small', {}, '지금') : null),
        el('div', { class: 's-main' }, trk));
    }),
    el('ul', { class: 'sr-only', 'aria-label': '계절별 양달 시간, 운영 중 예상' }, ...texts),
    shared ? null : el('p', { class: 'ws-chk end' }, '계산 기준', why)); // alone (no hours grid above): the ! sits in the card's foot line
  block._d = d;
  if (rows.every((s) => s.shut)) { block.hidden = true; block.style.display = 'none'; } // only a season the wall is shut (동계 휴관) has no sun to tell; a weekly rest day or holiday keeps the block, its rows say 휴무 (kept as a hidden node so the 하계/동계 switch can swap it back)
  return block;
}

// The one legend of the 시간 tab, at its top: it covers the hours bars and the seasonal bars under them (so neither section carries its own).
// The hatch is named only when this wall has a break or a closed day to show.
function timeLegend(blocks) {
  const sun = Boolean(blocks.sun && !blocks.sun.hidden);
  const hatch = Boolean(blocks.hours?.querySelector('.g-brk, .g-off'));
  return el('ul', { class: 'g-key ws-legend' },
    el('li', {}, el('i', { class: 'k-bar' }), '운영'),
    sun ? el('li', {}, el('i', { class: 'k-sunon' }), '운영 중 양달 구간') : null,
    hatch ? el('li', {}, el('i', { class: 'k-hatch' }), '휴게·휴무') : null);
}

// 요금 tab: the table is drawn by fee-table-view.js (구분 / 대상 / 평일 / 휴일, or one column per 거주지); the 관리자 preview uses the same
function feesBlock(wall) {
  const t = feeTable(wall);
  const free = entryFee(wall) === '무료';
  if (t) { // a free entrance that ends: the line above the table says until when, the table is what follows
    const box = feeTableEl(t);
    if (free && wall.free_until) box.prepend(el('p', { class: 'f-free' }, el('b', {}, '무료'), el('span', { class: 'f-note' }, ` · ${shortenDates(wall.free_until, ymd(new Date()))}까지`)));
    return box;
  }
  if (!free) return entryFee(wall) === '유료' ? el('section', { class: 'fees', 'aria-label': '요금' }, el('p', { class: 'f-free' }, el('b', {}, '요금 확인 필요'))) : null; // 유료 but no price left to show (체험·강습·회원권 are hidden): say so, no date
  return el('section', { class: 'fees', 'aria-label': '요금' }, el('p', { class: 'f-free' }, el('b', {}, '무료'), wall.free_until ? el('span', { class: 'f-note' }, ` · ${shortenDates(wall.free_until, ymd(new Date()))}까지`) : null)); // the chip says 무료: the 입장 요금 card must not stay empty
}

// The address sits under the place line; tapping it copies it (a copy icon says so; the text turns into
// "✓ 복사했어요" and the icon into a check for a moment). Next to it, an icon opens the route.
function addrLine(m) {
  if (!m.address || m.route) return null; // with a route the 길찾기 cell stands for the address (and copies it); without one the address is all there is
  const text = el('span', { class: 'addr-t' }, m.address);
  const glyph = el('span', { class: 'addr-ic', 'aria-hidden': 'true' }, icon('copy'));
  const btn = el('button', { type: 'button', class: 'addr-btn', 'aria-label': `주소 복사: ${m.address}` }, text, glyph);
  const say = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  let timer;
  const flash = (msg, shown) => {
    say.textContent = msg;
    text.textContent = shown;
    glyph.replaceChildren(icon('check'));
    btn.classList.add('done');
    clearTimeout(timer);
    timer = setTimeout(() => { text.textContent = m.address; glyph.replaceChildren(icon('copy')); btn.classList.remove('done'); }, 1800);
  };
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(m.address);
      flash('주소를 복사했어요', '✓ 복사했어요');
    } catch { // no clipboard (http, old browser, denied): select the text so it can be copied by hand
      const r = document.createRange();
      r.selectNodeContents(text);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      say.textContent = '주소를 선택했어요. 길게 눌러 복사하세요';
    }
  });
  const line = el('p', { class: 'addr-line' }, btn, say);
  return m.navAddress ? el('div', {}, line, el('p', { class: 'addr-nav' }, `내비 검색 · ${m.navAddress}`)) : line;
}

// ---- 즐겨찾기: a heart before the name on the card (list and map), a strip of my walls on top of the list, a filter in 조건 ----
const allWalls = () => [...state.walls, ...state.crags]; // the lists a ♥ is read against (names in memory, ids in the store)
let favs = loadFavs(storage); // ids until the lists load; resolved to names right after (see the line after state.crags)
// 세팅일이 바뀌었어요 (setting.js): the setting.last seen per ♥ wall; a first look only records it
let seen = loadSeen(storage);
function syncSeen() {
  const next = recordFirstSeen(seen, state.walls, favs);
  if (next !== seen) saveSeen(storage, (seen = next));
}
// Opening a ♥ wall's card marks its 세팅일 seen: the row's mark goes now, the card's own on its next redraw.
function seeSetting(name) {
  const last = state.walls.find((w) => w.name === name)?.setting?.last;
  if (!last || !favs.includes(name)) return;
  const next = markSeen(seen, name, last);
  if (next === seen) return;
  saveSeen(storage, (seen = next));
  for (const b of document.querySelectorAll('.row-btn .setnew')) if (b.dataset.setmark === name) b.remove();
}
function paintStar(btn) {
  const on = favs.includes(btn.dataset.fav);
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('on', on);
  btn.replaceChildren(icon('heart', on), ...(btn.dataset.label ? [el('span', { class: 'sr-only' }, btn.dataset.label)] : [])); // the link strip says it with the icon; the word is for screen readers
}
// Every heart and name mark of a wall is repainted in place, so the tapped button keeps focus.
// ---- 이번 주 변경: the followed walls (♥, 내 지역) that are suspended or have a closed date this week, one line on the home and a sheet ----
const mdOf = (d) => `${+d.slice(5, 7)}/${+d.slice(8)}`;
const sinceText = (d) => (Date.now() - new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8)) > 60 * 864e5 ? `${+d.slice(5, 7)}월부터` : `${mdOf(d)}부터`); // a long-ago start: the month only
function changeText(c) {
  if (c.kind === 'added' || c.kind === 'opened') return c.kind === 'added' ? `새 외벽이 오픈했어요 · ${+c.from.slice(5, 7)}월 ${+c.from.slice(8)}일` : `개장 · ${mdOf(c.from)}`;
  if (c.kind === 'winter') return [c.season === 'start' ? '동절기 시작' : '동절기 끝', `${mdOf(c.from)}${c.season === 'start' ? '부터' : ''}`, c.note].filter(Boolean).join(' · ');
  const when = c.kind === 'closed' ? (c.from === c.to ? mdOf(c.from) : `${mdOf(c.from)}~${mdOf(c.to)}`) : c.from ? sinceText(c.from) : '';
  return [c.kind === 'closed' ? '임시 휴무' : '이용 어려움', when, c.note].filter(Boolean).join(' · ');
}
// 소식 표기 둘: 모든 암장의 행·카드에 붙는 알약(newsPill: 즐겨찾기와 상관없이 그 암장을 보는 사람이 본다)과, 홈에서 ♥ 암장의 소식을 밀어서 치우는 카드(#changesStrip)
let newsMemo = { walls: null, day: '', found: [], map: new Map() };
const newsChip = (c) => (c.kind === 'closed' ? `휴무 ${mdOf(c.from)}` : c.kind === 'winter' ? (c.season === 'start' ? `동절기 ${mdOf(c.from)}` : '동절기 끝') : c.kind === 'added' ? '새 암장' : c.kind === 'opened' ? '개장' : null); // an ongoing 휴관 is the card's own pill already
function newsState() {
  const now = new Date(), day = now.toDateString();
  if (newsMemo.walls !== state.walls || newsMemo.day !== day) {
    const found = syncFound(storage, state.walls, now), map = new Map();
    for (const c of weekChanges(state.walls, now, { favs: state.walls.map((w) => w.name), found })) if (newsChip(c) && !map.has(c.name)) map.set(c.name, c);
    newsMemo = { walls: state.walls, day, found, map };
  }
  return newsMemo;
}
const newsPill = (name, tag = 'span') => { const c = newsState().map.get(name); return c && (tag === 'p' || c.kind !== 'winter') ? el(tag, { class: c.kind === 'closed' ? 'newspill warn' : 'newspill', title: changeText(c) }, tag === 'p' ? changeText(c) : newsChip(c)) : null; };
function syncFavs() {
  for (const b of document.querySelectorAll('[data-fav]')) paintStar(b);
  for (const m of document.querySelectorAll('[data-favmark]')) m.hidden = !favs.includes(m.dataset.favmark);
}
function favBtn(name, label = null) { // label: a word under the heart (the link strip's cell)
  const btn = el('button', { type: 'button', class: label ? 'lb-item fav-btn' : 'icon-btn fav-btn', 'data-fav': name, 'aria-label': `${name} 즐겨찾기`, title: '즐겨찾기', ...(label ? { 'data-label': label } : {}) });
  btn.addEventListener('click', () => {
    favs = toggleFav(favs, name);
    saveFavs(storage, favs, allWalls());
    syncFavs();
    if (favs.includes(name)) document.dispatchEvent(new CustomEvent('stats:fav-add')); // stats.js counts it (no wall name in it)
    if (ui.favOnly) { // the list itself follows the hearts
      render();
    }
  });
  paintStar(btn);
  return btn;
}
// 다른 날의 날씨 (weather.js; docs/system/permissions.md): one request for every wall's daily rain / gust numbers, kept in memory
// (3 hours; a failed one 5 minutes). A row of another day reads it where the hourly forecast does not reach (rowWeather).
const wxPick = { byName: new Map(), entry: null, busy: false };
// 저장본 (wx-cache.js): the raw answers stay in this browser (wx-list / wx-week / wx-wall), and a 429 (daily limit) stops every weather ask until local midnight
const wxc = wxCache(storage);
const WXW_KEY = 'open-wall:wx-week', WXS_KEY = 'open-wall:wx-wall';
const wxGet = (url) => getJson(url, { onStatus: (s) => { if (s === 429) wxc.setLimited(); } });
async function loadWeekendWeather() {
  if (wxPick.busy || weatherFresh(wxPick.entry, Date.now())) return;
  const spots = listSpots(); // indoor and closed (임시 휴관, 동절기 휴관) walls: no forecast
  if (!spots.length) return;
  const key = listKey(spots);
  const apply = (days, at) => { wxPick.entry = { hours: days, at, key }; wxPick.byName = new Map(spots.map(([w], i) => [w.name, days[i]])); if (!vs.live) renderForWx(); };
  if (wxPick.entry?.key !== key) { // the first ask of this visit (or the list changed): the copy kept in this browser may still be good
    const saved = wxc.get(WXW_KEY, key, { stale: wxc.limited() });
    const days = saved && parseDaily(saved.json, spots.length);
    if (days) return apply(days, saved.at);
  }
  if (wxc.limited()) return; // 429 today: keep what is shown
  wxPick.busy = true;
  let days = null, j = null;
  try {
    j = await wxGet(weekendForecastUrl(spots.map(([, p]) => p)));
    if (j) days = parseDaily(j, spots.length);
  } catch { /* quiet: rows stay as they are */ }
  wxPick.entry = { hours: days, at: Date.now(), key }; // the shape weatherFresh reads
  if (days) { wxPick.byName = new Map(spots.map(([w], i) => [w.name, days[i]])); wxc.put(WXW_KEY, key, j); } // a failed call keeps the last good forecast
  wxPick.busy = false;
  if (days && !vs.live) renderForWx(); // the first screen's forecast line (another day)
}
const pickWeather = (wall, date) => dayWeather(wxPick.byName.get(wall.name)?.get(dayKey(date)));
// 목록 줄의 날씨 (weather.js; docs/system/permissions.md): one request for every outdoor wall's hourly temperature and sky, the way
// the weekend picks ask for theirs. Kept in memory and in this browser for 3 hours so a reload does not ask again; a failed
// answer is not retried for 5 minutes. A row shows the temperature at the picked arrival hour; indoor walls have none.
const WXL_KEY = 'open-wall:wx-list';
const wxList = { byName: new Map(), entry: null, busy: false };
// no forecast for a wall that is closed whatever the weather: 임시 휴관 중, or today inside a 동절기 휴관 (winter type closed)
const noWeather = (w) => w.venue === 'indoor' || !!w.suspended || (w.winter?.type === 'closed' && inWinter(w, new Date()));
const listSpots = () => state.walls.filter((w) => !noWeather(w)).map((w) => [w, wallPosition(w)]).filter(([, p]) => p);
// names and coordinates (2 decimals, what is sent): a wall added, removed or moved while the page is open asks again
const listKey = (spots) => spots.map(([w, p]) => `${w.name}@${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join('|');
function useWxList(spots, json, at) {
  const days = parseListForecast(json, spots.length);
  wxList.entry = { hours: days, at, key: listKey(spots) }; // the shape weatherFresh reads, plus the list it answers
  wxList.byName = new Map(days ? spots.map(([w], i) => [w.name, days[i]]) : []);
  return !!days;
}
// the forecast decides the order (비 오는 곳, 기온 ○°↑) : sort again when it lands, unless a row has the focus (the next minute tick will)
const renderForWx = () => { if (!document.activeElement?.closest?.('#panel-list .row')) render(); };
async function loadListWeather() {
  if (wxList.busy) return;
  const spots = listSpots();
  if (!spots.length) return;
  const key = listKey(spots);
  if (weatherFresh(wxList.entry, Date.now()) && wxList.entry.key === key) return;
  if (!wxList.entry || wxList.entry.key !== key) { // the first ask of this visit: the copy kept in this browser may still be good
    const saved = wxc.get(WXL_KEY, key, { stale: wxc.limited() });
    if (saved && useWxList(spots, saved.json, saved.at)) { paintListWx(); renderForWx(); return; }
  }
  if (wxc.limited()) return; // 429 today: keep what is shown
  wxList.busy = true;
  let json = null;
  try {
    json = await wxGet(listForecastUrl(spots.map(([, p]) => p)));
  } catch { /* quiet: rows stay without weather */ }
  if (useWxList(spots, json, Date.now())) wxc.put(WXL_KEY, key, json);
  wxList.busy = false;
  paintListWx();
  renderForWx();
}
const wxEntry = (wall, at) => { const h = wxList.byName.get(wall.name); return h ? pickHour(h, at) : null; };
// the list rows tell the forecast as the temperature under the chip and a corner badge for the weather that matters (card-parts wxSet), in full on the open card.
// Open-Meteo asks for credit (CC BY 4.0): a line under the list whenever its forecast is in use
const syncWxCredit = () => { if ($('wxCredit')) $('wxCredit').hidden = !wxList.byName.size; };
const paintListWx = syncWxCredit;
function shareBtn(name, label = null) { // label: a word under the icon (the link strip's cell)
  const face = () => [icon('share'), ...(label ? [el('span', { class: 'sr-only' }, label)] : [])];
  const btn = el('button', { type: 'button', class: label ? 'lb-item' : 'icon-btn', 'aria-label': `${name} 공유하기`, title: '공유하기' }, ...face());
  const say = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  let timer;
  btn.addEventListener('click', async () => {
    const url = shareUrl(location.href, name, 'wall', idByName(state.walls, name));
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt('링크를 복사하세요', url); // no clipboard (http, denied)
      return;
    }
    document.dispatchEvent(new CustomEvent('stats:share-send')); // stats.js counts it (no wall name in it)
    btn.classList.add('done');
    btn.replaceChildren(icon('check'), ...(label ? [el('span', { class: 'sr-only' }, '복사됨')] : []));
    say.textContent = '링크를 복사했어요';
    clearTimeout(timer);
    timer = setTimeout(() => { btn.classList.remove('done'); btn.replaceChildren(...face()); say.textContent = ''; }, 1800);
    toast('링크를 복사했어요');
  });
  return el('span', { class: 'share-wrap' }, btn, say);
}

// First view under the chips: 안내 (status notes, then the memo lines that can stop a visit), parking (one line).
// Weekly closures are a 안내 line and the hatched grid rows.
const memoItem = (l) => el('li', { class: l.key ? (l.quiet ? 'key quiet' : 'key') : null },
  l.label ? el('span', { class: 'mk' }, l.label) : null,
  el('span', { class: l.label ? 'mv' : 'mv free' }, tightParens(l.value)));

// the regular closing day (정기휴무 월): the row carries a › and opens the wall sheet at 운영시간, the way the 주차 row opens its section
const CLOSED_LABEL = /^(정기휴무|정기휴장|휴무|휴관|휴장)$/;
const CLOSED_WORD = /(휴무|휴관|휴장)/; // a memo line that says a closing without a label ("설 연휴 휴무") gets the same row, labelled 지정휴무
function closedItem(l, m) {
  const go = el('button', { type: 'button', class: 'mv pv-go' }, el('span', { class: 'pv-t' }, l.value), el('span', { class: 'pv-arrow', 'aria-hidden': 'true' }, '›'));
  go.addEventListener('click', () => openWallSheet(m.name, go, { tab: 'time', section: 'hours' }));
  return el('li', { class: l.key ? (l.quiet ? 'key quiet' : 'key') : null }, el('span', { class: 'mk' }, l.label), go);
}
function infoBlock(m) {
  const parts = [];
  // only what can stop a visit (closures, warnings, "!" lines); the other memo lines are the wall sheet's 시설 section
  if (m.infoFace.length) parts.push(el('ul', { class: 'memo-list info', 'aria-label': '안내' }, ...m.infoFace.map((l) => (CLOSED_LABEL.test(l.label ?? '') ? closedItem(l, m) : !l.label && l.key && CLOSED_WORD.test(l.value) ? closedItem({ ...l, label: '지정휴무' }, m) : memoItem(l)))));
  // (the parking and the closing day are chips under the photo: their detail is in the wall sheet)
  return parts;
}

// 근처 장비점: one quiet line under 주차 when a registered shop is within the radius of the wall (data/partners.json, src/gear.js); the line opens the
// shop sheet. A wall with no shop near it has no line.
function nearGearOf(wall) {
  const pos = wallPosition(wall);
  return { info: nearGear(partners.info, pos), sponsored: nearGear(partners.sponsored, pos) };
}
function gearRow(wall) {
  const near = nearGearOf(wall);
  const line = gearLine(near.info, near.sponsored);
  if (!line) return null;
  const row = goRow('근처', [el('span', { class: 'gear-ic', 'aria-hidden': 'true' }, icon('gear')), line], null, () => openGearSheet(wall, near, row.querySelector('.pv-go')));
  return row;
}
function openGearSheet(wall, near, opener) {
  const body = gearBody(near.info, near.sponsored, icon);
  if (!body) return;
  $('gear-body').replaceChildren(body);
  $('gear-title').textContent = '근처 장비점';
  document.dispatchEvent(new CustomEvent('stats:gear-view'));
  const dlg = $('gear-sheet');
  dlg.addEventListener('close', () => opener?.focus(), { once: true });
  dlg.showModal();
  dlg.scrollTop = 0;
  body.start();
}
// The one-line limit under every estimated sun time (the same words in the sun line's fold and the 계절별 양달 tab)
const sunLimit = () => el('p', { class: 'sun-limit' }, '벽 방향·지형으로 계산한 예상이에요. 건물·나무·구름·오버행은 반영하지 않아요.');
const noSunMath = (d) => d.state === 'unknown' || d.state === 'override';
// The wall's own sun note (multi-face walls) as one muted line under the 운영시간 status line; null when the wall has none. The sun word itself rides on that status line (verdictOf).
const sunNoteEl = (wall) => (wall.sun_note ? el('p', { class: 'ws-sunnote' }, wall.sun_note) : null);


const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Expanded row (v6): what decides the visit first; the rest is in the wall sheet (자세히 ›).
// The three pieces under a wall's photo on the list card: the dock (길찾기 · 다녀왔어요), the chips, the line into the wall sheet. (The map card is the simple one: it takes only the line, sheetRowOf.)
// 한 줄 게시판 on the line into the sheet: how many posts and whether one is new (src/board-summary.js; asked from the Worker once, off without config.boardUrl)
const boardNotice = boardOn() ? createBoardNotice({ api: createBoardApi({ url: config.boardUrl, idOf, getAuthorId: () => getAuthorId({ get: getStr, set: setStr }) }), idOf, nameOf, storage: { get: (k) => storage.getItem(k), set: (k, v) => storage.setItem(k, v) } }) : null;
// 빈칸 채우기 제보 (src/fill-view.js): off (no request) unless config.fill and boardUrl are both set
const fillApi = fillOn() ? createFillApi({ url: config.boardUrl, idOf, getAuthorId: () => getAuthorId({ get: getStr, set: setStr }) }) : null;
// the 알려 주기 rows: one per section for its blanks (ask.specs in specsList: 높이 · 전화 · 공지, ask.parking under 주차: 위치), a filled fact keeps its own row; {} when off
function fillPane(m, wall) {
  if (!fillApi) return {};
  return fillRows({ wall, onSubmit: async ({ field, value }) => {
    const { fill } = await fillApi.submit({ wall: m.name, field, value, nick: loadNick(getStr(NICK_KEY)) });
    addFillSent({ get: getStr, set: setStr }, { wall_id: fill.wall_id, field, at: Date.now() });
    if (fill.status === 'pending' || fill.status === 'confirmed') { state.walls = applyFills(state.walls, [{ ...fill, nick: fill.nick ?? '' }]); render(); }
    return { status: fill.status };
  } });
}
const openBoardOf = (name) => (b) => openWallSheet(name, b, { tab: 'board' });
boardNotice?.onChange(() => document.querySelectorAll('.irow[data-board]').forEach((row) => setBoardRow(row, boardNotice.notice(row.dataset.board))));
const sheetRowOf = (m) => sheetLine(m.name, (b) => openWallSheet(m.name, b)); // no 한 줄 게시판 pill on the map card: 암장 정보 자세히 is its one way into the sheet
const reportFrom = (name, kind, kinds) => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name, kind, kinds } }));
const rainComing = (m) => Boolean(m.weather?.rain || m.weather?.ahead?.some((a) => a.rain)); // raining now, or rain forecast in the hours still ahead today
// 운영 · 이용 · 게시판: each opens its tab of the wall sheet (the tab row shows below); a value not known asks for a report instead
function cardRows(m) {
  const to = (tab, section) => (b) => openWallSheet(m.name, b, { tab, section });
  const ask = (kind, tab) => (b) => reportFrom(m.name, kind, TAB_KINDS[tab], b);
  const board = boardNotice?.notice(m.name) ?? null;
  return [
    infoRow('운영', m.opsRow, { opens: 'time', open: to('time', 'hours'), ask: ask('운영시간', 'time') }),
    infoRow('이용', m.useRow, { opens: 'use', open: to('use', 'fees'), ask: ask('요금', 'use') }),
    boardNotice || m.blog ? boardRow(board, { name: m.name, open: openBoardOf(m.name), blog: m.blog }) : null,
  ];
}
const mapShare = (name) => { const w = shareBtn(name); w.classList.add('dock-share'); return w; }; // the share button (inside its wrapper) drawn as an outlined square like 길찾기 and 전화 (style.css .dock-share)
function cardActions(m, wall, onMap = false) { // onMap: the map card's dock is the wall card's (길찾기 · 전화 · 공유 squares, 다녀왔어요 wide); only its chips and rows are fewer
  const pos = wallPosition(wall);
  const nav = m.links.find((l) => l.primary); // 길찾기: the same map-app dialog as the link strip's cell (the strip itself is not drawn on the card for now)
  const go = nav ? navButton(nav, m.navAddress ?? m.address, pos ? { lat: pos.lat.toFixed(5), lng: pos.lng.toFixed(5), name: m.name } : null) : null;
  return {
    dock: dock(go, null, telButton(m.name, m.links.find((x) => x.label === '전화'), icon), mapShare(m.name)),
    reserve: reserveBand(m.reserve, { icon }),
    chips: chipBar(onMap ? m.chips?.slice(0, 3).map((c) => ({ ...c, to: null })) : m.chips, { icon, pick: (to, b) => openWallSheet(m.name, b, to) }),
    notice: noticeLine(m.notice, { lit: rainComing(m), report: (b) => reportFrom(m.name, '임시휴무', ['임시휴무'], b), icon }),
    rows: cardRows(m),
  };
}
function rowDetails(m, wall, at) {
  // 제보 stays at the foot as quiet text links: a correction is rare, and the card's job is the hours above
  const photoAsk = photoLink(m); // (this one is on the name row: a photo is what the card lacks most)
  const helps = config.reportEndpoint
    ? el('div', { class: 'help-row' },
      el('button', { type: 'button', class: 'help-link', 'data-act': 'report', 'data-name': m.name }, icon('pencil'), '정보 수정 요청'),
      m.hasChat ? null : el('button', { type: 'button', class: 'help-link', 'data-act': 'report', 'data-name': m.name, 'data-kind': '오픈채팅방' }, icon('chat'), '오픈채팅 추가'))
    : null;
  // 다녀왔어요 sits beside 자세히 at the card's foot; its sheet asks the visit time and the crowd. Under a sun picture the two are the picture card's
  // own foot (sc-actions: the wall's base, painted with the card's colours); a wall with no picture (indoor, closed day) keeps them in a row of their own (go-row)
  const wxParts = wall.venue === 'indoor' ? [] : weatherBox(m, wall, at); // the 날씨 box, after the facts; the sun card (해) lives in the wall sheet's 시간 tab
  const { dock: actions, reserve, chips, notice, rows } = cardActions(m, wall); // floating over the photo's foot, then the chips, then the line into the sheet
  // (linkBar and m.links stay for the wall sheet's 연락 section; until then the phone / 공지 / 오픈채팅 links are not on the card)
  return [
    // no photo: a plain block takes the photo's place (hours on its foot, the camera at its corner), so both cards have the same layout
    m.photo ? null : placeholderHero(m, photoAsk, null),
    actions,
    reserve,
    chips,
    notice,
    ...rows,
    el('div', { class: 'm-cols' },
      // what decides the visit: name, today's hours and the sun now (open: the row already says how long is left)
      el('div', { class: 'm-head' },
        el('h3', { class: 'x-name' }, m.name), // the name is on the row's own line (read aloud here)
        (m.state === 'open' || m.state === 'unknown' || m.suspended ? m.place !== m.meta && m.place : !m.photo && m.sub) ? el('p', { class: 'x-sub' }, m.state === 'open' || m.state === 'unknown' || m.suspended ? m.place : m.sub) : null, // a wall with no hours says so once, in the hero (not again here, nor in the row's chip: style.css hides it while open) // (the region is already on the row's own line: not said twice) // a suspended wall says 임시 휴관 중 once, in the pill (or the photo's chip) // a closed photo card: the pill on the photo already says when it opens
        m.warn ? el('div', { class: 'warn-line' }, warnPill(m.warn), warnNote(m.warn, agoText(m.warn.ago), warnHow(m))) : null,
        // (no 휴게 chips on the card: the hours already split around the break, the list bar and the wall sheet's table show it)
        addrLine(m)), // the address right under 오늘 운영
      el('div', { class: 'm-info' },
        // a photo card: the link strip hangs right under the photo (before the visit: 길찾기, 전화), the 다녀왔어요 line comes after
        m.notice?.tone === 'sure' ? null : newsPill(m.name, 'p'), // what changes this week comes first (a closing the 휴무 line already tells is not said a third time)
        ...crowdBox(m), // before the visit (길찾기 · 전화), then 다녀왔어요
        m.holiday ? el('p', { class: 'hol-note' }, m.holiday) : null,
        m.staleNote ? el('p', { class: 'stale-note' }, m.staleNote) : null,
        ...infoBlock(m),
        gearRow(wall),
        m.settingBadge ? el('p', { class: 'setnew' }, m.settingBadge) : null), // the check dates (정보·공지·세팅) are in the wall sheet
      ...wxParts), // after the facts (the right column when wide)
    helps,
    rowButtons(),
  ];
}

// The wall sheet (src/wall-sheet.js) is drawn from here: the hours grid, seasonal sun and fee table read the view state.
// 이용 tab = 운영시간 · 요금 · 주차, each with its date and a 수정 요청 that opens the report sheet with the matching 종류;
// a section with nothing to show asks for a report instead. 양달 tab = the seasonal sun (no tab for a wall without sun math).
// an empty section's invitation: what is missing, and how little is enough (a low bar to answer)
const EMPTY_ASK = { hours: ['운영시간을 아직 몰라요', '전화나 공지에서 본 시간 한 줄이면 충분해요.'], fees: ['입장 요금이 아직 비어 있어요', '아는 금액 하나만 알려 주셔도 돼요.'], parking: ['주차 정보가 아직 비어 있어요', '주차장 이름이나 요금 한 줄이면 충분해요.'] };
function sheetSection(m, s, content, extra = null) { // extra: a 알려 주기 row (fillPane) that belongs to this section, drawn after its facts or its empty box
  // a filled section ends in a quiet 수정 요청 link; an empty one holds a 알려 주기 button in its dotted box (the gap is the invitation)
  const ask = config.reportEndpoint && s.kind && s.empty // (a computed section such as 계절별 양달 has no report kind); a filled section is reported from the head's 알려 주기
    ? el('button', { type: 'button', class: 'ws-chk-ask', 'aria-label': `${s.title} 알려 주기` }, '알려 주기') : null;
  ask?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: s.kind, kinds: TAB_KINDS[s.kind === '운영시간' ? 'time' : 'use'] } })));
  // the title row carries 수정 요청 (a filled section), the facts follow, and the check date is a quiet line at the card's bottom right
  return sheetCard(s.title, [
    s.empty ? el('div', { class: 'ws-empty' }, el('p', {}, EMPTY_ASK[s.key]?.[0] ?? '아직 정보가 없어요'), el('p', { class: 'ws-empty-sub' }, EMPTY_ASK[s.key]?.[1] ?? '아는 것 한 줄이면 충분해요.'), ask) : content,
    extra ? el('ul', { class: 'memo-list info fill-list' }, extra) : null,
    ...(s.empty || s.dated === false ? [] : s.key === 'parking' // the parking has its own date (or none): the hours' date says nothing about it
      ? [m.parkingStale ? el('p', { class: 'ws-stale' }, '요금과 주차 정보가 바뀌었을 수 있어요 · 6개월 넘게 확인하지 못했어요') : null, m.parkingChecked ? el('p', { class: 'ws-chk end' }, shortenDates(m.parkingChecked, ymd(new Date()))) : null]
      : [el('p', { class: 'ws-chk end' }, shortenDates(m.checked, ymd(new Date())), ...(s.key === 'hours' ? holidayAsk(m, content?.querySelector?.('.hgrid')?.dataset.holNone === '1') : []))]),
  ], { cls: s.empty ? ' empty' : '', attrs: { 'data-sec': s.key } });
}
// 공휴일 hours nobody has told us: a quiet word at the end of the check-date line ("확인 10/20 · 공휴일 제보") opens the report sheet on the hours kinds (only with the report form connected)
function holidayAsk(m, none) {
  if (!none) return [];
  const wall = state.walls.find((w) => w.name === m.name);
  if (!config.reportEndpoint || !wall) return [' · 공휴일에 여는지는 아직 몰라요'];
  const b = el('button', { type: 'button', class: 'ws-chk-ask' }, '공휴일 제보');
  b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: '운영시간', kinds: TAB_KINDS.time } })));
  return [' · 공휴일에 여는지는 아직 몰라요', whyBubble('공휴일 운영시간 알리기', '공휴일에 여는 시간을 알고 계신가요? ', b)]; // the report is a button inside the ! bubble, as on the sun card
}
// 루트 tab: the newest route count as bars (a chip per wall section when the count is by section), dimmed and headed 세팅 이후 분포 미확인
// once the wall was set after it; nothing recorded: a dotted box asking for a report.
// 루트 tab = 전경 (the whole-wall picture, src/overview-view.js) above the route count
function routePane(m, wall) {
  // nothing known about the routes or the picture: one dotted box asking for both, not two in a row
  if (!wall.overview?.length && boardOn() && !routeView(wall)) return el('div', { class: 'ws-use' }, routeEmpty(m, wall, true));
  return el('div', { class: 'ws-use' }, overviewSection(m.name, wall.overview, TAB_KINDS.routes), routeBars(m, wall));
}
// the 루트 section with nothing counted: the dotted box asks for the count (and, `withPhoto`, for the whole-wall picture too)
function routeEmpty(m, wall, withPhoto = false) {
  const report = (kind, label) => {
    if (!config.reportEndpoint && kind === '루트 분포') return null;
    const b = el('button', { type: 'button', class: kind === '루트 분포' ? 'ws-chk-ask' : 'ws-chk-ask sub' }, label); // the count is the main ask, the picture the lesser one
    b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind, kinds: TAB_KINDS.routes } })));
    return b;
  };
  const setLine = m.setting ? el('p', { class: 'ws-chk end' }, shortenDates(m.setting, ymd(new Date()))) : null; // 마지막 세팅 · 다음 예정
  return el('section', { class: 'ws-sec empty', 'aria-label': '루트', 'data-sec': 'routes' }, el('div', { class: 'ws-sec-h' }, el('h3', {}, '루트')),
    el('div', { class: 'ws-empty' }, el('p', {}, '이 외벽의 루트는 아직 비어 있어요'),
      el('p', { class: 'ws-empty-sub' }, withPhoto ? '루트 분포든 벽 전체 사진이든, 하나만 보내 주셔도 돼요.' : '대략 몇 개인지만 알려 주셔도 돼요.'),
      report('루트 분포', '루트 분포 알려 주기'), withPhoto ? report('전경 사진', '전경 사진 보내기') : null), setLine);
}
function routeBars(m, wall) {
  const mine = loadMyGrade(storage); // 내 그레이드 (내 정보): its rows are drawn stronger and counted
  const v = routeView(wall, new Date(), mine, ui.venue); // ui.venue: the 구분 filter opens the indoor or outdoor section first
  if (!v) return routeEmpty(m, wall);
  const head = el('div', { class: 'ws-sec-h' }, el('h3', {}, '루트'));
  const setLine = m.setting ? el('p', { class: 'ws-chk end' }, shortenDates(m.setting, ymd(new Date()))) : null; // 마지막 세팅 · 다음 예정
  const bars = el('div', { class: `rt-bars${v.stale ? ' stale' : ''}` });
  const total = el('p', { class: 'rt-total', 'aria-live': 'polite' });
  const chips = v.views.length > 1 ? el('div', { class: 'rt-chips rt-scroll', role: 'group', 'aria-label': '벽 고르기' }) : null;
  const show = (key) => {
    const x = v.views.find((a) => a.key === key);
    bars.replaceChildren(el('ul', { class: 'gy-list' }, ...x.rows.map((r) => {
      const bar = el('span', { class: 'gy-bar' });
      bar.style.width = `${r.frac * 100}%`;
      return el('li', { class: r.mine ? 'mine' : null }, el('span', { class: 'gy-g' }, r.label), el('span', { class: 'gy-trk', 'aria-hidden': 'true' }, bar), el('span', { class: 'gy-n' }, String(r.n)));
    })));
    total.textContent = `총 ${x.total}개${v.mine ? ` · 내 구간 ${v.mine.label.replace(/(^|[–\s])(?=1\d[a-d])/g, '$15.')} ${x.mineTotal}개` : ''}`;
    for (const b of chips?.children ?? []) b.setAttribute('aria-pressed', String(b.dataset.key === key));
  };
  chips?.append(...v.views.map((x) => {
    const b = el('button', { type: 'button', class: 'rt-chip', 'data-key': x.key }, x.label);
    b.addEventListener('click', () => show(x.key));
    return b;
  }));
  show(v.first);
  return el('section', { class: 'ws-sec', 'aria-label': '루트' }, head, chips, bars, total,
    v.mine ? null : el('p', { class: 'sh-hint' }, '내 정보에서 내 그레이드를 정하면 그 구간이 진하게 보여요.'),
    setLine, el('p', { class: 'ws-chk end' }, v.head)); // the check date at the card's foot, as in 시간 · 이용
}
function sheetParking(m) {
  const { onsite } = m.parkingWhere;
  // the calculated amounts, the same table for one lot or several: a row per priced lot (name, walk, the stay the card is priced for, 하루, 비고 = free span + conditions)
  const f = m.parkingFees;
  const solo = Boolean(f && f.rows.length === 1 && f.rows[0].own); // the wall's own lot is the only priced one: the line above already names it, so no name column
  // columns: 주차장 (only with several lots) · 최초 · 이후 (the rule's own words, when a rule is there) · the stay the card is priced for · 하루 · 비고 (only when some lot has one)
  const hasRule = Boolean(solo && (f.rows[0].first || f.rows[0].step)); // one lot: the rule's parts head their own columns ("최초 30분", "10분당"); several lots each have their own rule, which would not fit the width
  const hasNote = Boolean(f && f.rows.some((r) => r.free || r.note));
  const colCount = (solo ? 0 : 1) + (hasRule ? 2 : 0) + 2 + (hasNote ? 1 : 0);
  const fees = f ? el('div', { class: 'pfee-wrap', role: 'region', 'aria-label': '주차장별 계산한 요금', tabindex: '0' }, el('table', { class: 'pfee' },
    el('caption', {}, `계산한 주차 요금 · ${f.hours}시간 기준`),
    el('thead', {}, el('tr', {}, ...(solo ? [] : [el('th', { scope: 'col' }, '주차장')]), ...(hasRule ? [el('th', { scope: 'col' }, f.rows[0].first?.head ?? '최초'), el('th', { scope: 'col' }, f.rows[0].step?.head ?? '이후')] : []), el('th', { scope: 'col' }, `${f.hours}시간`), el('th', { scope: 'col' }, '하루'), ...(hasNote ? [el('th', { scope: 'col', class: 'pf-note' }, '비고')] : []))),
    el('tbody', {}, ...f.rows.flatMap((r) => {
      // 비고: free span + conditions. Short: in its cell. Long (NOTE_MAX): a line of its own under the row across every column.
      const note = [r.free, r.note].filter(Boolean).join(' · ');
      const long = note.length > NOTE_MAX;
      // under the lot's name one link line, the same place in every row: [icon] 도보 N분 · 길찾기 › (the walk is left out when unknown). It opens 카카오맵 on a search for the wall's name and the lot: a fixed host, the words encoded
      const lotGo = el('a', { class: 'pf-go', href: `https://map.kakao.com/link/search/${encodeURIComponent(`${m.name} ${r.name}`)}`, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${r.name}${r.walk_min ? ` 도보 ${r.walk_min}분` : ''} 카카오맵에서 길찾기 (새 창)` },
        icon('nav'), el('span', {}, r.walk_min ? `도보 ${r.walk_min}분 · 길찾기 ›` : '길찾기 ›'));
      const name = el('th', { scope: 'row' }, r.name, lotGo);
      // one price for any stay: everything after the name becomes one cell (the amount, its short condition after it)
      const cells = r.flat ? [el('td', { colspan: String(colCount - (solo ? 0 : 1)), class: 'pf-flat' }, r.cells.at(-1), note && !long ? el('span', { class: 'pf-cond' }, ` (${note})`) : null)]
        : [...(hasRule ? [el('td', {}, r.first?.cell ?? '–'), el('td', {}, r.step?.cell ?? '–')] : []), el('td', {}, r.cells[Math.max(0, f.cols.indexOf(f.hours))]), el('td', {}, r.cells.at(-1)), ...(hasNote ? [el('td', { class: 'pf-note' }, (long ? '' : note) || '–')] : [])];
      return [el('tr', long ? { class: 'pf-has-more' } : {}, ...(solo ? [] : [name]), ...cells), ...(long ? [el('tr', { class: 'pf-more' }, el('td', { colspan: String(colCount) }, note))] : [])];
    })))) : null;
  // status and the wall's own lot, then the amounts (the typed wording small under them), then the rest (주변 · 참고)
  const head = el('p', { class: 'pv' }, el('b', { class: `pk-word ${m.parking.tone}` }, m.parking.word), onsite.length ? ` · ${onsite.join(' · ')}` : '');
  const rows = m.parkingMore.filter(({ k }) => !(f && k === '요금')).map(({ k, v }) => el('p', { class: 'pnear' }, el('span', { class: 'pn-k' }, k), tightParens(v)));
  return el('div', {}, head, ...(f ? [fees, ...rows] : rows));
}
// 게시판 tab: the wall's one-line board (every post, 더 보기, the form) and the 희노애Rock reviews; made when the tab is first shown
function boardPane(m) {
  boardNotice?.markSeen(m.name); // the board is on screen: its newest post is seen (the card's pill goes back to its plain count)
  const box = boardBox(m.name, { mode: 'full' });
  // the title sits where the other tabs' section titles do (the banner inside the board is hidden under the sheet's sky)
  return [box && el('section', { class: 'ws-sec', 'aria-label': '한 줄 게시판' }, el('div', { class: 'ws-sec-h' }, el('h3', {}, '한 줄 게시판')), el('p', { class: 'ws-chk' }, '오늘 이 벽에서 있었던 일, 한 줄로'), box), blogBox(m.blog)].filter(Boolean);
}
// the sheet's head is the sun card's sky: its tone (양달/응달/밤), the sun on its arc by the viewed time, and the chip saying which.
// Also drawn again while the hours axis is dragged (updateWallHead), so the picture follows the time under the finger.
function sheetHead(wall, at, d, isNow) {
  const tone = sceneTone(d, at);
  const day = tone ? dayWindow(wall, at) : null;
  const sunT = day ? (at.getHours() * 60 + at.getMinutes() - day.sunrise) / (day.sunset - day.sunrise) : 0.5;
  return { tone: tone || 'k-none', sunT, region: wall.region || '', ok: icon('close'), report: Boolean(config.reportEndpoint),
    chip: !tone ? '' : tone.startsWith('k-night') ? '해 진 뒤' : `${isNow ? '지금' : '그 시각'} ${d.lit ? '양달' : '응달'}` };
}
// 외벽 제원 · 시설: every row has its label, in one fixed order so the same item sits at the same place on every wall:
// the wall's numbers (규모 · 권장 로프 · 루트 수 · 난이도), 벽 구성, 편의시설, 이용 환경, the memo lines that carry their own label (찾아가는 길 …), and last the free lines under 안내 (they differ from wall to wall)
function specsList(m, fills = {}) { // fills: fillPane's rows; 높이 goes right after 규모 (or first), 전화 · 공지 at the end, where the wall's contacts would be listed
  const row = (k, v, note) => el('li', {}, el('span', k ? { class: 'mk' } : { class: 'mk', 'aria-hidden': 'true' }, k), el('span', { class: 'mv' }, tightParens(v), note ? el('small', { class: 'sp-note' }, note) : null));
  const env = m.facilityRest.filter((l) => l.group === '이용환경');
  const rest = m.facilityRest.filter((l) => l.group !== '이용환경');
  const free = rest.filter((l) => !l.label);
  const scale = m.specs.findIndex((x) => x.k === '규모') + 1;
  const rows = [
    ...m.specs.slice(0, scale).map((x) => row(x.k, x.v, x.note)),
    fills.height_m,
    ...m.specs.slice(scale).map((x) => row(x.k, x.v, x.note)),
    m.facilityFacts.length && row('벽 구성', m.facilityFacts.join(' · ')),
    m.amenities.length && row('편의시설', m.amenities.map((l) => l.value).join(' · ')),
    env.length && row('이용 환경', env.map((l) => l.value).join(' · ')),
    ...rest.filter((l) => l.label).map((l) => row(l.label, l.value)),
    ...free.map((l, i) => row(i ? '' : '안내', l.value)),
    fills.phone,
    fills.notice_url,
    fills.ask?.specs, // the blanks above that nobody filled: one row, 높이 · 전화 · 공지 (names from fill-fields.js)
  ].filter(Boolean);
  return rows.length ? el('div', { class: 'ws-info' }, el('ul', { class: 'memo-list info' }, ...rows)) : el('div', { class: 'ws-info' });
}
// 연락: the wall's phone and notice (and 오픈채팅) as small pills under the sheet head's name and region, on every tab: for a question that comes up while reading.
// 예약 and 길찾기 are on the card already: not here again. A wall without one of them just has no pill; with none the row is not drawn.
function contactPills(m) {
  return m.links.filter((l) => !l.primary && l.label !== '예약').map(({ label, href, choices, ask }) => {
    const word = LINK_WORD[label] ?? label;
    const a = el('a', { class: `sk-ct${LINK_ICON[label] ? '' : ' txt'}`, href, ...(LINK_ICON[label] ? { 'aria-label': word, title: word } : {}), ...(href.startsWith('tel:') ? {} : { target: '_blank', rel: 'noopener noreferrer' }) },
      LINK_ICON[label] ? icon(LINK_ICON[label]) : word); // a glass disc with the icon alone (as the card's 카메라·공유); a link without an icon keeps its word
    if (choices && ask) a.addEventListener('click', (e) => { e.preventDefault(); pickNav(a.parentElement, choices, null, label); }); // several numbers / notices: pick one (the picker opens under the row)
    return a;
  });
}

// 시간 tab, under 운영시간: "오늘 이 시간이 맞나요?" 맞아요/달라요 (src/tap-view.js). Today only, a wall with a timetable, only while config.reportTap is on,
// and only where the hours are unsure: never checked, checked over TAP_STALE_DAYS ago, or a public holiday the wall's holiday rule doesn't cover.
// The row is told what the sheet shows for the day (shownFromIntervals) so the report says what the user was looking at.
const TAP_STALE_DAYS = 14;
function tapSection(wall, at) {
  const date = ymd(at);
  if (!tapOn() || !hasHours(wall) || date !== ymd(new Date())) return null;
  const age = wall.checked_at ? (at - new Date(`${wall.checked_at}T00:00:00`)) / 864e5 : Infinity;
  if (age <= TAP_STALE_DAYS && !(isHoliday(at) && !wall.holiday)) return null;
  const tapApi = createTapApi({ url: config.boardUrl });
  const st = safeStorage();
  const tapped = st ? loadTapped(st, date) : {};
  const key = tappedKey('wall', wall.name, 'hours', date);
  const shownV = shownFromIntervals(openIntervals(wall, at));
  return el('section', { class: 'ws-sec ws-tap', 'aria-label': '운영시간 확인' }, tapRow({
    prior: tapped[key]?.a ?? null,
    send: async ({ answer, claim }) => {
      const body = buildTap({ wall: wall.name, answer, claim, forDate: date, shown: shownV });
      if (!body) throw new Error('bad tap');
      const id = await tapApi.send(body);
      if (st) { // the same day's tap again overwrites on the server: it counts once in 제보자 · N회
        if (!(key in tapped)) bumpTapCount(st);
        tapped[key] = { a: answer, t: Date.now() };
        saveTapped(st, tapped);
      }
      return id;
    },
    onsite: (id, v) => tapApi.setOnsite(id, v),
  }));
}
// the wall sheet's 시간 tab 날씨 section: the card's 날씨 box for the picked moment + the next hours; filled again when the forecast arrives (loadWeather → wxSheet.fill)
let wxSheet = null;
function weatherSection(wall, m, at) {
  if (noWeather(wall) || !wallPosition(wall)) { wxSheet = null; return null; }
  const body = el('div', { class: 'ws-wx' });
  const sec = sheetCard(vs.live ? '날씨 · 지금' : '날씨', [body], { attrs: { 'data-sec': 'weather' } });
  const head = sec.querySelector('.ws-sec-h');
  const fill = () => {
    const e = wx.byWall.get(wall.name);
    const failed = Boolean(e && !e.hours && !e.current);
    head.hidden = failed; // a failure is one quiet line with its 다시 시도, not a titled card above the hours
    sec.classList.toggle('ws-wx-fail', failed);
    if (failed) queueMicrotask(() => sec.closest('.sx-pane')?.prefer?.('hours')); // no weather: the 시간 tab opens on 운영시간 (the pane is put around this section right after)
    if (failed && wxc.limited()) { // 429: the daily limit, nothing to retry until midnight
      body.replaceChildren(el('p', { class: 'ws-chk ws-wx-none', tabindex: '-1' }, '오늘은 날씨 요청이 많아 잠시 쉬고 있어요'));
      return;
    }
    if (failed) {
      const again = el('button', { type: 'button', class: 'ws-chk-ask' }, '다시 시도'); // the 공휴일 제보 word button: a 44px target on a small line
      again.addEventListener('click', () => { wx.byWall.delete(wall.name); fill(); loadWeather(wall); body.querySelector('p')?.focus(); });
      body.replaceChildren(el('p', { class: 'ws-chk ws-wx-none', tabindex: '-1' }, '날씨를 불러오지 못했어요 · ', again));
      return;
    }
    const hrs = e?.hours ? hoursAhead(e.hours, at, 6) : [];
    const box = e ? weatherBox(m, wall, at) : [];
    const hour = (a) => el('li', {}, el('span', {}, a.label), el('b', {}, `${a.t}°`), a.r >= RAIN_MM ? el('small', {}, `${a.r < 10 ? Math.round(a.r * 10) / 10 : Math.round(a.r)}mm`) : null);
    body.replaceChildren(...(box.length || hrs.length ? [...box, hrs.length ? el('ul', { class: 'wxb-hrs ws-wx-hrs', 'aria-label': '시간별 기온·강수' }, ...hrs.map(hour)) : null] : [el('p', { class: 'ws-chk ws-wx-none', tabindex: '-1' }, !e ? '날씨를 불러오는 중이에요' : '이 시각의 예보가 아직 없어요')]).filter(Boolean));
  };
  fill();
  wxSheet = { name: wall.name, fill };
  loadWeather(wall);
  return sec;
}
const USE_SEG = { specs: '시설', fees: '요금', parking: '주차' }; // the 이용 tab's parts
function buildWallSheet(wallName) {
  const at = shown.at ?? new Date();
  // a wall the last render did not list (a link before the first draw): its one row is built now
  const row = allRows.find((r) => r.wall.name === wallName) ?? buildList(state.walls.filter((w) => w.name === wallName), at, {})[0];
  if (!row) return null; // an unknown wall: nothing opens
  const wall = row.wall;
  const m = modelOf(row, at);
  const d = dialModel(wall, at, { isNow: vs.live, dayLabel: m.dayLabel });
  const hoursG = hoursGrid(wall, at);
  const blocks = { hours: hoursG, fees: feesBlock(wall), sun: seasonSunBlock(wall, at, d, Boolean(hoursG)) };
  const fills = fillPane(m, wall); // 알려 주기 rows for the blanks, placed in 외벽 제원 (높이 · 전화 · 공지) and 주차 (위치)
  const sheet = sheetModel(m, { hours: Boolean(blocks.hours), fees: Boolean(blocks.fees), sun: Boolean(blocks.sun), board: boardOn() || Boolean(m.blog), specsAsk: Boolean(fills.height_m || fills.phone || fills.notice_url || fills.ask?.specs) });
  // what the card's chips cut or only name, told whole here: the closing rule under the hours
  const kv = (k, v) => el('p', { class: 'pnear' }, el('span', { class: 'pn-k' }, k), tightParens(v));
  const content = { ...blocks,
    hours: blocks.hours && el('div', { class: 'ws-hours' }, blocks.hours, ...m.closureNotes.map((n) => kv(n.k, n.v)), blocks.sun, timeLegend(blocks)), // one card (its legend at the foot): the hours, then the seasons' sun under the same axis
    fees: blocks.fees, // the rental is one of the table's own rows (rentalOf reads wall.fees): no second 장비 대여 line above it
    parking: sheetParking(m),
    specs: specsList(m, fills) };
  const secNodes = (key) => sheet[key].filter((s) => !(s.key === 'sun' && blocks.hours)).map((s) => ({ key: s.key, nodes: [sheetSection(m, s, content[s.key], s.key === 'parking' ? (fills.location ?? fills.ask?.parking) : null), s.key === 'hours' ? tapSection(wall, at) : null] }));
  const tabPane = (key) => el('div', { class: 'ws-use' }, key === 'time'
    ? segmentPane('time', '시간 보기', [{ key: 'weather', label: '날씨', nodes: [weatherSection(wall, m, at)] }, { key: 'hours', label: '운영시간', nodes: [!blocks.hours ? sunNoteEl(wall) : null, !blocks.hours ? timeLegend(blocks) : null, ...secNodes('time').flatMap((x) => x.nodes)] }])
    : segmentPane('use', '이용 보기', secNodes('use').map((x) => ({ ...x, label: USE_SEG[x.key] ?? x.key }))));
  const pos = wallPosition(wall);
  const head = { ...sheetHead(wall, at, d, vs.live), contacts: contactPills(m) };
  return {
    head,
    plan: plannerOn() ? plannerLink(config.plannerUrl, wall.id) : null, // 일정 잡기 (the name line): null without a planner url or a wall id = no button
    onClose: () => { const cur = weeklyHours(wall, at).season; go({ type: 'season', name: wall.name, pick: cur, current: cur }); }, // picking the day's own season ends a 하계/동계 preview: it does not outlive the sheet
    tabs: [...sheet.tabs.map((t) => ({
      ...t,
      icon: icon({ time: 'clock', use: 'ticket', routes: 'route', board: 'chat' }[t.key] ?? 'info'),
      pane: t.key === 'routes' ? routePane(m, wall) : t.key === 'board' ? () => boardPane(m) : tabPane(t.key), // 시간 or 이용: cut into parts (날씨 · 운영시간 / 시설 · 요금 · 주차)
    }))],
  };
}
registerWallSheet(buildWallSheet);

// 희노애Rock 후기: a small list (newest first, 3 shown, "외 N개" unfolds the rest in place); the map card keeps one link.
// Titles and dates only via textContent; the urls were checked in normalizeWall (BLOG_URL_RE).
const BLOG_SHOWN = 3;
function blogBox(blog, withList = true, note = '참고용 · 운영시간은 앱 정보가 기준', wrap = false) {
  if (!blog) return null;
  const { posts, first } = blog;
  if (!withList) {
    return el('div', { class: 'blog' }, el('div', { class: 'blog-row' },
      el('a', { class: 'btn sub blog-link', href: first.url, target: '_blank', rel: 'noopener noreferrer' }, first.label)));
  }
  const item = (p) => el('li', {}, el('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer' },
    el('span', { class: 'bt' }, p.title), el('span', { class: 'bd' }, p.date), icon('external')));
  const rest = posts.slice(BLOG_SHOWN);
  const restList = rest.length ? el('ul', { class: 'blog-list', id: `blog-${++rowSeq}` }, ...rest.map(item)) : null;
  if (restList) restList.hidden = true;
  const more = restList && el('button', { type: 'button', class: 'blog-more', 'aria-expanded': 'false', 'aria-controls': restList.id }, `외 ${rest.length}개 더 보기`);
  more?.addEventListener('click', () => {
    const on = more.getAttribute('aria-expanded') !== 'true';
    more.setAttribute('aria-expanded', String(on));
    more.textContent = on ? '접기' : `외 ${rest.length}개 더 보기`;
    restList.hidden = !on;
  });
  return el('div', { class: wrap ? 'blog blog-wrap' : 'blog' }, // wrap: a long title takes lines instead of one ellipsis line (싱글피치 게시판 탭)
    el('p', { class: 'blog-h' }, el('b', {}, '희노애Rock 후기'), el('span', {}, note)),
    el('ul', { class: 'blog-list' }, ...posts.slice(0, BLOG_SHOWN).map(item)),
    restList, more);
}

// ---- 혼잡도 (crowd.js; setup: docs/crowd-setup.md) ----
// The published CSV is read once at load and again at most every 5 minutes (tick); a failed read keeps the last good
// one (or none: the chip hides). Nothing is reported from this page.
const crowd = { byWall: null, at: 0, busy: false };
async function loadCrowd() {
  if (!config.crowdCsvUrl || crowd.busy || Date.now() - crowd.at < 5 * 60e3) return;
  crowd.busy = true;
  try {
    const text = await getText(config.crowdCsvUrl);
    const byWall = new Map();
    for (const r of parseCrowdCsv(text, state.walls.map((w) => w.name), new Date(), { nameOf })) {
      if (!byWall.has(r.wall)) byWall.set(r.wall, []);
      byWall.get(r.wall).push(r);
    }
    crowd.byWall = byWall;
    if (!document.activeElement?.closest('.rows .row, #pin-card')) render(); // else the next minute tick draws it
  } catch { /* quiet: the chip stays as it was */ }
  crowd.at = Date.now();
  crowd.busy = false;
}
const crowdCtx = (name, at) => (!config.crowdCsvUrl ? null : {
  stat: crowd.byWall ? aggregate(crowd.byWall.get(name) ?? [], name, at, { live: vs.live, now: new Date() }) : null,
});
// ---- 날씨·바람 (weather.js; docs/system/permissions.md) ----
// Fetched once per wall when its card is open (render → loadWeather), kept in memory only: a good answer for 3 hours,
// a failed one for 5 minutes so the minute tick does not retry. The card reads it for the picked moment (weatherCtx).
const wx = { byWall: new Map(), busy: new Set() };
async function loadWeather(wall) {
  const pos = wallPosition(wall); // location, else the sun coordinates; none → no request
  if (!pos || noWeather(wall) || wx.busy.has(wall.name)) return; // an indoor or closed wall has no weather to plan for
  const key = `${pos.lat.toFixed(2)},${pos.lng.toFixed(2)}`;
  let known = wx.byWall.get(wall.name);
  if (!known) { // the first ask of this visit: the copy kept in this browser shows at once
    const saved = wxc.get(WXS_KEY, key, { sub: wall.name, stale: wxc.limited() });
    const h = saved && parseForecast(saved.json);
    if (h) {
      known = { hours: h, current: parseCurrent(saved.json), at: saved.at };
      wx.byWall.set(wall.name, known);
      refillOpen(wall.name);
      wxSheet?.name === wall.name && wxSheet.fill();
    }
  }
  if (weatherFresh(known, Date.now()) && !(known.current && Date.now() - known.at > CURRENT_MS)) return; // 실황 is asked again after 15 minutes
  if (wxc.limited()) { // 429 today: no ask; a wall with nothing saved gets the quiet 쉬는 중 line
    if (!known) { wx.byWall.set(wall.name, { hours: null, current: null, at: Date.now() }); wxSheet?.name === wall.name && wxSheet.fill(); }
    return;
  }
  wx.busy.add(wall.name);
  let hours = null, current = null;
  try {
    const j = await wxGet(forecastUrl(pos.lat, pos.lng));
    if (j) { hours = parseForecast(j); current = parseCurrent(j); if (hours || current) wxc.put(WXS_KEY, key, j, { sub: wall.name }); }
  } catch { /* quiet: no forecast line */ }
  if (!hours && !current && known?.hours && wxc.limited()) { wx.busy.delete(wall.name); return; } // a 429 on the refresh keeps the older forecast
  wx.byWall.set(wall.name, { hours, current, at: Date.now() });
  wx.busy.delete(wall.name);
  if (hours || current) refillOpen(wall.name);
  wxSheet?.name === wall.name && wxSheet.fill(); // the open wall sheet's 날씨 section (it asked for the forecast when it opened)
}
// A tap leaves focus on the row's button, so a full render() would be skipped (and the minute tick may be off). Instead only
// the forecast line is put into the open card (first in .m-info, after the 혼잡도 chip, where rowDetails puts it), so nothing
// else in the card (an opened fold, scroll, focus) is touched.
function refillOpen(name) {
  const li = [...document.querySelectorAll('#panel-list .row.is-open')].find((x) => x.wallName === name);
  const row = shown.rows.find((x) => x.wall.name === name);
  const info = li?.querySelector('.m-info');
  if (!info || !row) return;
  const m = modelOf(row, shown.at);
  li.querySelector('.wx-box')?.remove();
  if (row.wall.venue !== 'indoor') li.querySelector('.m-cols')?.append(...weatherBox(m, row.wall, shown.at));
}
// the open card's forecast: render (a shared link opens a row, the minute tick) and toggleRow (a tap opens one without a render)
const weatherFor = (name) => { const r = shown.rows.find((x) => x.wall.name === name); if (r) loadWeather(r.wall); };
const weatherAheadOf = (name, at) => { const hours = wx.byWall.get(name)?.hours; return hours ? hoursAhead(hours, at) : []; };
const weatherCtx = (name, at) => {
  const hours = wx.byWall.get(name)?.hours;
  return hours ? pickHour(hours, at) : null;
};
// the 날씨 상자: the 실황 (Open-Meteo `current`): the temperature now (big), the sky word, wind and gust, 바람 셈 and the observation time. Only while the
// picked moment is now. A picked arrival time has the same box from the forecast hour (m.weather): `예보 14시` where the 실황 would say `14:20 관측`. No 실황 / forecast yet → nothing, not even a gap.
// The first one shown in a visit is counted (stats.js, a name only).
let wxShownSent = false;
function weatherBox(m, wall, at) {
  const fc = !vs.live && m.weather ? weatherCtx(wall.name, at) : null; // the forecast hour the card's chips came from
  const cur = vs.live ? wx.byWall.get(wall.name)?.current : fc && { ...fc, c: wxEntry(wall, at)?.c, hhmm: `예보 ${m.dayLabel && m.dayLabel !== '오늘' ? `${m.dayLabel} ` : ''}${at.getHours()}시` };
  const obs = vs.live ? `${cur?.hhmm} 관측` : cur?.hhmm; // 14:20 관측 · 예보 14시
  if (!cur) return hardForecastBox(m); // not now (or no 실황 yet): a forecast that says 등반 어려움 still leads the card, in one short line
  if (!wxShownSent) { wxShownSent = true; document.dispatchEvent(new CustomEvent('stats:weather-shown')); }
  const strong = windy(cur);
  const cold = belowTempMin(cur.t, ui.tempMin); // 내 기준 기온 미만: the row's badge, here the same word
  const [w, g] = [Math.round(cur.w), Math.round(cur.g)];
  const sky = Number.isFinite(cur.c) ? skyKind(cur.c).text : null;
  const wind = g > w ? `바람 ${w}–${g}m/s` : `바람 ${w}m/s`; // wind and gust as one range: the row stays one line
  const words = [sky, wind].filter(Boolean);
  const pos = wallPosition(wall), when = vs.live ? new Date() : at;
  const c = chipOf({ trusted: true, h: { t: cur.t, c: cur.c, g: cur.g }, night: !!pos && sunPosition(when, pos.lat, pos.lng).altitude < 0, noWet: wall.venue === 'both' || !!wall.tags?.includes('지붕'), noWind: wall.venue === 'both' });
  const hard = m.weather?.hardText ?? null;
  const warn = shown.rows.find((r) => r.wall.name === wall.name)?.wx?.word ?? null; // the list chip's warning word (한파 · 강풍 …): the sheet names the same. Reads the drawn rows (shown.rows, where r.wx lives); allRows are the pre-withDistance originals without it
  return [wxBox({ temp: `${Math.round(cur.t)}°`, sky, words: wind, hard, strong, cold, warn, obs, pic: icon(c.pic), picWarn: !!(warn || hard),
    label: `날씨, ${obs}, 기온 ${Math.round(cur.t)}도, ${words.join(', ')}${warn && !(hard ?? '').includes(warn) ? `, ${warn}` : ''}${strong && warn !== WX_WORD.wind ? ', 바람 셈' : ''}${cold && warn !== WX_WORD.cold ? ', 기온 낮음' : ''}${hard ? `, ${hard}` : ''}` })];
}
// the picked moment is not now: only a forecast that says 등반 어려움 gets a box (temperature, the pill, the rain / wind words); a fair forecast keeps the card as it was
function hardForecastBox(m) {
  const w = m.weather;
  if (!w?.hard) return [];
  const words = [w.rain?.text, w.windy ? '바람 셈' : null, w.wind].filter(Boolean).join(' · ');
  return [wxBox({ temp: w.temp, words, hard: w.hardText, label: `날씨 예보, 기온 ${w.temp.replace('°', '')}도, ${w.hardText}, ${words}` })];
}
// chip: level in words + a 1–3 bar meter (not colour alone)
function crowdBox(m) {
  const c = m.crowd;
  if (!c || c.chip.muted) return []; // "제보 모으는 중" is only an empty state
  return [el('p', { class: `crowd-chip${c.chip.muted ? ' muted' : ''}`, 'data-level': c.chip.level ?? 'none' },
    c.chip.bars ? el('span', { class: 'crowd-meter', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')) : null,
    c.chip.text)];
}
// 닫힘·단축 제보 (closure-warning.js): report-tap's tap-summary, read once after load; off without config.closureWarning + boardUrl, and a failed read leaves the cards as they were
let tapSummary = null;
const warningFor = (row, at) => (tapSummary ? warningOf({ tap: tapSummary, name: row.wall.name, status: row.status, at, now: new Date() }) : null);
async function loadTapSummary() {
  if (!config.closureWarning || !boardOn()) return;
  try {
    const r = await fetch(`${config.boardUrl.replace(/\/+$/, '')}/v1/tap-summary`, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return;
    tapSummary = await r.json();
    renderForWx();
  } catch { /* no summary: no warning */ }
}
const warnHow = (m) => (m.links.some((l) => l.label === '전화') ? '가기 전에 전화로 확인해 주세요' : m.links.some((l) => l.label === '공지 보기') ? '가기 전에 공지를 확인해 주세요' : '가기 전에 확인해 주세요');
const modelOf = (row, at) => cardModel(row, at, {
  warning: warningFor(row, at),
  crowd: crowdCtx(row.wall.name, at), settingNew: settingChanged(row.wall, favs, seen),
  weather: weatherCtx(row.wall.name, at), weatherAhead: weatherAheadOf(row.wall.name, at), stayHours: Number(ui.minHours) || undefined, // the parking cost is told for the stay the filter asks (3/5/8시간+), else the default
});

let rowSeq = 0;
// the list row says only the value ("4시간"); the open card's pill keeps "4시간 가능" (style.css .lf-pre): said once in the group heading, not on every row
const FEW_MIN = 180; // 3 hours or less to stay: said bolder, so a short row stands out among the same-looking rest
const leftParts = (left) => { const m = /^(\d+시간)( 가능)$/.exec(left); return m ? [m[1], el('span', { class: 'lf-pre' }, m[2])] : [left]; };
// what the dimmed / veiled look says in words (a screen reader hears no opacity)
// (비 · 강풍 · 한파 are the chip's own label, card-parts wxSet)
const a11yNotes = (row) => { const n = [row.cold && `기온 ${ui.tempMin}도 미만`].filter(Boolean); return n.length ? `, ${n.join(', ')}` : ''; };
// The row's header, shared by the list row and the map card: sun chip, ♥, name, region, time left, the day bar and its ends. cls: the row's state classes.
function rowHead(row, at, m, isOpen) {
  const { bar } = m; // "내일 10:00 오픈" draws tomorrow's hours, without a now tick; no bar without hours
  const id = `row-x-${++rowSeq}`;
  // 양달/응달/방향 모름 in words, not only the orange band
  const { sun } = m;
  const heart = favBtn(m.name); // ♥ left of the name: the list's own 즐겨찾기 button, beside the row button (style.css .row-fav)
  heart.classList.add('row-fav');
  const btn = el('button', { type: 'button', class: 'row-btn', 'aria-expanded': String(isOpen), 'aria-controls': id },
    el('span', { class: 'l1' },
      sunChip(sun, row.wx), // first: the same column on every open row
      el('span', { class: 'rfav-gap', 'aria-hidden': 'true' }), // the room for the ♥ that sits over it (a button of its own: it cannot live inside the row's button)
      el('span', { class: 'rtext' }, // the name, with the region on its own line under it
        el('span', { class: 'rname', title: m.shortName }, m.shortName),
        // the row says the name and the region only: the extra chip card-model rowExtra offers (새 세팅 · 혼잡) is not drawn for now
        // (it is still in the model; the region wraps out of sight whole when it does not fit, style.css .rsub)
        el('span', { class: 'rsub' },
          newsPill(m.name), // 휴무·동절기·새 암장·개장: anyone looking at the wall sees it, ♥ or not
          m.meta ? el('span', { class: 'rmeta', title: m.meta }, m.meta) : null)),
      el('span', { class: `left${row.status?.state === 'open' && row.status.remainingMin <= FEW_MIN ? ' few' : ''}` }, ...(m.warn ? [el('span', { class: 'warn-left', 'aria-label': `${m.warn.phrase}, 확인 전` }, '확인 전')] : m.leftCard ? [remainPill(m.leftCard)] : leftParts(m.left)), a11yNotes(row) ? el('span', { class: 'sr-only' }, a11yNotes(row)) : null),
      arrow('›', 'row-go')), // the row is a button: the arrow says so (hidden while the card is open)
    bar ? gaugeBar(bar) : null,
    bar ? gaugeEnds(bar) : null); // drawn on every row, shown by css only while the card is open (style.css .gauge-ends)
  const cls = `${m.state}${m.soon ? ' soon' : ''}${isOpen ? ' is-open' : ''}${m.suspended ? ' susp' : ''}${row.cold ? ' cold' : ''}${row.wet ? ' wet' : ''}${row.windy ? ' windy' : ''}`;
  return { btn, heart, id, cls };
}

function timeRow(row, at) {
  const m = modelOf(row, at);
  const isOpen = vs.openName === m.name;
  const { btn, heart, id, cls } = rowHead(row, at, m, isOpen);
  // Only the row that stays open across a re-render is filled now; it is created open, so no transition plays.
  const inner = el('div', { class: 'expand-in' }, ...(isOpen ? rowDetails(m, row.wall, at) : []));
  const li = el('li', { class: `row ${cls}${m.warn ? ' warned' : ''}${m.photo ? ' has-photo' : ''}` });
  li.append(btn, heart, ...(m.photo ? [rowPhoto(m, li)] : []), el('div', { class: 'expand', id }, inner)); // DOM order = tab order: the row, its ♥, the photo's camera and share, then the card (the grid places them by area, not by order)
  // filled on open: a fresh model, so "오늘" is judged on the clock of the click
  li.fill = () => inner.childElementCount || inner.append(...rowDetails(modelOf(row, at), row.wall, at).filter(Boolean));
  li.wallName = m.name;
  li.state = m.state;
  return li;
}

function safeRow(row, at) {
  try {
    return timeRow(row, at);
  } catch {
    const name = row.wall.name;
    return el('li', { class: 'row broken' },
      el('p', { class: 'rname' }, name),
      el('p', { class: 'note' }, '표시 중 오류가 발생했어요.'),
      rowButtons());
  }
}

function setRowOpen(li, open) {
  li.classList.toggle('is-open', open);
  li.querySelector('.row-btn').setAttribute('aria-expanded', String(open));
  if (!open) li.querySelector('.expand-in .setnew')?.remove(); // 세팅일 badge: seen once it was opened
}

// One row open at a time.
function toggleRow(li) {
  if (pinnedName && li.wallName !== pinnedName) pinnedName = null; // opening another card ends the one-wall exception (the row goes at the next draw)
  // Another open card above shrinks while this one opens. Its collapse animates, so the smooth scroll below would aim at a row that is
  // still moving and end up far past it (the bottom of the new card). The other card snaps shut instead: the row stays where it is.
  const others = [...document.querySelectorAll('#panel-list .row.is-open')].filter((o) => o !== li);
  for (const o of others) o.classList.add('snap');
  for (const o of document.querySelectorAll('#panel-list .row.is-open')) setRowOpen(o, false);
  if (others.length) { void li.offsetHeight; requestAnimationFrame(() => requestAnimationFrame(() => others.forEach((o) => o.classList.remove('snap')))); }
  go({ type: 'toggle', name: li.wallName, state: li.state }); // its folds and a previewed season start over
  if (vs.openName !== li.wallName) return;
  document.dispatchEvent(new CustomEvent('stats:card-open')); // stats.js counts it (no wall name in it)
  li.fill();
  weatherFor(li.wallName);
  seeSetting(li.wallName);
  li.querySelectorAll('.blog-more[aria-expanded="true"]').forEach((b) => b.click()); // 후기 목록은 접힌 채로 시작
  setRowOpen(li, true);
  // always bring the opened row up: collapsing the previous one shifts the list, so it may no longer be where it was clicked
  scrollRowTop(li.querySelector('.row-btn'));
}

// Brings a row's title to the top. Folding the time box during a smooth scroll moved the page (foldScrub keeps the list in
// place with scrollBy), which cancelled the scroll halfway: a search pick stopped ~130px down. So fold first, then scroll.
function scrollRowTop(btn, smooth = true) {
  if (!btn) return;
  const aim = () => {
    if (!btn.isConnected) return;
    const target = btn.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(btn).scrollMarginTop) || 0);
    if (scrubBox && !controls.classList.contains('unstuck') && !onMap() && target > scrubBox.offsetHeight) {
      foldHeld = false;
      foldScrub(true);
      fitSticky(); // the pinned height (--stick-h, the rows' scroll-margin) follows the fold now, not on the next ResizeObserver tick
    }
    btn.scrollIntoView({ block: 'start', behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
  };
  aim();
  // Phone: a search pick moves focus off the field, so the keyboard closes after the scroll has started. While it was open the
  // short screen left the controls unstuck (no fold above); the taller screen pins them again, the fold then happens mid-scroll
  // and its scrollBy cancels the scroll halfway. So aim once more when the screen has settled. A touch hands the page back.
  const vv = window.visualViewport;
  if (!vv || !smooth) return;
  let t = 0;
  const stop = () => { clearTimeout(t); vv.removeEventListener('resize', settle); removeEventListener('touchstart', stop); };
  const settle = () => { clearTimeout(t); t = setTimeout(() => { stop(); fitSticky(); aim(); }, 150); };
  vv.addEventListener('resize', settle);
  addEventListener('touchstart', stop, { passive: true });
  setTimeout(() => { if (!t) stop(); }, 1000); // no keyboard closed: nothing to wait for
}

// Opens a wall's card in the list (its group unfolded) and brings it to the top; false when the filters hide it.
// Used by a share link and by the map card's 자세히 보기.
function revealRow(name, { focus = false, smooth = true } = {}) {
  const row = shown.rows.find((r) => r.wall.name === name);
  if (!row) return false;
  go({ type: 'reveal', name, state: row.status.state }); // renders: the open row is built filled, so no transition plays
  seeSetting(name);
  const li = [...document.querySelectorAll('#panel-list .row')].find((r) => r.wallName === name);
  const band = li?.closest('details');
  if (band) band.open = true;
  // the title row, as toggleRow does: it carries the scroll-margin that clears the pinned time axis (the <li> does not, so a
  // card opened from search / the map / a share link had its first line under the axis)
  const btn = li?.querySelector('.row-btn');
  scrollRowTop(btn, smooth);
  if (focus && !$('panel-list').hidden) btn?.focus({ preventScroll: true }); // a picked card (search, 기록): keyboard and screen-reader users land on it
  return true;
}

// ---- render ----
const minuteOf = (d) => d.getHours() * 60 + d.getMinutes();

// filters apply as they are ticked: the ✓ in the 조건 sheet's title row says what they left (the wall list and the crag list alike)
function setSheetCount(n) {
  const sc = $('conditions').querySelector('.sh-count'); // (the sheet's top ✓ says the same count)
  if (sc) { sc.textContent = `${n}곳`; sc.nextElementSibling.setAttribute('aria-label', `완료, ${n}곳`); }
}
// The folded time box (foldScrub below): the day, the time and the count the headline gives, in one line.
function drawFold(n) {
  const f = $('scrubFold');
  if (!f) return; // a cached older page
  const [, m, d] = $('date').value.split('-').map(Number);
  const day = $('scrubDays').querySelector('[aria-pressed="true"]')?.textContent || `${m}/${d}`;
  const time = $('timeOut').textContent;
  f.replaceChildren(el('span', { class: 'fold-t' }, el('b', {}, day), ' ', el('b', { class: 'point' }, time), ' · 갈 수 있는 외벽 ', el('b', { class: 'point' }, `${n}곳`)), el('span', { class: 'fold-x', 'aria-hidden': 'true' }, '바꾸기 ⌄'));
  f.setAttribute('aria-label', `${day} ${time}, 갈 수 있는 외벽 ${n}곳. 눌러서 날짜와 시간 바꾸기`);
}
function setBand(summary, label, n) {
  summary.replaceChildren(el('span', {}, label), el('span', { class: 'count' }, String(n)));
}

let fadeNext = false; // set by the time slider for one render (crossfadeRows)
// The open card stays open when the time moves it to another group (view-state 'shown'). The rebuilt list would move it away
// from under the eye, or into the folded 닫힌 곳 group: so the group it lands in is unfolded (folded back once it leaves) and
// the page is moved by however far the card moved.
let autoBand = null; // the group unfolded for the open card
const openRowBtn = () => (vs.openName && !$('panel-list').hidden
  ? [...document.querySelectorAll('#panel-list .row')].find((r) => r.wallName === vs.openName)?.querySelector('.row-btn') : null);
function keepOpenRowInPlace(oldTop, oldY) {
  const btn = openRowBtn();
  const band = btn?.closest('details') ?? null;
  if (autoBand && autoBand !== band) { autoBand.open = false; autoBand = null; }
  if (band && !band.open) { band.open = true; autoBand = band; }
  if (oldTop == null || !btn) return;
  const dy = btn.getBoundingClientRect().top - oldTop;
  if (dy) scrollBy(0, dy);
  // the time box unfolded for the slider stays unfolded: the page moved, not the user. By what it really moved since before the
  // rebuild: the browser's own scroll anchoring moves it too, and the page end clips a scroll
  if (foldHeld) heldAt += scrollY - oldY;
}
function render() {
  const now = new Date(); // one clock reading per render
  syncSeen();
  // live: the inputs follow the clock (the slider rests at its end before 06:00 / after 23:30, the time used stays real)
  const { date, min, at } = clockView(vs, now);
  if ($('date').value !== date) $('date').value = date;
  if ($('time').value !== String(Math.min(min, 1380))) $('time').value = String(Math.min(min, 1380)); // the slider scale is the axis (06–24) so the thumb sits on the axis; the last pick is 23:00
  { const t = $('time'); t.parentElement.style.setProperty('--fill', String((Number(t.value) - Number(t.min)) / (Number(t.max) - Number(t.min)))); } // the slider's passed stretch, from where its thumb really sits (the hour grid) (style.css #time)
  // An emptied date input (e.g. iOS "Clear") keeps the previous list but always offers the way back.
  $('nowBtn').hidden = vs.live && !Number.isNaN(+at);
  $('stepBack').setAttribute('aria-disabled', String(Number($('time').value) <= Number($('time').min))); // the slider's ends: nothing further
  $('stepFwd').setAttribute('aria-disabled', String(Number($('time').value) >= 1380)); // aria-disabled, not disabled: a disabled button drops the keyboard focus it holds
  if (Number.isNaN(+at)) return;
  if (loadFailed) { // never show "0 open" for a list that did not load
    $('summary').dataset.key = 'load-failed';
    $('summary').textContent = '외벽 목록을 불러오지 못했어요';
    return;
  }
  const isNow = vs.live; // same decision that just set the inputs, so a minute rollover can't flip the wording
  const t = hhmm(at);
  const label = timeLabel(minuteOf(at), isNow);
  $('timeOut').textContent = label;
  $('scrubQ').textContent = askText(at, now, isNow); // 계획형: another day names the weekday
  $('time').setAttribute('aria-valuetext', label);
  nowTag.textContent = t;
  nowTag.style.setProperty('--x', axisFrac(minuteOf(at)));
  $('axis').parentElement.style.setProperty('--x', axisFrac(minuteOf(at))); // .board: the 연결 세로선 under the list follows the same time
  // an hour tick under the time tag would show half a number ("14:00" over "15"): hide the near ones
  // a number or word on the axis hides when it is near the time tag: by minutes, and by where the tag really is (it widens with the text size)
  const chip = nowTag.getBoundingClientRect();
  const crowded = (e) => chip.width > 0 && (() => { const r = e.getBoundingClientRect(); return r.right > chip.left - 6 && r.left < chip.right + 6; })();
  for (const tk of $('axis').querySelectorAll('.t')) tk.classList.toggle('under', Math.abs(tk.min - minuteOf(at)) < (tk.min === 1440 ? 160 : 110) || crowded(tk));
  for (const w of $('axis').querySelectorAll('.dp')) w.classList.toggle('under', Math.abs(w.min - minuteOf(at)) < 130 || crowded(w)); // the word the time tag sits on


  // the stored flag is ignored (not deleted) while no wall has parking data
  const canPark = state.walls.some(hasParking);
  $('parkRow').hidden = !canPark;
  const canRent = state.walls.some(hasRental);
  $('rentRow').hidden = !canRent;
  const rows = buildList(state.walls, at, { minHours: Number(ui.minHours), withBreaks: ui.withBreaks, venue: ui.venue });
  const openTotal = rows.filter((r) => r.status.state === 'open').length;
  const fv = filterView(ui, { canPark, canRent, openTotal, isNow });
  // 내 지역 · 구분 · 주차 narrow every group, the map and the counts alike (scopeRows)
  const scoped = scopeRows(rows, { regions: ui.regions, venue: ui.venue, parkOnly: fv.parkOnly, rentalOnly: fv.rentalOnly });
  const mine = ui.favOnly ? scoped.filter((r) => favs.includes(r.wall.name)) : scoped; // 즐겨찾기만
  const all = withDistance(filterRows(mine), vs.origin);
  if (pinnedName && !all.some((r) => r.wall.name === pinnedName)) { // a wall found by search / 기록 that the filters hide: shown for this visit, the filters stay as they are
    const p = rows.find((r) => r.wall.name === pinnedName);
    if (p) all.push(...withDistance([{ ...p, short: false }], vs.origin));
  }
  for (const r of all) { // the chip at the front of the row: the weather at the arrival hour (wx-chip chipOf); 실내 wears the house, no trusted forecast a plain –
    const w = r.wall, indoor = w.venue === 'indoor', pos = indoor ? null : wallPosition(w);
    r.wx = chipOf({ indoor, trusted: forecastTrusted(at, now), h: indoor ? null : wxEntry(w, at), night: !!pos && sunPosition(at, pos.lat, pos.lng).altitude < 0,
      noWet: w.venue === 'both' || !!w.tags?.includes('지붕'), noWind: w.venue === 'both' });
  }
  allRows = rows;
  shown = { rows: all, at };
  go({ type: 'shown', rows: all }); // the open row was filtered out, or moved to another group: forget it
  const groups = groupRows(all);
  const needOrigin = ui.sortMode === 'distance' && !vs.origin;
  const open = sortRows(groups.open, needOrigin ? 'time' : ui.sortMode);
  // 기온 ○°↑: an outdoor wall whose forecast at the arrival hour is below it sinks (stable), dimmed; no forecast, indoor: left where it is
  const tmin = Number(ui.tempMin) || 0; // (the open card itself is never sunk)
  let coldN = 0, wetN = 0;
  const rws = []; // the open walls that have a forecast for the picked moment (their rowWeather): countWx counts them and those with rain / a gust (the headline's second row)
  const plan = !isNow && ymd(at) !== ymd(now); // another day: the day forecast says whether it rains / blows there (설계 2-7)
  for (const r of open) {
    const h = wxEntry(r.wall, at);
    const rw = rowWeather(h, plan ? pickWeather(r.wall, at) : null, r.wall); // no hour forecast that far ahead (월·화 → 토요일): the day forecast stands in
    if (rw && r.wall.venue !== 'indoor') rws.push(rw);
    const away = !!rw && r.wall.venue !== 'indoor' && r.wall.name !== vs.openName;
    r.cold = away && !!h && belowTempMin(h.t, tmin);
    r.wet = away && rw.wet; // a roof keeps the rain off, a wall with an indoor side has a dry way: they stay
    r.wetText = r.wet ? rw.wetText : null;
    r.windy = away && rw.windy; // a gust to be wary of at the arrival hour (a roof does not stop it); the chip's one badge shows the most decisive: 비 > 돌풍 > 구름
    coldN += Number(r.cold); wetN += Number(r.wet);
  }
  if (coldN || wetN) open.splice(0, open.length, ...sinkBad(open, (r) => r.cold || r.wet));

  for (const [id, on] of Object.entries(fv.pressed)) $(id).setAttribute('aria-pressed', String(on));
  const rc = $('regionChip');
  rc.hidden = !ui.regions.length;
  const rp = $('regionPick'); // 지역을 고르지 않았을 때만 권역 칩 한 줄 (G3); no 권역 drawn = no row
  if (rp) rp.hidden = !fv.regionPick || !rp.firstChild?.childElementCount;
  rc.firstChild.textContent = fv.regionLine;
  rc.setAttribute('aria-label', fv.regionChipLabel);
  for (const box of regionBoxes()) box.checked = ui.regions.includes(box.value);
  syncRegionCounts();
  $('moreFilters').classList.toggle('on', fv.condOn); // the sort row's 조건 names what is on (조건 · 서울 · 3시간+)
  $('moreFilters').firstChild.textContent = fv.condText;
  $('moreFilters').setAttribute('aria-label', fv.condLabel);

  const n = open.length;
  // filters apply as they are ticked: the ✓ in the sheet's title row says what they left (setAttribute below)
  setSheetCount(n);
  // another day names the day (the live region is read without the date input)
  const lead = summaryLead(at, now, isNow);
  const soonestRow = n ? null : groups.closed.reduce((m, r) => { const o = r.status.nextOpenAt; return o && o > at && (!m || o < m.status.nextOpenAt) ? r : m; }, null);
  const soonest = soonestRow?.status.nextOpenAt ?? null; // 0곳: the earliest opening, one button in the empty box
  if (plan) loadWeekendWeather();
  const wxLine = plan && n ? planWxLine(at, countWx(rws)) : null; // the headline's second row counts what the rows show
  const key = `${lead}${n}${wxLine ?? ''}`;
  if ($('summary').dataset.key !== key) { // live region: only on change
    $('summary').dataset.key = key;
    const parts = summaryParts(at, now, isNow, n, '외벽');
    drawSummary(wxLine ? [...parts, [wxLine, false, true]] : parts);
  }
  drawFold(n);
  setSub(at); // the date field and "지금으로" are folded away by default, so this line says the day and that it is not now

  // the order is not alphabetical: say what it is (most time left first). 가까운 순 needs a known origin
  const sortText = { time: '남은 시간 순', distance: '가까운 순', sun: '양달 먼저' }[needOrigin ? 'time' : ui.sortMode] ?? '남은 시간 순';
  $('sortBtn').replaceChildren(icon('sort'), sortText); // a button (the 조건 sheet's 정렬 row), so the order reads as something you can change
  $('sortBtn').setAttribute('aria-label', `정렬: ${sortText}`);
  $('sortBtn').hidden = n === 0; // nothing to sort
  if (n === 0) { $('sortMenu').hidden = true; $('sortBtn').setAttribute('aria-expanded', 'false'); }
  for (const b of $('sortMenu').children) b.setAttribute('aria-checked', String(b.textContent === sortText));
  // the title is for screen readers only: the summary two lines above already says it. The rain/cold note is the one thing left to show here
  $('label-open').textContent = isNow ? '지금 열려 있는 곳' : '이 시각에 열려 있는 곳';
  const note = wetN || coldN ? `${[wetN && '비 오는 곳', coldN && `${tmin}° 미만`].filter(Boolean).join('·')} 아래로` : '';
  $('bandNote').textContent = note; $('bandNote').hidden = !note;
  if (!bandRO && window.ResizeObserver) { bandRO = new ResizeObserver(() => { const b = $('bandOpen'); b.parentElement.style.setProperty('--band-h', b.classList.contains('bare') ? '0px' : `${b.offsetHeight}px`); }); bandRO.observe($('bandOpen')); } // --band-h follows the band's real height (it wraps at large text)
  $('countOpen').textContent = String(n);
  const emptyMsg = document.querySelector('#group-open .empty');
  emptyMsg.hidden = n > 0;
  // the filters hid every open wall: offer the way back right here
  // replaceChildren(null) would print "null": only real nodes go in
  emptyMsg.replaceChildren(...[...(soonestRow && !openTotal ? [] : fv.emptyText.split(/(?<=\.) /)).flatMap((s, i) => (i ? [' ', el('span', { class: 'sent' }, s)] : [el('span', { class: 'sent' }, s)])), // a sentence per line: a break never falls inside one
    fv.national ? el('button', { type: 'button', class: 'clear-filters to-national' }, '전국으로 보기') : null,
    fv.clear ? el('button', { type: 'button', class: 'clear-filters' }, '조건 지우기') : null,
    soonestRow && !openTotal ? el('button', { type: 'button', class: 'soonest-go', 'data-date': ymd(soonest), 'data-min': String(soonest.getHours() * 60 + soonest.getMinutes()) }, `가장 빠른 곳 · ${shortName(soonestRow.wall)} ${whenText(soonest, at, now)} ›`) : null].filter(Boolean)); // nothing is open: the earliest wall is one tap away (it moves the slider to its opening)
  const openTop = openRowBtn()?.getBoundingClientRect().top ?? null, openY = scrollY; // keepOpenRowInPlace, after the groups are rebuilt
  rowSeq = 0;
  const prevRows = fadeNext ? new Map([...$('rows-open').children].map((li) => [li.wallName, li])) : new Map(); // the slider moved: the rows it rebuilds fade from the old ones
  $('rows-open').replaceChildren(...open.map((r) => safeRow(r, at)));
  if (fadeNext) crossfadeRows(prevRows, [...$('rows-open').children], ['.sunbox', '.left', '.bar']);
  fadeNext = false;

  $('group-closed').hidden = !groups.closed.length;
  setBand($('group-closed').querySelector('summary'), isNow ? '지금은 닫힌 곳' : '이 시각에는 닫힌 곳', groups.closed.length);
  $('rows-closed').replaceChildren(...groups.closed.map((r) => safeRow(r, at)));

  $('group-unknown').hidden = !groups.unknown.length;
  setBand($('group-unknown').querySelector('summary'), '운영시간을 아직 몰라요', groups.unknown.length);
  $('rows-unknown').replaceChildren(...groups.unknown.map((r) => safeRow(r, at)));

  if ($('group-suspended')) { // (a cached older page may not have it yet)
    $('group-suspended').hidden = !groups.suspended.length;
    setBand($('group-suspended').querySelector('summary'), '일반 이용이 어려운 곳', groups.suspended.length);
    $('rows-suspended').replaceChildren(...groups.suspended.map((r) => safeRow(r, at)));
  }
  keepOpenRowInPlace(openTop, openY);

  const msg = vs.locateNote || (needOrigin ? '내 위치를 먼저 확인해 주세요.' : '');
  $('findLoc').setAttribute('aria-pressed', String(ui.sortMode === 'distance' && !!vs.origin));
  $('locateMsg').textContent = msg;
  $('locateMsg').hidden = !msg;

  const { pins, unlocated } = mapPins(all);
  $('map-empty').hidden = mapFailed || pins.length > 0;
  $('map-note').textContent = `위치 정보 없음 ${unlocated.length}곳 · ${unlocated.join(', ')}`;
  $('map-note').hidden = !unlocated.length;
  mapApi?.setRows(all, at);
  loadListWeather();
  syncWxCredit();
  showHowtoAuto(); // a first visit: the sheet opens once, over the drawn list
  if (vs.openName) weatherFor(vs.openName); // a cached forecast makes this a no-op on the minute tick
}

// ---- map tab ----
function showPin(row, fromClick) {
  const box = $('pin-card');
  box.classList.remove('enter'); // only a tap plays the slide-in, not the minute re-render
  if (!row) return box.replaceChildren();
  if (fromClick) {
    $('pin-live').textContent = `${row.wall.name} 선택됨`;
    box.classList.add('enter');
  }
  const close = el('button', { type: 'button', class: 'pin-close', 'aria-label': '선택 닫기' }, '✕');
  close.addEventListener('click', () => {
    mapApi?.select(null);
    $('map').focus({ preventScroll: true }); // the button is gone; keep focus on the map
  });
  box.replaceChildren(close, el('ul', { class: 'cards' }, safeCard(row, shown.at)));
  if (!fromClick) return;
  box.scrollTop = 0;
  box.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); // only scrolls when the map's foot is off screen
}

// Esc closes the selected card (a dialog on top gets the key first)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || $('panel-map').hidden || !$('pin-card').childElementCount || document.querySelector('dialog[open]')) return;
  mapApi?.select(null);
  $('map').focus({ preventScroll: true });
});

function mapError() {
  mapFailed = true;
  $('map-error').hidden = false;
  $('map-empty').hidden = true;
}

function mapOk() { // a tile arrived after an early failure: the map works
  mapFailed = false;
  $('map-error').hidden = true;
}

function openMap() {
  if (mapFailed && !mapApi) return;
  if (mapApi) return mapApi.refresh();
  try {
    mapApi = createMap($('map'), {
      onSelect: showPin, onError: mapError, onOk: mapOk,
      covered: () => $('pin-card').offsetHeight,
      // the sticky controls lie over the map's top while the page is scrolled
      coveredTop: () => Math.max(0, controls.getBoundingClientRect().bottom - $('map').getBoundingClientRect().top),
    });
  } catch {
    $('map').hidden = true;
    $('mapLegendBtn').hidden = true;
    return mapError();
  }
  // 2026-11-21: 찾기·범례 버튼을 줌 막대 뒤(.leaflet-top.leaflet-left)로 옮겨 흐름으로 쌓는다(넓은 화면은 #mapFindBtn이 숨어 범례만 줌 아래에 선다)
  const zoomCorner = $('map').querySelector('.leaflet-top.leaflet-left');
  if (zoomCorner) for (const b of [$('mapFindBtn'), $('mapLegendBtn')]) { b.classList.add('leaflet-control'); window.L.DomEvent.disableClickPropagation(b); zoomCorner.append(b); }
  mapApi.setRows(shown.rows, shown.at);
  mapApi.setUser(vs.origin);
  mapApi.refresh(); // measure the now-visible container before fitting
  mapApi.fitAll();
}

const wide = matchMedia('(min-width: 1024px)'); // there the map sits beside the list (style.css): homeView is not used, its toggle is hidden
const onMap = () => ui.homeView === 'map' && !wide.matches; // a phone's full-screen map
// key: 'list' (목록 보기) | 'map' (지도 보기). One screen, no tabs: 목록 ⇄ 지도 is the only switch.
function showTab(key) {
  const view = key === 'map' ? 'map' : 'list';
  if (view !== ui.homeView && !wide.matches) scrollTo(0, 0); // the other view starts at its top
  if (!wide.matches) ui.homeView = view; // side by side there is no view to pick: the phone's choice is kept
  saveUi();
  const split = wide.matches, map = split || onMap();
  $('panel-list').hidden = map && !split;
  $('panel-map').hidden = !map;
  $('find').hidden = map && !split; // the map has a floating search
  const hv = $('homeView');
  if (hv) { // 목록 ⇄ 지도: the button shows where it goes
    hv.replaceChildren(icon(map ? 'list' : 'map'), el('span', { 'aria-hidden': 'true' }, map ? '목록' : '지도')); // a word next to the icon
    hv.setAttribute('aria-label', map ? '목록으로 보기' : '지도로 보기');
  }
  placeFinder();
  fitSticky();
  tick();
  if (map) openMap();
  syncToTop();
}
// 맨 위로: after a screen of scrolling, not over the full-screen map (phones)
let lastY = 0, topTimer = 0;
function syncToTop() {
  const b = $('toTop');
  if (!b) return; // (a cached older index.html has no button)
  const dy = scrollY - lastY;
  lastY = scrollY;
  if (scrollY < innerHeight || onMap() || dy > 2) { // near the top, on the map, or reading downwards: out of the way
    clearTimeout(topTimer);
    b.hidden = true;
  } else if (dy < -2) { // scrolling up: the way back to the filters, for 3 seconds after the last upward move
    clearTimeout(topTimer);
    b.hidden = false;
    topTimer = setTimeout(() => { b.hidden = true; }, 3000);
  } // a tiny move (the tail of a fling) leaves both the button and its timer as they are
}
addEventListener('scroll', syncToTop, { passive: true });
$('homeView')?.addEventListener('click', () => {
  const to = onMap() ? 'list' : 'map';
  showTab(to);
  if (to === 'map') document.dispatchEvent(new CustomEvent('stats:tab-map')); // stats.js still counts the map by its old tab name
});
$('toTop')?.addEventListener('click', () => {
  scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  $('findQ')?.focus({ preventScroll: true }); // the button hides itself: focus moves on
});
wide.addEventListener('change', () => showTab(ui.homeView));

// revealRow, and when the filters hide the wall: show that one wall anyway for this visit (the filters are not touched)
// and reveal it. → true when it was pinned. Used by 내 암장 and 기록.
let pinnedName = null; // the one wall shown although the filters hide it (set by revealClearing / the map's search; dropped on any filter change or when another card opens)
function revealClearing(name) {
  if (revealRow(name, { focus: true })) return false;
  pinnedName = name;
  render();
  revealRow(name, { focus: true });
  return true;
}

// for this visit only: nothing is saved until a filter is changed
function clearFilters() {
  Object.assign(ui, CLEARED, { regions: [] });
  sheetForm.elements.minHours.value = ui.minHours;
  sheetForm.elements.venue.value = ui.venue;
  render();
}

// ---- find one wall: searches every wall (filters ignored); a pick says what to do with the chosen wall ----
function wireFind(input, box, onPick, off = () => false) { // off(): the box shows no hits
  const draw = () => {
    const q = off() ? '' : input.value.trim();
    box.hidden = !q;
    if (!q) return box.replaceChildren();
    const hits = searchPicks(state.walls, q, { origin: vs.origin }).slice(0, 30);
    box.replaceChildren(...(hits.length ? hits.map(({ wall: w, km }) => {
      const b = el('button', { type: 'button', class: 'la-hit' },
        el('span', { class: 'pn' }, w.name),
        w.region ? el('span', { class: 'pr' }, w.region) : null);
      b.addEventListener('click', () => {
        input.value = '';
        draw();
        onPick(w);
      });
      return el('li', {}, b);
    }) : [el('li', { class: 'none' }, '맞는 암장이 없어요. 이름 일부로 찾아보세요.')]));
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => { // Enter with exactly one match opens it (not while a Korean IME is composing)
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.isComposing && box.querySelectorAll('.la-hit').length === 1) box.querySelector('.la-hit').click();
  });
  return draw;
}
// one search under the headline for 목록 and 지도: a pick reveals the row (목록), or selects the pin (지도; both when the list and map sit side by side)
function pickOnMap(w) {
  if (!wallPosition(w)) return toast('이 암장은 지도에 위치 정보가 없어요');
  if (!shown.rows.some((r) => r.wall.name === w.name)) {
    pinnedName = w.name;
    render();
    toast('조건에 안 맞지만 이 암장만 보여 드려요');
  }
  mapApi?.select(w.name, true);
}
wireFind($('findQ'), $('findHits'), (w) => {
  if (onMap()) return pickOnMap(w);
  if (revealClearing(w.name)) toast('조건에 안 맞지만 이 암장만 보여 드려요');
  if (wide.matches && wallPosition(w)) mapApi?.select(w.name, true);
});
// a 320px phone leaves the field about 78px for its hint: "암장·지역 찾기" would be cut to "암장·…"
const narrowPhone = matchMedia('(max-width: 330px)');
const fitFindHint = () => { $('findQ').placeholder = narrowPhone.matches ? '찾기' : '암장·지역 찾기'; };
fitFindHint();
narrowPhone.addEventListener('change', fitFindHint);

// the map's floating magnifier: opens a search bar over the map; a pick selects that pin (filters cleared if they hid it)
function setMapFind(open) {
  $('mapFind').hidden = !open;
  $('mapFindBtn').hidden = open;
  $('mapFindBtn').setAttribute('aria-expanded', String(open));
  if (open) $('mapFindQ').focus();
  else $('mapFindBtn').focus();
}
const drawMapFind = wireFind($('mapFindQ'), $('mapFindHits'), (w) => {
  setMapFind(false);
  pickOnMap(w);
});
$('mapFindBtn').addEventListener('click', () => { setMapLegend(false, false); setMapFind(true); });
// 핀 설명: a popover over the map, opened by the ⓘ button (it used to sit under the map, off screen)
function setMapLegend(open, focus = true) {
  $('mapLegend').hidden = !open;
  $('mapLegendBtn').hidden = open;
  $('mapLegendBtn').setAttribute('aria-expanded', String(open));
  if (focus) (open ? $('mapLegendClose') : $('mapLegendBtn')).focus();
}
// 계산 기준 (the ! on the sun card) is a bubble: a tap anywhere else, or Esc, closes it
document.addEventListener('click', (e) => { for (const d of document.querySelectorAll('.sun-why[open]')) if (!d.contains(e.target)) d.open = false; });
document.addEventListener('keydown', (e) => { // capture phase: Esc closes the bubble only, not the open card under it too
  if (e.key !== 'Escape') return;
  const open = document.querySelectorAll('.sun-why[open]');
  if (!open.length) return;
  for (const d of open) d.open = false;
  e.stopPropagation();
}, true);
$('mapLegendBtn').addEventListener('click', () => setMapLegend(true));
$('mapLegendClose').addEventListener('click', () => setMapLegend(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('mapLegend').hidden) setMapLegend(false); });
$('mapFindClose').addEventListener('click', () => { $('mapFindQ').value = ''; drawMapFind(); setMapFind(false); });
$('mapFindQ').addEventListener('keydown', (e) => { if (e.key === 'Escape') $('mapFindClose').click(); });

// ---- controls ----
// fixed axis: hour ticks, grid lines, the chosen-time tag
for (let h = AXIS_LABELS[0]; h <= AXIS_LABELS.at(-1); h++) {
  if (!AXIS_LABELS.includes(h)) { // an hour without a number: a small tick, so the slider's 1-hour step can be counted
    const m = el('span', { class: 'm' });
    m.style.setProperty('--x', axisFrac(h * 60));
    $('axis').append(m);
  }
}
for (const h of AXIS_LABELS) {
  const tk = el('span', { class: 't' }, String(h).padStart(2, '0')); // 06 · 12 · 18 · 24, as the time tag writes them
  tk.min = h * 60;
  tk.style.setProperty('--x', axisFrac(h * 60));
  $('axis').append(tk);
  const g = el('span', { class: 'grid' });
  g.style.left = axisX(h * 60);
  $('plot').append(g);
}
for (const d of DAYPARTS) { // 오전 · 오후 · 저녁 in the middle of each part
  const w = el('span', { class: 'dp' }, d.text);
  w.min = (d.from + d.to) * 30;
  w.style.setProperty('--x', axisFrac(w.min));
  $('axis').append(w);
}
const nowTag = el('span', { class: 'nowtag' });
$('axis').append(nowTag);
// the axis is a time control for the pointer: a tap goes to the nearest hour of where it landed, a drag along it follows the finger hour by hour
// (the list is scrolled and the time box folded, so it is the one time control in view; aria-hidden: the keyboard has the slider and ±1시간)
{
  const axisEl = $('axis');
  let axDrag = null; // { id, x0, drag, last } while a pointer is down on the axis
  const axisPick = (e) => {
    const r = axisEl.getBoundingClientRect();
    const h = axisHourAt(e.clientX - r.left, r.width, parseFloat(getComputedStyle(axisEl).getPropertyValue('--pad')) || 0); // the ticks' own inset
    if (!$('date').value || h === axDrag.last) return;
    axDrag.last = h;
    go({ type: 'pick', date: $('date').value, min: h });
  };
  const axisEnd = (e) => {
    if (axDrag?.id !== e.pointerId) return;
    if (e.type === 'pointerup' && !axDrag.drag) axisPick(e); // a tap, no drag
    if (axisEl.hasPointerCapture(e.pointerId)) axisEl.releasePointerCapture(e.pointerId);
    axDrag = null;
  };
  axisEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || axDrag) return;
    axDrag = { id: e.pointerId, x0: e.clientX, drag: false, last: null };
    axisEl.setPointerCapture(e.pointerId);
  });
  axisEl.addEventListener('pointermove', (e) => {
    if (axDrag?.id !== e.pointerId || (!axDrag.drag && Math.abs(e.clientX - axDrag.x0) < 4)) return;
    axDrag.drag = true;
    axisPick(e);
  });
  axisEl.addEventListener('pointerup', axisEnd);
  axisEl.addEventListener('pointercancel', axisEnd);
}

// 완료 ✓ at the right end of the title row of the sheets people scroll in and read or set (the title row stays in view, style.css .sh-head):
// the only way out besides the backdrop, Esc and the back button; what is changed there is saved as it is changed, so there is no second button to read. The 조건 sheet also says how many walls its choices leave (updated in render).
for (const id of ['conditions', 'howto', 'settings-sheet', 'about-sheet', 'gear-sheet', 'contact']) {
  const dlg = $(id), head = dlg?.querySelector('.sh-head');
  if (!head || head.querySelector('.sh-okw')) continue;
  const ok = el('button', { type: 'button', class: 'sh-ok', 'aria-label': '완료' }, icon('close'));
  ok.addEventListener('click', () => dlg.close());
  head.append(el('div', { class: 'sh-okw' }, id === 'conditions' ? el('small', { class: 'sh-count', 'aria-hidden': 'true' }) : null, ok));
}
const sheet = $('conditions');
// 지도 보기(폰): the time box (.scrub, with the day chips in it) sits under the filter row so the time can be moved while looking at the map; on the list it is back in its place before section.board.
let mapBar = null; // 지도 보기 툴바 줄(placeFinder가 처음 쓸 때 만든다)
const scrubHome = { filters: document.querySelector('#search .filters'), scrub: document.querySelector('.scrub') };
function placeFinder() {
  if (!finderReady) return;
  const { filters, scrub } = scrubHome;
  const more = $('moreFilters'); // 조건 is the sort row's first control; the map has no sort row, so it goes in the time box, right under the '갈 수 있는 외벽 N곳' line (.scrub-ans), left edge
  const ans = scrub.querySelector('.scrub-ans');
  // 2026-11-21: 지도에서는 조건(왼쪽)·목록(오른쪽)이 .scrub-ans 아래 한 줄(.map-bar)에 서고 머리줄(.filters)은 숨는다. 줄 요소는 한 번만 만든다.
  const hv = $('homeView'), bar = (mapBar ||= el('div', { class: 'map-bar' }));
  document.documentElement.classList.toggle('on-map', onMap()); // 지도 보기(폰) 표시: style.css html.on-map
  if (onMap()) {
    if (scrub.previousElementSibling !== filters) filters.after(scrub); // keep .scrub right after the filters
    if (bar.previousElementSibling !== ans) ans.after(bar);
    if (more.parentElement !== bar) bar.append(more);
    if (hv.parentElement !== bar) bar.append(hv);
  } else {
    if (scrub.previousElementSibling !== document.getElementById('locateMsg')) $('locateMsg').after(scrub);
    if (more.parentElement !== $('bandOpen')) $('countOpen').after(more);
    if (hv.parentElement !== filters) filters.append(hv); // 원래 자리: .filters 안 .find 다음
    bar.remove();
  }
}
finderReady = true;
placeFinder();
const sheetForm = sheet.querySelector('form');
for (const k of ['minHours', 'venue', 'tempMin']) sheetForm.elements[k].value = ui[k];

const setUi = (k, v) => {
  pinnedName = null; // a filter change ends the one-wall exception
  ui[k] = v;
  if (k === 'minHours' || k === 'venue' || k === 'tempMin') sheetForm.elements[k].value = v;
  if (k === 'sortMode') go({ type: 'sort' });
  saveUi();
  render();
};

$('search').addEventListener('submit', (e) => e.preventDefault());
$('search').addEventListener('input', (e) => { // the slider (.scrub) is inside the form
  if (e.target.id !== 'time') return; // (the day is the hidden #date, set by render and the day chips)
  if (Number($('time').value) > 1380) $('time').value = '1380';
  fadeNext = true;
  go({ type: 'pick', date: $('date').value, min: Number($('time').value) });
});
$('nowBtn').addEventListener('click', () => go({ type: 'now' }));
for (const [id, dir] of [['stepBack', -1], ['stepFwd', 1]]) { // ±1시간: the next / previous whole hour, the slider's own pick
  $(id).addEventListener('click', () => {
    if ($(id).getAttribute('aria-disabled') === 'true') return; // at the slider's end: nothing further
    go({ type: 'pick', date: $('date').value, min: stepMinute(Number($('time').value), dir) });
  });
}
// first visit only: the handle moves once and a line says to slide it; the first touch of the slider or ±1시간 ends it for good (this device)
if (config.scrubHint) mountScrubHint({ range: $('time'), host: document.querySelector('.scrub-hintbox'), watch: [$('time'), $('stepBack'), $('stepFwd')], hinted: ui.scrubHinted, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, onSeen: () => { ui.scrubHinted = true; saveUi(); } });
for (const li of document.querySelectorAll('[data-sunkey]')) li.prepend(icon(li.dataset.sunkey)); // the key under the list
$('findLoc').prepend(icon('pin')); // the search field's own 내 위치: one press = 가까운 순 (asks for the position the first time), a second = back to 남은 시간 순
$('findLoc').addEventListener('click', () => { if ($('findLoc').classList.contains('busy')) return; chooseSort(ui.sortMode === 'distance' ? 'time' : 'distance'); }); // not while the position is being asked: the late answer would undo the press
// 정렬 (the 조건 sheet): 가까운 순 needs a position; without one, don't keep it on (and saved) while the list stays as it was; the note stays
let locateWhy = ''; // why the last 가까운 순 failed: the sheet says it, because the sort goes back to 남은 시간 순
function chooseSort(mode) {
  locateWhy = '';
  setUi('sortMode', mode);
  if (mode === 'sun') document.dispatchEvent(new CustomEvent('stats:sun-filter')); // stats.js counts it (turning on only; the event keeps its old name)
  if (mode === 'distance' && !vs.origin) locate().then((why) => {
    if (!why || ui.sortMode !== 'distance') return;
    locateWhy = why;
    ui.sortMode = 'time'; saveUi(); render();
  });
}

$('regionChip').addEventListener('click', () => {
  setUi('regions', []);
  $('findQ').focus(); // the chip is gone
});

// 내 지역: one checkbox pill per 권역 the walls are in (areas.js, at most 5), in both the 조건 sheet and 내 정보 (the same choice);
// rebuilt only when that list changes, so a tick keeps focus. The saved choice is pruned to 권역 that exist (not while the list
// failed to load).
const regionBoxes = () => document.querySelectorAll('#regionOptsC input[name="region"], #regionPick input[name="region"]');
let regionKey = null;
function syncRegions() {
  if (!state.walls.length) return;
  const areas = areaList(state.walls);
  ui.regions = cleanRegions(ui.regions, areas.map((a) => a.name));
  if ($('regionRowC')) $('regionRowC').hidden = !areas.length; // (a cached older page may lack the 조건 row)
  const key = areas.map((a) => `${a.name}:${a.total}`).join('|');
  if (regionKey === key) return;
  regionKey = key;
  for (const id of ['regionOptsC', 'regionPick']) {
    $(id)?.replaceChildren(el('div', { class: 'rg-list' }, ...areas.map((a) => el('label', {},
      el('input', { type: 'checkbox', name: 'region', value: a.name }), a.name, el('span', { class: 'rg-n' }, `${a.total}`)))));
  }
}
function syncRegionCounts() {
  // the position is asked for by 가까운 순; the row says where it stands, and its button is the retry
  const near = ui.sortMode === 'distance';
  $('locateRow').hidden = !near && !locateWhy;
  $('locateHint').textContent = near ? (vs.origin ? '내 위치 기준으로 가까운 곳부터 보여요.' : '내 위치를 찾는 중이에요.') : `${locateWhy} 남은 시간 순으로 보여요.`;
}

$('moreFilters').addEventListener('click', () => sheet.showModal());
// 정렬 menu: two choices under the button (the 조건 sheet keeps the same row)
const sortMenuShow = (on) => { $('sortMenu').hidden = !on; $('sortBtn').setAttribute('aria-expanded', String(on)); if (on) ($('sortMenu').querySelector('[aria-checked="true"]') ?? $('sortMenu').firstElementChild).focus({ preventScroll: true }); };
$('sortBtn').addEventListener('click', () => sortMenuShow($('sortMenu').hidden));
document.addEventListener('click', (e) => { // 가장 빠른 곳: the slider goes to its opening
  const b = e.target.closest('.empty .soonest-go');
  if (b) go({ type: 'pick', date: b.dataset.date, min: Number(b.dataset.min) });
});
$('sortMenu').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) { chooseSort(b.dataset.sort); sortMenuShow(false); $('sortBtn').focus(); }
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#sortBtn, #sortMenu')) sortMenuShow(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('sortMenu').hidden) { e.preventDefault(); /* 시트(dialog)까지 닫지 않는다 */ sortMenuShow(false); $('sortBtn').focus(); } });
document.addEventListener('focusin', (e) => { if (!e.target.closest('#sortBtn, #sortMenu')) sortMenuShow(false); }); // Tab out of the menu closes it
$('sortMenu').addEventListener('keydown', (e) => { // a menu: ↑ ↓ Home End move between the two choices
  const items = [...$('sortMenu').children]; const i = items.indexOf(document.activeElement);
  const to = { ArrowDown: (i + 1) % items.length, ArrowUp: (i - 1 + items.length) % items.length, Home: 0, End: items.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault(); items[to].focus();
});
addEventListener('scroll', () => { if (!$('sortMenu').hidden) sortMenuShow(false); }, { passive: true }); // scrolled away from its button: close it
document.querySelector('#group-open .empty').addEventListener('click', (e) => {
  if (e.target.closest('.to-national')) {
    setUi('regions', []);
    return $('findQ').focus(); // the chip is gone
  }
  if (!e.target.closest('.clear-filters')) return;
  Object.assign(ui, CLEARED);
  sheetForm.elements.minHours.value = '0';
  sheetForm.elements.venue.value = 'any';
  sheetForm.elements.tempMin.value = '0';
  sheetForm.elements.sun.value = 'any';
  saveUi();
  render();
  $('findQ').focus(); // the chip is gone; land on the first filter
});

// The date + slider stick to the top while the list scrolls (the filter row above them scrolls away: a
// negative sticky top), unless even that would take over a short screen (landscape phone, large text):
// then all of it scrolls away as before. The timetable axis sticks just below.
// The 목록/지도 bar sticks right under that part (--ctl-h), and --stick-h covers both.
const controls = $('search');
const fitSticky = () => {
  // the phone's map fills what is left under the controls at the top of the page (style.css #map --map-top), so its pin card is on screen without scrolling
  const top = onMap() && !$('panel-map').hidden ? `${Math.round($('map').getBoundingClientRect().top + scrollY)}px` : '';
  if (document.documentElement.style.getPropertyValue('--map-top') !== top) {
    document.documentElement.style.setProperty('--map-top', top);
    if (top) mapApi?.refresh();
  }
  if (controls.hidden) { // 기록 tab: only the tab bar sticks
    controls.classList.remove('unstuck');
    const root = document.documentElement.style;
    root.setProperty('--ctl-h', '0px');
    root.setProperty('--stick-h', '0px');
    return;
  }
  const scrub = controls.querySelector('.scrub'); // 3a: the slider box is in the 도착 시각 sheet, so nothing of the header stays pinned (the axis pins under the top)
  if (!scrub) {
    controls.classList.add('unstuck');
    document.documentElement.style.setProperty('--ctl-h', '0px');
    document.documentElement.style.setProperty('--stick-h', '0px');
    return;
  }
  const box = controls.getBoundingClientRect();
  const off = Math.max(0, scrub.getBoundingClientRect().top - box.top - 4);
  const h = box.height - off;
  const axisH = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.625; // .axis height, sticks below
  const bandH = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2; // the list's heading line sticks under the axis too
  const stick = h + axisH + bandH <= innerHeight * 0.35; // the time box holds the answer too: 35% keeps it pinned on a 640px phone even with 지금으로 showing (a 667px+ phone is already inside 33%)
  controls.classList.toggle('unstuck', !stick);
  controls.style.top = stick ? `${-off}px` : '';
  const root = document.documentElement.style;
  root.setProperty('--ctl-h', `${stick ? h : 0}px`);
  root.setProperty('--stick-h', `${stick ? h : 0}px`);
};
new ResizeObserver(fitSticky).observe(controls);
addEventListener('resize', fitSticky);
fitSticky();
// The time box folds to one line (#scrubFold) once the list has scrolled a box's height, so it stops taking the top of the screen;
// back at the top it unfolds, and a press on the line unfolds it for as long as the list stays scrolled (held). Folding moves the
// list up by the box's height, so the scroll is moved with it (the list stays where the eye is): fold at scrollY > box height,
// leaves scrollY > the folded line, far above the unfold point (8px), so the two never chase each other.
const scrubBox = controls.querySelector('.scrub');
let foldHeld = false, foldFrame = 0, heldAt = 0;
function foldScrub(on, keep) {
  if (!scrubBox || scrubBox.classList.contains('is-folded') === on) return;
  const y0 = document.querySelector('.board').getBoundingClientRect().top;
  const hadFocus = on && scrubBox.contains(document.activeElement);
  scrubBox.classList.toggle('is-folded', on);
  if (hadFocus) $('scrubFold').focus({ preventScroll: true });
  $('scrubFold').setAttribute('aria-expanded', String(!on));
  if (keep) scrollBy(0, document.querySelector('.board').getBoundingClientRect().top - y0);
}
function syncFold() {
  foldFrame = 0;
  if (!scrubBox || controls.hidden || onMap()) return foldScrub(false);
  if (scrollY <= 8) { foldHeld = false; foldScrub(false); }
  else {
    if (foldHeld && scrollY > heldAt + 48) foldHeld = false; // scrolled the list down past where it was opened: fold again
    if (!foldHeld && !controls.classList.contains('unstuck') && scrollY > scrubBox.offsetHeight) foldScrub(true, true);
  }
}
addEventListener('scroll', () => { if (!foldFrame) foldFrame = requestAnimationFrame(syncFold); }, { passive: true });
$('scrubFold')?.addEventListener('click', () => { foldHeld = true; foldScrub(false, true); heldAt = scrollY; $('time').focus({ preventScroll: true }); });
sheet.addEventListener('change', (e) => {
  if (e.target.name === 'minHours') setUi('minHours', e.target.value);
  if (e.target.name === 'venue') setUi('venue', cleanVenue(e.target.value));
  if (e.target.name === 'tempMin') setUi('tempMin', cleanTemp(e.target.value));
});
// 내 지역 is chosen in the 조건 sheet; 내 정보 shows it as a line (profile-view.js wires the rest of it)
for (const id of ['regionOptsC', 'regionPick']) {
  $(id)?.addEventListener('change', (e) => {
    setUi('regions', [...e.currentTarget.querySelectorAll('input[name="region"]:checked')].map((b) => b.value));
    if (id === 'regionPick') $('moreFilters').focus({ preventScroll: true }); // the row hides itself once a region is picked: focus goes to the 조건 button, which then names it
    if (e.target.checked) document.dispatchEvent(new CustomEvent('stats:region-set')); // stats.js counts it (no region name in it)
  });
}
$('parkingOnly').addEventListener('click', () => setUi('parkingOnly', !ui.parkingOnly));
$('rentalOnly').addEventListener('click', () => setUi('rentalOnly', !ui.rentalOnly));
$('favOnly').addEventListener('click', () => setUi('favOnly', !ui.favOnly));
$('withBreaks').addEventListener('click', () => setUi('withBreaks', !ui.withBreaks));

// Asks for the position (only on a press: 내 위치 / 가까운 순 in the list); kept in memory only.
// sort: the list's 가까운 순 (sets ui.sortMode and the note under the list); no caller passes false now (the 기록 sheet
// never asks for the position). → Promise<string>: '' once the position is in, else why not.
function locate(sort = true) {
  $('findLoc').classList.add('busy');
  $('findLoc').setAttribute('aria-busy', 'true');
  return new Promise((done) => {
    const fail = (why) => {
      $('findLoc').classList.remove('busy');
      $('findLoc').removeAttribute('aria-busy');
      go({ type: 'locateFailed', why, sort });
      done(why);
    };
    if (!window.isSecureContext || !navigator.geolocation) {
      return fail(window.isSecureContext
        ? '이 브라우저는 위치를 지원하지 않아요.'
        : '이 주소(http)에서는 내 위치를 쓸 수 없어요. https 주소에서 열어 주세요.');
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        $('findLoc').classList.remove('busy');
        $('findLoc').removeAttribute('aria-busy');
        go({ type: 'located', origin: { lat: p.coords.latitude, lng: p.coords.longitude }, sort }); // sort: also 가까운 순, saved
        done('');
      },
      (err) => fail(err.code === 1
        ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.'
        : '위치를 가져오지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}
$('locate').addEventListener('click', () => locate());

document.querySelector('main').addEventListener('click', (e) => {
  const b = e.target.closest('.cards button[data-act], .rows button[data-act]');
  if (b?.dataset.act === 'report') document.dispatchEvent(new CustomEvent(`wall:${b.dataset.act}`, { detail: b.dataset.kind ? { name: b.dataset.name, kind: b.dataset.kind, kinds: [b.dataset.kind] } : b.dataset.name }));
  const rb = e.target.closest('.row-btn');
  if (rb) toggleRow(rb.parentElement);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (onMap()) { // Esc closes the map card, like its close button
    if (!$('pin-card').childElementCount) return;
    mapApi?.select(null);
    return $('map').focus({ preventScroll: true });
  }
  const li = document.querySelector('#panel-list .row.is-open');
  if (!li) return;
  const hadFocus = li.contains(document.activeElement);
  toggleRow(li);
  if (hadFocus) li.querySelector('.row-btn').focus();
});

onChange(() => {
  syncRegions();
  render();
});
// Live mode follows the clock. The minute tick skips while the map card's "자세히" is open, or while focus
// sits on something the re-render would replace and can't be matched again: the map card (its close button
// too) and "조건 지우기". Focus in a list row goes back to the same control of the same row, without scrolling.
const FOCUSABLE = 'button, a, summary';
const tick = () => {
  syncTheme();
  const a = document.activeElement;
  const li = a?.closest('.rows .row');
  const i = li ? [...li.querySelectorAll(FOCUSABLE)].indexOf(a) : -1;
  // not skipped: the 혼잡도 CSV if due, then the re-render
  const ran = go({ type: 'tick', hidden: document.hidden, detailsOpen: !!document.querySelector('.more[open]'), focusHeld: !!a?.closest('#pin-card, .clear-filters, #pick, #sched, #schedAsk, #schedNote') }).length;
  if (!ran || !li) return;
  const now = [...document.querySelectorAll('#panel-list .row')].find((r) => r.wallName === li.wallName);
  (now?.querySelectorAll(FOCUSABLE)[i] ?? now?.querySelector('.row-btn'))?.focus({ preventScroll: true });
};
setInterval(tick, 60_000);
document.addEventListener('visibilitychange', tick);

// A saved list keeps the app working as before; the shipped list is fetched only without one.
// Visitors always read the shipped list (their old saved copy is only a fallback when it can't load);
// (the utility is view-only: no ?edit).
async function loadList() {
  const saved = loadWalls(storage)?.filter((w) => w.name);
  try {
    return await fetchNational();
  } catch {
    return saved?.length ? saved : null;
  }
}

function showLoadError(on) {
  loadFailed = on;
  $('load-error').hidden = !on;
  document.body.classList.toggle('load-failed', on);
}

$('report-note').hidden = !config.reportEndpoint; // the footer promises 제보 only once the form is connected

$('retry').addEventListener('click', async () => {
  $('retry').disabled = true;
  const list = await loadList();
  $('retry').disabled = false;
  if (!list) return;
  state.walls = list;
  setWalls(list);
  showLoadError(false);
  syncRegions();
  render();
});

// 문의 (앱 정보 sheet): no mail address is shown; the line opens the 문의 sheet, which posts to the board Worker (src/contact-view.js). Off (config.contact / boardUrl empty) = the line stays hidden.
$('contact-note').hidden = !contactOn();
const contactView = createContactView();
$('contactOpen').addEventListener('click', () => contactView.open());

const [first, loadedPartners] = await Promise.all([loadList(), loadPartners()]); // loaded together: a share link opens its sheet right after, and the 근처 line is decided then (loadPartners never rejects; a failed load = no tab)
partners = loadedPartners;
state.walls = first ?? [];
setWalls(state.walls);
favs = loadFavs(storage, allWalls());
showLoadError(!first);
// A share link (?wall=이름) opens that wall's card. The saved filters may hide it, so this visit drops them (in
// memory only; nothing is saved until the visitor changes a filter) and starts on the list.
const sharedWall = wallFromSearch(state.walls, location.search);
if (sharedWall) linkHeld = holdLinkView(ui, { ...CLEARED, regions: [], homeView: 'list' });
if (!sharedWall && homeViewFromSearch(location.search) === 'map') { // ?tab=map (the planner's 지도로 보기 link): this visit opens the map, the saved view stays (in memory only)
  linkHeld = holdLinkView(ui, { homeView: 'map' });
  const u = new URL(location.href);
  u.searchParams.delete('tab');
  history.replaceState(null, '', u);
}
syncRegions();
render();
{ // the loading screen (index.html #boot) leaves once the first list is drawn
  const boot = document.getElementById('boot');
  boot?.classList.add('done');
  setTimeout(() => boot?.remove(), 400);
}
loadCrowd();
boardNotice?.load();
loadTapSummary();
// 빈칸 채우기: the shown reports go over the blank fields once, after the first draw; a failure leaves the list as it is (no retry, no cache)
if (fillApi) fillApi.list().then((fills) => { if (fills.length) { state.walls = applyFills(state.walls, fills); render(); } }).catch(() => {});
if (sharedWall) {
  revealRow(sharedWall.name, { smooth: false }); // instant: the sheet opening next locks the page scroll (html overflow hidden), which would stop a smooth scroll at the top. Its group is only known after the first render
  const u = new URL(location.href);
  // ?wall=<name>&info opens the info sheet; &board opens it on the 게시판 tab (no board url and no reviews: the sheet just starts on its first tab)
  const sheetTab = boardRequested(location.search) ? 'board' : null; // &board: the 타임라인 tab; any other wall link (a share page, &info) opens the sheet too: the wall link opens the wall sheet over the clean app address
  for (const k of ['wall', 'at', 'n', 'k', 'tags', 'note', 'board', 'info']) u.searchParams.delete(k);
  history.replaceState(null, '', u); // the entry under the sheet is the clean app address
  { openWallSheet(sharedWall.name, null, { tab: sheetTab }); history.replaceState(null, '', u); } // the sheet pushes its own entry, so 뒤로 closes only the sheet and not the app (a link opening it left nothing to go back to); the address stays clean
}
// 화면 읽는 법 sheet: the header ? opens it. On a first visit the 투어 (tour.js, up to 6 spotlight steps) opens by itself once the list is
// drawn, after the KakaoTalk notice inside KakaoTalk (that one is this sheet); a share link skips the tour but keeps the notice (inapp.js howtoDue).
if ($('howto') && $('helpBtn') && $('howto-guide')) { // an older cached page has none of it
  const howto = $('howto');
  let opener = null;
  let auto = null; // what an automatic opening showed (only the KakaoTalk notice now): closing it, however it happens, marks that as seen
  let afterNotice = null; // the tour that waits for the notice to be read
  // the tour ends however it ends (finish, skip, Esc, backdrop): that is the first-visit intro seen. No visible target: nothing opens, nothing is saved.
  const runTour = () => startTour({ onClose: () => { ui.introDone = true; saveUi(); } });
  const show = (from, due) => {
    opener = from;
    auto = due;
    $('howto-title').textContent = due ? '안내' : '화면 읽는 법';
    $('howto-kakao').hidden = !due?.kakao;
    $('howto-guide').hidden = !!due; // only the notice is due: just that
    if ($('tour-again')) $('tour-again').hidden = !!due;
    $('howto-more').open = false; // 핵심만 먼저: 자세히 보기는 눌러야 펼쳐진다
    howto.showModal();
    howto.scrollTop = 0; // start from the title
  };
  howto.addEventListener('close', () => {
    if (auto?.kakao) closeInApp();
    (opener ?? $('helpBtn'))?.focus();
    auto = null;
    const tour = afterNotice;
    afterNotice = null;
    tour?.();
  });
  $('helpBtn').addEventListener('click', (e) => show(e.currentTarget, null));
  $('tour-again')?.addEventListener('click', () => { howto.close(); startTour(); }); // a replay does not touch introDone
  $('inapp-open')?.addEventListener('click', () => { location.href = externalOpenUrl(entryHref); });
  const due = howtoDue({ introDone: ui.introDone, kakao: isKakaoInApp(navigator.userAgent), kakaoClosed: inAppClosed(), shareLink: new URL(entryHref || location.href).searchParams.has('wall') });
  if (due) showHowtoAuto = () => {
    showHowtoAuto = () => {};
    if (due.kakao) { afterNotice = due.intro ? runTour : null; show(null, { kakao: true }); } else if (due.intro) runTour();
  };
}
{ // handed over from KakaoTalk (?from=kakao), or back for another visit (the tour was already seen before this page loaded; a share link came for one wall): offer the install once, as soon as this browser can do it
  const u = new URL(location.href);
  const handed = fromKakao(location.search);
  const again = ui.introDone && !new URL(entryHref || location.href).searchParams.has('wall');
  if (handed) { u.searchParams.delete('from'); history.replaceState(null, '', u); }
  const b = $('install-banner');
  const show = () => {
    const how = currentInstallMode();
    const text = { prompt: '앱처럼 한 번에 열려요.', ios: '공유 버튼 ▸ ‘홈 화면에 추가’를 누르면 앱처럼 열려요.', android: '⋮ 메뉴 ▸ ‘홈 화면에 추가’를 누르면 앱처럼 열려요.' }[how];
    if (!b || installClosed() || !text) return;
    $('install-go').hidden = how !== 'prompt';
    $('install-text').textContent = text; // set every time: a late Chrome prompt turns the android steps into the button
    b.hidden = false;
  };
  if ((handed || again) && b) {
    show();
    window.addEventListener('beforeinstallprompt', () => setTimeout(show)); // Chrome's event can come after load (install.js has already kept it)
    $('install-go').addEventListener('click', async () => { if (await promptInstall()) { b.hidden = true; closeInstall(); } });
    $('install-close').addEventListener('click', () => { closeInstall(); b.hidden = true; });
  }
}
showTab(ui.homeView);
