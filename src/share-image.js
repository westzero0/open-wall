// src/share-image.js — the invite as a 9:16 picture (1080×1920) for a messenger or a story. Canvas only; no new dependency.
// wrapLines, sunParts and shareSay are pure (tested); drawInvite, pictureBlob and shareInvite need a browser. The picture cannot carry a link, so it is always
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
const graphemes = (s) => Array.from(new Intl.Segmenter().segment(s), (x) => x.segment); // an emoji (👍🏽, 👨‍👩‍👧) is never cut in half
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
        const cs = graphemes(rest);
        let n = cs.length;
        while (n > 1 && measure(cs.slice(0, n).join('')) > width) n -= 1;
        out.push(cs.slice(0, n).join(''));
        rest = cs.slice(n).join('');
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
  while (last && measure(`${last}…`) > maxWidth) last = graphemes(last).slice(0, -1).join('');
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

const INK = '#17191c'; // the brand's 먹 (the logo's text ink; the light-ground wall is #2a2d32)
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

/**
 * pillRows(wide, room, maxRows = Infinity, plus = () => 0, gap = 14) → { rows: [[index]], more }. Pills of the given widths in
 * rows no wider than room, in order. Past maxRows the rest is cut and counted (more) and the last kept row gives up pills from
 * its end until a '+more' pill (plus(more) wide) fits beside them; the first pill of a row always stays.
 */
export function pillRows(wide, room, maxRows = Infinity, plus = () => 0, gap = 14) {
  if (!wide.length) return { rows: [], more: 0 };
  const rows = [[]];
  let used = 0;
  wide.forEach((w, i) => {
    if (rows.at(-1).length && used + gap + w > room) { rows.push([]); used = 0; }
    used += (rows.at(-1).length ? gap : 0) + w;
    rows.at(-1).push(i);
  });
  if (rows.length <= maxRows) return { rows, more: 0 };
  const kept = rows.slice(0, maxRows);
  const last = kept.at(-1);
  const more = () => wide.length - kept.flat().length;
  const span = () => last.reduce((s, i, k) => s + (k ? gap : 0) + wide[i], 0);
  while (last.length > 1 && span() + gap + plus(more()) > room) last.pop();
  return { rows: kept, more: more() };
}

/**
 * INVITE_FITS — what gives way, in order, when the words and pills do not fit (both pictures take the first that fits, else the
 * last): first the tag/head-count pills keep one row (+N for the rest), then they join the sun pill's row, then the note keeps
 * one line, then the name. The note is the sender's own words, so it outranks the sun pill, which outranks the tags.
 */
export const INVITE_FITS = [
  { note: 2, name: 2, tagRows: Infinity, merge: false },
  { note: 2, name: 2, tagRows: 1, merge: false },
  { note: 2, name: 2, tagRows: 1, merge: true },
  { note: 1, name: 2, tagRows: 1, merge: true },
  { note: 1, name: 1, tagRows: 1, merge: true },
];

// The words and pills of both pictures: one block set from the right margin, its bottom at `bottom`, no taller than `room`
// (INVITE_FITS). The note comes last, under the pills, in paper colour within curly quotes.
function block(g, { name, date, time, sunLine = null, sunInfo = null, tags = [], note = '' }, bottom, room) {
  const PILL = 64;
  const ICON = 54; // a pill part that is a picture is this wide
  let y = 0;
  let draw = false;
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
  const font = (solid) => `${solid ? 700 : 400} 38px ${FONT}`;
  const width = ({ parts, solid }) => {
    g.font = font(solid);
    return parts.reduce((w, p, k) => w + (k ? 10 : 0) + (typeof p === 'string' ? g.measureText(p).width : ICON), 0) + 56;
  };
  const pills = (list, maxRows) => { // right aligned rows; a pill is a run of parts: words or { icon }; solid: filled with the sun's colour
    const wide = list.map(width);
    const plus = (n) => ({ parts: [`+${n}`], solid: false });
    const { rows, more } = pillRows(wide, W - M * 2, maxRows, (n) => width(plus(n)));
    rows.forEach((row, r) => {
      const items = row.map((i) => [list[i], wide[i]]);
      if (more && r === rows.length - 1) items.push([plus(more), width(plus(more))]);
      let x = W - M;
      for (const [{ parts, solid }, w] of items.reverse()) {
        x -= w;
        if (draw) {
          g.beginPath();
          g.roundRect(x, y, w, PILL, PILL / 2);
          if (solid) { g.fillStyle = SUN; g.fill(); } else { g.strokeStyle = 'rgba(244,242,236,0.55)'; g.lineWidth = 2; g.stroke(); }
          g.font = font(solid);
          g.fillStyle = solid ? INK : PAPER;
          let px = x + 28;
          parts.forEach((p, k) => {
            if (k) px += 10;
            if (typeof p === 'string') { g.fillText(p, px, y + 44); px += g.measureText(p).width; } else { drawIcon(g, p.icon, px + ICON / 2, y + PILL / 2, 17, solid ? INK : PAPER); px += ICON; }
          });
        }
        x -= 14;
      }
      y += PILL + 14;
    });
  };
  // the sun then is the app's own news: one pill, filled with the sun's colour when the wall is lit (a shape, so the
  // brand rule holds: letters stay ink on it), outlined when it is not or when the hours need checking
  const sun = sunInfo ? [{ parts: sunParts(sunInfo), solid: sunInfo.kind === 'lit' }] : sunLine ? [{ parts: [sunLine], solid: false }] : [];
  const chips = tags.map((t) => ({ parts: [t], solid: false }));
  const run = (fit, top) => {
    y = top;
    text('같이 가요', 44, 700, PAPER, 1, 14); // the sun colour is for shapes, never for letters (brand/design-system.md)
    text(date, 64, 400, PAPER, 1, 0);
    text(time, 200, 700, PAPER, 1, 22, 0.1);
    text(name, 72, 700, PAPER, fit.name, 14);
    if (fit.merge) pills([...sun, ...chips], fit.tagRows);
    else { pills(sun); pills(chips, fit.tagRows); }
    if (note) { y += 6; text(`“${note}”`, 50, 400, PAPER, fit.note, 0); } // the sender's own words: paper colour, curly quotes
    return y - top;
  };
  const fit = INVITE_FITS.find((f) => run(f, 0) <= room) ?? INVITE_FITS.at(-1);
  const h = run(fit, 0);
  draw = true;
  run(fit, bottom - h);
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
  const bottom = BOTTOM - (open.length ? GAP + RULER : 0);
  block(g, { name, date, time, sunLine, sunInfo, tags, note }, bottom, bottom - 270); // the block's top stays below the story's top bar
  if (open.length) ruler(g, BOTTOM - RULER + 56, { open, sun, at });
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
 * drawInviteCard(canvas, picture) — the same invite as a 3:4 card (600×800) for a KakaoTalk feed message. Same design as
 * drawInvite (lockup top left at the same size, words set from the right margin, balanced lines, hairline + made + credit
 * footer, sun colour on shapes only), laid out at 1080×1440 and scaled down, so the sizes are drawInvite's.
 * No story bars here, so the lockup and the footer sit nearer the edges, and there is no day ruler (it does not fit under the
 * lockup even beside the shortest invite). When the block does not fit, INVITE_FITS decides what gives way (the note never goes).
 */
const CARD_W = 600;
const CARD_H = 800;
export async function drawInviteCard(canvas, { name, date, time, sunLine = null, sunInfo = null, tags = [], note = '', made = '' }) {
  await Promise.all(['700 64px', '400 48px'].map((f) => document.fonts.load(`${f} ${FONT}`, '해벽 같이 가요 0123')));
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext('2d');
  g.scale(CARD_W / W, CARD_W / W); // 1080 wide, 1440 tall from here on
  const LH = (W * CARD_H) / CARD_W;
  g.fillStyle = INK;
  g.fillRect(0, 0, W, LH);
  const sign = await lockup();
  const TOP = 80;
  const LOGO = 270; // drawInvite's lockup height: the logo never changes size
  if (sign) g.drawImage(sign, M, TOP, (303 / 140) * LOGO, LOGO);
  const FOOT = LH - 170; // the hairline; made and the credit under it as in drawInvite (+49, +93)
  const BOTTOM = FOOT - 55;
  const ROOM = BOTTOM - (TOP + LOGO + 24);
  block(g, { name, date, time, sunLine, sunInfo, tags, note }, BOTTOM, ROOM);
  g.fillStyle = 'rgba(244,242,236,0.45)';
  g.fillRect(M, FOOT, W - M * 2, 3);
  g.font = `400 34px ${FONT}`;
  g.fillStyle = MUTED;
  g.textAlign = 'right';
  if (made) g.fillText(made, W - M, FOOT + 49);
  g.fillText('created by 바위타는 은설', W - M, FOOT + 93);
  g.textAlign = 'left';
}

/** pictureBlob(picture, draw = drawInvite) → the invite picture as a PNG Blob, drawn off screen (drawn ahead, so the tap needs no wait). */
export async function pictureBlob(picture, draw = drawInvite) {
  const canvas = document.createElement('canvas');
  await draw(canvas, picture);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('no picture');
  return blob;
}

const FILE_NAME = 'haebyeok-invite.png';

// the download: an anchor in the page (some browsers ignore a detached one), its URL kept for a minute (a slow phone)
export function saveFile(blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = FILE_NAME;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

function saveAndCopy(blob, text) {
  saveFile(blob);
  let copy;
  try { copy = navigator.clipboard.writeText(text); } catch (e) { copy = Promise.reject(e); }
  return Promise.resolve(copy).then(() => ({ how: 'saved', copied: true }), () => ({ how: 'saved', copied: false }));
}

/**
 * shareInvite(blob, text) → { via: 'share' | 'save', done: Promise<{ how: 'shared' | 'cancelled' | 'saved', copied? }> }
 * Call it straight from the tap with a picture drawn beforehand: nothing is awaited before navigator.share or the download,
 * so the browser still counts it as the user's tap. The picture has no link, so the text always goes with it: the phone's
 * share sheet takes both; where files cannot be shared (or sharing fails) the picture is saved and the text copied.
 * A failed copy does not fail the picture (copied: false).
 */
export function shareInvite(blob, text) {
  const file = new File([blob], FILE_NAME, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file], text }) && matchMedia('(pointer: coarse)').matches) {
    return {
      via: 'share',
      done: navigator.share({ files: [file], text }).then(() => ({ how: 'shared' }),
        (e) => (e?.name === 'AbortError' ? { how: 'cancelled' } : saveAndCopy(blob, text))),
    };
  }
  return { via: 'save', done: saveAndCopy(blob, text) };
}

/** shareSay(result) → what the sheet says after the picture went (stays until the next change). */
export function shareSay({ how, copied } = {}) {
  if (how === 'shared') return '공유 창을 열었어요. 그림과 문구를 함께 넘겼어요.';
  if (how === 'cancelled') return '';
  if (how === 'saved') {
    return copied ? '그림을 저장했어요(갤러리의 “다운로드” 앨범). 문구도 복사했어요. 그림과 문구를 함께 보내세요.'
      : '그림을 저장했어요(갤러리의 “다운로드” 앨범). 문구는 복사하지 못했어요. 위 보낼 문구를 길게 눌러 복사해 주세요.';
  }
  return '';
}
