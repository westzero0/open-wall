import { cleanShadow } from './shadow.js';
import { hasHours, orderIntervals } from './hours.js';
const KEY = 'open-wall:v1';

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function getStringArray(v) {
  if (!Array.isArray(v)) return [];
  if (!v.every((x) => typeof x === 'string')) return [];
  return v;
}

function getPlainObject(v) {
  return isPlainObject(v) ? v : {};
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const CONTACT_KEYS = ['phone', 'instagram', 'naver_map', 'notice_url'];

function cleanTime(s) {
  if (typeof s !== 'string' || !/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  if (m > 59 || h > 24 || (h === 24 && m !== 0)) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function cleanHours(v) {
  const out = {};
  for (const d of DAYS) {
    const s = getPlainObject(v)[d];
    if (s === null) out[d] = null;
    else if (Array.isArray(s) && s.length === 2 && typeof s[0] === 'string') {
      const [a, b] = s.map(cleanTime);
      if (a && b) out[d] = [a, b];
    } else if (Array.isArray(s) && s.length) {
      // a list of intervals (break times)
      const list = s.map((p) => (Array.isArray(p) && p.length === 2 ? p.map(cleanTime) : null));
      const ordered = list.every((p) => p && p[0] && p[1]) && orderIntervals(list);
      if (ordered) out[d] = ordered.length === 1 ? ordered[0] : ordered;
    }
  }
  return out;
}

function cleanContact(v) {
  const out = {};
  for (const k of CONTACT_KEYS) {
    const s = getPlainObject(v)[k];
    if (typeof s === 'string' && s.trim()) out[k] = s;
  }
  return out;
}

function cleanOverride(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const pair of v) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [a, b] = pair.map(cleanTime);
    if (a && b && a < b) out.push([a, b]);
  }
  return out;
}

const PARKING = ['free', 'paid', 'none', 'unknown'];
const PHOTO_RE = /^photos\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(jpe?g|png|webp)$/i;

function cleanLocation(v) {
  if (!isPlainObject(v)) return null;
  const { lat, lng } = v;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return v.approx === true ? { lat, lng, approx: true } : { lat, lng };
}

function cleanParking(v) {
  if (!isPlainObject(v) || !PARKING.includes(v.status)) return null;
  const note = typeof v.note === 'string' ? v.note.trim() : '';
  return note ? { status: v.status, note } : { status: v.status };
}

const cleanPhoto = (v) => (typeof v === 'string' && PHOTO_RE.test(v) && !v.includes('..') ? v : null);

function getWinter(v) {
  if (!isPlainObject(v) || !v.type) return { type: 'none' };
  if (!['none', 'closed', 'changed'].includes(v.type)) return { type: 'none' };
  const { indoor_note, ...rest } = v;
  const note = typeof indoor_note === 'string' ? indoor_note.trim() : '';
  return { ...(rest.hours === undefined ? rest : { ...rest, hours: cleanHours(rest.hours) }), ...(note ? { indoor_note: note } : {}) };
}

function getExceptions(v) {
  if (!isPlainObject(v)) return { closed_dates: [], rain_rule: false };
  const closed_dates = getStringArray(v.closed_dates);
  const rain_rule = typeof v.rain_rule === 'boolean' ? v.rain_rule : false;
  return { closed_dates, rain_rule };
}

export function normalizeWall(raw) {
  if (!isPlainObject(raw)) {
    return {
      region: '',
      height_m: null,
      tags: [],
      memo: '',
      checked_at: null,
      hours: {},
      winter: { type: 'none' },
      exceptions: { closed_dates: [], rain_rule: false },
      contact: {},
      sun: {},
      name: '',
    };
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const tags = getStringArray(raw.tags);
  const hours = cleanHours(raw.hours);
  const winter = getWinter(raw.winter);
  const exceptions = getExceptions(raw.exceptions);
  const contact = cleanContact(raw.contact);
  const sun = getPlainObject(raw.sun);
  const region = typeof raw.region === 'string' ? raw.region : '';
  const memo = typeof raw.memo === 'string' ? raw.memo : '';
  const height_m = typeof raw.height_m === 'number' && isFinite(raw.height_m) ? raw.height_m : null;
  const checked_at = typeof raw.checked_at === 'string' ? raw.checked_at : null;

  const shadow = cleanShadow(raw.shadow);
  const sun_override = cleanOverride(raw.sun_override);
  const location = cleanLocation(raw.location);
  const parking = cleanParking(raw.parking);
  const photo = cleanPhoto(raw.photo);

  return {
    region,
    height_m,
    tags,
    memo,
    checked_at,
    hours,
    winter,
    exceptions,
    contact,
    sun,
    name,
    ...(shadow ? { shadow } : {}),
    ...(sun_override.length ? { sun_override } : {}),
    ...(location ? { location } : {}),
    ...(parking ? { parking } : {}),
    ...(photo ? { photo } : {}),
  };
}

// The edit form and CSV do not carry shadow / sun_override; keep them across a replace.
// A shadow is only valid for the coordinates it was computed for.
export function keepGeo(old, next) {
  if (!old) return next;
  const out = { ...next };
  if (!out.shadow && old.shadow && old.sun?.lat === out.sun?.lat && old.sun?.lng === out.sun?.lng) {
    out.shadow = old.shadow;
  }
  if (!out.sun_override && old.sun_override) out.sun_override = old.sun_override;
  // coordinates edited in sun.lat/lng win over a stored location; otherwise keep it
  if (!out.location && old.location
    && (!Number.isFinite(out.sun?.lat) || (old.sun?.lat === out.sun.lat && old.sun?.lng === out.sun.lng))) {
    out.location = old.location;
  }
  if (!out.photo && old.photo) out.photo = old.photo;
  return out;
}

export function mergeWalls(existing, incoming, mode) {
  const byName = new Map(existing.map((w) => [w.name, w]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const raw of incoming) {
    const w = normalizeWall(raw);
    if (!w.name) skipped++;
    else if (!byName.has(w.name)) {
      byName.set(w.name, w);
      added++;
    } else if (mode === 'overwrite') {
      byName.set(w.name, keepGeo(byName.get(w.name), w));
      updated++;
    } else {
      const old = byName.get(w.name);
      const fill = {};
      for (const k of ['location', 'parking', 'photo']) if (w[k] && !old[k]) fill[k] = w[k];
      // hours are only backfilled for walls that have none, so edited hours are never replaced
      if (!hasHours(old) && hasHours(w)) Object.assign(fill, { hours: w.hours, checked_at: w.checked_at, ...(w.winter?.type !== 'none' && !old.winter?.hours ? { winter: w.winter } : {}) });
      const shadowPart = w.shadow && !old.shadow ? { sun: { ...old.sun, ...w.sun }, shadow: w.shadow } : {};
      if (Object.keys(fill).length || shadowPart.shadow) {
        byName.set(w.name, { ...old, ...fill, ...shadowPart });
        updated++;
      } else skipped++;
    }
  }
  return { walls: [...byName.values()], added, updated, skipped };
}

export const exportJson = (walls) => JSON.stringify({ version: 1, walls }, null, 2);

export function parseJson(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data?.walls;
  if (!Array.isArray(list)) throw new Error('외벽 목록(walls 배열)이 없는 파일이에요');
  return list;
}

export function loadWalls(storage) {
  try {
    const raw = storage.getItem(KEY);
    return raw ? parseJson(raw).map(normalizeWall) : null;
  } catch {
    return null;
  }
}

export const saveWalls = (storage, walls) => storage.setItem(KEY, exportJson(walls));
