// src/tap-view.js — the "맞아요 / 달라요" row of the 시간 tab (docs/superpowers/specs/2026-10-29-report-tap-design.md). DOM via el()/textContent only.
// A part: it knows no fetch or storage. The caller passes `prior` (what this device already answered today, or null) and two async callbacks.
import { el } from './dom.js';

const CLAIMS = [['closed', '닫혀 있어요'], ['short', '일찍 닫아요'], ['long', '더 늦게까지 해요'], [null, '잘 모르겠어요']];

/**
 * tapRow({ prior, send, onsite }) → the element.
 * send({ answer, claim }) → Promise<id>; rejects when the tap did not go out (the row goes back to asking).
 * onsite(id, bool) → Promise; a failure is ignored (the tap itself is already in).
 */
export function tapRow({ prior = null, send, onsite }) {
  const root = el('div', { class: 'tap-row', role: 'group', 'aria-label': '오늘 운영시간 확인' });
  const line = el('p', { class: 'tap-msg', 'aria-live': 'polite' });
  const btns = el('div', { class: 'tap-btns' });
  root.append(line, btns);
  const btn = (label, on, cls = '') => {
    const b = el('button', { type: 'button', class: `tap-btn${cls ? ` ${cls}` : ''}` }, label);
    b.addEventListener('click', on);
    return b;
  };
  let moved = false; // the buttons are swapped by a press: focus follows, or it falls to <body> (the first draw leaves focus alone)
  const show = (msg, ...buttons) => {
    line.textContent = msg;
    line.classList.remove('err');
    btns.replaceChildren(...buttons);
    if (!moved) return;
    if (buttons.length) buttons[0].focus({ preventScroll: true });
    else { line.setAttribute('tabindex', '-1'); line.focus({ preventScroll: true }); }
  };
  const fail = (msg) => { line.textContent = msg; line.classList.add('err'); };

  const done = (msg) => show(msg);
  const idle = () => show('오늘 이 시간이 맞나요?', btn('맞아요', () => go('ok')), btn('달라요', claim));
  function claim() {
    show('어떻게 달라요?', ...CLAIMS.map(([c, t]) => btn(t, () => go('wrong', c))), btn('취소', idle, 'sub'));
  }
  function go(answer, c = null) {
    moved = true;
    const sent = send({ answer, claim: c });
    // the reaction is at once; a failure takes it back and keeps the question that was being asked
    asking(sent);
    sent.catch(() => { if (answer === 'wrong') { claim(); fail('보내지 못했어요. 어떻게 달라요? 다시 눌러 주세요.'); } else { idle(); fail('보내지 못했어요. 다시 눌러 주세요.'); } });
  }
  function asking(sent) {
    const answer = (v) => () => { sent.then((id) => onsite(id, v)).catch(() => {}); done('알려 주셔서 고마워요'); };
    show('알려 주셔서 고마워요. 지금 현장이에요?', btn('네', answer(true)), btn('아니요', answer(false)), btn('건너뛰기', () => done('알려 주셔서 고마워요'), 'sub'));
  }

  if (prior) done(prior === 'ok' ? '오늘은 이미 알려 주셨어요 (맞아요)' : '오늘은 이미 알려 주셨어요 (달라요)');
  else idle();
  return root;
}
