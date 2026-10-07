import { buildList } from './listing.js';
import { DAY_KO, hhmm, ymd } from './time.js';
import { loadWalls, normalizeWall, parseJson } from './store.js';
import { state, storage, onChange } from './state.js';
import { config } from './config.js';
import { createMap } from './map.js';
import {
  dayBar, endingSoon, formatDistance, groupRows, hasParking, mapPins, nextOpening, parkingLabel,
  photoSrc, placeholderText, sortRows, staleness, wallPosition, withDistance,
} from './viewmodel.js';

const $ = (id) => document.getElementById(id);
const UI_KEY = 'open-wall:ui';

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false));
  return e;
};
const safeUrl = (u) => (/^https?:\/\//i.test(u ?? '') ? u : null);
const pct = (min) => `${(min / 1440) * 100}%`;
const dayText = (d) => `${d.getMonth() + 1}/${d.getDate()}(${DAY_KO[d.getDay()]})`;
const whenText = (d, base) => (ymd(d) === ymd(base) ? hhmm(d) : `${dayText(d)} ${hhmm(d)}`);

// ---- UI state: filters persist in localStorage, location stays in memory ----
const ui = { minHours: '0', sun: 'any', parkingOnly: false, sortMode: 'time', tab: 'list' };
try {
  Object.assign(ui, JSON.parse(storage.getItem(UI_KEY)) ?? {});
} catch { /* bad JSON or no storage: defaults */ }
const saveUi = () => {
  try {
    storage.setItem(UI_KEY, JSON.stringify(ui));
  } catch { /* storage full or blocked: keep in memory */ }
};
let origin = null; // {lat, lng} after "내 위치"
let locateNote = '';
let live = true; // date/time follow the clock until the user picks another moment
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

function dayBarBlock(wall, at) {
  const bar = dayBar(wall, at);
  const now = el('span', { class: 'now' });
  now.style.left = pct(bar.nowMin);
  return el('div', { class: 'daybar-wrap' },
    el('div', { class: 'daybar', role: 'img', 'aria-label': bar.label },
      el('div', { class: 'track open-track' }, ...segments('seg', bar.open)),
      bar.sun ? el('div', { class: 'track sun-track' }, ...segments('seg', bar.sun)) : null,
      now),
    el('div', { class: 'ticks', 'aria-hidden': 'true' },
      ...[0, 6, 12, 18, 24].map((t) => el('span', {}, String(t)))),
    bar.sun ? null : el('p', { class: 'nosun' }, '해 정보 없음'));
}

function sunNote(row) {
  if (row.lit === null) return '벽 방향 미입력';
  const label = row.lit ? '☀ 볕 듦' : row.reason === 'terrain' ? '☁ 산·건물 그늘' : '☁ 그늘';
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

const rowButtons = (name, ...extra) => el('div', { class: 'row-actions' },
  el('button', { type: 'button', 'data-act': 'edit', 'data-name': name }, '수정'),
  el('button', { type: 'button', 'data-act': 'delete', 'data-name': name }, '삭제'),
  ...extra);

function more(wall) {
  const src = photoSrc(wall);
  const pos = wallPosition(wall);
  const photo = src ? el('img', { class: 'photo', src, loading: 'lazy', decoding: 'async', alt: `${wall.name} 외벽 사진` }) : null;
  photo?.addEventListener('error', () => photo.remove(), { once: true });
  return el('details', { class: 'more' },
    el('summary', {}, '자세히'),
    photo,
    wall.memo ? el('p', { class: 'memo' }, wall.memo) : null,
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
    status.state === 'unknown' ? null : dayBarBlock(wall, at),
    el('div', { class: 'chips' },
      ...(wall.tags ?? []).map((t) => el('span', { class: 'chip' }, t)),
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
      el('p', { class: 'note' }, '표시 중 오류가 발생했어요. 수정 또는 삭제해 주세요.'),
      rowButtons(name));
  }
}

// ---- render ----
function syncClock() {
  if (!live) return;
  const now = new Date();
  $('date').value = ymd(now);
  $('time').value = hhmm(now);
}

function render() {
  syncClock();
  const at = new Date(`${$('date').value}T${$('time').value}`);
  // An emptied input (e.g. iOS "Clear") keeps the previous list but always offers the way back.
  $('nowBtn').hidden = live && !Number.isNaN(+at);
  if (Number.isNaN(+at)) return;
  const isNow = live; // same decision that just set the inputs, so a minute rollover can't flip the wording

  // the stored flag is ignored (not deleted) while no wall has parking data
  const canPark = state.walls.some(hasParking);
  $('parkingOnly').hidden = !canPark;
  const parkOnly = ui.parkingOnly && canPark;
  let rows = buildList(state.walls, at, { minHours: Number(ui.minHours), sun: ui.sun });
  if (parkOnly) rows = rows.filter((r) => hasParking(r.wall));
  const all = withDistance(rows, origin);
  shown = { rows: all, at };
  const groups = groupRows(all);
  const needOrigin = ui.sortMode === 'distance' && !origin;
  const open = sortRows(groups.open, needOrigin ? 'time' : ui.sortMode);

  const n = open.length;
  const summary = isNow ? `지금 갈 수 있는 곳 ${n}곳` : `${dayText(at)} ${hhmm(at)}에 갈 수 있는 곳 ${n}곳`;
  if ($('summary').textContent !== summary) $('summary').textContent = summary; // live region: only on change
  $('countOpen').textContent = `${n}곳`;
  const emptyMsg = document.querySelector('#group-open .empty');
  emptyMsg.hidden = n > 0;
  emptyMsg.textContent = parkOnly
    ? '주차 가능한 곳 중에서는 지금 열려 있는 곳이 없어요.'
    : '지금 열려 있는 곳이 없어요. 아래 닫힌 곳에서 다음 오픈 시간을 확인해 보세요.';
  $('cards-open').replaceChildren(...open.map((r) => safeCard(r, at)));

  const next = nextOpening(groups.closed);
  $('group-closed').hidden = !groups.closed.length;
  $('group-closed').querySelector('summary').textContent =
    `닫힘 ${groups.closed.length}곳${next ? ` · ${next.wall.name} ${whenText(next.status.nextOpenAt, at)} 오픈` : ''}`;
  $('cards-closed').replaceChildren(...groups.closed.map((r) => safeCard(r, at)));

  $('group-unknown').hidden = !groups.unknown.length;
  $('group-unknown').querySelector('summary').textContent = `운영시간 모름 ${groups.unknown.length}곳`;
  $('cards-unknown').replaceChildren(...groups.unknown.map((r) => safeCard(r, at)));

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
  box.replaceChildren(el('ul', { class: 'cards' }, safeCard(row, shown.at)));
  if (fromClick) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
    mapApi = createMap($('map'), { onSelect: showPin, onError: mapError, onOk: mapOk });
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
for (const id of ['minHours', 'sun', 'sortMode']) {
  const def = $(id).value;
  $(id).value = ui[id];
  ui[id] = $(id).value || def; // drop stored values the select doesn't offer
  $(id).value = ui[id];
}
ui.parkingOnly = ui.parkingOnly === true;
$('parkingOnly').setAttribute('aria-pressed', String(ui.parkingOnly));

$('search').addEventListener('submit', (e) => e.preventDefault());
$('search').addEventListener('input', (e) => {
  if (e.target.id === 'date' || e.target.id === 'time') {
    const now = new Date();
    live = $('date').value === ymd(now) && $('time').value === hhmm(now);
  } else if (e.target.id in ui) {
    ui[e.target.id] = e.target.value;
    if (e.target.id === 'sortMode') locateNote = '';
    saveUi();
  }
  render();
});
$('nowBtn').addEventListener('click', () => {
  live = true;
  render();
});
$('parkingOnly').addEventListener('click', (e) => {
  ui.parkingOnly = !ui.parkingOnly;
  e.currentTarget.setAttribute('aria-pressed', String(ui.parkingOnly));
  saveUi();
  render();
});

for (const k of tabs) $(`tab-${k}`).addEventListener('click', () => showTab(k));
document.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
  const i = tabs.indexOf(ui.tab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  showTab(tabs[(next + tabs.length) % tabs.length], true);
});

$('locate').addEventListener('click', () => {
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
      $('sortMode').value = 'distance';
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
});

document.querySelector('main').addEventListener('click', (e) => {
  const b = e.target.closest('.cards button[data-act]');
  if (b) document.dispatchEvent(new CustomEvent(`wall:${b.dataset.act}`, { detail: b.dataset.name }));
});

onChange(render);
// Live mode follows the clock. The minute tick skips while a "자세히" panel is open or focus is
// inside a card, because re-rendering would collapse the panel and drop focus; it catches up next tick.
const tick = () => live && !document.hidden && !document.querySelector('.more[open]')
  && !document.activeElement?.closest('.cards') && render();
setInterval(tick, 60_000);
document.addEventListener('visibilitychange', tick);

state.walls = (
  loadWalls(storage) ??
  (await fetch('data/national.json').then((r) => r.text()).then(parseJson).then((l) => l.map(normalizeWall)).catch(() => []))
).filter((w) => w.name);
render();
showTab(ui.tab === 'map' ? 'map' : 'list');
