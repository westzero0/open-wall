// src/wall-sheet.js — the info sheet of one wall: a full-height <dialog> with a bottom tab bar, opened from the wall card's 자세히 ›
// or by a link (?wall=<name>&info). Opening from the card pushes that address, so the browser's back button, Esc and 뒤로 all close it
// with one history step (the same rules as the board page). The panes are drawn by app.js, which registers a builder
// (the hours grid, seasonal sun and fee table live there, next to the view state they read). DOM via el()/textContent only.
import { el } from './dom.js';
import { config } from './config.js';

let build = null; // (wallName) => { tabs: [{ key, label, pane }], onClose?: () => void } | null; pane: an element, or a function made when the tab is first shown (the board loads only then)
let onClose = null;
let dlg = null, title = null, body = null, bar = null, inner = null;
let opener = null; // the button that opened it: focus goes back there
let wall = '';
let pushed = false; // did we push a history entry that closing has to undo?
let tabEls = [], panels = [], lazy = [];

export const registerWallSheet = (fn) => { build = fn; };

function pick(n, focus) {
  if (lazy[n]) { // built the first time the tab is shown
    const made = lazy[n]();
    lazy[n] = null;
    panels[n].replaceChildren(...[made].flat().filter(Boolean));
  }
  tabEls.forEach((t, i) => {
    t.setAttribute('aria-selected', String(i === n));
    t.tabIndex = i === n ? 0 : -1;
    panels[i].hidden = i !== n;
  });
  if (focus) tabEls[n].focus();
  if (inner) inner.scrollTop = 0; // each tab starts at its top
}

function make() {
  title = el('h2', { id: 'ws-title', class: 'bp-title ws-title', tabindex: '-1' });
  const back = el('button', { type: 'button', class: 'sh-done bp-back' }, '← 뒤로');
  back.addEventListener('click', () => dlg.close());
  const report = config.reportEndpoint ? el('button', { type: 'button', class: 'ws-report' }, '제보') : null;
  report?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: wall } })));
  body = el('div', { class: 'ws-body' });
  bar = el('div', { class: 'ws-tabs', role: 'tablist', 'aria-label': '암장 정보 보기' });
  inner = el('div', { class: 'bp-inner ws-inner' }, el('div', { class: 'sh-head' }, back, title, report), body);
  dlg = el('dialog', { class: 'sheet board-page wall-sheet', 'aria-labelledby': 'ws-title' }, inner, bar);
  dlg.addEventListener('close', () => { // 뒤로, Esc or popstate
    if (pushed) { pushed = false; history.back(); }
    onClose?.();
    onClose = null;
    // back to the button that opened it; opened by a link (or the card was re-drawn): the card's own 자세히 › for this wall
    const own = [...document.querySelectorAll('.row.is-open [data-sheet-open]')].find((b) => b.dataset.name === wall);
    const o = opener?.isConnected ? opener : own;
    opener = null;
    o?.focus();
  });
  window.addEventListener('popstate', () => { if (dlg.open) { pushed = false; dlg.close(); } });
  document.body.append(dlg);
}

/** Open the sheet for a wall. `from` is the button to give focus back to. `push: false` = the address is already right (a link opened it). `tab`: the key of the tab to start on (an unknown key = the first). */
export function openWallSheet(wallName, from = null, { push = true, tab = null } = {}) {
  const built = build?.(wallName);
  if (!built?.tabs.length) return; // not registered, or an unknown wall
  if (!dlg) make();
  if (dlg.open) return;
  wall = wallName;
  title.textContent = wallName;
  tabEls = built.tabs.map((t, i) => el('button', { type: 'button', role: 'tab', id: `ws-t${i}`, 'aria-controls': `ws-p${i}` }, t.label));
  const several = built.tabs.length > 1; // one tab: no tab bar, so its content is no tabpanel either
  lazy = built.tabs.map((t) => (typeof t.pane === 'function' ? t.pane : null));
  panels = built.tabs.map((t, i) => el('div', { ...(several ? { role: 'tabpanel', 'aria-labelledby': `ws-t${i}` } : {}), id: `ws-p${i}`, class: 'ws-panel' }, lazy[i] ? null : t.pane));
  tabEls.forEach((t, i) => {
    t.addEventListener('click', () => pick(i, false));
    t.addEventListener('keydown', (e) => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabEls.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      pick((n + tabEls.length) % tabEls.length, true);
    });
  });
  body.replaceChildren(...panels);
  bar.replaceChildren(...tabEls);
  bar.hidden = !several; // one tab: just its content
  onClose = built.onClose ?? null;
  pick(Math.max(0, built.tabs.findIndex((t) => t.key === tab)), false);
  opener = from;
  if (push) {
    const u = new URL(location.href);
    u.searchParams.set('wall', wallName);
    u.searchParams.set('info', '');
    history.pushState({ info: wallName }, '', u);
    pushed = true;
  }
  dlg.showModal();
  title.focus();
}
