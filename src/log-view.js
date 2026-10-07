// src/log-view.js — the 기록 tab (progress, month calendar, the picked day's records), the 기록 추가 sheet and the
// toast. Records live in this browser only (log.js); nothing here sends them anywhere.
import { el } from './dom.js';
import { ymd } from './time.js';
import {
  MAX_IMPORT_BYTES, TIP_AT, TIP_KEY, addRecord, dayParts, exportLog, loadLog, mergeLog, monthGrid, monthSummary,
  normalizeLog, parseImport, recordsByDay, removeRecord, saveLog, shiftMonth, stampLook, visitedCount,
} from './log.js';

const $ = (id) => document.getElementById(id);
const today = () => ymd(new Date());
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---- toast: one line at the foot of the screen, optionally with 실행 취소 (kept while it has focus) ----
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
export function toast(msg, undo = null) {
  undoFn = undo;
  msgEl.textContent = msg;
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
 * createLogView({storage, getWalls, getFavs, onChange, reveal, showList})
 * getWalls(): the current wall list (names = the progress denominator). getFavs(): ♥ names, listed first in the picker.
 * onChange(): the log changed (list rows redraw).
 * reveal(name): open that wall's card in the list. showList(): go to the 목록 tab.
 */
export function createLogView({ storage, getWalls, getFavs, onChange, reveal, showList }) {
  const panel = $('panel-log');
  let log = loadLog(storage, today());
  // the calendar: the month in view, the picked day, the day that holds the grid's tab stop
  const now = new Date();
  let view = { year: now.getFullYear(), month: now.getMonth() + 1 };
  let picked = today();
  let focusDay = picked;
  let monthSay = '';
  let stamped = null; // the day a record was just added: its stamp lands with a short press, once
  let stampedWall = null; // ...and the wall, so its card's 다녀왔어요 pill gets the same press

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

  function drawPicks() {
    const q = form.elements.q.value.trim().normalize('NFC').toLowerCase();
    const favs = getFavs();
    const walls = getWalls().filter((w) => !q || w.name.toLowerCase().includes(q) || (w.region ?? '').toLowerCase().includes(q))
      .sort((a, b) => Number(favs.includes(b.name)) - Number(favs.includes(a.name))); // ♥ first, list order otherwise (stable sort)
    picks.replaceChildren(...(walls.length ? walls.map((w) => {
      const input = el('input', { type: 'radio', name: 'pick', value: w.name });
      input.checked = w.name === choice;
      return el('li', {}, el('label', {}, input, el('span', { class: 'pn' }, favs.includes(w.name) ? el('span', { class: 'rfav', role: 'img', 'aria-label': '즐겨찾기' }, '♥ ') : null, w.name), w.region ? el('span', { class: 'pr' }, w.region) : null));
    }) : [el('li', { class: 'none' }, '맞는 암장이 없어요. 이름 일부로 찾아보세요.')]));
  }
  picks.addEventListener('change', (e) => {
    choice = e.target.value;
    pickErr.hidden = true;
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
    const res = addRecord(log, { wall, date: form.elements.date.value, memo: form.elements.memo.value }, { today: today(), id: newId() });
    if (res.error) {
      dateErr.textContent = res.error;
      dateErr.hidden = false;
      return form.elements.date.focus();
    }
    log = res.log;
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
    toast(`${wall} 기록했어요`, () => {
      log = removeRecord(log, res.record.id);
      persist();
      changed(key);
      toast('기록을 취소했어요');
    });
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
    const res = parseImport(await file.text(), today());
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
      log = normalizeLog([...log, r], today());
      persist();
      changed();
      document.getElementById('lg-day-title')?.focus();
    });
  }

  // the 해벽 mark as an ink stamp (css mask), tilted/inked per date; decoration only
  function stamp(date, cls) {
    const { tilt, ink } = stampLook(date);
    const s = el('span', { class: cls, 'aria-hidden': 'true' });
    s.style.setProperty('--tilt', `${tilt}deg`);
    s.style.setProperty('--ink', String(ink));
    return s;
  }

  function progress() {
    const { visited, total, outside } = visitedCount(log, getWalls().map((w) => w.name));
    const bar = el('div', { class: 'lg-track', role: 'progressbar', 'aria-label': '다녀온 암장', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(visited), 'aria-valuetext': `${total}곳 중 ${visited}곳` },
      el('div', { class: 'lg-fill' }));
    bar.firstChild.style.width = `${total ? (visited / total) * 100 : 0}%`;
    const add = el('button', { type: 'button', class: 'lg-add', 'data-focus': 'log-add' }, '+ 기록 추가');
    add.addEventListener('click', () => openAdd({ date: picked <= today() ? picked : null, from: add }));
    return el('section', { class: 'lg-prog', 'aria-label': '진행률' },
      el('div', { class: 'lg-prog-hd' },
        el('p', {}, `${total}곳 중 `, el('b', {}, `${visited}곳`), ' 다녀왔어요'),
        log.length ? add : null),
      bar,
      el('small', {}, log.length ? `기록 ${log.length}개${outside ? ` · 지금 목록에 없는 ${outside}곳은 진행률에서 빠져요` : ''}` : '다녀온 곳을 남기면 여기 채워져요.'));
  }

  function tip() {
    let closed = false;
    try { closed = storage.getItem(TIP_KEY) === '1'; } catch { /* no storage: show it */ }
    if (closed || log.length < TIP_AT) return null;
    const save = el('button', { type: 'button', class: 'sh-toggle' }, '지금 내보내기');
    save.addEventListener('click', () => toast(exportFile()));
    const close = el('button', { type: 'button', class: 'lg-tip-x', 'aria-label': '백업 안내 닫기' }, '✕');
    close.addEventListener('click', () => {
      try { storage.setItem(TIP_KEY, '1'); } catch { /* shown again next visit */ }
      render();
      panel.querySelector('.lg-add')?.focus();
    });
    return el('div', { class: 'lg-tip', role: 'note' },
      el('p', {}, '이 기기에만 저장돼요 — 백업해 두세요. 내 정보 › 기록 백업에서도 할 수 있어요.'), save, close);
  }

  function empty() {
    const add = el('button', { type: 'button', class: 'lg-add', 'data-focus': 'empty-add' }, '다녀온 암장을 지금 기록하기');
    add.addEventListener('click', () => openAdd({ from: add }));
    const home = el('button', { type: 'button', class: 'sh-toggle' }, '홈에서 암장 보기');
    home.addEventListener('click', showList);
    return el('div', { class: 'lg-empty' },
      el('h3', {}, '아직 기록이 없어요'),
      el('p', {}, '다녀온 외벽을 남기면 몇 곳을 다녀왔는지 모아 보여 드려요. 이 기기에만 저장돼요.'),
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
      }, n ? stamp(c.date, c.date === stamped ? 'stamp cal-stamp stamp-in' : 'stamp cal-stamp') : null,
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
      say, table);
  }

  // the picked day: its records (tap → the wall's card; 삭제 with 실행 취소) and 이 날 기록하기
  function dayList(byDay) {
    const t = today();
    const p = dayParts(picked);
    const recs = byDay.get(picked) ?? [];
    const future = picked > t;
    const add = el('button', { type: 'button', class: 'sh-toggle lg-day-add', 'data-focus': 'day-add', disabled: future ? '' : null }, '이 날 기록하기');
    add.addEventListener('click', () => openAdd({ date: picked, from: add }));
    return el('section', { class: 'lg-day', 'aria-labelledby': 'lg-day-title' },
      el('h3', { id: 'lg-day-title', tabindex: '-1' }, `${p.month}월 ${p.day}일 ${p.dow}요일`, el('span', {}, recs.length ? ` · 기록 ${recs.length}개` : ' · 기록 없음')),
      recs.length ? el('ul', { class: 'lg-recs' }, ...recs.map((r) => {
        const open = el('button', { type: 'button', class: 'lg-open' },
          el('span', { class: 'lg-name' }, r.wall),
          regionOf(r.wall) ? el('span', { class: 'lg-region' }, regionOf(r.wall)) : null,
          r.memo ? el('span', { class: 'lg-memo' }, r.memo) : null);
        open.addEventListener('click', () => reveal(r.wall));
        const del = el('button', { type: 'button', class: 'lg-del', 'aria-label': `${r.wall} ${p.month}월 ${p.day}일 기록 삭제` }, '삭제');
        del.addEventListener('click', () => remove(r));
        return el('li', {}, stamp(r.date, 'stamp rec-stamp'), open, del);
      })) : null,
      add,
      future ? el('p', { class: 'sh-hint' }, '오늘 이후 날짜는 기록할 수 없어요.') : null);
  }

  function render() {
    if (panel.hidden) return;
    const byDay = recordsByDay(log);
    panel.replaceChildren(...[
      el('h2', { class: 'sr-only' }, '기록'),
      progress(),
      tip(),
      ...(log.length ? [calendar(byDay), dayList(byDay)] : [empty()]),
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
