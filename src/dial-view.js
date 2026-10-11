// Sun side view. dialLayout: pure geometry from dialModel (tested); renderDial: SVG via DOM APIs.
// A cross-section across the wall: you stand left, the wall's front face looks at you, the back is on the right.
// The sun is the direction projected onto that plane: across = cos(height)·cos(rel), up = sin(height).
const VBW = 216, VBH = 146;
const GY = 118, SH = 100;               // ground line, height of the zenith above it
const WCX = 145, WW = 10, WH = 56;       // wall: centre x, thickness, height
const WX = WCX - WW / 2, WT = GY - WH;   // front face x, top y
const VX = 96;                           // you
const XL = 125, XR = 60;                 // sun reach on your side / behind the wall (units at height 0)
const EM = 18; // label font size in viewBox units (style.css .d-lab)
const r1 = (v) => Math.round(v * 10) / 10;
const rad = (d) => (d * Math.PI) / 180;
const P = (rel, radius) => {
  const h = 90 * (1 - radius), u = Math.cos(rad(h)) * Math.cos(rad(rel));
  return [WCX + u * (u < 0 ? XL : XR), GY - Math.sin(rad(h)) * SH];
};
const xy = ([x, y]) => ({ x: r1(x), y: r1(y) });

// Label boxes from an estimated width (Hangul ≈ .93em): enough to keep labels off each other.
const textW = (t) => [...t].reduce((w, ch) => w + (ch === ' ' ? 0.28 : ch === '·' ? 0.3 : 0.93) * EM, 0);
const tbox = ({ x, y, anchor = 'middle' }, text) => {
  const w = textW(text);
  const l = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return [l, y - 0.78 * EM, l + w, y + 0.12 * EM]; // Hangul: no descenders
};
const dot = ([x, y], r) => [x - r, y - r, x + r, y + r];
const nudged = (c) => [c, { ...c, x: c.x + 40 }, { ...c, x: c.x - 40 }]; // same height, slid aside
const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
// First spot that stays inside the picture and covers nothing placed;
// when every spot covers something, the one that covers least.
const place = (cands, text, taken) => {
  const cost = (c) => {
    const b = tbox(c, text);
    const out = b[0] < -0.5 || b[2] > VBW + 0.5 || b[1] < -0.5 || b[3] > VBH + 0.5; // .5: rounding
    return (out ? 1e6 : 0) + taken.reduce((sum, o) => sum + overlap(b, o), 0);
  };
  let best = null, bestCost = Infinity;
  for (const c of cands) {
    const k = cost(c);
    if (k === 0) return c;
    if (k < bestCost) [best, bestCost] = [c, k];
  }
  return best;
};
const inside = (text) => (c) => { const w = textW(text) / 2; return { ...c, x: r1(Math.min(Math.max(c.x, w), VBW - w)) }; };

export function dialLayout(m) {
  if (m.state === 'unknown' || m.state === 'override') return null;
  const S = m.sun ? P(m.sun.rel, m.sun.radius) : null;
  const front = m.lit === true || (S ? S[0] < WCX : true); // which face the light meets
  const faceX = front ? WX : WX + WW, faceMid = (WT + GY) / 2;
  const L = {
    hill: null, hillLabel: null, sun: null, sunLabel: null, beam: null, cross: null, reason: null,
    wall: { x: WX, y: WT, w: WW, h: WH, cls: m.lit === true ? 'lit' : m.lit === false ? 'dark' : '' },
    wallLabel: null,
    person: { x: VX, y: GY, halo: m.lit === true },
    me: null,
    path: m.path.map((p) => xy(P(p.rel, p.radius))),
  };
  const meAt = { x: VX, y: GY + 20 };
  L.me = meAt;
  // marks every label keeps clear of: you, the wall
  const taken = [[VX - 10, GY - 26, VX + 10, GY], [WX - 3, WT - 3, WX + WW + 3, GY], tbox(meAt, '나')];
  const wallText = m.lit === true ? '벽 · 양달' : m.lit === false ? '벽 · 응달' : '벽';
  const wallAt = place([{ x: WCX, y: GY + 20 }, { x: WCX + 28, y: GY + 20 }].map(inside(wallText)), wallText, taken);
  L.wallLabel = { ...wallAt, text: wallText };
  taken.push(tbox(wallAt, wallText));
  let B = null;
  if (S) {
    L.sun = xy(S);
    taken.push(dot(S, 9));
    const off = m.lit !== true;
    L.beam = { points: [S, [faceX, WT], [faceX, GY]].map((p) => p.map(r1)), off };
    if (off) {
      // where the light stops: at the hill near the sun, or at the wall
      const k = m.state === 'terrain' ? 0.2 : 0.92;
      B = [S[0] + (faceX - S[0]) * k, S[1] + (faceMid - S[1]) * k];
      L.cross = xy(B);
      taken.push(dot(B, 6));
    }
  }
  // a hill rises on the sun's side up to the horizon height there, covering the sun
  if (S && m.state === 'terrain' && m.horizonAtSun > 0) {
    const cx = Math.min(Math.max(S[0], 44), VBW - 44), py = GY - Math.sin(rad(m.horizonAtSun)) * SH;
    L.hill = `M${r1(cx - 44)} ${GY} C${r1(cx - 22)} ${GY} ${r1(cx - 24)} ${r1(py)} ${r1(cx)} ${r1(py)} C${r1(cx + 24)} ${r1(py)} ${r1(cx + 22)} ${GY} ${r1(cx + 44)} ${GY} Z`;
    const at = place([{ x: cx, y: py - 8 }].flatMap(nudged).map(inside('산')), '산', taken);
    if (!taken.some((o) => overlap(tbox(at, '산'), o)) && Math.hypot(at.x - S[0], at.y - S[1]) > 14) L.hillLabel = xy([at.x, at.y]);
  }
  // reason: next to the cross, on whichever side is free
  const why = { terrain: '산에 막혀요', facing: '벽 뒤쪽이에요' }[m.state];
  if (B && why) {
    const [above, below] = [xy([B[0], B[1] - 11]), xy([B[0], B[1] + 22])];
    const side = { x: WX - 6, y: WT + 16, anchor: 'end' }; // in the sky beside the wall's front face
    const pref = m.state === 'facing' ? [side, ...[below, above].flatMap(nudged).map(inside(why))] : [above, below].flatMap(nudged).map(inside(why));
    const at = place(pref, why, taken);
    L.reason = { ...at, text: why };
    taken.push(tbox(at, why));
  }
  if (S) {
    // "지금 해": beside the dot (outward), else above or below it; kept inside the picture
    const right = S[0] >= WCX;
    const out = { ...xy([S[0] + (right ? 13 : -13), S[1] + 4]), anchor: right ? 'start' : 'end' };
    const above = { ...xy([S[0], S[1] - 14]), anchor: 'middle' };
    const below = { ...xy([S[0], S[1] + 24]), anchor: 'middle' };
    L.sunLabel = place([out, ...[above, below].flatMap(nudged).map(inside('지금 해'))], '지금 해', taken);
    taken.push(tbox(L.sunLabel, '지금 해'));
  }
  return L;
}

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
};
const label = (p, cls, text) => {
  const t = s('text', { x: p.x, y: p.y, class: `d-lab ${cls}` }, text);
  if (p.anchor) t.style.textAnchor = p.anchor; // a presentation attribute would lose to .d-lab's CSS
  return t;
};

export function renderDial(model) {
  const L = dialLayout(model);
  if (!L) return null;
  const svg = s('svg', { viewBox: `0 0 ${VBW} ${VBH}`, class: 'dial', 'aria-hidden': 'true', focusable: 'false' });
  const add = (...kids) => svg.append(...kids.filter(Boolean));
  add(s('line', { x1: 0, y1: GY, x2: VBW, y2: GY, class: 'd-ground' }),
    L.hill && s('path', { d: L.hill, class: 'd-hill' }),
    L.beam && s('polygon', { points: L.beam.points.map((p) => p.join(',')).join(' '), class: `d-beam${L.beam.off ? ' off' : ''}` }),
    ...L.path.map((p) => s('circle', { cx: p.x, cy: p.y, r: 2.4, class: 'd-path' })));
  if (L.cross) {
    const { x, y } = L.cross;
    add(s('path', { d: `M${x - 5} ${y - 5} L${x + 5} ${y + 5} M${x + 5} ${y - 5} L${x - 5} ${y + 5}`, class: 'd-x' }));
  }
  const w = L.wall;
  add(s('rect', { x: w.x, y: w.y, width: w.w, height: w.h, rx: 2, class: `d-wall${w.cls ? ` ${w.cls}` : ''}` }));
  const me = s('g', { transform: `translate(${L.person.x} ${L.person.y})` });
  if (L.person.halo) me.append(s('circle', { cy: -13, r: 18, class: 'd-halo' }));
  me.append(s('rect', { x: -5, y: -15, width: 10, height: 15, rx: 4.5, class: 'd-person' }),
    s('circle', { cy: -20, r: 4.6, class: 'd-person head' }));
  add(me, L.sun && s('circle', { cx: L.sun.x, cy: L.sun.y, r: 8, class: `d-sun${model.lit ? '' : ' off'}` }),
    // words last, so no mark paints over them
    L.reason && label(L.reason, 'xl', L.reason.text),
    label(L.wallLabel, 'wall', L.wallLabel.text),
    label(L.me, 'me', '나'),
    L.hillLabel && label(L.hillLabel, 'hill', '산'),
    L.sunLabel && label(L.sunLabel, 'sunl', '지금 해'));
  return svg;
}
