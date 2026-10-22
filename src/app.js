import './dialog-back.js';
import { buildList } from './listing.js';
import { DAY_KO, hhmm, isNight, toMin, ymd } from './time.js';
import { fetchNational, fetchCrags, loadWalls } from './store.js';
import { state, storage, onChange, canEdit } from './state.js';
import { config } from './config.js';
import { featureOn } from './stage.js';
import { labCrag, withoutLab, LAB_NOTE } from './lab.js'; // 시범 스위치(?lab=crag)
import { createMap } from './map.js';
import { dialModel } from './dial.js';
import { renderScene, sceneTone } from './sun-scene.js';
import { getStatus } from './hours.js';
import {
  axisFrac, barSegments, dayBar, dayLine, dayText, filterRows, fmtMin, formatRanges, groupRows, hasParking, hasRental, mapPins, NTH_KO,
  scopeRows, searchPicks, seasonSun, shortName, sortRows, summaryLead, sunVerdict, groupWeekRows, timeLabel, wallPosition, weeklyHours, winterSpan, withDistance,
} from './viewmodel.js';
import { cardModel, feeTable, feeWord, rowExtra, shortenDates } from './card-model.js';
import { NOTE_MAX } from './parking-rate.js';
import { feeTableEl } from './fee-table-view.js';
import { WINDOW, evidenceOf, reasonOf, weekendPicks } from './pick.js';
import { loadFavs, saveFavs, toggleFav } from './favorites.js';
import { hintDue, loadSeen as loadChangesSeen, markHint, saveSeen as saveChangesSeen, unseen, weekChanges } from './changes.js';
import { loadSeen, markSeen, recordFirstSeen, saveSeen, settingChanged } from './setting.js';
import { parseInvite } from './invite.js';
import { createInviteView } from './invite-view.js';
import { inkStamp } from './stamp.js';
import { CLEARED, TABS, cleanApproach, cleanRegions, cleanRope, cleanTemp, cleanTextSize, cleanTheme, cleanVenue, climberCardDue, cragFilterView, filterView, loadUi, saveUi as storeUi, shareUrl, wallFromSearch, cragFromSearch, boardRequested, infoRequested } from './ui-state.js';
import { clockView, initialView, step } from './view-state.js';
import { areaList } from './areas.js';
import { cleanMode, effectiveMode } from './ui-state.js'; // 싱글피치: 보기 종류
import { cragList } from './crag-list.js';
import { loadCragWeather } from './crag-weather.js';
import { cragSky, renderCragBoard } from './crag-view.js';
import { approachModel } from './crag-approach.js';
import { saveRoute, routeState, clearRoute } from './crag-photos.js';
import { openApproachSheet } from './approach-sheet.js';
import { loadCragRoutes } from './crag-routes.js';
import { openRoutesSheet } from './routes-sheet.js';
import { el } from './dom.js';
import { startTour } from './tour.js';
import { createLogView, toast, dismissToast } from './log-view.js';
import { applyTextSize, applyTheme, createProfileView } from './profile-view.js';
import { createSafetyView } from './safety-view.js';
import { aggregate, askable, canReport, crowdPayload, crowdReady, markSent, parseCrowdCsv } from './crowd.js';
import { bumpCrowd } from './rank.js';
import { CURRENT_MS, dayKey, dayWeather, forecastTrusted, skyVeils, skyWet, forecastUrl, listForecastUrl, parseCurrent, parseDaily, parseForecast, parseListForecast, pickHour, hoursAhead, skyKind, weatherFresh, weekendForecastUrl, windy } from './weather.js';
import { boardBox } from './board-view.js';
import { openWallSheet, registerWallSheet } from './wall-sheet.js';
import { sheetModel, TAB_KINDS } from './wall-sheet-model.js';
import { loadPartners, nearGear, gearLine } from './gear.js';
import { gearBody, nearSheetBody } from './gear-view.js';
import { nearWalls, nearWallsLine, routeUrl, VENUE_WORD } from './near-walls.js';
import { routeView } from './routes.js';
import { loadMyGrade } from './my-grade.js';
import { openGallery } from './gallery-view.js';
import { closeInApp, closeInstall, entryHref, externalOpenUrl, fromKakao, howtoDue, inAppClosed, installClosed, isKakaoInApp } from './inapp.js';
import { currentInstallMode, promptInstall } from './install.js';

const $ = (id) => document.getElementById(id);
let loadFailed = false;
const inviteView = createInviteView({ getWalls: () => state.walls }); // the share menu, the 같이 가요 sheet and the banner


// Inline icons on a 24px grid, drawn in the text colour; the button or link around one carries its name.
const ICONS = {
  share: ['M12 3v12', 'M8 7l4-4 4 4', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7'],
  nav: ['M3 11L22 2l-9 19-2-8-8-2z'],
  check: ['M5 12l5 5 9-10'],
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
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  'sky-partly': ['M12 2v2', 'm4.93 4.93 1.41 1.41', 'M20 12h2', 'm19.07 4.93-1.41 1.41', 'M15.947 12.65a4 4 0 0 0-5.925-4.128', 'M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z'],
  'sky-cloud': ['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'],
  'sky-fog': ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M16 17H7', 'M17 21H9'],
  'sky-rain': ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M16 14v6', 'M8 14v6', 'M12 16v6'],
  'sky-snow': ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M8 15h.01', 'M8 19h.01', 'M12 17h.01', 'M12 21h.01', 'M16 15h.01', 'M16 19h.01'],
  'sky-storm': ['M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973', 'm13 12-3 5h4l-3 5'],
  heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  calendar: ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18'],
  ticket: ['M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z', 'M13 5v2', 'M13 11v2', 'M13 17v2'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'], // the wall sheet's tabs: 시간 (this), 이용 (ticket), 루트 (route), 게시판 (chat)
  route: ['M3 19l6-10 4 6 3-4 5 8z'],
  map: ['M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z', 'M15 5.764v15', 'M9 3.236v15'],
  gear: ['m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7', 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4', 'M2 7h20', 'M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7'], // a shopfront with an awning: the kind 장비점 (the 스토어 link has the bag)
  bag: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'], // 근처 장비점 sheet: 지도 / 스토어
  copy: ['M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  // 양달 / 응달: a sun with rays; the same sun struck through. Same pair as the invitation picture (src/share-image.js drawIcon).
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  // 방향 모름: a ring drawn dashed by CSS (the first path) with a question mark; 실내: a roof over walls (no sun matters indoors)
  unknown: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8', 'M12 17h.01'],
  indoor: ['M3 12l9-9 9 9', 'M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10'],
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

// The sun on an open row, in one place left of the name so the rows read as a column: 양달 / 응달 / 방향 모름 (no
// information) / 실내 (the sun does not matter) as pictures. The word is the picture's name for readers and a long press, and
// the key under the list spells all four out for touch users.
const SUN_PIC = { sun: 'sun', shade: 'shade', unknown: 'unknown', indoor: 'indoor' };
function sunChip(sun, veiled = false) { // veiled: the sky hides the sun (the list tints the chip); the title says so
  const pic = sun && SUN_PIC[sun.tone];
  if (!pic) return null;
  return el('span', { class: `sunnow ${sun.tone} pic`, role: 'img', 'aria-label': sun.text, title: veiled ? `${sun.text} · 흐려서 해가 거의 안 나요` : sun.text }, icon(pic));
}

// ---- UI state: filters persist in localStorage (ui-state.js), location stays in memory ----
const ui = loadUi(storage); // regions are pruned to existing ones once the list loads (syncRegions)
const saveUi = () => storeUi(storage, ui);
let showHowtoAuto = () => {}; // set by the 화면 읽는 법 block below; render() calls it, so it must exist before the first render
let theme; // what applyTheme last got: 자동 turns 'dark' from 23:00 to 08:00 (src/boot-theme.js does the same for the first paint)
function syncTheme() {
  const next = ui.theme === 'auto' && isNight(new Date()) ? 'dark' : ui.theme; // the real clock, not the picked moment
  if (next !== theme) applyTheme((theme = next));
}
syncTheme();
applyTextSize(ui.textSize);
// 기록 (log-view.js): the tab, the add sheet; list rows read a wall's records through recordsFor
const logView = createLogView({
  storage,
  icon,
  getWalls: () => state.walls,
  getFavs: () => favs,
  onChange: () => render(),
  reveal: (name) => revealFromLog(name),
  showList: () => showTab('list', true),
  crowdAsk: (wall, date, time) => (state.walls.some((w) => w.name === wall) ? crowdAsk(wall, date, time) : null), // 혼잡도 is for walls: a crag record asks nothing
  sendCrowd: (wall, level, date, time) => sendCrowd(wall, level, date, time),
  getWeather: (name, at) => posterWeather(name, at),
  getOrigin: () => vs.origin,
  addFav: (name) => {
    if (favs.includes(name)) return;
    favs = toggleFav(favs, name);
    saveFavs(storage, favs);
    syncFavs();
    if (ui.favOnly) render();
  },
});
createProfileView({
  getTheme: () => ui.theme,
  setTheme: (t) => { ui.theme = cleanTheme(t); saveUi(); syncTheme(); },
  getTextSize: () => ui.textSize,
  setTextSize: (s) => { ui.textSize = cleanTextSize(s); saveUi(); applyTextSize(ui.textSize); },
  exportFile: logView.exportFile,
  importFile: logView.importFile,
  getLogCount: logView.count,
  getWallNames: () => state.walls.map((w) => w.name),
});
createSafetyView();
let liveOpenCount = null; // the header's count of open walls while the clock is live (null for a picked day): the 클라이머 테스트 tip reads it
// 클라이머 유형 테스트: loaded only when config.climberTest is on, and a failed load only turns the test off. sw.js shows stored files
// first, so a half-updated cache (a new module next to an older one it imports) must never be able to stop the app from starting.
let climberView = { open() {}, banner() {} };
let typeFromSearch = () => null;
if (featureOn('climber')) {
  try {
    const [view, test] = await Promise.all([import('./climber-view.js'), import('./climber-test.js')]);
    typeFromSearch = test.typeFromSearch;
    const today = ymd(new Date());
    if (!ui.climberFirstDay) { ui.climberFirstDay = today; saveUi(); } // the first visit only notes the day; the intro card waits for a later one
    climberView = view.createClimberView({
      getOpenCount: () => liveOpenCount,
      isCardDone: () => { try { return !climberCardDue(ui, today, !!test.loadClimber(localStorage).latest); } catch { return true; } }, // a blocked store: no card
      setCardDone: () => { ui.climberCardDone = true; saveUi(); },
    });
  } catch { /* an older cached module or no network: the test stays off */ }
}
// ---- view state (view-state.js): the picked moment / live clock, the open row and its folds, the position ----
// Every change goes through go(event): view-state.js decides the next state and the follow-ups, run here in order.
let vs = initialView();
const FX = {
  render: () => render(),
  crowd: () => loadCrowd(),
  sortDistance: () => {
    ui.sortMode = 'distance';
    sheetForm.elements.sortMode.value = 'distance';
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
const basisTag = (m) => (m.basis ? el('span', { class: 'basis' }, m.basis) : null);
// 입장 유료/무료 as a ticket icon + the one word (the full phrase stays for screen readers); 무료 in the accent colour
const feeChip = (m) => (m.fee ? el('span', { class: `fee ${m.fee.endsWith('무료') ? 'free' : 'paid'}`, role: 'img', 'aria-label': m.fee }, icon('ticket'), m.fee.replace(/^입장 /, '')) : null);

function placeholder({ primary, secondary }) {
  return el('div', { class: 'thumb placeholder', 'aria-hidden': 'true' },
    el('span', { class: 'ph-primary' }, primary), secondary ? el('span', { class: 'ph-secondary' }, secondary) : null);
}

function thumb(m) {
  if (!m.photo) return placeholder(m.placeholder);
  const img = el('img', { class: 'thumb', src: m.photo, loading: 'lazy', decoding: 'async', width: 72, height: 72, alt: `${m.name} 외벽` });
  img.addEventListener('error', () => img.replaceWith(placeholder(m.placeholder)), { once: true });
  return img;
}

// The same bar as the list row's (listBar), with the hours under it: a closed wall opening on a later day shows that day, without a tick.
function dayBarBlock(bar) {
  return el('div', { class: 'daybar-wrap' },
    listBar(bar),
    el('div', { class: 'ticks', 'aria-hidden': 'true' },
      ...[360, 720, 1080, 1440].map((t) => { const x = el('span', {}, String(t / 60)); x.style.left = axisX(t); return x; })),
    bar.note === null ? null : el('p', { class: 'nosun' }, bar.note));
}

// 길찾기 · 공지 · 전화 …: one hairline strip of icon + word cells (flat like the list rows, no pills); 길찾기 first
const LINK_ICON = { 길찾기: 'nav', '공지 보기': 'megaphone', 예약: 'calendar', 오픈채팅: 'chat', 전화: 'phone' };
const LINK_WORD = { '공지 보기': '공지' }; // the cell says the short word (the link's own label keeps the long one for the model and the picker)
// 길찾기: the first tap asks which map app (the web cannot see what is installed); the pick is remembered, later taps open it directly.
const NAV_KEY = 'open-wall:nav-app';
const navPref = () => { try { return localStorage.getItem(NAV_KEY); } catch { return null; } };
function openNav(choice, copyText, nav, choices) {
  try { localStorage.setItem(NAV_KEY, choice.id); } catch { /* private mode: asks again next time */ }
  window.open(choice.href, '_blank', 'noopener,noreferrer');
  if (copyText) navigator.clipboard?.writeText(copyText).catch(() => {});
  toast(`${choice.label} 열었어요${copyText ? ' · 주소도 복사했어요' : ''}`, nav ? () => pickNav(nav, choices, copyText) : null, nav ? '바꾸기' : null);
}
function pickNav(nav, choices, copyText, ask = null) { // ask: the cell's word (공지, 전화): plain links to pick from, nothing remembered or copied
  nav.parentElement.querySelector('.nav-pick')?.remove();
  const btn = (text, run, cls = null) => {
    const b = el('button', { type: 'button', ...(cls ? { class: cls } : {}) }, text);
    b.addEventListener('click', () => { panel.remove(); run(); });
    return b;
  };
  const panel = el('div', { class: 'nav-pick', role: 'group', 'aria-label': ask ? `${ask} 고르기` : '길찾기 앱 고르기' },
    ...choices.map((c) => btn(c.label, () => (ask ? (c.href.startsWith('tel:') ? location.assign(c.href) : window.open(c.href, '_blank', 'noopener,noreferrer')) : openNav(c, copyText, nav, choices)))),
    ask ? null : btn('주소 복사', () => navigator.clipboard?.writeText(copyText ?? '').then(() => toast('주소를 복사했어요 · 길찾기 앱에서 붙여 넣으세요'), () => {}), 'plain'));
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
  const copy = () => navigator.clipboard?.writeText(copyText ?? '').then(() => toast('주소를 복사했어요 · 길찾기 앱에서 붙여 넣으세요'), () => {});
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
      } else if (primary && copyText) a.addEventListener('click', () => navigator.clipboard?.writeText(copyText).then(() => toast('주소를 복사했어요 · 길찾기 앱에서 붙여 넣으세요'), () => {}));
      return a;
    }),
    edge?.end ?? null);
  return nav;
}

const rowButtons = (name, ...extra) => {
  const kids = [
    ...(canEdit ? [
      el('button', { type: 'button', 'data-act': 'edit', 'data-name': name }, '수정'),
      el('button', { type: 'button', 'data-act': 'delete', 'data-name': name }, '삭제'),
    ] : []),
    ...extra,
  ].filter(Boolean);
  return kids.length ? el('div', { class: 'row-actions' }, ...kids) : null;
};

// The map's selected pin: only what reads at a glance (photo, name, status, today's bar). Everything else is the
// wall's card in the list, one tap away.
function card(row, at) {
  const m = cardModel(row, at);
  const more = el('button', { type: 'button', class: 'pin-more' }, '목록에서 자세히 보기 ›');
  more.addEventListener('click', () => {
    showTab('list');
    revealRow(m.name);
  });
  // no photo: no grey placeholder block; its type and height ride on the place line instead
  const { primary, secondary } = m.placeholder;
  return el('li', { class: `card ${m.state}${m.short ? ' short' : ''}${m.stale ? ' stale' : ''}${m.photo ? '' : ' no-photo'}` },
    m.photo ? thumb(m) : null,
    el('div', { class: 'head' },
      el('div', { class: 'name-row' }, favBtn(m.name), el('h3', { class: 'name' }, m.name, feeChip(m))),
      el('p', { class: 'where' },
        m.region ? el('small', {}, m.region) : null,
        !m.photo && secondary ? el('small', {}, secondary) : null,
        !m.photo && primary.endsWith('m') ? el('small', {}, `높이 ${primary}`) : null,
        basisTag(m)),
      el('p', { class: `status${m.soon ? ' soon' : ''}` }, m.statusText)),
    m.bar ? dayBarBlock(m.bar) : null,
    more);
}

function safeCard(row, at) {
  try {
    return card(row, at);
  } catch {
    const name = row.wall.name;
    return el('li', { class: 'card broken' },
      el('h3', { class: 'name' }, name),
      el('p', { class: 'note' }, canEdit ? '표시 중 오류가 발생했어요. 수정 또는 삭제해 주세요.' : '표시 중 오류가 발생했어요.'),
      rowButtons(name));
  }
}

// ---- timetable row ----
const axisX = (min) => `${axisFrac(min) * 100}%`;
const span = (cls, a, b) => {
  const s = el('span', { class: cls });
  s.style.left = axisX(a);
  s.style.width = `${(axisFrac(b) - axisFrac(a)) * 100}%`;
  return s;
};
// An orange sun band that starts or ends where the open bar does takes the bar's round end (the list's bar and the sheet's alike);
// inside the bar it stays square so two colours meet cleanly.
const capCls = (a, b, open) => `${open.some(([x]) => x === a) ? ' cap-l' : ''}${open.some(([, y]) => y === b) ? ' cap-r' : ''}`;
// The one bar of a wall's day, drawn the same in the list row and on the map card: green where open (paler once gone), orange where it is
// sunny inside those hours, the tick at the picked time. `ahead` (a later day) has no tick.
function listBar(bar) {
  const tick = bar.ahead ? null : el('span', { class: 'tick' });
  tick?.style.setProperty('left', axisX(bar.nowMin));
  return el('span', { class: 'bar', role: 'img', 'aria-label': bar.label },
    // past and to-come are one tone: the tick says "now"; the two halves of a split interval meet square
    ...bar.segments.map(([a, b, past], i, all) => span(`${past ? 'seg past' : 'seg'}${all[i + 1]?.[0] === b ? ' j-end' : ''}${all[i - 1]?.[1] === a ? ' j-start' : ''}`, a, b)),
    // the part before the tick is already gone: its orange is paler, like the green under it
    ...bar.sunBands.flatMap(([a, b]) => (bar.nowMin == null || bar.nowMin <= a ? [[a, b, false]] : bar.nowMin >= b ? [[a, b, true]] : [[a, bar.nowMin, true], [bar.nowMin, b, false]]))
      .map(([a, b, past]) => span(`${past ? 'sunband past' : 'sunband'}${capCls(a, b, bar.open)}`, a, b)),
    tick);
}
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
  if (m.photo || !config.boardUrl) return null;
  const b = el('button', { type: 'button', class: 'rhero-add', 'aria-label': `${m.name} 외벽 사진 보내기`, title: '사진 보내기' }, icon('camera-plus'));
  b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: '암장 사진', kinds: ['암장 사진'] } })));
  return b;
}

// An open row with a photo wears it: the photo sits behind the row's own line and bar (style.css .row.has-photo),
// today's hours ride on its foot. The photo and its credit leave the expanded part, which would repeat them.
// A crag row wears it too (crag-view.js deps.rowPhoto): canAdd false (no camera: the 제보 sheet takes wall names), noun '암장', onFail draws its hero block back.
const CARD_PHOTOS = 5; // the card swipes the main photo and the newest four; the gallery has them all (at most 10)
const CARD_DOTS = 5;
function rowPhoto(m, li, { canAdd = true, noun = '외벽', onFail = null } = {}) {
  const list = m.photos.slice(0, CARD_PHOTOS), many = m.photos.length > 1;
  const imgs = list.map((p, i) => el('img', { src: p.src, decoding: 'async', loading: 'lazy', alt: `${m.name} ${noun} 사진${many ? ` ${i + 1}/${list.length}` : ''}` }));
  const track = el('div', { class: 'rhero-track', ...(many ? { tabindex: '0', role: 'group', 'aria-roledescription': 'carousel', 'aria-label': `${m.name} 사진, 좌우로 넘기기` } : {}) },
    ...imgs.map((img) => el('div', { class: 'rhero-slide' }, img)));
  let credit = null;
  const line = el('div', { class: 'rhero-line' }, el('div', { class: 'rhero-cap' }, m.suspended ? null : el('small', {}, m.today.lead), todayText(m))); // a suspended wall: just the small 임시 휴관 중 pill on the photo
  const setCredit = (c) => { // our own photos need no credit; a licensed one or a nickname keeps its line
    const next = creditChip(c?.text === '사진 · 직접 촬영' ? null : c);
    if (next && c.text.length > 16) next.textContent = '사진 출처'; // a long credit (a licence line) shrinks to a link; the whole text is in the tooltip and the gallery
    next?.setAttribute('title', c.text);
    if (credit) credit.replaceWith(...(next ? [next] : [])); else if (next) line.append(next);
    credit = next;
  };
  setCredit(list[0].credit ?? m.credit);
  const wrap = el('div', { class: 'herowrap rhero' }, track, el('div', { class: 'rhero-foot' }, line));
  // the photo sits in a hidden box until the row opens (lazy never loads it): fetch the first when the row nears the screen, so opening shows it at once
  const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { imgs[0].loading = 'eager'; near.disconnect(); } }, { rootMargin: '300px' });
  near.observe(li);
  imgs[0].addEventListener('error', () => { li.classList.remove('has-photo'); wrap.remove(); onFail?.(); }, { once: true });
  imgs.slice(1).forEach((img, k) => img.addEventListener('error', () => img.closest('.rhero-slide')?.remove(), { once: true }));
  const add = canAdd && config.boardUrl ? el('button', { type: 'button', class: 'rhero-add', 'aria-label': `${m.name} 사진 더 보내기`, title: '사진 더 보내기' }, icon('camera-plus')) : null;
  add?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: '암장 사진', kinds: ['암장 사진'] } })));
  if (!many && !add) return wrap;
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
    const open = () => openGallery({ name: m.name, photos: m.photos, index: cur, canSend: Boolean(config.boardUrl), onClose: (i) => { cur = Math.min(i, list.length - 1); goTo(cur, false); paint(cur); } });
    track.addEventListener('click', open);
    track.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); else if (e.key === 'ArrowRight') goTo(cur + 1, true); else if (e.key === 'ArrowLeft') goTo(cur - 1, true); });
  }
  wrap.classList.add('has-tools');
  wrap.append(el('div', { class: 'rhero-tools' }, many ? dots : null, many ? count : null, add));
  return wrap;
}

// ---- '더 보기' pictures (mockup 2026-10-08): hours grid, seasonal sun, month strip, memo, parking ----
// 06–24 axis; with nowMin a time tag replaces the hour numbers next to it.
function gridAxis(nowMin) {
  const ax = el('div', { class: 'g-axis', 'aria-hidden': 'true' });
  const gap = 110 * (parseFloat(getComputedStyle(document.documentElement).fontSize) / 16); // the tag widens with the text size
  for (const h of [6, 9, 12, 15, 18, 21, 24]) {
    if (nowMin != null && Math.abs(h * 60 - nowMin) < gap) continue;
    const t = el('span', { class: h === 6 ? 'first' : h === 24 ? 'last' : null }, String(h).padStart(2, '0'));
    t.style.left = axisX(h * 60);
    ax.append(t);
  }
  if (nowMin != null) {
    const tag = el('span', { class: 'nowtag' }, fmtMin(nowMin));
    tag.style.left = axisX(nowMin);
    ax.append(tag);
  }
  return ax;
}
const clipDay = (list) => list.map(([a, b]) => [a, Math.min(b, 1440)]).filter(([a, b]) => axisFrac(b) > axisFrac(a));
const overlapOf = (a, b) => a.flatMap(([s, e]) => b.map(([x, y]) => [Math.max(s, x), Math.min(e, y)])).filter(([s, e]) => e > s);

// Hours grid: Mon–Sun + 공휴일 on 06–24. Today's row: highlighted, the time line, today's sun over it (solid where
// it meets the real open hours of the day). 휴게·휴무 hatched. Previewing the other season hides the time line.
function hoursGrid(wall, at) {
  const wk = weeklyHours(wall, at, vs.season[wall.name]); // a season being previewed, else the picked day's own
  if (!wk.rows.length) return null;
  const ws = winterSpan(wall);
  const live = !wk.preview;
  const nowMin = minuteOf(at);
  const bar = live ? dayBar(wall, at) : null;
  const sunOn = bar?.sun ? overlapOf(bar.open, bar.sun) : [];
  const sec = el('section', { class: 'hgrid', 'aria-label': '요일별 운영시간' });

  const seg = wk.hasWinter && ws ? el('div', { class: 'g-seg', role: 'group', 'aria-label': '계절 운영시간' },
    ...[['summer', '하계', ws.summer], ['winter', '동계', ws.winter]].map(([k, label, months]) => {
      // the months sit inside the switch ("하계 4~9월 · 동계 10~3월"); a winter closure reads in the warning colour
      const shut = k === 'winter' && ws.closed;
      const b = el('button', { type: 'button', 'data-season': k, 'aria-pressed': String(wk.season === k), class: shut ? 'shut' : null, 'aria-label': `${label} ${months ?? '연중'}${shut ? ' 외벽 휴장' : ''}` },
        el('span', { class: 'sw-k' }, label), months ? el('span', { class: 'sw-m' }, months) : null);
      b.addEventListener('click', () => {
        go({ type: 'season', name: wall.name, pick: k, current: weeklyHours(wall, at).season });
        const next = hoursGrid(wall, at);
        sec.replaceWith(next);
        next.querySelector(`[data-season="${k}"]`)?.focus();
      });
      return b;
    })) : null;
  const segRow = seg ? el('div', { class: 'g-segrow' }, seg) : null;

  const day = live ? dayLine(wall, at) : null; // a closed_date / nth closure isn't in the weekly rows: say it here
  const lead = live
    ? (day.closed ? el('p', { class: 'g-lead' }, `${dayText(at)} `, el('b', {}, day.text)) : null) // the day's sun is under 계절별 양달
    : el('p', { class: 'g-lead preview' }, `${wk.season === 'winter' ? '동계' : '하계'} 미리 보기 · 지금 시각선 없이 그 계절 시간만 보여요`);

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

  for (const r of groupWeekRows(wk.rows)) { // days with the same hours share one row
    const trk = el('span', { class: 'g-trk' });
    const open = clipDay(r.intervals);
    if (r.closed) trk.append(el('span', { class: 'g-off' }), el('span', { class: 'g-closed' }, r.text));
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
    if (r.today && bar?.sun) trk.append(...clipDay(sunOn).flatMap(([a, b]) => (nowMin <= a ? [[a, b, false]] : nowMin >= b ? [[a, b, true]] : [[a, nowMin, true], [nowMin, b, false]])).map(([a, b, past]) => span(`g-sunon${past ? ' past' : ''}${capCls(a, b, open)}`, a, b))); // the same as the list: the open bar turns orange where it is sunny, paler before the time line
    const said = `${r.days}${r.today ? (r.members > 1 ? '(오늘 포함)' : '(오늘)') : ''} ${r.text}${r.breaks.length ? `, 휴게 ${formatRanges(r.breaks)}` : ''}${shut ? `, 오늘은 ${day.text}` : ''}`;
    body.append(el('div', { class: `g-row${r.today ? ' g-today' : ''}${shut ? ' shut' : ''}`, role: 'listitem', 'aria-label': said },
      el('span', { class: 'g-lab', 'aria-hidden': 'true' }, r.days.replace(/·/g, '·​').replace(/–/g, '–⁠'), r.today ? el('small', {}, r.members > 1 ? '오늘 포함' : '오늘') : null), // a zero-width space after · lets 월·화·목·토 wrap in the narrow label column
      el('span', { class: 'g-wrap', 'aria-hidden': 'true' }, trk)));
  }

  const breaks = [...new Map(wk.rows.flatMap((r) => r.breaks).map((b) => [formatRanges([b]), b])).entries()].sort(([, a], [, b]) => a[0] - b[0]).map(([t]) => t); // one of each, earliest first
  const notes = [
    breaks.length ? `휴게 ${breaks.join(', ')}` : null,
    ...wk.rows.filter((r) => r.nth).map((r) => `${r.nth.map((n) => NTH_KO[n]).join('·')} ${r.days}요일 휴무`),
    wall.holiday === 'weekend' ? '공휴일은 토요일 시간 · 정기휴무 요일과 겹치면 휴무로 표시' : null,
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
    const showAt = (m) => {
      nl.style.left = axisX(m);
      const next = gridAxis(m);
      axis.replaceWith(next);
      axis = next;
      range.value = String(m);
      range.setAttribute('aria-valuetext', fmtMin(m));
    };
    const minAt = (x) => { // the axis is 06:00–24:00 across the plot
      const r = plot.getBoundingClientRect();
      return hourOf(360 + Math.min(1, Math.max(0, (x - r.left) / r.width)) * 1080);
    };
    const commit = (m, byKey) => { // the sheet only: the grid is drawn again for that time of the same day; the list behind keeps its own moment
      if (m === hourOf(nowMin)) return;
      const there = new Date(at);
      there.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const next = hoursGrid(wall, there);
      sec.replaceWith(next);
      if (byKey) next.querySelector('.g-range')?.focus();
    };
    let from = null; // the minute a drag started on: cancelling it (the page began to scroll) puts the line back
    const zoneEl = el('div', { class: 'g-zone' }, axis, range); // only the axis strip is dragged: the bars below stay free for the tab swipe
    zoneEl.addEventListener('pointerdown', (e) => {
      if (e.button || e.clientX < plot.getBoundingClientRect().left) return; // the label column left of the axis is not part of the time scale
      from = nowMin;
      zoneEl.setPointerCapture(e.pointerId);
      showAt(minAt(e.clientX));
    });
    zoneEl.addEventListener('pointermove', (e) => { if (from !== null) showAt(minAt(e.clientX)); });
    zoneEl.addEventListener('pointerup', (e) => { if (from === null) return; from = null; commit(minAt(e.clientX), false); });
    zoneEl.addEventListener('pointercancel', () => { if (from !== null) { showAt(from); from = null; } });
    range.addEventListener('input', () => showAt(Number(range.value)));
    range.addEventListener('change', () => commit(Number(range.value), true));
    zone = [zoneEl];
  }
  const row = allRows.find((r) => r.wall.name === wall.name);
  // the answer for this time, in words; the row's status was made for the list's moment, so it is read again for `at` (the sheet's own time)
  const m = live && !susp && row ? modelOf({ ...row, status: getStatus(row.wall, at) }, at) : null;
  const verdict = m && m.state !== 'unknown' ? el('p', { class: `g-verdict ${m.state}` }, m.state === 'open' ? `${fmtMin(nowMin)} 운영 중 · ` : `${fmtMin(nowMin)} `, m.statusText) : null;
  // one legend only: the hatch is explained here; the sun colours are explained once, under 계절별 양달 (same colours)
  sec.append(...[segRow, susp, verdict, susp ? null : lead, ...zone,
    live ? el('p', { class: 'g-drag-hint' }, '눈금을 좌우로 끌어 시각을 바꿔요') : null, ...(live ? [body] : []),
    notes.length ? el('ul', { class: 'g-notes' }, ...notes.map((n) => el('li', {}, n))) : null].filter(Boolean));
  return sec;
}

// Seasonal sun: 여름 / 봄·가을 / 겨울, each "여름 6/21 · 12:40–19:40" over a bar against the same weekday's hours
// in that season (solid where they meet). One legend line under the rows.
function seasonSunBlock(wall, at, d) {
  if (noSunMath(d)) return null;
  const rows = seasonSun(wall, at);
  const fold = rows.length > 1 && rows.some((s) => s.current); // closed: only this season's row; 다른 계절 보기 unfolds the rest
  const more = el('button', { type: 'button', class: 'ssun-more', 'aria-expanded': 'false' }, '다른 계절 보기 ▾');
  more.addEventListener('click', () => {
    const on = more.getAttribute('aria-expanded') !== 'true';
    more.setAttribute('aria-expanded', String(on));
    more.textContent = on ? '접기 ▴' : '다른 계절 보기 ▾';
    more.closest('.ssun').querySelectorAll('.s-row:not(.cur), .sr-only li:not(.cur)').forEach((r) => { r.hidden = !on; });
  });
  const texts = []; // what each bar says in words (the bars are aria-hidden): kept for screen readers, a line a season
  const why = sunWhy(); // the long caveat is folded under 계산 기준
  why.append(el('p', { class: 's-ref' }, '지금 계절은 고른 날짜의 해로, 나머지 계절은 6/21(여름) · 3/21(봄·가을) · 12/21(겨울)의 해를 기준으로 계산해요.'));
  return el('section', { class: 'ssun', 'aria-label': `계절마다 양달인 시간, ${DAY_KO[at.getDay()]}요일 운영시간 기준` },
    gridAxis(null),
    ...rows.map((s) => {
      const open = s.open.length > 0; // with open hours only the sun inside them is told; a closed / unknown day keeps the day's whole window for reference
      const openClip = clipDay(s.open);
      const shown = open ? s.on : s.windows;
      const sunText = shown.length ? formatRanges(shown).replaceAll(', ', ' · ') : open ? '운영 중 양달 없음' : '하루 종일 응달';
      const hint = s.closed ? ' · 휴무' : s.unknown ? ' · 시간 미입력' : '';
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
    fold ? more : null,
    why);
}

// The one legend of the 시간 tab, at its top: it covers the hours bars and the seasonal bars under them (so neither section carries its own).
// The hatch is named only when this wall has a break or a closed day to show.
function timeLegend(blocks) {
  const sun = Boolean(blocks.sun || blocks.hours?.querySelector('.g-sunon'));
  const hatch = Boolean(blocks.hours?.querySelector('.g-brk, .g-off'));
  return el('ul', { class: 'g-key ws-legend' },
    el('li', {}, el('i', { class: 'k-bar' }), '운영'),
    sun ? el('li', {}, el('i', { class: 'k-sunon' }), '운영 중 양달') : null,
    hatch ? el('li', {}, el('i', { class: 'k-hatch' }), '휴게·휴무') : null);
}

// 요금 tab: the table is drawn by fee-table-view.js (구분 / 대상 / 평일 / 휴일, or one column per 거주지); the 관리자 preview uses the same
function feesBlock(wall) {
  const t = feeTable(wall);
  return t ? feeTableEl(t) : null;
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
let favs = loadFavs(storage);
let changesSeen = loadChangesSeen(storage); // 이번 주 변경: the ones a visitor already dismissed
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
  if (c.kind === 'winter') return [c.season === 'start' ? '동절기 시작' : '동절기 끝', `${mdOf(c.from)}${c.season === 'start' ? '부터' : ''}`, c.note].filter(Boolean).join(' · ');
  const when = c.kind === 'closed' ? (c.from === c.to ? mdOf(c.from) : `${mdOf(c.from)}~${mdOf(c.to)}`) : c.from ? sinceText(c.from) : '';
  return [c.kind === 'closed' ? '임시 휴무' : '이용 어려움', when, c.note].filter(Boolean).join(' · ');
}
const changesList = () => unseen(weekChanges(state.walls, new Date(), { favs, regions: ui.regions }), changesSeen);
function dismissChanges(keys) {
  changesSeen = [...changesSeen, ...keys];
  saveChangesSeen(storage, changesSeen);
  renderChanges();
}
function fillChanges(list) {
  $('changes-list').replaceChildren(...list.map((c) => {
    const w = state.walls.find((x) => x.name === c.name);
    const label = w ? shortName(w) : c.name;
    const notice = /^https?:\/\//.test(w?.contact?.notice_url ?? '') ? el('a', { href: w.contact.notice_url, target: '_blank', rel: 'noopener noreferrer' }, ' 공지 보기') : null;
    const name = el('button', { type: 'button', class: 'ch-name', 'aria-label': `${label} 자세히 보기` }, label);
    name.addEventListener('click', () => { $('changes').close(); openWallSheet(c.name, $('changesLine').hidden ? null : $('changesLine')); }); // to the wall's own sheet (hours, use, notice)
    const ok = el('button', { type: 'button', class: 'ch-ok', 'aria-label': `${label} 변경 읽음` }, '읽음');
    ok.addEventListener('click', () => dismissChanges([c.key]));
    return el('li', {}, el('span', {}, name, el('small', {}, changeText(c), notice)), ok);
  }));
  $('changes-all').hidden = list.length < 2;
}
function renderChanges() {
  const line = $('changesLine');
  if (!line || !$('changes')) return; // an older cached page has neither
  const list = changesList();
  line.hidden = !list.length;
  if (list.length) line.replaceChildren(`내 암장 소식 ${list.length}건 `, el('span', { 'aria-hidden': 'true' }, '›'));
  if ($('changes').open) {
    if (list.length) fillChanges(list);
    else { $('changes').close(); $('tab-list')?.focus(); } // the line is gone with the last one: focus goes to the list tab, not to nowhere
  }
}
if ($('changesLine') && $('changes')) {
  $('changesLine').addEventListener('click', () => { fillChanges(changesList()); $('changes').showModal(); });
  $('changes-all').addEventListener('click', () => dismissChanges(changesList().map((c) => c.key)));
}
function syncFavs() {
  for (const b of document.querySelectorAll('[data-fav]')) paintStar(b);
  for (const m of document.querySelectorAll('[data-favmark]')) m.hidden = !favs.includes(m.dataset.favmark);
}
function favBtn(name, label = null) { // label: a word under the heart (the link strip's cell)
  const btn = el('button', { type: 'button', class: label ? 'lb-item fav-btn' : 'icon-btn fav-btn', 'data-fav': name, 'aria-label': '즐겨찾기', title: '즐겨찾기', ...(label ? { 'data-label': label } : {}) });
  btn.addEventListener('click', () => {
    favs = toggleFav(favs, name);
    saveFavs(storage, favs);
    syncFavs();
    renderChanges();
    if (favs.includes(name)) document.dispatchEvent(new CustomEvent('stats:fav-add')); // stats.js counts it (no wall name in it)
    if (favs.includes(name) && state.walls.some((w) => w.name === name) && hintDue(storage)) { markHint(storage); toast('이 암장에 변경이 생기면 홈에 알려 드려요'); } // the first ♥ of a wall only (a crag has no 변경 to tell)
    if (ui.favOnly) { // the list itself follows the hearts
      if (cragMode()) cragRefocus = cragOpen; // the crag list too: redrawn although the focus is in the open card (renderCrags leaves a card alone otherwise)
      render();
    }
  });
  paintStar(btn);
  return btn;
}
// ---- 이번 주말 추천 (src/pick.js): a folded line above the timetable ----
let pickPref = 'auto';
const PICK_PREFS = [['auto', '자동'], ['shade', '응달'], ['sun', '양달'], ['any', '오래']];
const PICK_WORD = { shade: '응달 우선', sun: '양달 우선', any: '오래 탈 수 있는 곳' };

// Jump the date and time controls to a moment (the same state a visitor gets by picking it), then re-render.
const goToMoment = (date, min) => go({ type: 'moment', date, min });

const hhShort = (m) => `${m < 600 ? '0' : ''}${Math.floor(m / 60)}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}`; // 540 → 09, 1290 → 21:30
let pickBasisOpen = false; // the day / basis choices, shown only when asked for
let pickRefocus = null;

// 이번 주말, 여기: a curated pick, not a list. Folded it is one line (sun picture, wall, reason). Opened: the day pills and the
// basis button (it opens the choices), then up to three compact rows: rank, small photo (or the grey logo mark), the wall, the
// sun as a picture + one line of why, the hours. Shown only with a 내 지역 set (a nationwide top 3 is too far to be a pick) and not turned off in 내 정보,
// and hidden when that area has nothing to say about the coming weekend.
// 주말 추천의 날씨 (weather.js; docs/system/permissions.md): one request for every wall's daily rain / gust numbers, kept in memory
// (3 hours; a failed one 5 minutes). It only reorders the picks and adds pills; without it the picks are as they were.
const wxPick = { byName: new Map(), entry: null, busy: false };
async function loadWeekendWeather() {
  if (wxPick.busy || weatherFresh(wxPick.entry, Date.now())) return;
  const spots = listSpots(); // indoor walls: no forecast
  if (!spots.length) return;
  wxPick.busy = true;
  let days = null;
  try {
    const res = await fetch(weekendForecastUrl(spots.map(([, p]) => p)), { credentials: 'omit', signal: AbortSignal.timeout?.(8000) });
    if (res.ok) days = parseDaily(await res.json(), spots.length);
  } catch { /* quiet: picks stay as they are */ }
  wxPick.entry = { hours: days, at: Date.now() }; // the shape weatherFresh reads
  wxPick.byName = new Map(days ? spots.map(([w], i) => [w.name, days[i]]) : []);
  wxPick.busy = false;
  if (days) {
    const f = document.activeElement; // a late answer must not drop focus from a pick control
    if (f?.closest?.('#pick-body') && f.dataset.focus) pickRefocus = f.dataset.focus;
    renderPick();
  }
}
// 목록 줄의 날씨 (weather.js; docs/system/permissions.md): one request for every outdoor wall's hourly temperature and sky, the way
// the weekend picks ask for theirs. Kept in memory and in this browser for 3 hours so a reload does not ask again; a failed
// answer is not retried for 5 minutes. A row shows the temperature at the picked arrival hour; indoor walls have none.
const WXL_KEY = 'open-wall:wx-list';
const wxList = { byName: new Map(), entry: null, busy: false };
const listSpots = () => state.walls.filter((w) => w.venue !== 'indoor').map((w) => [w, wallPosition(w)]).filter(([, p]) => p);
// names and coordinates (2 decimals, what is sent): a wall added, removed or moved while the page is open asks again
const listKey = (spots) => spots.map(([w, p]) => `${w.name}@${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join('|');
function useWxList(spots, json, at) {
  const days = parseListForecast(json, spots.length);
  wxList.entry = { hours: days, at, key: listKey(spots) }; // the shape weatherFresh reads, plus the list it answers
  wxList.byName = new Map(days ? spots.map(([w], i) => [w.name, days[i]]) : []);
  return !!days;
}
// the forecast decides the order (비 오는 곳, 기온 ○°↑) and the 해 가려짐 note: sort again when it lands, unless a row has the focus (the next minute tick will)
const renderForWx = () => { if (!document.activeElement?.closest?.('#panel-list .row')) render(); };
async function loadListWeather() {
  if (wxList.busy) return;
  const spots = listSpots();
  if (!spots.length) return;
  const key = listKey(spots);
  if (weatherFresh(wxList.entry, Date.now()) && wxList.entry.key === key) return;
  if (!wxList.entry) { // the first ask of this visit: the copy kept in this browser may still be good
    try {
      const saved = JSON.parse(storage.getItem(WXL_KEY));
      if (saved?.key === key && Date.now() - saved.at >= 0 && Date.now() - saved.at < 3 * 3600e3 && useWxList(spots, saved.json, saved.at)) { paintListWx(); renderForWx(); return; }
    } catch { /* no copy, or a broken one: ask */ }
  }
  wxList.busy = true;
  let json = null;
  try {
    const res = await fetch(listForecastUrl(spots.map(([, p]) => p)), { credentials: 'omit', signal: AbortSignal.timeout?.(8000) });
    if (res.ok) json = await res.json();
  } catch { /* quiet: rows stay without weather */ }
  if (useWxList(spots, json, Date.now())) {
    try { storage.setItem(WXL_KEY, JSON.stringify({ key, at: wxList.entry.at, json })); } catch { /* full or blocked: asked again next visit */ }
  }
  wxList.busy = false;
  paintListWx();
  renderForWx();
}
const wxEntry = (wall, at) => { const h = wxList.byName.get(wall.name); return h ? pickHour(h, at) : null; };
// the list rows carry no temperature: the forecast shows as a cloud (해 가려짐) or an umbrella (비 예보) on the 양달 chip, and in full on the open card.
// Open-Meteo asks for credit (CC BY 4.0): a line under the list whenever its forecast is in use
const syncWxCredit = () => { if ($('wxCredit')) $('wxCredit').hidden = !wxList.byName.size; };
const paintListWx = syncWxCredit;
const pickWeather = (wall, date) => dayWeather(wxPick.byName.get(wall.name)?.get(dayKey(date)));
const rainsOn = (it) => !!it.wx?.rain && it.wall.venue !== 'indoor';
function renderPick() {
  const box = $('pick');
  const wallFavs = favs.filter((n) => state.walls.some((w) => w.name === n)); // a ♥ crag (same store) is not a 내 암장 for the wall pick
  const wanted = featureOn('pick') && state.walls.length && (ui.regions.length || wallFavs.length) && !ui.hidePick; // a 내 지역, or 내 암장 to lead with
  if (wanted) loadWeekendWeather();
  const r = wanted ? weekendPicks(state.walls, new Date(), { pref: pickPref, regions: ui.regions, venue: ui.venue, weather: pickWeather, favs: wallFavs }) : null;
  // a day with 내 암장 leads with them (+ the 대안 and the ones that are out); a day without any is the plain list
  const dayView = (d) => (d.mine.length || d.skipped.length ? { list: d.mine, alt: d.alt, skipped: d.skipped, more: d.moreMine, mineDay: true } : { list: d.items, alt: null, skipped: [], more: 0, mineDay: false });
  const views = r ? r.byDay.map(dayView) : [];
  box.hidden = !r || views.every((v) => !v.list.length && !v.skipped.length);
  if (box.hidden) return;
  const top = views.find((v) => v.list.length)?.list[0]; // the folded line: the first pick of the first day that has one
  const goPick = (it) => {
    goToMoment(it.day.date, reasonOf(it, r.pref).at); // that day, at the minute the card's reason starts
    revealClearing(it.wall.name);
  };
  $('pick-hint').textContent = top ? `${shortName(top.wall)} · ${reasonOf(top, r.pref).short}${rainsOn(top) ? ' · 비 예보' : ''}` : '';

  const kids = [];
  // the basis (자동 / 응달 / 양달 / 오래) is the one control; the days sit side by side, so there are no day pills
  const set = el('button', { type: 'button', class: 'pick-set', 'aria-expanded': String(pickBasisOpen), 'data-focus': 'set' },
    el('span', {}, `기준 · ${PICK_WORD[r.pref]}`), icon('sliders'));
  set.addEventListener('click', () => { pickBasisOpen = !pickBasisOpen; pickRefocus = 'set'; renderPick(); });
  kids.push(el('div', { class: 'pick-bar' }, set));
  if (pickBasisOpen) {
    kids.push(el('div', { class: 'pick-segs', role: 'group', 'aria-label': '기준' }, ...PICK_PREFS.map(([v, text]) => {
      const b = el('button', { type: 'button', class: 'pick-seg', 'aria-pressed': String(v === pickPref), 'data-focus': `기준-${v}` }, text);
      b.addEventListener('click', () => { pickPref = v; pickRefocus = `기준-${v}`; renderPick(); });
      return b;
    })));
    if (pickPref === 'auto') kids.push(el('p', { class: 'pick-basis' }, `자동은 계절에 맞춰요 (지금은 ${PICK_WORD[r.pref]}).`));
  }
  // a pill that every pick would carry says nothing: wind that is strong on all of them goes to the note instead
  const shown = views.flatMap((v) => [...v.list, ...(v.alt ? [v.alt] : [])]).filter((it) => it.wall.venue !== 'indoor');
  const allWindy = shown.length > 1 && shown.every((it) => it.wx?.windy);
  // one box per day, side by side: the first pick with its day bar (09–21: sun amber, shade blue; none for indoor or unknown sun),
  // The picks follow the filters (지역·구분·기준); a day with none says so.
  const bar = (it) => {
    const seg = (cls, [x, y]) => el('span', { class: cls, style: `left:${((x - WINDOW[0]) / (WINDOW[1] - WINDOW[0]) * 100).toFixed(1)}%;width:${((y - x) / (WINDOW[1] - WINDOW[0]) * 100).toFixed(1)}%` });
    const known = it.wall.venue !== 'indoor' && it.sun;
    return known ? el('span', { class: 'pick-tl', 'aria-hidden': 'true' }, ...it.sun.map((v) => seg('sun', v)), ...it.shade.map((v) => seg('shade', v))) : null; // indoor / sun unknown: the hours in the text say it
  };
  const hoursOf = (it) => `${hhShort(it.open[0][0])}–${hhShort(it.open[it.open.length - 1][1])}`;
  // rain / wind ride the reason line as text (a pill beside the name broke the narrow cells); the lead's rain goes to the day's head instead
  const wxOf = (it, noRain = false) => (it.wx && it.wall.venue !== 'indoor' ? [it.wx.rain && !noRain ? it.wx.rainText : null, it.wx.windy && !allWindy ? '바람 셈' : null] : []).filter(Boolean).map((t) => ` · ${t}`).join('');
  // the reason line: the reason, the number behind it ("응달 9시간"), the 1st pick's hours, then rain / wind; the price sits by the name
  const whyOf = (it, lead = false) => [reasonOf(it, r.pref).short, evidenceOf(it, r.pref)?.replace(/ /g, ' '), lead ? hoursOf(it) : null].filter(Boolean).join(' · ') + wxOf(it, lead); // (the number stays on one line)
  // the same chips as the timetable rows: the ticket for the price (무료 filled), the sun picture before the reason
  const heart = () => el('span', { class: 'rfav', role: 'img', 'aria-label': '내 암장' }, '♥');
  const nameOf = (it, mine = false) => { const fee = feeWord(it.wall); return el('span', { class: 'pick-name' }, ...(mine ? [heart()] : []), shortName(it.wall), ...(fee ? [el('span', { class: `fee ${fee === '무료' ? 'free' : 'paid'}` }, icon('ticket'), fee)] : [])); };
  const toneOf = (it) => { const why = reasonOf(it, r.pref).short; return it.wall.venue === 'indoor' ? 'indoor' : it.sunMin === null ? 'unknown' : why.includes('응달') ? 'shade' : why.includes('양달') ? 'sun' : null; };
  const SUN_WORD = { sun: '양달', shade: '응달', unknown: '방향 모름', indoor: '실내' };
  // the chip is a picture here: the reason text beside it says the word, so a reader hears it once
  const toneChip = (tone) => { const chip = sunChip({ tone, text: SUN_WORD[tone] }); chip.setAttribute('aria-hidden', 'true'); chip.removeAttribute('role'); chip.removeAttribute('aria-label'); return chip; };
  const topTone = top && toneOf(top); // the folded line starts with the same sun picture
  $('pick-chip').replaceChildren(...(topTone ? [toneChip(topTone)] : [])); // (replaceChildren would print a null as the word "null")
  const whyLine = (it, lead = false) => { const tone = toneOf(it); return el('span', { class: 'pick-why' }, ...(tone ? [toneChip(tone)] : []), whyOf(it, lead)); };
  const sigOf = (v) => [...v.list, ...(v.alt ? [v.alt] : [])].map((it) => `${it.wall.name}|${whyOf(it, true)}`).join('/') + v.skipped.map((x) => `|${x.wall.name}${x.why}`).join('');
  const same = views.length === 2 && views[0].list.length > 0 && sigOf(views[0]) === sigOf(views[1]); // 토 and 일 say the same: one box
  // the 대안: the best wall of the 내 지역 that is not a 내 암장, on a row of its own under them
  const altBtn = (v) => {
    if (!v.alt) return [];
    const b = el('button', { type: 'button', class: 'pick-next pick-alt' }, el('span', { class: 'pick-altk' }, '대안'), nameOf(v.alt), whyLine(v.alt));
    b.addEventListener('click', () => goPick(v.alt));
    return [b];
  };
  const colOf = (d, v, title) => {
    const [lead, ...rest] = v.list;
    const rain = lead && lead.wx?.rain && lead.wall.venue !== 'indoor' ? lead.wx.rainText : null; // a wet day shows it in the head: the first thing to weigh
    const head = el('div', { class: `pick-dh${rain ? ' wet' : ''}` }, el('span', {}, title), ...(rain ? [el('em', {}, rain)] : []));
    // the 내 암장 that are out (and why), and the ones past the top three: none goes missing without a word
    const out = [...(v.skipped.length ? [`빠진 곳 · ${v.skipped.slice(0, 2).map((x) => `${shortName(x.wall)} ${x.why}`).join(' · ')}${v.skipped.length > 2 ? ` 외 ${v.skipped.length - 2}곳` : ''}`] : []), ...(v.more ? [`내 암장 ${v.more}곳 더`] : [])];
    const skipped = out.length ? [el('p', { class: 'pick-skip' }, out.join(' · '))] : [];
    if (!lead) return el('div', { class: 'pick-col' }, head, ...(out.length ? [] : [el('p', { class: 'pick-empty' }, '추천할 곳이 없어요')]), ...skipped, ...altBtn(v));
    const tl = bar(lead);
    const leadBtn = el('button', { type: 'button', class: 'pick-lead', 'data-focus': `lead-${d.day.label}` },
      nameOf(lead, v.mineDay),
      whyLine(lead, true),
      tl,
      ...(tl ? [el('span', { class: 'pick-ax', 'aria-hidden': 'true' }, el('span', {}, '09'), el('span', {}, '15'), el('span', {}, '21'))] : []));
    leadBtn.addEventListener('click', () => goPick(lead));
    const others = rest.map((it) => {
      const b = el('button', { type: 'button', class: 'pick-next' },
        nameOf(it, v.mineDay),
        whyLine(it));
      b.addEventListener('click', () => goPick(it));
      return b;
    });
    return el('div', { class: 'pick-col' }, head, leadBtn, ...(others.length ? [el('div', { class: 'pick-rest' }, ...others)] : []), ...skipped, ...altBtn(v));
  };
  kids.push(el('div', { class: 'pick-cols' },
    ...(same ? [colOf(r.byDay[0], views[0], `${dayText(r.byDay[0].day.date)} · ${dayText(r.byDay[1].day.date)}`)] : r.byDay.map((d, i) => colOf(d, views[i], dayText(d.day.date))))));
  kids.push(el('p', { class: 'pick-key', 'aria-hidden': 'true' }, toneChip('sun'), '양달', toneChip('shade'), '응달'));
  const rainy = views.some((v) => [...v.list, ...(v.alt ? [v.alt] : [])].some(rainsOn));
  kids.push(el('p', { class: 'pick-note' }, `${allWindy ? '바람이 센 예보예요. ' : ''}${rainy ? '비 예보인 외벽은 뒤에 둬요. ' : ''}운영시간·해 계산 기준이에요. 가기 전에 공지를 확인해 주세요.`));
  $('pick-body').replaceChildren(...kids);
  if (pickRefocus) $('pick-body').querySelector(`[data-focus="${pickRefocus}"]`)?.focus({ preventScroll: true });
  pickRefocus = null;
}

// 공유하기 icon at the end of the name line: the link is copied right away (the icon turns into a check for a moment and
// the live note says so), and the toast offers 같이 가요 초대 for that wall.
function shareBtn(name, label = null, kind = 'wall') { // label: a word under the icon (the link strip's cell). kind 'crag': a ?crag= link, no 같이 가요 (that is for walls)
  const face = () => [icon('share'), ...(label ? [el('span', { class: 'sr-only' }, label)] : [])];
  const btn = el('button', { type: 'button', class: label ? 'lb-item' : 'icon-btn', 'aria-label': '공유하기', title: '공유하기' }, ...face());
  const say = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  let timer;
  btn.addEventListener('click', async () => {
    const url = shareUrl(location.href, name, kind);
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
    if (kind === 'crag') toast('링크를 복사했어요');
    else toast('링크를 복사했어요', () => inviteView.openInvite(name), '같이 가요 초대 만들기');
  });
  return el('span', { class: 'share-wrap' }, btn, say);
}

// First view under the chips: 안내 (status notes, then the memo lines that can stop a visit), parking (one line).
// Weekly closures are a 안내 line and the hatched grid rows.
const memoItem = (l) => el('li', { class: l.key ? 'key' : null },
  l.label ? el('span', { class: 'mk' }, l.label) : null,
  el('span', { class: l.label ? 'mv' : 'mv free' }, l.value));

// the regular closing day (정기휴무 월): the row carries a › and opens the wall sheet at 운영시간, the way the 주차 row opens its section
const CLOSED_LABEL = /^(정기휴무|정기휴장|휴무|휴관|휴장)$/;
const CLOSED_WORD = /(휴무|휴관|휴장)/; // a memo line that says a closing without a label ("설 연휴 휴무") gets the same row, labelled 지정휴무
function closedItem(l, m) {
  const go = el('button', { type: 'button', class: 'mv pv-go' }, el('span', { class: 'pv-t' }, l.value), el('span', { class: 'pv-arrow', 'aria-hidden': 'true' }, '›'));
  go.addEventListener('click', () => openWallSheet(m.name, go, { tab: 'time', section: 'hours' }));
  return el('li', { class: l.key ? 'key' : null }, el('span', { class: 'mk' }, l.label), go);
}
// one row under the 다녀왔어요 line: the rope chip(s) first, then the facts (tags, indoor side) as one muted line; the wall size is in the wall sheet's 시설
function metaRow(m) {
  // 외벽 facilities (스피드월, 지붕) are chips that only inform; the indoor side (실내벽, 실내 종류, 실내 높이) stays a muted line
  const wallTags = m.tags.filter((t) => t !== '실내벽');
  const facts = [...m.tags.filter((t) => t === '실내벽'), ...(m.indoorKinds ? [`실내 ${m.indoorKinds}`] : []), ...(m.indoorHeight ? [m.indoorHeight] : [])];
  const tagChips = wallTags.map((t) => el('span', { class: 'chip fact' }, t));
  const chips = m.rope ? [el('span', { class: 'chip rope' }, m.rope.ask), ...(m.rope.own ? [el('span', { class: `chip rope ${m.rope.own.tone}` }, m.rope.own.text)] : []), el('span', { class: 'sr-only' }, ` (${m.rope.basis})`)] : [];
  // 장비 대여 가능: a chip beside the rope chip; it opens the wall sheet at the fees (where the prices are)
  const rent = m.rental ? el('button', { type: 'button', class: 'chip rental', 'aria-label': `장비 대여 가능${m.rental.text ? `, ${m.rental.text}` : ''}, 요금 보기` }, '장비 대여') : null;
  rent?.addEventListener('click', () => openWallSheet(m.name, rent, { tab: 'use', section: 'fees' }));
  if (!chips.length && !facts.length && !rent && !tagChips.length) return [];
  const factsEl = facts.length ? el('span', { class: 'tags-line' }, facts.join(' · ')) : null;
  if (!m.info.folded.length && !m.sizes.length) return [el('p', { class: 'meta-row', title: m.rope?.basis }, ...chips, rent, ...tagChips, factsEl)]; // no 시설 section to go to
  // the rope chip opens the wall sheet at 시설 (the wall size and the memo lines); with no rope chip the facts line does. No arrow: the chip is the button
  const toFacility = (b) => { b.addEventListener('click', () => openWallSheet(m.name, b, { tab: 'use', section: 'facility' })); return b; };
  return [el('div', { class: 'meta-row meta-go' },
    chips.length ? toFacility(el('button', { type: 'button', class: 'meta-part', title: m.rope?.basis }, ...chips)) : null,
    rent, ...tagChips,
    factsEl ? (chips.length ? factsEl : toFacility(el('button', { type: 'button', class: 'meta-part' }, factsEl))) : null)];
}
function infoBlock(m) {
  const parts = [];
  // only what can stop a visit (closures, warnings, "!" lines); the other memo lines are the wall sheet's 시설 section
  if (m.info.shown.length) parts.push(el('ul', { class: 'memo-list info', 'aria-label': '안내' }, ...m.info.shown.map((l) => (CLOSED_LABEL.test(l.label ?? '') ? closedItem(l, m) : !l.label && l.key && CLOSED_WORD.test(l.value) ? closedItem({ ...l, label: '지정휴무' }, m) : memoItem(l)))));
  // one line: the status, then the wall's own lot (요금 · 주변 · 참고 are in the wall sheet's 주차 section)
  // status → cost for the stay → lot; the whole line opens the sheet at its 주차 section
  const { cost, where } = m.parkingLine;
  const go = el('button', { type: 'button', class: 'pv pv-go' }, // no aria-label: the visible words (status, cost, lot) are its name
    el('span', { class: 'pv-t' }, el('b', { class: `pk-word ${m.parking.tone}` }, m.parking.word), cost ? ` · ${cost}` : '', where ? el('span', { class: 'pv-sub' }, where) : null), el('span', { class: 'pv-arrow', 'aria-hidden': 'true' }, '›'));
  go.addEventListener('click', () => openWallSheet(m.name, go, { tab: 'use', section: 'parking' }));
  parts.push(el('div', { class: 'irow' }, el('span', { class: 'mk' }, '주차'), go));
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
  const go = el('button', { type: 'button', class: 'pv pv-go' }, el('span', { class: 'pv-t' }, el('span', { class: 'gear-ic', 'aria-hidden': 'true' }, icon('gear')), line), el('span', { class: 'pv-arrow', 'aria-hidden': 'true' }, '›'));
  go.addEventListener('click', () => openGearSheet(wall, near, go));
  return el('div', { class: 'irow' }, el('span', { class: 'mk' }, '근처'), go);
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
// 근처 외벽 (the crag card, src/near-walls.js): the app's walls within 60 km of the crag, nearest first; a crag with rain (or rain just past) lists the
// ones with an indoor wall first. The row opens #gear-sheet with one wall per slide (nothing is sent to stats). 지도 ↗ is a driving route from the
// crag to the wall in the map app the card's 길찾기 remembered (default 카카오맵); 외벽 탭에서 보기 closes the sheet and opens the wall's card,
// with a toast whose ‹ 싱글피치로 돌아가기 brings this crag's card back (뒤로 does not: tab and mode switches leave no history).
function cragNear(c, at) {
  const list = nearWalls(state.walls, c.crag.sun, { indoorFirst: c.cond.state === 'rain' || c.cond.state === 'recent' });
  const line = nearWallsLine(list);
  return line ? { line, onOpen: (opener) => openNearWalls(c.crag, list, at, opener) } : null;
}
function openNearWalls(crag, list, at, opener, startIndex = 0) {
  const dlg = $('gear-sheet');
  const from = { name: crag.name, lat: crag.sun.lat, lng: crag.sun.lng };
  const app = navPref() === 'naver' ? 'naver' : 'kakao';
  let toWall = null;
  const items = list.map((w) => {
    const p = wallPosition(w.wall);
    let status = '';
    try { status = cardModel(buildList([w.wall], at)[0], at).statusText; } catch { /* a broken entry: the venue word alone */ }
    return { id: w.name, name: w.name, km: w.km, bearing: w.bearing, note: [VENUE_WORD[w.venue], status].filter(Boolean).join(' · '), icon: 'route', zone: null,
      links: [{ label: '지도', href: routeUrl(from, { name: w.name, lat: p.lat, lng: p.lng }, app), icon: 'map', external: true, nearMap: true },
        { label: '외벽 탭에서 보기', onClick: () => { toWall = w.name; dlg.close(); } }] };
  });
  const body = nearSheetBody(items, { startIndex, icon, label: '근처 외벽' });
  if (!body) return;
  $('gear-body').replaceChildren(body);
  $('gear-title').textContent = '근처 외벽';
  dlg.addEventListener('close', () => {
    if (toWall) { // after dialog-back's history.back(): the browser restores the old scroll after popstate, which would undo the reveal's scroll
      let done = false;
      const go = () => { if (!done) { done = true; showWallCard(toWall, crag.name); } };
      window.addEventListener('popstate', () => requestAnimationFrame(go), { once: true, capture: true });
      setTimeout(go, 500); // no entry was popped: go anyway
      return;
    }
    (opener?.isConnected ? opener : document.querySelector('.crag-row.is-open [data-opens="near"]'))?.focus(); // the card may have been drawn again
  }, { once: true });
  dlg.showModal();
  dlg.scrollTop = 0;
  body.start();
}
// to the 외벽 list with that wall's card open and focused (the mode switch's 외벽, then the map card's 목록에서 자세히 보기).
// From a crag (fromCrag): the toast carries ‹ 싱글피치로 돌아가기 for 8 s; the user's own mode or tab switch takes it away (it would point at a stale origin).
let backToCrag = null; // the toast button's function while that toast is up
function showWallCard(name, fromCrag = null) {
  setUi('mode', 'wall');
  showTab('list');
  const cleared = revealClearing(name);
  if (!fromCrag) { if (cleared) toast('조건에 안 맞지만 이 암장만 보여 드려요'); return; }
  backToCrag = () => {
    backToCrag = null;
    setUi('mode', 'crag');
    showTab('list');
    openCrag(fromCrag); // opens the row, focuses its head and brings it to the top
  };
  toast(cleared ? '조건에 안 맞지만 이 암장만 보여 드려요' : '외벽 탭으로 왔어요', backToCrag, '‹ 싱글피치로 돌아가기', 8000);
}
const dropBackToCrag = () => { dismissToast(backToCrag); backToCrag = null; };

// The picture in the sun box (sun-scene.js): three scenes, only the sun moves; the open row is rebuilt on every slider move
function dialFig(d, at) { return renderScene(d, at); }

// The sun's now: compass + sentence + today's sunny hours. On a day the wall is closed the compass
// would describe a visit that can't happen, so a short note stands in for it (sunny hours stay for reference).
// The one-line limit under every estimated sun time (the same words in the sun box and the 계절별 양달 tab)
const sunLimit = () => el('p', { class: 'sun-limit' }, '벽 방향과 지형으로 계산한 예상이에요. 건물·나무, 날씨·구름, 오버행·벽 경사는 반영하지 않아요.');
const noSunMath = (d) => d.state === 'unknown' || d.state === 'override';
// 접힌 계산 기준 (양달 카드 안: 한 줄 접힘, 기본 닫힘)
const sunWhy = () => el('details', { class: 'sun-why' }, el('summary', {}, '계산 기준'), sunLimit());
// 맨 위 한 줄: 상태 칩 + 핵심 값 (구간이 여러 개면 구간마다 한 덩어리)
function sunHead(d, verdict) {
  const chip = d.state === 'unknown' ? '계산 불가' : `${vs.live ? '지금' : '그 시각'} ${d.lit ? '양달' : '응달'}`; // the chip is the moment's state; the line under it is the day's window
  const cls = d.state === 'unknown' ? 'na' : d.lit ? 'lit' : 'dark';
  // an open day with hours: only the sun inside them ("운영 중 예상 양달 10:10–17:30", or 없음); no hours: the day's whole window
  const key = d.state === 'unknown' ? null : verdict
    ? (verdict.on.length
      ? el('p', { class: 'dwhen' }, el('span', { class: 'dw-k' }, `${d.dayLabel} 운영 중 예상 양달`), ...verdict.on.map((w) => el('b', { class: 'dw-r' }, formatRanges([w]))))
      : el('p', { class: 'dwhen' }, el('b', {}, verdict.text)))
    : d.windows.length
      ? el('p', { class: 'dwhen' }, el('span', { class: 'dw-k' }, `${d.dayLabel} 예상 양달`), ...d.windows.map((w) => el('b', { class: 'dw-r' }, formatRanges([w]))))
      : el('p', { class: 'dwhen' }, el('b', {}, `${d.dayLabel === '오늘' ? '오늘은' : d.dayLabel} 하루 종일 응달로 예상돼요`));
  return el('div', { class: 'sb-head' }, el('span', { class: `sb-chip ${cls}` }, chip), d.state === 'override' ? null : key);
}
function sunBox(d, name, closedDay, verdict, veilText = null, at = null) {
  // the dial says why ("해가 벽 뒤에 있어요" under it, 해·벽 색), so a facing/sun reason keeps only the first sentence (where the sun is); a terrain/night reason is not in the picture and stays
  const words = d.sentence.length > 3 && /^ 해가 (벽|등) 뒤쪽/.test(d.sentence[3].text) ? d.sentence.slice(0, 3) : d.sentence;
  const sentence = el('p', { class: 'dsent' }, ...words.map((p) => (p.bold ? el('b', {}, p.text) : p.text)));
  const sunNoteText = state.walls.find((w) => w.name === name)?.sun_note; // walls that face different ways: the verdict is for the main one
  const sunNote = sunNoteText ? el('p', { class: 'sun-note' }, sunNoteText) : null;
  const veil = veilText ? el('p', { class: 'sun-veil' }, icon('sky-cloud'), veilText) : null; // the sky hides the sun: the verdict above stays
  const extra = sunNote || veil ? el('div', { class: 'sun-extra' }, sunNote, veil) : null; // one grid track for both quiet lines
  if (closedDay) {
    return el('section', { class: 'sunbox solo', 'aria-label': '해' }, el('div', { class: 'sb-txt' },
      el('p', { class: 'dsent off' }, '이 날은 운영하지 않아서 해 나침반은 접어 두었어요.'),
      noSunMath(d) ? null : el('p', { class: 'dwhen ref' }, d.windows.length ? `참고 · 예상 양달 시간 ${formatRanges(d.windows)}` : '참고 · 예상으로는 하루 종일 응달'), sunWhy()));
  }
  if (noSunMath(d)) {
    return el('section', { class: 'sunbox solo', 'aria-label': '해' }, el('div', { class: 'sb-txt' }, sunHead(d, null), sentence, extra, d.state === 'override' ? sunWhy() : null));
  }
  // the card is the sky (colour by the sun's state and height), the picture stands in it, the words ride on the ground colour
  return el('section', { class: `sunbox sc ${sceneTone(d, at)}`, 'aria-label': '해' },
    el('div', { class: 'sb-sky' },
      sunHead(d, verdict), // the head already tells the sun inside the open hours
      el('div', { class: 'sb-fig' }, el('div', { class: 'sundial-slot' }, dialFig(d, at)))),
    el('div', { class: 'sb-ground' }, sentence, extra, sunWhy()));
}


const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Expanded row (v6): what decides the visit first; the rest is in the wall sheet (자세히 ›).
// the sky hides a lit wall's sun at the picked hour (today / tomorrow only): one quiet line in the sun box, the verdict stays
function veilText(m, wall, at) {
  const h = m.sun?.tone === 'sun' && wall.venue !== 'indoor' ? wxEntry(wall, at) : null;
  return h && skyVeils(h.c) && forecastTrusted(at, new Date()) ? `흐려서 해가 거의 안 나요 (${String(at.getHours()).padStart(2, '0')}시 예보)` : null;
}
function rowDetails(m, wall, at) {
  const dial = dialModel(wall, at, { isNow: vs.live, dayLabel: m.dayLabel });
  // the way into the wall sheet (hours table, seasonal sun, fees, parking details): one button at the end of the facts
  const sheetBtn = el('button', { type: 'button', class: 'sheet-open', 'data-sheet-open': '', 'data-name': m.name },
    el('span', { class: 'so-t' }, el('b', {}, '암장 정보 자세히'), el('small', {}, '운영시간 · 요금 · 주차 · 루트')), el('i', { 'aria-hidden': 'true' }, '›'));
  sheetBtn.addEventListener('click', () => openWallSheet(m.name, sheetBtn));
  // 제보 stays at the foot as quiet text links: a correction is rare, and the card's job is the hours above
  const photoAsk = photoLink(m); // (this one is on the name row: a photo is what the card lacks most)
  const helps = config.reportEndpoint
    ? el('div', { class: 'help-row' },
      el('button', { type: 'button', class: 'help-link', 'data-act': 'report', 'data-name': m.name }, '정보 수정 요청'),
      m.hasChat ? null : el('button', { type: 'button', class: 'help-link', 'data-act': 'report', 'data-name': m.name, 'data-kind': '오픈채팅방' }, '오픈채팅 추가'))
    : null;
  // 다녀왔어요 sits beside 자세히 at the card's foot; its sheet asks the visit time and the crowd. Under a sun picture the two are the picture card's
  // own foot (sc-actions: the wall's base, painted with the card's colours); a wall with no picture (indoor, closed day) keeps them in a row of their own (go-row)
  const sunParts = withWeather(sunBox(dial, m.name, m.closedDay, m.closedDay ? null : sunVerdict(wall, at), veilText(m, wall, at), at), weatherBox(m, wall, at)); // the sun box (the 날씨 is the top line of its sky), after the facts
  const sunCard = sunParts.find((x) => x.classList?.contains('sc'));
  sunCard?.append(el('div', { class: 'sc-actions' }, el('div', { class: 'sc-frame' }, beenBtn(m), sheetBtn)));
  const goRow = sunCard ? null : el('div', { class: 'go-row' }, beenBtn(m), sheetBtn);
  const pos = wallPosition(wall);
  const links = linkBar(m.links, m.navAddress ?? m.address, { start: favBtn(m.name, '즐겨찾기'), end: shareBtn(m.name, '공유') }, pos ? { lat: pos.lat.toFixed(5), lng: pos.lng.toFixed(5), name: m.name } : null); // 즐겨찾기 · 길찾기 · 공지사항 · 오픈채팅 · 전화 · 네이버지도
  return [
    // no photo: a plain block takes the photo's place (hours on its foot, the camera at its corner), so both cards have the same layout
    m.photo ? null : el('div', { class: 'ph-hero' }, el('div', { class: 'rhero-cap' }, m.suspended ? null : el('small', {}, m.today.lead), todayText(m)), photoAsk),
    links, // the link strip hangs under the photo (or its place) across both columns of the wide layout
    el('div', { class: 'm-cols' },
      // what decides the visit: name, today's hours and the sun now (open: the row already says how long is left)
      el('div', { class: 'm-head' },
        el('h3', { class: 'x-name' }, m.name), // the name is on the row's own line (read aloud here)
        (m.state === 'open' || m.suspended ? m.place !== m.meta && m.place : !m.photo && m.sub) ? el('p', { class: 'x-sub' }, m.state === 'open' || m.suspended ? m.place : m.sub) : null, // (the region is already on the row's own line: not said twice) // a suspended wall says 임시 휴관 중 once, in the pill (or the photo's chip) // a closed photo card: the pill on the photo already says when it opens
        m.suspended ? el('p', { class: 'susp-note' }, [m.suspended.since, m.suspended.note].filter(Boolean).join(' · ') || '이용 전 확인해 주세요') : null,
        // (no 휴게 chips on the card: the hours already split around the break, the list bar and the wall sheet's table show it)
        addrLine(m)), // the address right under 오늘 운영
      el('div', { class: 'm-info' },
        // a photo card: the link strip hangs right under the photo (before the visit: 길찾기, 전화), the 다녀왔어요 line comes after
        ...crowdBox(m), // before the visit (길찾기 · 전화), then 다녀왔어요
        ...metaRow(m),
        m.holiday ? el('p', { class: 'hol-note' }, m.holiday) : null,
        m.staleNote ? el('p', { class: 'stale-note' }, m.staleNote) : null,
        ...infoBlock(m),
        gearRow(wall),
        m.settingBadge ? el('p', { class: 'setnew' }, el('span', { 'aria-hidden': 'true' }, '✦ '), m.settingBadge) : null), // the check dates (정보·공지·세팅) are in the wall sheet
      ...sunParts, // after the facts (the right column when wide)
      goRow),
    visitLog(m),
    helps,
    rowButtons(m.name),
  ];
}

// The wall sheet (src/wall-sheet.js) is drawn from here: the hours grid, seasonal sun and fee table read the view state.
// 이용 tab = 운영시간 · 요금 · 주차, each with its date and a 수정 요청 that opens the report sheet with the matching 종류;
// a section with nothing to show asks for a report instead. 양달 tab = the seasonal sun (no tab for a wall without sun math).
function sheetSection(m, s, content) {
  // a filled section ends in a quiet 수정 요청 link; an empty one holds a 알려 주기 button in its dotted box (the gap is the invitation)
  const ask = config.reportEndpoint && s.kind // (a computed section such as 계절별 양달 has no report kind)
    ? el('button', { type: 'button', class: s.empty ? 'ws-ask' : 'help-link ws-fix' }, s.empty ? '알려 주기' : '수정 요청') : null;
  ask?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: s.kind, kinds: TAB_KINDS[s.kind === '운영시간' ? 'time' : 'use'] } })));
  // the title row carries 수정 요청 (a filled section), the facts follow, and the check date is a quiet line at the card's bottom right
  return el('section', { class: `ws-sec${s.empty ? ' empty' : ''}`, 'aria-label': s.title, 'data-sec': s.key },
    el('div', { class: 'ws-sec-h' }, el('h3', {}, s.title), s.empty ? null : ask),
    s.empty ? el('div', { class: 'ws-empty' }, el('p', {}, '아직 정보가 없어요'), ask) : content,
    ...(s.empty || s.dated === false ? [] : s.key === 'parking' // the parking has its own date (or none): the hours' date says nothing about it
      ? [m.parkingStale ? el('p', { class: 'ws-stale' }, '요금과 주차 정보가 바뀌었을 수 있어요 · 6개월 넘게 확인하지 못했어요') : null, m.parkingChecked ? el('p', { class: 'ws-chk end' }, shortenDates(m.parkingChecked, ymd(new Date()))) : null]
      : [el('p', { class: 'ws-chk end' }, shortenDates([m.checked, s.key === 'hours' ? m.noticeChecked : null].filter(Boolean).join(' · '), ymd(new Date())))]));
}
// 루트 tab: the newest route count as bars (a chip per wall section when the count is by section), dimmed and headed 세팅 이후 분포 미확인
// once the wall was set after it; nothing recorded: a dotted box asking for a report.
function routePane(m, wall) {
  const mine = loadMyGrade(storage); // 내 그레이드 (내 정보): its rows are drawn stronger and counted
  const v = routeView(wall, new Date(), mine, ui.venue); // ui.venue: the 구분 filter opens the indoor or outdoor section first
  const ask = config.reportEndpoint ? el('button', { type: 'button', class: v ? 'help-link ws-fix' : 'ws-ask' }, v ? '수정 요청' : '알려 주기') : null;
  ask?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: '루트 분포', kinds: TAB_KINDS.routes } })));
  const head = el('div', { class: 'ws-sec-h' }, el('h3', {}, '루트'), v ? ask : null);
  const setLine = m.setting ? el('p', { class: 'ws-chk' }, shortenDates(m.setting, ymd(new Date()))) : null; // 마지막 세팅 · 다음 예정
  if (!v) return el('section', { class: 'ws-sec empty', 'aria-label': '루트' }, head, setLine, el('div', { class: 'ws-empty' }, el('p', {}, '아직 정보가 없어요'), ask));
  const bars = el('div', { class: `rt-bars${v.stale ? ' stale' : ''}` });
  const total = el('p', { class: 'rt-total', 'aria-live': 'polite' });
  const chips = v.views.length > 1 ? el('div', { class: 'rt-chips', role: 'group', 'aria-label': '벽 고르기' }) : null;
  const show = (key) => {
    const x = v.views.find((a) => a.key === key);
    bars.replaceChildren(el('ul', { class: 'gy-list' }, ...x.rows.map((r) => {
      const bar = el('span', { class: 'gy-bar' });
      bar.style.width = `${r.frac * 100}%`;
      return el('li', { class: r.mine ? 'mine' : null }, el('span', { class: 'gy-g' }, r.label), el('span', { class: 'gy-trk', 'aria-hidden': 'true' }, bar), el('span', { class: 'gy-n' }, String(r.n)));
    })));
    total.textContent = `총 ${x.total}개${v.mine ? ` · 내 구간 ${v.mine.label} ${x.mineTotal}개` : ''}`;
    for (const b of chips?.children ?? []) b.setAttribute('aria-pressed', String(b.dataset.key === key));
  };
  chips?.append(...v.views.map((x) => {
    const b = el('button', { type: 'button', class: 'rt-chip', 'data-key': x.key }, x.label);
    b.addEventListener('click', () => show(x.key));
    return b;
  }));
  show(v.first);
  return el('section', { class: 'ws-sec', 'aria-label': '루트' }, head, setLine, el('p', { class: 'ws-chk' }, v.head), chips, bars, total,
    v.mine ? null : el('p', { class: 'sh-hint' }, '내 정보에서 내 그레이드를 정하면 그 구간이 진하게 보여요.'));
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
    el('caption', {}, '계산한 주차 요금'),
    el('thead', {}, el('tr', {}, ...(solo ? [] : [el('th', { scope: 'col' }, '주차장')]), ...(hasRule ? [el('th', { scope: 'col' }, f.rows[0].first?.head ?? '최초'), el('th', { scope: 'col' }, f.rows[0].step?.head ?? '이후')] : []), el('th', { scope: 'col' }, `${f.hours}시간`), el('th', { scope: 'col' }, '하루'), ...(hasNote ? [el('th', { scope: 'col', class: 'pf-note' }, '비고')] : []))),
    el('tbody', {}, ...f.rows.flatMap((r) => {
      // 비고: free span + conditions. Short: in its cell. Long (NOTE_MAX): a line of its own under the row across every column.
      const note = [r.free, r.note].filter(Boolean).join(' · ');
      const long = note.length > NOTE_MAX;
      const name = el('th', { scope: 'row' }, r.name, r.walk_min ? el('span', { class: 'pf-walk' }, `도보 ${r.walk_min}분`) : null);
      // one price for any stay: everything after the name becomes one cell (the amount, its short condition after it)
      const cells = r.flat ? [el('td', { colspan: String(colCount - (solo ? 0 : 1)), class: 'pf-flat' }, r.cells.at(-1), note && !long ? el('span', { class: 'pf-cond' }, ` (${note})`) : null)]
        : [...(hasRule ? [el('td', {}, r.first?.cell ?? '–'), el('td', {}, r.step?.cell ?? '–')] : []), el('td', {}, r.cells[Math.max(0, f.cols.indexOf(f.hours))]), el('td', {}, r.cells.at(-1)), ...(hasNote ? [el('td', { class: 'pf-note' }, (long ? '' : note) || '–')] : [])];
      return [el('tr', long ? { class: 'pf-has-more' } : {}, ...(solo ? [] : [name]), ...cells), ...(long ? [el('tr', { class: 'pf-more' }, el('td', { colspan: String(colCount) }, note))] : [])];
    })))) : null;
  // status and the wall's own lot, then the amounts (the typed wording small under them), then the rest (주변 · 참고)
  const head = el('p', { class: 'pv' }, el('b', { class: `pk-word ${m.parking.tone}` }, m.parking.word), onsite.length ? ` · ${onsite.join(' · ')}` : '');
  const rows = m.parkingMore.filter(({ k }) => !(f && k === '요금')).map(({ k, v }) => el('p', { class: 'pnear' }, el('span', { class: 'pn-k' }, k), v));
  return el('div', {}, head, ...(f ? [fees, ...rows] : rows));
}
// 게시판 tab: the wall's one-line board (every post, 더 보기, the form) and the 희노애Rock reviews; made when the tab is first shown
function boardPane(m) {
  return [boardBox(m.name, { mode: 'full' }), blogBox(m.blog)].filter(Boolean);
}
function buildWallSheet(wallName) {
  const row = allRows.find((r) => r.wall.name === wallName);
  const at = shown.at ?? new Date();
  if (!row) return null; // an unknown wall: nothing opens
  const wall = row.wall;
  const m = modelOf(row, at);
  const d = dialModel(wall, at, { isNow: vs.live, dayLabel: m.dayLabel });
  const blocks = { hours: hoursGrid(wall, at), fees: feesBlock(wall), sun: seasonSunBlock(wall, at, d) };
  const sheet = sheetModel(m, { hours: Boolean(blocks.hours), fees: Boolean(blocks.fees), sun: Boolean(blocks.sun), board: Boolean(config.boardUrl || m.blog) });
  const content = { ...blocks, parking: sheetParking(m), facility: el('ul', { class: 'memo-list info' }, ...(m.sizes.length ? [memoItem({ label: '벽 스펙', value: [...m.sizes.filter((x) => x.startsWith('폭')), ...m.sizes.filter((x) => !x.startsWith('폭'))].join(' · ') })] : []), ...m.info.folded.map(memoItem)) };
  const pos = wallPosition(wall);
  return {
    onClose: () => { const cur = weeklyHours(wall, at).season; go({ type: 'season', name: wall.name, pick: cur, current: cur }); }, // picking the day's own season ends a 하계/동계 preview: it does not outlive the sheet
    tabs: [...sheet.tabs.map((t) => ({
      ...t,
      icon: icon({ time: 'clock', use: 'ticket', routes: 'route', board: 'chat' }[t.key] ?? 'info'),
      pane: t.key === 'routes' ? routePane(m, wall) : t.key === 'board' ? () => boardPane(m) : el('div', { class: 'ws-use' }, t.key === 'time' ? timeLegend(blocks) : null, ...sheet[t.key].map((s) => sheetSection(m, s, content[s.key]))), // 시간 or 이용
    }))],
  };
}
registerWallSheet(buildWallSheet);

// 희노애Rock 후기: a small list (newest first, 3 shown, "외 N개" unfolds the rest in place); the map card keeps one link.
// Titles and dates only via textContent; the urls were checked in normalizeWall (BLOG_URL_RE).
const BLOG_SHOWN = 3;
function blogBox(blog, withList = true) {
  if (!blog) return null;
  const { posts, first } = blog;
  if (!withList) {
    return el('div', { class: 'blog' }, el('div', { class: 'blog-row' },
      el('a', { class: 'btn sub blog-link', href: first.url, target: '_blank', rel: 'noopener noreferrer' }, first.label)));
  }
  const item = (p) => el('li', {}, el('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer' },
    el('span', { class: 'bt' }, p.title), el('span', { class: 'bd' }, p.date)));
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
  return el('div', { class: 'blog' },
    el('p', { class: 'blog-h' }, el('b', {}, '희노애Rock 후기'), ' 참고용 · 운영시간은 앱 정보가 기준'),
    el('ul', { class: 'blog-list' }, ...posts.slice(0, BLOG_SHOWN).map(item)),
    restList, more);
}

// the hours text of 오늘 운영; while the wall is 임시 휴관 중 it is a pill instead
const todayText = (m) => el('b', { class: m.suspended ? 'susp-pill' : null }, m.today.text);
// 다녀왔어요 (the open card only): a stamp square left of 자세히; opens the 기록 추가 sheet with this wall fixed.
// Outlined until there is a record, then filled with the count; just after a save the stamp icon gives way to the 해벽 stamp, pressed once.
// place: the crag object when m is a 싱글피치 crag (not in state.walls; the sheet's time bar reads it, no hours).
function beenBtn(m, place = null) {
  const mark = logView.justStamped(m.name) ? inkStamp(el('span', { class: 'stamp been-stamp stamp-in', 'aria-hidden': 'true' }), state.walls.find((w) => w.name === m.name)) : icon('stamp');
  const been = el('button', { type: 'button', class: `btn been-btn${m.visits ? ' done' : ''}`, 'data-focus': 'been', 'aria-label': m.beenAria ?? '다녀왔어요 기록 추가' }, mark, el('small', {}, m.visits ? m.beenLabel.replace('다녀옴 ', '') : m.beenLabel));
  been.addEventListener('click', () => logView.openAdd({ wall: m.name, from: been, place }));
  return been;
}
// the crag card's 다녀왔어요: the wall card's button on a crag (the label and count as card-model gives a wall)
function cragBeen(name) {
  const n = logView.recordsFor(name).length;
  return beenBtn({ name, beenLabel: n ? `다녀옴 ${n}번` : '다녀왔어요', visits: n || null, beenAria: n ? `다녀왔어요 기록 추가, 지금까지 ${n}번` : null },
    state.crags.find((c) => c.name === name) ?? null);
}
// the crag card's 정보 수정 요청: the wall's report sheet, crag mode (its own kinds, no photo; src/report-view.js)
function reportCrag(name) { document.dispatchEvent(new CustomEvent('wall:report', { detail: { name, crag: true } })); }
// the latest 3 records, small, at the foot; nothing at all without records
function visitLog(m) {
  const v = m.visits;
  return v ? el('div', { class: 'mylog' },
    el('ul', { class: 'mylog-list' }, ...v.recent.map((r) => el('li', {}, el('span', { class: 'ml-d' }, r.date), r.memo ? el('span', { class: 'ml-m' }, r.memo) : null))),
    el('p', { class: 'mylog-note' }, '이 기기에만 저장돼요')) : null;
}
// ---- 혼잡도 (crowd.js; setup: docs/crowd-setup.md) ----
// The published CSV is read once at load and again at most every 5 minutes (tick); a failed read keeps the last good
// one (or none: the chip hides). Reports go from the 기록 추가 sheet (log-view.js calls crowdAsk/sendCrowd); this
// device's own reports: localStorage, 30 minutes between reports of a wall, 2 a day per wall, 5 a day, one per visit.
const CROWD_SEND = crowdReady(config.crowdEndpoint, config.crowdFields);
const CROWD_KEY = 'open-wall:crowd-sent';
const crowd = { byWall: null, at: 0, busy: false };
const readSent = () => { try { return JSON.parse(localStorage.getItem(CROWD_KEY) ?? 'null'); } catch { return null; } };
// the sheet's question: null (not set up, no time, too old or in the future), canReport's {ok: false, reason, waitMin} (limit reached), 'ask'
function crowdAsk(wall, date, time) {
  if (!CROWD_SEND || !time || !askable(date, time)) return null;
  const r = canReport(readSent(), wall, Date.now(), `${date} ${time}`);
  return r.ok ? 'ask' : r;
}
async function loadCrowd() {
  if (!config.crowdCsvUrl || crowd.busy || Date.now() - crowd.at < 5 * 60e3) return;
  crowd.busy = true;
  try {
    const res = await fetch(config.crowdCsvUrl, { credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    const byWall = new Map();
    for (const r of parseCrowdCsv(await res.text(), state.walls.map((w) => w.name))) {
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
  if (!pos || wall.venue === 'indoor' || wx.busy.has(wall.name)) return; // an indoor wall has no weather to plan for
  const known = wx.byWall.get(wall.name);
  if (weatherFresh(known, Date.now()) && !(known.current && Date.now() - known.at > CURRENT_MS)) return; // 실황 is asked again after 15 minutes
  wx.busy.add(wall.name);
  let hours = null, current = null;
  try {
    const res = await fetch(forecastUrl(pos.lat, pos.lng), { credentials: 'omit', signal: AbortSignal.timeout?.(8000) });
    if (res.ok) { const j = await res.json(); hours = parseForecast(j); current = parseCurrent(j); }
  } catch { /* quiet: no forecast line */ }
  wx.byWall.set(wall.name, { hours, current, at: Date.now() });
  wx.busy.delete(wall.name);
  if (hours || current) refillOpen(wall.name);
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
  const sun = li.querySelector('.sunbox');
  if (sun) withWeather(sun, weatherBox(m, row.wall, shown.at), true);
}
// the open card's forecast: render (a shared link opens a row, the minute tick) and toggleRow (a tap opens one without a render)
const weatherFor = (name) => { const r = shown.rows.find((x) => x.wall.name === name); if (r) loadWeather(r.wall); };
const weatherAheadOf = (name, at) => { const hours = wx.byWall.get(name)?.hours; return hours ? hoursAhead(hours, at) : []; };
const weatherCtx = (name, at) => {
  const hours = wx.byWall.get(name)?.hours;
  return hours ? pickHour(hours, at) : null;
};
// 오늘의 해벽 (poster-share.js): the forecast hour for a card made now. The cache first, else one request; waits at most 2 s, then null (no line).
async function posterWeather(name, at) {
  const wall = state.walls.find((w) => w.name === name);
  if (!wall) return null;
  await Promise.race([loadWeather(wall), new Promise((ok) => setTimeout(ok, 2000))]);
  return weatherCtx(name, at);
}
// The 날씨 is the first line of the sun box's sky (one sky, no seam); a box without a picture (closed day, no sun math) keeps it right above.
// → the nodes to put in the card (`inPlace`: the box is already there, so only the weather is added)
function withWeather(sun, wx, inPlace = false) {
  const sky = sun.querySelector('.sb-sky');
  if (sky) sky.prepend(...wx);
  else if (inPlace) sun.before(...wx);
  else return [...wx, sun];
  return inPlace ? [] : [sun];
}
// the 날씨 상자: the 실황 (Open-Meteo `current`): the temperature now (big), the sky word, wind and gust, 바람 셈 and the observation time. Only while the
// picked moment is now (no forecast is told here); no 실황 yet → nothing, not even a gap. The first one shown in a visit is counted (stats.js, a name only).
let wxShownSent = false;
function weatherBox(m, wall, at) {
  const cur = vs.live ? wx.byWall.get(wall.name)?.current : null;
  if (!cur) return [];
  if (!wxShownSent) { wxShownSent = true; document.dispatchEvent(new CustomEvent('stats:weather-shown')); }
  const strong = windy(cur);
  const [w, g] = [Math.round(cur.w), Math.round(cur.g)];
  const words = [skyKind(cur.c).text, g > w ? `바람 ${w}–${g}m/s` : `바람 ${w}m/s`]; // wind and gust as one range: the row stays one line
  return [el('section', { class: 'wx-box', 'aria-label': `날씨, ${cur.hhmm} 관측, 기온 ${Math.round(cur.t)}도, ${words.join(', ')}${strong ? ', 바람 셈' : ''}` },
    el('div', { class: 'wxb-top', 'aria-hidden': 'true' },
      el('span', { class: 'wxb-t' }, `${Math.round(cur.t)}°`),
      strong ? el('span', { class: 'wx-pill' }, '바람 셈') : null, // beside the temperature; the words wrap under both
      el('span', { class: 'wxb-d' }, words.join(' · ')),
      el('span', { class: 'wxb-obs' }, `${cur.hhmm} 관측`)))];
}
// → true once the POST went out (no-cors: the form's answer can't be read). The visit is marked as reported BEFORE the
// request (a second tap or a reopened sheet while it is in flight is refused), and the mark is taken back if it fails.
async function sendCrowd(name, level, date, time) {
  const before = readSent();
  const store = (v) => { try { localStorage.setItem(CROWD_KEY, JSON.stringify(v)); } catch { /* private mode: no limit */ } };
  store(markSent(before, name, Date.now(), `${date} ${time}`));
  try {
    await fetch(config.crowdEndpoint, {
      method: 'POST', mode: 'no-cors', credentials: 'omit',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: crowdPayload(config.crowdFields, name, level, `${date} ${time}`),
    });
  } catch {
    store(before);
    return false;
  }
  bumpCrowd(storage); // 내 활동's 혼잡도 제보 count: only a report that went out
  return true;
}
// chip: level in words + a 1–3 bar meter (not colour alone)
function crowdBox(m) {
  const c = m.crowd;
  if (!c || c.chip.muted) return []; // "제보 모으는 중" is only an empty state
  return [el('p', { class: `crowd-chip${c.chip.muted ? ' muted' : ''}`, 'data-level': c.chip.level ?? 'none' },
    c.chip.bars ? el('span', { class: 'crowd-meter', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')) : null,
    c.chip.text)];
}
const modelOf = (row, at) => cardModel(row, at, {
  visits: logView.recordsFor(row.wall.name), crowd: crowdCtx(row.wall.name, at), settingNew: settingChanged(row.wall, favs, seen),
  weather: weatherCtx(row.wall.name, at), weatherAhead: weatherAheadOf(row.wall.name, at), ropeM: Number(ui.ropeM) || 0, stayHours: Number(ui.minHours) || undefined, // the parking cost is told for the stay the filter asks (3/5/8시간+), else the default
});

let rowSeq = 0;
// the list row says only the value ("4시간"); the open card's pill keeps "4시간 가능" (style.css .lf-pre): said once in the group heading, not on every row
const FEW_MIN = 180; // 3 hours or less to stay: said bolder, so a short row stands out among the same-looking rest
const leftParts = (left) => { const m = /^(\d+시간)( 가능)$/.exec(left); return m ? [m[1], el('span', { class: 'lf-pre' }, m[2])] : [left]; };
// what the dimmed / veiled look says in words (a screen reader hears no opacity)
const a11yNotes = (row) => { const n = [row.cold && `기온 ${ui.tempMin}도 미만`, row.wet && `${row.wetText} 예보`, row.windy && '바람 셈 예보', row.veil && '해 가려짐'].filter(Boolean); return n.length ? `, ${n.join(', ')}` : ''; };
function timeRow(row, at) {
  const m = modelOf(row, at);
  const { bar } = m; // "내일 10:00 오픈" draws tomorrow's hours, without a now tick; no bar without hours
  const id = `row-x-${++rowSeq}`;
  const isOpen = vs.openName === m.name;
  // 양달/응달/방향 모름 in words, not only the orange band
  const { sun } = m;
  const extra = rowExtra(m);
  const btn = el('button', { type: 'button', class: 'row-btn', 'aria-expanded': String(isOpen), 'aria-controls': id },
    el('span', { class: 'l1' },
      sunChip(sun, row.veil), // first: the same column on every open row
      el('span', { class: 'rfav', 'data-favmark': m.name, role: 'img', 'aria-label': '즐겨찾기', hidden: favs.includes(m.name) ? null : '' }, '♥'),
      el('span', { class: 'rname', title: m.shortName }, m.shortName),
      // the one extra chip (새 세팅 > 혼잡 > 무료, card-model rowExtra) and the region share what room is left; one that does not fit wraps
      // out of sight whole (style.css .rsub), so the closing time never wraps and no region is cut to a stray letter (the rest is on the card)
      el('span', { class: 'rsub' },
        extra?.kind === 'setnew' ? el('span', { class: 'setnew', 'data-setmark': m.name, title: m.settingBadge ?? extra.text }, el('span', { 'aria-hidden': 'true' }, '✦ '), extra.text) : null,
        extra?.kind === 'crowd' ? el('span', { class: 'crowdnow', 'data-level': m.crowdTag.level, role: 'img', 'aria-label': m.crowdTag.aria },
          el('span', { class: 'crowd-meter', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), extra.text) : null,
        extra?.kind === 'free' ? feeChip(m) : null,
        m.meta ? el('span', { class: 'rmeta', title: m.meta }, m.meta) : null),
      el('span', { class: `left${row.status?.state === 'open' && row.status.remainingMin <= FEW_MIN ? ' few' : ''}` }, ...leftParts(m.left), a11yNotes(row) ? el('span', { class: 'sr-only' }, a11yNotes(row)) : null),
      el('span', { class: 'row-go', 'aria-hidden': 'true' }, '›')), // the row is a button: the arrow says so (hidden while the card is open)
    bar ? listBar(bar) : null);
  // Only the row that stays open across a re-render is filled now; it is created open, so no transition plays.
  const inner = el('div', { class: 'expand-in' }, ...(isOpen ? rowDetails(m, row.wall, at) : []));
  const li = el('li', { class: `row ${m.state}${m.soon ? ' soon' : ''}${isOpen ? ' is-open' : ''}${m.photo ? ' has-photo' : ''}${m.suspended ? ' susp' : ''}${row.cold ? ' cold' : ''}${row.wet ? ' wet' : ''}${row.windy ? ' windy' : ''}${row.veil ? ' veil' : ''}${row.part ? ' part' : ''}` });
  li.append(...(m.photo ? [rowPhoto(m, li)] : []), btn, el('div', { class: 'expand', id }, inner));
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
      el('p', { class: 'note' }, canEdit ? '표시 중 오류가 발생했어요. 수정 또는 삭제해 주세요.' : '표시 중 오류가 발생했어요.'),
      rowButtons(name));
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
  li.querySelector('.row-btn').scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

// Opens a wall's card in the list (its group unfolded) and brings it to the top; false when the filters hide it.
// Used by a share link and by the map card's 자세히 보기.
function revealRow(name, { focus = false } = {}) {
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
  btn?.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
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
function setBand(summary, label, n) {
  summary.replaceChildren(el('span', {}, label), el('span', { class: 'count' }, String(n)));
}

// ---- 싱글피치 (config.singlePitch, docs/superpowers/specs/2026-10-21-crag-ui-design.md) ----
// 헤더 토글 외벽 | 싱글피치. 싱글피치 모드는 목록·카드만 다른 화면(crag-view.js)이고, 날짜·시간 조작부와 내 지역·내 로프는 그대로 쓴다.
// 날씨는 이 모드일 때만 묻는다(crag-weather.js: 일별 강수 지난 7일 + 예보, 시간별 기온·하늘, 기기에 3시간 보관).
const wallBoard = document.querySelector('#panel-list .board');
const cragWx = { daily: new Map(), hourly: new Map(), ok: false, busy: false, at: 0 };
let cragOpen = null; // the open crag row (by name); a rebuild keeps it
let cragRefocus = null; // a tap on a row redraws the board, so the focus goes back to that row
const labOn = labCrag(location.search, (() => { try { return localStorage; } catch { return null; } })() ?? { getItem: () => null }); // 이 기기에서만 켠 시범
if (new URLSearchParams(location.search).has('lab')) history.replaceState(null, '', withoutLab(location.href));
const cragOn = config.singlePitch || labOn; // 싱글피치를 쓰는가: 스위치가 켜졌거나 시범 기기
const cragMode = () => !!$('crag-board') && effectiveMode(ui.mode, { enabled: cragOn, count: state.crags.length }) === 'crag';
function syncMode() {
  const sw = $('modeSwitch');
  if (!sw) return; // (a cached older page may not have it yet: sw.js shows the stored page first)
  sw.hidden = !(cragOn && state.crags.length);
  const now = cragMode() ? 'crag' : 'wall';
  document.body.dataset.mode = now; // style.css hides the wall-only filters while this is crag
  for (const b of sw.querySelectorAll('button[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === now));
}
// the crag card's 날씨: the first line of the sun box's sky, in the wall .wx-box markup (docs/system/design-tokens.md, A안). The crag
// hourly forecast has the temperature and sky only (no wind), so: N° · sky word · HH시 예보. Only a trusted forecast day.
// The sky call is the row badge's (cragSky → skyClass: drizzle is 이슬비, not rain); rain is the wall's judgement pill (.wx-pill, wine, readable on every sky).
function cragWxBox(wx, at, now) {
  if (!wx || !Number.isFinite(wx.t) || !Number.isFinite(wx.c) || !forecastTrusted(at, now)) return [];
  const t = Math.round(wx.t) || 0; // never "-0"
  const sky = cragSky(wx.c);
  const hour = `${String(at.getHours()).padStart(2, '0')}시 예보`;
  return [el('section', { class: 'wx-box', 'aria-label': `날씨, ${hour}, 기온 ${t}도, ${sky.text}` },
    el('div', { class: 'wxb-top', 'aria-hidden': 'true' },
      el('span', { class: 'wxb-t' }, `${t}°`),
      el('span', { class: sky.rain ? 'wx-pill' : 'wxb-d' }, sky.text),
      el('span', { class: 'wxb-obs' }, hour)))];
}
// the crag sun box: the wall sunBox as it is. No hours, so no verdict (no 운영 중 words). The head's 예상 양달 is the bar's 1-minute lit pieces
// (dialModel's windows step by SUN_STEP and could be minutes off the bar); the weather is the sky's first line. No day bar inside (the wall's has none: the row head has it).
function cragSunBox(c, at) {
  const now = new Date();
  const dayLabel = ymd(at) === ymd(now) ? '오늘' : dayText(at);
  const d = { ...dialModel(c.crag, at, { isNow: vs.live, dayLabel }), windows: c.bar.filter((s) => s.lit).map((s) => [toMin(s.from), toMin(s.to)]) };
  return withWeather(sunBox(d, c.name, false, null, null, at), cragWxBox(c.wx, at, now));
}
async function loadCragWx() {
  if (cragWx.busy) return;
  if (cragWx.at && Date.now() - cragWx.at < (cragWx.ok ? 3 * 3600e3 : 5 * 60e3)) return; // a good answer is kept 3 hours, a failed one is not asked again for 5 minutes
  cragWx.busy = true;
  const r = await loadCragWeather(state.crags, { storage });
  Object.assign(cragWx, r, { busy: false, at: Date.now() });
  if (cragMode()) render(); // renderCrags decides what to leave alone (a card the focus is inside)
}
// the filter chips render() keeps in step for the wall list (the wall block is left as it is; see the plan ledger)
// the 조건 sheet in crag mode: style.css hides the rows cragList does not use (body[data-mode="crag"]); the count and the ✓ say the crag list's n
function syncCragFilterUi(n, isNow, hasGrade, cv) {
  $('sort-mygrade').hidden = !hasGrade; // only the crag list has this order
  const fv = filterView(ui.sortMode === 'mygrade' && !hasGrade ? { ...ui, sortMode: 'time' } : ui, { canPark: false, openTotal: n, isNow });
  setSheetCount(n);
  for (const [id, on] of Object.entries(fv.pressed)) $(id).setAttribute('aria-pressed', String(on));
  const rc = $('regionChip');
  rc.hidden = !ui.regions.length;
  rc.firstChild.textContent = fv.regionLabel;
  rc.setAttribute('aria-label', fv.regionChipLabel);
  for (const box of regionBoxes()) box.checked = ui.regions.includes(box.value);
  syncRegionCounts();
  $('moreFilters').classList.toggle('on', cv.sheetCount > 0);
  $('moreFilters').textContent = cv.sheetCount ? `조건 ${cv.sheetCount} ▾` : '조건 ▾';
}
// Opening a row works like the wall's toggleRow: the card opens with the .expand animation (enterName, this draw only), counts as a card-open
// (stats.js: a count, no name, as for a wall), and the opened head comes to the top under the sticky bar (its scroll-margin, as the wall row's).
// behavior: 'auto' for a share link (the page has just loaded), else smooth unless the phone asks for less motion.
let cragEnter = null;
function openCrag(name, behavior = reduceMotion() ? 'auto' : 'smooth') {
  cragRefocus = name ?? cragOpen; // opening focuses the row opened, closing the row that was open
  cragOpen = name;
  cragEnter = behavior === 'smooth' ? name : null; // a share link (or less motion) builds it open at once, as revealRow does for a wall
  render();
  cragEnter = null;
  if (!name) return;
  document.dispatchEvent(new CustomEvent('stats:card-open'));
  const head = [...document.querySelectorAll('#crag-board .crag-head')].find((h) => h.dataset.crag === name);
  head?.scrollIntoView({ block: 'start', behavior });
  // the short crag list: the page may end before the head reaches the top while the card is still growing, so once it has grown, again
  head?.closest('li')?.querySelector('.expand')?.addEventListener('animationend', () => { if (head.isConnected) head.scrollIntoView({ block: 'start', behavior }); }, { once: true });
}
// 어프로치 사진 저장 상태(crag-photos.js): 카드와 시트가 같은 값을 본다. name → { saved, total, failed? }(failed = 마지막 저장에서 못 받은 장수).
// Cache Storage가 없는 곳(http 주소 등)에서는 상태를 묻지 않고, 시트에 저장 칩을 두지 않는다. 키는 data/photos/… 상대 주소라 이 페이지 주소 기준으로 풀리고, sw.js가 받는 요청 주소와 같다.
const routeSaved = new Map();
const routeAsked = new Set();
const routeBusy = new Set();
let approach = null; // the open 어프로치 sheet: { name, sheet }
const hasCaches = () => typeof caches !== 'undefined';
let cragRoutes = new Map(); // 개념도·루트(data/crag-routes.json): name → { areas?, topos, routes }; 못 받으면 빈 채로 둔다(카드에 버튼 없음)
let routesOpen = null; // the open 개념도·루트 sheet
// 사진 저장은 어프로치 사진과 개념도 사진을 함께 담는다
const photosOf = (name) => [...(approachModel(state.crags.find((c) => c.name === name))?.photos ?? []), ...(cragRoutes.get(name)?.topos ?? []).map((t) => t.image)];
function askRouteStates(rows) {
  if (!hasCaches()) return;
  for (const r of rows) {
    if (routeAsked.has(r.name)) continue;
    routeAsked.add(r.name);
    const paths = photosOf(r.name);
    if (paths.length) routeState(paths, { caches }).then((s) => { routeSaved.set(r.name, s); if (approach?.name === r.name) approach.sheet?.setSaved(); if (s.saved && cragMode()) render(); }, () => {});
  }
}
async function saveCragRoute(name) {
  const paths = photosOf(name);
  if (!hasCaches()) return toast('이 브라우저에서는 사진을 저장할 수 없어요');
  if (!paths.length || routeBusy.has(name)) return; // a second press while saving: the first save answers
  routeBusy.add(name);
  const res = await saveRoute(paths, { caches }).catch(() => ({ saved: 0, failed: paths.length }));
  const s = await routeState(paths, { caches }).catch(() => ({ saved: res.saved, total: paths.length }));
  routeBusy.delete(name);
  const st = { ...s, failed: s.saved >= s.total ? 0 : res.failed || s.total - s.saved };
  routeSaved.set(name, st);
  if (approach?.name === name) approach.sheet.setSaved(st);
  else toast(st.failed ? `사진 ${st.failed}장 못 받았어요 · 다시 눌러 주세요` : `사진 ${st.saved}장을 이 기기에 저장했어요`);
  if (cragMode()) render();
}
async function clearCragRoute(name) {
  const paths = photosOf(name);
  if (!hasCaches()) return;
  await clearRoute(paths, { caches }).catch(() => {});
  const st = { saved: 0, total: paths.length };
  routeSaved.set(name, st);
  if (approach?.name === name) approach.sheet.setSaved(st);
  if (cragMode()) render();
}
function openApproach(name) {
  const crag = state.crags.find((c) => c.name === name);
  if (!crag || approach || !approachModel(crag)) return;
  approach = { name, sheet: null };
  try {
    approach.sheet = openApproachSheet(crag, {
      saveState: (nm) => routeSaved.get(nm) ?? (hasCaches() && photosOf(nm).length ? { saved: 0, total: photosOf(nm).length } : null),
      onSave: (nm) => saveCragRoute(nm), onClear: () => clearCragRoute(name), onClose: () => { approach = null; }, icon });
  } catch { approach = null; } // a sheet that did not open (showModal threw) must not block the next try
}
function openRoutes(name) {
  const entry = cragRoutes.get(name);
  if (!entry || routesOpen) return;
  try { routesOpen = openRoutesSheet(name, entry, { onClose: () => { routesOpen = null; }, icon, mine: loadMyGrade(storage) }); } catch { routesOpen = null; }
}
function renderCrags(at, now, isNow) {
  const host = $('crag-board');
  const ropeM = Number(ui.ropeM) || 0;
  const myGrade = loadMyGrade(storage); // 내 그레이드 루트 많은 순 needs it; without one 'mygrade' stays as 남은 시간 순
  const rows = cragList(state.crags, at, { regions: ui.regions, ropeM, approachMax: Number(ui.approachMax) || 0, origin: vs.origin, now, daily: cragWx.daily, hourly: cragWx.hourly, sun: ui.sun, query: $('findQ').value, sortMode: ui.sortMode, myGrade, routes: cragRoutes, favs, favOnly: ui.favOnly });
  const cv = cragFilterView(ui, { hasGrade: !!myGrade, query: $('findQ').value });
  $('findHits').hidden = true; // the search box only narrows the crag rows here (its hit list is for walls)
  askRouteStates(rows);
  const n = rows.length;
  const lead = summaryLead(at, now, isNow);
  const key = `crag${lead}${n}`;
  if ($('summary').dataset.key !== key) { // live region: only on change
    $('summary').dataset.key = key;
    $('summary').replaceChildren(`${lead}갈 수 있는 싱글피치가 `, el('b', { class: n ? null : 'zero' }, String(n)), '곳 있어요'); // the wall title's sentence
  }
  $('sub').textContent = `${at.getMonth() + 1}월 ${at.getDate()}일 ${DAY_KO[at.getDay()]}요일${vs.origin ? ' · 직선거리' : ''}`; // the wall's line: the order is the band's
  const msg = vs.locateNote || (labOn && !config.singlePitch ? LAB_NOTE : ''); // 시범 기기는 한 줄로 알린다
  $('locateMsg').textContent = msg;
  $('locateMsg').hidden = !msg;
  $('pick').hidden = true; // the wall picks and changes are for the wall list; render() draws them again when it comes back
  $('changesLine').hidden = true;
  syncCragFilterUi(n, isNow, !!myGrade, cv);
  const active = document.activeElement;
  const forced = cragRefocus !== null; // a tap on a row
  const been = !forced && host.contains(active) && active.dataset?.focus === 'been'; // back from the 기록 추가 sheet: redrawn (the count, the stamp) and focused again
  const inCard = !forced && !been && !!active?.closest?.('#crag-board .crag-body'); // a link, the heart or a fold inside the open card is not rebuilt under the finger
  const held = !forced && host.contains(active) ? active.closest?.('.crag-head')?.dataset.crag ?? null : null; // a row head with the focus is drawn again and gets it back
  const focusName = cragRefocus ?? held;
  cragRefocus = null;
  if (!host.children.length || !inCard) {
    // a redraw that is not a tap (the weather came, the minute ticked) may move the open card in the new order: it stays where it was on screen
    const pin = !forced && cragOpen ? host.querySelector('.crag-row.is-open .crag-head') : null;
    const top = pin?.getBoundingClientRect().top;
    renderCragBoard(host, rows, at, { now, daily: cragWx.daily, hourly: cragWx.hourly, ropeM, openName: cragOpen, enterName: cragEnter, onOpen: (nm) => openCrag(nm), sunBox: cragSunBox,
      icon, sunChip, showDistance: ui.sortMode === 'distance' && !!vs.origin, byMine: ui.sortMode === 'mygrade' && !!myGrade, isNow, favs, empty: cv, onOpenApproach: openApproach, near: (c) => cragNear(c, at),
      routes: cragRoutes, mine: myGrade, onOpenRoutes: openRoutes, been: cragBeen, onReport: config.reportEndpoint ? reportCrag : null, rowPhoto: (pm, li, onFail) => rowPhoto({ ...pm, suspended: null, today: pm.hero }, li, { canAdd: false, noun: '암장', onFail }), links: (c) => linkBar(c.links, c.address ?? c.name, { start: favBtn(c.name, '즐겨찾기'), end: shareBtn(c.name, '공유', 'crag') }, c.geo) });
    const moved = pin ? (host.querySelector('.crag-row.is-open .crag-head')?.getBoundingClientRect().top ?? top) - top : 0;
    if (moved) window.scrollBy(0, moved);
    if (focusName) [...host.querySelectorAll('.crag-head')].find((b) => b.dataset.crag === focusName)?.focus({ preventScroll: !forced });
    if (been) host.querySelector('.crag-row.is-open [data-focus="been"]')?.focus({ preventScroll: true });
  }
  loadCragWx();
  if ($('wxCredit')) $('wxCredit').hidden = !(cragWx.daily.size || cragWx.hourly.size); // main's syncWxCredit() counts only the wall forecast
}
// the crag list's empty box (the wall's .empty buttons): 전국으로 보기 clears 내 지역; 조건 지우기 clears what else narrows the crag list
// (양달/응달, the search, 즐겨찾기만, 내 로프 길이, 어프로치 도보; the wall-only filters are not shown here and stay as they are)
$('crag-board')?.addEventListener('click', (e) => {
  const b = e.target.closest('.empty .clear-filters');
  if (!b) return;
  if (b.classList.contains('to-national')) {
    setUi('regions', []);
    return $('sunOnly').focus(); // the button is gone
  }
  Object.assign(ui, { sun: 'any', favOnly: false, ropeM: '0', approachMax: '0' });
  sheetForm.elements.ropeM.value = '0';
  sheetForm.elements.approachMax.value = '0';
  $('findQ').value = '';
  saveUi();
  render();
  $('sunOnly').focus();
});
$('modeSwitch')?.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (!b) return;
  dropBackToCrag();
  setUi('mode', cleanMode(b.dataset.mode));
});

function render() {
  const now = new Date(); // one clock reading per render
  syncSeen();
  // live: the inputs follow the clock (the slider rests at its end before 06:00 / after 23:30, the time used stays real)
  const { date, min, at } = clockView(vs, now);
  if ($('date').value !== date) $('date').value = date;
  if ($('time').value !== String(min)) $('time').value = String(min);
  { const t = $('time'); t.style.setProperty('--fill', String((Number(t.value) - Number(t.min)) / (Number(t.max) - Number(t.min)))); } // the slider's passed stretch, from where its thumb really sits (the hour grid) (style.css #time)
  // An emptied date input (e.g. iOS "Clear") keeps the previous list but always offers the way back.
  $('nowBtn').hidden = vs.live && !Number.isNaN(+at);
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
  $('time').setAttribute('aria-valuetext', label);
  nowTag.textContent = t;
  nowTag.style.setProperty('--x', axisFrac(minuteOf(at)));
  // an hour tick under the time tag would show half a number ("14:00" over "15"): hide the near ones
  for (const tk of $('axis').querySelectorAll('.t')) tk.classList.toggle('under', Math.abs(tk.min - minuteOf(at)) < 110);

  const crag = cragMode(); // 싱글피치 모드: 외벽 목록 대신 싱글피치 목록
  if (wallBoard) wallBoard.hidden = crag;
  if ($('crag-board')) $('crag-board').hidden = !crag;
  syncMode();
  if (crag) return renderCrags(at, now, isNow);

  // the stored flag is ignored (not deleted) while no wall has parking data
  const canPark = state.walls.some(hasParking);
  $('parkRow').hidden = !canPark;
  const canRent = state.walls.some(hasRental);
  $('rentRow').hidden = !canRent;
  const rows = buildList(state.walls, at, { minHours: Number(ui.minHours), withBreaks: ui.withBreaks, venue: ui.venue });
  const openTotal = rows.filter((r) => r.status.state === 'open').length;
  $('sort-mygrade').hidden = true; // 내 그레이드 루트 많은 순 is a crag-list order; here a stored 'mygrade' is 남은 시간 순
  const wallUi = ui.sortMode === 'mygrade' ? { ...ui, sortMode: 'time' } : ui;
  const fv = filterView(wallUi, { canPark, canRent, openTotal, isNow });
  // 내 지역 · 구분 · 주차 narrow every group, the map and the counts alike (scopeRows)
  const scoped = scopeRows(rows, { regions: ui.regions, venue: ui.venue, parkOnly: fv.parkOnly, rentalOnly: fv.rentalOnly });
  const mine = ui.favOnly ? scoped.filter((r) => favs.includes(r.wall.name)) : scoped; // 즐겨찾기만
  const all = withDistance(filterRows(mine, ui.sun), vs.origin);
  if (pinnedName && !all.some((r) => r.wall.name === pinnedName)) { // a wall found by search / 기록 that the filters hide: shown for this visit, the filters stay as they are
    const p = rows.find((r) => r.wall.name === pinnedName);
    if (p) all.push(...withDistance([{ ...p, short: false }], vs.origin));
  }
  for (const r of all) { // the sun is where it would be, but the sky may hide it: a note, never a new verdict (filters and order ignore it)
    const h = r.wall.venue !== 'indoor' && r.lit === true ? wxEntry(r.wall, at) : null;
    r.veil = !!h && skyVeils(h.c) && forecastTrusted(at, now);
    r.part = !!h && !r.veil && skyKind(h.c).kind === 'partly' && forecastTrusted(at, now); // 구름 조금: the sun still gets through, a little weaker
  }
  allRows = rows;
  shown = { rows: all, at };
  go({ type: 'shown', rows: all }); // the open row was filtered out, or moved to another group: forget it
  const groups = groupRows(all);
  const needOrigin = ui.sortMode === 'distance' && !vs.origin;
  const open = sortRows(groups.open, needOrigin ? 'time' : wallUi.sortMode);
  // 기온 ○°↑: an outdoor wall whose forecast at the arrival hour is below it sinks (stable), dimmed; no forecast, indoor: left where it is
  const tmin = Number(ui.tempMin) || 0; // (the open card itself is never sunk)
  let coldN = 0, wetN = 0;
  for (const r of open) {
    const h = wxEntry(r.wall, at);
    const away = !!h && r.wall.venue !== 'indoor' && r.wall.name !== vs.openName;
    r.cold = away && tmin > 0 && Math.round(h.t) < tmin;
    r.wet = away && skyWet(h.c) && r.wall.venue !== 'both' && !r.wall.tags?.includes('지붕'); // a roof keeps the rain off, a wall with an indoor side has a dry way: they stay
    r.wetText = r.wet ? skyKind(h.c).text : null;
    r.windy = away && r.wall.venue !== 'both' && windy(h); // a gust to be wary of at the arrival hour (a roof does not stop it); the chip's one badge shows the most decisive: 비 > 돌풍 > 구름
    coldN += Number(r.cold); wetN += Number(r.wet);
  }
  if (coldN || wetN) open.sort((a, b) => Number(a.cold || a.wet || false) - Number(b.cold || b.wet || false));

  for (const [id, on] of Object.entries(fv.pressed)) $(id).setAttribute('aria-pressed', String(on));
  const rc = $('regionChip');
  rc.hidden = !ui.regions.length;
  rc.firstChild.textContent = fv.regionLabel;
  rc.setAttribute('aria-label', fv.regionChipLabel);
  for (const box of regionBoxes()) box.checked = ui.regions.includes(box.value);
  if ($('pickRow')) $('pickRow').hidden = !ui.regions.length || !featureOn('pick'); // the pick shows only with a 내 지역; nothing to turn off before
  if ($('pickOn')) $('pickOn').checked = !ui.hidePick; // (a cached older page may not have it yet: sw.js shows the stored page first)
  syncRegionCounts();
  const sheetOn = fv.sheetCount;
  $('moreFilters').classList.toggle('on', sheetOn > 0);
  $('moreFilters').textContent = sheetOn ? `조건 ${sheetOn} ▾` : '조건 ▾';

  const n = open.length;
  liveOpenCount = isNow ? n : null;
  // filters apply as they are ticked: the ✓ in the sheet's title row says what they left (setAttribute below)
  setSheetCount(n);
  // another day names the day (the live region is read without the date input)
  const lead = summaryLead(at, now, isNow);
  const key = `${lead}${n}`;
  if ($('summary').dataset.key !== key) { // live region: only on change
    $('summary').dataset.key = key;
    $('summary').replaceChildren(`${lead}갈 수 있는 외벽이 `, el('b', { class: n ? null : 'zero' }, String(n)), '곳 있어요');
  }
  $('sub').textContent = `${at.getMonth() + 1}월 ${at.getDate()}일 ${DAY_KO[at.getDay()]}요일`; // the date field and "지금으로" are folded away by default, so this line says the day and that it is not now

  // the order is not alphabetical: say what it is (most time left first). 가까운 순 needs a known origin
  $('label-open').textContent = `${isNow ? '지금 열려 있는 곳' : '이 시각에 열려 있는 곳'} · ${ui.sortMode === 'distance' && !needOrigin ? '가까운 순' : '남은 시간 순'}${wetN || coldN ? ` · ${[wetN && '비 오는 곳', coldN && `${tmin}° 미만`].filter(Boolean).join('·')} 아래로` : ''}`;
  $('countOpen').textContent = String(n);
  const emptyMsg = document.querySelector('#group-open .empty');
  emptyMsg.hidden = n > 0;
  // the filters hid every open wall: offer the way back right here
  // replaceChildren(null) would print "null": only real nodes go in
  emptyMsg.replaceChildren(...[fv.emptyText,
    fv.national ? el('button', { type: 'button', class: 'clear-filters to-national' }, '전국으로 보기') : null,
    fv.clear ? el('button', { type: 'button', class: 'clear-filters' }, '조건 지우기') : null].filter(Boolean));
  rowSeq = 0;
  $('rows-open').replaceChildren(...open.map((r) => safeRow(r, at)));

  $('group-closed').hidden = !groups.closed.length;
  setBand($('group-closed').querySelector('summary'), isNow ? '지금은 닫힌 곳' : '이 시각에는 닫힌 곳', groups.closed.length);
  $('rows-closed').replaceChildren(...groups.closed.map((r) => safeRow(r, at)));

  $('group-unknown').hidden = !groups.unknown.length;
  setBand($('group-unknown').querySelector('summary'), '운영시간을 아직 몰라요', groups.unknown.length);
  $('rows-unknown').replaceChildren(...groups.unknown.map((r) => safeRow(r, at)));

  if ($('group-suspended')) { // (a cached older page may not have it yet)
    $('group-suspended').hidden = !groups.suspended.length;
    setBand($('group-suspended').querySelector('summary'), '지금은 일반 이용이 어려운 곳', groups.suspended.length);
    $('rows-suspended').replaceChildren(...groups.suspended.map((r) => safeRow(r, at)));
  }

  const msg = vs.locateNote || (needOrigin ? '내 위치를 먼저 확인해 주세요.' : '');
  $('findLoc').setAttribute('aria-pressed', String(ui.sortMode === 'distance' && !!vs.origin));
  $('locateMsg').textContent = msg;
  $('locateMsg').hidden = !msg;

  const { pins, unlocated } = mapPins(all);
  $('map-empty').hidden = mapFailed || pins.length > 0;
  $('map-note').textContent = `위치 정보 없음 ${unlocated.length}곳 · ${unlocated.join(', ')}`;
  $('map-note').hidden = !unlocated.length;
  mapApi?.setRows(all, at);
  renderPick();
  renderChanges();
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
    document.querySelector('.legend').hidden = true;
    return mapError();
  }
  mapApi.setRows(shown.rows, shown.at);
  mapApi.setUser(vs.origin);
  mapApi.refresh(); // measure the now-visible container before fitting
  mapApi.fitAll();
}

const tabs = TABS; // 목록 | 지도 | 기록
const wide = matchMedia('(min-width: 1024px)'); // there the map sits beside the list (style.css): no 지도 tab
function showTab(key, focus = false) {
  if (wide.matches && key === 'map') key = 'list';
  ui.tab = key;
  saveUi();
  const split = wide.matches && key === 'list';
  for (const k of tabs) {
    const t = $(`tab-${k}`);
    t.setAttribute('aria-selected', String(k === key));
    t.tabIndex = k === key ? 0 : -1;
    $(`panel-${k}`).hidden = k !== key && !(split && k === 'map');
  }
  $('summary').hidden = key === 'log'; // the open-now headline counts the list's filters; 기록 hides them, so it would read 0
  $('find').hidden = key === 'log' || (key === 'map' && !split); // 기록 has its own wall search; the map has a floating one
  controls.hidden = key === 'log'; // 기록 has no time/slider: the form (hidden = out of focus and the reader) keeps its state
  fitSticky();
  if (key !== 'log') tick(); // back from 기록: a live clock catches up now
  if (focus) $(`tab-${key}`).focus();
  if (key === 'map' || split) openMap();
  if (key === 'log') logView.render();
  syncToTop();
}
// 맨 위로: after a screen of scrolling, not over the full-screen map (phones)
let lastY = 0, topTimer = 0;
function syncToTop() {
  const b = $('toTop');
  if (!b) return; // (a cached older index.html has no button)
  const dy = scrollY - lastY;
  lastY = scrollY;
  if (scrollY < innerHeight || (ui.tab === 'map' && !wide.matches) || dy > 2) { // near the top, on the map, or reading downwards: out of the way
    clearTimeout(topTimer);
    b.hidden = true;
  } else if (dy < -2) { // scrolling up: the way back to the filters, for 3 seconds after the last upward move
    clearTimeout(topTimer);
    b.hidden = false;
    topTimer = setTimeout(() => { b.hidden = true; }, 3000);
  } // a tiny move (the tail of a fling) leaves both the button and its timer as they are
}
addEventListener('scroll', syncToTop, { passive: true });
$('toTop')?.addEventListener('click', () => {
  scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  $(`tab-${ui.tab}`).focus({ preventScroll: true }); // the button hides itself: focus moves on
});
wide.addEventListener('change', () => showTab(ui.tab));

// A 기록 line opens that wall's card in the list. Filters that hide it are cleared for this visit (not saved), and a
// toast says so; a name no longer in the list only gets the toast.
function revealFromLog(name) {
  showTab('list');
  if (!state.walls.some((w) => w.name === name)) return toast('지금 목록에 없는 암장이에요');
  const cleared = revealClearing(name);
  document.querySelector('#panel-list .row.is-open .row-btn')?.focus({ preventScroll: true });
  if (cleared) toast('조건에 안 맞지만 이 암장만 보여 드려요');
}

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
function wireFind(input, box, onPick, off = () => false) { // off(): the box shows no hits (싱글피치: the input narrows the crag rows)
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
  if (ui.tab === 'map') return pickOnMap(w);
  if (revealClearing(w.name)) toast('조건에 안 맞지만 이 암장만 보여 드려요');
  if (wide.matches && wallPosition(w)) mapApi?.select(w.name, true);
}, cragMode);
$('findQ').addEventListener('input', () => { if (cragMode()) render(); });

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
$('mapFindBtn').addEventListener('click', () => setMapFind(true));
$('mapFindClose').addEventListener('click', () => { $('mapFindQ').value = ''; drawMapFind(); setMapFind(false); });
$('mapFindQ').addEventListener('keydown', (e) => { if (e.key === 'Escape') $('mapFindClose').click(); });

// ---- controls ----
// fixed axis: hour ticks, grid lines, the chosen-time tag
for (const h of [6, 9, 12, 15, 18, 21, 24]) {
  const tk = el('span', { class: 't' }, String(h));
  tk.min = h * 60;
  tk.style.setProperty('--x', axisFrac(h * 60));
  $('axis').append(tk);
  const g = el('span', { class: 'grid' });
  g.style.left = axisX(h * 60);
  $('plot').append(g);
}
const nowTag = el('span', { class: 'nowtag' });
$('axis').append(nowTag);
// the date field lies invisibly over the date text: on desktop a click lands on a field segment, so it opens the calendar itself
$('date').addEventListener('click', () => { try { $('date').showPicker?.(); } catch { /* already open, or not allowed: the field still works */ } });

// 완료 ✓ at the right end of the title row of the sheets people scroll in and read or set (the title row stays in view, style.css .sh-head):
// the only way out besides the backdrop, Esc and the back button; what is changed there is saved as it is changed, so there is no second button to read. The 조건 sheet also says how many walls its choices leave (updated in render).
for (const id of ['conditions', 'profile', 'safety-sheet', 'changes', 'howto', 'about-sheet', 'month-share', 'poster-share', 'rank-info', 'year-info', 'gear-sheet']) {
  const dlg = $(id), head = dlg?.querySelector('.sh-head');
  if (!head || head.querySelector('.sh-okw')) continue;
  const ok = el('button', { type: 'button', class: 'sh-ok', 'aria-label': '완료' }, icon('check'));
  ok.addEventListener('click', () => dlg.close());
  head.append(el('div', { class: 'sh-okw' }, id === 'conditions' ? el('small', { class: 'sh-count', 'aria-hidden': 'true' }) : null, ok));
}
const sheet = $('conditions');
const sheetForm = sheet.querySelector('form');
for (const k of ['minHours', 'sortMode', 'venue', 'ropeM', 'approachMax', 'tempMin']) sheetForm.elements[k].value = ui[k];

const setUi = (k, v) => {
  pinnedName = null; // a filter change ends the one-wall exception
  ui[k] = v;
  if (k === 'minHours' || k === 'sortMode' || k === 'venue' || k === 'ropeM' || k === 'approachMax' || k === 'tempMin') sheetForm.elements[k].value = v;
  if (k === 'sortMode') go({ type: 'sort' });
  saveUi();
  render();
};

$('search').addEventListener('submit', (e) => e.preventDefault());
$('search').addEventListener('input', (e) => {
  if (e.target.id !== 'date' && e.target.id !== 'time') return;
  go({ type: 'pick', date: $('date').value, min: Number($('time').value) });
});
$('nowBtn').addEventListener('click', () => go({ type: 'now' }));
for (const li of document.querySelectorAll('[data-sunkey]')) li.prepend(icon(li.dataset.sunkey)); // the key under the list
$('sunOnly').prepend(icon('sun')); // the filter wears the same picture as the rows
$('shadeOnly').prepend(icon('shade'));
$('findLoc').prepend(icon('pin')); // the search field's own 내 위치: one press = 가까운 순 (asks for the position the first time), a second = back to 남은 시간 순
$('findLoc').addEventListener('click', () => { if ($('findLoc').classList.contains('busy')) return; chooseSort(ui.sortMode === 'distance' ? 'time' : 'distance'); }); // not while the position is being asked: the late answer would undo the press
$('sunOnly').addEventListener('click', () => { setUi('sun', ui.sun === 'sun' ? 'any' : 'sun'); if (ui.sun !== 'any') document.dispatchEvent(new CustomEvent('stats:sun-filter')); }); // stats.js counts it (turning on only)
$('shadeOnly').addEventListener('click', () => { setUi('sun', ui.sun === 'shade' ? 'any' : 'shade'); if (ui.sun !== 'any') document.dispatchEvent(new CustomEvent('stats:sun-filter')); });
// 정렬 (the 조건 sheet): 가까운 순 needs a position; without one, don't keep it on (and saved) while the list stays as it was; the note stays
function chooseSort(mode) {
  setUi('sortMode', mode);
  if (mode === 'distance' && !vs.origin) locate().then((why) => {
    if (!why || ui.sortMode !== 'distance') return;
    ui.sortMode = 'time'; sheetForm.elements.sortMode.value = 'time'; saveUi(); render();
  });
}

$('regionChip').addEventListener('click', () => {
  setUi('regions', []);
  $('sunOnly').focus(); // the chip is gone
});

// 내 지역: one checkbox pill per 권역 the walls are in (areas.js, at most 5), in both the 조건 sheet and 내 정보 (the same choice);
// rebuilt only when that list changes, so a tick keeps focus. The saved choice is pruned to 권역 that exist (not while the list
// failed to load).
const regionBoxes = () => document.querySelectorAll('#regionOptsC input[name="region"], #regionOpts input[name="region"]');
let regionKey = null;
function syncRegions() {
  if (!state.walls.length) return;
  const areas = areaList(state.walls);
  ui.regions = cleanRegions(ui.regions, areas.map((a) => a.name));
  $('regionRow').hidden = !areas.length;
  if ($('regionRowC')) $('regionRowC').hidden = !areas.length; // (a cached older page may lack the 조건 row)
  const key = areas.map((a) => `${a.name}:${a.total}`).join('|');
  if (regionKey === key) return;
  regionKey = key;
  for (const id of ['regionOpts', 'regionOptsC']) {
    $(id)?.replaceChildren(el('div', { class: 'rg-list' }, ...areas.map((a) => el('label', {},
      el('input', { type: 'checkbox', name: 'region', value: a.name }), a.name, el('span', { class: 'rg-n' }, `${a.total}`)))));
  }
}
function syncRegionCounts() {
  $('regionClear').hidden = !ui.regions.length;
}

$('pickOn')?.addEventListener('change', (e) => setUi('hidePick', !e.target.checked));
$('regionClear').addEventListener('click', () => {
  setUi('regions', []);
  $('regionOpts').querySelector('input')?.focus(); // the button is gone
});
$('moreFilters').addEventListener('click', () => sheet.showModal());
document.querySelector('#group-open .empty').addEventListener('click', (e) => {
  if (e.target.closest('.to-national')) {
    setUi('regions', []);
    return $('sunOnly').focus(); // the button is gone
  }
  if (!e.target.closest('.clear-filters')) return;
  Object.assign(ui, CLEARED);
  sheetForm.elements.minHours.value = '0';
  sheetForm.elements.venue.value = 'any';
  sheetForm.elements.tempMin.value = '0';
  ui.ropeM = '0'; // the 조건 count holds it, so 조건 지우기 clears it too (it hides no wall)
  sheetForm.elements.ropeM.value = '0';
  saveUi();
  render();
  $('sunOnly').focus(); // the button is gone; land on the first filter
});

// The date + slider stick to the top while the list scrolls (the filter row above them scrolls away: a
// negative sticky top), unless even that would take over a short screen (landscape phone, large text):
// then all of it scrolls away as before. The timetable axis sticks just below.
// The 목록/지도 bar sticks right under that part (--ctl-h), and --stick-h covers both.
const controls = $('search');
const tabbar = document.querySelector('.tabbar');
const fitSticky = () => {
  if (controls.hidden) { // 기록 tab: only the tab bar sticks
    controls.classList.remove('unstuck');
    tabbar.classList.remove('unstuck');
    const root = document.documentElement.style;
    root.setProperty('--ctl-h', '0px');
    root.setProperty('--stick-h', '0px');
    return;
  }
  const box = controls.getBoundingClientRect();
  const off = Math.max(0, controls.querySelector('.scrub').getBoundingClientRect().top - box.top - 4);
  const h = box.height - off;
  const axisH = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.625; // .axis height, sticks below
  const bandH = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2; // the list's heading line sticks under the axis too
  const stick = h + axisH + bandH <= innerHeight * 0.3;
  controls.classList.toggle('unstuck', !stick);
  tabbar.classList.toggle('unstuck', !stick);
  controls.style.top = stick ? `${-off}px` : '';
  const root = document.documentElement.style;
  root.setProperty('--ctl-h', `${stick ? h : 0}px`);
  root.setProperty('--stick-h', `${stick ? h : 0}px`);
};
// the tab bar is fixed at the bottom except on wide screens: its height (home-bar inset included) pads the page end and lifts the toast and 맨 위로
const fitTabbar = () => document.documentElement.style.setProperty('--tabbar-h', `${wide.matches ? 0 : tabbar.offsetHeight}px`);
new ResizeObserver(fitTabbar).observe(tabbar);
wide.addEventListener('change', fitTabbar);
fitTabbar();
new ResizeObserver(fitSticky).observe(controls);
addEventListener('resize', fitSticky);
fitSticky();
sheet.addEventListener('change', (e) => {
  if (e.target.name === 'minHours') setUi('minHours', e.target.value);
  if (e.target.name === 'sortMode') chooseSort(e.target.value);
  if (e.target.name === 'venue') setUi('venue', cleanVenue(e.target.value));
  if (e.target.name === 'ropeM') setUi('ropeM', cleanRope(e.target.value));
  if (e.target.name === 'approachMax') setUi('approachMax', cleanApproach(e.target.value));
  if (e.target.name === 'tempMin') setUi('tempMin', cleanTemp(e.target.value));
});
// 내 지역 lives in the 내 정보 sheet (profile-view.js wires the rest of it)
for (const id of ['regionOpts', 'regionOptsC']) {
  $(id)?.addEventListener('change', (e) => {
    setUi('regions', [...e.currentTarget.querySelectorAll('input[name="region"]:checked')].map((b) => b.value));
    if (e.target.checked) document.dispatchEvent(new CustomEvent('stats:region-set')); // stats.js counts it (no region name in it)
  });
}
$('parkingOnly').addEventListener('click', () => setUi('parkingOnly', !ui.parkingOnly));
$('rentalOnly').addEventListener('click', () => setUi('rentalOnly', !ui.rentalOnly));
$('favOnly').addEventListener('click', () => setUi('favOnly', !ui.favOnly));
$('withBreaks').addEventListener('click', () => setUi('withBreaks', !ui.withBreaks));

for (const k of tabs) {
  $(`tab-${k}`).addEventListener('click', () => {
    dropBackToCrag();
    showTab(k);
    if (k !== 'list') document.dispatchEvent(new CustomEvent(`stats:tab-${k}`)); // stats.js counts map and log by name
    // the tab's content lands right under the sticky date/slider/tab bar (never up at the filter row, never behind it)
    const panel = $(`panel-${ui.tab}`); // showTab has just set --stick-h; reading the rect lays the page out first
    const top = panel.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stick-h') || '0') - 8;
    scrollTo({ top: Math.max(0, top), behavior: reduceMotion() ? 'auto' : 'smooth' });
  });
}
document.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
  const order = wide.matches ? tabs.filter((k) => k !== 'map') : tabs; // no 지도 tab to land on when wide
  const i = order.indexOf(ui.tab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: order.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  dropBackToCrag();
  showTab(order[(next + order.length) % order.length], true);
});

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
  if (b && (canEdit || b.dataset.act === 'report')) document.dispatchEvent(new CustomEvent(`wall:${b.dataset.act}`, { detail: b.dataset.kind ? { name: b.dataset.name, kind: b.dataset.kind, kinds: [b.dataset.kind] } : b.dataset.name }));
  const rb = e.target.closest('.row-btn');
  if (rb) toggleRow(rb.parentElement);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (ui.tab === 'log') return;
  if (ui.tab === 'map') { // Esc closes the map card, like its close button
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
  const ran = go({ type: 'tick', hidden: document.hidden || ui.tab === 'log', detailsOpen: !!document.querySelector('.more[open]'), focusHeld: !!a?.closest('#pin-card, .clear-filters, #pick') }).length;
  if (!ran || !li) return;
  const now = [...document.querySelectorAll('#panel-list .row')].find((r) => r.wallName === li.wallName);
  (now?.querySelectorAll(FOCUSABLE)[i] ?? now?.querySelector('.row-btn'))?.focus({ preventScroll: true });
};
setInterval(tick, 60_000);
document.addEventListener('visibilitychange', tick);

// A saved list keeps the app working as before; the shipped list is fetched only without one.
// Visitors always read the shipped list (their old saved copy is only a fallback when it can't load);
// at ?edit a saved list wins, so edits stay.
async function loadList() {
  const saved = loadWalls(storage)?.filter((w) => w.name);
  if (canEdit && saved?.length) return saved;
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

$('manage').hidden = !canEdit;
$('report-note').hidden = !config.reportEndpoint; // the footer promises 제보 only once the form is connected

$('retry').addEventListener('click', async () => {
  $('retry').disabled = true;
  const list = await loadList();
  $('retry').disabled = false;
  if (!list) return;
  state.walls = list;
  showLoadError(false);
  syncRegions();
  render();
});

// 문의 메일 (앱 정보 sheet): shown as text with a copy button, no mailto: link (an in-app browser may not open a mail app; the trust boundary keeps links to http/https)
$('mailCopy')?.addEventListener('click', async () => {
  const addr = $('footMailAddr');
  try {
    await navigator.clipboard.writeText(addr.textContent);
    toast('문의 주소를 복사했어요');
  } catch { // no clipboard (some in-app browsers): select the address so a long press copies it
    const range = document.createRange();
    range.selectNodeContents(addr);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    toast('주소를 길게 눌러 복사해 주세요');
  }
});

const [first, loadedPartners] = await Promise.all([loadList(), loadPartners()]); // loaded together: a share link opens its sheet right after, and the 근처 line is decided then (loadPartners never rejects; a failed load = no tab)
partners = loadedPartners;
state.walls = first ?? [];
if (cragOn) state.crags = await fetchCrags().catch(() => []);
if (cragOn) loadCragRoutes().then((r) => { cragRoutes = new Map(Object.entries(r)); routeAsked.clear(); if (cragRoutes.size && cragMode()) render(); }).catch(() => {}); // the save totals are asked again with the topos
showLoadError(!first);
// A share link (?wall=이름) opens that wall's card. The saved filters may hide it, so this visit drops them (in
// memory only; nothing is saved until the visitor changes a filter) and starts on the list.
const sharedWall = wallFromSearch(state.walls, location.search);
const invite = sharedWall ? parseInvite(location.search, new Date()) : null; // 같이 가요: the link also names a moment
if (sharedWall) {
  Object.assign(ui, CLEARED, { regions: [], tab: 'list', mode: 'wall' }); // a wall link opens the wall list even when the saved view is the 싱글피치 one (in memory only)
}
// A crag link (?crag=이름, the crag card's 공유) opens that crag in the 싱글피치 list the same way: this visit drops the filters
// and the search, and shows the crag mode (in memory only). With config.singlePitch off it is ignored.
const sharedCrag = !sharedWall && cragOn ? cragFromSearch(state.crags, location.search) : null;
if (sharedCrag) {
  Object.assign(ui, CLEARED, { regions: [], tab: 'list', mode: 'crag' });
  if ($('findQ')) $('findQ').value = '';
}
syncRegions();
render();
{ // the loading screen (index.html #boot) leaves once the first list is drawn
  const boot = document.getElementById('boot');
  boot?.classList.add('done');
  setTimeout(() => boot?.remove(), 400);
}
loadCrowd();
if (sharedWall) {
  if (invite && !invite.past) goToMoment(new Date(`${invite.date}T00:00`), invite.min); // that moment, on the list
  revealRow(sharedWall.name); // its group is only known after the first render
  if (invite) inviteView.banner(invite, sharedWall);
  const u = new URL(location.href);
  // ?wall=<name>&info opens the info sheet; &board opens it on the 게시판 tab (no board url and no reviews: the sheet just starts on its first tab)
  const sheetAsked = infoRequested(location.search) || boardRequested(location.search), sheetTab = boardRequested(location.search) ? 'board' : null;
  for (const k of ['wall', 'at', 'n', 'k', 'tags', 'note', 'board', 'info']) u.searchParams.delete(k);
  history.replaceState(null, '', u); // the entry under the sheet is the clean app address
  if (sheetAsked) { openWallSheet(sharedWall.name, null, { tab: sheetTab }); history.replaceState(null, '', u); } // the sheet pushes its own entry, so 뒤로 closes only the sheet and not the app (a link opening it left nothing to go back to); the address stays clean
}
if (sharedCrag) {
  openCrag(sharedCrag.name, 'auto'); // opens the row, focuses its head and brings it to the top, as revealRow does for a wall (renderCrags keeps it there when the weather re-sorts the list)
  const u = new URL(location.href);
  u.searchParams.delete('crag');
  history.replaceState(null, '', u);
}
{ // 클라이머 유형 테스트: a friend's ?type=<code> link shows that type and the way in (config.climberTest off: ignored)
  const sharedType = featureOn('climber') ? typeFromSearch(location.search) : null;
  if (sharedType) {
    climberView.banner(sharedType);
    const u = new URL(location.href);
    u.searchParams.delete('type');
    history.replaceState(null, '', u);
  }
}
// 화면 읽는 법 sheet: the header ? opens it. On a first visit the 투어 (tour.js, 6 spotlight steps) opens by itself once the list is
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
    (opener ?? $('tab-list'))?.focus();
    auto = null;
    const tour = afterNotice;
    afterNotice = null;
    tour?.();
  });
  $('helpBtn').addEventListener('click', (e) => show(e.currentTarget, null));
  $('tour-again')?.addEventListener('click', () => { howto.close(); startTour(); }); // a replay does not touch introDone
  $('inapp-open')?.addEventListener('click', () => { location.href = externalOpenUrl(entryHref); });
  const due = howtoDue({ introDone: ui.introDone, kakao: isKakaoInApp(navigator.userAgent), kakaoClosed: inAppClosed(), shareLink: !!sharedCrag || new URL(entryHref || location.href).searchParams.has('wall') });
  if (due) showHowtoAuto = () => {
    showHowtoAuto = () => {};
    if (due.kakao) { afterNotice = due.intro ? runTour : null; show(null, { kakao: true }); } else if (due.intro) runTour();
  };
}
{ // handed over from KakaoTalk (?from=kakao): offer the install once, as soon as this browser can do it
  const u = new URL(location.href);
  const handed = fromKakao(location.search);
  if (handed) { u.searchParams.delete('from'); history.replaceState(null, '', u); }
  const b = $('install-banner');
  const show = () => {
    const how = currentInstallMode();
    if (!b || installClosed() || (how !== 'prompt' && how !== 'ios')) return;
    $('install-go').hidden = how !== 'prompt';
    if (how === 'ios') $('install-text').textContent = '공유 버튼 ▸ ‘홈 화면에 추가’를 누르면 앱처럼 열려요. 닉네임을 정하기 전에 해 두면 좋아요.';
    b.hidden = false;
  };
  if (handed && b) {
    show();
    window.addEventListener('beforeinstallprompt', () => setTimeout(show)); // Chrome's event can come after load (install.js has already kept it)
    $('install-go').addEventListener('click', async () => { if (await promptInstall()) { b.hidden = true; closeInstall(); } });
    $('install-close').addEventListener('click', () => { closeInstall(); b.hidden = true; });
  }
}
showTab(ui.tab); // loadUi keeps it to TABS
