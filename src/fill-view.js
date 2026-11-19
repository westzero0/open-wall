// src/fill-view.js — 알려 주기 rows for a wall's blank facts (docs/superpowers/specs/2026-10-30-contribution-fill-in-design.md).
// One row per blank (좌표 · 높이 · 공지 주소 · 전화), drawn where that fact would be (app.js: 높이 · 전화 · 공지 in 외벽 제원, 위치 under 주차):
// "아직 몰라요 · 알려 주기", and a tap opens the input in that row. A blank somebody already filled shows who and whether it is confirmed.
// The word is 알려 주기 everywhere (the sheet head, the empty sections, these rows; GLOSSARY.md). DOM via el()/textContent only.
import { el } from './dom.js';
import { FILL_FIELDS, cleanFillValue, isEmptyField, isNearWall } from './fill-fields.js';
import { openPinPicker } from './pin-picker.js';

const FIELD = {
  location: { label: '위치(좌표)', ph: '지도 링크나 위도, 경도', type: 'text', mode: 'text', bad: '지도 링크나 "위도, 경도"를 적어 주세요' },
  height_m: { label: '벽 높이(m)', ph: '예: 12', type: 'text', mode: 'decimal', bad: '3~40 사이 숫자만 적어 주세요 (예: 12)' },
  notice_url: { label: '공지 주소', ph: 'https://…', type: 'url', mode: 'url', bad: 'http로 시작하는 주소를 적어 주세요' },
  phone: { label: '전화', ph: '예: 031-123-4567', type: 'tel', mode: 'tel', bad: '전화번호 형식을 확인해 주세요' },
};
const SAY = { rate_limited: '잠시 뒤에 다시 알려 주세요', bad_request: '형식을 확인해 주세요' };
const HOW = '서로 다른 두 분이 같은 값을 알려 주면 확정돼요. 내 정보에서 닉네임을 정해 두면 채운 사람으로 이름이 남아요.';
const stateText = (m) => (m.status === 'confirmed' ? (m.nick ? `${m.nick} 님이 채움` : '채워진 정보') : `${m.nick ? `${m.nick} ` : ''}제보 · 확인 전`);
const doneText = (s) => (s === 'confirmed' ? '확정됐어요' : s === 'pending' ? '알려 주셨어요 · 확인 전' : '알려 주셨어요 · 운영자가 확인해요');
const line = (field, ...v) => el('li', { class: 'fill-row', 'data-field': field }, el('span', { class: 'mk' }, FIELD[field].label), el('div', { class: 'mv' }, ...v));

function row(field, onSubmit, { title, start, pick, told }) {
  const f = FIELD[field];
  const input = el('input', { class: 'fill-in', type: f.type, inputmode: f.mode, placeholder: f.ph, maxlength: '500', autocomplete: 'off', 'aria-label': f.label });
  const btn = el('button', { type: 'button', class: 'ws-ask' }, '보내기'); // the send button: 알려 주기 opened the row, 보내기 sends it (2026-11-19)
  const msg = el('p', { class: 'fill-msg', role: 'status', id: `fill-msg-${field}` });
  const note = el('p', { class: 'fill-note', role: 'status' });
  const pickBtn = field === 'location' ? el('button', { type: 'button', class: 'ws-ask fill-pick' }, '지도에서 고르기') : null;
  const close = el('button', { type: 'button', class: 'ws-chk-ask fill-close' }, '취소');
  const how = el('p', { class: 'fill-how', hidden: '' }, HOW);
  const form = el('div', { class: 'fill-body', hidden: '' }, el('div', { class: 'fill-form' }, input, btn, close), pickBtn, note, msg, how);
  const open = el('button', { type: 'button', class: 'ws-chk-ask fill-open', 'aria-label': `${f.label} 알려 주기` }, '알려 주기');
  const ask = el('p', { class: 'fill-ask' }, el('span', { class: 'fill-none' }, '아직 몰라요'), ' · ', open);
  const mv = el('div', { class: 'mv' }, ask, form);
  const box = el('li', { class: 'fill-row', 'data-field': field }, el('span', { class: 'mk' }, f.label), mv);
  open.addEventListener('click', () => { // the input opens in this row; the rule (두 분이 같은 값 …) is said on the sheet's first opened row only
    if (!told.row) told.row = box;
    how.hidden = told.row !== box;
    ask.hidden = true; form.hidden = false; input.focus?.();
  });
  close.addEventListener('click', () => { form.hidden = true; ask.hidden = false; open.focus?.(); }); // 취소: back to the one line, nothing sent
  pickBtn?.addEventListener('click', () => pick({ title, start, onPick: (p) => {
    msg.textContent = '';
    input.removeAttribute('aria-invalid');
    if (!isNearWall(start, p)) { msg.textContent = '이 암장에서 너무 멀어요. 암장 가까이에서 골라 주세요.'; input.setAttribute('aria-invalid', 'true'); return; }
    input.value = `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
    note.textContent = '지도에서 고른 위치예요. 맞으면 보내기를 눌러 주세요.'; // nothing is sent until 보내기
  } }));
  btn.addEventListener('click', async () => {
    msg.textContent = '';
    note.textContent = '';
    input.removeAttribute('aria-invalid');
    const value = cleanFillValue(field, input.value);
    if (value == null) { msg.textContent = f.bad; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', msg.getAttribute('id')); return; }
    btn.disabled = true;
    try {
      const res = await onSubmit({ field, value });
      const done = el('p', { class: 'fill-done', tabindex: '-1' }, doneText(res?.status));
      mv.replaceChildren(done);
      done.focus?.(); // the button that had focus is gone: keep the place for the keyboard and read the answer
    } catch (e) {
      msg.textContent = e?.code === 'bad_request' && field === 'location' ? '위치를 확인해 주세요. 암장에서 너무 멀면 올릴 수 없어요.' : (SAY[e?.code] ?? '지금은 보낼 수 없어요');
      btn.disabled = false;
    }
  });
  return box;
}

/**
 * fillRows({ wall, onSubmit, pick }) → { location, height_m, notice_url, phone }: a <li class="fill-row"> for each blank field (or one somebody filled), else null.
 * wall.fillMarks ({ field: { nick, status } }, set by applyFills) marks the fields filled from a report.
 * onSubmit({ field, value }) → Promise<{ status }>; a rejection's `code` picks the one-line answer.
 */
export function fillRows({ wall, onSubmit, pick = openPinPicker }) {
  const at = wall?.location ?? wall?.sun; // where the map opens: the wall's known point (a wall without a location has its sun point)
  const start = Number.isFinite(at?.lat) && Number.isFinite(at?.lng) ? { lat: at.lat, lng: at.lng } : null;
  const ctx = { title: wall?.short_name || wall?.name || '암장', start, pick, told: { row: null } }; // told: shared by this sheet's rows
  const marks = wall?.fillMarks ?? {};
  return Object.fromEntries(FILL_FIELDS.map((field) => [field, marks[field]
    ? line(field, el('p', { class: 'fill-state' }, stateText(marks[field])))
    : isEmptyField(wall, field) ? row(field, onSubmit, ctx) : null]));
}
