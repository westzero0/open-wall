// src/stamp.js — the one place that decides what a wall's stamp looks like (calendar, 기록 list, the card's 다녀왔어요).
// Today every wall stamps the 해벽 mark. A wall with its own artwork (wall.stamp, "stamps/<name>.svg" under data/) is drawn
// from that file instead; callers do not change when stamps are added, only the data does. No DOM of its own.
import { STAMP_RE } from './store.js';

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
