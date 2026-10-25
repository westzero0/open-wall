// Sun scene: the picture in the sun box. sceneLayout is pure geometry from dialModel (tested); renderScene draws it as SVG with DOM APIs.
// A side view, you stand left and the wall's front face looks at you. Three scenes: 양달 (the sun is on your side and the wall is lit),
// 응달 (the sun is behind the wall, or a hill hides it) and 밤 (the sun is below the horizon). Only the sun moves, to where it really is:
// across = cos(height)·cos(rel), up = sin(height), the same projection the old compass used.
const W = 360, H = 200;
const TOP = 20;                         // the empty strip of sky above is cropped: the picture is 360 x 180
const CROP_Y = 34, CROP_H = H - CROP_Y;  // the empty sky above is cropped; every scene keeps the strip under the ground (the night arc needs it), so the picture is one size: 360 x 166
const HY = 158;                         // ground line
const WX0 = 258, WX1 = 280, WTOP = 76;  // wall: front face x, back face x, top y (a short wall: the empty sky above it holds the sun box's words)
const WCX = (WX0 + WX1) / 2;
const PX = 205, U = 64;                 // the climber: feet x, body height
const XL = 215, XR = 80, SH = 112;      // sun reach on your side / behind the wall (units at height 0), height of the zenith above the ground
const rad = (d) => (d * Math.PI) / 180;
const r1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const NIGHT_HOURS = ['18', '20', '22', '00', '02', '04', '06'];
const STARS = [[40, 30], [90, 66], [150, 28], [210, 54], [250, 22], [330, 96], [20, 100], [120, 100], [176, 84], [60, 140]];

// m: dialModel result ({state, lit, sun: {rel, radius, altitude?}, horizonAtSun}); at: the picked moment (the night arc marks its hour)
export function sceneLayout(m, at = null) {
  if (!m || m.state === 'unknown' || m.state === 'override') return null;
  const night = !m.sun;
  const kind = night ? 'night' : m.lit === true ? 'lit' : 'shade';
  const L = { kind, w: W, h: H, ground: HY, wall: { x: WX0, y: WTOP, w: WX1 - WX0, h: HY - WTOP }, climber: { x: PX, y: HY, u: U },
    aria: night ? '해가 졌어요, 해는 지평선 아래에 있어요' : '', low: false, sun: null, rays: [], shadow: null, hill: null, hillLabel: null, labels: [], moon: null, stars: night ? STARS : [], arc: null, now: null };
  if (night) {
    L.moon = { x: 296, y: 52, r: 16 };
    L.arc = NIGHT_HOURS.map((t, k) => ({ x: 40 + k * 46, y: r1(HY + 40 - 17 * Math.sin(Math.PI * k / 6)), text: t }));
    if (at) {
      const t = (((at.getHours() + at.getMinutes() / 60 - 18) % 24) + 24) % 24 / 12;
      if (t <= 1) L.now = { x: r1(40 + 276 * t), y: r1(HY + 40 - 17 * Math.sin(Math.PI * t)) };
    }
    L.labels.push({ x: 12, y: HY + 14, text: 'sun below horizon', anchor: 'start', cls: 'dim' });
    return L;
  }
  const h = m.sun.altitude ?? 90 * (1 - m.sun.radius);
  const u = Math.cos(rad(h)) * Math.cos(rad(m.sun.rel));
  const r = kind === 'lit' ? 30 : 26;
  const sx = clamp(WCX + u * (u < 0 ? XL : XR), r, W - r);
  const sy = clamp(HY - Math.sin(rad(h)) * SH, CROP_Y + r + 4, HY + r * 0.5); // low sun: the ground line cuts it (sunrise / sunset)
  L.sun = { x: r1(sx), y: r1(sy), r };
  L.low = kind === 'lit' && h < 12;
  if (kind === 'lit') {
    L.rays = [WTOP + 12, WTOP + 36, WTOP + 60].map((y0, i) => ({ points: [[sx + (WX0 - sx) * 0.2, sy + (y0 - sy) * 0.2], [WX0, y0], [WX0, y0 + 9]].map((p) => p.map(r1)), opacity: [0.55, 0.42, 0.3][i] }));
    L.labels.push({ x: r1(clamp(sx, 48, 168)), y: r1(Math.min(sy + r + 16, HY - 6)), text: `alt ${Math.round(h)}°`, anchor: 'middle', cls: 'dim' });
    L.aria = `해가 벽 앞에서 비춰요, 해 높이 ${Math.round(h)}도`;
    return L;
  }
  // shade: the sun is behind the wall (its shadow reaches toward you) or a hill hides it
  if (m.state === 'facing' || sx > WX1) {
    const len = clamp((HY - WTOP) / Math.tan(rad(Math.max(h, 5))) * 0.71, 50, 190);
    L.shadow = { points: [[WX0, HY], [WX0, HY + 12], [WX0 - len, HY + 12], [WX0 - len + 14, HY]].map((p) => p.map(r1)) };
    L.labels.push({ x: r1(WX0 - len / 2), y: HY + 26, text: 'wall shadow', anchor: 'middle', cls: 'on-ground' });
    L.labels.push({ x: W - 8, y: r1(Math.max(sy - r - 8, TOP + 12)), text: 'behind wall', anchor: 'end', cls: 'dim' });
  }
  L.aria = m.state === 'terrain' ? '해가 산에 가려져 벽이 그늘이에요' : '해가 벽 뒤에 있어서 벽이 그늘이에요';
  if (m.state === 'terrain' && m.horizonAtSun > 0) {
    const cx = clamp(sx, 50, W - 50), py = HY - Math.sin(rad(m.horizonAtSun)) * SH;
    L.hill = `M${r1(cx - 52)} ${HY} C${r1(cx - 26)} ${HY} ${r1(cx - 28)} ${r1(py)} ${r1(cx)} ${r1(py)} C${r1(cx + 28)} ${r1(py)} ${r1(cx + 26)} ${HY} ${r1(cx + 52)} ${HY} Z`;
    L.hillLabel = { x: r1(clamp(sx, 70, 140)), y: r1(Math.max(sy - r - 10, CROP_Y + 12)), text: 'hill blocks sun', anchor: 'middle', cls: 'dim' }; // over the sun, clear of the climber
  }
  return L;
}

// the tone of the sun box around the picture: 'k-lit' / 'k-shade' / 'k-night', plus ' low' for a low sun (coral evening)
export function sceneTone(m, at = null) {
  const L = sceneLayout(m, at);
  return L ? `k-${L.kind}${L.low ? ' low' : ''}` : '';
}

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text = null) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
};
let seq = 0;

// the climber, side view, facing the wall: each limb is a round-capped line (one stroke colour, no fills to repaint)
const LIMBS = [[[0, -0.50], [-0.08, -0.26], 0.085], [[-0.08, -0.26], [-0.20, -0.02], 0.075], [[0, -0.50], [0.10, -0.27], 0.085], [[0.10, -0.27], [0.12, -0.02], 0.075],
  [[-0.21, -0.02], [-0.11, -0.02], 0.06], [[0.11, -0.02], [0.21, -0.02], 0.06], [[0.07, -0.80], [0, -0.50], 0.17],
  [[0.06, -0.77], [0.10, -0.62], 0.06], [[0.10, -0.62], [0.12, -0.49], 0.055], [[0.03, -0.76], [-0.04, -0.62], 0.058], [[-0.04, -0.62], [-0.03, -0.49], 0.052]];
function climber({ x, y, u }, lamp) {
  const P = (a, b) => [r1(x + a * u), r1(y + b * u)];
  const g = s('g', { class: 'sc-climber' });
  const body = s('g', { class: 'sc-body', 'stroke-linecap': 'round', fill: 'none' });
  for (const [a, b, w] of LIMBS) { const A = P(...a), B = P(...b); body.append(s('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], 'stroke-width': r1(w * u) })); }
  const hc = P(0.12, -0.91), hr = r1(0.085 * u), hh = r1(0.10 * u), bp = P(-0.15, -0.80), b0 = P(-0.08, -0.53);
  g.append(body,
    s('circle', { cx: hc[0], cy: hc[1], r: hr, class: 'sc-fill-body' }),
    s('rect', { x: bp[0], y: bp[1], width: r1(0.13 * u), height: r1(0.25 * u), rx: r1(0.04 * u), class: 'sc-fill-body' }),
    s('path', { d: `M${r1(hc[0] - hh)} ${hc[1]} A${hh} ${hh} 0 0 1 ${r1(hc[0] + hh)} ${hc[1]} Z`, class: 'sc-helmet' }),
    s('polygon', { points: `${r1(hc[0] + hh * 0.2)},${r1(hc[1] - hh * 0.05)} ${r1(hc[0] + hh * 1.5)},${r1(hc[1] - hh * 0.55)} ${r1(hc[0] + hh * 1.45)},${r1(hc[1] - hh * 0.3)} ${r1(hc[0] + hh * 0.3)},${r1(hc[1] + hh * 0.12)}`, class: 'sc-helmet' }),
    s('rect', { x: b0[0], y: b0[1], width: r1(0.16 * u), height: r1(0.05 * u), class: 'sc-helmet' }));
  if (lamp) g.append(s('circle', { cx: r1(hc[0] + hh * 1.4), cy: r1(hc[1] - hh * 0.45), r: r1(hh * 0.22), class: 'sc-lamp' }));
  return g;
}

// the sun as a woodblock disc: horizontal slits, thinner toward the bottom
function sunDisc(id, { x, y, r }) {
  const clip = s('clipPath', { id });
  let yy = y - r, i = 0;
  while (yy < y + r) {
    const th = Math.max(2.2, 7 - i * 0.45);
    clip.append(s('rect', { x: x - r - 2, y: r1(yy), width: 2 * r + 4, height: r1(th) }));
    yy += th + 1.6 + i * 0.5; i += 1;
  }
  return [clip, s('circle', { cx: x, cy: y, r, class: 'sc-sun', 'clip-path': `url(#${id})` })];
}

const label = (p) => {
  const t = s('text', { x: p.x, y: p.y, class: `sc-lab ${p.cls ?? ''}` }, p.text);
  t.style.textAnchor = p.anchor ?? 'middle';
  return t;
};

export function renderScene(model, at = null) {
  const L = sceneLayout(model, at);
  if (!L) return null;
  const id = `sc${seq++}`;
  const svg = s('svg', { viewBox: `0 ${CROP_Y} ${L.w} ${CROP_H}`, class: `sun-scene k-${L.kind}`, role: 'img', 'aria-label': L.aria, focusable: 'false' });
  const halo = s('radialGradient', { id: `${id}h` });
  halo.append(s('stop', { offset: 0, class: 'sc-h0' }), s('stop', { offset: 1, class: 'sc-h1' }));
  const defs = s('defs');
  defs.append(halo);
  svg.append(defs);
  for (const [x, y] of L.stars) svg.append(s('circle', { cx: x, cy: y, r: (x * y) % 3 === 0 ? 1.6 : 1.1, class: 'sc-star' }));
  if (L.moon) {
    const m = L.moon;
    const mask = s('mask', { id: `${id}m` });
    mask.append(s('rect', { width: L.w, height: L.h, fill: '#fff' }), s('circle', { cx: m.x + 7, cy: m.y - 3, r: m.r - 1, fill: '#000' }));
    svg.append(s('circle', { cx: m.x, cy: m.y, r: m.r * 2.2, fill: `url(#${id}h)` }), mask, s('circle', { cx: m.x, cy: m.y, r: m.r, class: 'sc-moon', mask: `url(#${id}m)` }));
  }
  if (L.sun) {
    svg.append(s('circle', { cx: L.sun.x, cy: L.sun.y, r: L.sun.r * 2.2, fill: `url(#${id}h)` }), ...sunDisc(`${id}s`, L.sun));
  }
  if (L.hill) svg.append(s('path', { d: L.hill, class: 'sc-hill' }));
  svg.append(s('rect', { x: 0, y: L.ground, width: L.w, height: L.h - L.ground, class: 'sc-ground' }),
    s('rect', { x: 0, y: L.ground, width: L.w, height: 3, class: 'sc-band a' }), s('rect', { x: 0, y: L.ground + 14, width: L.w, height: 2, class: 'sc-band b' }), s('rect', { x: 0, y: L.ground + 28, width: L.w, height: 2, class: 'sc-band a' }));
  if (L.shadow) svg.append(s('polygon', { points: L.shadow.points.map((p) => p.join(',')).join(' '), class: 'sc-shadow' }));
  for (const r of L.rays) svg.append(s('polygon', { points: r.points.map((p) => p.join(',')).join(' '), class: 'sc-ray', opacity: r.opacity }));
  const w = L.wall;
  svg.append(s('rect', { x: w.x, y: w.y, width: w.w, height: w.h, class: 'sc-wall' }), s('rect', { x: w.x, y: w.y, width: 5, height: w.h, class: 'sc-face' }));
  svg.append(climber(L.climber, L.kind === 'night'));
  if (L.arc) {
    for (const p of L.arc) svg.append(s('circle', { cx: p.x, cy: p.y, r: 1.6, class: 'sc-tick' }), label({ x: p.x, y: r1(p.y - 7), text: p.text, anchor: 'middle', cls: 'acc' }));
    if (L.now) svg.append(s('circle', { cx: L.now.x, cy: L.now.y, r: 4, class: 'sc-now' }));
  }
  for (const t of [L.hillLabel, ...L.labels]) if (t) svg.append(label(t));
  return svg;
}
