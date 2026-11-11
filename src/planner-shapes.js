// src/planner-shapes.js — the planner's icon shapes as plain data (no DOM, no h()): ONE table for the SVG icons (planner-icons.js) and the
// promise-card canvas (plan-card-draw.js, via Path2D). Node: { t:'path', d, a, tf? } | { t:'circle', cx, cy, r, a } | { t:'g', a, k } | { t:'clip', id, d, k }.
// `a` = SVG presentation attributes (stroke, fill, stroke-width, ...; 'currentColor' = the colour the caller picks). Weather/people: 24 grid, symbols: 48 grid.
const path = (d, a = {}, tf) => ({ t: 'path', d, a, ...(tf ? { tf } : {}) });
const circle = (cx, cy, r, a = {}) => ({ t: 'circle', cx, cy, r, a });
const ring = { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const S = { ...ring, 'stroke-width': 2.4 }; // symbol outline
const T = { ...ring, 'stroke-width': 1.3 }; // symbol detail line
const f1 = (n) => n.toFixed(1);

const raysAt = (cx, cy, r, n, a, b, w) => Array.from({ length: n }, (_, i) => {
  const t = (i * 2 * Math.PI) / n;
  return path(`M${f1(cx + Math.cos(t) * (r + a))} ${f1(cy + Math.sin(t) * (r + a))}L${f1(cx + Math.cos(t) * (r + b))} ${f1(cy + Math.sin(t) * (r + b))}`, { stroke: 'currentColor', 'stroke-width': w, 'stroke-linecap': 'round' });
});

// ---- weather / wind (24 grid) ----
const W = { ...ring, 'stroke-width': 2 };
const CLOUD = 'M6.5 18a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 17.6 9.4 4.3 4.3 0 0 1 17.5 18z';
const RAIN = 'M6.5 14a4 4 0 0 1 .5-7.6A5.5 5.5 0 0 1 17.6 6.2 3.9 3.9 0 0 1 17.5 14z';
const PEAK = 'M3 20L12 5l9 15z';
export const ICON_SHAPES = {
  sun: () => [circle(12, 12, 4.6, W), ...raysAt(12, 12, 4.6, 8, 2.4, 5.2, 2)],
  cloud: () => [path(CLOUD, W)],
  rain: () => [path(RAIN, W), path('M8 17.5l-1 3M12 17.5l-1 3M16 17.5l-1 3', W)],
  wind: () => [path('M3 9h11a3 3 0 1 0-3-3', W), path('M3 14h15a3 3 0 1 1-3 3', W)],
  lit: () => [path(PEAK, W), circle(19, 6, 2.6, { fill: 'currentColor' })],
  x: () => [path('M6 6l12 12M18 6L6 18', W)],
  check: () => [path('M5 12.5l4.5 4.5L19 7.5', W)],
  shade: () => [path(PEAK, W), ...[10.5, 13, 15.5, 18].map((y) => path(`M12.8 ${y}H${f1(12 + (y - 5) * 0.6 - 1.2)}`, { stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' }))],
};

const person = (x, filled, dashed) => ({
  t: 'g',
  a: { ...(filled ? { fill: 'currentColor' } : { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, ...(dashed ? { 'stroke-dasharray': '2 2' } : {}) }), opacity: filled ? 1 : 0.5 },
  k: [circle(x + 4, 8, 2.6), path(`M${f1(x)} 19c0-4 8-4 8 0z`)],
});

/** crowdShapes(n) — n filled people of 3; n = 0 draws the dotted "no reports" people. */
export const crowdShapes = (n = 0) => [0, 1, 2].map((i) => person(i * 7.4, i < n, n === 0));

/** peopleShapes(n) — n (1..3, more draws 3) outlined people, centred: the promise card's 동행 row (the same person shape as crowdShapes). */
export const peopleShapes = (n) => {
  const c = Math.max(1, Math.min(3, n | 0)), pitch = c === 3 ? 7.4 : 9.5, x0 = (24 - (8 + pitch * (c - 1))) / 2;
  return Array.from({ length: c }, (_, i) => ({ ...person(x0 + i * pitch, false, false), a: { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round' } }));
};

// ---- discipline symbols (48 grid) ----
const diag = (x0, x1, y0, y1, step = 3.4) => Array.from({ length: Math.floor((y1 - y0) / step) + 1 }, (_, i) => {
  const y = y0 + i * step;
  return `M${x0} ${f1(y + (x1 - x0) * 0.5)}L${x1} ${f1(y)}`;
}).join('');
const HOLDS = ['M-3.4 1.6C-4 -1.8 -1 -3.6 1.8 -3C4.2 -2.4 4.6 1 2.8 2.8C1 4.2 -2.6 3.8 -3.4 1.6Z', 'M-3 -1C-2 -3.6 2 -3.8 3.6 -1.4C4.4 1 2.6 3.6 -0.4 3.6C-3 3.4 -3.6 1 -3 -1Z', 'M-3.6 0.6L-1.4 -3.2 2.6 -2.6 3.8 1.6 0.6 3.8Z'];
const hold = (x, y, k) => path(HOLDS[k], { fill: 'currentColor' }, { x, y, s: 1.05 });
const dot = (cx, cy, r, w = 1.8) => circle(cx, cy, r, { ...S, 'stroke-width': w });
// natural rock: outline + hatch clipped to the outline (one clip id per kind: identical copies may share it)
const shaped = (id, poly, inner, hatch) => [path(poly, S), { t: 'clip', id, d: poly, k: [path(hatch, T)] }, ...inner];
export const SYMBOL_SHAPES = {
  wall: () => [path('M4 43h40', S), path('M8 43V12h18v31', S), path('M26 12l5 4v27', S),
    ...[[14, 20], [19, 27], [13, 34], [18, 15]].map(([cx, cy]) => circle(cx, cy, 2.1, { fill: 'currentColor' })),
    path('M27.5 21l2.5 1.5M27.5 26l2.5 1.5M27.5 31l2.5 1.5M27.5 36l2.5 1.5', T), path('M35 43v-3M38 43v-4.5M41 43v-3', T),
    circle(38, 11, 3.8, { fill: 'currentColor' }), ...raysAt(38, 11, 3.8, 8, 2.6, 4.6, 2)],
  lead: () => [path('M4 18L24 6l20 12', S), path('M9 15v28h30V15', S), path('M5 43h38', S),
    path('M24 14V19C24 23 27 24 27 28S23 31 23 35V42', { ...ring, 'stroke-width': 1.6 }), hold(15, 24, 0), hold(32, 26, 1), hold(31, 37, 2)],
  boulder: () => shaped('pl-sy-b', 'M7 40L8 27 14 18l5-8 11-2 9 8 4 10 1 14z', [path('M20 10l-3 12 5 6-2 12', T)], diag(24, 45, 10, 40)),
  single: () => shaped('pl-sy-s', 'M7 43L8 32 6 24 10 17 9 11 15 6l5 2 6-5 6 4 4-1 4 6-2 7 3 8-2 9 1 6z',
    [path('M24 12v28', { ...S, 'stroke-width': 2.2 }), dot(24, 10, 2.8), path('M13 22l3 5-2 6 3 6', T)], diag(29, 42, 8, 43)),
  multi: () => shaped('pl-sy-m', 'M6 43L7 33 5 27 9 21 8 15 12 10l4-3 3-4 5 3 4-2 4 5 4 1 3 7-2 6 3 6-1 8 1 5z',
    [path('M21 8v10l7 4v10l-7 4v6', { ...S, 'stroke-width': 2.2 }), dot(21, 6.5, 2.4), dot(28, 22, 2.4), dot(21, 38, 2.4), path('M10 24h6M32 31h6', { ...T, 'stroke-width': 1.8 })], diag(32, 44, 6, 43)),
};
export const SYMBOL_KINDS = Object.keys(SYMBOL_SHAPES);
