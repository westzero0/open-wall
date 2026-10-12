// Card values of a single-pitch crag (data/single-pitch.json): no hours, the sunrise-to-sunset day is the frame.
// Pure, no DOM. Not wired to any screen yet (docs/superpowers/specs/2026-10-12-single-pitch-design.md).
import { isSunlit, dayWindow, fmt as hhmm } from './sun.js';

const STEP = 1; // minute resolution: the bar's edges are the real flips, so state, bar and nextChange agree
const NOTE = '벽 기준이며 나무 가림은 반영하지 않아요.';

export function cragModel(crag, at) {
  const day = (m) => new Date(at.getFullYear(), at.getMonth(), at.getDate(), 0, m);
  const now = at.getHours() * 60 + at.getMinutes();
  const win = dayWindow(crag, at);
  const here = isSunlit(crag, at);
  const state = here.lit === null ? 'unknown' : here.reason === 'night' ? 'night' : here.lit ? 'sun' : 'shade';

  const segs = []; // [from, to, lit] in minutes
  if (win && here.lit !== null) {
    let from = win.sunrise;
    let lit = isSunlit(crag, day(from)).lit;
    for (let m = from + STEP; m < win.sunset; m += STEP) {
      const l = isSunlit(crag, day(m)).lit;
      if (l !== lit) { segs.push([from, m, lit]); from = m; lit = l; }
    }
    segs.push([from, win.sunset, lit]);
  }
  const next = state === 'sun' || state === 'shade' ? segs.find(([from]) => from > now) : null; // at night there is no "change" to announce
  const inDay = win && now >= win.sunrise && now < win.sunset;
  const { lat, lng } = crag.sun ?? {};

  return {
    name: crag.name,
    region: crag.region,
    memo: crag.memo,
    route: Number.isFinite(lat) && Number.isFinite(lng) ? `https://map.kakao.com/link/to/${encodeURIComponent(crag.name)},${lat},${lng}` : null,
    state,
    remainingMin: (state === 'sun' || state === 'shade') && inDay ? win.sunset - now : null,
    nextChange: next ? { at: hhmm(next[0]), to: next[2] ? 'sun' : 'shade' } : null,
    bar: segs.map(([from, to, lit]) => ({ from: hhmm(from), to: hhmm(to), lit })),
    note: NOTE,
  };
}
