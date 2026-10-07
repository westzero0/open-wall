import { getStatus, openIntervals } from './hours.js';
import { isSunlit } from './sun.js';

const GROUP = { open: 0, closed: 1, unknown: 2 };

// Minutes of use left: the stretch until the next break/closing, or (withBreaks) all open time left today.
function stayMin(wall, status, at, withBreaks) {
  if (!withBreaks) return status.remainingMin;
  const now = at.getHours() * 60 + at.getMinutes();
  return openIntervals(wall, at).reduce((sum, [a, b]) => sum + Math.max(0, b - Math.max(a, now)), 0);
}

export function buildList(walls, at, { minHours = 0, sun = 'any', withBreaks = false } = {}) {
  const rows = walls.map((wall) => {
    const status = getStatus(wall, at);
    const sun = isSunlit(wall, at);
    return {
      wall,
      status,
      lit: sun.lit,
      reason: sun.reason,
      method: sun.method,
      short: status.state === 'open' && stayMin(wall, status, at, withBreaks) < minHours * 60,
    };
  });

  // 0 = preferred, 1 = no info / no preference, 2 = opposite
  const sunRank = (r) => (sun === 'any' || r.lit === null ? 1 : r.lit === (sun === 'sun') ? 0 : 2);
  const order = (r) =>
    r.status.state === 'open' ? -r.status.remainingMin : (r.status.nextOpenAt?.valueOf() ?? Infinity);

  return rows.sort(
    (a, b) =>
      GROUP[a.status.state] - GROUP[b.status.state] ||
      sunRank(a) - sunRank(b) ||
      order(a) - order(b) || // NaN (Infinity - Infinity) falls through to the name
      a.wall.name.localeCompare(b.wall.name, 'ko'),
  );
}
