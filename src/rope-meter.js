// src/rope-meter.js — 기록 탭의 밧줄: 다녀온 곳이 늘수록 가닥이 하나, 둘, 셋으로 늘고, 끝에 매듭이 지어지며 색이 켜진다 (사용자 확정 2026-11-05).
// 가닥이 모자라면 점선으로 남기고(없는 것이 아니라 아직 안 온 것), 매듭 전의 가닥은 옅다. 순위·이름·점수 없음. svg는 createElementNS로만 만든다(innerHTML 없음).
import { RANKS } from './rank.js';

const NS = 'http://www.w3.org/2000/svg';

// 다녀온 곳 수 → 단계. 등급의 기준 곳 수(rank.js RANKS: 볕뉘 · 햇귀 · 햇발)와 같은 숫자를 쓴다: 등급 카드와 밧줄이 따로 어긋나지 않는다.
const at = (key) => RANKS.find((r) => r.key === key).at;
export const ROPE_AT = { first: at('first'), three: at('intro'), knot: at('explorer') };
export function ropeStage(visited) {
  const n = Number.isFinite(visited) ? Math.max(0, Math.floor(visited)) : 0;
  const knot = n >= ROPE_AT.knot;
  const strands = knot || n >= ROPE_AT.three ? 3 : n >= ROPE_AT.first ? 1 : 0;
  return { strands, knot };
}
const STAGE_TEXT = (s) => (s.knot ? '매듭이 지어졌어요' : s.strands === 3 ? '세 가닥이에요' : s.strands === 1 ? '첫 가닥이에요' : '아직 가닥이 없어요');

const W = 300, H = 32, CY = 16, AMP = 4, WAVE = 46, KNOT_S = 4.2, KX = W / 2, KNOT_GAP = 13;
const node = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};
const line = (pts, cls, extra = {}) => node('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(''), class: cls, ...extra });
const wave = (phase, x0, x1) => { const out = []; for (let x = x0; x <= x1; x += 2) out.push([x, CY + AMP * Math.sin((2 * Math.PI / WAVE) * x + phase)]); return out; };

// 삼엽 매듭: 세 번 교차하고, 위·아래가 번갈아 지나가도록 위로 올라올 쪽만 한 번 더 덧그린다
function trefoil() {
  const N = 240, pts = [];
  for (let i = 0; i <= N; i++) { const t = (i / N) * 2 * Math.PI; pts.push([KX + KNOT_S * (Math.sin(t) + 2 * Math.sin(2 * t)), CY + KNOT_S * (Math.cos(t) - 2 * Math.cos(2 * t)) * 0.62]); }
  const cross = (a, b, c, d) => { const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (!r) return false; const u = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r, v = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r; return u > 0 && u < 1 && v > 0 && v < 1; };
  const at = [];
  for (let i = 0; i < N; i++) for (let j = i + 6; j < N; j++) { if (i === 0 && j >= N - 6) continue; if (cross(pts[i], pts[i + 1], pts[j], pts[j + 1])) at.push(i, j); }
  at.sort((a, b) => a - b);
  const g = node('g', { class: 'rope-knot' });
  g.append(line(pts, 'rope-halo knot-halo'), line(pts, 'rope-ink'));
  at.forEach((t, idx) => { if (idx % 2 === 0) { const piece = pts.slice(Math.max(0, t - 5), Math.min(N, t + 6) + 1); g.append(line(piece, 'rope-halo knot-halo'), line(piece, 'rope-ink')); } });
  return g;
}

// stage: ropeStage(...)의 결과. 세 가닥 색은 .rope-meter 안에서만 쓴다(style.css).
export function ropeMeter(stage) {
  const svg = node('svg', { viewBox: `0 0 ${W} ${H}`, class: `rope-meter${stage.knot ? ' has-knot' : ''}`, role: 'img', 'aria-label': `기록 밧줄, ${STAGE_TEXT(stage)}`, focusable: 'false' });
  const spans = stage.knot ? [[6, KX - KNOT_GAP], [KX + KNOT_GAP, W - 6]] : [[6, W - 6]];
  for (let i = 0; i < 3; i++) {
    const lit = i < stage.strands;
    for (const [x0, x1] of spans) {
      const pts = wave(i * 2.094, x0, x1);
      if (lit) svg.append(line(pts, 'rope-halo'), line(pts, `rope-strand s${i}${stage.knot ? '' : ' soft'}`));
      else svg.append(line(pts, 'rope-unlit'));
    }
  }
  if (stage.knot) svg.append(trefoil());
  return svg;
}
