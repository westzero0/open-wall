// src/share-image.js — the invite as a 9:16 picture (1080×1920) for a messenger or a story. Canvas only; no new dependency.
// wrapLines is pure (tested); drawInvite and shareInvite need a browser. The picture cannot carry a link, so it is always
// shared together with the invite text, or saved while the text is copied when the phone cannot share files.
const W = 1080;
const H = 1920;
const M = 90;
const FONT = '"IBM Plex Sans KR", system-ui, sans-serif';

/**
 * wrapLines(measure, text, maxWidth, maxLines, balance = false) → lines. Breaks at spaces (a Korean word is never cut), splits
 * a word wider than the line, and ends with … when cut. balance: the narrowest width that keeps the same number of lines, so
 * the lines come out even and no word is left alone on the last one (CSS text-wrap: balance).
 */
export function wrapLines(measure, text, maxWidth, maxLines, balance = false) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lay = (width) => {
    const out = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= width) { line = next; continue; }
      if (line) out.push(line);
      line = '';
      let rest = word;
      while (measure(rest) > width) { // one long word: break between characters
        let n = [...rest].length;
        while (n > 1 && measure([...rest].slice(0, n).join('')) > width) n -= 1;
        out.push([...rest].slice(0, n).join(''));
        rest = [...rest].slice(n).join('');
      }
      line = rest;
    }
    if (line) out.push(line);
    return out;
  };
  let lines = lay(maxWidth);
  if (balance && lines.length > 1 && lines.length <= maxLines) {
    let lo = Math.ceil(Math.max(...words.map(measure))); // the widest word: narrower would cut it
    let hi = maxWidth;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (lay(mid).length <= lines.length) hi = mid;
      else lo = mid + 1;
    }
    lines = lay(hi);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(`${last}…`) > maxWidth) last = [...last].slice(0, -1).join('');
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

const image = (src) => new Promise((ok) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => ok(null); // no logo is better than no picture
  img.src = src;
});
// the horizontal lockup (mark + 해벽) with the wall in paper colour, for the dark ground
const lockup = () => image('assets/haebyeok-lockup-dark.svg');

const INK = '#17191c'; // the brand's 먹, the same as the logo's wall
const PAPER = '#f4f2ec';
const MUTED = '#9a9d98';
const SUN = '#f4b942'; // the logo's sun: used only where the sun is meant

// Small pictures for how the sun is, drawn in the pill's ink. r: the sun's radius. 'sun': a disc with eight rays (ink strokes, never
// the sun colour: brand rule). 'shade': the same sun, dimmed and struck through. 'moon': a crescent. Not the logo: no wall.
function drawIcon(g, kind, cx, cy, r, color) {
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(2.5, r / 4);
  g.lineCap = 'round';
  if (kind === 'moon') { // a disc with a second disc in the ground's colour taken out of it (the moon is only drawn on the dark ground)
    g.beginPath();
    g.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(cx + r * 0.55, cy - r * 0.35, r * 0.9, 0, Math.PI * 2);
    g.fill();
  } else {
    g.globalAlpha = kind === 'shade' ? 0.55 : 1;
    g.beginPath();
    g.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
      g.lineTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3);
      g.stroke();
    }
    if (kind === 'shade') {
      g.globalAlpha = 1;
      g.beginPath();
      g.moveTo(cx - r * 1.2, cy + r * 1.2);
      g.lineTo(cx + r * 1.2, cy - r * 1.2);
      g.stroke();
    }
  }
  g.restore();
}

// the day as a ruler, 06:00–24:00: open hours outlined, sunlit hours filled, the invited moment a line across it
function ruler(g, y, { open = [], sun = [], at }) {
  const x0 = M;
  const w = W - M * 2;
  const from = 360;
  const span = 1440 - from;
  const px = (m) => x0 + (Math.min(Math.max(m, from), 1440) - from) * (w / span);
  const bar = 44;
  g.font = `400 36px ${FONT}`;
  g.fillStyle = MUTED;
  g.textAlign = 'center';
  for (let h = 6; h <= 24; h += 3) {
    g.fillRect(px(h * 60) - 1, y - 6, 2, 12);
    g.fillText(String(h), px(h * 60), y - 20);
  }
  g.textAlign = 'left';
  g.fillStyle = 'rgba(244,242,236,0.12)';
  g.fillRect(x0, y + 14, w, bar);
  for (const [a, b] of sun) { g.fillStyle = SUN; g.fillRect(px(a), y + 14, Math.max(px(b) - px(a), 2), bar); }
  g.strokeStyle = PAPER;
  g.lineWidth = 3;
  for (const [a, b] of open) g.strokeRect(px(a), y + 14, Math.max(px(b) - px(a), 2), bar);
  g.fillStyle = PAPER;
  g.fillRect(px(at) - 2, y - 6, 4, bar + 40);
  const ly = y + bar + 90; // the legend reads from the right margin like the words above it
  g.font = `400 36px ${FONT}`;
  g.textAlign = 'right';
  let x = W - M;
  const legend = (label, swatch) => {
    g.fillStyle = MUTED;
    g.fillText(label, x, ly);
    x -= g.measureText(label).width + 16 + 28;
    swatch(x, ly - 24);
    x -= 40;
  };
  if (sun.length) legend('해가 드는 시간', (sx, sy) => { g.fillStyle = SUN; g.fillRect(sx, sy, 28, 24); });
  legend('열려 있는 시간', (sx, sy) => g.strokeRect(sx + 1.5, sy, 28, 24));
  g.textAlign = 'left';
}

// the sun pill, in pictures: lit: sun + "until 17:50"; shade: struck sun + "from 10:20" + sun (or the struck sun alone); night: moon
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function sunParts(info) {
  if (info.kind === 'night') return [{ icon: 'moon' }];
  if (info.kind === 'lit') return [{ icon: 'sun' }, `${hhmm(info.until)}까지`];
  return info.from === null ? [{ icon: 'shade' }] : [{ icon: 'shade' }, `${hhmm(info.from)}부터`, { icon: 'sun' }];
}

/** drawInvite(canvas, { name, date, time, at, open, sun, sunLine, sunInfo, tags, note, made } — tags: the chips (kinds, head-count)) — all strings already cleaned by the caller. */
export async function drawInvite(canvas, { name, date, time, at, open = [], sun = [], sunLine = null, sunInfo = null, tags = [], note = '', made = '' }) {
  await Promise.all(['700 64px', '400 48px'].map((f) => document.fonts.load(`${f} ${FONT}`, '해벽 같이 가요 0123')));
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = INK;
  g.fillRect(0, 0, W, H);
  const sign = await lockup();
  // The brand's horizontal lockup stands top left, below a story's top bar; the words, and the ruler's legend
  // read from the right margin. The words and the ruler are one block stacked up from the bottom, so
  // what a short invite leaves free lies between the lockup and the block. Everything that matters stays between 270 and
  // 1650: a story's top and bottom bars cover the rest. run(false) only measures.
  if (sign) g.drawImage(sign, M, 190, (303 / 140) * 270, 270); // the brand's own 해벽, not letters set here (brand/design-system.md)
  const BOTTOM = 1490;
  const RULER = 190; // from the ruler's top figures to its legend
  const GAP = 70;
  let y = 0;
  const PILL = 64;
  const ICON = 54; // a pill part that is a picture is this wide
  const chips = (list, solid) => {
    if (!list.length) return;
    g.font = `${solid ? 700 : 400} 38px ${FONT}`;
    const items = list.map((c) => (Array.isArray(c) ? c : [c])); // a pill is a run of parts: words or { icon }
    const wide = items.map((parts) => parts.reduce((w, p, k) => w + (k ? 10 : 0) + (typeof p === 'string' ? g.measureText(p).width : ICON), 0) + 56);
    const rows = [[]];
    let used = 0;
    items.forEach((t, i) => {
      if (rows[rows.length - 1].length && used + 14 + wide[i] > W - M * 2) { rows.push([]); used = 0; }
      used += (rows[rows.length - 1].length ? 14 : 0) + wide[i];
      rows[rows.length - 1].push(i);
    });
    for (const row of rows) {
      let x = W - M;
      for (const i of [...row].reverse()) {
        x -= wide[i];
        if (draw_) {
          g.beginPath();
          g.roundRect(x, y, wide[i], PILL, PILL / 2);
          if (solid) { g.fillStyle = SUN; g.fill(); } else { g.strokeStyle = 'rgba(244,242,236,0.55)'; g.lineWidth = 2; g.stroke(); }
          g.fillStyle = solid ? INK : PAPER;
          let px = x + 28;
          items[i].forEach((p, k) => {
            if (k) px += 10;
            if (typeof p === 'string') { g.fillText(p, px, y + 44); px += g.measureText(p).width; } else { drawIcon(g, p.icon, px + ICON / 2, y + PILL / 2, 17, solid ? INK : PAPER); px += ICON; }
          });
        }
        x -= 14;
      }
      y += PILL + 14;
    }
  };
  let draw_ = false;
  const run = (draw) => {
    draw_ = draw;
    const text = (s, size, weight, color, maxLines, gap, lead = 0.3) => {
      g.font = `${weight} ${size}px ${FONT}`;
      g.fillStyle = color;
      g.textAlign = 'right';
      for (const line of wrapLines((t) => g.measureText(t).width, s, W - M * 2, maxLines, true)) {
        y += size;
        if (draw) g.fillText(line, W - M, y);
        y += size * lead;
      }
      y += gap;
      g.textAlign = 'left';
    };
    text('같이 가요', 44, 700, PAPER, 1, 14); // the sun colour is for shapes, never for letters (brand/design-system.md)
    text(date, 64, 400, PAPER, 1, 0);
    text(time, 200, 700, PAPER, 1, 22, 0.1);
    text(name, 72, 700, PAPER, 2, 14);
    // the sun then is the app's own news: one pill, filled with the sun's colour when the wall is lit (a shape, so the
    // brand rule holds: letters stay ink on it), outlined when it is not or when the hours need checking
    if (sunInfo) chips([sunParts(sunInfo)], sunInfo.kind === 'lit');
    else if (sunLine) chips([sunLine], false);
    chips(tags, false);
    if (note) text(`"${note}"`, 40, 400, MUTED, 2, 0);
  };
  run(false);
  y = BOTTOM - (y + (open.length ? GAP + RULER : 0));
  run(true);
  if (open.length) ruler(g, y + GAP + 56, { open, sun, at });
  g.fillStyle = 'rgba(244,242,236,0.45)'; // a hairline sets the credit apart from the facts above
  g.fillRect(M, 1545, W - M * 2, 3);
  g.font = `400 34px ${FONT}`;
  g.fillStyle = MUTED;
  g.textAlign = 'right';
  if (made) g.fillText(made, W - M, 1594); // when the card was made
  g.fillText('created by 바위타는 은설', W - M, 1638);
  g.textAlign = 'left';
}

/**
 * shareInvite(canvas, text) → 'shared' | 'saved' | 'cancelled'
 * 'shared': the phone's share sheet took the picture and the text. 'saved': it cannot share files here, so the picture was
 * downloaded and the text copied (a copy that fails is thrown to the caller, which asks the user to copy it by hand).
 */
export async function shareInvite(canvas, text) {
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  const file = new File([blob], 'haebyeok-invite.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file], text }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  await navigator.clipboard.writeText(text);
  return 'saved';
}
