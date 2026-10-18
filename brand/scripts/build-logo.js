#!/usr/bin/env node
/**
 * build-logo.js — symbol.svg / full-logo.svg 소스 생성기 (선택 사항)
 *
 * 글자 획을 "외벽 오버행 각도"로 컷팅한 다각형(outline)으로 만들어
 * 폰트 의존성이 없는 벡터 로고를 출력한다.
 *   node brand/scripts/build-logo.js
 * 일반 사용자는 이미 생성된 symbol.svg / full-logo.svg 를 그대로 쓰면 된다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..');
const f = (n) => +n.toFixed(2);

/* ───────── 심볼: 512×512, 노란 원 + 검은 오버행 단면 ───────── */
// 벽 단면(패널 두께 일정): 아래는 수직 슬랩, 중간에서 꺾여 위로 갈수록 앞으로 튀어나오는 오버행
const WALL = [
  [300, 100],  // 패널 뒷면 상단 (벽면과 평행)
  [420, 100],  // 오버행 최상단 (벽면이 가장 앞으로 나온 점)
  [262, 392],  // 꺾임점 (슬랩 → 오버행)
  [262, 504],  // 바닥
  [142, 504],
  [142, 392],  // 뒷면 꺾임점
];
// 오버행 각도(수직 기준) — 글자 컷팅에 동일 각도를 사용한다
const ANGLE = Math.atan2(WALL[1][0] - WALL[2][0], WALL[2][1] - WALL[1][1]); // ≈ 28°

const STYLE = `
    :root {
      --primary-yellow: #FFD60A;
      --primary-black: #111111;
      --logo-text: #111111;
      --logo-sub: #111111;
    }
    @media (prefers-color-scheme: dark) {
      :root { --logo-text: #F5F5F2; --logo-sub: #F5F5F2; }
    }
    .hb-circle { fill: var(--primary-yellow, #FFD60A); }
    .hb-wall   { fill: var(--primary-black, #111111); }
    .hb-text   { fill: var(--logo-text, #111111); }
    .hb-sub    { fill: none; stroke: var(--logo-sub, #111111); stroke-width: 10; stroke-linejoin: miter; stroke-miterlimit: 4; }`;

const symbolInner = (id) => `<clipPath id="${id}"><circle cx="256" cy="256" r="240"/></clipPath>
    <circle class="hb-circle" cx="256" cy="256" r="240"/>
    <polygon class="hb-wall" clip-path="url(#${id})" points="${WALL.map((p) => p.join(',')).join(' ')}"/>`;

const symbolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="hb-title">
  <title id="hb-title">해벽 HAEBYEOK 심볼</title>
  <style>${STYLE}
  </style>
  ${symbolInner('hb-clip')}
</svg>
`;

/* ───────── 한글 획: 끝단을 오버행 각도로 컷팅한 다각형 ───────── */
const SIN = Math.sin(ANGLE), COS = Math.cos(ANGLE);
// 컷 방향(단위벡터): 'v' = 벽면 기울기와 평행(가로획 끝에 사용), 'h' = 그에 수직(세로획 끝에 사용)
const CUT = { v: [SIN, -COS], h: [COS, SIN] };

/** 두께 w의 선분 획. cutA/cutB: null(직각) | 'v' | 'h' */
function stroke(x1, y1, x2, y2, w, cutA, cutB) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  const t = [(x2 - x1) / L, (y2 - y1) / L];
  const n = [-t[1], t[0]];
  const hw = w / 2;
  const shift = (cut, dir) => {            // 가장자리 k(±1)에서 컷선까지 획 방향 이동량
    if (!cut) return [0, 0];
    const c = CUT[cut];
    const ct = c[0] * t[0] + c[1] * t[1] * 1;
    const cn = c[0] * n[0] + c[1] * n[1];
    return [-1, 1].map((k) => dir * k * hw * (ct / cn) * -1);
  };
  const sA = shift(cutA, 1), sB = shift(cutB, 1);
  // 시작점 양쪽 가장자리 (k=-1, +1)
  const pts = [
    [x1 - n[0] * hw + t[0] * sA[0], y1 - n[1] * hw + t[1] * sA[0]],
    [x2 - n[0] * hw + t[0] * sB[0], y2 - n[1] * hw + t[1] * sB[0]],
    [x2 + n[0] * hw + t[0] * sB[1], y2 + n[1] * hw + t[1] * sB[1]],
    [x1 + n[0] * hw + t[0] * sA[1], y1 + n[1] * hw + t[1] * sA[1]],
  ];
  return `M${pts.map((p) => f(p[0]) + ' ' + f(p[1])).join('L')}Z`;
}

const W = 38; // 획 두께
const ring = (cx, cy, R, r) =>
  `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0ZM${cx - r} ${cy}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0Z`;

// 해 = ㅎ + ㅐ
const hae = [
  stroke(80, 6, 80, 46, W, 'h', 'h'),               // ㅎ 꼭지
  stroke(12, 84, 148, 84, W, 'v', 'v'),             // ㅎ 가로획
  ring(80, 180, 60, 60 - W * 0.82),                  // ㅎ 원 (심볼의 원 모티브)
  stroke(206, 6, 206, 276, W, 'h', 'h'),            // ㅐ 왼쪽 세로
  stroke(206, 128, 252, 128, W, null, 'v'),         // ㅐ 가지
  stroke(290, 6, 290, 276, W, 'h', 'h'),            // ㅐ 오른쪽 세로
];
// 벽 = ㅂ + ㅕ + ㄱ
const byeok = [
  stroke(34, 6, 34, 170, W, 'h', null),             // ㅂ 왼쪽 세로
  stroke(134, 6, 134, 170, W, 'h', null),           // ㅂ 오른쪽 세로
  stroke(34, 84, 134, 84, W, null, null),           // ㅂ 가운데 가로
  stroke(34, 152, 134, 152, W, null, null),         // ㅂ 아래 가로
  stroke(264, 6, 264, 170, W, 'h', 'h'),            // ㅕ 세로
  stroke(200, 58, 264, 58, W, 'v', null),           // ㅕ 윗가지
  stroke(200, 118, 264, 118, W, 'v', null),         // ㅕ 아랫가지
  stroke(76, 224, 249, 224, W, 'v', null),          // ㄱ 가로
  stroke(230, 224 - W / 2, 230, 276, W, null, 'h'), // ㄱ 세로
];
const GLYPH_W = 310;

/* ───────── 영문 HAEBYEOK: 모노라인 기하 산세리프 (50 높이, 획 10) ───────── */
const CAP_H = 50;
const LETTERS = [
  ['H', 56, 'M5 0V50M51 0V50M5 25H51'],
  ['A', 58, 'M3 54L29 4L55 54M14 36H44'],
  ['E', 46, 'M5 0V50M5 5H46M5 25H40M5 45H46'],
  ['B', 49, 'M5 0V50M5 5H33a10 10 0 0 1 0 20H5M5 25H35a10 10 0 0 1 0 20H5'],
  ['Y', 56, 'M2 -4L28 26L54 -4M28 26V50'],
  ['E', 46, 'M5 0V50M5 5H46M5 25H40M5 45H46'],
  ['O', 56, 'M28 5C14 5 5 13 5 25S14 45 28 45S51 37 51 25S42 5 28 5Z'],
  ['K', 54, 'M5 0V50M50 -2L11 28M24 20L52 52'],
];

/* ───────── 풀 로고 조립 ───────── */
const VB_W = 1060, VB_H = 410;
const SYM = 350, SYM_X = 14, SYM_Y = 30;
const TX = 400, TY = 30;               // 한글 시작
const INK_L = 12, textW = 605;         // 한글 잉크 좌측 / 총 폭
const EN_Y = TY + 276 + 38;            // 영문 윗선

const sumW = LETTERS.reduce((s, l) => s + l[1], 0);
const gap = (textW - sumW) / (LETTERS.length - 1);
const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="hb-title">
  <title id="hb-title">해벽 HAEBYEOK</title>
  <style>${STYLE}
  </style>
  <defs>
    <clipPath id="hb-cap"><rect x="-10" y="0" width="80" height="${CAP_H}"/></clipPath>
    <clipPath id="hb-clip"><circle cx="256" cy="256" r="240"/></clipPath>
  </defs>

  <!-- 심볼 -->
  <g transform="translate(${SYM_X} ${SYM_Y}) scale(${f(SYM / 512)})">
    <circle class="hb-circle" cx="256" cy="256" r="240"/>
    <polygon class="hb-wall" clip-path="url(#hb-clip)" points="${WALL.map((p) => p.join(',')).join(' ')}"/>
  </g>

  <!-- 한글 '해벽' — 외벽 오버행 각도(≈${Math.round((ANGLE * 180) / Math.PI)}°)로 컷팅한 커스텀 벡터 타입 -->
  <g class="hb-text" transform="translate(${TX} ${TY})">
    <path d="${hae.join('')}"/>
    <path d="${byeok.join('')}" transform="translate(${GLYPH_W + 24} 0)"/>
  </g>

  <!-- 영문 HAEBYEOK — 모노라인 산세리프 아웃라인 -->
  <g class="hb-sub" clip-path="none">
    ${LETTERS.map((_, i) => '').join('')}
  </g>
</svg>
`;

// 영문 글자는 각각 clip 이 필요하므로 그룹으로 감싼다
const enGroup = LETTERS.map(([, , d], i) => {
  const off = LETTERS.slice(0, i).reduce((s, l) => s + l[1] + gap, 0);
  return `<g transform="translate(${f(TX + INK_L + off)} ${EN_Y})" clip-path="url(#hb-cap)"><path d="${d}"/></g>`;
}).join('\n    ');
const finalFull = fullSvg.replace(/<g class="hb-sub"[\s\S]*?<\/g>\n/, `<g class="hb-sub">\n    ${enGroup}\n  </g>\n`);

fs.writeFileSync(path.join(OUT, 'symbol.svg'), symbolSvg);
fs.writeFileSync(path.join(OUT, 'full-logo.svg'), finalFull);
console.log('✔ symbol.svg, full-logo.svg 생성 (오버행 각도 %s°)', (ANGLE * 180 / Math.PI).toFixed(1));
