// src/viewmodel.js
import { hasHours, openIntervals } from './hours.js';
import { isSunlit, sunWindows } from './sun.js';
import { toMin } from './time.js';

const SUN_STEP = 10;
const p2 = (n) => String(n).padStart(2, '0');
const fmtMin = (m) => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;

export const formatRanges = (ranges) =>
  ranges.length ? ranges.map(([a, b]) => `${fmtMin(a)}–${fmtMin(b)}`).join(', ') : '없음';

export function sunIntervals(wall, date) {
  return sunWindows(wall, date, SUN_STEP).map(([a, b]) => [toMin(a), Math.min(toMin(b) + SUN_STEP, 1440)]);
}

export function dayBar(wall, at) {
  const open = openIntervals(wall, at);
  const sunKnown = isSunlit(wall, at).lit !== null;
  const sun = sunKnown ? sunIntervals(wall, at) : null;
  const nowMin = at.getHours() * 60 + at.getMinutes();
  const sunText = sun ? `해 ${formatRanges(sun)}` : '해 정보 없음';
  return { open, sun, nowMin, label: `운영 ${formatRanges(open)}, ${sunText}, 현재 ${fmtMin(nowMin)}` };
}

export function groupRows(rows) {
  return {
    open: rows.filter((r) => r.status.state === 'open'),
    closed: rows.filter((r) => r.status.state === 'closed'),
    unknown: rows.filter((r) => r.status.state === 'unknown'),
  };
}

export const endingSoon = (row) => row.status.state === 'open' && row.status.remainingMin <= 60;

export function pinState(status) {
  if (status.state === 'open') return status.remainingMin <= 60 ? 'soon' : 'open';
  return status.state === 'closed' ? 'closed' : 'unknown';
}

export function nextOpening(rows) {
  let best = null;
  for (const r of rows) {
    if (r.status.state !== 'closed' || !r.status.nextOpenAt) continue;
    if (!best || r.status.nextOpenAt < best.status.nextOpenAt) best = r;
  }
  return best;
}

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km) {
  if (km < 1) {
    const m = Math.round(km * 100) * 10;
    return m >= 1000 ? '1.0km' : `${m}m`;
  }
  return `${km.toFixed(1)}km`;
}

export function wallPosition(wall) {
  if (wall.location) return { lat: wall.location.lat, lng: wall.location.lng, approx: wall.location.approx === true };
  const { lat, lng } = wall.sun ?? {};
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, approx: false } : null;
}

// Map markers: rows with a position become pins, the rest are listed by name.
export function mapPins(rows) {
  const pins = [];
  const unlocated = [];
  for (const row of rows) {
    const pos = wallPosition(row.wall);
    if (pos) pins.push({ row, ...pos, pin: pinState(row.status) });
    else unlocated.push(row.wall.name);
  }
  return { pins, unlocated };
}

export function withDistance(rows, origin) {
  return rows.map((r) => {
    const p = origin ? wallPosition(r.wall) : null;
    return { ...r, distanceKm: p ? distanceKm(origin, p) : null };
  });
}

export function sortRows(rows, mode) {
  const out = [...rows];
  if (mode !== 'distance') return out;
  const key = (r) => r.distanceKm ?? Infinity;
  return out.sort((a, b) => key(a) - key(b) || a.wall.name.localeCompare(b.wall.name, 'ko'));
}

const PARKING_TEXT = {
  free: ['주차 무료', 'good'],
  paid: ['주차 유료', 'neutral'],
  none: ['주차 불가', 'warn'],
};
export function parkingLabel(parking) {
  const [text, tone] = PARKING_TEXT[parking?.status] ?? ['주차 정보 없음', 'muted'];
  return { text, tone, note: parking?.note ?? '' };
}

export const hasParking = (wall) => wall.parking?.status === 'free' || wall.parking?.status === 'paid';

export const photoSrc = (wall) => (wall.photo ? `data/${wall.photo}` : null);

export function placeholderText(wall) {
  const tags = wall.tags ?? [];
  return {
    primary: wall.height_m ? `${wall.height_m}m` : '외벽',
    secondary: ['스피드월', '리드', '볼더', '실내벽'].find((t) => tags.includes(t)) ?? '',
  };
}

// Hours older than a year may have changed (seasonal schedules, notices): flag them. Only walls with hours are judged.
export const STALE_DAYS = 365;
export function staleness(wall, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wall.checked_at ?? '');
  const days = m ? Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5) : null;
  const stale = hasHours(wall) && (days === null || days > STALE_DAYS);
  return { stale, label: m ? `${m[1]}-${m[2]}` : '확인일 없음' };
}
