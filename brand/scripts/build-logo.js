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
 * 시안 B 기준. 쐐기 높이 480, 윗변 189, 아랫변 ≈54. 우측면 수직, 좌측면 ≈15° 기울어짐(오버행).
 * 해(원)는 지름 ≈ 쐐기 높이의 0.68. 중심이 쐐기 좌측면 위에 놓여 오른쪽이 벽 뒤로 숨고,
 * 벽 둘레에 얇은 투명 간격(SUN_GAP)을 두어 해와 벽을 분리한다. */
const WEDGE = [[203, 16], [392, 16], [392, 496], [338, 496]];
const CIRCLE = { cx: 262, cy: 208, r: 170 };
const SUN_GAP = 5;
const ANGLE = Math.atan2(WEDGE[3][0] - WEDGE[0][0], WEDGE[3][1] - WEDGE[0][1]);
const CUT_ANGLE = (26 * Math.PI) / 180;   // 세로획 아래 끝 컷팅 각도 (수평 기준)

const STYLE = `
    :root {
      --primary-yellow: #FBB041;
      --primary-black: #2B2B2B;
      --logo-text: #2B2B2B;
      --logo-sub: #2B2B2B;
    }
    @media (prefers-color-scheme: dark) {
      :root { --primary-black: #F2F2EE; --logo-text: #F2F2EE; --logo-sub: #F2F2EE; }
    }
    .hb-circle { fill: var(--primary-yellow, #FBB041); }
    .hb-wall   { fill: var(--primary-black, #2B2B2B); }
    .hb-text   { fill: var(--logo-text, #2B2B2B); }
    .hb-sub    { fill: none; stroke: var(--logo-sub, #2B2B2B); stroke-width: 10; stroke-linejoin: miter; stroke-miterlimit: 4; }
    .hb-sub-light { stroke-width: 5.5; }`;

const wedgePts = WEDGE.map((p) => p.join(',')).join(' ');
const symbolShapes = `<mask id="hb-mask"><rect x="0" y="0" width="512" height="512" fill="#fff"/><polygon points="${wedgePts}" fill="#000" stroke="#000" stroke-width="${SUN_GAP * 2}" stroke-linejoin="miter"/></mask>
    <circle class="hb-circle" cx="${CIRCLE.cx}" cy="${CIRCLE.cy}" r="${CIRCLE.r}" mask="url(#hb-mask)"/>
    <polygon class="hb-wall" points="${wedgePts}"/>`;

const symbolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="hb-title">
  <title id="hb-title">해벽 HAEBYEOK 심볼</title>
  <style>${STYLE}
  </style>
  ${symbolShapes}
</svg>
`;

/* ───────── 한글 획 ───────── */
// 컷선 방향: 'v' = 벽 좌측면과 평행("\"), 'h' = 세로획 아래 끝을 "/" 로 비스듬히 자르는 컷
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
const WV = 34, WH = 28;      // 세로획 / 가로획 두께 (가로획이 살짝 가늘다)
const ell = (cx, cy, rx, ry) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
// 반대 방향으로 그려 구멍을 만든다
const ellHole = (cx, cy, rx, ry) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 1 ${2 * rx} 0a${rx} ${ry} 0 1 1 ${-2 * rx} 0Z`;

// 해 = ㅎ + ㅐ (글자 높이 300). ㅎ의 ㅇ 구멍은 해(노랑)로 채운다
const SUN_HOLE = { cx: 76, cy: 150, rx: 24, ry: 30 };
const hae = [
  stroke(32, 14, 120, 14, WH, null, null),
  stroke(2, 60, 150, 60, WH, null, null),
  ell(76, 150, 64, 62) + ellHole(SUN_HOLE.cx, SUN_HOLE.cy, SUN_HOLE.rx, SUN_HOLE.ry),
  stroke(196, 0, 196, 280, WV, null, 'h'),
  stroke(196, 140, 240, 140, WH, null, null),
  stroke(270, 0, 270, 280, WV, null, 'h'),
];
// 벽 = ㅂ + ㅕ + ㄱ (ㅕ의 긴 세로획이 ㄱ의 세로를 겸함)
const byeok = [
  stroke(28, 0, 28, 157, WV, null, null),
  stroke(124, 0, 124, 157, WV, null, null),
  stroke(28, 72, 124, 72, WH, null, null),
  stroke(28, 143, 124, 143, WH, null, null),
  stroke(252, 0, 252, 280, WV, null, 'h'),
  stroke(186, 48, 252, 48, WH, null, null),
  stroke(186, 104, 252, 104, WH, null, null),
  stroke(62, 198, 252, 198, WH, null, null),
];
const GLYPH_GAP = 316;
const INK_L = 2, INK_W = 583;     // 한글 잉크 영역 (원점 기준)
const HANGUL_H = 280;
const hangulGroup = (tx, ty, s) => `<g transform="translate(${f(tx)} ${f(ty)}) scale(${s})">
    <g class="hb-text">
      <path d="${hae.join('')}"/>
      <path d="${byeok.join('')}" transform="translate(${GLYPH_GAP} 0)"/>
    </g>
    <ellipse class="hb-circle" cx="${SUN_HOLE.cx}" cy="${SUN_HOLE.cy}" rx="${SUN_HOLE.rx + 1}" ry="${SUN_HOLE.ry + 1}"/>
  </g>`;

/* ───────── 영문 모노라인 글자 (높이 50) ───────── */
const CAP_H = 50;
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

const SPACE_W = 36;
/** 한 줄 텍스트를 target 폭에 양끝 정렬. 반환 {markup, gap} (원점 좌상단) */
function justified(text, k, xs, target, light) {
  const chars = [...text];
  const widths = chars.map((c) => (c === ' ' ? SPACE_W : GLYPHS[c][0]) * xs * k);
  const gap = (target - widths.reduce((a, b) => a + b, 0)) / (chars.length - 1);
  let x = 0; const out = [];
  chars.forEach((c, i) => {
    if (c !== ' ') out.push(`<g transform="translate(${f(x)} 0) scale(${f(xs * k)} ${k})" clip-path="url(#hb-cap)"><path d="${GLYPHS[c][1]}"/></g>`);
    x += widths[i] + gap;
  });
  return `<g class="hb-sub${light ? ' hb-sub-light' : ''}">${out.join('')}</g>`;
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

/* ───────── 세로 풀 로고: 심볼 / 해벽 / HAEBYEOK / CLIMBING COMMUNITY ───────── */
{
  const hs = 0.98, PAD = 50;
  const hangulW = INK_W * hs;
  const W_ = hangulW + PAD * 2;
  const SYMB = 430, symTop = 20;
  const hangulY = symTop + SYMB * (496 / 512) + 56;
  const k1 = 1.0;                                  // HAEBYEOK 캡 높이 ≈ 60
  const en1Y = hangulY + HANGUL_H * hs + 44;
  const k2 = 0.4;                                  // 서브타이틀 캡 높이 ≈ 21
  const en2Y = en1Y + CAP_H * k1 + 34;
  const H_ = en2Y + CAP_H * k2 + PAD;
  const svg = `${svgOpen(W_, H_)}
  ${defs}
  ${symbolAt((W_ - SYMB) / 2, symTop, SYMB)}
  ${hangulGroup(PAD - INK_L * hs, hangulY, hs)}
  <g transform="translate(${PAD} ${f(en1Y)})">
    ${justified('HAEBYEOK', k1, 1.12, hangulW)}
  </g>
  <g transform="translate(${PAD} ${f(en2Y)})">
    ${justified('CLIMBING COMMUNITY', k2, 1.0, hangulW, true)}
  </g>
</svg>
`;
  fs.writeFileSync(path.join(OUT, 'full-logo.svg'), svg);
}

/* ───────── 가로 락업: 심볼 | 해벽 + HAEBYEOK ───────── */
{
  const SYM = 300, hs = 0.8;
  const tx = SYM + 6, ty = 18;
  const hw = INK_W * hs;
  const k = 0.8;
  const en1Y = ty + HANGUL_H * hs + 24;
  const W_ = tx + hw + 20, H_ = Math.max(SYM, en1Y + CAP_H * k) + 6;
  const svg = `${svgOpen(W_, H_)}
  ${defs}
  ${symbolAt(0, 0, SYM)}
  ${hangulGroup(tx - INK_L * hs, ty, hs)}
  <g transform="translate(${f(tx)} ${f(en1Y)})">
    ${justified('HAEBYEOK', k, 1.12, hw)}
  </g>
</svg>
`;
  fs.writeFileSync(path.join(OUT, 'full-logo-horizontal.svg'), svg);
}

fs.writeFileSync(path.join(OUT, 'symbol.svg'), symbolSvg);
console.log('✔ symbol.svg, full-logo.svg, full-logo-horizontal.svg 생성 (벽 좌측면 각도 %s°)', (ANGLE * 180 / Math.PI).toFixed(1));
