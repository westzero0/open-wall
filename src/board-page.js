// src/board-page.js — the board page of one wall: every post, 더 보기, the form. A full-height <dialog> opened from the wall card's
// 전체 글 보기 button or by a link (?wall=<name>&board). Opening from the card pushes that address, so the browser's back button,
// Esc and 뒤로 all close it with one history step. DOM via el()/textContent only.
import { el } from './dom.js';
import { boardBox } from './board-view.js';

let dlg = null, title = null, holder = null;
let opener = null; // the button that opened it: focus goes back there
let wall = '';
let pushed = false; // did we push a history entry that closing has to undo?

function build() {
  title = el('h2', { id: 'bp-title', class: 'bp-title', tabindex: '-1' });
  const back = el('button', { type: 'button', class: 'sh-done bp-back' }, '← 뒤로');
  back.addEventListener('click', () => dlg.close());
  holder = el('div', { class: 'bp-body' });
  dlg = el('dialog', { class: 'sheet board-page', 'aria-labelledby': 'bp-title' },
    el('div', { class: 'bp-inner' }, el('div', { class: 'sh-head' }, back, title), holder));
  dlg.addEventListener('close', () => { // 뒤로, Esc or popstate
    if (pushed) { pushed = false; history.back(); }
    // back to the button that opened it; opened by a link (or the card was re-drawn): the wall card's own 전체 글 보기, else the card's board
    const card = boardBox(wall, { mode: 'preview' });
    const o = opener?.isConnected ? opener : card?.querySelector('.bd-all:not([hidden])') ?? card;
    opener = null;
    if (o?.isConnected) o.focus();
  });
  window.addEventListener('popstate', () => { if (dlg.open) { pushed = false; dlg.close(); } });
  document.body.append(dlg);
}

/** Open the page for a wall. `from` is the button to give focus back to. `push: false` = the address is already right (a link opened it). */
export function openBoardPage(wallName, from = null, { push = true } = {}) {
  const box = boardBox(wallName, { mode: 'full' });
  if (!box) return; // board off
  if (!dlg) build();
  if (dlg.open) return;
  wall = wallName;
  title.textContent = wallName;
  holder.replaceChildren(box);
  opener = from;
  if (push) {
    const u = new URL(location.href);
    u.searchParams.set('wall', wallName);
    u.searchParams.set('board', '');
    history.pushState({ board: wallName }, '', u);
    pushed = true;
  }
  dlg.showModal();
  title.focus();
}
