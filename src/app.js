import { buildList } from './listing.js';
import { DAY_KO, hhmm, ymd } from './time.js';
import { fetchNational, loadWalls } from './store.js';
import { state, storage, onChange, canEdit } from './state.js';
import { config } from './config.js';
import { createMap } from './map.js';
import { dialModel, seasonWindows } from './dial.js';
import { renderDial } from './dial-view.js';
import {
  axisFrac, barSegments, dayLine, dayText, emptyText, endingSoon, filterRows, filtersActive, fmtMin, formatDistance, formatRanges,
  breakRanges, groupRows, hasParking, isLivePick, mapPins, memoLines, migrateMinHours, parkingLabel, photoSrc, placeholderText, rowBar, rowLeft,
  sheetCount, shortName, sliderValue, sortRows, staleness, summaryLead, sunTag, timeLabel, wallPosition, weeklyHours, withDistance,
} from './viewmodel.js';

const $ = (id) => document.getElementById(id);
let loadFailed = false;
const UI_KEY = 'open-wall:ui';

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false));
  return e;
};
const safeUrl = (u) => (/^https?:\/\//i.test(u ?? '') ? u : null);
const pct = (min) => `${(min / 1440) * 100}%`;
const whenText = (d, base) => (ymd(d) === ymd(base) ? hhmm(d) : `${dayText(d)} ${hhmm(d)}`);
const SUN_FILTERS = ['any', 'sun', 'shade'];

// ---- UI state: filters persist in localStorage, location stays in memory ----
const ui = { minHours: '0', sun: 'any', parkingOnly: false, withBreaks: false, sortMode: 'time', tab: 'list' };
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
const saveUi = () => {
  try {
    storage.setItem(UI_KEY, JSON.stringify(ui));
  } catch { /* storage full or blocked: keep in memory */ }
};
let origin = null; // {lat, lng} after "내 위치"
let locateNote = '';
let live = true; // date/time follow the clock until the user picks another moment
let openName = null; // the expanded timetable row, kept by wall name across re-renders
let openState = null; // that row's status.state, so a row that moves to another group is forgotten
let shown = { rows: [], at: null }; // last rendered rows (all groups, with distance) for the map
let mapApi = null; // created the first time the map tab opens
let mapFailed = false;

// ---- card ----
function statusText(status, at) {
  if (status.state === 'unknown') return '운영시간 미입력';
  if (status.state === 'closed') {
    if (status.onBreak && status.nextOpenAt) return `휴게 중 · ${whenText(status.nextOpenAt, at)} 재개`;
    return status.nextOpenAt ? `닫힘 · 다음 오픈 ${whenText(status.nextOpenAt, at)}` : '닫힘 · 다음 오픈 정보 없음';
  }
  const h = Math.floor(status.remainingMin / 60);
  const m = status.remainingMin % 60;
  return `${h ? `${h}시간 ` : ''}${m || !h ? `${m}분 ` : ''}남음 · ${whenText(status.closeAt, at)} ${status.endKind === 'break' ? '휴게 시작' : '마감'}`;
}

function placeholder(wall) {
  const { primary, secondary } = placeholderText(wall);
  return el('div', { class: 'thumb placeholder', 'aria-hidden': 'true' },
    el('span', { class: 'ph-primary' }, primary), secondary ? el('span', { class: 'ph-secondary' }, secondary) : null);
}

function thumb(wall) {
  const src = photoSrc(wall);
  if (!src) return placeholder(wall);
  const img = el('img', { class: 'thumb', src, loading: 'lazy', decoding: 'async', width: 72, height: 72, alt: `${wall.name} 외벽` });
  img.addEventListener('error', () => img.replaceWith(placeholder(wall)), { once: true });
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
    bar.ahead || !bar.sun ? el('p', { class: 'nosun' },
      [bar.ahead ? `${dayText(bar.ahead)} 운영` : null, bar.sun ? null : '양달 정보 없음'].filter(Boolean).join(' · ')) : null);
}

function sunNote(row) {
  if (row.lit === null) return '벽 방향 미입력';
  const label = row.lit ? '☀ 양달' : row.reason === 'terrain' ? '☁ 응달 · 산에 가려짐' : '☁ 응달';
  return `${label}${row.method === 'azimuth' ? ' · 방위각 기준' : row.method === 'override' ? ' · 직접 입력' : ''}`;
}

function actionLinks(wall) {
  const c = wall.contact ?? {};
  const pos = wallPosition(wall);
  const links = [
    c.phone && ['전화', `tel:${c.phone.replace(/[^\d+]/g, '')}`],
    c.instagram && ['인스타 공지', `https://www.instagram.com/${encodeURIComponent(c.instagram.replace(/^@/, ''))}/`],
    safeUrl(c.naver_map) && ['네이버지도', c.naver_map],
    safeUrl(c.notice_url) && ['공지 사이트', c.notice_url],
    pos && ['길찾기', `https://map.kakao.com/link/to/${encodeURIComponent(wall.name)},${pos.lat},${pos.lng}`, 'primary'],
  ].filter(Boolean);
  if (!links.length) return null;
  return el('div', { class: 'actions' },
    ...links.map(([label, href, kind]) =>
      el('a', { class: `btn${kind ? ` ${kind}` : ''}`, href, target: '_blank', rel: 'noopener noreferrer' }, label)));
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

function more(wall) {
  const src = photoSrc(wall);
  const pos = wallPosition(wall);
  const photo = src ? el('img', { class: 'photo', src, loading: 'lazy', decoding: 'async', alt: `${wall.name} 외벽 사진` }) : null;
  photo?.addEventListener('error', () => photo.remove(), { once: true });
  return el('details', { class: 'more' },
    el('summary', {}, '자세히'),
    photo,
    memoList(wall.memo),
    el('p', { class: 'meta' }, wall.checked_at ? `정보 확인일 ${wall.checked_at}` : '정보 확인일 없음'),
    pos?.approx ? el('p', { class: 'meta' }, '위치 추정(확인 전)') : null,
    wall.parking?.note ? el('p', { class: 'meta' }, `주차 메모 · ${wall.parking.note}`) : null,
    rowButtons(wall.name,
      config.reportEndpoint ? el('button', { type: 'button', 'data-act': 'report', 'data-name': wall.name }, '정보가 달라요') : null));
}

// One card for any row (list groups now, the map's selected pin later).
function card(row, at) {
  const { wall, status, short } = row;
  const parking = parkingLabel(wall.parking);
  const old = staleness(wall, at);
  const bar = status.state === 'unknown' ? null : rowBar(wall, status, at);
  const notes = [
    status.winterNote ? `❄ 동절기 · ${status.winterNote}` : null,
    wall.exceptions?.rain_rule ? '☔ 우천 시 운영 여부는 비 온 뒤 확인하세요' : null,
    sunNote(row),
  ].filter(Boolean);
  return el('li', { class: `card ${status.state}${short ? ' short' : ''}${old.stale ? ' stale' : ''}` },
    thumb(wall),
    el('div', { class: 'head' },
      el('h3', { class: 'name' }, wall.name),
      el('p', { class: 'where' },
        wall.region ? el('small', {}, wall.region) : null,
        row.distanceKm != null ? el('span', { class: 'dist' }, `직선 ${formatDistance(row.distanceKm)}`) : null),
      el('p', { class: `status${endingSoon(row) ? ' soon' : ''}` }, statusText(status, at))),
    bar ? dayBarBlock(bar) : null,
    el('div', { class: 'chips' },
      ...(wall.tags ?? []).map((t) => el('span', { class: 'chip' }, t)),
      ...breakRanges(wall, bar?.ahead ?? at).map((r) => el('span', { class: 'chip break' }, `휴게 ${formatRanges([r])}`)),
      el('span', { class: `chip parking ${parking.tone}`, title: parking.note || null }, parking.text)),
    old.stale ? el('p', { class: 'note stale-note' }, `⚠ 마지막 확인 ${old.label} · 운영시간이 바뀌었을 수 있어요`) : null,
    ...notes.map((n) => el('p', { class: 'note' }, n)),
    actionLinks(wall),
    more(wall));
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
function creditChip(wall) {
  const c = wall.photo_credit;
  if (!c || !photoSrc(wall)) return null;
  const text = `사진 · ${c.text}${c.license ? ` · ${c.license}` : ''}`;
  return c.url
    ? el('a', { class: 'credit', href: c.url, target: '_blank', rel: 'noopener noreferrer' }, text)
    : el('span', { class: 'credit' }, text);
}

function hero(wall) {
  // no photo: a low band instead of a big grey box ("높이 15.5m · 사진 준비 중")
  const ph = () => el('div', { class: 'hero ph', 'aria-hidden': 'true' },
    el('span', {}, `${wall.height_m ? `높이 ${wall.height_m}m · ` : ''}사진 준비 중`));
  const src = photoSrc(wall);
  if (!src) return ph();
  const img = el('img', { class: 'hero', src, decoding: 'async', alt: `${wall.name} 외벽 사진` });
  img.addEventListener('error', () => img.replaceWith(ph()), { once: true });
  return img;
}

// 06–24 bar per weekday group; the hour text sits in the same row, so the bar itself stays silent.
function weekBlock({ rows, season }) {
  if (!rows.length) return null;
  const tick = (h) => {
    const b = el('b', {}, String(h));
    b.style.left = axisX(h * 60);
    return b;
  };
  return el('section', { class: 'hours', 'aria-label': '운영 시간' },
    el('h4', {}, `운영 시간${season ? ` · ${season}` : ''}`),
    ...rows.map((r) => el('div', { class: `hrow${r.today ? ' on' : ''}${r.intervals.length ? '' : ' off'}` },
      el('span', { class: 'hd' }, r.days),
      el('span', { class: 'hbar', 'aria-hidden': 'true' },
        ...r.intervals.filter(([a, b]) => axisFrac(b) > axisFrac(a)).map(([a, b]) => span('', a, b))),
      el('span', { class: 'ht' }, r.text))),
    el('div', { class: 'hax', 'aria-hidden': 'true' }, el('span'), el('span', { class: 'hx' }, ...[6, 12, 18, 24].map(tick)), el('span')));
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

function seasonList(wall, at, d) {
  if (noSunMath(d)) return null;
  return [el('h4', { class: 'h4s' }, '계절마다 양달인 시간'),
    el('ul', { class: 'sl' }, ...seasonWindows(wall, at.getFullYear()).map((s) =>
      el('li', {}, el('span', {}, `${s.name} (${s.date})`), el('b', {}, s.windows.length ? formatRanges(s.windows) : '없음'))))];
}

const moreLinks = (wall) => { // contact links; 길찾기 stays in the first view
  const box = actionLinks(wall);
  box?.querySelector('.primary')?.remove();
  return box?.childElementCount ? box : null;
};

// "오늘 운영 10:00–21:00" / "10/9(금) 임시 휴장 · 휴무": the picked day as getStatus sees it.
function dayLineParts({ season, closed, text }, at) {
  const day = ymd(at) === ymd(new Date()) ? '오늘' : dayText(at);
  const plain = closed || text === '운영시간 미입력'; // not "오늘 운영 운영시간 미입력"
  return [el('span', {}, `${season ? `${season} · ` : ''}${day}${plain ? '' : ' 운영'}`), el('b', {}, text)];
}

// Memo as "라벨 : 값" lines (memoLines, viewmodel.js), the same in the list and the map card.
function memoList(memo) {
  const lines = memoLines(memo);
  if (!lines.length) return null;
  return el('ul', { class: 'memo-list', 'aria-label': '메모' }, ...lines.map((l) => el('li', { class: l.key ? 'key' : null },
    l.label ? el('span', { class: 'mk' }, l.label) : null,
    el('span', { class: l.label ? 'mv' : 'mv free' }, l.value))));
}

let moreOpen = false; // the open row's "더 보기" survives re-renders (slider)
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Expanded row (v6): what decides the visit first, the rest folded in "더 보기".
function rowDetails(row, at, id) {
  const { wall, status } = row;
  const parking = parkingLabel(wall.parking);
  const old = staleness(wall, at);
  const pos = wallPosition(wall);
  const week = weeklyHours(wall, at);
  const dial = dialModel(wall, at, { isNow: live, dayLabel: ymd(at) === ymd(new Date()) ? '오늘' : dayText(at) });
  const day = dayLine(wall, at);
  const where = [wall.region, row.distanceKm != null ? `직선 ${formatDistance(row.distanceKm)}` : null].filter(Boolean).join(' · ');
  const notes = [
    status.winterNote ? `❄ 동절기 · ${status.winterNote}` : null,
    wall.exceptions?.rain_rule ? '☔ 우천 시 운영 여부는 비 온 뒤 확인하세요' : null,
    pos?.approx ? '위치 추정(확인 전)' : null,
  ].filter(Boolean);
  const memo = memoList(wall.memo);
  const sumState = el('span', { class: 'sum-s' }, moreOpen ? '접기' : '더 보기');
  const more = el('details', { class: 'more2' },
    el('summary', {}, el('span', { class: 'sum-t' }, '시간표 · 계절 · 정보'), sumState, el('span', { class: 'chev', 'aria-hidden': 'true' })),
    weekBlock(week),
    ...(seasonList(wall, at, dial) ?? []),
    memo ? el('h4', { class: 'h4s' }, '메모') : null,
    memo,
    ...notes.map((n) => el('p', { class: 'note' }, n)),
    moreLinks(wall),
    rowButtons(wall.name,
      config.reportEndpoint ? el('button', { type: 'button', 'data-act': 'report', 'data-name': wall.name }, '정보가 달라요') : null));
  more.open = moreOpen;
  // one control opens the folded part: its summary row (the old "자세히" button did the same)
  more.addEventListener('toggle', () => {
    if (more.closest('.row.is-open')) moreOpen = more.open; // a row being closed doesn't speak for the open one
    sumState.textContent = more.open ? '접기' : '더 보기';
  });
  const go = pos && el('a', {
    class: 'btn', target: '_blank', rel: 'noopener noreferrer',
    href: `https://map.kakao.com/link/to/${encodeURIComponent(wall.name)},${pos.lat},${pos.lng}`,
  }, '길찾기');
  return [
    el('div', { class: 'herowrap' }, hero(wall), el('span', { class: 'stamp' }, `확인 ${wall.checked_at ?? '없음'}`), creditChip(wall)),
    el('div', { class: 'm-cols' },
      el('div', { class: 'm-info' },
        el('h3', { class: 'x-name' }, wall.name),
        el('p', { class: 'x-sub' }, [where, statusText(status, at)].filter(Boolean).join(' · ')),
        el('p', { class: 'today' }, ...dayLineParts(day, at)),
        old.stale ? el('p', { class: 'stale-note' }, `⚠ 마지막 확인 ${old.label} · 운영시간이 바뀌었을 수 있어요`) : null,
        el('div', { class: 'tags' },
          ...breakRanges(wall, at).map((r) => el('span', { class: 'tag brk' }, `휴게 ${formatRanges([r])}`)), // as on the map card
          el('span', { class: `tag pk ${parking.tone}` }, parking.text),
          ...(wall.tags ?? []).map((t) => el('span', { class: 'tag' }, t))),
        wall.parking?.note ? el('p', { class: 'pnote' }, el('b', {}, '주차'), ' ', wall.parking.note) : null),
      sunBox(dial, wall.name, day.closed)),
    go ? el('div', { class: 'acts' }, go) : null,
    more,
  ];
}

let rowSeq = 0;
function timeRow(row, at) {
  const { wall, status } = row;
  const bar = rowBar(wall, status, at); // "내일 10:00 오픈" draws tomorrow's hours, without a now tick
  const id = `row-x-${++rowSeq}`;
  const isOpen = openName === wall.name;
  const meta = [wall.region, row.distanceKm != null ? formatDistance(row.distanceKm) : null].filter(Boolean).join(' · ');
  const tick = bar.ahead ? null : el('span', { class: 'tick' });
  tick?.style.setProperty('left', axisX(bar.nowMin));
  // 양달/응달/방향 모름 in words, not only the orange band; a wall without hours gets no empty bar
  const sun = sunTag(row);
  const btn = el('button', { type: 'button', class: 'row-btn', 'aria-expanded': String(isOpen), 'aria-controls': id },
    el('span', { class: 'l1' },
      el('span', { class: 'rname' }, shortName(wall)),
      sun ? el('span', { class: `sunnow ${sun.tone}` }, sun.tone === 'sun' ? el('span', { 'aria-hidden': 'true' }, '☀ ') : null, sun.text) : null,
      meta ? el('span', { class: 'rmeta' }, meta) : null,
      el('span', { class: 'left' }, rowLeft(status, at))),
    status.state === 'unknown' ? null : el('span', { class: 'bar', role: 'img', 'aria-label': bar.label },
      ...barSegments(bar.open, bar.nowMin ?? -1).map(([a, b, past]) => span(past ? 'seg past' : 'seg', a, b)),
      ...(bar.sun ?? []).filter(([a, b]) => axisFrac(b) > axisFrac(a)).map(([a, b]) => span('sunband', a, b)),
      tick));
  // Only the row that stays open across a re-render is filled now; it is created open, so no transition plays.
  const inner = el('div', { class: 'expand-in' }, ...(isOpen ? rowDetails(row, at, id) : []));
  const li = el('li', { class: `row ${status.state}${endingSoon(row) ? ' soon' : ''}${isOpen ? ' is-open' : ''}` },
    btn, el('div', { class: 'expand', id }, inner));
  li.fill = () => inner.childElementCount || inner.append(...rowDetails(row, at, id).filter(Boolean));
  li.wallName = wall.name;
  li.state = status.state;
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
}

// One row open at a time.
function toggleRow(li) {
  const opening = !li.classList.contains('is-open');
  for (const o of document.querySelectorAll('#panel-list .row.is-open')) setRowOpen(o, false);
  openName = opening ? li.wallName : null;
  openState = opening ? li.state : null;
  moreOpen = false;
  if (!opening) return;
  li.fill();
  setRowOpen(li, true);
  // opened near the foot of the screen: the details would appear below the fold, so bring the row up
  const btn = li.querySelector('.row-btn');
  if (btn.getBoundingClientRect().top > innerHeight * 0.6) btn.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

// ---- render ----
const minuteOf = (d) => d.getHours() * 60 + d.getMinutes();

// Before 06:00 or after 23:30 the slider rests at its end, but the time used (and shown) stays the real clock.
function syncClock(now) {
  if (!live) return;
  $('date').value = ymd(now);
  $('time').value = String(sliderValue(minuteOf(now)));
}

function pickedAt(now) {
  if (!live) return new Date(`${$('date').value}T${fmtMin(Number($('time').value))}`);
  const d = new Date(now);
  d.setSeconds(0, 0);
  return d;
}

function setBand(summary, label, n) {
  summary.replaceChildren(el('span', {}, label), el('span', { class: 'count' }, String(n)));
}

function render() {
  const now = new Date(); // one clock reading per render
  syncClock(now);
  const at = pickedAt(now);
  // An emptied date input (e.g. iOS "Clear") keeps the previous list but always offers the way back.
  $('nowBtn').hidden = live && !Number.isNaN(+at);
  if (Number.isNaN(+at)) return;
  if (loadFailed) { // never show "0 open" for a list that did not load
    $('summary').dataset.key = 'load-failed';
    $('summary').textContent = '외벽 목록을 불러오지 못했어요';
    return;
  }
  const isNow = live; // same decision that just set the inputs, so a minute rollover can't flip the wording
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
  const parkOnly = ui.parkingOnly && canPark;
  let rows = buildList(state.walls, at, { minHours: Number(ui.minHours), withBreaks: ui.withBreaks });
  const openTotal = rows.filter((r) => r.status.state === 'open').length;
  if (parkOnly) rows = rows.filter((r) => hasParking(r.wall));
  const all = withDistance(filterRows(rows, ui.sun), origin);
  shown = { rows: all, at };
  // the open row was filtered out, or moved to another group (e.g. now closed, folded away): forget it
  if (openName && !all.some((r) => r.wall.name === openName && r.status.state === openState)) {
    openName = null;
    moreOpen = false;
  }
  const groups = groupRows(all);
  const needOrigin = ui.sortMode === 'distance' && !origin;
  const open = sortRows(groups.open, needOrigin ? 'time' : ui.sortMode);

  for (const [id, on] of [['sunOnly', ui.sun === 'sun'], ['shadeOnly', ui.sun === 'shade'],
    ['longOnly', ui.minHours !== '0'], ['nearFirst', ui.sortMode === 'distance'], ['parkingOnly', ui.parkingOnly], ['withBreaks', ui.withBreaks]]) {
    $(id).setAttribute('aria-pressed', String(on));
  }
  // the chip and the sheet share one value: the chip names it (3·5·8시간+)
  $('longOnly').textContent = `${ui.minHours === '0' ? '3' : ui.minHours}시간+`;
  // the sheet's button counts what only the sheet shows (parking, 휴게 합산), not the 3·5·8시간+ chip again
  const sheetOn = sheetCount(ui, parkOnly);
  $('moreFilters').classList.toggle('on', sheetOn > 0);
  $('moreFilters').textContent = sheetOn ? `조건 ${sheetOn} ▾` : '조건 ▾';

  const n = open.length;
  // another day names the day (the live region is read without the date input)
  const lead = summaryLead(at, now, isNow);
  const key = `${lead}${n}`;
  if ($('summary').dataset.key !== key) { // live region: only on change
    $('summary').dataset.key = key;
    $('summary').replaceChildren(lead, el('b', { class: n ? null : 'zero' }, String(n)), '곳에서 탈 수 있어요');
  }
  $('sub').textContent = `${DAY_KO[at.getDay()]}요일${origin ? ' · 직선거리' : ''}`; // the date input shows the rest

  $('label-open').textContent = isNow ? '지금 열려 있는 곳' : '이 시각에 열려 있는 곳';
  $('countOpen').textContent = String(n);
  const emptyMsg = document.querySelector('#group-open .empty');
  emptyMsg.hidden = n > 0;
  // the filters hid every open wall: offer the way back right here
  const f = { sun: ui.sun, minHours: ui.minHours, parkOnly };
  // replaceChildren(null) would print "null": only real nodes go in
  emptyMsg.replaceChildren(...[emptyText(f, openTotal, isNow),
    filtersActive(f, openTotal) ? el('button', { type: 'button', class: 'clear-filters' }, '조건 지우기') : null].filter(Boolean));
  rowSeq = 0;
  $('rows-open').replaceChildren(...open.map((r) => safeRow(r, at)));

  $('group-closed').hidden = !groups.closed.length;
  setBand($('group-closed').querySelector('summary'), isNow ? '지금은 닫힌 곳' : '이 시각에는 닫힌 곳', groups.closed.length);
  $('rows-closed').replaceChildren(...groups.closed.map((r) => safeRow(r, at)));

  $('group-unknown').hidden = !groups.unknown.length;
  setBand($('group-unknown').querySelector('summary'), '운영시간을 아직 몰라요', groups.unknown.length);
  $('rows-unknown').replaceChildren(...groups.unknown.map((r) => safeRow(r, at)));

  const msg = locateNote || (needOrigin ? '내 위치를 먼저 확인해 주세요.' : '');
  $('locateMsg').textContent = msg;
  $('locateMsg').hidden = !msg;

  const { pins, unlocated } = mapPins(all);
  $('map-empty').hidden = mapFailed || pins.length > 0;
  $('map-note').textContent = `위치 정보 없음 ${unlocated.length}곳 · ${unlocated.join(', ')}`;
  $('map-note').hidden = !unlocated.length;
  mapApi?.setRows(all, at);
}

// ---- map tab ----
function showPin(row, fromClick) {
  const box = $('pin-card');
  if (!row) return box.replaceChildren();
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
  mapApi.setUser(origin);
  mapApi.refresh(); // measure the now-visible container before fitting
  mapApi.fitAll();
}

const tabs = ['list', 'map'];
function showTab(key, focus = false) {
  ui.tab = key;
  saveUi();
  for (const k of tabs) {
    const t = $(`tab-${k}`);
    t.setAttribute('aria-selected', String(k === key));
    t.tabIndex = k === key ? 0 : -1;
    $(`panel-${k}`).hidden = k !== key;
  }
  if (focus) $(`tab-${key}`).focus();
  if (key === 'map') openMap();
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
for (const k of ['minHours', 'sortMode']) sheetForm.elements[k].value = ui[k];

const setUi = (k, v) => {
  ui[k] = v;
  if (k === 'minHours' || k === 'sortMode') sheetForm.elements[k].value = v;
  if (k === 'sortMode') locateNote = '';
  saveUi();
  render();
};

$('search').addEventListener('submit', (e) => e.preventDefault());
$('search').addEventListener('input', (e) => {
  if (e.target.id !== 'date' && e.target.id !== 'time') return;
  live = isLivePick($('date').value, Number($('time').value), new Date());
  render();
});
$('nowBtn').addEventListener('click', () => {
  live = true;
  render();
});
$('sunOnly').addEventListener('click', () => setUi('sun', ui.sun === 'sun' ? 'any' : 'sun'));
$('shadeOnly').addEventListener('click', () => setUi('sun', ui.sun === 'shade' ? 'any' : 'shade'));
$('longOnly').addEventListener('click', () => setUi('minHours', ui.minHours !== '0' ? '0' : '3'));
$('nearFirst').addEventListener('click', () => {
  if (ui.sortMode === 'distance') return setUi('sortMode', 'time');
  setUi('sortMode', 'distance');
  if (!origin) locate();
});

$('moreFilters').addEventListener('click', () => sheet.showModal());
document.querySelector('#group-open .empty').addEventListener('click', (e) => {
  if (!e.target.closest('.clear-filters')) return;
  Object.assign(ui, { sun: 'any', minHours: '0', parkingOnly: false });
  sheetForm.elements.minHours.value = '0';
  saveUi();
  render();
  $('sunOnly').focus(); // the button is gone; land on the first filter
});

// The date + slider stick to the top while the list scrolls (the filter row above them scrolls away: a
// negative sticky top), unless even that would take over a short screen (landscape phone, large text):
// then all of it scrolls away as before. The timetable axis sticks just below.
const controls = $('search');
const fitSticky = () => {
  const box = controls.getBoundingClientRect();
  const off = Math.max(0, controls.querySelector('.scrub').getBoundingClientRect().top - box.top - 4);
  const h = box.height - off;
  const axisH = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.625; // .axis height, sticks below
  const stick = h + axisH <= innerHeight * 0.3;
  controls.classList.toggle('unstuck', !stick);
  controls.style.top = stick ? `${-off}px` : '';
  document.documentElement.style.setProperty('--stick-h', `${stick ? h : 0}px`);
};
new ResizeObserver(fitSticky).observe(controls);
addEventListener('resize', fitSticky);
fitSticky();
sheet.addEventListener('click', (e) => e.target === sheet && sheet.close()); // the dialog has no padding: only the backdrop hits it
sheet.addEventListener('change', (e) => {
  if (e.target.name === 'minHours' || e.target.name === 'sortMode') setUi(e.target.name, e.target.value);
});
$('parkingOnly').addEventListener('click', () => setUi('parkingOnly', !ui.parkingOnly));
$('withBreaks').addEventListener('click', () => setUi('withBreaks', !ui.withBreaks));

for (const k of tabs) $(`tab-${k}`).addEventListener('click', () => showTab(k));
document.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
  const i = tabs.indexOf(ui.tab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  showTab(tabs[(next + tabs.length) % tabs.length], true);
});

function locate() {
  if (!window.isSecureContext || !navigator.geolocation) {
    locateNote = window.isSecureContext
      ? '이 브라우저는 위치를 지원하지 않아요.'
      : '이 주소(http)에서는 내 위치를 쓸 수 없어요. https 주소에서 열어 주세요.';
    return render();
  }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      origin = { lat: p.coords.latitude, lng: p.coords.longitude };
      ui.sortMode = 'distance';
      sheetForm.elements.sortMode.value = 'distance';
      saveUi();
      locateNote = '내 위치를 기준으로 가까운 순으로 정렬했어요. 직선거리예요.';
      render();
      mapApi?.setUser(origin);
    },
    (err) => {
      locateNote = err.code === 1
        ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.'
        : '위치를 가져오지 못했어요. 잠시 뒤 다시 시도해 주세요.';
      render();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  );
}
$('locate').addEventListener('click', locate);

document.querySelector('main').addEventListener('click', (e) => {
  const b = e.target.closest('.cards button[data-act], .rows button[data-act]');
  if (b && (canEdit || b.dataset.act === 'report')) document.dispatchEvent(new CustomEvent(`wall:${b.dataset.act}`, { detail: b.dataset.name }));
  const rb = e.target.closest('.row-btn');
  if (rb) toggleRow(rb.parentElement);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
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

onChange(render);
// Live mode follows the clock. The minute tick skips while the map card's "자세히" is open, or while focus
// sits on something the re-render would replace and can't be matched again: the map card (its close button
// too) and "조건 지우기". Focus in a list row goes back to the same control of the same row, without scrolling.
const FOCUSABLE = 'button, a, summary';
const tick = () => {
  const a = document.activeElement;
  if (!live || document.hidden || document.querySelector('.more[open]') || a?.closest('#pin-card, .clear-filters')) return;
  const li = a?.closest('.rows .row');
  const i = li ? [...li.querySelectorAll(FOCUSABLE)].indexOf(a) : -1;
  render();
  if (!li) return;
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

$('retry').addEventListener('click', async () => {
  $('retry').disabled = true;
  const list = await loadList();
  $('retry').disabled = false;
  if (!list) return;
  state.walls = list;
  showLoadError(false);
  render();
});

const first = await loadList();
state.walls = first ?? [];
showLoadError(!first);
render();
showTab(ui.tab === 'map' ? 'map' : 'list');
