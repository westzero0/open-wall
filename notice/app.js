// notice/app.js — 외벽 관리자 공지 도구 화면. 템플릿 라디오 + 날짜 선택 → 이미지·제목·본문·캡션이 바로 바뀐다.
import { holidayName } from '../src/holidays.js';
import { openIntervals } from '../src/hours.js';
import { nearWalls } from '../src/near-walls.js';
import { GUST_STRONG, forecastUrl, parseCurrent, skyWet } from '../src/weather.js';
import { wallPosition } from '../src/viewmodel.js';
import { pictureBlob, saveFile, shareInvite, shareSay } from '../src/share-image.js';
import { DAY_KO } from '../src/time.js';
import { drawNoticeCard } from './card.js';
import { CLOSINGS, KINDS, REASON_CHIPS, STATUSES, buildNotice, holidayCandidates } from './model.js';
import { reflect, reflectReady } from './reflect.js';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const monthOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } },
};

const now = new Date();
const todayStr = () => `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;
const nowHHMM = () => `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
const st = {
  wall: '', kind: 'today', status: null, date: '', at: '', until: '', alts: [], month: monthOf(new Date(now.getFullYear(), now.getMonth() + 1, 1)), // 공지는 보통 다음 달 것
  dates: [], reasons: {}, reason: '', open: '10:00', close: '16:00', note: '',
  closing: 'formal', sign: '', accent: '#0a7fc8',
};
let walls = [];
let altNames = new Set(); // 대체 외벽으로 체크된 이름
let nearList = [];
const wxCache = new Map();
let blob = null;
let token = 0;

const lockedWall = new URLSearchParams(location.search).get('wall'); // 외벽 전용 링크: ?wall=은평인공암벽장
const wallInfo = () => walls.find((w) => w.name === st.wall);

const prefKey = () => `notice-prefs:${st.wall}`;
function loadPrefs() {
  const p = store.get(prefKey());
  if (p) Object.assign(st, { closing: p.closing ?? st.closing, sign: p.sign ?? '', accent: p.accent ?? st.accent });
  else Object.assign(st, { sign: '' });
}
const savePrefs = () => store.set(prefKey(), { closing: st.closing, sign: st.sign, accent: st.accent });

// 월별 공휴일 휴관: 이 외벽이 공휴일에 쉬는 곳('closed')이면 그 달의 공휴일을 미리 체크해 둔다.
function autoFill() {
  if (st.kind !== 'holiday') return;
  const closed = wallInfo()?.holiday === 'closed';
  st.dates = closed ? holidayCandidates(st.month).map((c) => c.date) : [];
}

function renderCalendar() {
  const [y, m] = st.month.split('-').map(Number);
  $('monthLabel').textContent = `${y}년 ${m}월`;
  const first = new Date(y, m - 1, 1);
  const cells = [];
  DAY_KO.forEach((d, i) => cells.push(Object.assign(document.createElement('div'), { className: `dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`, textContent: d })));
  for (let i = 0; i < first.getDay(); i += 1) cells.push(document.createElement('div'));
  for (let d = 1; new Date(y, m - 1, d).getMonth() === m - 1; d += 1) {
    const dt = new Date(y, m - 1, d);
    const date = `${y}-${pad(m)}-${pad(d)}`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day';
    b.dataset.date = date;
    const hn = holidayName(dt);
    if (hn) b.classList.add('holiday');
    if (dt.getDay() === 0) b.classList.add('sun');
    if (st.dates.includes(date)) b.classList.add('on');
    b.setAttribute('aria-pressed', String(st.dates.includes(date)));
    b.append(Object.assign(document.createElement('span'), { textContent: d }));
    if (hn) b.append(Object.assign(document.createElement('small'), { textContent: hn.replace(/^대체공휴일\((.*)\)$/, '대체·$1') }));
    cells.push(b);
  }
  $('cal').replaceChildren(...cells);
}

function renderForm() {
  $('kinds').querySelectorAll('input').forEach((i) => { i.checked = i.value === st.kind; });
  $('todaySec').hidden = st.kind !== 'today';
  $('calSec').hidden = st.kind === 'today';
  $('reasonBox').hidden = st.kind === 'holiday' || st.kind === 'today';
  $('hoursBox').hidden = st.kind !== 'hours';
  $('reason').value = st.reason;
  $('open').value = st.open;
  $('close').value = st.close;
  $('note').value = st.note;
  $('sign').value = st.sign;
  $('accent').value = st.accent;
  $('closings').querySelectorAll('input').forEach((i) => { i.checked = i.value === st.closing; });
  const closed = wallInfo()?.holiday;
  $('calHint').textContent = st.kind === 'holiday'
    ? (closed === 'closed' ? '이 외벽은 공휴일에 쉬는 곳으로 등록돼 있어서, 이 달의 공휴일을 미리 골라 뒀어요. 틀린 날은 눌러서 빼 주세요.'
      : '이 달의 공휴일(색 표시)을 눌러 휴관일을 골라 주세요. 쉬지 않는 날은 고르지 마세요.')
    : '쉬는 날(또는 시간이 바뀌는 날)을 눌러 고르세요. 여러 날, 여러 달도 돼요.';
  $('chips').replaceChildren(...REASON_CHIPS.map((r) => Object.assign(document.createElement('button'), { type: 'button', className: 'chip', textContent: r, onclick: () => { st.reason = r; $('reason').value = r; update(); } })));
  renderStatus();
  renderUntil();
  renderCalendar();
}

function renderStatus() {
  $('statusBtns').replaceChildren(...Object.entries(STATUSES).map(([k, v]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sbtn';
    b.style.setProperty('--c', v.tone);
    b.textContent = v.label;
    b.setAttribute('aria-pressed', String(st.status === k));
    b.onclick = () => pickStatus(k);
    return b;
  }));
  const withAlt = STATUSES[st.status]?.alt;
  $('altBox').hidden = !withAlt || nearList.length === 0;
  $('altList').replaceChildren(...nearList.map((a) => {
    const l = document.createElement('label');
    const i = Object.assign(document.createElement('input'), { type: 'checkbox', checked: altNames.has(a.name) });
    i.onchange = () => { if (i.checked) altNames.add(a.name); else altNames.delete(a.name); syncAlts(); update(); };
    l.append(i, ` ${a.name} · 직선 ${a.km < 10 ? Math.round(a.km * 10) / 10 : Math.round(a.km)}km`);
    return l;
  }));
}

function syncAlts() {
  st.alts = nearList.filter((a) => altNames.has(a.name)).map(({ name, km, venue }) => ({ name, km, venue }));
}

// 가까운 다른 외벽: 이 외벽 자신은 빼고 가까운 순(비·강풍이면 실내가 있는 곳 먼저)
function refreshNear() {
  const w = wallInfo();
  const pos = w && wallPosition(w);
  nearList = pos ? nearWalls(walls, pos, { limit: 4, indoorFirst: st.status === 'rain' || st.status === 'wind' }).filter((x) => x.name !== st.wall).slice(0, 3) : [];
  altNames = new Set(nearList.slice(0, 2).map((x) => x.name));
  syncAlts();
}

const hhmm = (min) => `${pad(Math.floor(Math.min(min, 1439) / 60))}:${pad(Math.min(min, 1439) % 60)}`;

// 오늘 운영 종료 시각('HH:MM'): 지금 열려 있으면 그 구간의 끝, 아직 안 열렸으면 다음 구간의 끝. 정보가 없거나 쉬는 날이면 ''.
function closeToday() {
  const w = wallInfo();
  if (!w) return '';
  const d = new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  const spans = openIntervals(w, d);
  const hit = spans.find(([s, e]) => mins >= s && mins < e) ?? spans.find(([s]) => s > mins);
  return hit ? hhmm(hit[1]) : '';
}

function renderUntil() {
  const timed = STATUSES[st.status]?.timed;
  $('untilBox').hidden = !timed;
  if (!timed) return;
  $('until').value = st.until;
  const close = closeToday();
  $('untilHint').textContent = !st.until ? '시각을 비우면 "오늘 하루"로 안내해요.'
    : st.until <= st.at ? '이미 지난 시각이에요. 지금보다 늦은 시각으로 바꿔 주세요.'
      : `${close && st.until === close ? '오늘 운영 종료 시각까지로 잡혀 있어요. ' : ''}자리가 나면 아래 "다시 이용 가능"을 눌러 바로 풀 수 있어요.`;
  $('untilChips').replaceChildren(...[['1시간 뒤', 60], ['2시간 뒤', 120]].map(([label, add]) => {
    const d = new Date();
    return Object.assign(document.createElement('button'), { type: 'button', className: 'chip', textContent: label, onclick: () => { st.until = hhmm(d.getHours() * 60 + d.getMinutes() + add); renderUntil(); update(); } });
  }), ...(close ? [Object.assign(document.createElement('button'), { type: 'button', className: 'chip', textContent: `운영 종료(${close})까지`, onclick: () => { st.until = close; renderUntil(); update(); } })] : []));
}

function pickStatus(k) {
  st.status = k;
  st.date = todayStr();
  st.at = nowHHMM();
  st.until = STATUSES[k].timed ? closeToday() : '';
  refreshNear();
  renderStatus();
  renderUntil();
  update();
}

// 지금 날씨 제안: 비·강풍이 잡히면 버튼으로 권한다(자동으로 올리지 않는다). 실패하면 조용히 넘어간다.
async function checkWeather() {
  const box = $('wxHint');
  box.hidden = true;
  const w = wallInfo();
  const pos = w && wallPosition(w);
  if (!pos || st.kind !== 'today') return;
  const name = st.wall;
  let cur = wxCache.get(name);
  if (!cur || Date.now() - cur.at > 10 * 60e3) {
    try {
      const r = await fetch(forecastUrl(pos.lat, pos.lng));
      cur = { at: Date.now(), now: r.ok ? parseCurrent(await r.json()) : null };
    } catch { cur = { at: Date.now(), now: null }; }
    wxCache.set(name, cur);
  }
  if (name !== st.wall || !cur.now) return;
  const raining = skyWet(cur.now.c), windy = cur.now.g >= GUST_STRONG;
  if (!raining && !windy) return;
  const pick = raining ? 'rain' : 'wind';
  box.replaceChildren(
    document.createTextNode(`지금 ${raining ? '비가 오는 것으로' : `강한 바람(돌풍 ${Math.round(cur.now.g)}m/s)이`} 감지돼요(${cur.now.hhmm} 기준). ${STATUSES[pick].label}로 알릴까요?`),
    document.createElement('br'),
    Object.assign(document.createElement('button'), { type: 'button', className: 'btn', textContent: `${STATUSES[pick].label}로 알리기`, onclick: () => pickStatus(pick) }),
  );
  box.hidden = false;
}

const copyTargets = { copyTitle: 'outTitle', copyBody: 'outBody', copyCaption: 'outCaption' };
async function copy(id, btn) {
  const text = $(id).value;
  try { await navigator.clipboard.writeText(text); } catch { $(id).select(); document.execCommand('copy'); }
  const prev = btn.textContent;
  btn.textContent = '복사했어요';
  setTimeout(() => { btn.textContent = prev; }, 1400);
}

async function update() {
  if (st.kind === 'today' && st.date && st.date !== todayStr()) { st.status = null; st.date = ''; st.at = ''; st.until = ''; renderStatus(); renderUntil(); } // 어제의 상태는 오늘 남지 않는다
  const n = buildNotice(st);
  const mine = ++token;
  $('outTitle').value = n.title;
  $('outBody').value = n.body;
  $('outCaption').value = n.caption;
  $('patch').textContent = n.patch ? JSON.stringify(n.patch, null, 2) : '날짜를 고르면 해벽에 반영될 내용이 여기에 나와요.';
  $('empty').hidden = n.ok;
  $('empty').textContent = st.kind === 'today' ? '지금 상태를 누르면 이미지가 만들어져요.' : '날짜를 고르면 이미지가 만들어져요.';
  ['qShare', 'qCopy'].forEach((id) => { $(id).disabled = !n.ok; });
  ['saveImg', 'reflectBtn'].forEach((id) => { $(id).disabled = !n.ok; });
  $('reflectBtn').disabled = !n.ok || !reflectReady();
  $('reflectNote').textContent = reflectReady() ? '' : '해벽 반영은 아직 서버가 연결되지 않아서 꺼져 있어요. 반영될 내용만 미리 보여 드려요.';
  $('hoursNote').hidden = st.kind !== 'hours';
  const canvas = $('card');
  await drawNoticeCard(canvas, n, { accent: st.accent });
  if (mine !== token) return;
  blob = n.ok ? await new Promise((ok) => canvas.toBlob(ok, 'image/png')) : null;
}

let timer;
const later = () => { clearTimeout(timer); timer = setTimeout(update, 80); };

function bind() {
  $('kinds').addEventListener('change', (e) => { st.kind = e.target.value; if (st.kind === 'holiday') autoFill(); else st.dates = []; renderForm(); update(); checkWeather(); });
  $('prev').onclick = () => shiftMonth(-1);
  $('next').onclick = () => shiftMonth(1);
  $('cal').addEventListener('click', (e) => {
    const b = e.target.closest('.day');
    if (!b) return;
    const i = st.dates.indexOf(b.dataset.date);
    if (i >= 0) st.dates.splice(i, 1); else st.dates.push(b.dataset.date);
    renderCalendar();
    update();
  });
  $('until').oninput = (e) => { st.until = e.target.value; renderUntil(); later(); };
  $('reason').oninput = (e) => { st.reason = e.target.value; later(); };
  $('open').oninput = (e) => { st.open = e.target.value; later(); };
  $('close').oninput = (e) => { st.close = e.target.value; later(); };
  $('note').oninput = (e) => { st.note = e.target.value; later(); };
  $('sign').oninput = (e) => { st.sign = e.target.value; savePrefs(); later(); };
  $('accent').oninput = (e) => { st.accent = e.target.value; savePrefs(); later(); };
  $('closings').addEventListener('change', (e) => { st.closing = e.target.value; savePrefs(); update(); });
  $('wallSel').onchange = (e) => { pickWall(e.target.value); };
  Object.entries(copyTargets).forEach(([btn, out]) => { $(btn).onclick = () => copy(out, $(btn)); });
  const share = () => {
    if (!blob) return;
    const n = buildNotice(st);
    const r = shareInvite(blob, n.caption, `${n.wall}-${n.kind}.png`); // 폰은 공유 창, PC는 저장 + 캡션 복사
    r.done.then((res) => { $('shareSay').textContent = $('qSay').textContent = shareSay(res); });
  };
  $('saveImg').onclick = share;
  $('qShare').onclick = share;
  $('qCopy').onclick = () => copy('outBody', $('qCopy'));
  $('reflectBtn').onclick = async () => {
    const n = buildNotice(st);
    try { await reflect({ patch: n.patch, title: n.title, body: n.body }); $('reflectNote').textContent = '해벽에 반영했어요.'; }
    catch { $('reflectNote').textContent = '반영하지 못했어요. 잠시 뒤 다시 눌러 주세요.'; }
  };
}

function shiftMonth(delta) {
  const [y, m] = st.month.split('-').map(Number);
  st.month = monthOf(new Date(y, m - 1 + delta, 1));
  autoFill();
  renderForm();
  update();
}

function pickWall(name) {
  st.wall = name;
  loadPrefs();
  autoFill();
  st.status = null; st.date = ''; st.at = ''; st.until = '';
  refreshNear();
  renderForm();
  update();
  checkWeather();
}

async function init() {
  try { walls = (await (await fetch('../data/national.json')).json()).walls ?? []; } catch { walls = []; }
  const names = walls.map((w) => w.name);
  const sel = $('wallSel');
  sel.replaceChildren(...names.map((n) => Object.assign(document.createElement('option'), { value: n, textContent: n })));
  if (lockedWall && names.includes(lockedWall)) { sel.value = lockedWall; sel.disabled = true; $('lockNote').hidden = false; }
  $('kinds').replaceChildren(...Object.entries(KINDS).map(([k, v]) => {
    const l = document.createElement('label');
    const i = Object.assign(document.createElement('input'), { type: 'radio', name: 'kind', value: k });
    l.append(i, ` ${v.label}`);
    return l;
  }));
  $('closings').replaceChildren(...Object.entries(CLOSINGS).map(([k, v]) => {
    const l = document.createElement('label');
    l.append(Object.assign(document.createElement('input'), { type: 'radio', name: 'closing', value: k }), ` ${v.label}`);
    return l;
  }));
  bind();
  pickWall(sel.value || names[0] || '');
}

init();
