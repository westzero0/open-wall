// src/wall-sheet.js — the info sheet of one wall: a full-height <dialog> with a bottom tab bar, opened from the wall card's 자세히 ›
// or by a link (?wall=<name>&info). Opening from the card pushes that address, so the browser's back button, Esc and 뒤로 all close it
// with one history step (the same rules as the board page). The panes are drawn by app.js, which registers a builder
// (the hours grid, seasonal sun and fee table live there, next to the view state they read). DOM via el()/textContent only.
// The panes sit side by side in one scroll-snapped row: swiping sideways or tapping a tab moves between them; each pane scrolls
// up and down by itself. A part that needs sideways drags (the hours line) sets touch-action: pan-y, so a swipe there is not a tab change.
// From 1024px up (`wide`) the panes are stacked in one column that scrolls as a whole: the tab bar sits under the head, a tab scrolls to
// its section, and scrolling marks the tab of the section in view. A change of width keeps the section in view.
import { el } from './dom.js';
import { nameBreak, TAB_KINDS } from './wall-sheet-model.js';
import { climber } from './sun-scene.js';

// one builder per kind of place ('wall'; a 싱글피치 crag brings its own): (name) => { head: { tone, sunT, region, chip, ok, report }, tabs: [{ key, label, icon?, pane, kinds? }], onClose?, addr?, focusBack?, reportCrag? } | null
// pane: an element, or a function made when the tab is first shown (the board loads only then); kinds: the report kinds that tab offers (else TAB_KINDS[key])
// addr: { param, flag } the address keys of this kind (the wall's ?wall=&info, a crag's ?crag=&<tab>); flag may be a function of the tab's key. focusBack(): the button to focus when the opener is gone. reportCrag: 알려 주기 sends a crag report
const builders = {};
let built = null; // what the open sheet was built from (its report and address keys)
let onClose = null;
let dlg = null, title = null, body = null, bar = null, sky = null, sub = null, contact = null, ok = null, rep = null, plan = null, planbar = null;
let opener = null; // the button that opened it: focus goes back there
let focusBack = null; // built.focusBack of the open sheet
let wall = '';
let pushed = false; // did we push a history entry that closing has to undo?
let tabEls = [], panels = [], lazy = [];
let flashTimer = 0;
let tabKeys = [];
let cur = 0; // the tab in view

export const registerWallSheet = (fn, kind = 'wall') => { builders[kind] = fn; };

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = matchMedia('(min-width: 1024px)'); // the one width test (the same edge as style.css's wide layout)
let spyHold = 0; // a tab press scrolls smoothly: the tab marks stay on the pressed one until it arrives

// the tab in view: its button, the focus order, and the pane (built now if it is a lazy one); the other panes are inert, so
// focus and screen readers stay in the one on screen
function build(n) {
  if (!lazy[n]) return;
  const made = lazy[n](); // built the first time the tab is shown (wide: all at once when the sheet opens, so the column's height is known)
  lazy[n] = null;
  panels[n].replaceChildren(...[made].flat().filter(Boolean));
}
function show(n) {
  build(n);
  cur = n;
  (wide.matches ? body : panels[n]).querySelectorAll('.sx-pane').forEach((p) => p.fit?.()); // its segment rows: shown only when the parts are longer than a screen
  foldNow(); // a tab shown at its top unfolds the sky (only the pane's own scroll did, so a fold carried over)
  tabEls.forEach((t, i) => {
    t.setAttribute('aria-selected', String(i === n));
    t.tabIndex = i === n ? 0 : -1;
    panels[i].inert = !wide.matches && i !== n; // wide: every pane is on screen
  });
}

// Phone: reading down a pane folds the sky to its words in step with the scroll (f = 0..1; the sun picture fades, the band shrinks by skyR px).
// skyFull / skyR = the band's height unfolded / the room folding frees (measured, see measureSky); foldF = the fold now.
let skyFull = 0, skyR = 0, foldF = 0, foldRaf = 0, foldHeld = false;
function applyFold(f) {
  foldF = f;
  const mid = f > 0 && f < 1 && skyFull > 0;
  sky.classList.toggle('is-compact', f >= 1); // fully folded: the CSS compact rules (big text, 320px) take over
  sky.style.setProperty('--fold', String(f));
  sky.style.height = mid ? `${skyFull - f * skyR}px` : '';
  sky.style.minHeight = mid ? '0' : ''; // else the band's own min-height would stop the shrink
}
// the band's two heights, taken in one synchronous block (no paint between): on open, resize and a text-size change
function measureSky() {
  if (!dlg?.open || wide.matches) return;
  const f = foldF;
  applyFold(0);
  const full = sky.offsetHeight;
  applyFold(1);
  skyFull = full;
  skyR = Math.max(0, full - sky.offsetHeight);
  applyFold(f);
}
// the fold the pane in view asks for. A pane is left alone unless it has room: its scroll range, measured as if unfolded, must exceed R + 48.
// The fold is spread over D = min(R, range - R) px of scroll, so folding (the pane grows by R) never shrinks the range below the scroll position (no clamp, no jitter at the bottom).
function foldNow() {
  foldRaf = 0;
  if (wide.matches || !dlg?.open || foldHeld) return; // a drag of the hours axis keeps the head as it is (the pane may scroll a little under the finger)
  const p = panels[cur];
  let f = 0;
  if (p && skyFull) {
    const range = p.scrollHeight - p.clientHeight + (skyFull - sky.offsetHeight);
    const d = Math.min(Math.max(skyR, 48), range - skyR);
    if (d >= 48) f = Math.min(1, Math.max(0, p.scrollTop / d));
  }
  if (f !== foldF) applyFold(f);
}

// wide: where pane n starts in the column's scroll; the pane in view is the last one that has reached the top
const topOf = (n) => panels[n].getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
function spy() {
  if (spyHold || !panels.length) return;
  let n = 0;
  panels.forEach((_, i) => { if (topOf(i) <= body.scrollTop + 8) n = i; });
  if (n !== cur) { show(n); paint(n); }
}

// each tab button's highlight follows the scroll: p is the position in panes (1.3 = a third of the way from tab 1 to tab 2)
const paint = (p) => tabEls.forEach((t, j) => t.style.setProperty('--on', String(Math.max(0, 1 - Math.abs(p - j)))));

function goTo(n, { focus = false, instant = false } = {}) {
  if (wide.matches) { // one column: scroll to the section; a press moves focus to its heading, the arrow keys keep it on the tabs
    const smooth = !instant && !reduced();
    clearTimeout(spyHold);
    if (smooth) spyHold = setTimeout(() => { spyHold = 0; spy(); }, 600); else spyHold = 0;
    show(n);
    paint(n);
    body.scrollTo({ top: topOf(n), behavior: smooth ? 'smooth' : 'instant' });
    if (focus) tabEls[n].focus();
    else if (!instant) { const h = panels[n].querySelector('h2, h3, h4') ?? panels[n]; h.tabIndex = -1; h.focus({ preventScroll: true }); }
    return;
  }
  if (n !== cur) panels[n].scrollTop = 0; // each tab starts at its top (tapping the tab already in view leaves its scroll alone)
  show(n);
  body.scrollTo({ left: n * body.clientWidth, behavior: instant || reduced() ? 'instant' : 'smooth' });
  if (focus) tabEls[n].focus();
}

// the climber of the sun card's picture (sun-scene.js), small, standing in front of the slab; its headlamp shows only under .k-night (sheet.css), so the time axis needs no extra call
function person() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'sk-climber');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.append(climber({ x: 10, y: 23, u: 20 }, true));
  return svg;
}

function make() {
  title = el('h2', { id: 'ws-title', class: 'sk-title ws-title', tabindex: '-1' });
  sub = el('p', { class: 'sk-sub' });
  contact = el('div', { class: 'sk-contact', role: 'group', 'aria-label': '연락' }); // 전화 / 공지 …: only the ones this wall has; empty = hidden
  ok = el('button', { type: 'button', class: 'sk-ok', 'aria-label': '닫기' });
  ok.addEventListener('click', () => dlg.close());
  rep = el('button', { type: 'button', class: 'sk-rep' }, '알려 주기'); // the one word for telling a fact (the empty sections and the blank rows say it too). On the name line: the report sheet opens on the kinds of the tab in view
  rep.addEventListener('click', () => { const k = built?.tabs[cur]?.kinds ?? TAB_KINDS[tabKeys[cur]]; if (k) document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: wall, kind: k[0], kinds: k, ...(built.reportCrag ? { crag: true } : {}) } })); });
  plan = el('a', { class: 'btn ws-plan' }, '이 외벽으로 일정 잡기'); // built.plan: the planner's new-plan address for this wall, opened in this tab (a move into the planner, not an outside page); none = no row. Sits in the .ws-planbar row above the tabs
  planbar = el('div', { class: 'ws-planbar' }, plan);
  sky = el('header', { class: 'sh-sky' }, el('div', { class: 'sk-txt' }, title, sub, contact), el('div', { class: 'sk-act' }, rep, ok),
    el('div', { class: 'sk-scene', 'aria-hidden': 'true' }, el('span', { class: 'sk-disc' }), el('span', { class: 'sk-slab' }), person(), el('span', { class: 'sk-ground' })));
  body = el('div', { class: 'ws-body' });
  body.addEventListener('scroll', () => {
    if (wide.matches) { spy(); return; }
    if (!body.clientWidth) return;
    const p = body.scrollLeft / body.clientWidth;
    paint(p);
    const near = Math.max(0, Math.min(panels.length - 1, Math.round(p)));
    if (near !== cur) show(near); // a swipe settled on another pane
  }, { passive: true });
  // reading down a pane folds the sky to its words (the sun picture goes) so the pane gets the room; back at its top it unfolds (foldNow, once per frame)
  let segRaf = 0; // the segment rows' marks follow any scroll in the sheet (a panel's, or the wide column's), once per frame
  body.addEventListener('scroll', () => { segRaf ||= requestAnimationFrame(() => { segRaf = 0; body.querySelectorAll('.sx-pane').forEach((p) => p.spy?.()); }); }, { capture: true, passive: true });
  body.addEventListener('scroll', (e) => {
    const p = e.target;
    if (wide.matches || p !== panels[cur] || foldRaf) return;
    foldRaf = requestAnimationFrame(foldNow);
  }, { capture: true, passive: true });
  body.addEventListener('pointerdown', (e) => { if (e.target.closest?.('[data-hold-fold]')) foldHeld = true; }, { passive: true }); // app.js marks the hours axis
  const release = () => { if (foldHeld) { foldHeld = false; foldRaf ||= requestAnimationFrame(foldNow); } };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('resize', () => { if (dlg.open) body.querySelectorAll('.sx-pane').forEach((p) => p.fit?.()); });
  window.addEventListener('resize', () => { if (dlg.open && !wide.matches) { body.scrollTo({ left: cur * body.clientWidth, behavior: 'instant' }); measureSky(); foldNow(); } });
  if (typeof MutationObserver === 'function') new MutationObserver(() => { measureSky(); foldNow(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-text'] }); // text size changed: the band's heights changed
  wide.addEventListener('change', () => { // the window crossed 1024px: the same section stays in view in the other layout
    if (!dlg.open) return;
    const n = cur;
    clearTimeout(spyHold); spyHold = 0;
    if (wide.matches) {
      applyFold(0);
      body.scrollLeft = 0;
      panels.forEach((p) => { p.scrollTop = 0; });
      panels.forEach((_, i) => build(i));
    } else {
      body.scrollTop = 0;
      measureSky();
    }
    body.querySelectorAll('.sx-pane').forEach((p) => p.fit?.()); // the scroller changed (the panel or the column)
    show(n);
    paint(n);
    if (wide.matches) body.scrollTo({ top: topOf(n), behavior: 'instant' });
    else body.scrollTo({ left: n * body.clientWidth, behavior: 'instant' });
  });
  bar = el('div', { class: 'ws-tabs', role: 'tablist', 'aria-label': '암장 정보 보기' });
  dlg = el('dialog', { class: 'sheet board-page wall-sheet is-wall', 'aria-labelledby': 'ws-title' },
    sky, planbar, bar, body); // the tabs come before their panes for the keyboard and screen readers; CSS (order) puts them (and the plan row above them) at the foot
  dlg.addEventListener('close', () => { // 뒤로, Esc or popstate
    if (pushed) { pushed = false; history.back(); }
    onClose?.();
    onClose = null;
    // back to the button that opened it; opened by a link (or the card was re-drawn): the card's own 자세히 › for this wall
    // (the list card's 운영·이용·게시판 rows are .pv-go, the map card's is [data-sheet-open]; a news card is gone by now: the wall's own row, then the first news card)
    // a crag's card row is .crag-row (its head is .crag-head): its sheet asks for the very row that opened it first (focusBack)
    const rows = [...document.querySelectorAll('.row, .crag-row')].filter((r) => r.wallName === wall);
    const row = rows.find((r) => r.classList.contains('is-open')) ?? rows[0];
    const own = focusBack?.() ?? [...document.querySelectorAll('.row.is-open [data-sheet-open]')].find((b) => b.dataset.name === wall) ?? row?.querySelector('[data-sheet-open], .pv-go') ?? row?.querySelector('.row-btn, .crag-head') ?? document.querySelector('.cs-main');
    const o = opener?.isConnected ? opener : own;
    opener = null;
    o?.focus();
  });
  window.addEventListener('popstate', () => { if (dlg.open) { pushed = false; dlg.close(); } });
  document.body.append(dlg);
}

const setSky = (h, keepFold = true) => {
  const f = keepFold ? foldF : 0; // a drag of the hours line repaints the sky, not its fold (the inline --fold / height stay; the class is re-set)
  sky.className = `sh-sky ${h?.tone ?? 'k-none'}`;
  applyFold(f);
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
  setSky(h, false); // every open starts unfolded
  ok.replaceChildren(...(h?.ok ? [h.ok] : []));
  rep.hidden = !h?.report;
  contact.replaceChildren(...(h?.contacts ?? []));
  contact.hidden = !contact.childElementCount;
  sky.classList.remove('is-opening');
  void sky.offsetWidth; // restart the rise on every open, even when another wall replaces the one in view
  if (!reduced()) sky.classList.add('is-opening');
}
// what scrolls a pane's content: the column (wide) or the tab's own panel
const scroller = (node) => (wide.matches ? body : node.closest('.ws-panel') ?? body);
// scroll sc so that node sits just under the sticky segment row (segH px)
function scrollUnder(sc, node, segH, smooth = false) {
  const top = sc.scrollTop + node.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8 - segH;
  sc.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'instant' });
}
/** Open the sheet for a wall. `from` is the button to give focus back to. `push: false` = the address is already right (a link opened it). `kind`: which registered builder ('wall', or a crag's). `tab`: the key of the tab to start on (an unknown key = the first). `section`: a section key of that tab to scroll to and mark. Returns true when it opened. */
export function openWallSheet(wallName, from = null, { push = true, tab = null, section = null, kind = 'wall' } = {}) {
  const made = builders[kind]?.(wallName);
  if (!made?.tabs.length) return false; // not registered, or an unknown wall
  if (!dlg) make();
  if (dlg.open) return false; // a sheet is already open: the caller must not think this one is
  built = made;
  focusBack = built.focusBack ?? null;
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
  const first = Math.max(0, built.tabs.findIndex((t) => t.key === tab));
  if (push) {
    const { param = 'wall', flag = 'info' } = built.addr ?? {};
    const u = new URL(location.href);
    u.searchParams.set(param, wallName);
    u.searchParams.set(typeof flag === 'function' ? flag(built.tabs[first].key) : flag, '');
    history.pushState({ info: wallName }, '', u);
    pushed = true;
  }
  dlg.showModal();
  body.scrollTop = 0;
  measureSky(); // the band is laid out now (title, text size): its unfolded and folded heights
  if (wide.matches) panels.forEach((_, i) => build(i));
  show(first);
  paint(first);
  if (wide.matches) body.scrollTo({ top: topOf(first), behavior: 'instant' });
  else body.scrollTo({ left: first * body.clientWidth, behavior: 'instant' }); // the width is known only once the dialog is open
  planbar.hidden = !built.plan;
  if (built.plan) plan.setAttribute('href', built.plan); else plan.removeAttribute('href');
  title.focus();
  const sec = section && panels[first]?.querySelector(`[data-sec="${section}"]`); // a section asked for (the card's 주차 line): scrolled into view and marked for a moment
  if (sec) {
    const p = panels[first]; // only the panel scrolls (wide: the column): scrollIntoView would also move the overflow:hidden dialog, pushing the head off screen
    scrollUnder(wide.matches ? body : p, sec, p.querySelector('.sx-seg')?.offsetHeight ?? 0); // less the segment row that stays on top
    sec.closest('.sx-pane')?.spy?.(); // its segment button is marked now, not a frame later
    dlg.scrollTop = 0;
    if (!wide.matches) body.scrollTop = 0;
    sec.classList.add('flash');
    clearTimeout(flashTimer); // a reopen within the 1.6 s must not have its mark wiped by the earlier timer
    flashTimer = setTimeout(() => sec.classList.remove('flash'), 1600);
  }
  return true;
}

// segmentPane(name, label, items) → the part of a tab that is long, cut into parts laid one under another (items: [{ key, label, nodes }]).
// A row of text buttons (.sx-seg, sheet.css) stays on top: a press scrolls to that part (focus goes to its heading), and scrolling marks the
// button of the part in view (aria-current). A part with nothing in it is left out, and one part alone needs no row; nor do parts that fit on one screen (fit). `name` only names the row.
export function segmentPane(name, label, items) {
  const parts = items.map((i) => ({ ...i, nodes: i.nodes.filter(Boolean) })).filter((i) => i.nodes.length);
  if (parts.length < 2) return el('div', { class: 'sx-pane' }, ...parts.flatMap((p) => p.nodes));
  const btns = parts.map((p) => el('button', { type: 'button', 'data-label': p.label }, p.label));
  const boxes = parts.map((p) => el('div', { class: 'sx-part', 'data-part': p.key }, ...p.nodes));
  const seg = el('div', { class: 'sx-seg', role: 'group', 'aria-label': label }, ...btns);
  const pane = el('div', { class: 'sx-pane', 'data-seg': name }, seg, ...boxes);
  let at = -1, hold = 0, rest = -1; // the part marked; a press holds its mark while its scroll runs, and after it until the reader scrolls (rest: where it stopped)
  const mark = (n) => { if (n === at) return; at = n; btns.forEach((b, i) => (i === n ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'))); };
  pane.spy = () => {
    if (hold || !pane.isConnected) return;
    const sc = scroller(pane);
    if (sc.scrollTop === rest) return; // a short pane stopped short of the pressed part: it stays marked
    rest = -1;
    const line = seg.getBoundingClientRect().bottom + 8;
    let n = 0;
    boxes.forEach((b, i) => { if (b.getBoundingClientRect().top <= line) n = i; });
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2 && pane.getBoundingClientRect().bottom <= sc.getBoundingClientRect().bottom + 2) n = boxes.length - 1; // at the very end: a short last part never reaches the top
    mark(n);
  };
  btns.forEach((b, i) => b.addEventListener('click', () => {
    const smooth = !reduced();
    clearTimeout(hold);
    hold = setTimeout(() => { hold = 0; rest = scroller(pane).scrollTop; }, smooth ? 600 : 100); // the scroll this press makes keeps the pressed mark (a short pane may stop short of the part, or at its very end)
    mark(i);
    scrollUnder(scroller(pane), boxes[i], seg.offsetHeight, smooth);
    const h = boxes[i].querySelector('h2, h3, h4') ?? boxes[i];
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }));
  // the row only when the parts are longer than one screen of the scroller (measured without the row, so hiding it cannot flip the answer)
  pane.fit = () => {
    const sc = pane.isConnected && scroller(pane);
    if (!sc?.clientHeight) return; // not laid out yet (the dialog is closed)
    seg.hidden = pane.offsetHeight - (seg.hidden ? 0 : seg.offsetHeight + 8) <= sc.clientHeight;
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => pane.fit()).observe(pane); // put on screen, built, text size, width
  mark(0);
  return pane;
}
