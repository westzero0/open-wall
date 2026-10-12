// src/record-image.js — the month's 기록 as a 9:16 picture (1080×1920): a sun with a ray for every day of the month, lit for the days that were gone.
// monthPicture, canSaveMonth and rays are pure (tested): the numbers and the place of every ray. drawMonth is canvas only.
// Made on this device, never sent. The sun is always whole (every day has its ray); the data is which rays are lit.
import { firstVisits } from './log.js';
import { shortName } from './viewmodel.js';
import { FONT, H, INK, M, MUTED, PAPER, W, lockup, wrapLines } from './share-image.js';

export const MAX_NAMES = 5;

/**
 * monthPicture(log, walls, year, month, { names }) → null when the month has no record, else
 * { year, month, visits, walls, fresh, days: [{ day, n, first }], names: [{ name, count }] }.
 * walls: how many different walls; fresh: how many of them were visited for the first time ever that month (judged over the whole log);
 * days: per day with a record, in day order: n visits, first = one of them was a wall's first visit; names: only when asked,
 * the most visited first (ties by name), the wall's short name. A wall that left the list is counted under its logged name.
 */
export function monthPicture(log, walls, year, month, { names = false } = {}) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const recs = log.filter((r) => r.date.startsWith(prefix));
  if (!recs.length) return null;
  const firsts = firstVisits(log);
  const days = new Map();
  for (const r of recs) {
    const day = Number(r.date.slice(8));
    const d = days.get(day) ?? { day, n: 0, first: false };
    d.n += 1;
    d.first = d.first || firsts.has(r.id);
    days.set(day, d);
  }
  const counts = new Map();
  for (const r of recs) counts.set(r.wall, (counts.get(r.wall) ?? 0) + 1);
  const label = (name) => { const w = walls.find((x) => x.name === name); return w ? shortName(w) : name; };
  return {
    year, month, visits: recs.length, walls: counts.size, fresh: recs.filter((r) => firsts.has(r.id)).length,
    days: [...days.values()].sort((a, b) => a.day - b.day),
    names: names ? [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, MAX_NAMES).map(([name, count]) => ({ name: label(name), count })) : [],
  };
}

/** canSaveMonth(year, month, today) → true when that month has ended: only then may its picture be saved or shared (this month and later are preview only). */
export const canSaveMonth = (year, month, today = new Date()) => year * 12 + month < today.getFullYear() * 12 + today.getMonth() + 1;

export const CX = W / 2;
export const CY = 1130; // the foot of the sun
export const R0 = 150; // the rays start here, just outside the sun (radius 110)
const LEN = 230; // every ray is the same bar
const RING = 22; // a first visit's ring stands this far beyond the tip of its ray
export const TIP = R0 + LEN + RING + 18; // the farthest anything reaches
const INSET = (6 * Math.PI) / 180; // the first and last day stand a little above the horizontal

/** pointAt(day, dim, r) → [x, y]: the day on the half circle at radius r (day 1 at the left, the last day at the right). */
export function pointAt(day, dim, r) {
  const th = Math.PI - INSET - (Math.PI - 2 * INSET) * ((day - 1) / Math.max(1, dim - 1));
  return [CX + r * Math.cos(th), CY - r * Math.sin(th)];
}

/** rays(dim, days) → one ray per day of the month: { day, x1, y1, x2, y2, lit, ring }. lit: the day was gone; ring: [x, y] beyond the tip when a wall was visited for the first time, else null. */
export function rays(dim, days) {
  const gone = new Map(days.map((d) => [d.day, d]));
  return Array.from({ length: dim }, (_, i) => {
    const day = i + 1;
    const v = gone.get(day);
    const [x1, y1] = pointAt(day, dim, R0);
    const [x2, y2] = pointAt(day, dim, R0 + LEN);
    return { day, x1, y1, x2, y2, lit: !!v, ring: v?.first ? pointAt(day, dim, R0 + LEN + RING) : null };
  });
}

const SUN = '#f4b942'; // the logo's sun: here the sun is the subject, so its colour is the data

/** drawMonth(canvas, pic) — pic: monthPicture's result. */
export async function drawMonth(canvas, pic) {
  await Promise.all(['300 200px', '400 40px', '600 52px'].map((f) => document.fonts.load(`${f} ${FONT}`, '해벽 0123 번곳 처음 간')));
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = INK;
  g.fillRect(0, 0, W, H);
  const sign = await lockup();
  if (sign) g.drawImage(sign, M, 190, (303 / 140) * 270, 270); // the brand's own lockup, same place and size as the invite
  const dim = new Date(pic.year, pic.month, 0).getDate();

  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = PAPER;
  g.font = `600 52px ${FONT}`;
  g.fillText(`${pic.year}년 ${pic.month}월`, M, 570);
  g.fillStyle = MUTED;
  g.font = `400 32px ${FONT}`;
  g.textAlign = 'right';
  g.fillText('처음 간 곳', W - M, 570);
  g.globalAlpha = 0.9; g.strokeStyle = PAPER; g.lineWidth = 2.5; g.beginPath(); g.arc(W - M - g.measureText('처음 간 곳').width - 24, 561, 9, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;

  // a soft light behind the sun (the one gradient) and the sun itself: one plain half disc
  const glow = g.createRadialGradient(CX, CY, 0, CX, CY, TIP);
  glow.addColorStop(0, 'rgba(244,185,66,0.32)'); glow.addColorStop(0.6, 'rgba(244,185,66,0.07)'); glow.addColorStop(1, 'rgba(244,185,66,0)');
  g.save(); g.beginPath(); g.rect(0, 0, W, CY); g.clip(); g.fillStyle = glow; g.beginPath(); g.arc(CX, CY, TIP, 0, Math.PI * 2); g.fill(); g.restore();
  // the guide lines behind everything: thin rings and one thin spoke per day (Sundays a little stronger, so the weeks can be read)
  g.strokeStyle = PAPER;
  for (let k = 1; k <= 5; k++) { g.globalAlpha = 0.1; g.lineWidth = 1.5; g.beginPath(); g.arc(CX, CY, R0 + (k * (TIP - R0)) / 5, Math.PI, Math.PI * 2); g.stroke(); }
  for (let d = 1; d <= dim; d++) {
    const sunday = new Date(pic.year, pic.month - 1, d).getDay() === 0;
    const [x1, y1] = pointAt(d, dim, R0 - 6);
    const [x2, y2] = pointAt(d, dim, TIP + 8);
    g.globalAlpha = sunday ? 0.22 : 0.08; g.lineWidth = sunday ? 2 : 1.5;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = SUN;
  g.beginPath(); g.arc(CX, CY, 110, Math.PI, Math.PI * 2); g.closePath(); g.fill();

  // a ray for every day: lit for a day that was gone, nearly out for one that was not; all the same round bar
  g.lineCap = 'round';
  for (const r of rays(dim, pic.days)) {
    g.globalAlpha = r.lit ? 1 : 0.16;
    g.strokeStyle = r.lit ? SUN : PAPER;
    g.lineWidth = r.lit ? 8 : 4; // thin: the picture is drawn with fine lines
    g.beginPath(); g.moveTo(r.x1, r.y1); g.lineTo(r.x2, r.y2); g.stroke();
  }
  g.lineCap = 'butt';
  g.strokeStyle = PAPER; g.lineWidth = 2.5; g.globalAlpha = 0.9; // a small ring at the tip of a first visit
  for (const r of rays(dim, pic.days)) if (r.ring) { g.beginPath(); g.arc(r.ring[0], r.ring[1], 9, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = MUTED;
  g.font = `400 30px ${FONT}`;
  g.textAlign = 'center';
  for (const d of [1, 5, 10, 15, 20, 25, 30, dim]) if (d === 1 || d === dim || d <= dim - 2) { const [x, y] = pointAt(d, dim, TIP + 56); g.fillText(String(d), x, y + 11); } // the guide's numbers

  // the number of visits under the sun, then the walls
  const num = String(pic.visits);
  g.fillStyle = PAPER;
  g.font = `300 200px ${FONT}`;
  const wNum = g.measureText(num).width;
  g.font = `300 62px ${FONT}`;
  const wUnit = g.measureText('번').width;
  const left = CX - (wNum + 12 + wUnit) / 2;
  const base = CY + 180;
  g.textAlign = 'left';
  g.font = `300 200px ${FONT}`;
  g.fillText(num, left, base);
  g.font = `300 62px ${FONT}`;
  g.fillText('번', left + wNum + 12, base);
  g.fillStyle = MUTED;
  g.font = `400 40px ${FONT}`;
  g.textAlign = 'center';
  g.fillText(pic.fresh ? `${pic.walls}곳 · 새로 간 곳 ${pic.fresh}` : `${pic.walls}곳`, CX, base + 62);

  if (pic.names.length) {
    g.textAlign = 'left';
    g.font = `400 32px ${FONT}`;
    g.fillStyle = MUTED;
    g.fillText('이번 달 간 곳', M, 1428);
    g.font = `400 38px ${FONT}`;
    g.fillStyle = PAPER;
    const text = pic.names.map((n) => (n.count > 1 ? `${n.name} ×${n.count}` : n.name)).join(' · ');
    wrapLines((t) => g.measureText(t).width, text, W - M * 2, 2).forEach((l, i) => g.fillText(l, M, 1472 + i * 42));
  }

  g.fillStyle = 'rgba(244,242,236,0.45)'; // the same hairline as the invite, with the credit alone
  g.fillRect(M, 1545, W - M * 2, 3);
  g.font = `400 34px ${FONT}`;
  g.fillStyle = MUTED;
  g.textAlign = 'right';
  g.fillText('created by 바위타는 은설', W - M, 1594); // no date: the title says which month, and a date next to the credit reads as when 은설 made it
  g.textAlign = 'left';
}
