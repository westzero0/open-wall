// src/grade-wall.js — the wall of holds a visitor taps to count grades: easy grades at the top, a hold per grade (GRADE_ROWS), a tap adds
// one to the active kind, and a summary of chips (each with a −) takes one back. Used by the 기록 추가 sheet (완등 / 시도) and the
// 루트 분포 report (루트). DOM via el()/textContent only; the counts are kept clean by grades.js (bump).
import { el } from './dom.js';
import { GRADE_ROWS, bump, cleanCounts, gradeLabel } from './grades.js';

/**
 * createGradeWall({ kinds: [{ key, word }, …], mode, onChange, label }) → { el, get(key), set(key, counts), clear() }
 * kinds: what can be counted (`unit` is the counting word for screen readers, default 번; 'sends' draws a filled hold with its count; a second kind a ring, and a badge when both share a hold).
 * mode(): the key a tap adds to (default: the first kind). onChange(get): after every change and once at the start (for the caller's summary
 * line / send button); `get(key)` reads the counts, since the wall may not be assigned yet.
 */
export function createGradeWall({ kinds, mode = () => kinds[0].key, onChange = () => {}, label = '그레이드 고르기' }) {
  const state = Object.fromEntries(kinds.map((k) => [k.key, {}]));
  const get = (key) => state[key];
  const [first, second] = kinds;
  const holds = new Map(); // grade → its button (built once, updated in place so focus stays)
  const wall = el('div', { class: 'gw', role: 'group', 'aria-label': label });
  const sum = el('div', { class: 'la-gsum', 'aria-live': 'polite' });
  const root = el('div', { class: 'gwall' }, wall, sum);

  for (const row of GRADE_ROWS) {
    wall.append(el('div', { class: 'gr' }, el('span', { class: 'gr-l', 'aria-hidden': 'true' }, row.label), ...row.cells.map((c) => {
      const b = el('button', { type: 'button', class: 'hold', 'data-grade': c.grade }, c.text);
      b.addEventListener('click', () => {
        const key = mode();
        state[key] = bump(state[key], c.grade, 1);
        draw();
      });
      holds.set(c.grade, b);
      return b;
    })));
  }

  function draw() {
    for (const row of GRADE_ROWS) {
      for (const c of row.cells) {
        const b = holds.get(c.grade);
        const s = state[first.key][c.grade] ?? 0;
        const t = second ? state[second.key][c.grade] ?? 0 : 0;
        b.className = `hold${s ? ' s' : t ? ' t' : ''}`;
        // (replaceChildren turns a null argument into the text "null": only real nodes and strings go in)
        b.replaceChildren(...[s ? String(s) : t ? String(t) : c.text, s && t ? el('span', { class: 'tb', 'aria-hidden': 'true' }, String(t)) : null].filter((x) => x !== null));
        b.setAttribute('aria-label', `${gradeLabel(c.grade)}${s || t ? `, ${kinds.map((k) => `${k.word} ${state[k.key][c.grade] ?? 0}${k.unit ?? '번'}`).join(', ')}` : ''}`);
      }
    }
    // the totals, each grade as a chip with a − (the way to take one back)
    const chips = ({ key, word }) => {
      const grades = Object.keys(state[key]);
      if (!grades.length) return null;
      return el('p', { class: `gs ${key}` }, el('b', {}, word), ...grades.map((g) => {
        const minus = el('button', { type: 'button', class: 'gm', 'data-grade': g, 'aria-label': `${gradeLabel(g)} ${word} 하나 빼기` }, '−');
        minus.addEventListener('click', () => {
          state[key] = bump(state[key], g, -1);
          draw();
          // the chip is rebuilt: keep the focus on its − while the grade still has a count (repeated taps stay under the finger), else on its hold
          (sum.querySelector(`.gs.${key} .gm[data-grade="${g}"]`) ?? holds.get(g))?.focus({ preventScroll: true });
        });
        return el('span', { class: 'gc' }, `${gradeLabel(g)} ×${state[key][g]}`, minus);
      }));
    };
    sum.replaceChildren(...kinds.map(chips).filter(Boolean));
    onChange(get);
  }
  draw();

  return {
    el: root,
    get,
    set(key, counts) { state[key] = cleanCounts(counts); draw(); },
    clear() { for (const k of kinds) state[k.key] = {}; draw(); },
  };
}
