// src/log-view.js — the 기록 tab (progress, month calendar, the picked day's records), the 기록 추가 sheet and the
// toast. Records live in this browser only (log.js); nothing here sends them anywhere.
import { el } from './dom.js';
import { ymd } from './time.js';
import { hasHours, openIntervals } from './hours.js';
import { axisFrac, formatRanges, orderForPick } from './viewmodel.js';
import { formatDistance } from './card-model.js';
import { loadFavAsked, saveFavAsked, shouldAskFav } from './favorites.js';
import { inkStamp, sunMark } from './stamp.js';
import { activityStats, loadContrib, rankOf, tiersOf } from './rank.js';
import {
  MAX_IMPORT_BYTES, TIP_AT, VISIT_FIRST, addRecord, countFor, dayParts, exportLog, loadLog, mergeLog, minuteAtFrac, monthGrid, monthSummary,
  firstVisits, normalizeLog, parseImport, recordNote, recordsByDay, removeRecord, saveLog, shiftMonth, snapVisit, timeOfMin,
  timeSpeech, validDate, visitBreaks, visitDefault, visitMax, visitStats, visitedCount,
} from './log.js';

const $ = (id) => document.getElementById(id);
const today = () => ymd(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---- toast: one line at the foot of the screen, optionally with one action (실행 취소, ♥ 추가; kept while it has focus) ----
const box = $('toast');
const msgEl = $('toast-msg');
const act = $('toast-act');
let toastTimer;
let undoFn = null;
const hideToast = () => {
  clearTimeout(toastTimer);
  if (box.contains(document.activeElement)) return; // never pull the focused button away
  box.classList.remove('on');
  msgEl.textContent = '';
  act.hidden = true;
  undoFn = null;
};
const armToast = () => {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undoFn ? 3000 : 2500);
};
export function toast(msg, undo = null, label = '실행 취소') {
  undoFn = undo;
  msgEl.textContent = msg;
  act.textContent = label;
  act.hidden = !undo;
  box.classList.add('on');
  armToast();
}
act.addEventListener('click', () => {
  const fn = undoFn;
  undoFn = null;
  act.blur();
  hideToast();
  fn?.();
});
box.addEventListener('focusin', () => clearTimeout(toastTimer));
box.addEventListener('focusout', armToast);

/**
 * createLogView({storage, getWalls, getFavs, onChange, reveal, showList, crowdAsk, sendCrowd})
 * getWalls(): the current wall list (names = the progress denominator). getFavs(): ♥ names, listed first in the picker.
 * onChange(): the log changed (list rows redraw).
 * reveal(name): open that wall's card in the list. showList(): go to the 목록 tab.
 * crowdAsk(wall, date, time) → null | canReport's {ok: false, reason, waitMin} | 'ask': whether the sheet asks how crowded that visit was (app.js).
 * sendCrowd(wall, level, date, time) → Promise<boolean>: the 혼잡도 report (app.js; the record itself stays here).
 * getRegions(): 내 지역 (picker order). getOrigin(): {lat, lng} already in memory, or null — never asks for it.
 * requestLocate() → Promise<string>: asks for the position (only from the sheet's 내 위치로 정렬); '' on success, else the reason.
 * addFav(name): ♥ a wall (the ♥ 추천 toast's button).
 */
export function createLogView({
  storage, icon = () => document.createElement('span'), getWalls, getFavs, onChange, reveal, showList, crowdAsk = () => null, sendCrowd = async () => false,
  getRegions = () => [], getOrigin = () => null, requestLocate = async () => '위치를 쓸 수 없어요.', addFav = () => {},
}) {
  const panel = $('panel-log');
  let log = loadLog(storage, today(), nowMin());
  // the calendar: the month in view, the picked day, the day that holds the grid's tab stop
  const now = new Date();
  let view = { year: now.getFullYear(), month: now.getMonth() + 1 };
  let picked = today();
  let focusDay = picked;
  let monthSay = '';
  let stamped = null; // the day a record was just added: its stamp lands with a short press, once
  let stampedWall = null; // ...and the wall, so its card's 다녀왔어요 pill gets the same press
  let rankUp = false; // that save raised the 등급: the 내 활동 seal gets the same press
  const rankNow = () => {
    const { visited, total } = visitedCount(log, getWalls().map((w) => w.name));
    return rankOf(visited, total);
  };

  const regionOf = (name) => getWalls().find((w) => w.name === name)?.region ?? '';
  const persist = () => saveLog(storage, log) || toast('이 브라우저에 저장하지 못했어요. 이번 방문 동안만 남아요.');
  // after a change: redraw the list rows and this tab, then put focus back where it was (the old button may be gone)
  const changed = (focusKey = null) => {
    onChange();
    render();
    if (focusKey && (!document.activeElement || document.activeElement === document.body)) {
      document.querySelector(`[data-focus="${focusKey}"]`)?.focus();
    }
  };

  // ---- 기록 추가 sheet ----
  const dlg = $('log-add');
  const form = dlg.querySelector('form');
  const pickSet = dlg.querySelector('.la-pick');
  const picks = dlg.querySelector('.la-picks');
  const pickErr = $('la-pick-err');
  const dateErr = $('la-date-err');
  let fixedWall = null;
  let choice = null;
  let opener = null;

  const locBtn = dlg.querySelector('.la-locate');
  const locNote = dlg.querySelector('.la-locate-note');
  // order: orderForPick (내 지역 → 최근 기록 → 기록 많은 순 → ♥ → 가까운 순/목록 순); a search only filters that order
  function drawPicks() {
    const q = form.elements.q.value.trim().normalize('NFC').toLowerCase();
    const favs = getFavs();
    const origin = getOrigin();
    locBtn.hidden = Boolean(origin);
    const walls = getWalls().filter((w) => !q || w.name.toLowerCase().includes(q) || (w.region ?? '').toLowerCase().includes(q));
    const items = orderForPick(walls, { favs, regions: getRegions(), origin, visits: visitStats(log), today: today() });
    const row = ({ wall: w, km }) => {
      const input = el('input', { type: 'radio', name: 'pick', value: w.name });
      input.checked = w.name === choice;
      return el('li', {}, el('label', {}, input,
        el('span', { class: 'pn' }, favs.includes(w.name) ? el('span', { class: 'rfav', role: 'img', 'aria-label': '즐겨찾기' }, '♥ ') : null, w.name),
        km != null ? el('span', { class: 'pd' }, formatDistance(km)) : null,
        w.region ? el('span', { class: 'pr' }, w.region) : null));
    };
    const mine = items.filter((x) => x.mine);
    const rest = items.filter((x) => !x.mine);
    const group = (label, list) => el('li', { class: 'la-grp', role: 'group', 'aria-label': label },
      el('p', { class: 'la-grp-hd', 'aria-hidden': 'true' }, label), el('ul', {}, ...list.map(row)));
    picks.replaceChildren(...(!items.length ? [el('li', { class: 'none' }, '맞는 암장이 없어요. 이름 일부로 찾아보세요.')]
      : mine.length && rest.length ? [group('내 지역', mine), group('그 밖', rest)]
        : items.map(row)));
  }
  // 내 위치로 정렬: the only place this sheet asks for the position; the answer stays in app.js memory
  locBtn.addEventListener('click', async () => {
    locBtn.disabled = true;
    locNote.hidden = false;
    locNote.textContent = '내 위치를 확인하는 중이에요…';
    const why = await requestLocate();
    locBtn.disabled = false;
    if (!dlg.open) return;
    locNote.textContent = why || '내 위치에서 가까운 순으로 정렬했어요. 직선거리예요.';
    drawPicks();
    if (!why) (picks.querySelector('input:checked') ?? picks.querySelector('input'))?.focus(); // the button is gone
  });
  // ---- 방문 시각: the wall's hours of the picked day on the 06–24 axis, and an invisible range input over them ----
  const timeIn = $('la-time-in');
  const timeSay = $('la-time-say');
  const timeNote = $('la-time-note');
  const timeErr = $('la-time-err');
  const timeClear = dlg.querySelector('.la-time-clear');
  const trk = dlg.querySelector('.vt-trk');
  const mark = dlg.querySelector('.vt-mark');
  const crowdRow = dlg.querySelector('.la-crowd');
  const crowdSentNote = dlg.querySelector('.la-crowd-sent');
  const crowdPills = [...crowdRow.querySelectorAll('.crowd-pill')];
  let visitMin = null; // minutes of the day, or null (시간 모름)
  let timeTouched = false; // set or cleared by the visitor: picking another wall keeps it
  let crowdLevel = null; // 여유/보통/혼잡 picked in the sheet, or null
  const pct = (m) => `${axisFrac(m) * 100}%`;
  const placed = (cls, a, b) => {
    const s = el('span', { class: cls });
    s.style.left = pct(a);
    s.style.width = `${(axisFrac(b) - axisFrac(a)) * 100}%`;
    return s;
  };
  dlg.querySelector('.vt-axis').append(...[6, 12, 18, 24].map((h) => {
    const s = el('span', {}, `${h}시`);
    s.style.left = pct(h * 60);
    return s;
  }));
  const sheetWall = () => fixedWall ?? choice;
  // {wall, open}: open = openIntervals of the picked day (holidays, winter, breaks applied), null without a wall or date
  function dayOpen() {
    const wall = getWalls().find((w) => w.name === sheetWall());
    const v = form.elements.date.value;
    if (!wall || !validDate(v)) return { wall, open: null };
    const p = dayParts(v);
    return { wall, open: openIntervals(wall, new Date(p.year, p.month - 1, p.day)) };
  }
  function drawDay() {
    const { wall, open } = dayOpen();
    const list = open ?? [];
    // today: the stretch after now is dimmed and can't be picked (setVisit ignores it)
    const ahead = form.elements.date.value === today() ? [placed('vt-future', visitMax(nowMin()) ?? VISIT_FIRST, 1440)] : [];
    trk.replaceChildren(...list.filter(([a, b]) => axisFrac(b) > axisFrac(a)).map(([a, b]) => placed('vt-bar', a, b)),
      ...visitBreaks(list).map(([a, b]) => placed('vt-brk', a, b)), ...ahead);
    trk.classList.toggle('off', Boolean(open) && !list.length);
    timeNote.textContent = !wall ? '암장을 고르면 그날 운영시간이 보여요.'
      : !open ? '날짜를 고르면 그날 운영시간이 보여요.'
        : !hasHours(wall) ? '운영시간 정보가 없어요. 시각은 골라도 돼요.'
          : !list.length ? '이 날은 휴무예요. 시각은 골라도 돼요.'
            : `운영 ${formatRanges(list)}`;
  }
  // the question shows only while crowdAsk says so (set up, a time, the last 7 days, not later than now)
  function drawCrowd() {
    const wall = sheetWall();
    const ask = wall && visitMin != null ? crowdAsk(wall, form.elements.date.value, timeOfMin(visitMin)) : null;
    const wait = ask && ask !== 'ask'; // reported a moment ago: the row stays, off, with the reason
    crowdRow.hidden = !ask;
    crowdSentNote.hidden = !wait;
    if (wait) crowdSentNote.textContent = { dup: '이 방문은 이미 제보했어요.', wait: `방금 보냈어요. ${ask.waitMin}분 뒤에 다시 보낼 수 있어요.`, wall: '이 외벽은 오늘 두 번 보냈어요.', cap: '오늘은 더 보낼 수 없어요.' }[ask.reason];
    if (ask !== 'ask') crowdLevel = null;
    for (const b of crowdPills) {
      b.disabled = Boolean(wait);
      b.setAttribute('aria-pressed', String(b.value === crowdLevel));
    }
  }
  function drawTime() {
    const on = visitMin != null;
    mark.hidden = !on;
    if (on) {
      mark.style.left = pct(visitMin);
      timeIn.value = String(visitMin);
    }
    timeSay.textContent = on ? `${timeOfMin(visitMin)}쯤 방문` : '시간 모름';
    timeSay.classList.toggle('unset', !on);
    timeIn.setAttribute('aria-valuetext', on ? timeSpeech(visitMin) : '시간 모름');
    timeClear.hidden = !on;
    drawCrowd();
  }
  // the default: today → half an hour ago on the half hour, moved into that day's hours; another day (or no wall
  // picked yet) → 시간 모름
  function resetTime() {
    const { open } = dayOpen();
    const now = new Date();
    visitMin = open && form.elements.date.value === today() ? visitDefault(open, now.getHours() * 60 + now.getMinutes()) : null;
    if (visitMin == null) timeIn.value = String(open?.length ? snapVisit(Math.max(open[0][0], VISIT_FIRST)) : 720); // where a key press starts
    drawTime();
  }
  const setVisit = () => {
    const v = snapVisit(Number(timeIn.value)); // 24:00 (the axis end) → 23:30
    const last = form.elements.date.value === today() ? (visitMax(nowMin()) ?? -1) : Infinity;
    if (v > last) { // after now: not a pick; the value goes back
      timeIn.value = String(visitMin ?? Math.min(720, Math.max(last, VISIT_FIRST)));
      return;
    }
    visitMin = v;
    timeTouched = true;
    timeErr.hidden = true;
    drawTime();
  };
  timeIn.addEventListener('input', setVisit); // keyboard and screen readers (the input ignores pointers: style.css)
  // Pointers: the bar itself picks the half hour under the finger (a transparent range's tap is unreliable on iOS Safari).
  // touch-action: pan-y — a vertical swipe scrolls the sheet (pointercancel, nothing picked); a tap, or a drag that goes
  // sideways first, picks. A mouse picks on press.
  const vt = dlg.querySelector('.vt');
  let drag = null; // {id, x, y, on}
  const pickAt = (x) => {
    const r = trk.getBoundingClientRect();
    const m = minuteAtFrac(r.width ? (x - r.left) / r.width : 0, nowMin(), form.elements.date.value === today());
    if (m == null) return;
    visitMin = m;
    timeTouched = true;
    timeErr.hidden = true;
    drawTime();
  };
  vt.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no compat mousedown: it would take the focus given below
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, on: e.pointerType === 'mouse' };
    vt.setPointerCapture(e.pointerId);
    timeIn.focus({ preventScroll: true });
    if (drag.on) pickAt(e.clientX);
  });
  vt.addEventListener('pointermove', (e) => {
    if (drag?.id !== e.pointerId) return;
    const dx = Math.abs(e.clientX - drag.x);
    if (!drag.on && dx > 6 && dx > Math.abs(e.clientY - drag.y)) drag.on = true;
    if (drag.on) pickAt(e.clientX);
  });
  vt.addEventListener('pointerup', (e) => {
    if (drag?.id !== e.pointerId) return;
    if (drag.on || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) <= 10) pickAt(e.clientX); // a tap
    drag = null;
  });
  vt.addEventListener('pointercancel', () => { drag = null; });
  timeClear.addEventListener('click', () => {
    visitMin = null;
    timeTouched = true;
    drawTime();
    timeIn.focus();
  });
  form.elements.date.addEventListener('change', () => {
    timeTouched = false;
    timeErr.hidden = true;
    drawDay();
    resetTime();
  });
  for (const b of crowdPills) {
    b.addEventListener('click', () => {
      crowdLevel = crowdLevel === b.value ? null : b.value; // a second press clears it
      drawCrowd();
    });
  }

  picks.addEventListener('change', (e) => {
    choice = e.target.value;
    pickErr.hidden = true;
    drawDay();
    if (timeTouched) drawCrowd();
    else resetTime();
  });
  form.elements.q.addEventListener('input', drawPicks);

  /** openAdd({wall, date, from}): wall fixed (펼친 카드의 다녀왔어요) or picked here (기록 탭); date defaults to today. */
  function openAdd({ wall = null, date = null, from = null } = {}) {
    form.reset();
    fixedWall = wall;
    choice = null;
    opener = from;
    pickSet.hidden = Boolean(wall);
    $('log-add-title').textContent = wall ?? '기록 추가';
    const t = today();
    form.elements.date.max = t;
    form.elements.date.value = date && date <= t ? date : t;
    pickErr.hidden = true;
    dateErr.hidden = true;
    timeErr.hidden = true;
    locNote.hidden = true;
    locNote.textContent = '';
    timeTouched = false;
    crowdLevel = null;
    drawDay();
    resetTime();
    if (!wall) drawPicks();
    dlg.showModal();
  }
  for (const b of dlg.querySelectorAll('[data-close]')) b.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const wall = fixedWall ?? choice;
    if (!wall) {
      pickErr.hidden = false;
      return form.elements.q.focus();
    }
    const time = visitMin == null ? '' : timeOfMin(visitMin);
    const res = addRecord(log, { wall, date: form.elements.date.value, time, memo: form.elements.memo.value }, { today: today(), id: newId(), nowMin: nowMin() });
    if (res.field === 'time') {
      timeErr.textContent = res.error;
      timeErr.hidden = false;
      return timeIn.focus();
    }
    if (res.error) {
      dateErr.textContent = res.error;
      dateErr.hidden = false;
      return form.elements.date.focus();
    }
    // asked again at save time: the question's conditions (a week back, not later than now, not sent yet) may have moved
    const level = crowdLevel && crowdAsk(wall, res.record.date, time) === 'ask' ? crowdLevel : null;
    const before = rankNow();
    log = res.log;
    const after = rankNow();
    rankUp = after.level > before.level;
    persist();
    if (!panel.hidden) { // added from the 기록 tab: show the day it went on
      picked = focusDay = res.record.date;
      const p = dayParts(picked);
      view = { year: p.year, month: p.month };
    }
    const key = opener?.dataset.focus ?? null;
    dlg.close();
    stamped = res.record.date;
    stampedWall = wall;
    changed(key);
    stamped = stampedWall = null;
    rankUp = false;
    // no 실행 취소 here: an undo could drop the record but not a 혼잡도 report already sent. A mistaken record is
    // deleted from the 기록 tab (that one keeps its undo).
    const saved = `${wall} 기록했어요${level ? ' · 혼잡도 제보 고마워요' : ''}${after.level > before.level ? ` · 등급이 올랐어요 · ${after.name}(${after.gloss})` : ''}${log.length === TIP_AT ? ` · 기록 ${TIP_AT}개 · 내 정보 › 기록 백업으로 저장해 둘 수 있어요` : ''}`;
    // ♥ 추천: on a wall's 3rd record, once per wall — the same toast, with ♥ 추가 instead of nothing. (A 등급 goes up
    // only on a wall's 1st record, so the two never meet.)
    const asked = loadFavAsked(storage);
    if (shouldAskFav(wall, countFor(log, wall), getFavs(), asked)) {
      saveFavAsked(storage, [...asked, wall]);
      toast(`${saved} · 자주 가시네요 · ♥ 즐겨찾기에 추가할까요?`, () => {
        addFav(wall);
        toast(`${wall} ♥ 즐겨찾기에 추가했어요`);
      }, '♥ 추가');
    } else toast(saved);
    if (level) {
      sendCrowd(wall, level, res.record.date, time).then((ok) => (ok ? panel.contains(document.activeElement) || render() : toast('기록은 저장했어요. 혼잡도는 보내지 못했어요 — 연결을 확인해 주세요.'))); // render: 혼잡도 제보 count
    }
  });

  // ---- backup ----
  function exportFile() {
    const url = URL.createObjectURL(new Blob([exportLog(log)], { type: 'application/json' }));
    const a = el('a', { href: url, download: `haebyeok-log-${today()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `기록 ${log.length}개를 파일로 내보냈어요.`;
  }
  // → the message to show; a refused file changes nothing
  async function importFile(file) {
    if (!file) return '';
    if (file.size > MAX_IMPORT_BYTES) return '가져오지 못했어요: 파일이 너무 커요(1MB까지).';
    const res = parseImport(await file.text(), today(), nowMin());
    if (!res.ok) return `가져오지 못했어요: ${res.error}`;
    const merged = mergeLog(log, res.records);
    log = merged.log;
    persist();
    changed();
    const skipped = res.records.length - merged.added;
    return `기록 ${merged.added}개를 가져왔어요.${skipped ? ` 이미 있던 ${skipped}개는 건너뛰었어요.` : ''}${res.dropped ? ` 잘못된 항목 ${res.dropped}개는 뺐어요.` : ''}`;
  }

  // ---- the tab ----
  function remove(r) {
    log = removeRecord(log, r.id);
    persist();
    changed();
    (document.getElementById('lg-day-title') ?? panel.querySelector('[data-focus="empty-add"]'))?.focus(); // the last one gone: the empty state
    toast('기록을 지웠어요', () => {
      log = normalizeLog([...log, r], today(), nowMin());
      persist();
      changed();
      document.getElementById('lg-day-title')?.focus();
    });
  }

  // The record's 도장: the 해벽 mark (css mask) in a round rim; a dot on the rim where the sun stood
  // (filled = sunny wall, hollow = shade; only a record with a time), a second rim for the first visit to that wall.
  // Decoration only. A wall with its own stamp artwork (src/stamp.js) is drawn from that file. `recs`: the records
  // this seal stands for, newest visit first (a calendar day shows its first record's).
  let firsts = new Set();
  function stamp(cls, recs) {
    const [r] = recs;
    const wall = getWalls().find((w) => w.name === r.wall);
    const s = el('span', { class: `seal ${cls}${recs.some((x) => firsts.has(x.id)) ? ' first' : ''}`, 'aria-hidden': 'true' }, inkStamp(el('span', { class: 'stamp' }), wall));
    const sun = sunMark(wall, r.date, r.time);
    if (sun) {
      const dot = el('span', { class: `sun ${sun.lit ? 'lit' : 'shade'}` });
      dot.style.left = `${sun.x.toFixed(1)}%`;
      dot.style.top = `${sun.y.toFixed(1)}%`;
      s.append(dot);
    }
    return s;
  }

  // The 등급 seal — the ONE place its artwork is decided: the 해벽 mark in a round rim, ringed by the sun's path (a thin
  // tilted orbit, its upper half behind the seal, its lower half in front). Five sun stops sit on the front arc (east →
  // west, below the mark); one more is filled per tier (볕뉘 1 … 해무리 5) and 온누리 (전국 완주) draws the whole orbit solid.
  // level: rankOf's -1..5; pressed: the save just raised the 등급 (.stamp-in). Decoration only: the name and the way to
  // the next tier are text next to it.
  const ORBIT_PHI = [150, 120, 90, 60, 30];
  function rankStamp(level, pressed = false) {
    const seal = el('span', { class: `rk-seal${pressed ? ' stamp-in' : ''}${level === 5 ? ' complete' : ''}`, 'data-level': String(level), 'aria-hidden': 'true' });
    const face = el('span', { class: 'rk-face' }, el('span', { class: 'stamp' }));
    const dots = el('span', { class: 'rk-orb rk-dots' });
    ORBIT_PHI.forEach((phi, i) => {
      const dot = el('span', { class: `rk-dot${i <= level ? ' on' : ''}` });
      dot.style.setProperty('--s', (0.75 + 0.4 * Math.sin(phi * Math.PI / 180)).toFixed(2)); // nearer the viewer (front-centre) = bigger
      dot.style.left = `${50 + 50 * Math.cos(phi * Math.PI / 180)}%`;
      dot.style.top = `${50 + 50 * Math.sin(phi * Math.PI / 180)}%`;
      dots.append(dot);
    });
    seal.append(el('span', { class: 'rk-orb rk-back' }), face, el('span', { class: 'rk-orb rk-front' }), dots);
    return seal;
  }

  // 내 활동: the 등급 seal (decoration only), the way to the next tier, the numbers.
  // No records: one short line instead (the empty state below carries the buttons).
  function activity() {
    const names = getWalls().map((w) => w.name);
    const seal = (level) => rankStamp(level, rankUp);
    if (!log.length) return el('p', { class: 'lg-act-none' }, seal(-1), '다녀오면 도장이 찍혀요');
    const { places, visits } = activityStats(log, names, today());
    const { total, outside } = visitedCount(log, names);
    const rank = rankOf(places, total);
    const nextSay = rank.next ? `${rank.next.name}까지 ${rank.next.need}곳 더` : '모든 암장에 도장을 찍었어요';
    const bar = el('div', { class: 'lg-track', role: 'progressbar', 'aria-label': '다음 등급까지', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(rank.progress * 100)), 'aria-valuetext': nextSay },
      el('div', { class: 'lg-fill' }));
    bar.firstChild.style.width = `${rank.progress * 100}%`;
    const add = el('button', { type: 'button', class: 'lg-add', 'data-focus': 'log-add', 'aria-label': '기록하기' }, '+ 기록');
    add.addEventListener('click', () => openAdd({ date: picked <= today() ? picked : null, from: add }));
    const crowd = loadContrib(storage).crowd;
    const info = el('button', { type: 'button', class: 'lg-info', 'aria-label': '등급 안내 보기', 'data-focus': 'rank-info' }, icon('info'));
    info.addEventListener('click', () => openRankInfo(places, total, info));
    return el('section', { class: 'lg-act', 'aria-label': '내 활동' },
      el('div', { class: 'lg-act-hd' },
        seal(rank.level),
        el('div', { class: 'lg-act-rank' },
          el('p', {}, rank.name ? el('b', {}, rank.name) : '아직 등급 전이에요', info),
          el('p', { class: 'lg-act-next' }, nextSay)),
        add),
      bar,
      el('p', { class: 'lg-bar-end', 'aria-hidden': 'true' }, el('span', {}, `${places}곳`), el('span', {}, rank.next ? `${rank.next.name} ${rank.next.at}곳` : rank.name)),
      el('p', { class: 'lg-act-meta' }, `방문 ${visits}번${crowd ? ` · 혼잡도 제보 ${crowd}번` : ''}`),
      outside ? el('small', {}, `지금 목록에 없는 ${outside}곳은 빠져요`) : null);
  }

  // 등급 안내 sheet: every tier this list can reach with the walls it takes (the tier now is marked, passed ones are ticked).
  const rankDlg = $('rank-info');
  let rankOpener = null;
  rankDlg.addEventListener('close', () => rankOpener?.focus());
  function openRankInfo(places, total, from) {
    rankOpener = from;
    const cur = rankOf(places, total);
    $('rank-info-note').textContent = `서로 다른 암장 수로 올라가요. 같은 곳에 여러 번 가도 한 곳으로 세요. 지금 목록 ${total}곳 중 ${places}곳을 다녀왔어요.`;
    $('rank-info-list').replaceChildren(...tiersOf(total).map((t) => {
      const state = t.level < cur.level ? 'done' : t.level === cur.level ? 'now' : 'todo';
      const dots = el('span', { class: 'ri-dots', 'aria-hidden': 'true' }, ...[0, 1, 2, 3, 4].map((i) => el('i', { class: i <= t.level ? 'on' : '' })));
      return el('li', { class: `ri-${state}` }, dots, el('div', { class: 'ri-name' }, el('b', {}, t.name), el('small', {}, t.gloss)), el('span', {}, t.key === 'complete' ? `전체 ${t.at}곳` : `${t.at}곳`),
        el('em', {}, state === 'done' ? '달성' : state === 'now' ? '지금' : `${t.at - places}곳 더`));
    }));
    rankDlg.showModal();
  }

  // the backup note: one quiet line at the very bottom of the 기록 tab (the first thing nobody needs twice stays out of the way);
  // the TIP_AT-th record also says it once in the save toast.
  function backupNote() {
    const save = el('button', { type: 'button' }, '내보내기');
    save.addEventListener('click', () => toast(exportFile()));
    return el('p', { class: 'lg-backup' }, '기록은 이 기기에만 저장돼요 ·', save);
  }

  function empty() {
    const add = el('button', { type: 'button', class: 'lg-add', 'data-focus': 'empty-add' }, '다녀온 암장을 지금 기록하기');
    add.addEventListener('click', () => openAdd({ from: add }));
    const home = el('button', { type: 'button', class: 'sh-toggle' }, '홈에서 암장 보기');
    home.addEventListener('click', showList);
    return el('div', { class: 'lg-empty' },
      el('h3', {}, '아직 기록이 없어요'),
      el('p', {}, '다녀온 암장을 남기면 몇 곳을 다녀왔는지 모아 보여 드려요. 이 기기에만 저장돼요.'),
      el('div', { class: 'lg-empty-btns' }, add, home));
  }

  // month grid: buttons in a role=grid table; arrows move the tab stop (crossing into the next/previous month),
  // Enter/Space picks the day. Switching months is instant; the month name is announced.
  function calendar(byDay) {
    const t = today();
    const grid = monthGrid(view.year, view.month);
    const sum = monthSummary(log, view.year, view.month);
    const move = (by) => {
      view = shiftMonth(view.year, view.month, by);
      const last = new Date(view.year, view.month, 0).getDate();
      focusDay = `${view.year}-${String(view.month).padStart(2, '0')}-${String(Math.min(Number(focusDay.slice(8)), last)).padStart(2, '0')}`;
      monthSay = `${view.year}년 ${view.month}월`;
    };
    const navBtn = (label, text, by, key) => {
      const b = el('button', { type: 'button', class: 'cal-nav', 'aria-label': label, 'data-focus': key }, text);
      b.addEventListener('click', () => { move(by); render(); panel.querySelector(`[data-focus="${key}"]`)?.focus(); });
      return b;
    };
    const todayBtn = el('button', { type: 'button', class: 'cal-today', 'data-focus': 'cal-today' }, '오늘');
    todayBtn.addEventListener('click', () => {
      const p = dayParts(t);
      view = { year: p.year, month: p.month };
      picked = focusDay = t;
      monthSay = `${p.year}년 ${p.month}월`;
      render();
      panel.querySelector('[data-focus="cal-today"]')?.focus();
    });
    if (!grid.weeks.flat().some((c) => c?.date === focusDay)) focusDay = grid.weeks.flat().find(Boolean).date;
    const rows = grid.weeks.map((week) => el('tr', {}, ...week.map((c) => {
      if (!c) return el('td', { role: 'gridcell', class: 'cal-pad' });
      const n = byDay.get(c.date)?.length ?? 0;
      const p = dayParts(c.date);
      const b = el('button', {
        type: 'button', class: 'cal-day', 'data-date': c.date, tabindex: c.date === focusDay ? '0' : '-1',
        'aria-label': `${p.month}월 ${p.day}일 ${p.dow}요일${c.date === t ? ', 오늘' : ''}, ${n ? `기록 ${n}개` : '기록 없음'}`,
        'aria-current': c.date === t ? 'date' : null,
      }, n ? stamp(c.date === stamped ? 'cal-stamp stamp-in' : 'cal-stamp', byDay.get(c.date)) : null,
      el('span', { class: 'cal-n', 'aria-hidden': 'true' }, String(c.day)),
      n > 1 ? el('span', { class: 'cal-badge', 'aria-hidden': 'true' }, `+${n - 1}`) : null);
      if (c.date > t) b.classList.add('future');
      return el('td', { role: 'gridcell', 'aria-selected': String(c.date === picked) }, b);
    })));
    const table = el('table', { class: 'cal-grid', role: 'grid', 'aria-labelledby': 'cal-title' },
      el('thead', {}, el('tr', {}, ...['일', '월', '화', '수', '목', '금', '토'].map((d) => el('th', { scope: 'col', abbr: `${d}요일` }, d)))),
      el('tbody', {}, ...rows));
    table.addEventListener('click', (e) => {
      const b = e.target.closest('.cal-day');
      if (!b) return;
      picked = focusDay = b.dataset.date;
      render();
      panel.querySelector(`.cal-day[data-date="${picked}"]`)?.focus();
    });
    table.addEventListener('keydown', (e) => {
      const b = e.target.closest('.cal-day');
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!b || (step === undefined && e.key !== 'Home' && e.key !== 'End' && e.key !== 'PageUp' && e.key !== 'PageDown')) return;
      e.preventDefault();
      const p = dayParts(b.dataset.date);
      const d = new Date(p.year, p.month - 1, p.day);
      if (step !== undefined) d.setDate(d.getDate() + step);
      else if (e.key === 'Home') d.setDate(d.getDate() - d.getDay());
      else if (e.key === 'End') d.setDate(d.getDate() + 6 - d.getDay());
      else { // PageUp/PageDown: the same day of the month before/after (31 → that month's last day)
        const m = shiftMonth(p.year, p.month, e.key === 'PageUp' ? -1 : 1);
        d.setFullYear(m.year, m.month - 1, Math.min(p.day, new Date(m.year, m.month, 0).getDate()));
      }
      focusDay = ymd(d);
      if (d.getFullYear() !== view.year || d.getMonth() + 1 !== view.month) {
        view = { year: d.getFullYear(), month: d.getMonth() + 1 };
        monthSay = `${view.year}년 ${view.month}월`;
        render();
      } else {
        for (const x of table.querySelectorAll('.cal-day')) x.tabIndex = x.dataset.date === focusDay ? 0 : -1;
      }
      panel.querySelector(`.cal-day[data-date="${focusDay}"]`)?.focus();
    });
    const say = el('p', { class: 'sr-only', 'aria-live': 'polite' });
    if (monthSay) setTimeout(() => { say.textContent = monthSay; monthSay = ''; }, 50); // after the new region is in the page
    return el('section', { class: 'cal', 'aria-label': '기록 달력' },
      el('div', { class: 'cal-head' },
        navBtn('이전 달', '‹', -1, 'cal-prev'),
        el('h3', { id: 'cal-title' }, grid.label),
        navBtn('다음 달', '›', 1, 'cal-next'),
        todayBtn),
      el('p', { class: 'cal-sum' }, `${view.month}월 기록 ${sum.visits}번 · ${sum.walls}곳`),
      say, table,
      el('p', { class: 'cal-legend' }, '도장의 점은 그날 해의 위치 · ● 양달 ○ 응달'));
  }

  // the picked day: its records (tap → the wall's card; 삭제 with 실행 취소) (a future day shows only the 오늘 이후 note; the one way to add is the card's 기록 button)
  function dayList(byDay) {
    const t = today();
    const p = dayParts(picked);
    const recs = byDay.get(picked) ?? [];
    const future = picked > t;
    return el('section', { class: 'lg-day', 'aria-labelledby': 'lg-day-title' },
      el('h3', { id: 'lg-day-title', tabindex: '-1' }, `${p.month}월 ${p.day}일 ${p.dow}요일`, el('span', {}, recs.length ? ` · 기록 ${recs.length}개` : ' · 기록 없음')),
      recs.length ? el('ul', { class: 'lg-recs' }, ...recs.map((r) => {
        const open = el('button', { type: 'button', class: 'lg-open' },
          el('span', { class: 'lg-name' }, r.wall),
          regionOf(r.wall) ? el('span', { class: 'lg-region' }, regionOf(r.wall)) : null,
          recordNote(r) ? el('span', { class: 'lg-memo' }, recordNote(r)) : null); // "15:00 · 메모"
        open.addEventListener('click', () => reveal(r.wall));
        const del = el('button', { type: 'button', class: 'lg-del', 'aria-label': `${r.wall} ${p.month}월 ${p.day}일${r.time ? ` ${r.time}` : ''} 기록 삭제` }, '삭제');
        del.addEventListener('click', () => remove(r));
        return el('li', {}, stamp('rec-stamp', [r]), open, del);
      })) : null,
      future ? el('p', { class: 'sh-hint' }, '오늘 이후 날짜는 기록할 수 없어요.') : null);
  }

  function render() {
    if (panel.hidden) return;
    const byDay = recordsByDay(log);
    firsts = firstVisits(log);
    panel.replaceChildren(...[
      el('h2', { class: 'sr-only' }, '기록'),
      activity(),
      ...(log.length ? [calendar(byDay), dayList(byDay), backupNote()] : [empty()]),
    ].filter(Boolean));
  }

  return {
    render,
    openAdd,
    exportFile,
    importFile,
    justStamped: (name) => stampedWall === name, // true only while changed() redraws after a save
    recordsFor: (name) => log.filter((r) => r.wall === name), // newest first (normalizeLog/addRecord keep that order)
  };
}
