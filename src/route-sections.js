// src/route-sections.js — the 루트 분포 report's "which wall?" row: suggested wall chips (and ones typed in), a grade wall for the chosen one,
// and 벽 구분 없이 for a count that is not told apart. DOM via el()/textContent only. The pure line-making is report.js (cleanSectionName, validateReport).
import { el } from './dom.js';
import { createGradeWall } from './grade-wall.js';
import { totalOf } from './grades.js';
import { cleanSectionName } from './report.js';
import { MAX_ROUTE_WALLS, MAX_ROUTE_WALL_NAME } from './store.js';

export const SECTION_SUGGEST = ['좌측벽', '중앙벽', '우측벽', '오버행'];
const PLAIN = '벽 구분 없이';

/**
 * createSectionWall({ onChange }) → { el, sections(), routes(), hasCounts(), clear() }
 * sections(): [{ name, counts }] of the walls counted (empty while 벽 구분 없이 is the choice); routes(): that plain count (empty otherwise).
 * Switching chips keeps what was counted on each, so nothing is lost by looking at another wall.
 */
export function createSectionWall({ onChange = () => {} } = {}) {
  let names = [...SECTION_SUGGEST];
  let counts = new Map(); // name → counts
  let plain = {};
  let ready = false; // the grade wall calls onChange once while it is built
  let active = null; // a name, PLAIN, or null (nothing chosen yet: the grade wall stays hidden)
  const wall = createGradeWall({ kinds: [{ key: 'routes', word: '루트', unit: '개' }], label: '루트 고르기', onChange: () => { if (!ready) return; save(); paint(); onChange(); } });
  const row = el('div', { class: 'rt-chips rt-scroll', role: 'group', 'aria-label': '벽 고르기' });
  const input = el('input', { type: 'text', maxlength: MAX_ROUTE_WALL_NAME, autocomplete: 'off', placeholder: '벽 이름 (10자까지)', 'aria-label': '벽 이름' });
  const add = el('button', { type: 'button', class: 'act' }, '추가');
  const typing = el('div', { class: 'rt-add', hidden: true }, input, add);
  const grid = el('div', { class: 'rt-grid', hidden: true }, wall.el);
  const root = el('div', { class: 'rt-sections' },
    el('p', { class: 'sh-hint' }, '어느 벽의 루트인가요? 벽마다 나눠 알려 주세요.'), row, typing,
    el('p', { class: 'sh-hint' }, '벽을 고르면 그 벽의 루트 개수 칸이 열려요. 벽을 여러 개 고를 수 있어요.'), grid);

  // wall → store: the grade wall holds the active chip's counts only
  function save() {
    if (active === PLAIN) plain = { ...wall.get('routes') };
    else if (active) counts.set(active, { ...wall.get('routes') });
  }
  function pick(next, byHand = false) {
    save();
    active = next;
    wall.set('routes', next === PLAIN ? plain : next ? counts.get(next) ?? {} : {});
    paint();
    onChange();
    if (byHand) row.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true }); // the chips are rebuilt: keep the focus on the chosen one
  }
  function paint() {
    const chip = (label, { dashed = false, on = false, n = 0, click }) => {
      const b = el('button', { type: 'button', class: `rt-chip${dashed ? ' dashed' : ''}`, 'aria-pressed': String(on) }, label, n ? el('span', { class: 'rt-n' }, ` ${n}`) : null);
      b.addEventListener('click', click);
      return b;
    };
    const total = (name) => totalOf(name === active ? wall.get('routes') : counts.get(name));
    row.replaceChildren(
      chip(PLAIN, { dashed: true, on: active === PLAIN, n: active === PLAIN ? totalOf(wall.get('routes')) : totalOf(plain), click: () => pick(PLAIN, true) }), // first: at the end it fell off a 375px screen
      ...names.map((n) => chip(n, { on: active === n, n: total(n), click: () => pick(n, true) })),
      chip('＋ 직접 입력', { dashed: true, click: () => { typing.hidden = !typing.hidden; if (!typing.hidden) input.focus(); } }));
    grid.hidden = active === null;
  }
  function addName() {
    const name = cleanSectionName(input.value);
    if (!name) return;
    if (!names.includes(name) && names.length < MAX_ROUTE_WALLS) names.push(name);
    input.value = '';
    typing.hidden = true;
    if (names.includes(name)) pick(name);
  }
  add.addEventListener('click', addName);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addName(); } });
  ready = true;
  paint();

  const sections = () => {
    save();
    return active === PLAIN ? [] : names.map((name) => ({ name, counts: counts.get(name) ?? {} })).filter((s) => totalOf(s.counts) > 0);
  };
  return {
    el: root,
    sections,
    routes: () => { save(); return active === PLAIN ? { ...plain } : {}; },
    hasCounts: () => { save(); return active === PLAIN ? totalOf(plain) > 0 : sections().length > 0; },
    clear() { names = [...SECTION_SUGGEST]; counts = new Map(); plain = {}; active = null; wall.clear(); typing.hidden = true; input.value = ''; paint(); },
  };
}
