// src/card-parts.js — the pieces of an open card that every kind of place (외벽, 싱글피치, 빙벽, 실내) can reuse.
// Each part takes plain data (from card-model.js) and returns one element, or null when its data is missing: a kind that has no
// sun simply passes a bar with `sunBands: []` and leaves the sun box out; nothing here knows about 양달.
//   gaugeBar(bar)      the day's bar: open stretches, sun bands, the pin at the picked time
//   gaugeEnds(bar)     open time (left) and close time (right) under the bar's ends
//   remainPill(left)   "~22:00 (10h)" / "~22:00 (10시간 남음)": the wording is picked by css width (.lf-s / .lf-l)
//   heroCap(m)         today's hours on a photo; dropped when the gauge already says them
//   actionBar(a, b)    the pair under the photo: the visit button and the way into the sheet
//   chipBar(chips, …)  one line of chips from card-model `chips` [{kind, text, icon, tone, to}]
import { el } from './dom.js';
import { axisFrac, fmtMin } from './viewmodel.js';

export const axisX = (min) => `${axisFrac(min) * 100}%`;
export const span = (cls, a, b) => {
  const s = el('span', { class: cls });
  s.style.left = axisX(a);
  s.style.width = `${(axisFrac(b) - axisFrac(a)) * 100}%`;
  return s;
};
// An orange sun band that starts or ends where the open bar does takes the bar's round end (the list's bar and the sheet's alike);
// inside the bar it stays square so two colours meet cleanly.
export const capCls = (a, b, open) => `${open.some(([x]) => x === a) ? ' cap-l' : ''}${open.some(([, y]) => y === b) ? ' cap-r' : ''}`;

// The one bar of a wall's day, drawn the same in the list row and on the map card: green where open (grey once gone in the open card),
// orange where it is sunny inside those hours, the pin at the picked time. `ahead` (a later day) has no pin.
export function gaugeBar(bar) {
  const tick = bar.ahead ? null : el('span', { class: 'tick' });
  tick?.style.setProperty('left', axisX(bar.nowMin));
  return el('span', { class: 'bar', role: 'img', 'aria-label': bar.label },
    // past and to-come are one tone in the list: the pin says "now"; the two halves of a split interval meet square
    ...bar.segments.map(([a, b, past], i, all) => span(`${past ? 'seg past' : 'seg'}${all[i + 1]?.[0] === b ? ' j-end' : ''}${all[i - 1]?.[1] === a ? ' j-start' : ''}`, a, b)),
    // the part before the pin is already gone: its orange is paler, like the bar under it
    ...bar.sunBands.flatMap(([a, b]) => (bar.nowMin == null || bar.nowMin <= a ? [[a, b, false]] : bar.nowMin >= b ? [[a, b, true]] : [[a, bar.nowMin, true], [bar.nowMin, b, false]]))
      .map(([a, b, past]) => span(`${past ? 'sunband past' : 'sunband'}${capCls(a, b, bar.open)}`, a, b)),
    tick);
}

// Open time under the first stretch's start, close time under the last stretch's end (a lunch break in between stays in the bar's gap).
// Hidden from screen readers: the bar's own label already reads the hours. Shown by css only while the card is open.
export function gaugeEnds(bar) {
  if (!bar?.open?.length || bar.ahead) return null; // a later day's bar: the chip and the status line already say when it opens
  const a = bar.open[0][0], b = bar.open.at(-1)[1];
  const short = b - a < 240; // under 4 hours the two labels would touch: one label over the stretch
  const box = el('span', { class: 'gauge-ends', 'aria-hidden': 'true' }, ...(short ? [el('span', {}, `${fmtMin(a)}–${fmtMin(b)}`)] : [el('span', {}, fmtMin(a)), el('span', {}, fmtMin(b))]));
  box.style.paddingLeft = axisX(a);
  box.style.paddingRight = `${(1 - axisFrac(b)) * 100}%`;
  return box;
}

// left: card-model's `leftCard` {close, short, long}; null (a closed wall) draws nothing
export function remainPill(left) {
  if (!left) return null;
  return el('span', { class: 'lf-card' }, `${left.close} (`, el('span', { class: 'lf-s' }, left.short), el('span', { class: 'lf-l' }, left.long), ')');
}

// The pair under the photo, the same for every kind of place: [the visit button | the way into the sheet], side by side in one frame (.go-row).
// Both buttons come ready-made (they belong to the app: the log sheet, the wall sheet); a kind without one passes null and the other fills the row.
export const actionBar = (visit, more) => el('div', { class: 'go-row action-bar' }, visit, more);

// One line of chips (card-model `chips`). icon(name) draws the glyph; pick(to, button) opens the sheet at `to`. A chip with no `to` is plain text.
// A chip says one fact in a few words: the detail is behind it.
export function chipBar(chips, { icon, pick }) {
  if (!chips?.length) return null;
  return el('div', { class: 'chip-bar', role: 'list', 'aria-label': '요약' }, ...chips.map((c) => {
    const note = c.note && !c.note.startsWith(c.text) ? c.note : null; // a note that only repeats the chip is said once
    const kids = [icon(c.icon), el('span', {}, c.text), note ? el('span', { class: 'sr-only' }, ` (${note})`) : null]; // sr-only says it; title is for the mouse only
    const cls = `cchip ${c.kind} ${c.tone}`;
    if (!c.to) return el('span', { class: cls, role: 'listitem', title: note }, ...kids);
    const b = el('button', { type: 'button', class: cls, 'aria-haspopup': 'dialog', title: note }, ...kids);
    b.addEventListener('click', () => pick(c.to, b));
    return el('span', { role: 'listitem', class: 'cchip-cell' }, b);
  }));
}

// 오늘 운영 · 08:00~22:00 on a photo (or on the placeholder block). `hoursOnGauge` (card-model): the gauge says the hours, so the photo stays clean;
// a suspended or closed day has no gauge ends and keeps its words.
export function heroCap(m) {
  if (m.hoursOnGauge) return null;
  return el('div', { class: 'rhero-cap' }, m.suspended ? null : el('small', {}, m.today.lead), el('b', { class: m.suspended ? 'susp-pill' : null }, m.today.text));
}
