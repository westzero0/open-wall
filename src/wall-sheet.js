// src/wall-sheet.js — the info sheet of one wall: a full-height <dialog> with a bottom tab bar, opened from the wall card's 자세히 ›
// or by a link (?wall=<name>&info). Opening from the card pushes that address, so the browser's back button, Esc and 뒤로 all close it
// with one history step (the same rules as the board page). The panes are drawn by app.js, which registers a builder
// (the hours grid, seasonal sun and fee table live there, next to the view state they read). DOM via el()/textContent only.
// The panes sit side by side in one scroll-snapped row: swiping sideways or tapping a tab moves between them; each pane scrolls
// up and down by itself. A part that needs sideways drags (the hours line) sets touch-action: pan-y, so a swipe there is not a tab change.
import { el } from './dom.js';
import { nameBreak, TAB_KINDS } from './wall-sheet-model.js';

let build = null; // (wallName) => { head: { tone, sunT, region, chip, ok }, tabs: [{ key, label, icon?, pane }], onClose?: () => void } | null; pane: an element, or a function made when the tab is first shown (the board loads only then)
let onClose = null;
let dlg = null, title = null, body = null, bar = null, sky = null, sub = null, ok = null, rep = null;
let opener = null; // the button that opened it: focus goes back there
let wall = '';
let pushed = false; // did we push a history entry that closing has to undo?
let tabEls = [], panels = [], lazy = [];
let flashTimer = 0;
let tabKeys = [];
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
  if (n !== cur) panels[n].scrollTop = 0; // each tab starts at its top (tapping the tab already in view leaves its scroll alone)
  show(n);
  body.scrollTo({ left: n * body.clientWidth, behavior: instant || reduced() ? 'instant' : 'smooth' });
  if (focus) tabEls[n].focus();
}

function make() {
  title = el('h2', { id: 'ws-title', class: 'sk-title ws-title', tabindex: '-1' });
  sub = el('p', { class: 'sk-sub' });
  ok = el('button', { type: 'button', class: 'sk-ok', 'aria-label': '닫기' });
  ok.addEventListener('click', () => dlg.close());
  rep = el('button', { type: 'button', class: 'sk-rep' }, '제보하기'); // on the name line: the report sheet opens on the kinds of the tab in view
  rep.addEventListener('click', () => { const k = TAB_KINDS[tabKeys[cur]]; if (k) document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: wall, kind: k[0], kinds: k } })); });
  sky = el('header', { class: 'sh-sky' }, el('div', { class: 'sk-txt' }, title, sub), el('div', { class: 'sk-act' }, rep, ok),
    el('div', { class: 'sk-scene', 'aria-hidden': 'true' }, el('span', { class: 'sk-disc' }), el('span', { class: 'sk-slab' }), el('span', { class: 'sk-ground' })));
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
  dlg = el('dialog', { class: 'sheet board-page wall-sheet is-wall', 'aria-labelledby': 'ws-title' },
    sky, bar, body); // the tabs come before their panes for the keyboard and screen readers; CSS (order) puts them at the foot
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

const setSky = (h) => {
  sky.className = `sh-sky ${h?.tone ?? 'k-none'}`;
  sky.style.setProperty('--sun-t', String(h?.sunT ?? 0.5));
  sub.replaceChildren(...[h?.region, h?.chip && el('span', { class: 'sk-chip' }, h.chip)].filter(Boolean));
};
/** The time axis is being dragged: the sky, the sun and the chip follow it (the sun glides by CSS; no rise replay, no button changes). */
export function updateWallHead(h) {
  if (!dlg?.open) return;
  const opening = sky.classList.contains('is-opening');
  setSky(h);
  if (opening) sky.classList.add('is-opening');
}
// the head: the sun card's sky for this wall at the viewed time, the name, one line (region + 양달/응달 chip) and the ✓; the sun climbs to its place once, unless motion is reduced
function paintHead(h) {
  setSky(h);
  ok.replaceChildren(...(h?.ok ? [h.ok] : []));
  rep.hidden = !h?.report;
  sky.classList.remove('is-opening');
  void sky.offsetWidth; // restart the rise on every open, even when another wall replaces the one in view
  if (!reduced()) sky.classList.add('is-opening');
}
/** Open the sheet for a wall. `from` is the button to give focus back to. `push: false` = the address is already right (a link opened it). `tab`: the key of the tab to start on (an unknown key = the first). `section`: a section key of that tab to scroll to and mark. */
export function openWallSheet(wallName, from = null, { push = true, tab = null, section = null } = {}) {
  const built = build?.(wallName);
  if (!built?.tabs.length) return; // not registered, or an unknown wall
  if (!dlg) make();
  if (dlg.open) return;
  wall = wallName;
  const split = nameBreak(wallName); // a long name with no space breaks ahead of its kind of place (인공암벽장 …), not inside a word
  if (split) title.replaceChildren(split[0], document.createElement('wbr'), split[1]);
  else title.textContent = wallName;
  paintHead(built.head);
  tabEls = built.tabs.map((t, i) => el('button', { type: 'button', role: 'tab', id: `ws-t${i}`, 'aria-controls': `ws-p${i}` },
    t.icon ? el('span', { class: 'ws-ic' }, t.icon) : null, el('span', { class: 'ws-tl' }, t.label)));
  tabKeys = built.tabs.map((t) => t.key);
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
  rep.textContent = '제보하기'; // measured with the full word first
  rep.textContent = title.offsetHeight > parseFloat(getComputedStyle(title).lineHeight) * 1.5 ? '제보' : '제보하기'; // a name on two lines leaves the button less room: the short word
  title.focus();
  const sec = section && panels[first]?.querySelector(`[data-sec="${section}"]`); // a section asked for (the card's 주차 line): scrolled into view and marked for a moment
  if (sec) {
    const p = panels[first]; // only the panel scrolls: scrollIntoView would also move the overflow:hidden dialog and body, pushing the head off screen
    p.scrollTop = sec.offsetTop - p.offsetTop - 8;
    dlg.scrollTop = 0;
    body.scrollTop = 0;
    sec.classList.add('flash');
    clearTimeout(flashTimer); // a reopen within the 1.6 s must not have its mark wiped by the earlier timer
    flashTimer = setTimeout(() => sec.classList.remove('flash'), 1600);
  }
}
