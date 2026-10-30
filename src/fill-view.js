// src/fill-view.js — the "채워 주세요" section of a wall's 이용 tab (docs/superpowers/specs/2026-10-30-contribution-fill-in-design.md).
// One row per blank (좌표 · 높이 · 공지 주소 · 전화); a blank somebody already filled shows who and whether it is confirmed. DOM via el()/textContent only.
import { el } from './dom.js';
import { FILL_FIELDS, cleanFillValue, isEmptyField, isNearWall } from './fill-fields.js';
import { openPinPicker } from './pin-picker.js';

const FIELD = {
  location: { label: '위치(좌표)', ph: '지도 링크나 위도, 경도', type: 'text', mode: 'text', bad: '지도 링크나 "위도, 경도"를 적어 주세요' },
  height_m: { label: '벽 높이(m)', ph: '예: 12', type: 'text', mode: 'decimal', bad: '3~40 사이 숫자만 적어 주세요 (예: 12)' },
  notice_url: { label: '공지 주소', ph: 'https://…', type: 'url', mode: 'url', bad: 'http로 시작하는 주소를 적어 주세요' },
  phone: { label: '전화', ph: '예: 031-123-4567', type: 'tel', mode: 'tel', bad: '전화번호 형식을 확인해 주세요' },
};
const OPT = ' (선택)'; // every blank is optional: a visitor may fill just the one they know (the report sheet marks its fields the same way)
const SAY = { rate_limited: '잠시 뒤에 다시 남겨 주세요', bad_request: '형식을 확인해 주세요' };
const stateText = (m) => (m.status === 'confirmed' ? (m.nick ? `${m.nick} 님이 채움` : '채워진 정보') : `${m.nick ? `${m.nick} ` : ''}제보 · 확인 전`);
const doneText = (s) => (s === 'confirmed' ? '확정됐어요' : s === 'pending' ? '남겼어요 · 확인 전' : '남겼어요 · 운영자가 확인해요');

function row(field, onSubmit, { title, start, pick }) {
  const f = FIELD[field];
  const input = el('input', { class: 'fill-in', type: f.type, inputmode: f.mode, placeholder: f.ph, maxlength: '500', autocomplete: 'off', 'aria-label': f.label + OPT });
  const btn = el('button', { type: 'button', class: 'ws-ask' }, '남기기');
  const msg = el('p', { class: 'fill-msg', role: 'status', id: `fill-msg-${field}` });
  const note = el('p', { class: 'fill-note', role: 'status' });
  const pickBtn = field === 'location' ? el('button', { type: 'button', class: 'ws-ask fill-pick' }, '지도에서 고르기') : null;
  const box = el('div', { class: 'fill-row', 'data-field': field }, el('span', { class: 'fill-k' }, f.label + OPT), el('div', { class: 'fill-form' }, input, btn), pickBtn, note, msg);
  pickBtn?.addEventListener('click', () => pick({ title, start, onPick: (p) => {
    msg.textContent = '';
    input.removeAttribute('aria-invalid');
    if (!isNearWall(start, p)) { msg.textContent = '이 암장에서 너무 멀어요. 암장 가까이에서 골라 주세요.'; input.setAttribute('aria-invalid', 'true'); return; }
    input.value = `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
    note.textContent = '지도에서 고른 위치예요. 맞으면 남기기를 눌러 주세요.'; // nothing is sent until 남기기
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
      box.replaceChildren(el('span', { class: 'fill-k' }, f.label), done);
      done.focus?.(); // the button that had focus is gone: keep the place for the keyboard and read the answer
    } catch (e) {
      msg.textContent = e?.code === 'bad_request' && field === 'location' ? '위치를 확인해 주세요. 암장에서 너무 멀면 올릴 수 없어요.' : (SAY[e?.code] ?? '지금은 보낼 수 없어요');
      btn.disabled = false;
    }
  });
  return box;
}

/**
 * fillSection({ wall, nick, onSubmit }) → the section, or null when the wall has no blank and nothing was filled for it.
 * wall.fillMarks ({ field: { nick, status } }, set by applyFills) marks the fields filled from a report.
 * onSubmit({ field, value }) → Promise<{ status }>; a rejection's `code` picks the one-line answer. (`nick` is the name the sender used; the app sends it.)
 */
export function fillSection({ wall, onSubmit, pick = openPinPicker }) {
  const at = wall?.location ?? wall?.sun; // where the map opens: the wall's known point (a wall without a location has its sun point)
  const start = Number.isFinite(at?.lat) && Number.isFinite(at?.lng) ? { lat: at.lat, lng: at.lng } : null;
  const ctx = { title: wall?.short_name || wall?.name || '암장', start, pick };
  const marks = wall?.fillMarks ?? {};
  const rows = FILL_FIELDS.flatMap((field) => (marks[field]
    ? [el('div', { class: 'fill-row', 'data-field': field }, el('span', { class: 'fill-k' }, FIELD[field].label), el('p', { class: 'fill-state' }, stateText(marks[field])))]
    : isEmptyField(wall, field) ? [row(field, onSubmit, ctx)] : []));
  if (!rows.length) return null;
  return el('section', { class: 'ws-sec fill-sec', 'aria-label': '빈칸 채우기', 'data-sec': 'fill' },
    el('div', { class: 'ws-sec-h' }, el('h3', {}, '빈칸 채우기')),
    el('p', { class: 'ws-empty-sub' }, '아는 칸 하나만 남겨도 돼요. 서로 다른 두 분이 같은 값을 남기면 확정되고, 내 정보에서 닉네임을 정해 두면 채운 사람으로 이름이 남아요.'),
    ...rows);
}
