// src/planner-partners.js — 동행인 sheet: list, rename, delete (second press, no modal). Names stay on this device: no network here.
// Deleting keeps plan.participants as written; plan-view's partnerNames just skips the missing name.
import { html, useState, useEffect, useRef, usePlannerState } from './planner-ui.js';
import { Sheet, NameAdd } from './planner-sheet.js';
import { randomId } from './plan-model.js';
import { SAVE_FAIL } from './plan-sheet.js';


function PartnerRow({ p, h, fail }) {
  const [edit, setEdit] = useState(null); // null | text being typed
  const [armed, setArmed] = useState(false);
  const input = useRef(null);
  const editBtn = useRef(null);
  const was = useRef(false);
  useEffect(() => { if (edit !== null && !was.current) input.current?.focus(); else if (edit === null && was.current) editBtn.current?.focus(); was.current = edit !== null; }, [edit !== null]);
  const save = () => { const n = edit.trim(); if (n && h.savePartner({ ...p, name: n })?.ok === false) fail(); setEdit(null); };
  const remove = () => { h.removePartner(p.id); setTimeout(() => document.querySelector('dialog .nm-open')?.focus(), 0); }; // the row is gone: land on 새 이름
  if (edit !== null) {
    return html`<li class="pr"><input class="in-t" aria-label="이름 고치기" maxlength="12" value=${edit} ref=${input} onInput=${(e) => setEdit(e.target.value)}
      onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
      <button type="button" class="btn" disabled=${!edit.trim()} onClick=${save}>저장</button></li>`;
  }
  return html`<li class="pr"><span class="pn">${p.name}</span>
    <button type="button" class="txt" ref=${editBtn} aria-label=${`${p.name} 고치기`} onClick=${() => setEdit(p.name)}>고치기</button>
    <button type="button" class="txt del" aria-label=${`${p.name} ${armed ? '한 번 더 누르면 지워요' : '지우기'}`} onBlur=${() => setArmed(false)} onClick=${() => (armed ? remove() : setArmed(true))}>${armed ? '한 번 더 누르면 지워요' : '지우기'}</button></li>`;
}

export function PartnersSheet({ store, handlers: h }) {
  const s = usePlannerState(store);
  const [err, setErr] = useState('');
  if (s.sheet !== 'partners') return null;
  const fail = () => setErr(SAVE_FAIL);
  return html`<${Sheet} title="동행인" onClose=${h.onClose}>
    <ul class="prs">${s.db.partners.map((p) => html`<${PartnerRow} key=${p.id} p=${p} h=${h} fail=${fail} />`)}</ul>
    <${NameAdd} onAdd=${(name) => { if (h.savePartner({ id: randomId(), name })?.ok === false) fail(); else setErr(''); }} />
    <p class="err" role="alert">${err}</p>
    <div class="row2"><button type="button" class="btn" onClick=${h.onClose}>닫기</button></div>
  <//>`;
}
