import { buildList } from './listing.js';
import { DAY_KO, hhmm, isNight } from './time.js';
import { fetchNational, loadWalls } from './store.js';
import { state, storage, onChange, canEdit } from './state.js';
import { config } from './config.js';
import { createMap } from './map.js';
import { dialModel } from './dial.js';
import { renderDial } from './dial-view.js';
import {
  axisFrac, dayBar, dayLine, dayText, filterRows, fmtMin, formatRanges, groupRows, hasParking, mapPins, NTH_KO,
  scopeRows, seasonSun, shortName, sortRows, summaryLead, timeLabel, weeklyHours, winterSpan, withDistance,
} from './viewmodel.js';
import { cardModel } from './card-model.js';
import { hoursLine, reasonOf, weekendPicks } from './pick.js';
import { loadFavs, saveFavs, toggleFav } from './favorites.js';
import { loadSeen, markSeen, recordFirstSeen, saveSeen, settingChanged } from './setting.js';
import { parseInvite } from './invite.js';
import { createInviteView } from './invite-view.js';
import { inkStamp } from './stamp.js';
import { CLEARED, TABS, cleanRegions, cleanTheme, cleanVenue, filterView, loadUi, saveUi as storeUi, shareUrl, wallFromSearch } from './ui-state.js';
import { clockView, initialView, step } from './view-state.js';
import { areaList } from './areas.js';
import { el } from './dom.js';
import { createLogView, toast } from './log-view.js';
import { applyTheme, createProfileView } from './profile-view.js';
import { aggregate, askable, canReport, crowdPayload, crowdReady, markSent, parseCrowdCsv } from './crowd.js';
import { bumpCrowd } from './rank.js';

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
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  calendar: ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18'],
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
let theme; // what applyTheme last got: 자동 turns 'dark' from 23:00 to 08:00 (src/boot-theme.js does the same for the first paint)
function syncTheme() {
  const next = ui.theme === 'auto' && isNight(new Date()) ? 'dark' : ui.theme; // the real clock, not the picked moment
  if (next !== theme) applyTheme((theme = next));
}
syncTheme();
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
  exportFile: logView.exportFile,
  importFile: logView.importFile,
});
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
const feeChip = (m) => (m.fee ? el('span', { class: 'fee' }, m.fee) : null);

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

// contact links; the expanded row leaves out 길찾기 (primary), it has its own button
const LINK_ICON = { 공지사항: 'megaphone', '인스타 공지': 'megaphone', 오픈채팅: 'chat', 전화: 'phone', 네이버지도: 'pin' };
function actionLinks(links, last = null) { // last: one more pill at the end of the same wrapping row
  if (!links.length && !last) return null;
  return el('div', { class: 'actions' },
    ...links.map(({ label, href, primary }) =>
      el('a', { class: `btn${primary ? ' primary' : ''}`, href, target: '_blank', rel: 'noopener noreferrer' }, LINK_ICON[label] ? icon(LINK_ICON[label]) : null, label)),
    last);
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

function hero(m) {
  // no photo: a low band instead of a big grey box ("높이 15.5m · 사진 준비 중")
  const ph = () => el('div', { class: 'hero ph', 'aria-hidden': 'true' }, el('span', {}, m.heroText));
  if (!m.photo) return ph();
  const img = el('img', { class: 'hero', src: m.photo, decoding: 'async', alt: `${m.name} 외벽 사진` });
  img.addEventListener('error', () => img.replaceWith(ph()), { once: true });
  return img;
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
    ...[['summer', '하계'], ['winter', '동계']].map(([k, label]) => {
      const b = el('button', { type: 'button', 'data-season': k, 'aria-pressed': String(wk.season === k) }, label);
      b.addEventListener('click', () => {
        go({ type: 'season', name: wall.name, pick: k, current: weeklyHours(wall, at).season });
        const next = hoursGrid(wall, at);
        sec.replaceWith(next);
        next.querySelector(`[data-season="${k}"]`)?.focus();
      });
      return b;
    })) : null;
  // the winter months in words beside the switch (month granularity: from_month/to_month); 외벽 휴장 stands out
  const months = ws ? el('p', { class: `g-months${ws.closed ? ' shut' : ''}` },
    ws.closed ? `동절기 외벽 휴장 ${ws.winter}` : `동계 ${ws.winter}`) : null;
  const segRow = seg || months ? el('div', { class: 'g-segrow' }, seg, months) : null;

  const day = live ? dayLine(wall, at) : null; // a closed_date / nth closure isn't in the weekly rows: say it here
  const lead = live
    ? (day.closed ? el('p', { class: 'g-lead' }, `${dayText(at)} `, el('b', {}, day.text))
      : bar?.sun ? el('p', { class: 'g-lead' }, `${dayText(at)} 운영 중 양달 `, el('b', {}, sunOn.length ? formatRanges(sunOn) : '없음')) : null)
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

  for (const r of wk.rows) {
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
    if (r.today && bar?.sun) trk.append(...clipDay(bar.sun).map(([a, b]) => span('g-sun', a, b)), ...clipDay(sunOn).map(([a, b]) => span('g-sunon', a, b)));
    const said = `${r.days}${r.today ? '(오늘)' : ''} ${r.text}${r.breaks.length ? `, 휴게 ${formatRanges(r.breaks)}` : ''}${shut ? `, 오늘은 ${day.text}` : ''}`;
    body.append(el('div', { class: `g-row${r.today ? ' g-today' : ''}${shut ? ' shut' : ''}`, role: 'listitem', 'aria-label': said },
      el('span', { class: 'g-lab', 'aria-hidden': 'true' }, r.days, r.today ? el('small', {}, '오늘') : null),
      el('span', { class: 'g-wrap', 'aria-hidden': 'true' }, trk)));
  }

  const breaks = [...new Set(wk.rows.flatMap((r) => r.breaks.map((b) => formatRanges([b]))))];
  const notes = [
    breaks.length ? `휴게 ${breaks.join(', ')}` : null,
    ...wk.rows.filter((r) => r.nth).map((r) => `${r.nth.map((n) => NTH_KO[n]).join('·')} ${r.days}요일 휴무`),
    wall.holiday === 'weekend' ? '공휴일은 토요일 시간 · 정기휴무 요일과 겹치면 휴무로 표시' : null,
  ].filter(Boolean);
  const hatched = wk.rows.some((r) => r.closed || r.breaks.length);
  sec.append(...[segRow, lead, gridAxis(live ? nowMin : null), body,
    el('ul', { class: 'g-key' },
      el('li', {}, el('i', { class: 'k-bar' }), '운영'),
      hatched ? el('li', {}, el('i', { class: 'k-hatch' }), '휴게·휴무(빗금)') : null,
      bar?.sun ? el('li', {}, el('i', { class: 'k-sunall' }), '양달') : null,
      bar?.sun ? el('li', {}, el('i', { class: 'k-sunon' }), '운영 중 양달') : null,
      live ? el('li', {}, el('i', { class: 'k-now' }), '선택한 시각') : null),
    notes.length ? el('ul', { class: 'g-notes' }, ...notes.map((n) => el('li', {}, n))) : null].filter(Boolean));
  return sec;
}

// Seasonal sun: 여름 / 봄·가을 / 겨울, each "여름 6/21 · 12:40–19:40" over a bar against the same weekday's hours
// in that season (solid where they meet). One legend line under the rows.
function seasonSunBlock(wall, at, d) {
  if (noSunMath(d)) return null;
  const rows = seasonSun(wall, at);
  return el('section', { class: 'ssun', 'aria-label': `계절마다 양달인 시간, ${DAY_KO[at.getDay()]}요일 운영시간 기준` },
    gridAxis(null),
    ...rows.map((s) => {
      const trk = el('span', { class: 'g-trk', 'aria-hidden': 'true' },
        ...clipDay(s.open).map(([a, b]) => span('s-open', a, b)),
        ...clipDay(s.windows).map(([a, b]) => span('g-sun', a, b)),
        ...clipDay(s.on).map(([a, b]) => span('g-sunon', a, b)));
      const sunText = s.windows.length ? formatRanges(s.windows) : '하루 종일 응달';
      const hint = s.closed ? ' · 휴무' : s.unknown ? ' · 시간 미입력' : '';
      return el('div', { class: `s-row${s.current ? ' cur' : ''}` },
        el('p', { class: 's-head' }, el('b', {}, s.name), ` ${s.date}${s.current ? '(지금)' : ''} · ${sunText}${hint}`),
        trk);
    }),
    el('ul', { class: 'g-key' },
      el('li', {}, el('i', { class: 'k-open' }), '운영시간'),
      el('li', {}, el('i', { class: 'k-sunall' }), '양달'),
      el('li', {}, el('i', { class: 'k-sunon' }), '운영 중 양달')));
}

// The folded part: one picture at a time, [운영시간] [계절별 양달] tabs (arrows/Home/End move). Starts on 운영시간
// each time the row opens (vs.moreTab resets with the row); the switch is instant, no motion.
function moreTabs(wall, at, d, id) {
  const panes = [['운영시간', hoursGrid(wall, at)], ['계절별 양달', seasonSunBlock(wall, at, d)]].filter(([, p]) => p);
  if (panes.length < 2) return panes.map(([, p]) => p);
  const tabs = panes.map(([label], i) => el('button', {
    type: 'button', role: 'tab', id: `${id}-t${i}`, 'aria-controls': `${id}-p${i}`,
  }, label));
  const panels = panes.map(([, p], i) => el('div', { role: 'tabpanel', id: `${id}-p${i}`, 'aria-labelledby': `${id}-t${i}`, class: 'm-panel' }, p));
  const pick = (n, focus) => {
    go({ type: 'tab', n });
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === n));
      t.tabIndex = i === n ? 0 : -1;
      panels[i].hidden = i !== n;
    });
    if (focus) tabs[n].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(i, false));
    t.addEventListener('keydown', (e) => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      pick((n + tabs.length) % tabs.length, true);
    });
  });
  pick(Math.min(vs.moreTab, tabs.length - 1), false);
  return [el('div', { class: 'm-tabs', role: 'tablist', 'aria-label': '시간표 보기' }, ...tabs), ...panels];
}

// The address sits under the place line; tapping it copies it (a copy icon says so; the text turns into
// "✓ 복사했어요" and the icon into a check for a moment). Next to it, an icon opens the route.
function addrLine(m) {
  const nav = m.route && el('a', { class: 'icon-btn', href: m.route, target: '_blank', rel: 'noopener noreferrer', 'aria-label': '길찾기', title: '길찾기' }, icon('nav'));
  if (!m.address) return nav ? el('p', { class: 'addr-line' }, nav) : null;
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
  return el('p', { class: 'addr-line' }, btn, nav, say);
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
  btn.replaceChildren(icon('heart', on));
}
// Every heart and name mark of a wall is repainted in place, so the tapped button keeps focus.
function syncFavs() {
  for (const b of document.querySelectorAll('[data-fav]')) paintStar(b);
  for (const m of document.querySelectorAll('[data-favmark]')) m.hidden = !favs.includes(m.dataset.favmark);
  renderFavStrip();
}
function favBtn(name) {
  const btn = el('button', { type: 'button', class: 'icon-btn fav-btn', 'data-fav': name, 'aria-label': '즐겨찾기', title: '즐겨찾기' });
  btn.addEventListener('click', () => {
    favs = toggleFav(favs, name);
    saveFavs(storage, favs);
    syncFavs();
    if (ui.favOnly) render(); // the list itself follows the hearts
  });
  paintStar(btn);
  return btn;
}
// 내 암장: one line per favorite (name, status now); a tap opens its card in the list, filters cleared for the visit if
// they hide it. Hidden with no favorites, so the first screen is unchanged until someone stars a wall.
function renderFavStrip() {
  const at = shown.at;
  const mine = favs.map((n) => allRows.find((r) => r.wall.name === n)).filter(Boolean);
  $('favs').hidden = !mine.length || !at;
  if (!mine.length || !at) return;
  $('countFav').textContent = String(mine.length);
  $('fav-list').replaceChildren(...mine.map((row) => {
    const m = cardModel(row, at);
    const b = el('button', { type: 'button', class: `fav-item ${m.state}` },
      el('span', { class: 'fav-name' }, m.shortName), el('span', { class: 'fav-status' }, m.statusText));
    b.addEventListener('click', () => revealClearing(m.name));
    return el('li', {}, b);
  }));
}

// ---- 이번 주말 추천 (src/pick.js): a folded line above the timetable ----
let pickDay = 0;
let pickPref = 'auto';
const PICK_PREFS = [['auto', '자동'], ['shade', '응달'], ['sun', '양달'], ['any', '오래']];
const PICK_WORD = { shade: '응달 우선', sun: '양달 우선', any: '오래 탈 수 있는 곳' };

// Jump the date and time controls to a moment (the same state a visitor gets by picking it), then re-render.
const goToMoment = (date, min) => go({ type: 'moment', date, min });

// A wall's picture for the pick: its photo (fixed box, lazy), else a grey mark of the logo and, on a tile, the wall's
// height in metres. Decorative: the name and the reason beside it say everything.
function pickMedia(wall, tile) {
  const box = el('span', { class: `pick-media${tile ? ' tile' : ''}`, 'aria-hidden': 'true' });
  const plain = () => box.replaceChildren(...[
    el('span', { class: 'pick-mono' }),
    tile && wall.height_m ? el('span', { class: 'pick-height' }, `${wall.height_m}m`) : null,
  ].filter(Boolean)); // (replaceChildren would print a null as the word "null")
  if (!wall.photo) {
    plain();
    return box;
  }
  const img = el('img', { src: `data/${wall.photo}`, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', plain, { once: true });
  box.append(img);
  return box;
}

let pickBasisOpen = false; // the day / basis choices, shown only when asked for
let pickRefocus = null;

// 이번 주말, 여기: a curated pick, not a list. Folded it is one line (thumbnail, wall, reason). Opened: one row naming the
// day and basis (it opens the choices), then up to three tiles side by side, swiped one at a time with the next peeking in:
// a photo (or the grey logo mark with the height), the rank, the wall, one sentence of why. Hidden when the list has nothing
// to say about the coming weekend.
function renderPick() {
  const box = $('pick');
  const r = state.walls.length ? weekendPicks(state.walls, new Date(), { pref: pickPref, regions: ui.regions, venue: ui.venue }) : null;
  box.hidden = !r || r.byDay.every((d) => !d.items.length);
  if (box.hidden) return;
  pickDay = Math.min(pickDay, r.days.length - 1);
  const cur = r.byDay[pickDay];
  const top = cur.items[0];
  const goPick = (it) => {
    const first = (r.pref === 'shade' ? it.shade : r.pref === 'sun' ? it.sun : it.open)?.[0]?.[0] ?? it.open[0][0];
    goToMoment(it.day.date, first); // that day, from the start of the stretch that was counted
    revealClearing(it.wall.name);
  };
  $('pick-thumb').replaceChildren(...(top ? [pickMedia(top.wall, false)] : []));
  $('pick-hint').textContent = top ? `${shortName(top.wall)} · ${reasonOf(top, r.pref).short}` : `${cur.day.label}요일은 추천할 곳이 없어요`;

  const kids = [];
  const set = el('button', { type: 'button', class: 'pick-set', 'aria-expanded': String(pickBasisOpen), 'data-focus': 'set' },
    el('span', {}, `${dayText(cur.day.date)} · ${PICK_WORD[r.pref]}`), icon('sliders'));
  set.addEventListener('click', () => { pickBasisOpen = !pickBasisOpen; pickRefocus = 'set'; renderPick(); });
  kids.push(set);
  if (pickBasisOpen) {
    const group = (label, items, pressed, pick) => el('div', { class: 'pick-segs', role: 'group', 'aria-label': label },
      ...items.map(([v, text]) => {
        const b = el('button', { type: 'button', class: 'pick-seg', 'aria-pressed': String(pressed(v)), 'data-focus': `${label}-${v}` }, text);
        b.addEventListener('click', () => { pick(v); pickRefocus = `${label}-${v}`; renderPick(); });
        return b;
      }));
    if (r.days.length > 1) kids.push(group('요일', r.days.map((d, i) => [i, `${d.label}요일`]), (v) => v === pickDay, (v) => { pickDay = v; }));
    kids.push(group('기준', PICK_PREFS, (v) => v === pickPref, (v) => { pickPref = v; }));
    if (pickPref === 'auto') kids.push(el('p', { class: 'pick-basis' }, `자동은 계절에 맞춰요 (지금은 ${PICK_WORD[r.pref]}).`));
  }
  if (cur.items.length) {
    kids.push(el('ul', { class: 'pick-rail' }, ...cur.items.map((it, i) => {
      const b = el('button', { type: 'button', class: 'pick-tile' },
        el('span', { class: 'pick-tile-media' }, pickMedia(it.wall, true), el('span', { class: 'pick-rankchip' }, `${i + 1}순위`)),
        el('span', { class: 'pick-tile-text' },
          el('span', { class: 'pick-name' }, shortName(it.wall)),
          el('span', { class: 'pick-why' }, reasonOf(it, r.pref).sentence),
          el('span', { class: 'pick-hours' }, hoursLine(it))));
      b.addEventListener('click', () => goPick(it));
      return el('li', {}, b);
    })));
  } else {
    kids.push(el('p', { class: 'pick-empty' }, '이 날은 조건에 맞는 곳이 없어요. 다른 날이나 기준을 골라 보세요.'));
  }
  kids.push(el('p', { class: 'pick-note' }, '운영시간과 해 계산 기준이에요. 가기 전에 공지를 꼭 확인해 주세요.'));
  $('pick-body').replaceChildren(...kids);
  if (pickRefocus) $('pick-body').querySelector(`[data-focus="${pickRefocus}"]`)?.focus({ preventScroll: true });
  pickRefocus = null;
}

// 공유하기 icon at the end of the name line: the link is copied right away (the icon turns into a check for a moment and
// the live note says so), and the toast offers 같이 가요 초대 for that wall.
function shareBtn(name) {
  const btn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': '공유하기', title: '공유하기' }, icon('share'));
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
    btn.replaceChildren(icon('check'));
    say.textContent = '링크를 복사했어요';
    clearTimeout(timer);
    timer = setTimeout(() => { btn.classList.remove('done'); btn.replaceChildren(icon('share')); say.textContent = ''; }, 1800);
    toast('링크를 복사했어요', () => inviteView.openInvite(name), '같이 가요 초대 만들기');
  });
  return el('span', { class: 'share-wrap' }, btn, say);
}

// First view under the chips: 안내 (status notes, then the memo lines: closures/warnings, hours, the rest),
// parking (names). Weekly closures are a 안내 line and the hatched grid rows.
const memoItem = (l) => el('li', { class: l.key ? 'key' : null },
  l.label ? el('span', { class: 'mk' }, l.label) : null,
  el('span', { class: l.label ? 'mv' : 'mv free' }, l.value));

function infoBlock(m) {
  const parts = [];
  const { shown, folded, moreLabel } = m.info;
  if (shown.length) parts.push(el('ul', { class: 'memo-list info', 'aria-label': '안내' }, ...shown.map(memoItem)));
  if (folded.length) { // lines 4+: folded under the same list; the warning lines never land here
    const fid = `info-more-${++rowSeq}`;
    const inner = el('ul', { class: 'memo-list info' }, ...folded.map(memoItem));
    const fold = el('div', { class: 'info-fold', id: fid }, el('div', { class: 'info-fold-in' }, inner));
    const btn = el('button', { type: 'button', class: 'info-more', 'aria-controls': fid }, '');
    const sync = () => {
      btn.setAttribute('aria-expanded', String(vs.infoOpen));
      btn.textContent = vs.infoOpen ? '접기' : moreLabel;
      fold.classList.toggle('open', vs.infoOpen);
      fold.inert = !vs.infoOpen;
    };
    btn.addEventListener('click', () => { go({ type: 'info' }); sync(); });
    sync();
    parts.push(fold, btn);
  }
  // status, then the wall's own lot, then "주변" lots on a line of their own (the status is no longer a chip as well)
  const { onsite, nearby } = m.parkingWhere;
  parts.push(el('div', { class: 'irow' }, el('span', { class: 'mk' }, '주차'),
    el('p', { class: 'pv' }, el('b', { class: `pk-word ${m.parking.tone}` }, m.parking.word), onsite.length ? ` · ${onsite.join(' · ')}` : '',
      nearby.length ? el('span', { class: 'pnear' }, el('span', { class: 'pn-k' }, '주변'), nearby.join(' · ')) : null)));
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
const noSunMath = (d) => d.state === 'unknown' || d.state === 'override';
function sunBox(d, name, closedDay) {
  const sentence = el('p', { class: 'dsent' }, ...d.sentence.map((p) => (p.bold ? el('b', {}, p.text) : p.text)));
  if (closedDay) {
    return el('section', { class: 'sunbox solo', 'aria-label': '해' }, el('div', { class: 'sb-txt' },
      el('p', { class: 'dsent off' }, '이 날은 운영하지 않아서 해 나침반은 접어 두었어요.'),
      noSunMath(d) ? null : el('p', { class: 'dwhen' }, d.windows.length ? `참고 · 양달 시간 ${formatRanges(d.windows)}` : '참고 · 하루 종일 응달')));
  }
  if (noSunMath(d)) {
    return el('section', { class: 'sunbox solo', 'aria-label': '해' }, el('div', { class: 'sb-txt' }, sentence));
  }
  return el('section', { class: 'sunbox', 'aria-label': '해' },
    el('div', { class: 'sb-fig' }, el('div', { class: 'sundial-slot' }, dialFig(name, d))),
    el('div', { class: 'sb-txt' },
      sentence,
      el('p', { class: 'dwhen' }, el('b', {}, d.windows.length ? `양달 시간 ${formatRanges(d.windows)}` : `${d.dayLabel === '오늘' ? '오늘은' : d.dayLabel} 하루 종일 응달이에요`))));
}


const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Expanded row (v6): what decides the visit first, the rest folded in "더 보기".
function rowDetails(m, wall, at, id) {
  const dial = dialModel(wall, at, { isNow: vs.live, dayLabel: m.dayLabel });
  // the 안내 overflow folds again and the "더 보기" fold survives re-renders (slider) through vs.infoOpen / vs.moreOpen
  const sumState = el('span', { class: 'sum-s' }, vs.moreOpen ? '접기' : '더 보기');
  // folded: the pictures only, one at a time (hours grid | seasonal sun)
  const more = el('details', { class: 'more2' },
    el('summary', {}, el('span', { class: 'sum-t' }, '시간표 · 계절'), sumState, el('span', { class: 'chev', 'aria-hidden': 'true' })),
    ...moreTabs(wall, at, dial, id));
  more.open = vs.moreOpen;
  // one control opens the folded part: its summary row (the old "자세히" button did the same)
  more.addEventListener('toggle', () => {
    if (more.closest('.row.is-open')) go({ type: 'more', open: more.open }); // a row being closed doesn't speak for the open one
    sumState.textContent = more.open ? '접기' : '더 보기';
  });
  // 제보 stays at the foot as quiet text links: a correction is rare, and the card's job is the hours above
  const helps = config.reportEndpoint
    ? el('div', { class: 'help-row' },
      el('button', { type: 'button', class: 'help-link', 'data-act': 'report', 'data-name': m.name }, '정보 수정 요청'),
      m.hasChat ? null : el('button', { type: 'button', class: 'help-link', 'data-act': 'report', 'data-name': m.name, 'data-kind': '오픈채팅방' }, '오픈채팅 추가'))
    : null;
  return [
    el('div', { class: 'herowrap' }, hero(m), creditChip(m.credit)),
    el('div', { class: 'm-cols' },
      el('div', { class: 'm-info' },
        el('div', { class: 'x-head' }, favBtn(m.name), el('h3', { class: 'x-name' }, m.name, feeChip(m)), shareBtn(m.name)),
        el('p', { class: 'x-sub' }, m.sub),
        addrLine(m),
        actionLinks(m.links.filter((l) => !l.primary)), // 공지사항 · 오픈채팅 · 전화 · 네이버지도
        // 오늘 운영 … and 다녀왔어요 at the right end of the same line (wraps to the right of the next line when long)
        el('div', { class: 'today-row' }, el('p', { class: 'today' }, el('span', {}, m.today.lead), el('b', {}, m.today.text)), beenBtn(m)),
        ...crowdBox(m),
        m.holiday ? el('p', { class: 'hol-note' }, m.holiday) : null,
        m.staleNote ? el('p', { class: 'stale-note' }, m.staleNote) : null,
        el('div', { class: 'tags' },
          ...m.breaks.map((t) => el('span', { class: 'tag brk' }, t)),
          ...m.tags.map((t) => el('span', { class: 'tag' }, t)),
          ...m.sizes.map((t) => el('span', { class: 'tag' }, t))),
        ...infoBlock(m),
        m.settingBadge ? el('p', { class: 'setnew' }, el('span', { 'aria-hidden': 'true' }, '✦ '), m.settingBadge) : null,
        m.setting ? el('p', { class: 'checked setting' }, m.setting) : null,
        el('p', { class: 'checked' }, m.checked)),
      more.childElementCount > 1 ? more : null, // hours / season tabs sit above the compass
      sunBox(dial, m.name, m.closedDay)),
    visitLog(m),
    blogBox(m.blog),
    helps,
    rowButtons(m.name),
  ];
}

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
  if (!c) return [];
  return [el('p', { class: `crowd-chip${c.chip.muted ? ' muted' : ''}`, 'data-level': c.chip.level ?? 'none' },
    c.chip.bars ? el('span', { class: 'crowd-meter', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')) : null,
    c.chip.text)];
}
const modelOf = (row, at) => cardModel(row, at, {
  visits: logView.recordsFor(row.wall.name), crowd: crowdCtx(row.wall.name, at), settingNew: settingChanged(row.wall, favs, seen),
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
      el('span', { class: 'rname' }, m.shortName),
      feeChip(m),
      m.settingBadge ? el('span', { class: 'setnew', 'data-setmark': m.name }, el('span', { 'aria-hidden': 'true' }, '✦ '), m.settingBadge) : null,
      m.crowdTag ? el('span', { class: 'crowdnow', 'data-level': m.crowdTag.level, role: 'img', 'aria-label': m.crowdTag.aria },
        el('span', { class: 'crowd-meter', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), m.crowdTag.text) : null,
      basisTag(m), // own span: the region line may be cut short, this may not
      m.visits ? el('span', { class: 'been' }, m.visits.label) : null,
      m.meta ? el('span', { class: 'rmeta' }, m.meta) : null,
      el('span', { class: 'left' }, m.left)),
    bar ? el('span', { class: 'bar', role: 'img', 'aria-label': bar.label },
      ...bar.segments.map(([a, b, past]) => span(past ? 'seg past' : 'seg', a, b)),
      ...bar.sunBands.map(([a, b]) => span('sunband', a, b)),
      tick) : null);
  // Only the row that stays open across a re-render is filled now; it is created open, so no transition plays.
  const inner = el('div', { class: 'expand-in' }, ...(isOpen ? rowDetails(m, row.wall, at, id) : []));
  const li = el('li', { class: `row ${m.state}${m.soon ? ' soon' : ''}${isOpen ? ' is-open' : ''}` },
    btn, el('div', { class: 'expand', id }, inner));
  // filled on open: a fresh model, so "오늘" is judged on the clock of the click
  li.fill = () => inner.childElementCount || inner.append(...rowDetails(modelOf(row, at), row.wall, at, id).filter(Boolean));
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
  const more = li.querySelector('.more2');
  if (!open && more) more.open = false; // a closed row comes back folded, like after a re-render
  if (!open) li.querySelector('.expand-in .setnew')?.remove(); // 세팅일 badge: seen once it was opened
}

// One row open at a time.
function toggleRow(li) {
  for (const o of document.querySelectorAll('#panel-list .row.is-open')) setRowOpen(o, false);
  go({ type: 'toggle', name: li.wallName, state: li.state }); // its folds and a previewed season start over
  if (vs.openName !== li.wallName) return;
  li.fill();
  seeSetting(li.wallName);
  li.querySelectorAll('.blog-more[aria-expanded="true"]').forEach((b) => b.click()); // 후기 목록은 접힌 채로 시작
  setRowOpen(li, true);
  // opened near the foot of the screen: the details would appear below the fold, so bring the row up
  const btn = li.querySelector('.row-btn');
  if (btn.getBoundingClientRect().top > innerHeight * 0.6) btn.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

// Opens a wall's card in the list (its group unfolded) and brings it to the top; false when the filters hide it.
// Used by a share link and by the map card's 자세히 보기.
function revealRow(name) {
  const row = shown.rows.find((r) => r.wall.name === name);
  if (!row) return false;
  go({ type: 'reveal', name, state: row.status.state }); // renders: the open row is built filled, so no transition plays
  seeSetting(name);
  const li = [...document.querySelectorAll('#panel-list .row')].find((r) => r.wallName === name);
  const band = li?.closest('details');
  if (band) band.open = true;
  li?.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
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
  for (const box of $('regionOpts').querySelectorAll('input[name="region"]')) box.checked = ui.regions.includes(box.value);
  $('regionNow').textContent = ui.regions.length ? ui.regions.join(', ') : '전국'; // the 조건 sheet only says it; 내 정보 changes it
  syncRegionCounts();
  const sheetOn = fv.sheetCount;
  $('moreFilters').classList.toggle('on', sheetOn > 0);
  $('moreFilters').textContent = sheetOn ? `조건 ${sheetOn} ▾` : '조건 ▾';

  const n = open.length;
  // another day names the day (the live region is read without the date input)
  const lead = summaryLead(at, now, isNow);
  const key = `${lead}${n}`;
  if ($('summary').dataset.key !== key) { // live region: only on change
    $('summary').dataset.key = key;
    $('summary').replaceChildren(`${lead}갈 수 있는 외벽이 `, el('b', { class: n ? null : 'zero' }, String(n)), '곳 있어요');
  }
  $('sub').textContent = `${DAY_KO[at.getDay()]}요일${vs.origin ? ' · 직선거리' : ''}`; // the date input shows the rest

  $('label-open').textContent = isNow ? '지금 열려 있는 곳' : '이 시각에 열려 있는 곳';
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

  const msg = vs.locateNote || (needOrigin ? '내 위치를 먼저 확인해 주세요.' : '');
  $('locateMsg').textContent = msg;
  $('locateMsg').hidden = !msg;

  const { pins, unlocated } = mapPins(all);
  $('map-empty').hidden = mapFailed || pins.length > 0;
  $('map-note').textContent = `위치 정보 없음 ${unlocated.length}곳 · ${unlocated.join(', ')}`;
  $('map-note').hidden = !unlocated.length;
  mapApi?.setRows(all, at);
  renderFavStrip();
  renderPick();
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
function showTab(key, focus = false) {
  ui.tab = key;
  saveUi();
  for (const k of tabs) {
    const t = $(`tab-${k}`);
    t.setAttribute('aria-selected', String(k === key));
    t.tabIndex = k === key ? 0 : -1;
    $(`panel-${k}`).hidden = k !== key;
  }
  $('summary').hidden = key === 'log'; // the open-now headline counts the list's filters; 기록 hides them, so it would read 0
  controls.hidden = key === 'log'; // 기록 has no time/slider: the form (hidden = out of focus and the reader) keeps its state
  fitSticky();
  if (key !== 'log') tick(); // back from 기록: a live clock catches up now
  if (focus) $(`tab-${key}`).focus();
  if (key === 'map') openMap();
  if (key === 'log') logView.render();
}

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
  if (revealRow(name)) return false;
  Object.assign(ui, CLEARED, { regions: [] });
  sheetForm.elements.minHours.value = ui.minHours;
  sheetForm.elements.venue.value = ui.venue;
  render();
  revealRow(name);
  return true;
}

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
$('sunOnly').addEventListener('click', () => setUi('sun', ui.sun === 'sun' ? 'any' : 'sun'));
for (const li of document.querySelectorAll('[data-sunkey]')) li.prepend(icon(li.dataset.sunkey)); // the key under the list
$('sunOnly').prepend(icon('sun')); // the filter wears the same picture as the rows
$('shadeOnly').prepend(icon('shade'));
$('shadeOnly').addEventListener('click', () => setUi('sun', ui.sun === 'shade' ? 'any' : 'shade'));
$('longOnly').addEventListener('click', () => setUi('minHours', ui.minHours !== '0' ? '0' : '3'));
$('nowBtn').addEventListener('click', () => go({ type: 'now' }));
$('nearFirst').addEventListener('click', () => {
  if (ui.sortMode === 'distance') return setUi('sortMode', 'time');
  setUi('sortMode', 'distance');
  if (!vs.origin) locate();
});

$('regionChip').addEventListener('click', () => {
  setUi('regions', []);
  $('sunOnly').focus(); // the chip is gone
});

// 내 지역: one checkbox pill per 권역 the walls are in (areas.js, at most 5); rebuilt only when that list changes, so a tick keeps focus.
// The saved choice is pruned to 권역 that exist (not while the list failed to load).
let regionKey = null;
function syncRegions() {
  if (!state.walls.length) return;
  const areas = areaList(state.walls);
  ui.regions = cleanRegions(ui.regions, areas.map((a) => a.name));
  $('regionRow').hidden = !areas.length;
  const key = areas.map((a) => `${a.name}:${a.total}`).join('|');
  if (regionKey === key) return;
  regionKey = key;
  $('regionOpts').replaceChildren(el('div', { class: 'rg-list' }, ...areas.map((a) => el('label', {},
    el('input', { type: 'checkbox', name: 'region', value: a.name }), a.name, el('span', { class: 'rg-n' }, `${a.total}`)))));
}
function syncRegionCounts() {
  $('regionClear').hidden = !ui.regions.length;
}

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
    root.setProperty('--stick-h', `${tabbar.offsetHeight}px`);
    return;
  }
  const box = controls.getBoundingClientRect();
  const off = Math.max(0, controls.querySelector('.scrub').getBoundingClientRect().top - box.top - 4);
  const h = box.height - off;
  const axisH = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.625; // .axis height, sticks below
  const stick = h + tabbar.offsetHeight + axisH <= innerHeight * 0.3;
  controls.classList.toggle('unstuck', !stick);
  tabbar.classList.toggle('unstuck', !stick);
  controls.style.top = stick ? `${-off}px` : '';
  const root = document.documentElement.style;
  root.setProperty('--ctl-h', `${stick ? h : 0}px`);
  root.setProperty('--stick-h', `${stick ? h + tabbar.offsetHeight : 0}px`);
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
$('regionOpts').addEventListener('change', () => setUi('regions', [...$('regionOpts').querySelectorAll('input[name="region"]:checked')].map((b) => b.value)));
$('parkingOnly').addEventListener('click', () => setUi('parkingOnly', !ui.parkingOnly));
$('favOnly').addEventListener('click', () => setUi('favOnly', !ui.favOnly));
$('withBreaks').addEventListener('click', () => setUi('withBreaks', !ui.withBreaks));

for (const k of tabs) {
  $(`tab-${k}`).addEventListener('click', () => {
    showTab(k);
    if (k === 'map') $('map').scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }); // whole map in view
  });
}
document.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
  const i = tabs.indexOf(ui.tab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  showTab(tabs[(next + tabs.length) % tabs.length], true);
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
  for (const k of ['wall', 'at', 'n', 'k', 'tags', 'note']) u.searchParams.delete(k);
  history.replaceState(null, '', u);
}
showTab(ui.tab); // loadUi keeps it to TABS
