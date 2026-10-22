// src/sheet-gestures.js — the two ways out people expect of a bottom sheet: a tap on the dark backdrop, and a pull down on the grab bar at its top.
// Called by dialog-back.js whenever a .sheet is opened (idempotent). The backdrop tap is left to the sheets that have no text field (a typed note must not be
// lost to a stray tap; those keep the 완료 ✓, Esc and 뒤로). The pull follows the finger, closes past 90px or on a quick flick, and otherwise springs back.
const CLOSE_PX = 90, FLICK = 0.6; // px, px/ms
const TEXT_FIELD = 'textarea, input:not([type=radio], [type=checkbox], [type=range], [type=button], [type=hidden], [type=submit])';

export function enhanceSheet(dlg) {
  if (dlg.dataset.sheetGestures || !dlg.classList.contains('sheet') || dlg.classList.contains('wall-sheet')) return;
  dlg.dataset.sheetGestures = '1';
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
  let id = null, y0 = 0, t0 = 0, dy = 0;
  grab.addEventListener('pointerdown', (e) => {
    id = e.pointerId; y0 = e.clientY; t0 = e.timeStamp; dy = 0;
    grab.setPointerCapture(id);
    dlg.style.transition = 'none';
  });
  grab.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    dy = Math.max(0, e.clientY - y0);
    dlg.style.transform = `translateY(${dy}px)`;
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    const fast = dy / Math.max(1, e.timeStamp - t0) > FLICK;
    dlg.style.transition = ''; // back to the sheet's own transition: it leaves from where the finger let go, or springs back
    if (e.type === 'pointerup' && (dy > CLOSE_PX || (dy > 24 && fast))) dlg.close();
    dlg.style.transform = '';
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
}
