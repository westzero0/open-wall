// src/wall-sheet.js — the info sheet of one wall: a full-height <dialog> with a bottom tab bar, opened from the wall card's 자세히 ›
// or by a link (?wall=<name>&info). Opening from the card pushes that address, so the browser's back button, Esc and 뒤로 all close it
// with one history step (the same rules as the board page). The panes are drawn by app.js, which registers a builder
// (the hours grid, seasonal sun and fee table live there, next to the view state they read). DOM via el()/textContent only.
// The panes sit side by side in one scroll-snapped row: swiping sideways or tapping a tab moves between them; each pane scrolls
// up and down by itself. A part that needs sideways drags (the hours line) sets touch-action: pan-y, so a swipe there is not a tab change.
import { el } from './dom.js';
import { config } from './config.js';

let build = null; // (wallName) => { tabs: [{ key, label, icon?, pane }], onClose?: () => void } | null; pane: an element, or a function made when the tab is first shown (the board loads only then)
let onClose = null;
let dlg = null, title = null, body = null, bar = null;
let opener = null; // the button that opened it: focus goes back there
let wall = '';
let pushed = false; // did we push a history entry that closing has to undo?
let tabEls = [], panels = [], lazy = [];
let cur = 0; // the tab in view

export const registerWallSheet = (fn) => { build = fn; };

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// the tab in view: its button, the focus order, and the pane (built now if it is a lazy one); the other panes are inert, so
// focus and screen readers stay in the one on screen
function show(n) {
  if (lazy[n]) { // built the first time the tab is shown
    const made = lazy[n]();
    lazy[n] = null;
    panels[n].replaceChildren(...[made].flat().filter(Boolean));
  }
  cur = n;
  tabEls.forEach((t, i) => {
    t.setAttribute('aria-selected', String(i === n));
    t.tabIndex = i === n ? 0 : -1;
    panels[i].inert = i !== n;
  });
}

// each tab button's highlight follows the scroll: p is the position in panes (1.3 = a third of the way from tab 1 to tab 2)
const paint = (p) => tabEls.forEach((t, j) => t.style.setProperty('--on', String(Math.max(0, 1 - Math.abs(p - j)))));

function goTo(n, { focus = false, instant = false } = {}) {
  show(n);
  panels[n].scrollTop = 0; // each tab starts at its top
  body.scrollTo({ left: n * body.clientWidth, behavior: instant || reduced() ? 'instant' : 'smooth' });
  if (focus) tabEls[n].focus();
}

function make() {
  title = el('h2', { id: 'ws-title', class: 'bp-title ws-title', tabindex: '-1' });
  const back = el('button', { type: 'button', class: 'sh-done bp-back' }, '← 뒤로');
  back.addEventListener('click', () => dlg.close());
  const report = config.reportEndpoint ? el('button', { type: 'button', class: 'ws-report' }, '제보') : null;
  report?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: wall } })));
  body = el('div', { class: 'ws-body' });
  body.addEventListener('scroll', () => {
    if (!body.clientWidth) return;
    const p = body.scrollLeft / body.clientWidth;
    paint(p);
    const near = Math.max(0, Math.min(panels.length - 1, Math.round(p)));
    if (near !== cur) show(near); // a swipe settled on another pane
  }, { passive: true });
  window.addEventListener('resize', () => { if (dlg.open) body.scrollTo({ left: cur * body.clientWidth, behavior: 'instant' }); });
  bar = el('div', { class: 'ws-tabs', role: 'tablist', 'aria-label': '암장 정보 보기' });
  dlg = el('dialog', { class: 'sheet board-page wall-sheet', 'aria-labelledby': 'ws-title' },
    el('div', { class: 'ws-top' }, el('div', { class: 'sh-head' }, back, title, report)), body, bar);
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
  tabEls = built.tabs.map((t, i) => el('button', { type: 'button', role: 'tab', id: `ws-t${i}`, 'aria-controls': `ws-p${i}` },
    t.icon ? el('span', { class: 'ws-ic' }, t.icon) : null, el('span', { class: 'ws-tl' }, t.label)));
  const several = built.tabs.length > 1; // one tab: no tab bar, so its content is no tabpanel either
  lazy = built.tabs.map((t) => (typeof t.pane === 'function' ? t.pane : null));
  panels = built.tabs.map((t, i) => el('div', { ...(several ? { role: 'tabpanel', 'aria-labelledby': `ws-t${i}` } : {}), id: `ws-p${i}`, class: 'ws-panel' }, lazy[i] ? null : t.pane));
  tabEls.forEach((t, i) => {
    t.addEventListener('click', () => goTo(i));
    t.addEventListener('keydown', (e) => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabEls.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      goTo((n + tabEls.length) % tabEls.length, { focus: true });
    });
  });
  body.replaceChildren(...panels);
  bar.replaceChildren(...tabEls);
  bar.hidden = !several; // one tab: just its content
  onClose = built.onClose ?? null;
  opener = from;
  if (push) {
    const u = new URL(location.href);
    u.searchParams.set('wall', wallName);
    u.searchParams.set('info', '');
    history.pushState({ info: wallName }, '', u);
    pushed = true;
  }
  dlg.showModal();
  const first = Math.max(0, built.tabs.findIndex((t) => t.key === tab));
  show(first);
  paint(first);
  body.scrollTo({ left: first * body.clientWidth, behavior: 'instant' }); // the width is known only once the dialog is open
  title.focus();
}
