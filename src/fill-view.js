// src/fill-view.js — 알려 주기 rows for a wall's blank facts (docs/superpowers/specs/2026-10-30-contribution-fill-in-design.md).
// One row per SECTION, not per blank (as the planner's place page): the label is the blank names joined ' · ' (fill-fields.js FILL_NAMES: 높이 · 공지),
// the value is the word 알려 주기. A tap opens, inside that row, the input for every blank of the section, stacked, each with its label; 취소 folds them all back.
// 외벽 제원 groups 높이 · 전화 · 공지 (ask.specs), 주차 holds 위치 (ask.parking). A blank somebody already filled keeps its own row (the fill-state line: who, confirmed or not).
// The word is 알려 주기 everywhere (the sheet head, the empty sections, these rows; GLOSSARY.md). DOM via el()/textContent only.
import { el } from './dom.js';
import { FILL_FIELDS, FILL_SECTIONS, blanksOf, cleanFillValue, isNearWall } from './fill-fields.js';
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

// one blank's input, labelled: the field label above, then input · 보내기, the note and message lines
function form(field, onSubmit, { title, start, pick }) {
  const f = FIELD[field];
  const input = el('input', { class: 'fill-in', type: f.type, inputmode: f.mode, placeholder: f.ph, maxlength: '500', autocomplete: 'off', 'aria-label': f.label });
  const btn = el('button', { type: 'button', class: 'ws-ask' }, '보내기'); // the send button: 알려 주기 opened the row, 보내기 sends it (2026-11-19)
  const msg = el('p', { class: 'fill-msg', role: 'status', id: `fill-msg-${field}` });
  const note = el('p', { class: 'fill-note', role: 'status' });
  const pickBtn = field === 'location' ? el('button', { type: 'button', class: 'ws-ask fill-pick' }, '지도에서 고르기') : null;
  const label = el('p', { class: 'fill-label' }, f.label);
  const box = el('div', { class: 'fill-field', 'data-field': field }, label, el('div', { class: 'fill-form' }, input, btn), pickBtn, note, msg);
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
      box.replaceChildren(label, done); // this blank is answered; the others in the row stay open
      done.focus?.(); // the button that had focus is gone: keep the place for the keyboard and read the answer
    } catch (e) {
      msg.textContent = e?.code === 'bad_request' && field === 'location' ? '위치를 확인해 주세요. 암장에서 너무 멀면 올릴 수 없어요.' : (SAY[e?.code] ?? '지금은 보낼 수 없어요');
      btn.disabled = false;
    }
  });
  return { box, input };
}

// one section's row: label = the blank names, value = 알려 주기; the tap opens every blank's form inside the row
function group(fields, onSubmit, ctx, label) {
  const forms = fields.map((field) => form(field, onSubmit, ctx));
  const close = el('button', { type: 'button', class: 'ws-chk-ask fill-close' }, '취소');
  const how = el('p', { class: 'fill-how' }, HOW); // the rule (두 분이 같은 값 …), once per row
  const body = el('div', { class: 'fill-body', hidden: '' }, ...forms.map((x) => x.box), how, close);
  const open = el('button', { type: 'button', class: 'ws-chk-ask fill-open', 'aria-label': `${label} 알려 주기` }, '알려 주기');
  const ask = el('p', { class: 'fill-ask' }, open);
  const box = el('li', { class: 'fill-row', 'data-field': fields.length === 1 ? fields[0] : 'group' }, el('span', { class: 'mk' }, label), el('div', { class: 'mv' }, ask, body));
  open.addEventListener('click', () => { ask.hidden = true; body.hidden = false; forms[0].input.focus?.(); });
  close.addEventListener('click', () => { body.hidden = true; ask.hidden = false; open.focus?.(); }); // 취소: back to the one line, nothing sent
  return box;
}

/**
 * fillRows({ wall, onSubmit, pick }) → { location, height_m, notice_url, phone, ask: { specs, parking } }
 *  - a field somebody filled (wall.fillMarks, set by applyFills) → its own <li class="fill-row"> with the fill-state line, else null;
 *  - ask.specs (높이 · 전화 · 공지) / ask.parking (위치) → the section's one 알려 주기 row for its true blanks, else null.
 * onSubmit({ field, value }) → Promise<{ status }>; a rejection's `code` picks the one-line answer.
 */
export function fillRows({ wall, onSubmit, pick = openPinPicker }) {
  const at = wall?.location ?? wall?.sun; // where the map opens: the wall's known point (a wall without a location has its sun point)
  const start = Number.isFinite(at?.lat) && Number.isFinite(at?.lng) ? { lat: at.lat, lng: at.lng } : null;
  const ctx = { title: wall?.short_name || wall?.name || '암장', start, pick };
  const marks = wall?.fillMarks ?? {};
  const out = Object.fromEntries(FILL_FIELDS.map((field) => [field, marks[field] ? line(field, el('p', { class: 'fill-state' }, stateText(marks[field]))) : null]));
  out.ask = Object.fromEntries(Object.keys(FILL_SECTIONS).map((sec) => {
    const blanks = blanksOf(wall, sec).filter((b) => !marks[b.field]);
    return [sec, blanks.length ? group(blanks.map((b) => b.field), onSubmit, ctx, blanks.map((b) => b.name).join(' · ')) : null];
  }));
  return out;
}
