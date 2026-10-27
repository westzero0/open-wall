// src/log-view.js — the 기록 tab (progress, month calendar, the picked day's records), the 기록 추가 sheet and the
// toast. Records live in this browser only (log.js); nothing here sends them anywhere.
import { el } from './dom.js';
import { config, boardOn } from './config.js';
import { shareNick, shareToBoard } from './board-view.js';
import { saveBackupAt } from './backup.js';
import { ymd } from './time.js';
import { hasHours, openIntervals } from './hours.js';
import { axisFrac, formatRanges, pickChips, searchPicks } from './viewmodel.js';
import { loadFavAsked, saveFavAsked, shouldAskFav } from './favorites.js';
import { inkStamp, sunMark } from './stamp.js';
import { activityStats, loadContrib, rankOf, tiersOf } from './rank.js';
import { barRows, gradeLabel, gradeLine, totalOf } from './grades.js';
import { createGradeWall } from './grade-wall.js';
import { tiersFor, newTier, logSections } from './stage.js';
import { createMonthShare } from './month-share.js';
import { createPosterShare } from './poster-share.js';
import { createPosterStore, idbBackend } from './poster-store.js';
import { createThumbCache, pickCta, renderStrip } from './poster-strip.js';
import { canSaveMonth } from './record-image.js';
import { drawSeal } from './year-seal-view.js';
import { KIND_TEXT } from './year-seal.js';
import { getStr, setStr } from './storage.js';
import {
  MAX_IMPORT_BYTES, TIP_AT, VISIT_FIRST, addRecord, updateRecord, reconcileLog, minOfTime, countFor, dayParts, exportLog, loadLog, mergeLog, minuteAtFrac, monthGrid, monthSummary,
  firstVisits, normalizeLog, visitSplit, wallsInMonth, parseImport, recordNote, recordsByDay, removeRecord, saveLog, shiftMonth, snapVisit, timeOfMin,
  timeSpeech, validDate, visitBreaks, visitDefault, visitMax, visitStats, visitedCount, yearSummary, yearsOf, dayGrades, yearGrades,
} from './log.js';

const $ = (id) => document.getElementById(id);
const today = () => ymd(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---- toast: one line at the foot of the screen, optionally with one action (실행 취소, ♥ 추가; kept while it has focus) ----
const box = $('toast');
const msgEl = $('toast-msg');
const act = $('toast-act');
const act2 = $('toast-act2'); // a second, plainer action (타임라인에도 한 줄 남기기 after a record)
let toastTimer;
let undoFn = null;
let extraFn = null;
let holdMs = 0; // 0: the plain lengths (2.5 s, 3 s with a button)
let cameFrom = null; // where the focus was before it went into the toast (Esc gives it back)
// Shown in the top layer, so it is seen above an open sheet too; each toast re-raises it over a sheet opened since.
box.popover = 'manual';
const raise = () => {
  if (!box.showPopover) return;
  if (box.matches(':popover-open')) box.hidePopover();
  box.showPopover();
};
const hideToast = () => {
  clearTimeout(toastTimer);
  if (box.contains(document.activeElement)) return; // never pull the focused button away
  box.classList.remove('on');
  msgEl.textContent = '';
  act.hidden = true;
  act2.hidden = true;
  undoFn = null;
  extraFn = null;
};
const armToast = () => {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, holdMs || (undoFn ? 3000 : 2500));
};
export function toast(msg, undo = null, label = '실행 취소', ms = 0, extra = null) {
  undoFn = undo;
  extraFn = extra?.fn ?? null;
  holdMs = ms;
  msgEl.textContent = msg;
  act.textContent = label;
  act.hidden = !undo;
  act2.textContent = extra?.label ?? '';
  act2.hidden = !extra;
  raise();
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
act2.addEventListener('click', () => {
  const fn = extraFn;
  extraFn = null;
  act2.blur();
  hideToast();
  fn?.();
});
box.addEventListener('focusin', (e) => {
  clearTimeout(toastTimer);
  if (!box.contains(e.relatedTarget)) cameFrom = e.relatedTarget;
});
// Esc: away with it, the focus back where it came from
box.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  if (cameFrom?.isConnected) cameFrom.focus(); else act.blur();
  hideToast();
});
// dismissToast(fn): hide the toast only while it is still the one whose button runs fn (a newer toast is left alone)
export function dismissToast(fn) {
  if (fn && undoFn === fn) hideToast();
}
box.addEventListener('focusout', armToast);

/**
 * createLogView({storage, getWalls, getFavs, onChange, reveal, showList, crowdAsk, sendCrowd})
 * getWalls(): the current wall list (names = the progress denominator). getFavs(): ♥ names, the first chips of the picker.
 * onChange(): the log changed (list rows redraw).
 * reveal(name): open that wall's card in the list. showList(): go to the 목록 tab.
 * crowdAsk(wall, date, time) → null | canReport's {ok: false, reason, waitMin} | 'ask': whether the sheet asks how crowded that visit was (app.js).
 * sendCrowd(wall, level, date, time) → Promise<boolean>: the 혼잡도 report (app.js; the record itself stays here).
 * getOrigin(): {lat, lng} already in memory, or null — never asks for it (the sheet sorts a search by it).
 * addFav(name): ♥ a wall (the ♥ 추천 toast's button).
 */
export function createLogView({
  storage, icon = () => document.createElement('span'), getWalls, getFavs, onChange, reveal, showList, crowdAsk = () => null, sendCrowd = async () => false,
  getOrigin = () => null, addFav = () => {}, getWeather = async () => null, getWallId = () => null, // getWallId(name) → the wall's id (null for a name not in the lists)
}) {
  const panel = $('panel-log');
  const monthShare = createMonthShare({ getWalls, icon });
  // the 오늘의 해벽 cards kept for records (this browser only): madeIds says which rows have one, thumbItems are the small thumbnails the rows and
  // the strip show (read together, then kept in step; a read that finds nothing new redraws nothing)
  const posters = createPosterStore(idbBackend());
  const thumbCache = createThumbCache();
  let madeIds = new Set();
  let thumbItems = [];
  const sameCards = (ids, items) => ids.size === madeIds.size && [...ids].every((id) => madeIds.has(id))
    && items.length === thumbItems.length && items.every((it, i) => it.id === thumbItems[i].id && it.made === thumbItems[i].made);
  const readMade = () => Promise.all([posters.ids(), posters.list()]).then(([ids, items]) => {
    if (sameCards(ids, items)) return; // nothing changed: do not redraw (and lose focus) for nothing
    madeIds = ids;
    thumbItems = items;
    thumbCache.keep(items.map((it) => it.id));
    const on = document.activeElement; // the redraw replaces the panel: put focus back on the same control
    const key = on?.id ? `#${on.id}` : on?.dataset?.focus ? `[data-focus="${on.dataset.focus}"]` : null;
    const inside = panel.contains(on); // asked before the redraw: afterwards the old node is gone
    render();
    if (key && inside && (!document.activeElement || document.activeElement === document.body)) document.querySelector(key)?.focus();
  });
  const posterShare = createPosterShare({ getWalls, getLog: () => log, getWeather, icon, posters, onChange: readMade });
  readMade();
  let log = loadLog(storage, today(), nowMin());
  // the calendar: the month in view, the picked day, the day that holds the grid's tab stop
  const now = new Date();
  let view = { year: now.getFullYear(), month: now.getMonth() + 1 };
  let picked = today();
  let dayShown = false; // the picked day's records show only after a date was pressed (or a record was just added)
  let focusDay = picked;
  let yearView = now.getFullYear(); // the year the 올해 heatmap shows
  let yearOpen = false; // the heatmap is folded until opened; it stays as the tab redraws
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
  const chipBox = dlg.querySelector('.la-pick .la-chips');
  const searchBox = dlg.querySelector('.la-search');
  const picks = dlg.querySelector('.la-picks');
  const needHint = $('la-pick-err');
  const saveBtn = dlg.querySelector('.la-save');
  $('la-ok').addEventListener('click', () => saveBtn.click());
  const dateErr = $('la-date-err');
  let fixedWall = null;
  let fixedPlace = null; // a fixed place that is not in getWalls() (a 싱글피치 crag): its object, for the time bar (no hours)
  let choice = null;
  let chipNames = []; // the ≤3 chips, fixed when the sheet opens so they don't shuffle under a finger
  let extraWall = null; // a wall picked by search: it joins the chips, selected
  let opener = null;
  let editing = null; // the record the sheet is changing (its time, memo and grades), or null when it adds one
  // 한 줄 타임라인에도 공유: off by default, only with the board on. Only the nickname and the memo are posted; the record stays here.
  const shareRow = dlg.querySelector('.la-share');
  const whenRow = dlg.querySelector('.la-when');
  const shareOn = $('la-share');
  const shareBody = dlg.querySelector('.la-share-body');
  const shareNickIn = $('la-share-nick');
  shareRow.hidden = !boardOn();
  shareOn.addEventListener('change', () => {
    $('la-memo-hint').textContent = shareOn.checked ? '체크하면 이 메모가 공개돼요' : '100자까지. 이 기기에만 저장돼요.';
    if (shareOn.checked) {
      moreBox.open = true; // the memo is what gets posted: show it
      const n = shareNick();
      shareNickIn.value = n.nick;
      shareNickIn.readOnly = n.locked;
      shareBody.hidden = Boolean(n.nick); // a nickname already known fills in by itself: the field shows only without one
      toast('게시판에 닉네임과 함께 공개돼요');
    } else shareBody.hidden = true;
  });

  // chips: ♥ first, then the most recently logged (viewmodel.pickChips). Opened for a fixed wall: that wall, selected, not pressable.
  function drawChips() {
    if (fixedWall) {
      chipBox.hidden = false;
      return chipBox.replaceChildren(el('span', { class: 'la-chip fixed' }, fixedWall, el('span', { class: 'sr-only' }, ' (선택됨)')));
    }
    const names = extraWall && !chipNames.includes(extraWall) ? [...chipNames, extraWall] : chipNames;
    chipBox.hidden = !names.length;
    form.elements.q.placeholder = names.length ? '다른 암장 이름이나 지역으로 찾기' : '암장 이름이나 지역으로 찾기';
    chipBox.replaceChildren(...names.map((n) => {
      const b = el('button', { type: 'button', class: 'la-chip', 'aria-pressed': String(n === choice) }, n);
      b.addEventListener('click', () => choose(n));
      return b;
    }));
  }
  // the save button names what it saves; without a wall it is off and says why
  function drawSave() {
    const wall = sheetWall();
    saveBtn.disabled = !wall;
    $('la-ok').disabled = !wall; // the ✓ in the title row is the same 저장
    saveBtn.textContent = wall ? `${wall} 저장` : '저장';
    needHint.hidden = Boolean(wall);
  }
  function choose(name) {
    choice = name;
    drawChips();
    drawSave();
    drawDay();
    if (timeTouched) drawCrowd();
    else resetTime();
  }
  // search: only after typing; matches by name or region, nearest first when the position is already known, else 가나다
  function drawHits() {
    const q = form.elements.q.value.trim();
    picks.hidden = !q;
    if (!q) return picks.replaceChildren();
    const favs = getFavs();
    const hits = searchPicks(getWalls(), q, { origin: getOrigin() });
    picks.replaceChildren(...(hits.length ? hits.map(({ wall: w, km }) => {
      const b = el('button', { type: 'button', class: 'la-hit' },
        el('span', { class: 'pn' }, favs.includes(w.name) ? el('span', { class: 'rfav', role: 'img', 'aria-label': '즐겨찾기' }, '♥ ') : null, w.name),
        w.region ? el('span', { class: 'pr' }, w.region) : null);
      b.addEventListener('click', () => {
        extraWall = w.name;
        form.elements.q.value = '';
        drawHits();
        choose(w.name);
        chipBox.querySelector('[aria-pressed="true"]')?.focus(); // the row that held the focus is gone
      });
      return el('li', {}, b);
    }) : [el('li', { class: 'none' }, '맞는 암장이 없어요. 이름 일부로 찾아보세요.')]));
  }
  form.elements.q.addEventListener('input', drawHits);
  form.elements.q.addEventListener('keydown', (e) => { // Enter never saves; with exactly one match it picks that wall
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.isComposing) return; // a Korean IME's committing Enter must not pick early
    if (picks.querySelectorAll('.la-hit').length === 1) picks.querySelector('.la-hit').click();
  });
  // ---- 방문 시각: the wall's hours of the picked day on the 06–24 axis, and an invisible range input over them ----
  const timeIn = $('la-time-in');
  const timeSay = $('la-time-say');
  const timeNote = $('la-time-note');
  const timeErr = $('la-time-err');
  const timeClear = dlg.querySelector('.la-time-clear');
  const timeToggle = dlg.querySelector('.la-time-toggle');
  const timeBody = $('la-time-body');
  // the bar stays folded on the first screen (one summary line); 바꾸기/정하기 opens it, 접기 closes it
  function setTimeOpen(open) {
    timeBody.hidden = !open;
    timeToggle.setAttribute('aria-expanded', String(open));
    timeToggle.textContent = open ? '접기' : visitMin == null ? '정하기' : '바꾸기';
  }
  timeToggle.addEventListener('click', () => setTimeOpen(timeBody.hidden));
  const trk = dlg.querySelector('.vt-trk');
  const mark = dlg.querySelector('.vt-mark');
  const crowdRow = dlg.querySelector('.la-crowd');
  const crowdSentNote = dlg.querySelector('.la-crowd-sent');
  const moreBox = dlg.querySelector('.la-memo'); // the 메모 fold (the 그레이드 fold is gradesBox)
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
    const wall = fixedPlace ?? getWalls().find((w) => w.name === sheetWall());
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
    const ask = !editing && wall && visitMin != null ? crowdAsk(wall, form.elements.date.value, timeOfMin(visitMin)) : null;
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
    setTimeOpen(!timeBody.hidden);
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
    if (!form.elements.date.value) form.elements.date.value = today(); // iOS 지우기: never leave the chips pressed with no date
    timeTouched = false;
    timeErr.hidden = true;
    dateErr.hidden = true;
    drawDate();
    drawDay();
    resetTime();
  });
  // 언제: 오늘 / 어제 chips set the date input; 날짜 고르기 opens the native calendar and shows the picked day on the chip
  const dateIn = form.elements.date;
  const dayChips = [...dlg.querySelectorAll('.la-when .la-chip')];
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  function drawDate() {
    const v = dateIn.value;
    const kind = v === today() ? 'today' : v === addDays(-1) ? 'yesterday' : 'other';
    for (const b of dayChips) b.setAttribute('aria-pressed', String(b.dataset.day === kind));
    const other = dayChips.find((b) => b.dataset.day === 'other');
    other.textContent = kind === 'other' && validDate(v) ? `${Number(v.slice(5, 7))}월 ${Number(v.slice(8))}일` : '날짜 고르기';
  }
  function setDate(v) {
    dateIn.value = v;
    dateIn.dispatchEvent(new Event('change')); // the handler above redraws the chips, the day's hours and the default time
  }
  for (const b of dayChips) {
    if (b.dataset.day === 'other') continue; // that chip is only the look: the transparent date input over it takes the tap
    b.addEventListener('click', () => setDate(b.dataset.day === 'today' ? today() : addDays(-1)));
  }
  dateIn.addEventListener('click', () => { try { dateIn.showPicker?.(); } catch { /* already open, or no support: the native tap does it */ } }); // desktop
  dateIn.addEventListener('keydown', (e) => { // keyboard: Enter must not submit the form, Enter/Space open the calendar
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    try { dateIn.showPicker?.(); } catch { /* no support or already open */ }
  });
  for (const b of crowdPills) {
    b.addEventListener('click', () => {
      crowdLevel = crowdLevel === b.value ? null : b.value; // a second press clears it
      drawCrowd();
    });
  }

  // ---- 그레이드 기록: the shared wall of holds (src/grade-wall.js); a tap adds one to 완등 or 시도 (the radio above says which) ----
  const gradesBox = dlg.querySelector('.la-grades');
  const gnote = $('la-grades-note');
  const gradeWall = createGradeWall({
    kinds: [{ key: 'sends', word: '완등' }, { key: 'tries', word: '시도' }],
    mode: () => form.elements.gmode.value,
    onChange: (get) => {
      const a = totalOf(get('sends'));
      const t = totalOf(get('tries'));
      gnote.textContent = a || t ? [a ? `완등 ${a}` : '', t ? `시도 ${t}` : ''].filter(Boolean).join(' · ') : '선택';
    },
  });
  dlg.querySelector('.la-wall').append(gradeWall.el);

  /**
   * openAdd({wall, date, from, place}): wall fixed (펼친 카드의 다녀왔어요) or picked here (기록 탭); date defaults to today.
   * place: the fixed wall's object when it is not in getWalls() (a crag card's 다녀왔어요; with no hours the time is free, 06:00–23:30).
   */
  function openAdd({ wall = null, date = null, from = null, place = null } = {}) {
    form.reset();
    gradeWall.clear();
    gradesBox.open = false;
    editing = null;
    $('log-add-title').textContent = '기록 추가';
    whenRow.hidden = false;
    shareRow.hidden = !boardOn();
    fixedWall = wall;
    fixedPlace = wall ? place : null;
    choice = null;
    extraWall = null;
    opener = from;
    chipNames = wall ? [] : pickChips(getWalls(), { favs: getFavs(), visits: visitStats(log) }).map((w) => w.name);
    searchBox.hidden = Boolean(wall);
    picks.hidden = true;
    picks.replaceChildren();
    const t = today();
    form.elements.date.max = t;
    form.elements.date.value = date && date <= t ? date : t;
    drawDate();
    dateErr.hidden = true;
    timeErr.hidden = true;
    timeTouched = false;
    crowdLevel = null;
    setTimeOpen(false);
    moreBox.open = false;
    shareBody.hidden = true; // form.reset() cleared the box
    drawChips();
    drawSave();
    drawDay();
    resetTime();
    dlg.showModal();
  }
  /**
   * openEdit(record, from): the same sheet for a record already saved: its wall and date stay (no way to change them here), the time bar, the memo and
   * the grades are filled in; the 혼잡도 and 한 줄 타임라인 asks belong to a new record and are left out.
   */
  function openEdit(r, from) {
    openAdd({ wall: r.wall, date: r.date, from });
    editing = r;
    $('log-add-title').textContent = '기록 수정';
    whenRow.hidden = true;
    shareRow.hidden = true;
    visitMin = r.time ? minOfTime(r.time) : null;
    timeTouched = true;
    form.elements.memo.value = r.memo ?? '';
    moreBox.open = Boolean(r.memo);
    gradeWall.set('sends', r.sends ?? {});
    gradeWall.set('tries', r.tries ?? {});
    gradesBox.open = Boolean(r.sends || r.tries);
    drawTime();
    setTimeOpen(false);
  }
  for (const b of dlg.querySelectorAll('[data-close]')) b.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const wall = sheetWall();
    if (!wall) return;
    const time = visitMin == null ? '' : timeOfMin(visitMin);
    if (editing) {
      const up = updateRecord(log, editing.id, { time, memo: form.elements.memo.value, sends: gradeWall.get('sends'), tries: gradeWall.get('tries') }, { today: today(), nowMin: nowMin() });
      if (up.field === 'time') {
        timeErr.textContent = up.error;
        timeErr.hidden = false;
        setTimeOpen(true);
        return timeIn.focus();
      }
      if (up.error) return toast(up.error);
      log = up.log;
      persist();
      dlg.close();
      changed();
      return toast(`${wall} 기록을 고쳤어요`);
    }
    const res = addRecord(log, { wall, date: form.elements.date.value, time, memo: form.elements.memo.value, sends: gradeWall.get('sends'), tries: gradeWall.get('tries'), wall_id: getWallId(wall) }, { today: today(), id: newId(), nowMin: nowMin() });
    if (res.field === 'time') {
      timeErr.textContent = res.error;
      timeErr.hidden = false;
      setTimeOpen(true);
      return timeIn.focus();
    }
    if (res.error) {
      dateErr.textContent = res.error;
      dateErr.hidden = false;
      return form.elements.date.focus();
    }
    // asked again at save time: the question's conditions (a week back, not later than now, not sent yet) may have moved
    const share = boardOn() && shareOn.checked ? { wall, nick: shareNickIn.value, memo: res.record.memo ?? '' } : null;
    const level = crowdLevel && crowdAsk(wall, res.record.date, time) === 'ask' ? crowdLevel : null;
    const before = rankNow();
    log = res.log;
    const after = rankNow();
    rankUp = after.level > before.level;
    persist();
    document.dispatchEvent(new CustomEvent('stats:log-add')); // stats.js counts it (no wall name or memo in it)
    if (!panel.hidden) { // added from the 기록 tab: show the day it went on
      picked = focusDay = res.record.date;
      dayShown = true;
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
    } else {
      // the 공유 box was left off (the default): the record is on this device only. With the board on, one tap more can put a line on the wall's 타임라인 too (its form asks for the nickname when there is none)
      const toBoard = boardOn() && !share ? { label: '타임라인에도 남기기', fn: () => document.dispatchEvent(new CustomEvent('wall:open-board', { detail: { name: wall } })) } : null;
      toast(saved, () => posterShare.open({ record: res.record, from: document.querySelector(`[data-focus="poster-${res.record.id}"]`) }), '오늘의 해벽', toBoard ? 5000 : 0, toBoard);
    }
    // a failed share never undoes the record: it is already saved
    if (share) shareToBoard(share).then((r) => toast(r.ok ? '한 줄 타임라인에도 올렸어요' : `기록은 저장했어요. 타임라인에는 올리지 못했어요 — ${r.error}.`, null, '', 4000));
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
    saveBackupAt(storage); // 내 정보 says when
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
    // the record's card goes with it; the undo puts it back (the card and its thumbnail are read first, so the undo has them)
    const thumb = thumbItems.find((it) => it.id === r.id)?.thumb ?? null;
    const kept = posters.get(r.id).then((p) => { posters.remove(r.id).then(readMade); return p; });
    toast('기록을 지웠어요', () => {
      log = normalizeLog([...log, r], today(), nowMin());
      persist();
      kept.then((p) => (p ? posters.put(p, thumb) : null)).then(readMade);
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
    const { places } = activityStats(log, names, today());
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
      crowd ? el('p', { class: 'lg-act-meta' }, `혼잡도 제보 ${crowd}번`) : null,
      outside ? el('small', {}, `지금 목록에 없는 ${outside}곳은 빠져요`) : null);
  }

  // 올해 도장 읽는 법: a static sheet (index.html), opened from the ⓘ beside the year; focus goes back to it
  const yearDlg = $('year-info');
  let yearOpener = null;
  yearDlg.addEventListener('close', () => yearOpener?.focus());

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
    // the month as it will fill up: the real grid, dimmed, nothing pressable and no made-up records
    const p = dayParts(today());
    const ghost = el('div', { class: 'lg-ghost', 'aria-hidden': 'true' },
      el('p', { class: 'lg-ghost-t' }, `${p.year}년 ${p.month}월`),
      el('table', { class: 'cal-grid' },
        el('thead', {}, el('tr', {}, ...['일', '월', '화', '수', '목', '금', '토'].map((d) => el('th', {}, d)))),
        el('tbody', {}, ...monthGrid(p.year, p.month).weeks.map((week) => el('tr', {}, ...week.map((c) => el('td', {},
          c ? el('span', { class: c.date === today() ? 'lg-ghost-day now' : 'lg-ghost-day' }, String(c.day)) : null)))))));
    return el('div', { class: 'lg-empty' },
      ghost,
      el('h3', {}, '아직 기록이 없어요'),
      el('p', { class: 'lg-empty-say' }, el('span', {}, '다녀온 암장을 남기면 몇 곳을 다녀왔는지'), el('span', {}, '모아서 보여드려요. 이 기기에만 저장돼요.')), // two centred lines, each a phrase of its own
      el('div', { class: 'lg-empty-btns' }, add, home));
  }

  // 올해: the year as a seal (src/year-seal-view.js). Folded until opened; the daylight band is computed the first time it opens (cached
  // per year), and a pressed visit says its date, hour and sun in the line under the seal.
  function yearMap() {
    const thisYear = now.getFullYear();
    const years = yearsOf(log);
    const lo = Math.min(...years, thisYear);
    const hi = Math.max(...years, thisYear);
    yearView = Math.min(Math.max(yearView, lo), hi);
    const sum = yearSummary(log, yearView);
    const navBtn = (label, text, by, key) => {
      const b = el('button', { type: 'button', class: 'cal-nav', 'aria-label': label, 'data-focus': key }, text);
      b.disabled = yearView + by < lo || yearView + by > hi;
      b.addEventListener('click', () => { yearView += by; render(); panel.querySelector(`[data-focus="${key}"]`)?.focus(); });
      return b;
    };
    const info = el('button', { type: 'button', class: 'lg-info', 'aria-label': '도장 읽는 법 보기', 'data-focus': 'year-info' }, icon('info'));
    info.addEventListener('click', () => { yearOpener = info; yearDlg.showModal(); });
    const legend = el('p', { class: 'ys-key' }, ...['sun', 'shade', 'night', 'unknown'].map((k) => el('span', {}, el('i', { class: k, 'aria-hidden': 'true' }), KIND_TEXT[k])));
    const idle = sum.visits ? '호를 누르면 날짜와 시각이 나와요' : '';
    const cap = el('p', { class: 'ys-cap', 'aria-live': 'polite' }, idle);
    const plot = el('div', { class: 'ys-plot' });
    const fill = () => {
      if (plot.firstChild) return;
      const seal = drawSeal({
        year: yearView, log, walls: getWalls(), today: today(),
        onPick: (m) => { cap.textContent = m.label; },
      });
      plot.append(seal.el);
    };
    const fold = el('details', { class: 'hm' },
      el('summary', {}, el('span', {}, '올해 기록 한눈에'), el('span', { class: 'hm-sum' }, sum.visits ? `${sum.visits}번 · ${sum.walls}곳` : '')),
      el('div', { class: 'cal-head' },
        navBtn('이전 해', '‹', -1, 'hm-prev'),
        el('div', { class: 'ys-title' }, el('h3', {}, `${yearView}년`), info),
        navBtn('다음 해', '›', 1, 'hm-next')),
      el('p', { class: 'cal-sum' }, sum.visits
        ? `${sum.visits}번 · ${sum.walls}곳${sum.top ? ` · 가장 많이 간 곳 ${sum.top.wall} ${sum.top.count}번` : ''}`
        : '이 해에는 기록이 없어요'),
      plot, cap, legend);
    fold.open = yearOpen;
    fold.addEventListener('toggle', () => { yearOpen = fold.open; if (fold.open) fill(); });
    if (yearOpen) fill();
    return fold;
  }

  // 올해 완등: the year's 완등 per grade (the year the 올해 map shows), a bar per grade that was topped; 시도 is not mixed in.
  function gradeYear() {
    const { counts, total } = yearGrades(log, yearView);
    if (!total) return null;
    return el('section', { class: 'lg-gy', 'aria-label': `${yearView}년 그레이드별 완등` },
      el('h3', {}, `${yearView}년 완등 ${total}`),
      el('ul', { class: 'gy-list' }, ...barRows(counts).map((r) => {
        const bar = el('span', { class: 'gy-bar' });
        bar.style.width = `${r.frac * 100}%`;
        return el('li', {}, el('span', { class: 'gy-g' }, gradeLabel(r.grade)), el('span', { class: 'gy-trk', 'aria-hidden': 'true' }, bar), el('span', { class: 'gy-n' }, String(r.n)));
      })));
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
      dayShown = true;
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
    // the picture of the viewed month when it has records (this month's is a preview only), else of last month when that has some
    const now = new Date();
    const last = shiftMonth(now.getFullYear(), now.getMonth() + 1, -1);
    const has = (m) => monthSummary(log, m.year, m.month).visits > 0;
    const pic = sum.visits ? view : has(last) ? last : null;
    const shareBtn = el('button', { type: 'button', class: 'cal-share' }, pic ? `${pic.month}월 기록 그림${canSaveMonth(pic.year, pic.month) ? '' : ' 미리보기'} ›` : '');
    if (pic) shareBtn.addEventListener('click', () => monthShare.open({ log, year: pic.year, month: pic.month, from: shareBtn }));
    const ended = !!pic;
    const say = el('p', { class: 'sr-only', 'aria-live': 'polite' });
    if (monthSay) setTimeout(() => { say.textContent = monthSay; monthSay = ''; }, 50); // after the new region is in the page
    return el('section', { class: 'cal', 'aria-label': '기록 달력' },
      el('div', { class: 'cal-head' },
        navBtn('이전 달', '‹', -1, 'cal-prev'),
        el('h3', { id: 'cal-title' }, grid.label),
        navBtn('다음 달', '›', 1, 'cal-next'),
        todayBtn),
      say, table,
      el('p', { class: 'cal-legend' }, '도장의 점은 그날 해의 위치 · ● 양달 ○ 응달'),
      ended ? shareBtn : null, // only a month that has ended and has records (this month's picture is not final)
      ended ? el('p', { class: 'sh-hint cal-share-sub' }, '한 달 방문을 해 그림 한 장으로') : null,
      !dayShown ? el('p', { class: 'sh-hint cal-hint' }, '날짜를 누르면 그날 기록이 아래에 열려요') : null);
  }

  // the picked day: its records (tap → the 기록 수정 sheet; 삭제 with 실행 취소) (a future day shows only the 오늘 이후 note; the one way to add is the card's 기록 button)
  function dayList(byDay) {
    if (!dayShown) return null;
    const t = today();
    const p = dayParts(picked);
    const recs = byDay.get(picked) ?? [];
    const future = picked > t;
    const ctaId = pickCta(recs, madeIds, t); // the one record of today that gets the big "오늘의 해벽 만들기" line
    // several records in a day: the day's 완등 / 시도 add up in the title (one record shows its own lines)
    const dg = dayGrades(recs);
    const dayTotals = recs.length > 1 && (dg.sends || dg.tries) ? ` · ${[dg.sends ? `완등 ${dg.sends}` : '', dg.tries ? `시도 ${dg.tries}` : ''].filter(Boolean).join(' · ')}` : '';
    return el('section', { class: 'lg-day', 'aria-labelledby': 'lg-day-title' },
      el('h3', { id: 'lg-day-title', tabindex: '-1' }, `${p.month}월 ${p.day}일 ${p.dow}요일`, el('span', {}, recs.length ? ` · 기록 ${recs.length}개${dayTotals}` : ' · 기록 없음')),
      recs.length ? el('ul', { class: 'lg-recs' }, ...recs.map((r) => {
        const open = el('button', { type: 'button', class: 'lg-open', 'aria-haspopup': 'dialog' },
          el('span', { class: 'lg-name' }, r.wall),
          regionOf(r.wall) ? el('span', { class: 'lg-region' }, regionOf(r.wall)) : null,
          recordNote(r) ? el('span', { class: 'lg-memo' }, recordNote(r)) : null, // "15:00 · 메모"
          r.sends ? el('span', { class: 'lg-gr send' }, `완등 ${gradeLine(r.sends)}`) : null,
          r.tries ? el('span', { class: 'lg-gr try' }, `시도 ${gradeLine(r.tries)}`) : null);
        open.addEventListener('click', () => openEdit(r, open)); // the row opens its own edit sheet; the wall's card is one tap away in 암장별
        const del = el('button', { type: 'button', class: 'lg-del', 'aria-label': `${r.wall} ${p.month}월 ${p.day}일${r.time ? ` ${r.time}` : ''} 기록 삭제` }, '삭제');
        del.addEventListener('click', () => remove(r));
        // the way into the card, by what the row is: a made card shows its thumbnail, today's newest without one gets the big line under the
        // row, any other row gets a quiet link like 삭제 (no pill: it would be a new kind of button, and shrink the wall's name)
        const day = `${p.month}월 ${p.day}일`;
        const title = r.date === t ? '오늘의 해벽' : '그날의 해벽';
        const thumb = thumbItems.find((it) => it.id === r.id)?.thumb;
        const key = { 'data-focus': `poster-${r.id}` };
        let card = null;
        let cta = null;
        if (madeIds.has(r.id)) {
          const label = thumb ? `${r.wall} ${day} ${title} 보기` : `${r.wall} ${day} 카드 보기`; // the text-only button's label holds its visible word
          card = thumb
            ? el('button', { type: 'button', class: 'lg-card', ...key, 'aria-label': label }, el('img', { class: 'lg-card-img', src: thumbCache.url(r.id, thumb), alt: '' })) // the height is CSS; the width follows the card's own shape
            : el('button', { type: 'button', class: 'lg-card-link', ...key, 'aria-label': label }, '카드'); // made, but no thumbnail (imported)
        } else if (r.id === ctaId) {
          cta = el('button', { type: 'button', class: 'lg-cta', ...key, 'aria-label': `${r.wall} 오늘의 해벽 카드 만들기` },
            '오늘의 해벽 카드 만들기 · 사진 한 장', el('span', { class: 'lg-cta-go', 'aria-hidden': 'true' }, '›'));
        } else {
          card = el('button', { type: 'button', class: 'lg-card-link', ...key, 'aria-label': `${r.wall} ${day} 카드 만들기` }, '+ 카드'); // short on purpose: "카드 만들기" would leave a 320px phone too little room for the wall's name
        }
        for (const b of [card, cta]) b?.addEventListener('click', () => posterShare.open({ record: r, from: b }));
        return el('li', { class: cta ? 'lg-has-cta' : null }, stamp('rec-stamp', [r]), open, card, del, cta);
      })) : null,
      future ? el('p', { class: 'sh-hint' }, '오늘 이후 날짜는 기록할 수 없어요.') : null);
  }

  // 상단 요약 띠: 인공암벽 방문 · 이번 달 · 다녀온 곳 (야외 칸은 config.showOutdoorCount가 켜졌을 때만)
  function summary() {
    const { indoor, outdoor } = visitSplit(log, (n) => getWalls().find((w) => w.name === n)?.kind === 'crag');
    const month = monthSummary(log, now.getFullYear(), now.getMonth() + 1).visits;
    const cells = [['인공암벽 방문', `${indoor}회`], ...(config.showOutdoorCount ? [['야외 방문', `${outdoor}회`]] : []), ['이번 달', `${month}회`], ['다녀온 곳', `${new Set(log.map((r) => r.wall)).size}곳`]];
    const band = el('dl', { class: 'lg-band', 'aria-label': '기록 요약' }, ...cells.map(([k, v], i) => el('div', { class: i ? null : 'lead' }, el('dt', {}, k), el('dd', {}, v))));
    band.style.setProperty('--n', String(cells.length));
    return band;
  }

  // 암장별: the month in view, one row per wall (tap → the wall's card)
  function wallTable() {
    const rows = wallsInMonth(log, view.year, view.month);
    if (!rows.length) return null;
    return el('section', { class: 'lg-walls', 'aria-label': `${view.month}월 암장별` },
      el('h3', {}, `${view.month}월 암장별`),
      el('ul', {}, ...rows.map((r) => {
        const p = dayParts(r.last);
        const b = el('button', { type: 'button', class: 'lg-wrow' }, el('span', { class: 'lg-name' }, r.wall), el('span', { class: 'lg-wsub' }, `${r.count}회 · 마지막 ${p.month}/${p.day}`));
        b.addEventListener('click', () => reveal(r.wall));
        return el('li', {}, b);
      })));
  }

  // a thumbnail of the strip opens its card; a card whose record is gone (a backup restored elsewhere) still opens, from what the thumbnail row knows
  function openFromStrip(id) {
    const it = thumbItems.find((x) => x.id === id);
    const record = log.find((r) => r.id === id) ?? (it ? { id, wall: it.wall, date: it.date, time: null, memo: '' } : null);
    if (record) posterShare.open({ record, from: document.querySelector(`[data-focus="strip-${id}"]`) });
  }

  function render() {
    if (panel.hidden) return;
    const byDay = recordsByDay(log);
    firsts = firstVisits(log);
    const parts = {
      empty, summary, wallTable, activity, yearMap, gradeYear, backup: backupNote,
      calendar: () => calendar(byDay), dayList: () => dayList(byDay),
      strip: () => renderStrip(thumbItems, { cache: thumbCache, onOpen: openFromStrip, walls: getWalls(), today: today() }),
    };
    const tiers = tiersFor(log);
    panel.replaceChildren(...[
      el('h2', { class: 'sr-only' }, '기록'),
      tierNote(tiers),
      ...logSections({ tiers, hasRecords: log.length > 0 }).map((k) => parts[k]()),
    ].filter(Boolean));
  }

  // one quiet line when a new step of the 기록 tab has opened for this person; 확인 remembers it (this browser only)
  const SEEN_KEY = 'open-wall:tiers-seen';
  const seenTiers = () => { try { return new Set(JSON.parse(getStr(SEEN_KEY)) ?? []); } catch { return new Set(); } };
  function tierNote(tiers) {
    const seen = seenTiers();
    const t = log.length ? newTier(tiers, seen) : null;
    if (!t) return null;
    const ok = el('button', { type: 'button', class: 'lg-card-link' }, '확인');
    ok.addEventListener('click', () => {
      seen.add(t.id);
      setStr(SEEN_KEY, JSON.stringify([...seen])); // private mode: the note shows again next time
      render();
    });
    return el('p', { class: 'sh-hint', role: 'status' }, t.say, ' ', ok);
  }

  return {
    render,
    openAdd,
    exportFile,
    importFile,
    count: () => log.length,
    justStamped: (name) => stampedWall === name, // true only while changed() redraws after a save
    reconcile: (walls) => { const r = reconcileLog(log, walls); if (r.changed) { log = r.log; persist(); } }, // after the lists load: names follow ids, old records get ids
    recordsFor: (name) => log.filter((r) => r.wall === name), // newest first (normalizeLog/addRecord keep that order)
  };
}
