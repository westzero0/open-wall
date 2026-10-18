import { buildList } from './listing.js';
import { DAY_KO, hhmm, isNight, ymd } from './time.js';
import { fetchNational, fetchCrags, loadWalls } from './store.js';
import { state, storage, onChange, canEdit } from './state.js';
import { config } from './config.js';
import { createMap } from './map.js';
import { dialModel } from './dial.js';
import { renderDial } from './dial-view.js';
import { getStatus } from './hours.js';
import {
  axisFrac, dayBar, dayLine, dayText, filterRows, fmtMin, formatRanges, groupRows, hasParking, mapPins, NTH_KO,
  scopeRows, searchPicks, seasonSun, shortName, sortRows, summaryLead, sunVerdict, groupWeekRows, timeLabel, wallPosition, weeklyHours, winterSpan, withDistance,
} from './viewmodel.js';
import { cardModel, feeTable, feeWord, formatDistance } from './card-model.js';
import { WINDOW, evidenceOf, reasonOf, weekendPicks } from './pick.js';
import { loadFavs, saveFavs, toggleFav } from './favorites.js';
import { loadSeen, markSeen, recordFirstSeen, saveSeen, settingChanged } from './setting.js';
import { parseInvite } from './invite.js';
import { createInviteView } from './invite-view.js';
import { inkStamp } from './stamp.js';
import { CLEARED, TABS, cleanRegions, cleanTextSize, cleanTheme, cleanVenue, climberCardDue, filterView, loadUi, saveUi as storeUi, shareUrl, wallFromSearch, boardRequested, infoRequested } from './ui-state.js';
import { clockView, initialView, step } from './view-state.js';
import { areaList } from './areas.js';
import { el } from './dom.js';
import { createLogView, toast } from './log-view.js';
import { applyTextSize, applyTheme, createProfileView } from './profile-view.js';
import { createSafetyView } from './safety-view.js';
import { LEVELS, aggregate, askable, canReport, crowdPayload, crowdReady, markSent, parseCrowdCsv } from './crowd.js';
import { bumpCrowd } from './rank.js';
import { dayKey, dayWeather, forecastUrl, listForecastUrl, parseDaily, parseForecast, parseListForecast, pickHour, skyKind, weatherFresh, weekendForecastUrl } from './weather.js';
import { boardBox } from './board-view.js';
import { openWallSheet, registerWallSheet } from './wall-sheet.js';
import { sheetModel } from './wall-sheet-model.js';
import { routeView } from './routes.js';
import { loadMyGrade } from './my-grade.js';
import { openGallery } from './gallery-view.js';
import { closeInApp, closeInstall, entryHref, externalOpenUrl, fromKakao, howtoDue, inAppClosed, installClosed, isKakaoInApp } from './inapp.js';
import { currentInstallMode, promptInstall } from './install.js';

const $ = (id) => document.getElementById(id);
let loadFailed = false;
const inviteView = createInviteView({ getWalls: () => state.walls }); // the share menu, the 같이 가요 sheet and the banner

const pct = (min) => `${(min / 1440) * 100}%`;

// Inline icons on a 24px grid, drawn in the text colour; the button or link around one carries its name.
const ICONS = {
  share: ['M12 3v12', 'M8 7l4-4 4 4', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7'],
  nav: ['M3 11L22 2l-9 19-2-8-8-2z'],
  check: ['M5 12l5 5 9-10'],
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
  copy: ['M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  // 양달 / 응달: a sun with rays; the same sun struck through. Same pair as the invitation picture (src/share-image.js drawIcon).
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  // 방향 모름: a ring drawn dashed by CSS (the first path) with a question mark; 실내: a roof over walls (no sun matters indoors)
  unknown: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8', 'M12 17h.01'],
  indoor: ['M3 12l9-9 9 9', 'M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10'],
  shade: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M3 21L21 3'],
};
function icon(name, filled = false) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
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
function sunChip(sun) {
  const pic = sun && SUN_PIC[sun.tone];
  if (!pic) return null;
  return el('span', { class: `sunnow ${sun.tone} pic`, role: 'img', 'aria-label': sun.text, title: sun.text }, icon(pic));
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
  crowdAsk: (wall, date, time) => crowdAsk(wall, date, time),
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
if (config.climberTest) {
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

function segments(cls, ranges) {
  return ranges.map(([a, b]) => {
    const s = el('span', { class: cls });
    s.style.left = pct(a);
    s.style.width = pct(b - a);
    return s;
  });
}

// The same day as the list row's bar: a closed wall opening on a later day shows that day, without a now line.
function dayBarBlock(bar) {
  const now = bar.ahead ? null : el('span', { class: 'now' });
  now?.style.setProperty('left', pct(bar.nowMin));
  return el('div', { class: 'daybar-wrap' },
    el('div', { class: 'daybar', role: 'img', 'aria-label': bar.label },
      el('div', { class: 'track open-track' }, ...segments('seg', bar.open)),
      bar.sun ? el('div', { class: 'track sun-track' }, ...segments('seg', bar.sun)) : null,
      now),
    el('div', { class: 'ticks', 'aria-hidden': 'true' },
      ...[0, 6, 12, 18, 24].map((t) => el('span', {}, String(t)))),
    bar.note === null ? null : el('p', { class: 'nosun' }, bar.note));
}

// 길찾기 · 공지 · 전화 …: one hairline strip of icon + word cells (flat like the list rows, no pills); 길찾기 first
const LINK_ICON = { 길찾기: 'nav', 공지: 'megaphone', 예약: 'calendar', 오픈채팅: 'chat', 전화: 'phone' };
// 길찾기: the first tap asks which map app (the web cannot see what is installed); the pick is remembered, later taps open it directly.
const NAV_KEY = 'open-wall:nav-app';
const navPref = () => { try { return localStorage.getItem(NAV_KEY); } catch { return null; } };
function openNav(choice, copyText, nav, choices) {
  try { localStorage.setItem(NAV_KEY, choice.id); } catch { /* private mode: asks again next time */ }
  window.open(choice.href, '_blank', 'noopener,noreferrer');
  if (copyText) navigator.clipboard?.writeText(copyText).catch(() => {});
  toast(`${choice.label} 열었어요${copyText ? ' · 주소도 복사했어요' : ''}`, () => pickNav(nav, choices, copyText), '바꾸기');
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
function linkBar(links, copyText = null, edge = null) { // copyText: 길찾기 also copies it (the link may open no app); the nav address wins. edge: {start, end} cells at the two ends (♥ and share)
  if (!links.length && !edge) return null;
  const ordered = [...links.filter((l) => l.primary), ...links.filter((l) => !l.primary)];
  const nav = el('nav', { class: 'linkbar', 'aria-label': '길찾기와 연락' },
    edge?.start ?? null,
    ...ordered.map(({ label, href, sub, primary, choices, ask }) => {
      const a = el('a', { class: 'lb-item', href, target: '_blank', rel: 'noopener noreferrer', ...(sub ? { 'aria-label': `${label} · ${sub} 열기`, title: sub } : {}) },
        LINK_ICON[label] ? icon(LINK_ICON[label]) : null, label);
      if (choices) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const mine = ask ? null : choices.find((c) => c.id === navPref());
          if (mine) openNav(mine, copyText, nav, choices); else pickNav(nav, choices, copyText, ask ? label : null);
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
        m.distLine ? el('span', { class: 'dist' }, m.distLine) : null,
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
  const b = el('button', { type: 'button', class: 'photo-ask', 'aria-label': `${m.name} 외벽 사진 보내기` }, icon('camera'), '사진 보내기');
  b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: '암장 사진' } })));
  return b;
}

// An open row with a photo wears it: the photo sits behind the row's own line and bar (style.css .row.has-photo),
// today's hours ride on its foot. The photo and its credit leave the expanded part, which would repeat them.
// the forecast under the hours on the photo (an open card gets it again when the forecast arrives: refillOpen)
// An outdoor wall with a position gets a forecast: until it arrives (or when it has none for this moment) the line stays as an
// empty row, so the hours above it do not jump up when the forecast lands.
const weatherExpected = (name) => { const w = state.walls.find((x) => x.name === name); return !!w && w.venue !== 'indoor' && !!wallPosition(w); };
function photoWeather(m) {
  const w = m.weather;
  if (!w) return weatherExpected(m.name) ? el('p', { class: 'rhero-wx', 'aria-hidden': 'true' }, ' ') : null;
  return el('p', { class: 'rhero-wx', 'aria-label': `${w.line}${w.windy ? ', 바람 셈' : ''}` }, `${w.temp} · ${w.wind} · ${w.gust}`, w.windy ? el('span', { class: 'wx-pill' }, '바람 셈') : null);
}
const CARD_PHOTOS = 5; // the card swipes the main photo and the newest four; the gallery has them all (at most 10)
const CARD_DOTS = 5;
function rowPhoto(m, li) {
  const list = m.photos.slice(0, CARD_PHOTOS), many = m.photos.length > 1;
  const imgs = list.map((p, i) => el('img', { src: p.src, decoding: 'async', loading: 'lazy', alt: `${m.name} 외벽 사진${many ? ` ${i + 1}/${list.length}` : ''}` }));
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
  const wrap = el('div', { class: 'herowrap rhero' }, track, el('div', { class: 'rhero-foot' }, line, photoWeather(m)));
  // the photo sits in a hidden box until the row opens (lazy never loads it): fetch the first when the row nears the screen, so opening shows it at once
  const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { imgs[0].loading = 'eager'; near.disconnect(); } }, { rootMargin: '300px' });
  near.observe(li);
  imgs[0].addEventListener('error', () => { li.classList.remove('has-photo'); wrap.remove(); }, { once: true });
  imgs.slice(1).forEach((img, k) => img.addEventListener('error', () => img.closest('.rhero-slide')?.remove(), { once: true }));
  const add = config.boardUrl ? el('button', { type: 'button', class: 'rhero-add', 'aria-label': `${m.name} 사진 더 보내기`, title: '사진 더 보내기' }, icon('camera-plus')) : null;
  add?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: '암장 사진' } })));
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
      trk.append(...open.map(([a, b]) => span('g-bar', a, b)), ...clipDay(r.breaks).map(([a, b]) => span('g-brk', a, b)));
      const t = el('span', { class: 'g-txt' }, r.range);
      t.style.right = `${(1 - axisFrac(open[open.length - 1][1])) * 100}%`;
      trk.append(t);
    }
    // today closed by a closed_date / nth closure: the weekday's usual bar fades under the day's own word
    const shut = r.today && day?.closed && open.length;
    if (shut) trk.append(el('span', { class: 'g-closed' }, day.text));
    if (r.today && bar?.sun) trk.append(...clipDay(sunOn).map(([a, b]) => span('g-sunon', a, b))); // the same as the list: the open bar turns orange where it is sunny
    const said = `${r.days}${r.today ? (r.members > 1 ? '(오늘 포함)' : '(오늘)') : ''} ${r.text}${r.breaks.length ? `, 휴게 ${formatRanges(r.breaks)}` : ''}${shut ? `, 오늘은 ${day.text}` : ''}`;
    body.append(el('div', { class: `g-row${r.today ? ' g-today' : ''}${shut ? ' shut' : ''}`, role: 'listitem', 'aria-label': said },
      el('span', { class: 'g-lab', 'aria-hidden': 'true' }, r.days.replace(/·/g, '·​'), r.today ? el('small', {}, r.members > 1 ? '오늘 포함' : '오늘') : null), // a zero-width space after · lets 월·화·목·토 wrap in the narrow label column
      el('span', { class: 'g-wrap', 'aria-hidden': 'true' }, trk)));
  }

  const breaks = [...new Set(wk.rows.flatMap((r) => r.breaks.map((b) => formatRanges([b]))))];
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
    more.closest('.ssun').querySelectorAll('.s-row:not(.cur)').forEach((r) => { r.hidden = !on; });
  });
  return el('section', { class: 'ssun', 'aria-label': `계절마다 양달인 시간, ${DAY_KO[at.getDay()]}요일 운영시간 기준` },
    gridAxis(null),
    ...rows.map((s) => {
      const trk = el('span', { class: 'g-trk', 'aria-hidden': 'true' },
        ...clipDay(s.open).map(([a, b]) => span('g-bar', a, b)), // the same open bar as the hours grid, orange where sunny
        ...clipDay(s.on).map(([a, b]) => span('g-sunon', a, b)));
      const sunText = s.windows.length ? formatRanges(s.windows) : '하루 종일 응달';
      const hint = s.closed ? ' · 휴무' : s.unknown ? ' · 시간 미입력' : '';
      // the same two columns as the hours grid (name on the left, bar on the right), so both axes are as wide
      return el('div', { class: `s-row${s.current ? ' cur' : ''}`, hidden: fold && !s.current ? '' : null },
        el('span', { class: 'g-lab' }, el('b', {}, s.name), s.current ? el('small', {}, '지금') : null),
        el('div', { class: 's-main' }, el('p', { class: 's-head' }, `${s.date} · 예상 ${sunText}${hint}`), trk));
    }),
    fold ? more : null,
    sunWhy()); // the long caveat is folded under 계산 기준
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

// 요금 tab: a table of 구분 / 대상 / 평일 / 휴일. Same price on both days: one cell over two columns; an item with only
// a note: its name and the note over the other three. The discount is one line under the table.
function feesBlock(wall) {
  const t = feeTable(wall);
  if (!t) return null;
  const cell = (tag, text, attrs = {}) => el(tag, attrs, text);
  const body = el('tbody', {});
  for (const it of t.items) {
    if (it.noteOnly) {
      body.append(el('tr', {}, cell('th', it.item, { scope: 'row' }), cell('td', it.note, { colspan: t.split ? '3' : '2', class: 'f-note' })));
      continue;
    }
    it.rows.forEach((r, i) => {
      const tr = el('tr', {});
      if (i === 0) tr.append(cell('th', it.item, { scope: 'rowgroup', rowspan: String(it.rows.length + (it.note ? 1 : 0)) }));
      tr.append(cell('td', r.who, { class: 'f-who' }));
      // session times ("1부 13~17시 · 2부 18~22시") stack one session per line
      const val = (text, attrs) => (r.times ? el('td', { ...attrs, class: `${attrs.class} f-times` }, ...text.split(' · ').map((p) => el('span', {}, p))) : cell('td', text, attrs));
      if (r.all !== undefined) tr.append(val(r.all, t.split ? { colspan: '2', class: 'f-all' } : { class: 'f-won' }));
      else tr.append(val(r.weekday, { class: 'f-won' }), val(r.weekend, { class: 'f-won' }));
      body.append(tr);
    });
    if (it.note) body.append(el('tr', {}, cell('td', it.note, { colspan: t.split ? '3' : '2', class: 'f-note' })));
  }
  return el('section', { class: 'fees', 'aria-label': '요금' },
    el('table', {},
      el('thead', {}, el('tr', {}, cell('th', '구분'), cell('th', '대상'), ...(t.split ? [cell('th', '평일'), cell('th', '휴일')] : [cell('th', '요금')]))),
      body),
    t.discount ? el('p', { class: 'f-disc' }, t.discount) : null);
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
  btn.replaceChildren(icon('heart', on), ...(btn.dataset.label ? [btn.dataset.label] : []));
}
// Every heart and name mark of a wall is repainted in place, so the tapped button keeps focus.
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
    if (ui.favOnly) render(); // the list itself follows the hearts
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
const SKY_ICON = { clear: 'sun', partly: 'sky-partly', cloud: 'sky-cloud', fog: 'sky-fog', rain: 'sky-rain', snow: 'sky-snow', storm: 'sky-storm' };
const listSpots = () => state.walls.filter((w) => w.venue !== 'indoor').map((w) => [w, wallPosition(w)]).filter(([, p]) => p);
// names and coordinates (2 decimals, what is sent): a wall added, removed or moved while the page is open asks again
const listKey = (spots) => spots.map(([w, p]) => `${w.name}@${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join('|');
function useWxList(spots, json, at) {
  const days = parseListForecast(json, spots.length);
  wxList.entry = { hours: days, at, key: listKey(spots) }; // the shape weatherFresh reads, plus the list it answers
  wxList.byName = new Map(days ? spots.map(([w], i) => [w.name, days[i]]) : []);
  return !!days;
}
async function loadListWeather() {
  if (wxList.busy) return;
  const spots = listSpots();
  if (!spots.length) return;
  const key = listKey(spots);
  if (weatherFresh(wxList.entry, Date.now()) && wxList.entry.key === key) return;
  if (!wxList.entry) { // the first ask of this visit: the copy kept in this browser may still be good
    try {
      const saved = JSON.parse(storage.getItem(WXL_KEY));
      if (saved?.key === key && Date.now() - saved.at >= 0 && Date.now() - saved.at < 3 * 3600e3 && useWxList(spots, saved.json, saved.at)) { paintListWx(); return; }
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
}
const wxEntry = (wall, at) => { const h = wxList.byName.get(wall.name); return h ? pickHour(h, at) : null; };
function wxChip(h, name) {
  const sky = skyKind(h.c);
  const t = Math.round(h.t) || 0; // never "-0"
  return el('span', { class: 'rwx', 'data-wx': name, role: 'img', 'aria-label': `기온 ${t}도, ${sky.text}` }, icon(SKY_ICON[sky.kind]), `${t}°`);
}
// an outdoor wall with a position gets a slot: filled when the forecast covers the picked hour, empty (same width, so nothing
// shifts when it lands) until the answer comes; once answered, no slot where there is nothing to show
function wxSlot(wall, at) {
  if (wall.venue === 'indoor' || !wallPosition(wall)) return null;
  const h = wxEntry(wall, at);
  if (h) return wxChip(h, wall.name);
  return wxList.entry ? null : el('span', { class: 'rwx pending', 'data-wx': wall.name, 'aria-hidden': 'true' });
}
function paintListWx() {
  const at = shown.at;
  for (const slot of document.querySelectorAll('#panel-list .rwx[data-wx]')) {
    const wall = at && state.walls.find((w) => w.name === slot.dataset.wx);
    const h = wall ? wxEntry(wall, at) : null;
    if (h) slot.replaceWith(wxChip(h, wall.name)); else slot.remove();
  }
  syncWxCredit();
}
// Open-Meteo asks for credit (CC BY 4.0): a line under the list whenever a row shows its weather
const syncWxCredit = () => { if ($('wxCredit')) $('wxCredit').hidden = !document.querySelector('#panel-list .rwx:not(.pending)'); };
const pickWeather = (wall, date) => dayWeather(wxPick.byName.get(wall.name)?.get(dayKey(date)));
const rainsOn = (it) => !!it.wx?.rain && it.wall.venue !== 'indoor';
function renderPick() {
  const box = $('pick');
  const wanted = state.walls.length && (ui.regions.length || favs.length) && !ui.hidePick; // a 내 지역, or 내 암장 to lead with
  if (wanted) loadWeekendWeather();
  const r = wanted ? weekendPicks(state.walls, new Date(), { pref: pickPref, regions: ui.regions, venue: ui.venue, weather: pickWeather, favs }) : null;
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
function shareBtn(name, label = null) { // label: a word under the icon (the link strip's cell)
  const face = () => [icon('share'), ...(label ? [label] : [])];
  const btn = el('button', { type: 'button', class: label ? 'lb-item' : 'icon-btn', 'aria-label': '공유하기', title: '공유하기' }, ...face());
  const say = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  let timer;
  btn.addEventListener('click', async () => {
    const url = shareUrl(location.href, name);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt('링크를 복사하세요', url); // no clipboard (http, denied)
      return;
    }
    btn.classList.add('done');
    btn.replaceChildren(icon('check'), ...(label ? ['복사됨'] : []));
    say.textContent = '링크를 복사했어요';
    clearTimeout(timer);
    timer = setTimeout(() => { btn.classList.remove('done'); btn.replaceChildren(...face()); say.textContent = ''; }, 1800);
    toast('링크를 복사했어요', () => inviteView.openInvite(name), '같이 가요 초대 만들기');
  });
  return el('span', { class: 'share-wrap' }, btn, say);
}

// First view under the chips: 안내 (status notes, then the memo lines that can stop a visit), parking (one line).
// Weekly closures are a 안내 line and the hatched grid rows.
const memoItem = (l) => el('li', { class: l.key ? 'key' : null },
  l.label ? el('span', { class: 'mk' }, l.label) : null,
  el('span', { class: l.label ? 'mv' : 'mv free' }, l.value));

function infoBlock(m) {
  const parts = [];
  // only what can stop a visit (closures, warnings, "!" lines); the other memo lines are the wall sheet's 시설 section
  if (m.info.shown.length) parts.push(el('ul', { class: 'memo-list info', 'aria-label': '안내' }, ...m.info.shown.map(memoItem)));
  // one line: the status, then the wall's own lot (요금 · 주변 · 참고 are in the wall sheet's 주차 section)
  const { onsite } = m.parkingWhere;
  parts.push(el('div', { class: 'irow' }, el('span', { class: 'mk' }, '주차'),
    el('p', { class: 'pv' }, el('b', { class: `pk-word ${m.parking.tone}` }, m.parking.word), onsite.length ? ` · ${onsite.join(' · ')}` : '')));
  return parts;
}

// The open row is rebuilt on every slider move, so a 양달↔응달 flip is marked on the new SVG
// (.from-lit/.from-dark) and CSS @starting-style fades the wall, beam and label from the old look.
let lastDial = null; // { name, lit } of the compass drawn last
function dialFig(name, d) {
  const svg = renderDial(d);
  if (!svg) return null;
  if (lastDial?.name === name && lastDial.lit !== d.lit) svg.classList.add(lastDial.lit ? 'from-lit' : 'from-dark');
  lastDial = { name, lit: d.lit };
  return svg;
}

// The sun's now: compass + sentence + today's sunny hours. On a day the wall is closed the compass
// would describe a visit that can't happen, so a short note stands in for it (sunny hours stay for reference).
// The one-line limit under every estimated sun time (the same words in the sun box and the 계절별 양달 tab)
const sunLimit = () => el('p', { class: 'sun-limit' }, '벽 방향과 지형으로 계산한 예상이에요. 건물·나무, 날씨·구름, 오버행·벽 경사는 반영하지 않아요.');
const noSunMath = (d) => d.state === 'unknown' || d.state === 'override';
// 접힌 계산 기준 (양달 카드 안: 한 줄 접힘, 기본 닫힘)
const sunWhy = () => el('details', { class: 'sun-why' }, el('summary', {}, '계산 기준'), sunLimit());
// 맨 위 한 줄: 상태 칩 + 핵심 값 (구간이 여러 개면 구간마다 한 덩어리)
function sunHead(d) {
  const chip = d.state === 'unknown' ? '계산 불가' : `${vs.live ? '지금' : '그 시각'} ${d.lit ? '양달' : '응달'}`; // the chip is the moment's state; the line under it is the day's window
  const cls = d.state === 'unknown' ? 'na' : d.lit ? 'lit' : 'dark';
  const key = d.state === 'unknown' ? null : d.windows.length
    ? el('p', { class: 'dwhen' }, el('span', { class: 'dw-k' }, `${d.dayLabel} 예상 양달`), ...d.windows.map((w) => el('b', { class: 'dw-r' }, formatRanges([w]))))
    : el('p', { class: 'dwhen' }, el('b', {}, `${d.dayLabel === '오늘' ? '오늘은' : d.dayLabel} 하루 종일 응달로 예상돼요`));
  return el('div', { class: 'sb-head' }, el('span', { class: `sb-chip ${cls}` }, chip), d.state === 'override' ? null : key);
}
function sunBox(d, name, closedDay, verdict) {
  // the dial says why ("해가 벽 뒤에 있어요" under it, 해·벽 색), so a facing/sun reason keeps only the first sentence (where the sun is); a terrain/night reason is not in the picture and stays
  const words = d.sentence.length > 3 && /^ 해가 (벽|등) 뒤쪽/.test(d.sentence[3].text) ? d.sentence.slice(0, 3) : d.sentence;
  const sentence = el('p', { class: 'dsent' }, ...words.map((p) => (p.bold ? el('b', {}, p.text) : p.text)));
  if (closedDay) {
    return el('section', { class: 'sunbox solo', 'aria-label': '해' }, el('div', { class: 'sb-txt' },
      el('p', { class: 'dsent off' }, '이 날은 운영하지 않아서 해 나침반은 접어 두었어요.'),
      noSunMath(d) ? null : el('p', { class: 'dwhen ref' }, d.windows.length ? `참고 · 예상 양달 시간 ${formatRanges(d.windows)}` : '참고 · 예상으로는 하루 종일 응달'), sunWhy()));
  }
  if (noSunMath(d)) {
    return el('section', { class: 'sunbox solo', 'aria-label': '해' }, el('div', { class: 'sb-txt' }, sunHead(d), sentence, d.state === 'override' ? sunWhy() : null));
  }
  return el('section', { class: 'sunbox', 'aria-label': '해' },
    sunHead(d),
    verdict ? el('p', { class: `sun-verdict ${verdict.kind}` }, verdict.text) : null, // the answer to "is it sunny while it's open"
    sentence,
    el('div', { class: 'sb-fig' }, el('div', { class: 'sundial-slot' }, dialFig(name, d))),
    sunWhy());
}


const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Expanded row (v6): what decides the visit first; the rest is in the wall sheet (자세히 ›).
function rowDetails(m, wall, at) {
  const dial = dialModel(wall, at, { isNow: vs.live, dayLabel: m.dayLabel });
  // the way into the wall sheet (hours table, seasonal sun, fees, parking details): one button at the end of the facts
  const sheetBtn = el('button', { type: 'button', class: 'sheet-open', 'data-sheet-open': '', 'data-name': m.name }, '자세히 ›');
  sheetBtn.addEventListener('click', () => openWallSheet(m.name, sheetBtn));
  // 제보 stays at the foot as quiet text links: a correction is rare, and the card's job is the hours above
  const photoAsk = photoLink(m); // (this one is on the name row: a photo is what the card lacks most)
  const helps = config.reportEndpoint
    ? el('div', { class: 'help-row' },
      el('button', { type: 'button', class: 'help-link', 'data-act': 'report', 'data-name': m.name }, '정보 수정 요청'),
      m.hasChat ? null : el('button', { type: 'button', class: 'help-link', 'data-act': 'report', 'data-name': m.name, 'data-kind': '오픈채팅방' }, '오픈채팅 추가'))
    : null;
  // "지금 어때요?" and 다녀왔어요 share a row: the visit and the crowd are both what you do on arriving (wraps when narrow)
  const act = el('div', { class: 'act-row' }, beenBtn(m), m.crowd ? crowdQuick(m.name) : null, null); // the one filled pill; the crowd question is a text link
  const links = linkBar(m.links, m.navAddress ?? m.address, { start: favBtn(m.name, '즐겨찾기'), end: shareBtn(m.name, '공유') }); // 즐겨찾기 · 길찾기 · 공지사항 · 오픈채팅 · 전화 · 네이버지도
  return [
    m.photo ? links : null, // a photo card: the strip hangs under the photo across both columns of the wide layout
    el('div', { class: 'm-cols' },
      // what decides the visit: name, today's hours and the sun now (open: the row already says how long is left)
      el('div', { class: 'm-head' },
        m.photo ? el('h3', { class: 'x-name' }, m.name) // the name is on the photo's row
          : el('div', { class: 'x-top' }, el('h3', { class: 'x-name' }, m.name, feeChip(m)), photoAsk), // ♥ and share are the end cells of the link strip
        (m.state === 'open' || m.suspended ? m.place : !m.photo && m.sub) ? el('p', { class: 'x-sub' }, m.state === 'open' || m.suspended ? m.place : m.sub) : null, // a suspended wall says 임시 휴관 중 once, in the pill (or the photo's chip) // a closed photo card: the pill on the photo already says when it opens
        m.photo ? null : el('div', { class: 'today-row' }, // with a photo the hours are on its foot
          el('p', { class: 'today' }, m.suspended ? null : el('span', {}, m.today.lead), todayText(m))),
        m.suspended ? el('p', { class: 'susp-note' }, [m.suspended.since, m.suspended.note].filter(Boolean).join(' · ') || '이용 전 확인해 주세요') : null,
        m.breaks.length ? el('div', { class: 'tags brk-row' }, ...m.breaks.map((t) => el('span', { class: 'tag brk' }, t))) : null, // the 휴게 pill under the hours it cuts out of
        ...(m.photo ? [] : weatherBox(m)), // the forecast right under the hours (a photo card wears it on the photo)
        addrLine(m)), // the address right under 오늘 운영
      el('div', { class: 'm-info' },
        // a photo card: the link strip hangs right under the photo (before the visit: 길찾기, 전화), the 다녀왔어요 line comes after
        ...(m.photo ? [] : [links]), ...crowdBox(m), act, // before the visit (길찾기 · 전화), then 다녀왔어요
        m.holiday ? el('p', { class: 'hol-note' }, m.holiday) : null,
        m.staleNote ? el('p', { class: 'stale-note' }, m.staleNote) : null,
        [...m.tags, ...m.sizes, ...(m.indoorKinds ? [`실내 ${m.indoorKinds}`] : []), ...(m.indoorHeight ? [m.indoorHeight] : [])].length ? el('p', { class: 'tags-line' }, [...m.tags, ...m.sizes, ...(m.indoorKinds ? [`실내 ${m.indoorKinds}`] : []), ...(m.indoorHeight ? [m.indoorHeight] : [])].join(' · ')) : null, // facts, not controls: one muted line
        ...infoBlock(m),
        m.settingBadge ? el('p', { class: 'setnew' }, el('span', { 'aria-hidden': 'true' }, '✦ '), m.settingBadge) : null,
        m.setting ? el('p', { class: 'checked setting' }, m.setting) : null),
      sunBox(dial, m.name, m.closedDay, m.closedDay ? null : sunVerdict(wall, at)), // above 정보 확인일, after the facts (the right column when wide)
      el('div', { class: 'm-foot' }, el('p', { class: 'checked' }, m.checked)),
      sheetBtn),
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
  ask?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: s.kind } })));
  // the title row carries 수정 요청 (a filled section), the facts follow, and the check date is a quiet line at the card's bottom right
  return el('section', { class: `ws-sec${s.empty ? ' empty' : ''}`, 'aria-label': s.title },
    el('div', { class: 'ws-sec-h' }, el('h3', {}, s.title), s.empty ? null : ask),
    s.empty ? el('div', { class: 'ws-empty' }, el('p', {}, '아직 정보가 없어요'), ask) : content,
    s.empty || s.dated === false ? null : el('p', { class: 'ws-chk end' }, m.checked));
}
// 루트 tab: the newest route count as bars (a chip per wall section when the count is by section), dimmed and headed 세팅 이후 분포 미확인
// once the wall was set after it; nothing recorded: a dotted box asking for a report.
function routePane(m, wall) {
  const mine = loadMyGrade(storage); // 내 그레이드 (내 정보): its rows are drawn stronger and counted
  const v = routeView(wall, new Date(), mine);
  const ask = config.reportEndpoint ? el('button', { type: 'button', class: v ? 'help-link ws-fix' : 'ws-ask' }, v ? '수정 요청' : '알려 주기') : null;
  ask?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: m.name, kind: '루트 분포' } })));
  const head = el('div', { class: 'ws-sec-h' }, el('h3', {}, '루트'), v ? ask : null);
  if (!v) return el('section', { class: 'ws-sec empty', 'aria-label': '루트' }, head, el('div', { class: 'ws-empty' }, el('p', {}, '아직 정보가 없어요'), ask));
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
  show('all');
  return el('section', { class: 'ws-sec', 'aria-label': '루트' }, head, el('p', { class: 'ws-chk' }, v.head), chips, bars, total,
    v.mine ? null : el('p', { class: 'sh-hint' }, '내 정보에서 내 그레이드를 정하면 그 구간이 진하게 보여요.'));
}
function sheetParking(m) {
  const { onsite } = m.parkingWhere;
  return el('p', { class: 'pv' }, el('b', { class: `pk-word ${m.parking.tone}` }, m.parking.word), onsite.length ? ` · ${onsite.join(' · ')}` : '',
    ...m.parkingMore.map(({ k, v }) => el('span', { class: 'pnear' }, el('span', { class: 'pn-k' }, k), v)));
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
  const content = { ...blocks, parking: sheetParking(m), facility: el('ul', { class: 'memo-list info' }, ...m.info.folded.map(memoItem)) };
  return {
    onClose: () => { const cur = weeklyHours(wall, at).season; go({ type: 'season', name: wall.name, pick: cur, current: cur }); }, // picking the day's own season ends a 하계/동계 preview: it does not outlive the sheet
    tabs: sheet.tabs.map((t) => ({
      ...t,
      icon: icon({ time: 'clock', use: 'ticket', routes: 'route', board: 'chat' }[t.key] ?? 'info'),
      pane: t.key === 'routes' ? routePane(m, wall) : t.key === 'board' ? () => boardPane(m) : el('div', { class: 'ws-use' }, t.key === 'time' ? timeLegend(blocks) : null, ...sheet[t.key].map((s) => sheetSection(m, s, content[s.key]))), // 시간 or 이용
    })),
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
// 다녀왔어요 (the open card only): the right end of the 오늘 운영 line; opens the 기록 추가 sheet with this wall fixed.
// Just after a save the check gives way to the 해벽 stamp, pressed once (same .stamp-in as the 기록 calendar).
function beenBtn(m) {
  const mark = logView.justStamped(m.name) ? inkStamp(el('span', { class: 'stamp been-stamp stamp-in', 'aria-hidden': 'true' }), state.walls.find((w) => w.name === m.name)) : icon('check');
  const been = el('button', { type: 'button', class: 'btn been-btn', 'data-focus': 'been', 'aria-label': m.beenAria ?? null }, mark, m.beenLabel);
  been.addEventListener('click', () => logView.openAdd({ wall: m.name, from: been }));
  return been;
}
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
  if (weatherFresh(wx.byWall.get(wall.name), Date.now())) return;
  wx.busy.add(wall.name);
  let hours = null;
  try {
    const res = await fetch(forecastUrl(pos.lat, pos.lng), { credentials: 'omit', signal: AbortSignal.timeout?.(8000) });
    if (res.ok) hours = parseForecast(await res.json());
  } catch { /* quiet: no forecast line */ }
  wx.byWall.set(wall.name, { hours, at: Date.now() });
  wx.busy.delete(wall.name);
  if (hours) refillOpen(wall.name);
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
  if (m.photo) { // a photo card wears the forecast on the photo
    li.querySelector('.rhero-wx')?.remove();
    const p = photoWeather(m);
    if (p) li.querySelector('.rhero-foot')?.append(p);
    return;
  }
  li.querySelector('.wx-line')?.remove();
  const anchor = [...li.querySelectorAll('.m-head .brk-row, .m-head .today-row')].pop(); // the forecast goes right under the hours
  const box = weatherBox(m);
  if (anchor) anchor.after(...box);
}
// the open card's forecast: render (a shared link opens a row, the minute tick) and toggleRow (a tap opens one without a render)
const weatherFor = (name) => { const r = shown.rows.find((x) => x.wall.name === name); if (r) loadWeather(r.wall); };
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
// the line (+ 바람 셈 pill) under 혼잡도; no forecast for the picked moment → nothing, not even a gap
function weatherBox(m) {
  if (!m.weather) return [];
  const w = m.weather;
  return [el('p', { class: 'wx-line', 'aria-label': `${w.line}${w.windy ? ', 바람 셈' : ''}` },
    el('span', { class: 'wx-k', 'aria-hidden': 'true' }, '예보'),
    el('span', { class: 'wx-chip wx-t', 'aria-hidden': 'true' }, w.temp),
    el('span', { class: 'wx-chip', 'aria-hidden': 'true' }, w.wind),
    el('span', { class: `wx-chip${w.windy ? ' strong' : ''}`, 'aria-hidden': 'true' }, w.gust),
    w.windy ? el('span', { class: 'wx-pill', 'aria-hidden': 'true' }, '바람 셈') : null)];
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
  if (!c || c.chip.muted) return []; // "제보 모으는 중" is only an empty state: the 지금 어때요? button next to it asks the same
  return [el('p', { class: `crowd-chip${c.chip.muted ? ' muted' : ''}`, 'data-level': c.chip.level ?? 'none' },
    c.chip.bars ? el('span', { class: 'crowd-meter', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')) : null,
    c.chip.text)];
}
// "지금 어때요?": one tap on the open card reports the crowd of right now (same limits and data as the 기록 추가 sheet's
// question). Only while the picked moment is now and the wall is open (crowdBox is for open walls); gone for good once the
// limits say so (a re-render finds crowdAsk ≠ 'ask').
function crowdQuick(name) {
  const now = new Date();
  const [date, time] = [ymd(now), hhmm(now)];
  if (!vs.live || crowdAsk(name, date, time) !== 'ask') return null;
  // folded to one small button ("지금 어때요?" + the meter); a tap opens 여유 · 보통 · 혼잡 in its place
  const box = el('div', { class: 'crowd-quick', role: 'group', 'aria-label': '지금 혼잡도 제보' });
  const open = el('button', { type: 'button', class: 'cq-open', 'aria-expanded': 'false' },
    el('span', { class: 'crowd-meter', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), '지금 어때요?');
  box.append(open);
  const pills = LEVELS.map((level) => el('button', { type: 'button', class: 'crowd-pill', value: level }, level));
  for (const b of pills) {
    b.addEventListener('click', async () => {
      pills.forEach((x) => { x.disabled = true; });
      if (await sendCrowd(name, b.value, date, time)) box.replaceChildren(el('span', { class: 'cq-done', role: 'status' }, '제보 고마워요'));
      else { pills.forEach((x) => { x.disabled = false; }); toast('혼잡도를 보내지 못했어요 — 연결을 확인해 주세요.'); }
    });
  }
  open.addEventListener('click', () => {
    box.replaceChildren(el('span', { class: 'cq-q' }, '지금'), el('span', { class: 'crowd-pills' }, ...pills));
    pills[0].focus();
  });
  return box;
}
const modelOf = (row, at) => cardModel(row, at, {
  visits: logView.recordsFor(row.wall.name), crowd: crowdCtx(row.wall.name, at), settingNew: settingChanged(row.wall, favs, seen),
  weather: weatherCtx(row.wall.name, at),
});

let rowSeq = 0;
function timeRow(row, at) {
  const m = modelOf(row, at);
  const { bar } = m; // "내일 10:00 오픈" draws tomorrow's hours, without a now tick; no bar without hours
  const id = `row-x-${++rowSeq}`;
  const isOpen = vs.openName === m.name;
  const tick = !bar || bar.ahead ? null : el('span', { class: 'tick' });
  tick?.style.setProperty('left', axisX(bar.nowMin));
  // 양달/응달/방향 모름 in words, not only the orange band
  const { sun } = m;
  const btn = el('button', { type: 'button', class: 'row-btn', 'aria-expanded': String(isOpen), 'aria-controls': id },
    el('span', { class: 'l1' },
      sunChip(sun), // first: the same column on every open row
      el('span', { class: 'rfav', 'data-favmark': m.name, role: 'img', 'aria-label': '즐겨찾기', hidden: favs.includes(m.name) ? null : '' }, '♥'),
      el('span', { class: 'rname', title: m.shortName }, m.shortName),
      // the extras share what room is left, in this order of worth; one that does not fit wraps out of sight whole (style.css .rsub),
      // so the closing time never wraps and no region is cut to a stray letter (it is on the card)
      el('span', { class: 'rsub' },
        m.settingBadge ? el('span', { class: 'setnew', 'data-setmark': m.name }, el('span', { 'aria-hidden': 'true' }, '✦ '), m.settingBadge) : null,
        m.crowdTag ? el('span', { class: 'crowdnow', 'data-level': m.crowdTag.level, role: 'img', 'aria-label': m.crowdTag.aria },
          el('span', { class: 'crowd-meter', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), m.crowdTag.text) : null,
        m.visits ? el('span', { class: 'been' }, m.visits.label) : null,
        m.meta ? el('span', { class: 'rmeta', title: m.meta }, m.meta) : null,
        feeChip(m)), // the least decisive: it is the first to give way
      wxSlot(row.wall, at), // a fixed place left of the time: the temperature at the picked arrival hour (outdoor walls)
      el('span', { class: 'left' }, m.left)),
    bar ? el('span', { class: 'bar', role: 'img', 'aria-label': bar.label },
      // past and to-come are one tone: the tick says "now"; the two halves of a split interval meet square
      ...bar.segments.map(([a, b, past], i, all) => span(`${past ? 'seg past' : 'seg'}${all[i + 1]?.[0] === b ? ' j-end' : ''}${all[i - 1]?.[1] === a ? ' j-start' : ''}`, a, b)),
      // the part before the tick is already gone: its orange is paler, like the green under it
      ...bar.sunBands.flatMap(([a, b]) => (bar.nowMin == null || bar.nowMin <= a ? [[a, b, false]] : bar.nowMin >= b ? [[a, b, true]] : [[a, bar.nowMin, true], [bar.nowMin, b, false]]))
        .map(([a, b, past]) => span(past ? 'sunband past' : 'sunband', a, b)),
      tick) : null);
  // Only the row that stays open across a re-render is filled now; it is created open, so no transition plays.
  const inner = el('div', { class: 'expand-in' }, ...(isOpen ? rowDetails(m, row.wall, at) : []));
  const li = el('li', { class: `row ${m.state}${m.soon ? ' soon' : ''}${isOpen ? ' is-open' : ''}${m.photo ? ' has-photo' : ''}${m.suspended ? ' susp' : ''}` });
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
  // Another open card above shrinks while this one opens. Its collapse animates, so the smooth scroll below would aim at a row that is
  // still moving and end up far past it (the bottom of the new card). The other card snaps shut instead: the row stays where it is.
  const others = [...document.querySelectorAll('#panel-list .row.is-open')].filter((o) => o !== li);
  for (const o of others) o.classList.add('snap');
  for (const o of document.querySelectorAll('#panel-list .row.is-open')) setRowOpen(o, false);
  if (others.length) { void li.offsetHeight; requestAnimationFrame(() => requestAnimationFrame(() => others.forEach((o) => o.classList.remove('snap')))); }
  go({ type: 'toggle', name: li.wallName, state: li.state }); // its folds and a previewed season start over
  if (vs.openName !== li.wallName) return;
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

function setBand(summary, label, n) {
  summary.replaceChildren(el('span', {}, label), el('span', { class: 'count' }, String(n)));
}

function render() {
  const now = new Date(); // one clock reading per render
  syncSeen();
  // live: the inputs follow the clock (the slider rests at its end before 06:00 / after 23:30, the time used stays real)
  const { date, min, at } = clockView(vs, now);
  if ($('date').value !== date) $('date').value = date;
  if ($('time').value !== String(min)) $('time').value = String(min);
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

  // the stored flag is ignored (not deleted) while no wall has parking data
  const canPark = state.walls.some(hasParking);
  $('parkRow').hidden = !canPark;
  const rows = buildList(state.walls, at, { minHours: Number(ui.minHours), withBreaks: ui.withBreaks, venue: ui.venue });
  const openTotal = rows.filter((r) => r.status.state === 'open').length;
  const fv = filterView(ui, { canPark, openTotal, isNow });
  // 내 지역 · 구분 · 주차 narrow every group, the map and the counts alike (scopeRows)
  const scoped = scopeRows(rows, { regions: ui.regions, venue: ui.venue, parkOnly: fv.parkOnly });
  const mine = ui.favOnly ? scoped.filter((r) => favs.includes(r.wall.name)) : scoped; // 즐겨찾기만
  const all = withDistance(filterRows(mine, ui.sun), vs.origin);
  allRows = rows;
  shown = { rows: all, at };
  go({ type: 'shown', rows: all }); // the open row was filtered out, or moved to another group: forget it
  const groups = groupRows(all);
  const needOrigin = ui.sortMode === 'distance' && !vs.origin;
  const open = sortRows(groups.open, needOrigin ? 'time' : ui.sortMode);

  for (const [id, on] of Object.entries(fv.pressed)) $(id).setAttribute('aria-pressed', String(on));
  $('longOnly').textContent = fv.longLabel;
  const rc = $('regionChip');
  rc.hidden = !ui.regions.length;
  rc.firstChild.textContent = fv.regionLabel;
  rc.setAttribute('aria-label', fv.regionChipLabel);
  for (const box of regionBoxes()) box.checked = ui.regions.includes(box.value);
  if ($('pickRow')) $('pickRow').hidden = !ui.regions.length; // the pick shows only with a 내 지역; nothing to turn off before
  if ($('pickOn')) $('pickOn').checked = !ui.hidePick; // (a cached older page may not have it yet: sw.js shows the stored page first)
  syncRegionCounts();
  const sheetOn = fv.sheetCount;
  $('moreFilters').classList.toggle('on', sheetOn > 0);
  $('moreFilters').textContent = sheetOn ? `조건 ${sheetOn} ▾` : '조건 ▾';

  const n = open.length;
  liveOpenCount = isNow ? n : null;
  // filters apply as they are ticked: the sheet's 확인 button says what they left
  if ($('condDone')) $('condDone').textContent = `확인 · ${n}곳`;
  // another day names the day (the live region is read without the date input)
  const lead = summaryLead(at, now, isNow);
  const key = `${lead}${n}`;
  if ($('summary').dataset.key !== key) { // live region: only on change
    $('summary').dataset.key = key;
    $('summary').replaceChildren(`${lead}갈 수 있는 외벽이 `, el('b', { class: n ? null : 'zero' }, String(n)), '곳 있어요');
  }
  $('sub').textContent = `${at.getMonth() + 1}월 ${at.getDate()}일 ${DAY_KO[at.getDay()]}요일${vs.origin ? ' · 직선거리' : ''}`; // the date field and "지금으로" are folded away by default, so this line says the day and that it is not now

  // the order is not alphabetical: say what it is (most time left first). 가까운 순 needs a known origin
  $('label-open').textContent = `${isNow ? '지금 열려 있는 곳' : '이 시각에 열려 있는 곳'} · ${ui.sortMode === 'distance' && !needOrigin ? '가까운 순' : '오래 운동할 수 있는 순'}`;
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
    setBand($('group-suspended').querySelector('summary'), '임시 휴관 중', groups.suspended.length);
    $('rows-suspended').replaceChildren(...groups.suspended.map((r) => safeRow(r, at)));
  }

  const msg = vs.locateNote || (needOrigin ? '내 위치를 먼저 확인해 주세요.' : '');
  $('locateMsg').textContent = msg;
  $('locateMsg').hidden = !msg;

  const { pins, unlocated } = mapPins(all);
  $('map-empty').hidden = mapFailed || pins.length > 0;
  $('map-note').textContent = `위치 정보 없음 ${unlocated.length}곳 · ${unlocated.join(', ')}`;
  $('map-note').hidden = !unlocated.length;
  mapApi?.setRows(all, at);
  renderPick();
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
// the wall search: phones put it under the title, above the filters (the 10/16 sketch); wide screens keep it at the top of the list column
const placeFind = () => {
  const f = $('find');
  const host = wide.matches ? document.querySelector('main.wrap') : document.querySelector('header.top .wrap');
  if (!f || !host) return;
  if (wide.matches) host.prepend(f); else host.append(f);
};
wide.addEventListener('change', placeFind);
placeFind();
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
  if (cleared) toast('조건을 모두 지우고 보여 드려요');
}

// revealRow, and when the filters hide the wall: clear them for this visit only (nothing is saved until a filter is
// changed) and reveal again. → true when filters were cleared. Used by 내 암장 and 기록.
function revealClearing(name) {
  if (revealRow(name, { focus: true })) return false;
  clearFilters();
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
function wireFind(input, box, onPick) {
  const draw = () => {
    const q = input.value.trim();
    box.hidden = !q;
    if (!q) return box.replaceChildren();
    const hits = searchPicks(state.walls, q, { origin: vs.origin }).slice(0, 30);
    box.replaceChildren(...(hits.length ? hits.map(({ wall: w, km }) => {
      const b = el('button', { type: 'button', class: 'la-hit' },
        el('span', { class: 'pn' }, w.name),
        km != null ? el('span', { class: 'pd' }, formatDistance(km)) : null,
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
    clearFilters();
    toast('조건을 모두 지우고 보여 드려요');
  }
  mapApi?.select(w.name, true);
}
wireFind($('findQ'), $('findHits'), (w) => {
  if (ui.tab === 'map') return pickOnMap(w);
  if (revealClearing(w.name)) toast('조건을 모두 지우고 보여 드려요');
  if (wide.matches && wallPosition(w)) mapApi?.select(w.name, true);
});

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

const sheet = $('conditions');
const sheetForm = sheet.querySelector('form');
for (const k of ['minHours', 'sortMode', 'venue']) sheetForm.elements[k].value = ui[k];

const setUi = (k, v) => {
  ui[k] = v;
  if (k === 'minHours' || k === 'sortMode' || k === 'venue') sheetForm.elements[k].value = v;
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
$('sunOnly').addEventListener('click', () => setUi('sun', ui.sun === 'sun' ? 'any' : 'sun'));
$('shadeOnly').addEventListener('click', () => setUi('sun', ui.sun === 'shade' ? 'any' : 'shade'));
$('longOnly').addEventListener('click', () => setUi('minHours', ui.minHours !== '0' ? '0' : '3'));
$('nearFirst').addEventListener('click', () => {
  if (ui.sortMode === 'distance') return setUi('sortMode', 'time');
  setUi('sortMode', 'distance');
  if (!vs.origin) locate().then((why) => { // no position: don't keep 가까운 순 on (and saved) while the list stays as it was; the note stays
    if (!why || ui.sortMode !== 'distance') return;
    ui.sortMode = 'time'; sheetForm.elements.sortMode.value = 'time'; saveUi(); render();
  });
});

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
    root.setProperty('--stick-h', `${wide.matches ? 0 : tabbar.offsetHeight}px`);
    return;
  }
  const box = controls.getBoundingClientRect();
  const off = Math.max(0, controls.querySelector('.scrub').getBoundingClientRect().top - box.top - 4);
  const h = box.height - off;
  const axisH = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.625; // .axis height, sticks below
  const tabH = wide.matches ? 0 : tabbar.offsetHeight; // wide: the tab bar does not stick
  const stick = h + tabH + axisH <= innerHeight * 0.3;
  controls.classList.toggle('unstuck', !stick);
  tabbar.classList.toggle('unstuck', !stick);
  controls.style.top = stick ? `${-off}px` : '';
  const root = document.documentElement.style;
  root.setProperty('--ctl-h', `${stick ? h : 0}px`);
  root.setProperty('--stick-h', `${stick ? h + tabH : 0}px`);
};
new ResizeObserver(fitSticky).observe(controls);
addEventListener('resize', fitSticky);
fitSticky();
sheet.addEventListener('click', (e) => e.target === sheet && sheet.close()); // the dialog has no padding: only the backdrop hits it
sheet.addEventListener('change', (e) => {
  if (e.target.name === 'minHours' || e.target.name === 'sortMode') setUi(e.target.name, e.target.value);
  if (e.target.name === 'venue') setUi('venue', cleanVenue(e.target.value));
});
// 내 지역 lives in the 내 정보 sheet (profile-view.js wires the rest of it)
for (const id of ['regionOpts', 'regionOptsC']) {
  $(id)?.addEventListener('change', (e) => setUi('regions', [...e.currentTarget.querySelectorAll('input[name="region"]:checked')].map((b) => b.value)));
}
$('parkingOnly').addEventListener('click', () => setUi('parkingOnly', !ui.parkingOnly));
$('favOnly').addEventListener('click', () => setUi('favOnly', !ui.favOnly));
$('withBreaks').addEventListener('click', () => setUi('withBreaks', !ui.withBreaks));

for (const k of tabs) {
  $(`tab-${k}`).addEventListener('click', () => {
    showTab(k);
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
  showTab(order[(next + order.length) % order.length], true);
});

// Asks for the position (only on a press: 내 위치 / 가까운 순 in the list); kept in memory only.
// sort: the list's 가까운 순 (sets ui.sortMode and the note under the list); no caller passes false now (the 기록 sheet
// never asks for the position). → Promise<string>: '' once the position is in, else why not.
function locate(sort = true) {
  return new Promise((done) => {
    const fail = (why) => {
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
  if (b && (canEdit || b.dataset.act === 'report')) document.dispatchEvent(new CustomEvent(`wall:${b.dataset.act}`, { detail: b.dataset.kind ? { name: b.dataset.name, kind: b.dataset.kind } : b.dataset.name }));
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

const first = await loadList();
state.walls = first ?? [];
if (config.singlePitch) state.crags = await fetchCrags().catch(() => []);
showLoadError(!first);
// A share link (?wall=이름) opens that wall's card. The saved filters may hide it, so this visit drops them (in
// memory only; nothing is saved until the visitor changes a filter) and starts on the list.
const sharedWall = wallFromSearch(state.walls, location.search);
const invite = sharedWall ? parseInvite(location.search, new Date()) : null; // 같이 가요: the link also names a moment
if (sharedWall) {
  Object.assign(ui, CLEARED, { regions: [], tab: 'list' });
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
  if (infoRequested(location.search) || boardRequested(location.search)) openWallSheet(sharedWall.name, null, { push: false, tab: boardRequested(location.search) ? 'board' : null });
  for (const k of ['wall', 'at', 'n', 'k', 'tags', 'note', 'board', 'info']) u.searchParams.delete(k);
  history.replaceState(null, '', u);
}
{ // 클라이머 유형 테스트: a friend's ?type=<code> link shows that type and the way in (config.climberTest off: ignored)
  const sharedType = config.climberTest ? typeFromSearch(location.search) : null;
  if (sharedType) {
    climberView.banner(sharedType);
    const u = new URL(location.href);
    u.searchParams.delete('type');
    history.replaceState(null, '', u);
  }
}
// 화면 읽는 법 sheet: the header ? opens it. On a first visit it opens by itself once the list is drawn (and carries the KakaoTalk
// notice inside KakaoTalk), then stays closed; a share link skips the guide but keeps the notice (inapp.js howtoDue).
if ($('howto') && $('helpBtn') && $('howto-guide')) { // an older cached page has none of it
  const howto = $('howto');
  let opener = null;
  let auto = null; // what an automatic opening showed: closing it, however it happens, marks that as seen
  const show = (from, due) => {
    opener = from;
    auto = due;
    $('howto-title').textContent = due?.intro ? '처음이세요? 이렇게 읽어요' : due ? '안내' : '화면 읽는 법';
    $('howto-kakao').hidden = !due?.kakao;
    $('howto-guide').hidden = !!due && !due.intro; // only the notice is due: just that
    $('howto-close').textContent = due ? '확인' : '닫기';
    $('howto-more').open = !due; // a first visit sees the short part; ? opens the whole guide
    howto.showModal();
    howto.scrollTop = 0; // the browser scrolls to the focused 확인 button at the foot: start from the title
  };
  howto.addEventListener('close', () => {
    if (auto?.intro) { ui.introDone = true; saveUi(); }
    if (auto?.kakao) closeInApp();
    (opener ?? $('tab-list'))?.focus();
    auto = null;
  });
  howto.addEventListener('click', (e) => e.target === howto && howto.close()); // the backdrop
  $('helpBtn').addEventListener('click', (e) => show(e.currentTarget, null));
  $('inapp-open')?.addEventListener('click', () => { location.href = externalOpenUrl(entryHref); });
  const due = howtoDue({ introDone: ui.introDone, kakao: isKakaoInApp(navigator.userAgent), kakaoClosed: inAppClosed(), shareLink: new URL(entryHref || location.href).searchParams.has('wall') });
  if (due) showHowtoAuto = () => { showHowtoAuto = () => {}; show(null, due); };
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
