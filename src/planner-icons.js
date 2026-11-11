// src/planner-icons.js — the planner's small flat SVG icons (weather, wind, crowd, sun state, 5 discipline symbols), drawn from the
// v3 mock shapes (.scratch/planner-design-v3/symbols.py, build_final4.py). Elements are built with h() — no HTML strings.
// All icons use currentColor and aria-hidden: the words next to them carry the meaning.
import { h } from './planner-ui.js';

import { ICON_SHAPES, SYMBOL_SHAPES, crowdShapes, SYMBOL_KINDS } from './planner-shapes.js';
export { SYMBOL_KINDS };

const svg = (cls, vb, kids) => h('svg', { class: cls, viewBox: vb, 'aria-hidden': 'true', focusable: 'false' }, kids);
// shape node (planner-shapes.js) -> element(s)
const el = (n) => {
  if (n.t === 'path') return h('path', { d: n.d, ...n.a, ...(n.tf ? { transform: `translate(${n.tf.x},${n.tf.y}) scale(${n.tf.s})` } : {}) });
  if (n.t === 'circle') return h('circle', { cx: n.cx, cy: n.cy, r: n.r, ...n.a });
  if (n.t === 'g') return h('g', n.a, n.k.map(el));
  return [h('clipPath', { id: n.id }, h('path', { d: n.d })), h('g', { 'clip-path': `url(#${n.id})` }, n.k.map(el))]; // clip
};
const els = (nodes) => nodes.flatMap((n) => [el(n)].flat());

/** Icon({ name, cls }) — name: sun | cloud | rain | wind | lit | shade */
export function Icon({ name, cls = '' }) { return svg('ic ' + cls, '0 0 24 24', els(ICON_SHAPES[name]())); }

/** Crowd({ n, cls }) — n filled people of 3; n = 0 draws the dotted "no reports" people. */
export function Crowd({ n = 0, cls = '' }) { return svg('ic ' + cls, '0 0 24 24', els(crowdShapes(n))); }

/** sky kind (weather.js skyKind().kind) -> icon name; wet kinds draw the rain cloud */
export const skyIcon = (kind) => (kind === 'clear' || kind === 'partly' ? 'sun' : kind === 'cloud' || kind === 'fog' ? 'cloud' : 'rain');

/** DisciplineIcon({ kind, cls }) — kind: wall (outdoor wall) | lead (indoor) | boulder | single | multi; anything else draws the outdoor wall */
export function DisciplineIcon({ kind, cls = '' }) { return svg('sy ' + cls, '0 0 48 48', els((SYMBOL_SHAPES[kind] ?? SYMBOL_SHAPES.wall)())); }
