import { toMin } from './time.js';
import { horizonAt } from './shadow.js';

const rad = Math.PI / 180;
const SEOUL = { lat: 37.5665, lng: 126.978 };
const FACING = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const MIN_ALTITUDE = 3;
const MAX_ANGLE = 85;

export function sunPosition(date, lat, lng) {
  const d = date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545; // days since J2000
  const e = rad * 23.4397;
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const lw = rad * -lng;
  const phi = rad * lat;
  const H = rad * (280.16 + 360.9856235 * d) - lw - ra;
  const azFromSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return { altitude: altitude / rad, azimuth: (azFromSouth / rad + 180 + 360) % 360 };
}

const angleDiff = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// 벽 정면이 바라보는 각도(북 0, 시계 방향): sun.facing_deg 가 있으면 그것, 없으면 8방위 sun.facing, 둘 다 없으면 null.
export function facingDegOf(sun) {
  const d = sun?.facing_deg;
  if (Number.isFinite(d) && d >= 0 && d < 360) return d;
  return typeof sun?.facing === 'string' && Object.hasOwn(FACING, sun.facing) ? FACING[sun.facing] : null;
}

// Order: manual override -> no facing -> low sun -> wall faces away -> terrain -> sunlit.
export function isSunlit(wall, at) {
  if (wall.venue === 'indoor') return { lit: null, reason: 'indoor' }; // indoor-only: no sun math
  const override = wall.sun_override;
  if (Array.isArray(override) && override.length) {
    const m = at.getHours() * 60 + at.getMinutes();
    const lit = override.some(([a, b]) => toMin(a) <= m && m < toMin(b));
    return { lit, reason: 'override', method: 'override' };
  }
  const facing = facingDegOf(wall.sun);
  if (facing === null) return { lit: null };
  const p = sunPosition(at, Number.isFinite(wall.sun.lat) ? wall.sun.lat : SEOUL.lat, Number.isFinite(wall.sun.lng) ? wall.sun.lng : SEOUL.lng);
  let reason = 'sun';
  if (p.altitude < MIN_ALTITUDE) reason = 'night';
  else if (angleDiff(p.azimuth, facing) > MAX_ANGLE) reason = 'facing';
  else if (wall.shadow && p.altitude <= horizonAt(wall.shadow, p.azimuth)) reason = 'terrain';
  return { lit: reason === 'sun', reason, method: wall.shadow ? 'terrain' : 'azimuth', ...p };
}

export const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function sunWindows(wall, date, stepMin = 10) {
  const out = [];
  let start = null;
  for (let m = 0; m <= 1440; m += stepMin) {
    const lit = isSunlit(wall, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, m)).lit;
    if (lit && start === null) start = m;
    if (!lit && start !== null) {
      out.push([fmt(start), fmt(m - stepMin)]);
      start = null;
    }
  }
  if (start !== null) out.push([fmt(start), '24:00']);
  return out;
}

// Sunrise and sunset as minutes after local midnight: the first minute the sun is high enough to count as day (the same
// MIN_ALTITUDE isSunlit uses, so a minute inside the window is never "night"), and the minute after the last one. null when it never rises that day. Missing lat/lng fall back to Seoul, as isSunlit does.
export function dayWindow(wall, date) {
  const lat = Number.isFinite(wall.sun?.lat) ? wall.sun.lat : SEOUL.lat;
  const lng = Number.isFinite(wall.sun?.lng) ? wall.sun.lng : SEOUL.lng;
  let sunrise = null;
  let sunset = null;
  for (let m = 0; m < 1440; m++) {
    if (sunPosition(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, m), lat, lng).altitude >= MIN_ALTITUDE) {
      sunrise ??= m;
      sunset = m + 1;
    }
  }
  return sunrise === null ? null : { sunrise, sunset };
}
