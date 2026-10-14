// src/year-seal-view.js — draws the 올해 도장 as SVG. Geometry and the meaning of the colours live in year-seal.js; this file only
// turns them into elements (createElementNS, textContent: no HTML strings). Marks are real buttons so a visit can be pressed or reached
// from the keyboard (one tab stop, arrow keys inside).
import {
  FIRST_HOUR, RINGS, bandSamples, dayIndexOf, daysInYear, indexAngle, marks, monthCounts, monthStarts, nearestPoint, rowRadius, sealLabel,
} from './year-seal.js';

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 340, C = SIZE / 2, R0 = 44, R1 = 126, RIM = R1 + 14;
const ARC_PX = 2.1;                                         // half the length of a mark's arc, along its ring
const REACH_PX = 24;                                        // a press picks the nearest mark within this many screen pixels (a fingertip)
const RING_R = 7;                                           // the ring around the picked or focused mark
const FALLBACK = [[224, 138, 30], [31, 95, 85], [77, 106, 143]];

const s = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  n.append(...kids);
  return n;
};
const at = (angle, r) => [C + r * Math.cos(angle), C + r * Math.sin(angle)];
const f1 = (n) => n.toFixed(1);

// the colours of the daylight band follow the app's own tokens (sun → accent → shade), read when the seal is drawn
function ramp() {
  const css = getComputedStyle(document.documentElement);
  const rgb = (name, fb) => { const m = /^#([0-9a-f]{6})$/i.exec(css.getPropertyValue(name).trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : fb; };
  const stops = [rgb('--pin-sun', FALLBACK[0]), rgb('--accent', FALLBACK[1]), rgb('--shade-bar', FALLBACK[2])];
  return (f) => {
    const x = Math.min(1, Math.max(0, f)) * 2, i = Math.min(1, Math.floor(x)), k = x - i;
    return `rgb(${stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * k)).join(',')})`;
  };
}

const bandCache = new Map();                                // dayWindow scans a day by the minute: once per year
const bandOf = (year) => { if (!bandCache.has(year)) bandCache.set(year, bandSamples(year, 5)); return bandCache.get(year); };

/**
 * drawSeal({ year, log, walls, today: 'YYYY-MM-DD', onPick(mark) }) → { el, marks }
 * el is the <svg>; each visit is a focusable arc (role=button) that calls onPick(mark) when pressed.
 */
export function drawSeal({ year, log, walls, today, onPick = () => {} }) {
  const n = daysInYear(year);
  const thisYear = Number(today.slice(0, 4));
  const todayIdx = year === thisYear ? dayIndexOf(today) : year < thisYear ? n : -1;   // days after this are still to come
  const color = ramp();
  const list = marks(log, year, walls);
  const counts = monthCounts(log, year);
  const total = list.length;

  const svg = s('svg', { class: 'ys', viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'group', 'aria-label': sealLabel(year, counts) });

  // rims and month ticks
  svg.append(s('circle', { class: 'ys-rim', cx: C, cy: C, r: RIM }), s('circle', { class: 'ys-rim thin', cx: C, cy: C, r: RIM + 4 }), s('circle', { class: 'ys-rim thin', cx: C, cy: C, r: R0 - 9 }));
  for (const t of monthStarts(year)) {
    const [x0, y0] = at(t.angle, RIM), [x1, y1] = at(t.angle, RIM + 10), [lx, ly] = at(t.mid, RIM + 19);
    svg.append(s('line', { class: 'ys-tick', x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1) }), s('text', { class: 'ys-month', x: f1(lx), y: f1(ly + 3), 'text-anchor': 'middle', 'aria-hidden': 'true' }, String(t.month)));
  }

  // the daylight: one column of dots per sample, one ring per hour, coloured by how far into the day's light that hour is
  const band = bandOf(year);
  const bandId = (k, r) => {
    const w = band[k];
    if (!w) return null;
    const t = FIRST_HOUR + r + 0.5;
    if (t < w.rise) return { id: -1, f: null };
    if (t > w.set) return { id: 99, f: null };
    const f = (t - w.rise) / (w.set - w.rise);
    return { id: Math.min(7, Math.floor(f * 8)), f };
  };
  const dots = s('g', { 'aria-hidden': 'true' });
  band.forEach((w, k) => {
    const angle = indexAngle(w.index + 2, n);                  // the column stands for the five days it opens
    const dim = w.index + 2 > todayIdx;
    for (let r = 0; r < RINGS; r++) {
      const b = bandId(k, r);
      const [x, y] = at(angle, rowRadius(r, R0, R1));
      if (b.f === null) { dots.append(s('circle', { class: `ys-night${dim ? ' dim' : ''}`, cx: f1(x), cy: f1(y), r: 0.55 })); continue; }
      const edge = [[k + 1, r], [k, r + 1]].some(([kk, rr]) => { const o = bandId(kk, rr); return o && o.id !== b.id; });
      dots.append(s('circle', { class: `ys-day${edge ? ' edge' : ''}${dim ? ' dim' : ''}`, cx: f1(x), cy: f1(y), r: edge ? 1.9 : b.id % 2 === 0 ? 1.15 : 0.7, fill: color(b.f) }));
    }
  });
  svg.append(dots);

  // the sun's road: a dotted circle through half past noon; the part already travelled is firmer
  const orbit = rowRadius(7, R0, R1);
  const arc = (i0, i1, cls) => {
    const a0 = indexAngle(i0, n) - Math.PI / (n * 1), a1 = indexAngle(i1, n);
    const [x0, y0] = at(a0, orbit), [x1, y1] = at(a1, orbit);
    return s('path', { class: `ys-orbit ${cls}`, d: `M${f1(x0)} ${f1(y0)} A${f1(orbit)} ${f1(orbit)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}` });
  };
  if (todayIdx >= n) svg.append(arc(0, n - 1, 'past'));
  else if (todayIdx < 0) svg.append(arc(0, n - 1, 'future'));
  else svg.append(arc(0, todayIdx, 'past'), arc(todayIdx, n - 1, 'future'));

  // the visits: a short arc on its own ring, exactly on its own date, with a surface-coloured edge so it never merges with the dots
  const centers = [];
  const nodes = list.map((m, i) => {
    const rr = rowRadius(m.row, R0, R1), half = ARC_PX / rr;
    const [x0, y0] = at(m.angle - half, rr), [x1, y1] = at(m.angle + half, rr), [mx, my] = at(m.angle, rr);
    centers.push({ x: mx, y: my });
    const d = `M${f1(x0)} ${f1(y0)} A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(x1)} ${f1(y1)}`;
    return s('g', { class: `ys-mark ${m.kind}`, role: 'button', tabindex: i === 0 ? 0 : -1, 'aria-label': m.label, 'data-id': m.id },
      s('path', { class: 'under', d }), s('path', { class: 'over', d }), s('path', { class: 'core', d }));
  });
  svg.append(s('g', {}, ...nodes));
  // one ring for the picked or the focused mark, drawn above every arc so a neighbour can never cover it
  const ring = s('circle', { class: 'ys-ring', r: RING_R, 'aria-hidden': 'true' });
  let picked = -1;
  const showRing = (i) => { if (i < 0) { ring.removeAttribute('cx'); ring.removeAttribute('cy'); ring.classList.remove('on'); return; } ring.setAttribute('cx', f1(centers[i].x)); ring.setAttribute('cy', f1(centers[i].y)); ring.classList.add('on'); };
  const pick = (i) => { picked = i; showRing(i); onPick(list[i]); };
  // the seal takes the press, not each tiny arc: the nearest arc to the fingertip wins (arcs of one week lie closer than a finger is wide)
  svg.addEventListener('click', (e) => {
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    const k = SIZE / box.width;
    const i = nearestPoint(centers, (e.clientX - box.left) * k, (e.clientY - box.top) * k, REACH_PX * k);
    if (i >= 0) pick(i);
  });

  // today: the sun on its road and a hairline across the field
  if (todayIdx >= 0 && todayIdx < n) {
    const a = indexAngle(todayIdx, n);
    const [lx0, ly0] = at(a, R0 - 6), [lx1, ly1] = at(a, R1 + 8), [sx, sy] = at(a, orbit);
    svg.append(
      s('line', { class: 'ys-today-line', x1: f1(lx0), y1: f1(ly0), x2: f1(lx1), y2: f1(ly1), 'aria-hidden': 'true' }),
      s('circle', { class: 'ys-sun-halo', cx: f1(sx), cy: f1(sy), r: 9, 'aria-hidden': 'true' }),
      s('circle', { class: 'ys-sun', cx: f1(sx), cy: f1(sy), r: 4.6, 'aria-hidden': 'true' }),
    );
  }

  svg.append(ring);

  // the number in the middle
  svg.append(s('text', { class: 'ys-num', x: C, y: C + 7, 'text-anchor': 'middle', 'aria-hidden': 'true' }, String(total)), s('text', { class: 'ys-unit', x: C, y: C + 22, 'text-anchor': 'middle', 'aria-hidden': 'true' }, '번'));

  // one tab stop for all marks; arrows (or Home/End) walk through them in date order
  svg.addEventListener('keydown', (e) => {
    const i = nodes.indexOf(e.target.closest?.('.ys-mark'));
    if (i < 0) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); return; }
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: nodes.length - 1 }[e.key];
    if (next === undefined || next < 0 || next >= nodes.length) return;
    e.preventDefault();
    nodes[i].tabIndex = -1;
    nodes[next].tabIndex = 0;
    nodes[next].focus();
  });
  svg.addEventListener('focusin', (e) => showRing(nodes.indexOf(e.target.closest?.('.ys-mark'))));
  svg.addEventListener('focusout', () => showRing(picked));

  return { el: svg, marks: list };
}
