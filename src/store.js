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

function cleanCredit(v) {
  if (!isPlainObject(v) || typeof v.text !== 'string' || !v.text.trim()) return null;
  const out = { text: v.text.trim().slice(0, 60) };
  if (typeof v.license === 'string' && v.license.trim()) out.license = v.license.trim().slice(0, 30);
  if (typeof v.url === 'string' && /^https:\/\//i.test(v.url)) out.url = v.url;
  return out;
}

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

// indoor/outdoor: absent means 'outdoor' (the app is about outdoor walls); anything else is dropped
export const VENUES = ['outdoor', 'indoor', 'both'];

const cleanPhoto = (v) => (typeof v === 'string' && PHOTO_RE.test(v) && !v.includes('..') ? v : null);

// 내 블로그 후기: at most 3 {title, url, date}; only https://blog.naver.com/caramelsnow/<digits> links survive
export const BLOG_URL_RE = /^https:\/\/blog\.naver\.com\/caramelsnow\/\d+$/;

function cleanBlogPosts(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const p of v) {
    if (!isPlainObject(p) || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 120) continue;
    if (!isDateStr(p.date) || typeof p.url !== 'string' || !BLOG_URL_RE.test(p.url)) continue;
    out.push({ title: p.title.trim(), url: p.url, date: p.date });
    if (out.length === 3) break;
  }
  return out;
}

const FACINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function cleanSun(v) {
  const s = getPlainObject(v);
  const out = {};
  if (typeof s.facing === 'string' && FACINGS.includes(s.facing)) out.facing = s.facing;
  if (Number.isFinite(s.lat) && Math.abs(s.lat) <= 90) out.lat = s.lat;
  if (Number.isFinite(s.lng) && Math.abs(s.lng) <= 180) out.lng = s.lng;
  return out;
}

const isMonth = (m) => Number.isInteger(m) && m >= 1 && m <= 12;

function getWinter(v) {
  if (!isPlainObject(v) || !['closed', 'changed'].includes(v.type)) return { type: 'none' };
  if (!isMonth(v.from_month) || !isMonth(v.to_month)) return { type: 'none' }; // a season with no valid months would never apply
  const note = typeof v.indoor_note === 'string' ? v.indoor_note.trim() : '';
  return {
    type: v.type,
    from_month: v.from_month,
    to_month: v.to_month,
    ...(v.hours === undefined ? {} : { hours: cleanHours(v.hours) }),
    ...(note ? { indoor_note: note } : {}),
  };
}

export const isDateStr = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().startsWith(s);
};

// [{ day: 'sun', nth: [2, 4] }] = 둘째·넷째 일요일 휴무. nth 1–5, sorted, no repeats; bad entries dropped,
// entries of the same day merged.
function cleanNthClosed(v) {
  if (!Array.isArray(v)) return [];
  const byDay = new Map();
  for (const r of v) {
    if (!isPlainObject(r) || !DAYS.includes(r.day) || !Array.isArray(r.nth)) continue;
    const nth = r.nth.filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    if (nth.length) byDay.set(r.day, [...(byDay.get(r.day) ?? []), ...nth]);
  }
  return [...byDay].map(([day, nth]) => ({ day, nth: [...new Set(nth)].sort((a, b) => a - b) }));
}

function getExceptions(v) {
  if (!isPlainObject(v)) return { closed_dates: [], rain_rule: false };
  const closed_dates = Array.isArray(v.closed_dates) ? v.closed_dates.filter(isDateStr) : [];
  const rain_rule = typeof v.rain_rule === 'boolean' ? v.rain_rule : false;
  const nth_closed = cleanNthClosed(v.nth_closed);
  return { closed_dates, rain_rule, ...(nth_closed.length ? { nth_closed } : {}) };
}

// Public holidays: 'weekend' (Saturday's hours), 'closed', 'weekday' (the weekday's own hours); absent = not known.
export const HOLIDAY_RULES = ['weekend', 'closed', 'weekday'];

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

  const name = typeof raw.name === 'string' ? raw.name.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
  const tags = getStringArray(raw.tags);
  const hours = cleanHours(raw.hours);
  const winter = getWinter(raw.winter);
  const exceptions = getExceptions(raw.exceptions);
  const contact = cleanContact(raw.contact);
  const sun = cleanSun(raw.sun);
  const region = typeof raw.region === 'string' ? raw.region : '';
  const memo = typeof raw.memo === 'string' ? raw.memo : '';
  const height_m = typeof raw.height_m === 'number' && isFinite(raw.height_m) ? raw.height_m : null;
  const checked_at = typeof raw.checked_at === 'string' ? raw.checked_at : null;

  const shadow = cleanShadow(raw.shadow);
  const sun_override = cleanOverride(raw.sun_override);
  const location = cleanLocation(raw.location);
  const parking = cleanParking(raw.parking);
  const photo = cleanPhoto(raw.photo);
  const photo_credit = photo ? cleanCredit(raw.photo_credit) : null;
  const short_name = typeof raw.short_name === 'string' ? raw.short_name.trim() : '';
  const venue = VENUES.includes(raw.venue) ? raw.venue : null;
  // optional indoor timetable of a wall with an indoor part ('both'); same shapes as hours / winter
  const indoor_hours = isPlainObject(raw.indoor_hours) ? cleanHours(raw.indoor_hours) : {};
  const indoor_winter = getWinter(raw.indoor_winter);
  const holiday = HOLIDAY_RULES.includes(raw.holiday) ? raw.holiday : null;
  const blog_posts = cleanBlogPosts(raw.blog_posts);

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
    ...(photo_credit ? { photo_credit } : {}),
    ...(short_name && short_name.length <= 20 ? { short_name } : {}),
    ...(venue ? { venue } : {}),
    ...(Object.keys(indoor_hours).length ? { indoor_hours } : {}),
    ...(indoor_winter.type !== 'none' ? { indoor_winter } : {}),
    ...(holiday ? { holiday } : {}),
    ...(blog_posts.length ? { blog_posts } : {}),
  };
}

// The edit form and CSV do not carry shadow / sun_override; keep them across a replace (venue too when the row leaves it empty).
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
  if (!out.photo && old.photo) {
    out.photo = old.photo;
    if (old.photo_credit) out.photo_credit = old.photo_credit;
  } else if (!out.photo_credit && out.photo === old.photo && old.photo_credit) out.photo_credit = old.photo_credit;
  if (!out.short_name && old.short_name) out.short_name = old.short_name;
  if (!out.venue && old.venue) out.venue = old.venue; // an older CSV without 구분 keeps the stored one
  for (const k of ['indoor_hours', 'indoor_winter', 'blog_posts']) if (!out[k] && old[k]) out[k] = old[k]; // not in the CSV/form
  // an older CSV without 공휴일/격주휴무 (or the cells left empty) keeps the stored rules
  if (!out.holiday && old.holiday) out.holiday = old.holiday;
  if (!out.exceptions?.nth_closed && old.exceptions?.nth_closed) out.exceptions = { ...out.exceptions, nth_closed: old.exceptions.nth_closed };
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
      for (const k of ['location', 'parking', 'photo', 'short_name', 'venue', 'indoor_hours', 'indoor_winter', 'blog_posts']) if (w[k] && !old[k]) fill[k] = w[k];
      if (fill.photo && w.photo_credit) fill.photo_credit = w.photo_credit;
      // holiday / nth closures fill only walls that have none (an edited rule stays)
      if (w.holiday && !old.holiday) fill.holiday = w.holiday;
      if (w.exceptions.nth_closed && !old.exceptions?.nth_closed) fill.exceptions = { ...old.exceptions, nth_closed: w.exceptions.nth_closed };
      // hours are only backfilled for walls that have none, so edited hours are never replaced
      if (!hasHours(old) && hasHours(w)) {
        Object.assign(fill, { hours: w.hours, checked_at: w.checked_at });
        if (w.winter.type !== 'none' && (!old.winter || old.winter.type === 'none')) fill.winter = w.winter;
      }
      // sun: user-set facing / coordinates stay; the incoming ones only fill gaps (a shadow only with its own coordinates)
      const os = old.sun ?? {};
      const sun = { ...os };
      if (os.facing === undefined && w.sun.facing) sun.facing = w.sun.facing;
      if (os.lat === undefined && os.lng === undefined && w.sun.lat !== undefined) Object.assign(sun, { lat: w.sun.lat, lng: w.sun.lng });
      if (JSON.stringify(sun) !== JSON.stringify(os)) fill.sun = sun;
      if (w.shadow && !old.shadow && sun.lat === w.sun.lat && sun.lng === w.sun.lng) fill.shadow = w.shadow;
      if (Object.keys(fill).length) {
        byName.set(w.name, { ...old, ...fill });
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

// The shipped list. Anything but a non-empty list is an error, so a bad network never reads as "0 open".
export async function fetchNational(fetchFn = fetch) {
  const r = await fetchFn('data/national.json');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const list = parseJson(await r.text()).map(normalizeWall).filter((w) => w.name);
  if (!list.length) throw new Error('empty');
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
