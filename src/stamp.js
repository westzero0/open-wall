// src/stamp.js — the one place that decides what a wall's stamp looks like (calendar, 기록 list, the card's 다녀왔어요).
// Today every wall stamps the 해벽 mark. A wall with its own artwork (wall.stamp, "stamps/<name>.svg" under data/) is drawn
// from that file instead; callers do not change when stamps are added, only the data does. No DOM of its own.
import { STAMP_RE } from './store.js';
import { isSunlit } from './sun.js';

export const MARK = 'assets/haebyeok-mark.svg'; // the default, also what the stylesheet falls back to

/** stampUrl(wall) → 'url(data/stamps/x.svg)' for a wall with its own stamp, else null. The path is re-checked here. */
export function stampUrl(wall) {
  return typeof wall?.stamp === 'string' && STAMP_RE.test(wall.stamp) ? `url(data/${wall.stamp})` : null;
}

/** inkStamp(span, wall) → span, with --stamp-src set when the wall has its own stamp (else the CSS default applies). */
export function inkStamp(span, wall) {
  const url = stampUrl(wall);
  if (url) span.style.setProperty('--stamp-src', url);
  return span;
}

/**
 * sunMark(wall, date, time) → {x, y, lit} | null: where the sun stood on the stamp's rim for a visit ('YYYY-MM-DD', 'HH:mm').
 * x, y in % of the stamp (east left, south top, west right); lit: the wall was in the sun. No time, no facing, an
 * override-only or indoor wall, or night: null — the plain stamp, nothing is made up.
 */
export function sunMark(wall, date, time) {
  if (!wall || !time) return null;
  const p = isSunlit(wall, new Date(`${date}T${time}:00`));
  if (!Number.isFinite(p.azimuth) || p.reason === 'night') return null;
  const th = (270 - Math.min(270, Math.max(90, p.azimuth))) * (Math.PI / 180);
  return { x: 50 + 50 * Math.cos(th), y: 50 - 50 * Math.sin(th), lit: p.lit };
}
