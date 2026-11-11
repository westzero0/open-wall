// src/planner-sheet.js — shared <dialog> bottom sheet + the "＋ 새 이름" partner-name input. No fetch/storage.
import { html, useState, useEffect, useRef } from './planner-ui.js';

/** Modal <dialog>: Esc and unmount both close it natively (so focus returns to the opener). onClose runs only for a user close. */
export function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  const gone = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { gone.current = true; if (d?.open) d.close(); };
  }, []);
  return html`<dialog ref=${ref} class="sheet" aria-labelledby="sheet-h" onClose=${() => { if (!gone.current) onClose(); }}>
    <div class="grab" aria-hidden="true"></div><h2 id="sheet-h">${title}</h2>${children}</dialog>`;
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
