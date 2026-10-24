// notice/card.js — 공지 카드 이미지(1080×1350, 인스타 4:5). notice.rows 가 곧 그림이므로 글과 항상 같은 내용이다.
import { FONT, INK, wrapLines } from '../src/share-image.js';

export const CARD_W = 1080;
export const CARD_H = 1350;
const PAD = 84;

async function loadFonts() {
  try {
    await Promise.all([700, 900].map((w) => document.fonts.load(`${w} 40px "IBM Plex Sans KR"`)));
    await document.fonts.load('900 40px "Noto Sans KR"');
  } catch { /* system font stands in */ }
}

// the biggest font size (≤ max) at which the text fits the width
function fit(ctx, text, weight, max, min, width) {
  for (let s = max; s >= min; s -= 2) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(text).width <= width) return s;
  }
  return min;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** drawNoticeCard(canvas, notice, { accent }) — draws in place. */
export async function drawNoticeCard(canvas, n, { accent = '#0a7fc8' } = {}) {
  await loadFonts();
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = 'alphabetic';

  // head: 휴관안내 + wall name, badge circle at the right
  ctx.fillStyle = INK;
  const headSize = fit(ctx, n.head, 900, 150, 80, 640);
  ctx.font = `900 ${headSize}px ${FONT}`;
  ctx.fillText(n.head, PAD, 215);
  const nameSize = fit(ctx, `${n.wall} 안내문`, 700, 44, 26, 640);
  ctx.font = `700 ${nameSize}px ${FONT}`;
  ctx.fillText(`${n.wall} 안내문`, PAD, 215 + 30 + nameSize);

  const cx = CARD_W - PAD - 118, cy = 190;
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(cx, cy, 118, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  const badgeLines = wrapLines((t) => { ctx.font = `900 40px ${FONT}`; return ctx.measureText(t).width; }, n.badge, 190, 3, true);
  const bs = badgeLines.length > 2 ? 32 : 40;
  ctx.font = `900 ${bs}px ${FONT}`;
  const bh = badgeLines.length * (bs + 8);
  badgeLines.forEach((line, i) => ctx.fillText(line, cx, cy - bh / 2 + bs + i * (bs + 8) - 4));
  ctx.textAlign = 'left';

  // calendar panel
  const px = PAD, py = 400, pw = CARD_W - PAD * 2, ph = 640, bandH = 120;
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  roundRect(ctx, px + 14, py + 14, pw, ph, 44); ctx.fill();
  ctx.fillStyle = '#fff';
  roundRect(ctx, px, py, pw, ph, 44); ctx.fill();
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 44); ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(px, py, pw, bandH);
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 10;
  roundRect(ctx, px, py, pw, ph, 44); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 16;
  for (let i = 0; i < 9; i += 1) { // binder rings
    const x = px + 70 + i * ((pw - 140) / 8);
    ctx.beginPath(); ctx.moveTo(x, py - 26); ctx.lineTo(x, py + 24); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  const headline = n.month ? `${n.month}월` : n.rows[0] ? `${Number(n.rows[0].from.slice(5, 7))}월` : '';
  const hl = n.rows[0] ? `${n.rows[0].from.slice(0, 4)}년 ${headline}` : '날짜를 골라 주세요';
  ctx.font = `900 ${fit(ctx, hl, 900, 72, 40, pw - 80)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(hl, px + pw / 2, py + 84);

  // date rows: one row per run, as big as the panel allows
  const rows = n.rows.length ? n.rows : [{ text: '—', reason: '' }];
  const bodyTop = py + bandH, bodyH = ph - bandH;
  const lines = rows.map((r) => (n.kind === 'hours' ? r.line ?? r.text : r.reason ? `${r.text} ${r.reason}` : r.text));
  const per = Math.min(150, Math.max(70, (bodyH - 40) / Math.min(lines.length, 8)));
  const size = Math.round(per * 0.5);
  ctx.fillStyle = INK;
  const shown = lines.slice(0, 8);
  const top = bodyTop + (bodyH - per * shown.length) / 2;
  shown.forEach((l, i) => {
    const y = top + per * i + per / 2;
    ctx.font = `900 ${fit(ctx, l, 900, size, 30, pw - 90)}px ${FONT}`;
    ctx.fillText(l, px + pw / 2, y + size * 0.35);
  });
  if (lines.length > 8) {
    ctx.fillStyle = '#6d6f6a'; ctx.font = `700 34px ${FONT}`;
    ctx.fillText(`외 ${lines.length - 8}건은 게시글에서 확인해 주세요`, px + pw / 2, py + ph - 26);
  }

  // closing line (first sentence only) and the sign
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  const first = n.closing[0] ?? '';
  const meas = (t) => { ctx.font = `700 46px ${FONT}`; return ctx.measureText(t).width; };
  const cl = wrapLines(meas, first, CARD_W - PAD * 2, 3, true);
  ctx.font = `700 46px ${FONT}`;
  cl.forEach((line, i) => ctx.fillText(line, CARD_W / 2, 1140 + i * 68));
  ctx.fillStyle = '#6d6f6a';
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(n.sign, CARD_W / 2, CARD_H - 70);
  ctx.textAlign = 'left';
}
