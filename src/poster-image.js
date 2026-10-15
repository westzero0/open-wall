// src/poster-image.js — a visit as a card (4:5 1080×1350 or 9:16 1080×1920): the visitor's photo, or a drawn scene, with the wall, the day, the sun and one line on it.
// cleanLine, posterPicture and coverCrop are pure (tested); drawPoster is canvas only.
// Made on this device, never sent. The photo is redrawn on a canvas, so its metadata (EXIF, GPS) never reaches the picture.
import { FONT, wrapLines } from './share-image.js';
import { decideInk, drawScene, paletteFor } from './poster-scene.js';
import { drawLockup } from './poster-lockup.js';
import { sunAt } from './stamp.js';
import { shortName } from './viewmodel.js';

export const MAX_LINE = 40;
const graphemes = (s) => Array.from(new Intl.Segmenter().segment(s), (x) => x.segment); // an emoji (👍🏽) is never cut in half
const p2 = (n) => String(n).padStart(2, '0');

/** cleanLine(s) → the one line for the poster: one space between words, trimmed, at most MAX_LINE characters. */
export function cleanLine(s) {
  const t = typeof s === 'string' ? s.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
  return graphemes(t).slice(0, MAX_LINE).join('').trim();
}

const DAYS = '일월화수목금토';
const WINDS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];

/** compassWord(az) → the wind the sun stands in, one of eight ('남동'): the nearest 45° step. */
export const compassWord = (az) => WINDS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

/** sunArc(az) → {x, y} on the half circle east → west, 0..1 (x: 0 east, 1 west; y: 0 horizon, 1 top). az is clamped to 90..270. */
export function sunArc(az) {
  const th = ((Math.min(270, Math.max(90, az)) - 90) / 180) * Math.PI;
  return { x: 0.5 - 0.5 * Math.cos(th), y: Math.sin(th) };
}

// the order firstVisits (log.js) counts in: day, time (a visit without one first), then id
const stamp = (r) => `${r.date} ${r.time ?? ''}`;
const before = (a, b) => (stamp(a) < stamp(b) ? true : stamp(a) > stamp(b) ? false : a.id <= b.id);
const nth = (log, record, same) => log.filter((r) => same(r) && before(r, record)).length;

/** visitNo(log, record) → which visit to that wall this record is (1 = the first one in the log). */
export const visitNo = (log, record) => nth(log, record, (r) => r.wall === record.wall);

/** monthNo(log, record) → which record of its month this is, over every wall. */
export const monthNo = (log, record) => nth(log, record, (r) => r.date.slice(0, 7) === record.date.slice(0, 7));

/** weatherBrief(h) → '예보 14° · 바람 3m/s' for an hour of the forecast ({t, w}), or null. A forecast, never written as a measurement. */
export const weatherBrief = (h) => (h && Number.isFinite(h.t) && Number.isFinite(h.w) ? `예보 ${Math.round(h.t)}° · 바람 ${Math.round(h.w)}m/s` : null);

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

/**
 * posterPicture(record, wall, line, { log, weather, today }) → { title, issue, name, visit, sunLine, weatherLine, line, arc, date, time }.
 * title: 오늘의 해벽 when the record is of today, else 그날의 해벽; issue: '2026.10.14 수'; visit: '3번째 방문 · 이달 6번째' (counted over the log,
 * '첫 방문' for the first); sunLine: '10:30 · 양달 · 남동쪽' ('… · 해가 없는 시간' at night, null without a time or sun data); arc: the sun's
 * place on the arc ({x, y, lit}) or null; weatherLine: only for a record of today with a time and a forecast hour (weather: {t, w}).
 * Nothing is made up: what is not known is null.
 */
export function posterPicture(record, wall, line, { log = [], weather = null, today = todayStr() } = {}) {
  const [y, m, d] = record.date.split('-').map(Number);
  const extra = log.some((r) => r.id === record.id) ? 0 : 1; // a record not in the log yet is counted on top of the ones before it
  const n = visitNo(log, record) + extra;
  const k = monthNo(log, record) + extra;
  const sun = sunAt(wall, record.date, record.time ?? null);
  const time = record.time ?? null;
  const sunLine = !sun ? null : sun.kind === 'night' ? `${time} · 해가 없는 시간` : `${time} · ${sun.kind === 'lit' ? '양달' : '응달'} · ${compassWord(sun.az)}쪽`;
  return {
    title: record.date === today ? '오늘의 해벽' : '그날의 해벽',
    issue: `${y}.${p2(m)}.${p2(d)} ${DAYS[new Date(y, m - 1, d).getDay()]}`,
    name: wall ? shortName(wall) : record.wall,
    visit: `${n === 1 ? '첫 방문' : `${n}번째 방문`} · 이달 ${k}번째`,
    sunLine,
    weatherLine: record.date === today && time ? weatherBrief(weather) : null,
    line: cleanLine(line),
    arc: sun && sun.kind !== 'night' ? { ...sunArc(sun.az), lit: sun.kind === 'lit' } : null,
    date: record.date,
    time,
    sunKind: sun ? sun.kind : null,
    hour: time ? Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60 : null,
    sunword: !sun ? null : sun.kind === 'night' ? '해 없음' : sun.kind === 'lit' ? '양달' : '응달',
    compass: sun && sun.kind !== 'night' ? `${compassWord(sun.az)}쪽` : null,
    cells: [['방문', n === 1 ? '첫 방문' : `${n}번째`], ['이달', `${k}번째`], ...(record.date === today && time && weatherBrief(weather) ? [['예보', `${Math.round(weather.t)}° · ${Math.round(weather.w)}m/s`]] : [])],
  };
}

export const RATIOS = { '4:5': { w: 1080, h: 1350 }, '9:16': { w: 1080, h: 1920 } };
export const DEFAULT_RATIO = '4:5';
export const RATIO_KEY = 'open-wall:poster-ratio';
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

const unit = (v, d = 0.5) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** clampZoom(z) → z kept within MIN_ZOOM..MAX_ZOOM (NaN → 1). */
export const clampZoom = (z) => (Number.isFinite(z) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) : MIN_ZOOM);

/**
 * coverCrop(sw, sh, dw, dh, fx = 0.5, fy = 0.5, zoom = 1) → {sx, sy, sw, sh}: the part of an sw×sh photo that fills a dw×dh frame (object-fit: cover),
 * 1/zoom as wide and tall. fx, fy (0..1) place it within the room it has to slide: 0 = left/top edge, 1 = right/bottom edge. Never leaves the photo.
 */
export function coverCrop(sw, sh, dw, dh, fx = 0.5, fy = 0.5, zoom = 1) {
  const k = Math.max(dw / sw, dh / sh);
  const z = clampZoom(zoom);
  const w = dw / k / z;
  const h = dh / k / z;
  return { sx: (sw - w) * unit(fx), sy: (sh - h) * unit(fy), sw: w, sh: h };
}

/** freeRoom(sw, sh, dw, dh, zoom = 1) → {x, y}: how far the photo can slide under the frame, in card pixels (0 = no room that way). */
export function freeRoom(sw, sh, dw, dh, zoom = 1) {
  const c = coverCrop(sw, sh, dw, dh, 0.5, 0.5, zoom);
  const k = dw / c.sw;
  return { x: Math.max(0, (sw - c.sw) * k), y: Math.max(0, (sh - c.sh) * k) };
}

/** rezoom(sw, sh, dw, dh, focus, z0, z1) → {x, y}: the focus that keeps the centre of the window where it was when the zoom goes z0 → z1. */
export function rezoom(sw, sh, dw, dh, focus, z0, z1) {
  const a = coverCrop(sw, sh, dw, dh, focus.x, focus.y, z0);
  const b = coverCrop(sw, sh, dw, dh, 0, 0, z1);
  const axis = (f, s0, w0, whole, w1) => {
    const room = whole - w1;
    if (room <= 1e-9) return unit(f);
    return unit((s0 + w0 / 2 - w1 / 2) / room);
  };
  return { x: axis(focus.x, a.sx, a.sw, sw, b.sw), y: axis(focus.y, a.sy, a.sh, sh, b.sh) };
}

/** moveFocus(focus, {dx, dy}, room) → {x, y}: the photo moved by dx, dy card pixels, so the window goes the other way; a way with no room stays. */
export function moveFocus(focus, { dx, dy }, room) {
  const axis = (f, d, r) => (r > 0 ? unit(f - d / r) : unit(f));
  return { x: axis(focus.x, dx, room.x), y: axis(focus.y, dy, room.y) };
}

/** loadRatio(storage) → '4:5' | '9:16': the last one chosen on this device; anything else, or a blocked storage, is '4:5'. */
export function loadRatio(storage) {
  try {
    const v = storage.getItem(RATIO_KEY);
    return Object.hasOwn(RATIOS, v) ? v : DEFAULT_RATIO;
  } catch {
    return DEFAULT_RATIO;
  }
}

/** saveRatio(storage, ratio) → whether it was kept (only the two ratios; never throws). */
export function saveRatio(storage, ratio) {
  if (!Object.hasOwn(RATIOS, ratio)) return false;
  try {
    storage.setItem(RATIO_KEY, ratio);
    return true;
  } catch {
    return false;
  }
}

/** thumbSize(ratio) → [w, h] of the thumbnail: 180 wide, the card's own shape. */
export const thumbSize = (ratio) => [180, ratio === '9:16' ? 320 : 225];

/** coverSize(sw, sh, dw, dh) → [w, h]: the size to scale an sw×sh photo to so that it still covers a dw×dh page; never larger than the photo. */
export function coverSize(sw, sh, dw, dh) {
  const k = Math.min(1, Math.max(dw / sw, dh / sh));
  return [Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k))];
}

// ---- the plate: where everything of the Quiet Meridian card stands, per ratio (1080 wide; the numbers are the approved mockup's)
const CW = 1080;
const LOGO = 88; // the lockup's height; the rule under it sits 22px lower and everything below follows
const MARGIN = 64;
const RULE = 56 + LOGO + 22;
export const SMALL_R = 150; // the sun path over a photo: small, so the middle of the picture stays clear
const PLATE = {
  '4:5': { H: 1350, R: 400, cy: 856, nb: 352, ry: 1148 },
  '9:16': { H: 1920, R: 424, cy: 1134, nb: 416, ry: 1718 },
};
export const NAME_SIZE = 88;
export const NAME_MIN = 56;
export const QUOTE_SIZE = 33;

/**
 * plateLayout(ratio, { nameLines, quoteLines, nameSize, small }) → { H, ry, nb, rule, name, quote, nameSize, nameTop, dome, cells }: baselines (name, quote)
 * stacked up from the rule above the record cells. dome = { cx, cy, R, big }: the big sun path (the scene's) only when the name block leaves room under it,
 * else the small one over the name; small: true (a photo is the ground) always takes the small one.
 */
export function plateLayout(ratio, { nameLines = 1, quoteLines = 0, nameSize = NAME_SIZE, small = false } = {}) {
  const P = Object.hasOwn(PLATE, ratio) ? PLATE[ratio] : PLATE['4:5'];
  const quote = Array.from({ length: quoteLines }, (_, i) => P.ry - 44 - (quoteLines - 1 - i) * 40);
  const first = quoteLines ? P.ry - 44 - (quoteLines - 1) * 40 - 64 : P.ry - 108;
  const step = nameSize * 1.06;
  const name = Array.from({ length: nameLines }, (_, i) => first - (nameLines - 1 - i) * step);
  const nameTop = name[0] - nameSize * 0.85;
  const big = !small && nameTop >= P.cy + 64;
  return {
    H: P.H, ry: P.ry, nb: P.nb, rule: RULE, name, quote, nameSize, nameTop,
    dome: { cx: CW / 2, cy: big ? P.cy : nameTop - 80, R: big ? P.R : SMALL_R, big },
    cells: { label: P.ry + 46, value: P.ry + 98 },
  };
}

// ---- legibility on any ground: the zones the ink must hold on, measured on the ground and the veil that is laid over it
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const KINDS = { cream: [244, 242, 236], dark: [23, 25, 28] };
const VEIL = { cream: [10, 12, 14], dark: [244, 242, 236] }; // the ground is darkened for cream ink and lightened for dark ink

/** veilAlpha(y, H, k) → how much veil lies at height y of an H-high card at strength k (0.10 … 0.55): a gentle one overall, deeper at the head and the foot. */
export function veilAlpha(y, H, k) {
  const kp = 0.6 + (k - 0.1) * (1.4 / 0.45);
  const top = clamp(1 - y / 380, 0, 1) ** 1.4 * 0.52;
  const foot = clamp((y - (H - 700)) / 700, 0, 1) ** 1.25 * 0.7;
  return clamp(kp * (0.1 + top + foot), 0, 0.92);
}

/**
 * plateZones(layout, { dome, hour, numeral, nameWidth, quoteWidth }) → [{ need, rect | pts }]: the places type and lines stand, in card pixels.
 * need is the WCAG ratio the ink must reach there (4.5 small type, 3 large type and lines).
 */
export function plateZones(lay, { dome = false, nameWidth = 952, quoteWidth = 952, sunword = true, photo = false } = {}) {
  const z = [
    { need: 4.5, rect: [MARGIN, 54, 952, LOGO + 66] },
    { need: photo ? 4.5 : 3, rect: [56, lay.nb - 135, 420, 160] }, // over a photo the numeral is set a weight heavier and held to the small-type ratio: thin strokes vanish on a busy picture
  ];
  if (sunword) z.push({ need: 3, rect: [840, lay.nb - 90, 176, 100] });
  if (dome) {
    const { cx, cy, R } = lay.dome;
    const pts = [];
    for (let i = 0; i <= 90; i += 1) {
      const a = Math.PI + (i / 90) * Math.PI;
      for (const d of [-7, 7]) pts.push([cx + (R + d) * Math.cos(a), cy + (R + d) * Math.sin(a)]);
    }
    z.push({ need: 3, pts });
  }
  z.push({ need: 3, rect: [MARGIN, lay.nameTop, nameWidth, lay.name.at(-1) + lay.nameSize * 0.2 - lay.nameTop] });
  if (lay.quote.length) z.push({ need: 4.5, rect: [MARGIN, lay.quote[0] - QUOTE_SIZE, quoteWidth, lay.quote.at(-1) + 10 - (lay.quote[0] - QUOTE_SIZE)] });
  z.push({ need: 4.5, rect: [MARGIN, lay.ry + 22, 952, 84] });
  return z;
}

/**
 * inkFor(rgba, w, h, zones) → { ink: 'cream' | 'dark', k }: for a ground of w×h pixels (w = 1080 or a scaled copy), the ink and veil strength with which
 * every zone reaches its contrast. The worst tenth of the pixels is what counts (the brightest for cream ink, the darkest for dark ink).
 */
export function inkFor(rgba, w, h, zones) {
  const s = w / CW;
  const at = (x, y) => {
    const o = (clamp(Math.round(y * s), 0, h - 1) * w + clamp(Math.round(x * s), 0, w - 1)) * 4;
    return [rgba[o], rgba[o + 1], rgba[o + 2], y];
  };
  const sampled = zones.map((zn) => {
    const px = [];
    if (zn.rect) {
      const [x, y, zw, zh] = zn.rect;
      for (let yy = y; yy < y + zh; yy += 5) for (let xx = x; xx < x + zw; xx += 5) px.push(at(xx, yy));
    } else for (const [xx, yy] of zn.pts) px.push(at(xx, yy));
    return { need: zn.need, px };
  }).filter((zn) => zn.px.length); // a zone with nothing in it (an empty name) has nothing to read
  const H = h / s;
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const li = { cream: lum(...KINDS.cream), dark: lum(...KINDS.dark) };
  return decideInk((ink, k) => sampled.map(({ need, px }) => {
    const v = VEIL[ink];
    const ls = px.map(([r, g, b, y]) => { const a = veilAlpha(y, H, k); return lum(r + (v[0] - r) * a, g + (v[1] - g) * a, b + (v[2] - b) * a); }).sort((p, q) => p - q);
    const tail = ink === 'cream' ? ls[Math.floor(ls.length * 0.9)] : ls[Math.floor(ls.length * 0.1)];
    return { need, got: ink === 'cream' ? (li.cream + 0.05) / (tail + 0.05) : (tail + 0.05) / (li.dark + 0.05) };
  }));
}

const SUN = '#f4b942';
const AMBER = '#9a5f00'; // the sun's colour on a light ground: the yellow vanishes on paper (1.6:1), this holds 4.7:1
const sans = (w, s) => `${w} ${s}px ${FONT}`;
const mono = (s) => `400 ${s}px ui-monospace, Consolas, monospace`;

/**
 * drawPoster(canvas, pic, bitmap, { ratio = '4:5', focus = {x: .5, y: .5}, zoom = 1, dome = 'on', seed = 0 }) → Promise<{ ink, k, ok }> (ok false: no ink and veil made every zone readable on this ground).
 * Sizes the canvas to the ratio and draws the card: the photo (cropped by focus and zoom) or, without one, the scene of the hour; a veil and an ink
 * chosen so every zone is readable on that ground; then the plate: the lockup, the day, the time as a large numeral on a leader, the sun path
 * (when pic.arc and dome is 'on'; big over the scene, small over a photo), the wall, the 한마디 and the three record cells.
 */
export async function drawPoster(canvas, pic, bitmap, { ratio = DEFAULT_RATIO, focus = { x: 0.5, y: 0.5 }, zoom = 1, dome = 'on', seed = 0 } = {}) {
  const { w: W, h: H } = Object.hasOwn(RATIOS, ratio) ? RATIOS[ratio] : RATIOS[DEFAULT_RATIO];
  const sample = `${pic.title}${pic.name}${pic.line}${pic.issue}${pic.sunword ?? ''}${pic.compass ?? ''}${(pic.cells ?? []).flat().join('')}동남서 0123456789:`;
  const loaded = Promise.all([[100, 172], [200, 172], [300, 50], [400, 21], [300, NAME_SIZE], [400, QUOTE_SIZE], [300, 24], [400, 17]].map(([wt, sz]) => document.fonts.load(sans(wt, sz), sample)));
  // a font that cannot be had (offline, slow) must not stop the card: after two seconds, or on an error, it is drawn in the fallback font
  await Promise.race([loaded.catch(() => {}), new Promise((ok) => setTimeout(ok, 2000))]);
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  // the ground
  if (bitmap) {
    const crop = coverCrop(bitmap.width, bitmap.height, W, H, focus.x, focus.y, zoom);
    g.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H);
  } else drawScene(g, W, H, paletteFor(pic.hour, pic.sunKind), seed);

  // the words: the name on one line (smaller down to NAME_MIN) or two, the 한마디 in at most two
  const measure = (t) => g.measureText(t).width;
  let nameSize = NAME_SIZE;
  g.font = sans(300, nameSize);
  while (measure(pic.name) > W - 2 * MARGIN && nameSize > NAME_MIN) { nameSize -= 2; g.font = sans(300, nameSize); }
  const nameLines = measure(pic.name) > W - 2 * MARGIN ? wrapLines(measure, pic.name, W - 2 * MARGIN, 2, true) : [pic.name];
  const nameWidth = Math.min(W - 2 * MARGIN, Math.max(...nameLines.map(measure)));
  g.font = sans(400, QUOTE_SIZE);
  const quoteLines = pic.line ? wrapLines(measure, `“${pic.line}”`, W - 2 * MARGIN, 2, true) : [];
  const quoteWidth = quoteLines.length ? Math.min(W - 2 * MARGIN, Math.max(...quoteLines.map(measure))) : 0;
  const lay = plateLayout(ratio, { nameLines: nameLines.length, quoteLines: quoteLines.length, nameSize, small: !!bitmap });
  const showDome = dome === 'on' && !!pic.arc && pic.hour != null;

  // ink and veil from what the ground really is under each zone
  const ground = g.getImageData(0, 0, W, H).data;
  const { ink: inkName, k, ok } = inkFor(ground, W, H, plateZones(lay, { dome: showDome, nameWidth, quoteWidth, sunword: !!pic.sunword, photo: !!bitmap }));
  const veil = VEIL[inkName];
  const grad = g.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i <= 40; i += 1) grad.addColorStop(i / 40, `rgba(${veil[0]},${veil[1]},${veil[2]},${veilAlpha((i / 40) * H, H, k).toFixed(3)})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const ik = KINDS[inkName];
  const A = (a) => `rgba(${ik[0]},${ik[1]},${ik[2]},${a})`;
  const acc = inkName === 'dark' ? AMBER : SUN;
  const lit = pic.arc?.lit === true;
  const line = (x0, y0, x1, y1, lw, a, col) => { g.strokeStyle = col ?? A(a); g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const dot = (x, y, r, fill, stroke, lw) => {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  };
  const text = (s, x, y, font, a, align = 'left', tracking = 0, col) => {
    g.font = font;
    if ('letterSpacing' in g) g.letterSpacing = `${tracking}px`;
    g.fillStyle = col ?? A(a);
    const w = g.measureText(s).width - tracking;
    g.textAlign = 'left';
    g.fillText(s, align === 'left' ? x : align === 'center' ? x - w / 2 : x - w, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    return w;
  };
  g.textBaseline = 'alphabetic';
  g.lineCap = 'butt';

  // registration marks, the head
  for (const [x, y, dx, dy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]]) { line(x, y, x + 22 * dx, y, 1.5, 0.75); line(x, y, x, y + 22 * dy, 1.5, 0.75); }
  drawLockup(g, MARGIN + 8, 56, LOGO, A(1), SUN);
  text(pic.title, W - MARGIN, 56 + LOGO * 0.62, sans(300, 24), 0.92, 'right', 7);
  line(MARGIN, RULE, W - MARGIN, RULE, 1, 0.59);
  const [date, dow] = pic.issue.split(' ');
  const dw = text(date, MARGIN, RULE + 36, mono(17), 0.84, 'left', 3);
  text(dow ?? '', MARGIN + dw + 14, RULE + 36, sans(400, 17), 0.84);

  // the reading: the time as a very large thin numeral, the sun word and the wind on the right
  const nb = lay.nb;
  text(pic.time ?? pic.date.slice(5).replace('-', '.'), MARGIN - 7, nb, sans(bitmap ? 200 : 100, 172), 0.98);
  if (pic.sunword) text(pic.sunword, W - MARGIN, nb - 40, sans(300, 50), 0.98, 'right', 2);
  if (pic.compass) text(pic.compass, W - MARGIN, nb, sans(400, 21), 0.82, 'right', 6);
  const yl = nb + 22;
  if (showDome) drawDome(lay.dome);
  else line(MARGIN, yl, W - MARGIN, yl, 1.3, 0.84);

  // the record: the wall, the 한마디, the cells under a rule
  nameLines.forEach((l, i) => text(l, MARGIN, lay.name[i], sans(300, nameSize), 0.98));
  quoteLines.forEach((l, i) => text(l, MARGIN, lay.quote[i], sans(400, QUOTE_SIZE), 0.9));
  line(MARGIN, lay.ry, W - MARGIN, lay.ry, 1, 0.59);
  const cells = pic.cells ?? [];
  const cw = (W - 2 * MARGIN) / Math.max(1, cells.length);
  cells.forEach(([lab, val], i) => {
    const x = MARGIN + i * cw + (i ? 24 : 0);
    if (i) line(MARGIN + i * cw, lay.ry + 18, MARGIN + i * cw, lay.ry + 104, 1, 0.31);
    text(lab, x, lay.cells.label, sans(400, 18), 0.67, 'left', 6);
    text(val, x, lay.cells.value, sans(300, 40), 0.96);
  });
  return { ink: inkName, k, ok };

  // the sun path: a dome with hour ticks and a dashed path, the sun on it (filled in the sun, hollow in the shade)
  function drawDome({ cx, cy, R, big }) {
    const hour = clamp(pic.hour, 6, 18);
    const phi = Math.PI + ((hour - 6) / 12) * Math.PI;
    const mx = cx + R * Math.cos(phi), my = cy + 0.72 * R * Math.sin(phi);
    if (big) {
      line(MARGIN, yl, mx, yl, 1.3, 0.84);
      dot(mx, yl, 5, lit ? acc : A(0.95));
      line(mx, yl + 5, mx, my - 56, 1.3, 0.9, lit ? acc : A(0.82));
      line(MARGIN, cy, W - MARGIN, cy, 1.5, 0.9);
    } else {
      line(MARGIN, yl, W - MARGIN, yl, 1.3, 0.84);
      line(cx - R - 60, cy, cx + R + 60, cy, 1.5, 0.9);
    }
    g.strokeStyle = A(0.92); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, Math.PI, Math.PI * 2); g.stroke();
    g.strokeStyle = A(0.37); g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R * 0.5, Math.PI, Math.PI * 2); g.stroke();
    for (let h = 6; h <= 18; h += 1) {
      const ph = Math.PI + ((h - 6) / 12) * Math.PI;
      const ox = cx + R * Math.cos(ph), oy = cy + R * Math.sin(ph), major = h % 3 === 0, len = major ? 24 : 11;
      if (h > 6 && h < 18) line(ox, cy, ox, oy, 1, 0.13);
      line(ox, oy, cx + (R + len) * Math.cos(ph), cy + (R + len) * Math.sin(ph), major ? 1.5 : 1, major ? 0.92 : 0.55);
      if (major) text(String(h).padStart(2, '0'), cx + (R + 46) * Math.cos(ph), cy + (R + 46) * Math.sin(ph) + (h === 6 || h === 18 ? -16 : 5), mono(17), 0.78, 'center');
    }
    dot(cx + R * Math.cos(phi), cy + R * Math.sin(phi), 4.5, lit ? acc : A(0.95));
    g.save(); g.setLineDash([9, 9]); g.strokeStyle = A(0.92); g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, R, 0.72 * R, 0, Math.PI, Math.PI * 2); g.stroke(); g.restore();
    for (const [s, x] of [['동', cx - R], ['남', cx], ['서', cx + R]]) text(s, x, cy + 50, sans(300, 22), 0.84, 'center');
    const gr = big ? 120 : 60;
    if (lit) {
      const gl = g.createRadialGradient(mx, my, 0, mx, my, gr);
      gl.addColorStop(0, `rgba(244,185,66,${big ? 0.34 : 0.2})`); gl.addColorStop(1, 'rgba(244,185,66,0)');
      g.fillStyle = gl; g.fillRect(mx - gr, my - gr, gr * 2, gr * 2);
    }
    const ring = big ? 30 : 19, core = big ? 15 : 11;
    dot(mx, my, ring, null, lit ? acc : A(0.95), 1.5);
    if (lit) dot(mx, my, core, SUN, A(0.95), 2);
    else { dot(mx, my, core, 'rgba(14,18,24,.84)'); dot(mx, my, core, null, A(0.96), 2.4); }
    if (big) for (const a of [0, 90, 180, 270]) { const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180); line(mx + 40 * c, my + 40 * s, mx + 53 * c, my + 53 * s, 1.5, 0.92, lit ? acc : A(0.92)); }
  }
}
