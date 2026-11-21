// src/sheet-gestures.js — the ways out people expect of a bottom sheet: a tap on the dark backdrop, and a pull down.
// Called by dialog-back.js whenever a <dialog class="sheet"> is opened (idempotent). The backdrop tap is left to the normal sheets that have no text field
// (a typed note must not be lost to a stray tap; those keep the 완료 ✓, Esc and 뒤로); the wall sheet gets no backdrop tap and no grab bar.
// The pull follows the finger from the grab bar / the head row (.sh-head; the wall sheet's .sh-sky) with a mouse or a finger, and from anywhere in the
// sheet with a finger once its scrolled content is at the top (a mostly-vertical downward move; sideways moves, the hours axis and range inputs are left alone).
// Past 90px or on a flick the sheet slides off the bottom and closes; otherwise it springs back by the sheet's own transition.
const CLOSE_PX = 90, FLICK = 0.6, SLIDE_MS = 200; // px, px/ms, ms
const TEXT_FIELD = 'textarea, input:not([type=radio], [type=checkbox], [type=range], [type=button], [type=hidden], [type=submit])';
const HEAD = '.sheet-grab, .sh-head, .sh-sky';
const PRESS = 'button, a, input, select, textarea, [role=tab], [data-hold-fold]'; // a press on these never starts a pull from the head
const NO_BODY = '[data-hold-fold], .g-zone, input[type=range], textarea'; // sideways / own-gesture parts: no body pull

/** Close on a long pull, or a short quick one (dy px in ms). */
export const shouldCloseSheet = (dy, ms) => dy > CLOSE_PX || (dy > 24 && dy / Math.max(1, ms) > FLICK);

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// every vertical scroller between the touch and the sheet is at its top
const atTop = (t, dlg) => {
  for (let n = t; n && n !== dlg.parentNode; n = n.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(n).overflowY) && n.scrollTop > 0) return false;
    if (n === dlg) break;
  }
  return true;
};

function pull(dlg) {
  let y0 = 0, t0 = 0, dy = 0, busy = false;
  const start = (y, t) => { y0 = y; t0 = t; dy = 0; dlg.style.transition = 'none'; };
  const move = (y) => { dy = Math.max(0, y - y0); dlg.style.transform = `translateY(${dy}px)`; };
  const end = (t, cancelled) => {
    const go = !cancelled && shouldCloseSheet(dy, t - t0);
    if (!go || reduced()) {
      dlg.style.transition = ''; // the sheet's own transition: springs back, or (reduced motion) fades out from here
      dlg.style.transform = '';
      if (go) dlg.close();
      return;
    }
    busy = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      dlg.removeEventListener('transitionend', onEnd);
      dlg.style.transition = 'none'; // keep the inline transform while the sheet fades away: no jump up to the CSS exit position
      dlg.close();
      setTimeout(() => { dlg.style.transition = ''; dlg.style.transform = ''; busy = false; }, 300);
    };
    const onEnd = (e) => { if (e.target === dlg && e.propertyName === 'transform') finish(); };
    dlg.addEventListener('transitionend', onEnd);
    setTimeout(finish, SLIDE_MS + 60);
    dlg.style.transition = `transform ${SLIDE_MS}ms ease-out`;
    dlg.style.transform = 'translateY(100%)';
  };

  // mouse: from the grab bar or the head row
  let id = null;
  dlg.addEventListener('pointerdown', (e) => {
    if (busy || e.pointerType !== 'mouse' || e.button !== 0 || !e.target.closest(HEAD) || e.target.closest(PRESS)) return;
    id = e.pointerId;
    dlg.setPointerCapture(id);
    start(e.clientY, e.timeStamp);
  });
  dlg.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e.clientY); });
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    end(e.timeStamp, e.type === 'pointercancel');
  };
  dlg.addEventListener('pointerup', up);
  dlg.addEventListener('pointercancel', up);

  // finger: from the head row, or the content when it is at its top (touchmove must be non-passive to take the gesture from the scroller)
  let mode = 0, x0 = 0; // 0 idle, 1 watching, 2 pulling, 3 refused
  dlg.addEventListener('touchstart', (e) => {
    mode = 0;
    if (busy || e.touches.length !== 1) return;
    const t = e.target, h = t.closest?.(HEAD);
    if (h ? t.closest(PRESS) : (t.closest?.(NO_BODY) || !atTop(t, dlg))) return;
    mode = 1; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = e.timeStamp;
  }, { passive: true });
  dlg.addEventListener('touchmove', (e) => {
    if (mode === 0 || mode === 3) return;
    const { clientX: x, clientY: y } = e.touches[0];
    if (mode === 1) {
      const ax = Math.abs(x - x0), ay = y - y0;
      if (ay > 8 && ay > ax) { mode = 2; start(y, t0); } // pulled from the first touch point: no jump; the 8px dead zone is gone with the first move
      else if (ax > 8 || ay < -8) { mode = 3; return; }
      else return;
    }
    e.preventDefault();
    move(y);
  }, { passive: false });
  const touchEnd = (e) => {
    const m = mode;
    mode = 0;
    if (m === 2) end(e.timeStamp, e.type === 'touchcancel');
  };
  dlg.addEventListener('touchend', touchEnd);
  dlg.addEventListener('touchcancel', touchEnd);
}

export function enhanceSheet(dlg) {
  if (dlg.dataset.sheetGestures || !dlg.classList.contains('sheet')) return;
  dlg.dataset.sheetGestures = '1';
  pull(dlg);
  if (dlg.classList.contains('wall-sheet')) return;
  if (!dlg.querySelector(TEXT_FIELD)) {
    let down = false; // a press that began inside and ended on the backdrop is not a tap outside
    dlg.addEventListener('pointerdown', (e) => { down = e.target === dlg; });
    dlg.addEventListener('click', (e) => { if (e.target === dlg && down) dlg.close(); });
  }
  const form = dlg.querySelector('form');
  if (!form) return;
  const grab = document.createElement('div');
  grab.className = 'sheet-grab';
  grab.setAttribute('aria-hidden', 'true');
  form.prepend(grab);
}
