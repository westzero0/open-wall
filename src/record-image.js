// src/record-image.js — the month's 기록 as a 9:16 picture (1080×1920): the days laid along the sun's path, one 도장 per visit.
// monthPicture is pure (tested): the numbers and marks the picture needs. drawMonth is canvas only. Made on this device, never sent.
import { firstVisits } from './log.js';
import { shortName } from './viewmodel.js';
import { FONT, H, INK, M, MUTED, PAPER, W, image, lockup, wrapLines } from './share-image.js';

export const MAX_STAMPS = 3; // stamps drawn for one day; the rest is a "+N"
export const MAX_NAMES = 5;

const byTime = (a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.id.localeCompare(b.id);

/**
 * monthPicture(log, walls, year, month, { names }) → null when the month has no record, else
 * { year, month, visits, walls, fresh, stamps: [{ day, first: [bool, ...], more }], names: [{ name, count }] }.
 * walls: how many different walls; fresh: how many of them were visited for the first time ever that month (judged over the whole log);
 * stamps: per day with a record, in day order, the visits in time order (first: that visit was the wall's first); names: only when asked,
 * the most visited first (ties by name), the wall's short name. A wall that left the list is counted under its logged name.
 */
export function monthPicture(log, walls, year, month, { names = false } = {}) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const recs = log.filter((r) => r.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
  if (!recs.length) return null;
  const firsts = firstVisits(log);
  const days = new Map();
  for (const r of recs) {
    const day = Number(r.date.slice(8));
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(r);
  }
  const stamps = [...days].sort((a, b) => a[0] - b[0]).map(([day, list]) => ({
    day, first: list.slice(0, MAX_STAMPS).map((r) => firsts.has(r.id)), more: Math.max(0, list.length - MAX_STAMPS),
  }));
  const counts = new Map();
  for (const r of recs) counts.set(r.wall, (counts.get(r.wall) ?? 0) + 1);
  const label = (name) => { const w = walls.find((x) => x.name === name); return w ? shortName(w) : name; };
  return {
    year, month, visits: recs.length, walls: counts.size, fresh: recs.filter((r) => firsts.has(r.id)).length, stamps,
    names: names ? [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, MAX_NAMES).map(([name, count]) => ({ name: label(name), count })) : [],
  };
}

const CX = W / 2;
const CY = 1150;
const R = 420; // the sun's path: left end the 1st, right end the last day
const STAMP = 80;

function stamp(g, mark, x, y, first) {
  g.strokeStyle = PAPER;
  g.globalAlpha = 0.85;
  g.lineWidth = 3;
  for (const r of first ? [STAMP / 2 - 2, STAMP / 2 + 8] : [STAMP / 2 - 2]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  if (mark) {
    g.save();
    g.translate(x, y);
    g.rotate((8 * Math.PI) / 180); // every stamp leans the same way, as in the calendar
    g.drawImage(mark, -STAMP * 0.3, -STAMP * 0.3, STAMP * 0.6, STAMP * 0.6);
    g.restore();
  }
}

/** drawMonth(canvas, pic, { made }) — pic: monthPicture's result; made: the "2026.10.12 만듦" line (empty: none). */
export async function drawMonth(canvas, pic, { made = '' } = {}) {
  await Promise.all(['300 300px', '400 48px', '600 56px'].map((f) => document.fonts.load(`${f} ${FONT}`, '해벽 0123 번곳')));
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = INK;
  g.fillRect(0, 0, W, H);
  const [sign, mark] = await Promise.all([lockup(), image('assets/haebyeok-mark-dark.svg')]);
  if (sign) g.drawImage(sign, M, 190, (303 / 140) * 270, 270); // the brand's own lockup, same place and size as the invite
  g.fillStyle = PAPER;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.font = `600 56px ${FONT}`;
  g.fillText(`${pic.year}년 ${pic.month}월`, M, 570);

  const dim = new Date(pic.year, pic.month, 0).getDate();
  const at = (day, r) => { const th = Math.PI * (1 - (day - 1) / (dim - 1)); return [CX + r * Math.cos(th), CY - r * Math.sin(th)]; };
  g.strokeStyle = PAPER;
  g.lineWidth = 3;
  g.globalAlpha = 0.55;
  g.beginPath(); g.arc(CX, CY, R, Math.PI, Math.PI * 2); g.stroke(); // the way the sun goes
  g.lineWidth = 2;
  g.globalAlpha = 0.3;
  g.setLineDash([3, 14]);
  g.beginPath(); g.arc(CX, CY, R, 0, Math.PI); g.stroke(); // the way back under the wall
  g.setLineDash([]);
  g.globalAlpha = 0.25;
  g.beginPath(); g.moveTo(CX - R - 40, CY); g.lineTo(CX + R + 40, CY); g.stroke();
  g.globalAlpha = 0.55;
  for (let d = 1; d <= dim; d++) {
    const [x1, y1] = at(d, R - (d === 1 || d % 5 === 0 ? 20 : 10));
    const [x2, y2] = at(d, R);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = MUTED;
  g.font = `400 30px ${FONT}`;
  g.textAlign = 'center';
  for (const d of new Set([1, 10, 20, dim])) { const [x, y] = at(d, R - 72); g.fillText(String(d), x, y + 10); }

  for (const s of pic.stamps) {
    s.first.forEach((first, k) => { const [x, y] = at(s.day, R + 104 * k); stamp(g, mark, x, y, first); });
    if (s.more) {
      const [x, y] = at(s.day, R + 104 * s.first.length);
      g.fillStyle = PAPER;
      g.font = `600 34px ${FONT}`;
      g.fillText(`+${s.more}`, x, y + 12);
    }
  }

  // the number of visits stands in the middle of the path, with its unit beside it
  g.fillStyle = PAPER;
  g.font = `300 300px ${FONT}`;
  const num = String(pic.visits);
  const wNum = g.measureText(num).width;
  g.font = `300 84px ${FONT}`;
  const wUnit = g.measureText('번').width;
  const left = CX - (wNum + 14 + wUnit) / 2;
  g.textAlign = 'left';
  g.font = `300 300px ${FONT}`;
  g.fillText(num, left, 1250);
  g.font = `300 84px ${FONT}`;
  g.fillText('번', left + wNum + 14, 1250);
  g.fillStyle = MUTED;
  g.font = `400 44px ${FONT}`;
  g.textAlign = 'center';
  g.fillText(pic.fresh ? `${pic.walls}곳 · 새로 간 곳 ${pic.fresh}` : `${pic.walls}곳`, CX, 1340);

  if (pic.names.length) {
    g.textAlign = 'left';
    g.font = `400 30px ${FONT}`;
    g.fillStyle = MUTED;
    g.fillText('이번 달 간 곳', M, 1418);
    g.font = `400 40px ${FONT}`;
    g.fillStyle = PAPER;
    const text = pic.names.map((n) => (n.count > 1 ? `${n.name} ×${n.count}` : n.name)).join(' · ');
    wrapLines((t) => g.measureText(t).width, text, W - M * 2, 2).forEach((line, i) => g.fillText(line, M, 1468 + i * 48));
  }

  g.fillStyle = 'rgba(244,242,236,0.45)'; // the same hairline and credit as the invite
  g.fillRect(M, 1545, W - M * 2, 3);
  g.font = `400 34px ${FONT}`;
  g.fillStyle = MUTED;
  g.textAlign = 'right';
  if (made) g.fillText(made, W - M, 1594);
  g.fillText('created by 바위타는 은설', W - M, 1638);
  g.textAlign = 'left';
}
