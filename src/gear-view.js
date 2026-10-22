// src/gear-view.js — the 근처 장비점 sheet (opened from the card's one line): partner shops near the wall (src/gear.js), DOM via el()/textContent only.
// The free info zone is plain facts (a 약도 of the shop's direction from the wall, name, one line, 지도/스토어 links); the paid zone, when there is one,
// is a separate zone with a 광고·제휴 mark. Every link carries data-gear=<id>: src/stats.js counts the click as gear-<id> (the name only).
import { el } from './dom.js';
import { gearModel, sketchLayout, SKETCH } from './gear.js';
import { formatDistance } from './card-model.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };

// the 해벽 symbol (the sun behind the leaning wall); the wall takes the page's wall colour (the paper in the dark theme)
function markSvg() {
  const svg = svgEl('svg', { viewBox: '0 0 240 240', class: 'gsk-mark', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(svgEl('circle', { cx: 120, cy: 96, r: 80, class: 'gsk-sun' }), svgEl('polygon', { points: '105,8 185,8 185,232 151,232', class: 'gsk-slab' }));
  return svg;
}

const link = (g, href, label, ic) => href
  ? el('a', { class: 'gear-link', href, target: '_blank', rel: 'noopener noreferrer', 'data-gear': g.id }, ic, label, el('span', { class: 'gl-out', 'aria-hidden': 'true' }, '↗'))
  : null;

const DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
const dirWord = (b) => (Number.isFinite(b) ? `${DIRS[Math.round(b / 45) % 8]}쪽` : '근처');

// the 약도: a sketch, not a map. North is up; the wall and the shop sit on a line in the REAL direction (bearing), the length is fixed — the
// distance is the km in the chip. Each point is placed by percentage of the box, its label hangs on the side away from the line.
function sketch(g, icon) {
  const L = sketchLayout(g.bearing ?? 0);
  const at = (p) => ({ left: `${(p.x / SKETCH.w) * 100}%`, top: `${(p.y / SKETCH.h) * 100}%` });
  const point = (cls, p, above, glyph, label) => {
    const e = el('div', { class: `gsk-pt ${cls}${above ? ' above' : ''}` }, glyph, el('span', { class: 'gsk-tag' }, label));
    Object.assign(e.style, at(p));
    return e;
  };
  const line = svgEl('svg', { viewBox: `0 0 ${SKETCH.w} ${SKETCH.h}`, class: 'gsk-line', 'aria-hidden': 'true', focusable: 'false' });
  line.append(svgEl('line', { x1: L.wall.x, y1: L.wall.y, x2: L.shop.x, y2: L.shop.y }));
  const mid = { x: (L.wall.x + L.shop.x) / 2, y: (L.wall.y + L.shop.y) / 2 };
  const dist = el('span', { class: 'gsk-km' }, g.km != null ? formatDistance(g.km) : '');
  Object.assign(dist.style, at(mid));
  const north = svgEl('svg', { viewBox: '0 0 24 28', class: 'gsk-north', 'aria-hidden': 'true', focusable: 'false' });
  const nTxt = svgEl('text', { x: 12, y: 26, 'text-anchor': 'middle', class: 'gsk-n-txt' });
  nTxt.textContent = 'N';
  north.append(svgEl('path', { d: 'M12 2 L18 14 L12 11.5 L6 14 Z', class: 'gsk-n-arrow' }), nTxt);
  // a faint river and two streets behind the line: only to make the sketch read as a map-ish picture; they are NOT the real ones (the caption says 약도)
  const decor = svgEl('svg', { viewBox: `0 0 ${SKETCH.w} ${SKETCH.h}`, class: 'gsk-decor', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
  decor.append(svgEl('path', { d: 'M0 130 C58 112 118 144 200 122 S318 104 343 96 V168 H0Z', class: 'gsk-water' }),
    svgEl('path', { d: 'M-10 38 L343 74', class: 'gsk-road a' }), svgEl('path', { d: 'M92 -10 L150 170', class: 'gsk-road b' }), svgEl('path', { d: 'M238 -10 L270 170', class: 'gsk-road b' }));
  return el('div', { class: 'gsk-wrap' },
    el('div', { class: 'gsk', role: 'img', 'aria-label': `약도: ${g.name}은 이 암장에서 ${dirWord(g.bearing)}으로 ${g.km != null ? formatDistance(g.km) : '가까이'}` },
      decor, line, dist, north, point('wall', L.wall, L.wallAbove, markSvg(), '이 암장'), point('shop', L.shop, L.shopAbove, icon('pin'), g.name)),
    el('small', { class: 'gsk-cap' }, '약도예요. 방향만 맞고 거리는 km로 보세요.'));
}

const card = (g, icon) => {
  const links = [link(g, g.mapUrl, '지도', icon('map')), link(g, g.storeUrl, '스토어', icon('bag'))].filter(Boolean);
  return el('li', { class: 'gear-item' },
    sketch(g, icon),
    el('h4', { class: 'gear-name' }, el('span', { class: 'gear-ic', 'aria-hidden': 'true' }, icon('gear')), g.name),
    g.note ? el('p', { class: 'gear-note' }, g.note) : null,
    el('div', { class: `gear-links n${links.length}` }, ...links));
};

/** The sheet's body from nearGear results (`icon` is the app's inline-icon maker); null when there is nothing to show. */
export function gearBody(info, sponsored, icon) {
  const zones = gearModel(info, sponsored);
  if (!zones) return null;
  return el('div', { class: 'gear-body' }, ...zones.map((z) => el('section', { class: `gear-zone${z.sponsored ? ' sponsored' : ''}`, 'aria-label': z.mark ? `${z.mark} ${z.title}` : z.title },
    z.mark ? el('div', { class: 'gear-zone-h' }, el('span', { class: 'gear-mark' }, z.mark), el('span', {}, z.title)) : null,
    el('ul', { class: 'gear-list' }, ...z.items.map((g) => card(g, icon))))));
}
