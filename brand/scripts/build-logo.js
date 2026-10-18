#!/usr/bin/env node
/**
 * build-logo.js — symbol.svg / full-logo.svg / full-logo-horizontal.svg 소스 생성기 (선택 사항)
 *
 * 기존 정체성(해 + 인공외벽 사이드뷰)을 유지한 채 정리한 버전:
 *   - 심볼: 노란 원(해) 앞에 수직 우측면 + 비스듬한 좌측면의 검은 쐐기(오버행 벽 단면)
 *   - 한글 '해벽': 굵은 고딕 + 세로획 끝을 벽 좌측면 각도로 컷팅한 다각형 outline
 *   - 영문 HAEBYEOK | CLIMBING COMMUNITY: 모노라인 산세리프 path (폰트 불필요)
 *   node brand/scripts/build-logo.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..');
const f = (n) => +n.toFixed(2);

/* ───────── 심볼 (512×512) ─────────
 * 레퍼런스 비율: 쐐기 높이 480, 윗변 189, 아랫변 71. 우측면은 수직, 좌측면은 약 14° 기운다(오버행).
 * 해(원)는 지름 ≈ 쐐기 높이의 0.75, 중심이 쐐기 좌측면 위에 놓여 오른쪽이 벽 뒤로 숨는다. */
const WEDGE = [[208, 16], [397, 16], [397, 496], [326, 496]];
const CIRCLE = { cx: 256, cy: 213, r: 181 };
const ANGLE = Math.atan2(WEDGE[3][0] - WEDGE[0][0], WEDGE[3][1] - WEDGE[0][1]); // 좌측면 기울기(수직 기준) ≈ 14°
const CUT_ANGLE = (26 * Math.PI) / 180;   // 획 끝 컷팅 각도 (수평 기준)

const STYLE = `
    :root {
      --primary-yellow: #F3B63F;
      --primary-black: #2B2B2B;
      --logo-text: #2B2B2B;
      --logo-sub: #2B2B2B;
    }
    @media (prefers-color-scheme: dark) {
      :root { --primary-black: #F2F2EE; --logo-text: #F2F2EE; --logo-sub: #F2F2EE; }
    }
    .hb-circle { fill: var(--primary-yellow, #F3B63F); }
    .hb-wall   { fill: var(--primary-black, #2B2B2B); }
    .hb-text   { fill: var(--logo-text, #2B2B2B); }
    .hb-sub    { fill: none; stroke: var(--logo-sub, #2B2B2B); stroke-width: 12; stroke-linejoin: miter; stroke-miterlimit: 4; }
    .hb-sub-light { stroke-width: 6.5; }`;

const symbolShapes = `<circle class="hb-circle" cx="${CIRCLE.cx}" cy="${CIRCLE.cy}" r="${CIRCLE.r}"/>
    <polygon class="hb-wall" points="${WEDGE.map((p) => p.join(',')).join(' ')}"/>`;

const symbolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="hb-title">
  <title id="hb-title">해벽 HAEBYEOK 심볼</title>
  <style>${STYLE}
  </style>
  ${symbolShapes}
</svg>
`;

/* ───────── 한글 획 ───────── */
// 컷선 방향: 'v' = 벽 좌측면과 평행("\"), 'h' = 세로획 끝을 "/" 로 비스듬히 자르는 컷(수평 기준 CUT_ANGLE)
const CUT = { v: [Math.sin(ANGLE), Math.cos(ANGLE)], h: [Math.cos(CUT_ANGLE), -Math.sin(CUT_ANGLE)] };

/** 두께 w 선분 획. cutA/cutB: null(직각) | 'v' | 'h' */
function stroke(x1, y1, x2, y2, w, cutA, cutB) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  const t = [(x2 - x1) / L, (y2 - y1) / L];
  const n = [-t[1], t[0]];
  const hw = w / 2;
  const shifts = (cut) => {                  // [k=-1 가장자리, k=+1 가장자리]의 획 방향 이동량
    if (!cut) return [0, 0];
    const c = CUT[cut];
    const ct = c[0] * t[0] + c[1] * t[1];
    const cn = c[0] * n[0] + c[1] * n[1];
    return [-1, 1].map((k) => (k * hw * ct) / cn);
  };
  const a = shifts(cutA), b = shifts(cutB);
  const P = (x, y, k, s) => [x + k * n[0] * hw + t[0] * s, y + k * n[1] * hw + t[1] * s];
  const pts = [P(x1, y1, -1, a[0]), P(x2, y2, -1, b[0]), P(x2, y2, 1, b[1]), P(x1, y1, 1, a[1])];
  return `M${pts.map((p) => f(p[0]) + ' ' + f(p[1])).join('L')}Z`;
}
const W = 38;
const ring = (cx, cy, R, r) =>
  `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0ZM${cx - r} ${cy}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0Z`;

// 해 = ㅎ + ㅐ  (글자 박스 ≈ 310×300). 세로획 아래 끝과 ㅎ 꼭지 윗끝을 컷팅
const hae = [
  stroke(80, 4, 80, 50, W, 'h', null),
  stroke(10, 88, 150, 88, W, null, null),
  ring(80, 196, 64, 64 - W * 0.85),
  stroke(206, 4, 206, 300, W, null, 'h'),
  stroke(206, 142, 256, 142, W, null, null),
  stroke(292, 4, 292, 300, W, null, 'h'),
];
// 벽 = ㅂ + ㅕ + ㄱ (ㅕ의 긴 세로획이 ㄱ의 세로를 겸함)
const byeok = [
  stroke(34, 4, 34, 176, W, null, null),
  stroke(134, 4, 134, 176, W, null, null),
  stroke(34, 90, 134, 90, W, null, null),
  stroke(34, 157, 134, 157, W, null, null),
  stroke(264, 4, 264, 300, W, null, 'h'),
  stroke(196, 58, 264, 58, W, 'v', null),
  stroke(196, 122, 264, 122, W, 'v', null),
  stroke(70, 252, 264, 252, W, null, null),
];
const GLYPH_GAP = 334;            // 두 번째 글자 x 오프셋
const INK_L = 10, INK_W = 607;    // 한글 잉크 영역(원점 기준)
const HANGUL_H = 300;
const hangulGroup = (tx, ty, s) => `<g class="hb-text" transform="translate(${f(tx)} ${f(ty)}) scale(${s})">
    <path d="${hae.join('')}"/>
    <path d="${byeok.join('')}" transform="translate(${GLYPH_GAP} 0)"/>
  </g>`;

/* ───────── 영문 모노라인 글자 (높이 50) ───────── */
const CAP_H = 50;
const XS = 0.88;                   // 약간 좁은 비율의 산세리프
const GLYPHS = {
  H: [56, 'M5 0V50M51 0V50M5 25H51'],
  A: [58, 'M3 54L29 4L55 54M14 36H44'],
  E: [46, 'M5 0V50M5 5H46M5 25H40M5 45H46'],
  B: [49, 'M5 0V50M5 5H33a10 10 0 0 1 0 20H5M5 25H35a10 10 0 0 1 0 20H5'],
  Y: [56, 'M2 -4L28 26L54 -4M28 26V50'],
  O: [56, 'M28 5C14 5 5 13 5 25S14 45 28 45S51 37 51 25S42 5 28 5Z'],
  K: [54, 'M5 0V50M50 -2L11 28M24 20L52 52'],
  C: [52, 'M50 15C46 9 38 5 28 5C14 5 5 13 5 25C5 37 14 45 28 45C38 45 46 41 50 35'],
  L: [44, 'M5 0V50M5 45H44'],
  I: [10, 'M5 0V50'],
  M: [66, 'M5 50V0M61 50V0M5 5L33 36L61 5'],
  N: [56, 'M5 50V0M51 50V0M5 5L51 45'],
  G: [56, 'M51 15C47 9 39 5 28 5C14 5 5 13 5 25C5 37 14 45 28 45C40 45 49 38 51 28H30'],
  U: [56, 'M5 0V28C5 40 14 45 28 45C42 45 51 40 51 28V0'],
  T: [56, 'M0 5H56M28 5V50'],
};
/** [{t:'HAEBYEOK', light:false} | '|' ...] 을 한 줄로 배치. 반환 {markup, width} (원점 좌상단) */
function line(items, k, g, wordGap, divGap) {
  let x = 0; const out = [];
  items.forEach((it, idx) => {
    if (it === '|') {
      x += divGap * k;
      out.push(`<rect class="hb-circle" x="${f(x)}" y="${f(-8 * k)}" width="${f(4 * k)}" height="${f((CAP_H + 16) * k)}" style="stroke:none"/>`);
      x += 4 * k + divGap * k;
      return;
    }
    const parts = [...it.t].map((ch, i) => {
      const [w, d] = GLYPHS[ch];
      const m = `<g transform="translate(${f(x)} 0) scale(${f(XS * k)} ${k})" clip-path="url(#hb-cap)"><path d="${d}"/></g>`;
      x += w * XS * k + (i < it.t.length - 1 ? g * k : 0);
      return m;
    });
    out.push(`<g${it.light ? ' class="hb-sub-light"' : ''}>${parts.join('')}</g>`);
    if (items[idx + 1] !== '|' && idx < items.length - 1) x += wordGap * k;
  });
  return { markup: out.join('\n    '), width: x };
}
const defs = `<defs>
    <clipPath id="hb-cap"><rect x="-10" y="-1" width="90" height="${CAP_H + 2}"/></clipPath>
  </defs>`;
const svgOpen = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" role="img" aria-labelledby="hb-title">
  <title id="hb-title">해벽 HAEBYEOK</title>
  <style>${STYLE}
  </style>`;
const symbolAt = (x, y, size) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(size / 512)})">
    ${symbolShapes}
  </g>`;

/* ───────── 세로 풀 로고: 심볼 / 해벽 / HAEBYEOK │ CLIMBING COMMUNITY ───────── */
{
  const K = 0.9, G = 11;
  const sub = line([{ t: 'HAEBYEOK' }, '|', { t: 'CLIMBING', light: true }, { t: 'COMMUNITY', light: true }], K, G, 44, 34);
  const PAD = 50;
  const hs = 0.92;                       // 한글 스케일 (잉크 폭 ≈ 560)
  const W_ = Math.max(sub.width, 560) + PAD * 2;
  const symTop = 24;
  const hangulY = symTop + 496 + 70;
  const hangulW = INK_W * hs;
  const subY = hangulY + HANGUL_H * hs + 70;
  const H_ = subY + CAP_H * K + PAD;
  const svg = `${svgOpen(W_, H_)}
  ${defs}
  ${symbolAt((W_ - 512) / 2, symTop, 512)}
  ${hangulGroup((W_ - hangulW) / 2 - INK_L * hs, hangulY, hs)}
  <g class="hb-sub" transform="translate(${f((W_ - sub.width) / 2)} ${f(subY)})">
    ${sub.markup}
  </g>
</svg>
`;
  fs.writeFileSync(path.join(OUT, 'full-logo.svg'), svg);
}

/* ───────── 가로 락업: 심볼 | 해벽 + HAEBYEOK ───────── */
{
  const SYM = 300, hs = 0.8;
  const tx = SYM + 10, ty = 18;
  const hw = INK_W * hs;
  const k = 0.5;
  const word = [...'HAEBYEOK'];
  const sumW = word.reduce((s, c) => s + GLYPHS[c][0] * XS * k, 0);
  const gap = Math.min((hw - sumW) / (word.length - 1), 22 * k);   // 한글 폭에 맞춰 정렬 (너무 벌어지지 않게)
  let x = 0;
  const marks = word.map((c) => {
    const [w, d] = GLYPHS[c];
    const g = `<g transform="translate(${f(x)} 0) scale(${f(XS * k)} ${k})" clip-path="url(#hb-cap)"><path d="${d}"/></g>`;
    x += w * XS * k + gap;
    return g;
  }).join('\n    ');
  const subY = ty + HANGUL_H * hs + 26;
  const W_ = tx + hw + 20, H_ = Math.max(SYM, subY + CAP_H * k) + 6;
  const svg = `${svgOpen(W_, H_)}
  ${defs}
  ${symbolAt(0, 0, SYM)}
  ${hangulGroup(tx - INK_L * hs, ty, hs)}
  <g class="hb-sub" transform="translate(${f(tx)} ${f(subY)})">
    ${marks}
  </g>
</svg>
`;
  fs.writeFileSync(path.join(OUT, 'full-logo-horizontal.svg'), svg);
}

fs.writeFileSync(path.join(OUT, 'symbol.svg'), symbolSvg);
console.log('✔ symbol.svg, full-logo.svg, full-logo-horizontal.svg 생성 (벽 좌측면 각도 %s°)', (ANGLE * 180 / Math.PI).toFixed(1));
