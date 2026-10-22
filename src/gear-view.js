// src/gear-view.js — the 근처 sheets (#gear-sheet), DOM via el()/textContent only: 근처 장비점 (the wall card; partner shops, src/gear.js) and
// 근처 외벽 (the crag card; src/near-walls.js) share nearSheetBody: one place per slide, swiped sideways. For the shops the free info zone is plain
// facts (a 약도 of the shop's direction from the wall, name, one line, 지도/스토어 links); a paid shop's slide carries the 광고·제휴 mark on top and comes
// after the free ones. Every shop link carries data-gear=<id>: src/stats.js counts the click as gear-<id> (the name only).
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

// One place per slide: the zone head (only a paid zone: its 광고·제휴 mark on top), the 약도, the name with its icon, one note line, one outlined frame
// of links. A link is { label, href, icon, external: true, dataGear?, nearMap? (the 근처 외벽 map link: data-near-map, so stats.js skips it) } (a new tab, ↗) or { label, onClick, icon? } (a button, ›).
const linkEl = (l, icon) => {
  if (l.href) return el('a', { class: 'gear-link', href: l.href, target: '_blank', rel: 'noopener noreferrer', 'data-gear': l.dataGear ?? null, 'data-near-map': l.nearMap ? '1' : null }, l.icon ? icon(l.icon) : null, l.label, el('span', { class: 'gl-out', 'aria-hidden': 'true' }, '↗'));
  const b = el('button', { type: 'button', class: 'gear-link' }, l.icon ? icon(l.icon) : null, l.label, el('span', { class: 'gl-out', 'aria-hidden': 'true' }, '›'));
  b.addEventListener('click', l.onClick);
  return b;
};
const slide = (g, icon) => el('section', { class: `gsw-slide gear-item${g.zone ? ' sponsored' : ''}`, 'aria-label': g.zone ? `${g.zone.mark} ${g.zone.title} · ${g.name}` : g.name },
  g.zone ? el('div', { class: 'gear-zone-h' }, el('span', { class: 'gear-mark' }, g.zone.mark), el('span', {}, g.zone.title)) : null,
  sketch(g, icon),
  el('h4', { class: 'gear-name' }, el('span', { class: 'gear-ic', 'aria-hidden': 'true' }, icon(g.icon)), g.name),
  g.note ? el('p', { class: 'gear-note' }, g.note) : null,
  el('div', { class: `gear-links n${g.links.length}` }, ...g.links.map((l) => linkEl(l, icon))));

/**
 * The body of a 근처 sheet (근처 장비점, 근처 외벽): one place per slide, swiped sideways (scroll-snap, like the card's photos: ←/→ keys, an sr-only
 * "i / N", reduced motion respected) with dots at the bottom; one place: no dots. items: [{ id, name, km, bearing, note, icon, zone: {title, mark}|null, links }]
 * (a paid zone's items last). The returned node's start() brings startIndex into view: call it once the sheet is open (it has a width then).
 */
export function nearSheetBody(items, { startIndex = 0, icon, label = '근처' }) {
  if (!items?.length) return null;
  const n = items.length, many = n > 1;
  const track = el('div', { class: 'gsw-track', ...(many ? { tabindex: '0', role: 'group', 'aria-roledescription': 'carousel', 'aria-label': `${label}, 좌우로 넘기기` } : {}) },
    ...items.map((g) => slide(g, icon)));
  const body = el('div', { class: 'gear-body' }, track);
  const clamp = (i) => Math.max(0, Math.min(n - 1, i));
  let cur = clamp(startIndex);
  const goTo = (i, smooth) => track.scrollTo?.({ left: clamp(i) * track.clientWidth, behavior: smooth && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
  body.start = () => goTo(cur, false);
  if (!many) return body;
  const dots = el('div', { class: 'gsw-dots', 'aria-hidden': 'true' }, ...items.map(() => el('i')));
  const count = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  const paint = () => {
    [...dots.children].forEach((x, k) => x.classList.toggle('on', k === cur));
    count.textContent = `${cur + 1} / ${n}`;
  };
  paint();
  track.addEventListener('scroll', () => { const i = clamp(Math.round(track.scrollLeft / (track.clientWidth || 1))); if (i !== cur) { cur = i; paint(); } }, { passive: true });
  track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') goTo(cur + 1, true); else if (e.key === 'ArrowLeft') goTo(cur - 1, true); else return; e.preventDefault(); });
  body.append(count, dots);
  return body;
}

/** The 근처 장비점 sheet's body from nearGear results (`icon` is the app's inline-icon maker): the free zone first, then the 광고·제휴 zone; null when there is nothing. */
export function gearBody(info, sponsored, icon, { startIndex = 0 } = {}) {
  const zones = gearModel(info, sponsored);
  if (!zones) return null;
  const items = zones.flatMap((z) => z.items.map((g) => ({
    id: g.id, name: g.name, km: g.km, bearing: g.bearing, note: g.note, icon: 'gear', zone: z.mark ? { title: z.title, mark: z.mark } : null,
    links: [g.mapUrl && { label: '지도', href: g.mapUrl, icon: 'map', external: true, dataGear: g.id }, g.storeUrl && { label: '스토어', href: g.storeUrl, icon: 'bag', external: true, dataGear: g.id }].filter(Boolean),
  })));
  return nearSheetBody(items, { startIndex, icon, label: '근처 장비점' });
}
