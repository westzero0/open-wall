// src/plan-card-draw.js — paints the promise card v3 (1080×1920, docs/system/planner-tokens.md "약속 카드 v3"). Canvas API only.
// Icons are the planner's own shapes (planner-shapes.js, drawn with Path2D); the card is always light, whatever the user's theme.
import { W, H, M, FONT, wrapLines, image } from './share-image.js';
import { linkHost } from './plan-card.js';
import { ICON_SHAPES, SYMBOL_SHAPES, peopleShapes } from './planner-shapes.js';

export const CARD = { paper: '#f4f1ea', ink: '#17191b', moss: '#3f5a2d', muted: '#5d5a52', link: '#6e6a60', warn: '#b3261e' };
const LOGO_H = 170;
const WORDMARK_RATIO = 367.364 / 167.273; // assets/hinoae-wordmark.svg viewBox: ink on a light ground
const PEAKS = { w: 660, h: 660 * 460 / 600, right: 40, bottom: 110, apex: 64 / 506.7 }; // assets/planner-peaks.svg 600×460 drawn 660 wide, 40 past the right edge; apex = how far below its top the first peak starts
const ICON = 84, ICON_COL = 96, GAP = 36, ROW_GAP = 46, TITLE = 68, SUB = 42, ROWS_TOP = 840, TEXT_W = W - M - (M + ICON_COL + GAP);
const WEATHER_STROKE = 0.65; // the 24-grid weather/people icons are drawn for 24–34px; at 84px their stroke is thinned to match the 48-grid symbols

/** drawShapes(g, nodes, { x, y, size, vb, color, k }) — planner-shapes nodes onto the canvas (k thins the strokes). */
export function drawShapes(g, nodes, { x, y, size, vb, color, k = 1 }) {
  const walk = (n, inherit) => {
    const a = { ...inherit, ...n.a };
    if (n.t === 'clip') { g.save(); g.clip(new Path2D(n.d)); n.k.forEach((c) => walk(c, a)); g.restore(); return; }
    const op = n.a?.opacity ?? 1;
    g.save();
    g.globalAlpha *= op;
    if (n.tf) { g.translate(n.tf.x, n.tf.y); g.scale(n.tf.s, n.tf.s); }
    if (n.t === 'g') { n.k.forEach((c) => walk(c, { ...a, opacity: undefined })); g.restore(); return; }
    const p = new Path2D();
    if (n.t === 'circle') p.arc(n.cx, n.cy, n.r, 0, Math.PI * 2); else p.addPath(new Path2D(n.d));
    const pick = (v) => (v === 'currentColor' ? color : v);
    if (a.fill && a.fill !== 'none') { g.fillStyle = pick(a.fill); g.fill(p); }
    if (a.stroke && a.stroke !== 'none') {
      g.strokeStyle = pick(a.stroke);
      g.lineWidth = (a['stroke-width'] ?? 1) * k;
      g.lineCap = a['stroke-linecap'] ?? 'butt';
      g.lineJoin = a['stroke-linejoin'] ?? 'miter';
      g.setLineDash(a['stroke-dasharray'] ? String(a['stroke-dasharray']).split(/[ ,]+/).map((v) => Number(v) * k) : []);
      g.stroke(p);
    }
    g.restore();
  };
  g.save();
  g.translate(x, y);
  g.scale(size / vb, size / vb);
  nodes.forEach((n) => walk(n, {}));
  g.restore();
}

export async function drawPlanCard(canvas, model) {
  await Promise.all(['800 300px', '600 64px', '500 42px', '800 68px'].map((f) => document.fonts.load(`${f} ${FONT}`, '희노애Rock 0123 취소됨 변경됨 토요일')));
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = CARD.paper;
  g.fillRect(0, 0, W, H);
  const faded = model.badge === '취소됨' ? 0.4 : 1; // cancelled: logo, date, place, people are faded, no strike-through
  const text = (s, size, weight, color, x, y, alpha = 1) => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.globalAlpha = alpha; g.fillText(s, x, y); g.globalAlpha = 1; };
  g.font = `600 ${TITLE}px ${FONT}`;

  // rows first (their height decides how big the peaks may be)
  const lines = (s, size, weight, max) => { g.font = `${weight} ${size}px ${FONT}`; return wrapLines((t) => g.measureText(t).width, s, TEXT_W, max, true); };
  const rows = [];
  if (model.title) rows.push({ shapes: model.kind ? SYMBOL_SHAPES[model.kind]() : null, vb: 48, k: 1, color: CARD.ink, title: lines(model.title, TITLE, 800, 2), sub: model.sub, alpha: faded });
  if (model.wx) rows.push({ shapes: model.wxIcon ? ICON_SHAPES[model.wxIcon]() : null, vb: 24, k: WEATHER_STROKE, color: model.wxWarn ? CARD.warn : CARD.ink, title: lines(model.wx, TITLE, 800, 1), sub: model.wxSub, alpha: 1 });
  if (model.people > 0) rows.push({ shapes: peopleShapes(model.people), vb: 24, k: WEATHER_STROKE, color: CARD.ink, title: lines(model.who ?? `${model.people}명`, TITLE, 800, 2), sub: model.who ? `${model.people}명` : null, alpha: faded });
  let y = ROWS_TOP;
  for (const r of rows) { r.top = y; r.h = r.title.length * 75 + (r.sub ? 8 + 63 : 0); y += r.h + ROW_GAP; }
  const bottom = y - ROW_GAP;

  // peaks: bottom-right, shrunk (anchored at the bottom) until the first peak clears the last row
  const s = Math.max(0.4, Math.min(1, (H - PEAKS.bottom - bottom - 30) / (PEAKS.h * (1 - PEAKS.apex))));
  const peaks = await image('assets/planner-peaks.svg');
  if (peaks) g.drawImage(peaks, W + PEAKS.right - PEAKS.w * s, H - PEAKS.bottom - PEAKS.h * s, PEAKS.w * s, PEAKS.h * s);

  // logo and badge
  const sign = await image('assets/hinoae-wordmark.svg');
  g.globalAlpha = faded;
  if (sign) g.drawImage(sign, M, 100, LOGO_H * WORDMARK_RATIO, LOGO_H);
  g.globalAlpha = 1;
  if (model.badge) text(model.badge, 52, 800, model.badge === '취소됨' ? CARD.warn : CARD.ink, M, 340);

  // date block: `11월` over the big day number, weekday and time to its right, one heavy rule
  if (model.month) text(model.month, 64, 800, CARD.moss, M, 450, faded);
  let right = M;
  if (model.day != null) {
    g.font = `800 300px ${FONT}`;
    g.letterSpacing = '-8px';
    right = M + g.measureText(String(model.day)).width + GAP;
    g.fillStyle = CARD.moss;
    g.globalAlpha = faded;
    g.fillText(String(model.day), M, 728);
    g.globalAlpha = 1;
    g.letterSpacing = '0px';
  }
  if (model.dow) text(model.dow, 64, 600, CARD.ink, right, model.time ? 553 : 696, faded);
  if (model.time) text(model.time, 104, 800, CARD.ink, right, 696, faded);
  g.fillStyle = CARD.ink;
  g.fillRect(M, 784, W - M * 2, 4);

  // info rows
  for (const r of rows) {
    if (r.shapes) drawShapes(g, r.shapes, { x: M + (ICON_COL - ICON) / 2, y: r.top + r.h / 2 - ICON / 2, size: ICON, vb: r.vb, color: r.color, k: r.k });
    r.title.forEach((l, i) => text(l, TITLE, 800, r.color, M + ICON_COL + GAP, r.top + i * 75 + 64, r.alpha));
    if (r.sub) text(r.sub, SUB, 500, CARD.muted, M + ICON_COL + GAP, r.top + r.title.length * 75 + 53, r.alpha);
  }

  const host = linkHost(model.link);
  if (host) text(host, 36, 600, CARD.link, M, H - 96);
}
