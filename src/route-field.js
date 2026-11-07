// src/route-field.js — the 기록 추가 sheet's 완등 칸 (beside the memo) and the 프로젝트 했어요 switch (DOM; no storage, no fetch).
// A record keeps at most one route from here; the data rules are log.js cleanRoutes and projects.js (sentOptions, projectsAt).
import { el } from './dom.js';
import { SENT_NAME, sentOptions } from './projects.js';

const PAST_MAX = 3; // the past project names offered as chips
const field = (label, input) => el('label', { class: 'la-field' }, el('span', { class: 'sh-label' }, label), input);
const noEnter = (e) => { if (e.key === 'Enter') e.preventDefault(); }; // Enter (or a Korean IME's committing Enter) never saves the sheet

/**
 * createRouteField() → { el, reset(projects), suggest(projects), set(route), routes() }
 * projects: projectsAt(log, wall, hidden) for the sheet's wall. reset() opens a new record (switch on when the wall has projects);
 * suggest() follows a wall picked later and leaves a switch the climber already touched. routes() → {routes} or {error} (shown, name focused).
 */
export function createRouteField() {
  let sent = null; // null = 시도 중 (or nothing climbed to note)
  let touched = false;
  const sentBox = el('div', { class: 'la-chips la-route-sent', role: 'group', 'aria-labelledby': 'la-route-q' });
  const name = el('input', { type: 'text', name: 'rname', maxlength: '40', autocomplete: 'off', placeholder: '예: 블루스', 'aria-describedby': 'la-route-err' });
  const past = el('div', { class: 'la-chips la-route-past', role: 'group', 'aria-label': '지난 프로젝트' });
  const sw = el('input', { type: 'checkbox', name: 'rproj' });
  const grade = el('input', { type: 'text', name: 'rgrade', maxlength: '8', autocomplete: 'off', placeholder: '예: 5.11a' });
  const tries = el('input', { type: 'number', name: 'rtries', min: '1', max: '99', inputmode: 'numeric' });
  const body = el('div', { class: 'la-route-body' }, field('난이도 (선택)', grade), field('시도 횟수', tries));
  const err = el('p', { class: 'la-err', id: 'la-route-err', role: 'alert' });
  const root = el('div', { class: 'sh-row la-row la-route' },
    el('p', { class: 'sh-label', id: 'la-route-q' }, '완등 방식 (선택)'), sentBox, field('루트 이름', name), past,
    el('label', { class: 'la-share-on la-route-on' }, sw, '프로젝트 했어요'), body, err);
  err.hidden = true;

  const triesNow = () => (sw.checked ? Math.min(Math.max(parseInt(tries.value, 10) || 1, 1), 99) : 1);
  const hideErr = () => { err.hidden = true; };
  function drawSent() {
    const opts = sentOptions(triesNow());
    if (sent && !opts.includes(sent)) sent = triesNow() >= 2 ? 'redpoint' : null; // 완등 stays 완등, its way follows the tries
    sentBox.replaceChildren(...opts.map((s) => {
      const b = el('button', { type: 'button', class: 'la-chip', 'aria-pressed': String(s === sent) }, SENT_NAME[s]);
      b.addEventListener('click', () => { sent = sent === s ? null : s; touched = true; hideErr(); drawSent(); });
      return b;
    }));
  }
  function setSwitch(on) {
    sw.checked = on;
    body.hidden = !on;
    drawSent();
  }
  sw.addEventListener('change', () => { touched = true; setSwitch(sw.checked); });
  tries.addEventListener('input', () => { touched = true; drawSent(); });
  for (const i of [name, grade]) {
    i.addEventListener('input', () => { touched = true; hideErr(); });
    i.addEventListener('keydown', noEnter);
  }

  function suggest(projects) {
    const list = projects.slice(0, PAST_MAX);
    past.hidden = !list.length;
    past.replaceChildren(...(list.length ? [el('span', { class: 'la-route-past-q' }, '지난 프로젝트')] : []), ...list.map((p) => {
      const b = el('button', { type: 'button', class: 'la-chip' }, p.name);
      b.addEventListener('click', () => {
        name.value = p.name;
        grade.value = p.grade ?? '';
        touched = true;
        hideErr();
        setSwitch(true);
      });
      return b;
    }));
    if (!touched) setSwitch(projects.length > 0);
  }
  function reset(projects) {
    name.value = grade.value = '';
    tries.value = '1';
    sent = null;
    touched = false;
    hideErr();
    suggest(projects);
  }
  function set(route) {
    name.value = route.name;
    grade.value = route.grade ?? '';
    tries.value = String(route.tries);
    sent = route.sent;
    touched = true;
    setSwitch(route.tries > 1 || Boolean(route.grade));
  }
  function routes() {
    const n = name.value.trim();
    const g = sw.checked ? grade.value.trim() : '';
    if (n) return { routes: [{ name: n, ...(g ? { grade: g } : {}), tries: triesNow(), sent }] };
    if (!sent && !g && triesNow() === 1) return { routes: [] }; // memo only: nothing to keep
    err.textContent = '루트 이름을 적어 주세요.';
    err.hidden = false;
    name.focus();
    return { error: err.textContent };
  }
  return { el: root, reset, suggest, set, routes };
}
