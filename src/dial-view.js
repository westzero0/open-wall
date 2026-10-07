// Sun compass picture. dialLayout: pure geometry from dialModel (tested); renderDial: SVG via DOM APIs.
// You stand at the centre looking at the wall (up); angles are clockwise from "ahead".
const C = 130, R = 92, WY = C - 34, WW = 34;
const VB_MIN = 22, VB_MAX = 238; // viewBox "22 22 216 216"
const EM = 16.5; // label font size in viewBox units (style.css .d-lab)
const r1 = (v) => Math.round(v * 10) / 10;
const P = (rel, r) => {
  const a = (rel * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
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
// First spot that stays inside the picture sideways (the words sit next to it) and covers nothing placed;
// when every spot covers something, the one that covers least.
const place = (cands, text, taken) => {
  const cost = (c) => {
    const b = tbox(c, text);
    const out = b[0] < VB_MIN - 0.5 || b[2] > VB_MAX + 0.5; // .5: rounding
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

export function dialLayout(m) {
  if (m.state === 'unknown' || m.state === 'override') return null;
  const S = m.sun ? P(m.sun.rel, R * m.sun.radius) : null;
  const L = {
    hills: null, hillLabel: null, sun: null, sunLabel: null, beam: null, cross: null, reason: null,
    north: xy(P((((-(m.ahead ?? 0)) % 360) + 360) % 360, R + 11)),
    wall: { x1: C - WW, y1: WY, x2: C + WW, y2: WY, cls: m.lit === true ? 'lit' : m.lit === false ? 'dark' : '' },
    wallLabel: null,
    person: { x: C, y: C + 4, halo: m.lit === true },
    me: null,
    path: m.path.map((p) => xy(P(p.rel, R * p.radius))),
  };
  // marks every label keeps clear of: you, "북", the wall, the sun, the cross
  const taken = [[C - 15, C - 6, C + 15, C + 12], tbox(L.north, '북'), [C - WW - 3, WY - 3, C + WW + 3, WY + 3]];
  let B = null;
  if (S) {
    L.sun = xy(S);
    taken.push(dot(S, 9));
    const off = m.lit !== true;
    L.beam = { points: [S, [C - WW, WY + 3], [C + WW, WY + 3]].map((p) => p.map(r1)), off };
    if (off) {
      // where the light stops: near the sun (a hill) or at the back of the wall
      const k = m.state === 'terrain' ? 0.2 : 0.92;
      B = [S[0] + (C - S[0]) * k, S[1] + (WY - S[1]) * k];
      L.cross = xy(B);
      taken.push(dot(B, 6));
    }
  }
  // "나" under you, or beside you when the sun is there
  const meC = [{ x: C, y: C + 28 }, { x: C - 20, y: C + 9, anchor: 'end' }, { x: C + 20, y: C + 9, anchor: 'start' }];
  L.me = place(meC, '나', taken);
  taken.push(tbox(L.me, '나'));
  // wall label above the wall; slid aside (then below) when the sun or the cross is there
  const wallText = m.lit === true ? '벽 · 양달' : m.lit === false ? '벽 · 응달' : '벽';
  const wallAt = place([{ x: C, y: WY - 10 }, { x: C - 46, y: WY - 10 }, { x: C + 46, y: WY - 10 }, { x: C, y: WY + 22 }], wallText, taken);
  L.wallLabel = { ...wallAt, text: wallText };
  taken.push(tbox(wallAt, wallText));
  // reason: terrain above the cross, facing below it; the other side when that one is taken
  const why = { terrain: '산에 막혀요', facing: '벽 뒤쪽이에요' }[m.state];
  if (B && why) {
    const [above, below] = [xy([B[0], B[1] - 11]), xy([B[0], B[1] + 22])];
    const w = textW(why) / 2;
    const inside = (c) => ({ ...c, x: r1(Math.min(Math.max(c.x, VB_MIN + w), VB_MAX - w)) });
    const pref = (m.state === 'facing' ? [below, above] : [above, below]).flatMap(nudged).map(inside);
    const at = place(pref, why, taken);
    L.reason = { ...at, text: why };
    taken.push(tbox(at, why));
  }
  if (S) {
    // "지금 해": below the dot when it is low on the picture, else beside it, outward;
    // when that is taken or would leave the picture, the next free spot (kept inside).
    const low = S[1] > C + R * 0.45, right = S[0] >= C;
    const w = textW('지금 해') / 2;
    const inside = (c) => ({ ...c, x: r1(Math.min(Math.max(c.x, VB_MIN + w), VB_MAX - w)) });
    const below = { ...xy([S[0], S[1] + 24]), anchor: 'middle' };
    const above = { ...xy([S[0], S[1] - 14]), anchor: 'middle' };
    const out = { ...xy([S[0] + (right ? 13 : -13), S[1] + 4]), anchor: right ? 'start' : 'end' };
    const inn = { ...xy([S[0] + (right ? -13 : 13), S[1] + 4]), anchor: right ? 'end' : 'start' };
    const cands = [...(low ? [below, out] : [out]), ...[below, above].flatMap(nudged).map(inside), inn];
    L.sunLabel = place(cands, '지금 해', taken);
    taken.push(tbox(L.sunLabel, '지금 해'));
  }
  if (m.hills) {
    const pts = m.hills.map((h) => P(h.rel, R * h.radius).map(r1).join(','));
    L.hills = `M${C - R} ${C} a${R} ${R} 0 1 0 ${2 * R} 0 a${R} ${R} 0 1 0 ${-2 * R} 0 Z M${pts.join(' L')} Z`;
    // "산" at the highest hill (first one wins a tie); left out near the sun or on top of another label
    const top = m.hills.reduce((a, h) => (h.radius < a.radius ? h : a));
    const [hx, hy] = P(top.rel, R * 0.935);
    const at = xy([hx, hy + 3]);
    const clear = !taken.some((o) => overlap(tbox(at, '산'), o));
    if (clear && (!S || Math.hypot(hx - S[0], hy - S[1]) > 30)) L.hillLabel = at;
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
  const svg = s('svg', { viewBox: '22 22 216 216', class: 'dial', 'aria-hidden': 'true', focusable: 'false' });
  const add = (...kids) => svg.append(...kids.filter(Boolean));
  add(s('circle', { cx: C, cy: C, r: R, class: 'd-sky' }),
    L.hills && s('path', { d: L.hills, 'fill-rule': 'evenodd', class: 'd-hill' }),
    s('circle', { cx: C, cy: C, r: R, class: 'd-rim' }),
    s('text', { x: L.north.x, y: L.north.y, class: 'd-t' }, '북'),
    L.beam && s('polygon', { points: L.beam.points.map((p) => p.join(',')).join(' '), class: `d-beam${L.beam.off ? ' off' : ''}` }));
  if (L.cross) {
    const { x, y } = L.cross;
    add(s('path', { d: `M${x - 5} ${y - 5} L${x + 5} ${y + 5} M${x + 5} ${y - 5} L${x - 5} ${y + 5}`, class: 'd-x' }));
  }
  const w = L.wall;
  add(s('line', { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, class: `d-wall${w.cls ? ` ${w.cls}` : ''}` }));
  const me = s('g', { transform: `translate(${L.person.x} ${L.person.y}) scale(1.5)` });
  if (L.person.halo) me.append(s('circle', { r: 15, class: 'd-halo' }));
  me.append(s('ellipse', { cx: 0, cy: 1, rx: 10, ry: 4.6, class: 'd-person' }),
    s('circle', { cx: 0, cy: -2.4, r: 4.2, class: 'd-person head' }));
  add(me, ...L.path.map((p) => s('circle', { cx: p.x, cy: p.y, r: 1.7, class: 'd-path' })),
    L.sun && s('circle', { cx: L.sun.x, cy: L.sun.y, r: 8, class: `d-sun${model.lit ? '' : ' off'}` }),
    // words last, so no mark paints over them
    L.reason && label(L.reason, 'xl', L.reason.text),
    label(L.wallLabel, 'wall', L.wallLabel.text),
    label(L.me, 'me', '나'),
    L.hillLabel && label(L.hillLabel, 'hill', '산'),
    L.sunLabel && label(L.sunLabel, 'sunl', '지금 해'));
  return svg;
}
