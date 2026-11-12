// Same-day alternatives for a plan at risk. Not homeSuggest (src/home-suggest.js): that one is favs/log-based "today" picks; this reuses its parts (staleness, openIntervals, wallPosition, distanceKm) for a plan's date.
// Official walls only: natural crags have no hours, so they are not candidates in this version. DOM-free.
import { staleness } from './card-model.js';
import { hasHours, openIntervals } from './hours.js';
import { distanceKm, wallPosition } from './viewmodel.js';
import { wallPageId } from './share-id.js';
import { riskOf } from './plan-risk.js';

const RAIN = /비|눈|뇌우/; // wall reasons; a crag's reason is its cond state ('rain'; 'frozen' is not rain)

export function alternatives(plan, resolved, opts) {
  const { walls, wx, now = Date.now(), limit = 2 } = opts ?? {};
  const none = { picks: [], rest: true };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plan?.date ?? '');
  if (!m || !(resolved?.located && resolved.pos)) return none;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (new Date(+m[1], +m[2] - 1, +m[3]) < today) return none;
  const day = new Date(+m[1], +m[2] - 1, +m[3]);
  const nowD = new Date(now);
  const min = Number.isFinite(plan.min) ? plan.min : null;
  const self = resolved?.wall ? wallPageId(resolved.wall) : null;
  const rainy = (() => { const r = riskOf(resolved, plan, wx, now); return r.level === 'hard' && (RAIN.test(r.reason ?? '') || r.reason === 'rain'); })();

  const rows = [];
  for (const w of Array.isArray(walls) ? walls : []) {
    if (!w || typeof w !== 'object' || typeof w.name !== 'string' || !w.name) continue;
    if (w === resolved?.wall || (self && wallPageId(w) === self) || w.name === resolved?.name) continue;
    if (w.suspended || !hasHours(w) || staleness(w, nowD).stale) continue;
    const stretch = openIntervals(w, day).find(([, end]) => min === null || end > min);
    if (!stretch) continue;
    const at = wallPosition(w);
    const indoor = w.venue === 'indoor';
    const cand = { kind: 'wall', name: w.name, venue: indoor ? 'indoor' : 'outdoor', pos: at, located: !!at, reported: false, wall: w };
    const risk = riskOf(cand, plan, wx, now);
    if (risk.level === 'hard') continue;
    const km = at ? distanceKm(resolved.pos, at) : null;
    rows.push({ wall: w, km: Number.isFinite(km) ? km : null, indoor, startMin: stretch[0], endMin: stretch[1], risk });
  }
  rows.sort((a, b) => (rainy ? (b.indoor - a.indoor) : 0) || (a.km ?? Infinity) - (b.km ?? Infinity));
  return { picks: rows.slice(0, Math.max(0, limit)), rest: true };
}
