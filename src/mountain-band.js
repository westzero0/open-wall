// src/mountain-band.js — the 두 봉우리 line drawing above the time box (2026-11-05): two summits of nested chevrons, the near one hiding the far one.
// The concept's picture ("당신과 나"), drawn in the page's ink at 30% so the controls stay the subject. No data, no events; DOM only, svg built with createElementNS.
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
};

// n chevrons stacked under an apex, 110px legs at a 1:2 slope; the ring of the viewBox (390 × 56) cuts them off
const chevrons = (ax, ay, n, gap) =>
  s('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': '.9', 'stroke-linejoin': 'round' },
    ...Array.from({ length: n }, (_, i) => s('polyline', { points: `${ax - 110},${ay + i * gap + 55} ${ax},${ay + i * gap} ${ax + 110},${ay + i * gap + 55}` })));

let seq = 0; // each band keeps its own mask id (the home and the 기록 empty state can both be in the page)
export function mountainBand() {
  const id = `mtn-near-${++seq}`;
  const svg = s('svg', { viewBox: '0 0 390 56', preserveAspectRatio: 'xMidYMax slice', 'aria-hidden': 'true', focusable: 'false' });
  const hideNear = s('mask', { id },
    s('rect', { width: 390, height: 56, fill: '#fff' }),
    s('polygon', { points: '255,12 79,100 431,100', fill: '#000' })); // the near summit's body: the far one's lines stop at its slope
  svg.append(hideNear,
    s('g', { mask: `url(#${id})` }, chevrons(115, 2, 11, 5)),
    chevrons(255, 12, 9, 5));
  return svg;
}
