// src/climber-image.js — the 클라이머 유형 테스트 result as a picture: a 3:4 card (1080×1440) in the 도감 style — a framed plate numbered
// FIG. 0N / 08, the stage (one face of an outdoor wall: bolt holes, the 해벽 sun behind the character, the logo's slab as shade), the character
// with a sticker edge, the type's name and nickname, the three words with their dots, the 종목 chip and the logo mark.
// It is drawn from the result only (type, scores): the 오늘의 팁 and the longer lines stay on the screen. Fonts and the picture are
// waited for here; a picture that is missing (image() → null) leaves the plate without a character.
import { TYPES } from './climber-content.js';
import { CODES, axisWords, characterSrc, routeLine } from './climber-test.js';
import { FONT, INK, image } from './share-image.js';

const W = 1080;
const PLATE = '#f4f2ec'; // the plate's paper (the logo's paper)
const GREEN = '#2e5e3e'; // the app's accent
const SOFT = '#555c58'; // secondary text: the app's muted ink (share-image's MUTED is made for a dark ground)
const SUN = '#f4b942'; // the logo's sun
const WALL_INK = '#2a2d32'; // the logo's slab
const HAIR = 'rgba(27, 31, 30, 0.16)';
const STAGE = { x: 150, y: 140, w: 780, h: 640 };

// '#rrggbb' mixed with another: t of a, the rest of b
function mix(a, b, t) {
  const n = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(n(a, i) * t + n(b, i) * (1 - t))).join(', ')})`;
}

// the character with a white sticker edge and a soft shadow, on its own canvas
function sticker(img, size) {
  const pad = 28;
  const c = document.createElement('canvas');
  c.width = size + pad * 2;
  c.height = size + pad * 2;
  const g = c.getContext('2d');
  const silhouette = (color) => {
    const s = document.createElement('canvas');
    s.width = c.width;
    s.height = c.height;
    const sg = s.getContext('2d');
    sg.drawImage(img, pad, pad, size, size);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = color;
    sg.fillRect(0, 0, s.width, s.height);
    return s;
  };
  const ring = (target, src, r, dx = 0, dy = 0) => {
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      target.drawImage(src, Math.cos(a) * r + dx, Math.sin(a) * r + dy);
    }
  };
  const white = silhouette('#ffffff');
  const shadow = document.createElement('canvas'); // the edge's outline, drawn solid first and laid on at one opacity
  shadow.width = c.width;
  shadow.height = c.height;
  ring(shadow.getContext('2d'), silhouette(INK), 10);
  g.globalAlpha = 0.26;
  g.drawImage(shadow, 6, 12);
  g.globalAlpha = 1;
  ring(g, white, 10);
  g.drawImage(img, pad, pad, size, size);
  return c;
}

// the largest font size ≤ start at which the text fits the width (never below min)
function fit(g, text, weight, start, min, maxWidth) {
  let size = start;
  for (; size > min; size -= 2) {
    g.font = `${weight} ${size}px ${FONT}`;
    if (g.measureText(text).width <= maxWidth) break;
  }
  g.font = `${weight} ${size}px ${FONT}`;
}

// the logo mark (sun behind the leaning slab), `size` px square at x, y
function mark(g, x, y, size) {
  const k = size / 240;
  g.fillStyle = SUN;
  g.beginPath();
  g.arc(x + 120 * k, y + 96 * k, 80 * k, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = WALL_INK;
  g.beginPath();
  [[105, 8], [185, 8], [185, 232], [151, 232]].forEach(([px, py], i) => (i ? g.lineTo(x + px * k, y + py * k) : g.moveTo(x + px * k, y + py * k)));
  g.closePath();
  g.fill();
}

// the wall the character stands on: the type's colour, bolt holes, the sun, the slab's shade down one side
function drawWall(g, t) {
  const { x, y, w, h } = STAGE;
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, 36);
  g.clip();
  g.fillStyle = mix(t.tint, PLATE, 0.55);
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(27, 31, 30, 0.14)';
  for (let py = y + 26; py < y + h; py += 52) {
    for (let px = x + 26; px < x + w; px += 52) {
      g.beginPath();
      g.arc(px, py, 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  const d = w * 0.4;
  g.fillStyle = SUN;
  g.beginPath();
  g.arc(x + (w * t.wall.sun.x) / 100 + d / 2, y - t.wall.sun.lift * d + d / 2, d / 2, 0, Math.PI * 2);
  g.fill();
  const sw = w * 0.38;
  const flip = t.wall.shade === 'l'; // the slab: wide at the top, narrowing down to 42%, its straight edge against the stage's side
  const px = (u) => (flip ? x + u : x + w - sw + u);
  g.fillStyle = 'rgba(42, 45, 50, 0.22)';
  g.beginPath();
  const pts = flip ? [[0, 0], [sw, 0], [sw * 0.58, h], [0, h]] : [[0, 0], [sw, 0], [sw, h], [sw * 0.42, h]];
  pts.forEach(([u, v], i) => (i ? g.lineTo(px(u), y + v) : g.moveTo(px(u), y + v)));
  g.closePath();
  g.fill();
  g.restore();
}

/**
 * drawClimberCard(canvas, { type, s: [plan, solo, steady], m }, { width = 1080 }) → draws the card; the canvas becomes width × width·4/3
 * (1080 for the picture to save or share, 600 for the Kakao feed). Laid out at 1080 wide and scaled.
 */
export async function drawClimberCard(canvas, { type, s, m }, { width = W } = {}) {
  const t = TYPES[type];
  const words = axisWords(type, s);
  const sample = `${t.name}${t.nick}${t.animal}FIG. 0123456789/ 해벽 · 지금 열린 외벽 ${words.map((x) => x.word).join('')}${routeLine(m)}`;
  await Promise.all(['700 64px', '400 40px'].map((f) => document.fonts.load(`${f} ${FONT}`, sample)));
  const pic = await image(characterSrc(type));
  canvas.width = width;
  canvas.height = Math.round((width * 4) / 3);
  const g = canvas.getContext('2d');
  g.scale(width / W, width / W); // 1080 wide, 1440 tall from here on
  g.fillStyle = PLATE;
  g.fillRect(0, 0, W, 1440);
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.strokeRect(36, 36, W - 72, 1440 - 72);
  g.lineWidth = 2;
  g.strokeRect(50, 50, W - 100, 1440 - 100);

  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = INK;
  g.font = `400 30px ${FONT}`;
  g.fillText(`FIG. ${String(CODES.indexOf(type) + 1).padStart(2, '0')} / 08`, 92, 112);
  g.textAlign = 'right';
  g.fillStyle = GREEN;
  g.font = `700 36px ${FONT}`;
  g.fillText(t.animal, W - 92, 112);

  drawWall(g, t);
  if (pic) {
    const img = sticker(pic, 520);
    g.save();
    g.beginPath();
    g.roundRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h, 36);
    g.clip();
    g.drawImage(img, (W - img.width) / 2, STAGE.y + (STAGE.h - img.height) / 2);
    g.restore();
  }

  g.textAlign = 'center';
  g.fillStyle = INK;
  fit(g, t.name, 700, 92, 52, W - 200);
  g.fillText(t.name, W / 2, 884);
  g.fillStyle = GREEN;
  fit(g, `"${t.nick}"`, 600, 40, 28, W - 200);
  g.fillText(`"${t.nick}"`, W / 2, 948);

  // the three words: a strong rule above, a hair below, hairlines between; the dots under each word (filled = how many answers leaned there)
  const L = 92;
  const colW = (W - 2 * L) / 3;
  g.fillStyle = INK;
  g.fillRect(L, 1000, W - 2 * L, 3);
  g.fillStyle = HAIR;
  g.fillRect(L, 1176, W - 2 * L, 2);
  words.forEach(({ word, dots }, i) => {
    const cx = L + colW * (i + 0.5);
    if (i) g.fillRect(L + colW * i, 1020, 2, 140);
    g.fillStyle = INK;
    g.font = `700 64px ${FONT}`;
    g.fillText(word, cx, 1084);
    for (let k = 0; k < 3; k++) {
      const dx = cx + (k - 1) * 40;
      g.beginPath();
      g.arc(dx, 1132, 14, 0, Math.PI * 2);
      if (k < dots) {
        g.fillStyle = GREEN;
        g.fill();
      } else {
        g.lineWidth = 4;
        g.strokeStyle = SOFT;
        g.stroke();
      }
    }
    g.fillStyle = HAIR;
  });

  // the 종목 chip
  g.font = `400 34px ${FONT}`;
  const line = routeLine(m);
  const tw = g.measureText(line).width;
  g.lineWidth = 2;
  g.strokeStyle = INK;
  g.beginPath();
  g.roundRect(W / 2 - tw / 2 - 30, 1206, tw + 60, 62, 31);
  g.stroke();
  g.fillStyle = INK;
  g.fillText(line, W / 2, 1248);

  g.fillStyle = INK;
  g.fillRect(92, 1306, W - 184, 2);
  g.font = `400 30px ${FONT}`;
  const foot = '해벽 · 지금 열린 외벽';
  const fw = g.measureText(foot).width;
  const gap = 14;
  const mk = 44;
  const start = W / 2 - (mk + gap + fw) / 2;
  mark(g, start, 1330, mk);
  g.fillStyle = SOFT;
  g.textAlign = 'left';
  g.fillText(foot, start + mk + gap, 1362);
  g.textAlign = 'left';
}
