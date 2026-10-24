// notice/app.js — 외벽 관리자 공지 도구 화면. 템플릿 라디오 + 날짜 선택 → 이미지·제목·본문·캡션이 바로 바뀐다.
import { holidayName } from '../src/holidays.js';
import { pictureBlob, saveFile, shareInvite, shareSay } from '../src/share-image.js';
import { DAY_KO } from '../src/time.js';
import { drawNoticeCard } from './card.js';
import { CLOSINGS, KINDS, REASON_CHIPS, buildNotice, holidayCandidates } from './model.js';
import { reflect, reflectReady } from './reflect.js';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const monthOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } },
};

const now = new Date();
const st = {
  wall: '', kind: 'holiday', month: monthOf(new Date(now.getFullYear(), now.getMonth() + 1, 1)), // 공지는 보통 다음 달 것
  dates: [], reasons: {}, reason: '', open: '10:00', close: '16:00', note: '',
  closing: 'formal', sign: '', accent: '#0a7fc8',
};
let walls = [];
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
  $('reasonBox').hidden = st.kind === 'holiday';
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
  renderCalendar();
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
  const n = buildNotice(st);
  const mine = ++token;
  $('outTitle').value = n.title;
  $('outBody').value = n.body;
  $('outCaption').value = n.caption;
  $('patch').textContent = n.patch ? JSON.stringify(n.patch, null, 2) : '날짜를 고르면 해벽에 반영될 내용이 여기에 나와요.';
  $('empty').hidden = n.ok;
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
  $('kinds').addEventListener('change', (e) => { st.kind = e.target.value; if (st.kind === 'holiday') autoFill(); else st.dates = []; renderForm(); update(); });
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
  $('reason').oninput = (e) => { st.reason = e.target.value; later(); };
  $('open').oninput = (e) => { st.open = e.target.value; later(); };
  $('close').oninput = (e) => { st.close = e.target.value; later(); };
  $('note').oninput = (e) => { st.note = e.target.value; later(); };
  $('sign').oninput = (e) => { st.sign = e.target.value; savePrefs(); later(); };
  $('accent').oninput = (e) => { st.accent = e.target.value; savePrefs(); later(); };
  $('closings').addEventListener('change', (e) => { st.closing = e.target.value; savePrefs(); update(); });
  $('wallSel').onchange = (e) => { pickWall(e.target.value); };
  Object.entries(copyTargets).forEach(([btn, out]) => { $(btn).onclick = () => copy(out, $(btn)); });
  $('saveImg').onclick = () => {
    if (!blob) return;
    const n = buildNotice(st);
    const r = shareInvite(blob, n.caption, `${n.wall}-${n.kind}.png`); // 폰은 공유 창, PC는 저장 + 캡션 복사
    r.done.then((res) => { $('shareSay').textContent = shareSay(res); });
  };
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
  renderForm();
  update();
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
