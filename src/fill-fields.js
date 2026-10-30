// src/fill-fields.js — 빈칸 채우기 제보(docs/superpowers/specs/2026-10-30-contribution-fill-in-design.md): field checks, "same value" test and the
// overlay onto walls. Shared by the app and the Worker (which trusts nothing); no DOM.
import { normalizeWall } from './store.js';

export const FILL_FIELDS = ['location', 'height_m', 'notice_url', 'phone'];

const LAT = [33, 39];
const LNG = [124, 132];
const between = (v, [lo, hi]) => v >= lo && v <= hi;
const digits = (s) => String(s ?? '').replace(/\D/g, '');

const inKorea = (lat, lng) => (typeof lat === 'number' && typeof lng === 'number' && between(lat, LAT) && between(lng, LNG) ? { lat, lng } : null);

/** first two decimals in the text → {lat,lng} inside Korea (swapped when given as lng, lat), else null. */
export function parseLocationText(text) {
  if (typeof text !== 'string') return null;
  const nums = text.match(/-?\d+\.\d+/g);
  if (!nums || nums.length < 2) return null;
  let [lat, lng] = [Number(nums[0]), Number(nums[1])];
  if (!between(lat, LAT) && between(lng, LAT) && between(lat, LNG)) [lat, lng] = [lng, lat];
  return inKorea(lat, lng);
}

const r4 = (n) => Math.round(n * 1e4) / 1e4; // ~11 m: enough for a wall, too coarse to read a doorstep

/** a checked value for `field`, or null when it is refused. */
export function cleanFillValue(field, raw) {
  if (field === 'location') {
    const p = typeof raw === 'string' ? parseLocationText(raw) : inKorea(raw?.lat, raw?.lng);
    return p ? { lat: r4(p.lat), lng: r4(p.lng) } : null;
  }
  if (field === 'height_m') {
    const n = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '') ? Number(raw) : NaN;
    if (!Number.isFinite(n)) return null;
    const v = Math.round(n * 10) / 10;
    return v >= 3 && v <= 40 ? v : null;
  }
  if (field === 'notice_url') {
    const s = typeof raw === 'string' ? raw.trim() : '';
    return s.length <= 500 && /^https?:\/\/[^\s\x00-\x1f]+$/i.test(s) ? s : null;
  }
  if (field === 'phone') {
    const s = typeof raw === 'string' ? raw.replace(/[^\d-]/g, '') : '';
    const n = digits(s).length;
    return n >= 8 && n <= 12 ? s : null;
  }
  return null;
}

export function isEmptyField(wall, field) {
  if (field === 'location') return !wall?.location;
  if (field === 'height_m') return !(typeof wall?.height_m === 'number' && Number.isFinite(wall.height_m));
  if (field === 'notice_url' || field === 'phone') return !String(wall?.contact?.[field] ?? '').trim();
  return false;
}

export function metersApart(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** a reported spot must lie within this far of the wall's known point (walls.json lat/lng, or the app's sun point): a home address or a mistyped pin is refused. */
export const NEAR_WALL_M = 10_000;
export const isNearWall = (anchor, p) => !anchor || metersApart(anchor, p) <= NEAR_WALL_M;
const urlKey = (u) => { try { const x = new URL(u); return `${x.protocol}//${x.host}${x.pathname.replace(/\/+$/, '')}${x.search}${x.hash}`; } catch { return String(u); } };

/** do two values for `field` count as the same answer (height ±1 m, location within 100 m, url/phone normalised)? */
export function valuesMatch(field, a, b) {
  if (field === 'height_m') return Math.abs(Number(a) - Number(b)) <= 1;
  if (field === 'location') return Boolean(a && b) && metersApart(a, b) <= 100;
  if (field === 'notice_url') return urlKey(a) === urlKey(b);
  if (field === 'phone') return digits(a) !== '' && digits(a) === digits(b);
  return false;
}

/**
 * walls + fills → walls where each empty field named by a fill holds the fill's value (first fill per field wins; a field that has a value is
 * never overwritten). Touched walls are normalised copies carrying wall.fillMarks = { field: { nick, status } }; the input is not changed.
 */
export function applyFills(walls, fills) {
  const byId = new Map();
  for (const f of fills ?? []) {
    if (!FILL_FIELDS.includes(f?.field)) continue;
    if (!byId.has(f.wall_id)) byId.set(f.wall_id, []);
    byId.get(f.wall_id).push(f);
  }
  return walls.map((w) => {
    const mine = byId.get(w?.id);
    if (!mine) return w;
    const copy = structuredClone(w);
    const marks = { ...(w.fillMarks ?? {}) }; // marks of an earlier pass stay
    const before = Object.keys(marks).length;
    for (const f of mine) {
      if (marks[f.field] || !isEmptyField(copy, f.field)) continue;
      const v = cleanFillValue(f.field, f.value);
      if (v == null) continue;
      if (f.field === 'notice_url' || f.field === 'phone') copy.contact = { ...(copy.contact ?? {}), [f.field]: v };
      else copy[f.field] = v;
      marks[f.field] = { nick: String(f.nick ?? ''), status: f.status === 'confirmed' ? 'confirmed' : 'pending' };
    }
    if (Object.keys(marks).length === before) return w;
    return { ...normalizeWall(copy), fillMarks: marks };
  });
}
