// src/planner-sheet.js — shared <dialog> bottom sheet + the "＋ 새 이름" partner-name input. No fetch/storage.
import { html, useState, useEffect, useRef } from './planner-ui.js';
import { Icon } from './planner-icons.js';

export const SWIPE_CLOSE_PX = 80;
/** Pure: did a downward drag of dy px go far enough to close? */
export const swipeShouldClose = (dy) => dy >= SWIPE_CLOSE_PX;

/** Modal <dialog>: Esc and unmount both close it natively (so focus returns to the opener). onClose runs only for a user close.
 *  Header = title left, ONE icon right: ✓ 저장 when onSave is given (the bottom 저장 button runs the same onSave), else X 닫기.
 *  A save sheet has no cancel button: Esc, a tap on the backdrop and a downward drag of the grab/header row (>= SWIPE_CLOSE_PX) close it without saving (no confirm modal). */
export function Sheet({ title, onClose, onSave, saveDisabled = false, keepOnBackdrop = false, children }) {
  const ref = useRef(null);
  const gone = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) { d.showModal(); const a = document.activeElement; if (a?.closest?.('.sh-head')) d.querySelector('#sheet-h')?.focus(); } // first-focus landed on ✓/X (a ring-drawing button): park it on the title; an autofocus field inside stays
    return () => { gone.current = true; if (d?.open) d.close(); };
  }, []);
  const away = (e) => { // a tap on the dim backdrop (outside the sheet's box) closes it
    const d = ref.current; if (e.target !== d || !d || keepOnBackdrop) return; // keepOnBackdrop: the sheet holds typed values, so only Esc / drag / ✓ end it
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  };
  const drag = useRef(null);
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches; // reduced motion: the sheet does not follow the finger, it only closes past the threshold
  const reset = () => { const d = ref.current; if (d) { d.style.transition = still() ? '' : 'transform var(--pl-dur-ui)'; d.style.transform = ''; } };
  const grip = { // header row only, so the content keeps its own scrolling; capture starts after a few px so taps on ✓/X stay plain clicks
    onPointerDown: (e) => { if (e.button > 0 || e.target.closest('button')) return; drag.current = { y: e.clientY, id: e.pointerId, dy: 0, cap: false }; },
    onPointerMove: (e) => {
      const g = drag.current; if (!g || e.pointerId !== g.id) return;
      g.dy = Math.max(0, e.clientY - g.y);
      if (g.dy > 6 && !g.cap) { e.currentTarget.setPointerCapture(e.pointerId); g.cap = true; }
      if (g.cap && !still() && ref.current) { ref.current.style.transition = 'none'; ref.current.style.transform = `translateY(${g.dy}px)`; }
    },
    onPointerUp: () => { const g = drag.current; drag.current = null; if (!g) return; reset(); if (swipeShouldClose(g.dy)) ref.current?.close(); },
    onPointerCancel: () => { drag.current = null; reset(); },
  };
  return html`<dialog ref=${ref} class="sheet" aria-labelledby="sheet-h" onClose=${() => { if (!gone.current) onClose(); }} onClick=${away}>
    <div class="grab" aria-hidden="true" ...${grip}></div>
    <div class="sh-head" ...${grip}><h2 id="sheet-h" tabindex="-1">${title}</h2>
      ${onSave ? html`<button type="button" class="sh-ic" aria-label="저장" disabled=${saveDisabled} onClick=${onSave}><${Icon} name="check" /></button>`
        : html`<button type="button" class="sh-ic" aria-label="닫기" onClick=${() => ref.current?.close()}><${Icon} name="x" /></button>`}</div>
    ${children}</dialog>`;
}

/** "＋ 새 이름": name only. onAdd(name) is saved by the caller (savePartner). Names never leave the device. */
export function NameAdd({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const input = useRef(null);
  const opener = useRef(null);
  const was = useRef(false);
  useEffect(() => { if (open) input.current?.focus(); else if (was.current) opener.current?.focus(); was.current = open; }, [open]);
  const add = () => { const n = name.trim(); if (!n) return; onAdd(n); setName(''); setOpen(false); };
  if (!open) return html`<button type="button" class="txt nm-open" ref=${opener} onClick=${() => setOpen(true)}>＋ 새 이름</button>`;
  return html`<div class="nm"><input class="in-t" aria-label="새 이름" maxlength="12" value=${name} ref=${input}
    onInput=${(e) => setName(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
    <button type="button" class="btn" disabled=${!name.trim()} onClick=${add}>추가</button></div>`;
}
