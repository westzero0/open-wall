import { cleanShadow } from './shadow.js';
import { hasHours, orderIntervals } from './hours.js';
import { cleanCounts } from './grades.js';
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
const CONTACT_KEYS = ['phone', 'instagram', 'naver_map', 'notice_url', 'chat_url'];
// A wall's 오픈채팅방: only a kakao open-chat room link (this value also arrives through visitor reports, so it is held to one host).
export const CHAT_URL_RE = /^https:\/\/open\.kakao\.com\/o\/[A-Za-z0-9_-]{3,40}$/;

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

// contact.reserve = { name?, url }: a reservation site (http/https only, no spaces); no usable url = no reserve.
export const HTTP_URL_RE = /^https?:\/\/\S+$/i;
function cleanReserve(v) {
  const r = getPlainObject(v);
  const url = typeof r.url === 'string' ? r.url.trim() : '';
  if (!HTTP_URL_RE.test(url) || url.length > 500) return null;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 20) : '';
  return { ...(name ? { name } : {}), url };
}

function cleanContact(v) {
  const out = {};
  for (const k of CONTACT_KEYS) {
    const s = getPlainObject(v)[k];
    if (typeof s !== 'string' || !s.trim()) continue;
    if (k === 'chat_url') {
      if (CHAT_URL_RE.test(s.trim())) out[k] = s.trim();
    } else out[k] = s;
  }
  const reserve = cleanReserve(getPlainObject(v).reserve);
  if (reserve) out.reserve = reserve;
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

// Text caps: well above the longest real value (name 17, region 7, memo 443, parking note 76) so shipped data is never cut, but a wall from an import or the editor can't grow without bound.
export const MAX_NAME = 40;
export const MAX_REGION = 40;
export const MAX_MEMO = 600;
export const MAX_ADDRESS = 200;
export const MAX_METERS = 500;
// 폭: 15 / '15.5' → a number in (0, 500] rounded to 0.1; anything else → null (the key is dropped)
export const MAX_INDOOR_HEIGHT = 200;
export function cleanMeters(v, max = MAX_METERS) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
  const r = Math.round(n * 10) / 10;
  return r > 0 && r <= max ? r : null;
}
export const MAX_PARKING_NOTE = 200;
export const MAX_PARKING_FEE = 80;
export const MAX_PARKING_LOTS = 6;
export const MAX_PARKING_LOT_NAME = 40;
const PARKING = ['free', 'paid', 'none', 'unknown'];
export const PHOTO_RE = /^photos\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(jpe?g|png|webp)$/i;
// A wall's own stamp artwork (src/stamp.js): an svg under data/stamps/, never a path that can leave it.
export const STAMP_RE = /^stamps\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.svg$/;

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

// Lot names for the 외벽 앞 / 주변 lines; ';' is the CSV list separator, so it never stays inside a name.
const cleanLots = (v) => (Array.isArray(v)
  ? v.filter((s) => typeof s === 'string').map((s) => s.replaceAll(';', ',').trim().slice(0, MAX_PARKING_LOT_NAME).trim()).filter(Boolean).slice(0, MAX_PARKING_LOTS)
  : []);

// parking.rate (src/parking-rate.js): whole numbers in a sane range, chips as short text; anything else is dropped. An empty rule is no rule.
const cleanInt = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);
const cleanBlock = (v) => {
  const min = isPlainObject(v) ? cleanInt(v.min, 1440) : null;
  const won = isPlainObject(v) ? cleanInt(v.won, 1000000) : null;
  return min > 0 && won != null ? { min, won } : null;
};
export function cleanRate(v) {
  if (!isPlainObject(v)) return null;
  const out = {};
  const free = cleanInt(v.free_min, 1440);
  if (free) out.free_min = free;
  const first = cleanBlock(v.first);
  if (first) out.first = first;
  const step = cleanBlock(v.step);
  if (step) out.step = step;
  const tiers = (Array.isArray(v.tiers) ? v.tiers : []).slice(0, 8)
    .map((t) => (isPlainObject(t) && cleanInt(t.upto, 1440) > 0 && cleanInt(t.won, 1000000) != null ? { upto: t.upto, won: t.won } : null)).filter(Boolean);
  if (tiers.length) out.tiers = tiers;
  for (const k of ['day_flat', 'day_max']) { const n = cleanInt(v[k], 1000000); if (n != null) out[k] = n; }
  const conditions = (Array.isArray(v.conditions) ? v.conditions : []).filter((s) => typeof s === 'string').map((s) => s.trim().slice(0, 30)).filter(Boolean).slice(0, 4);
  if (conditions.length) out.conditions = conditions;
  return Object.keys(out).length ? out : null;
}
function cleanCost(v) {
  if (!isPlainObject(v)) return null;
  const out = {};
  for (const k of ['h3', 'h5', 'h8', 'day']) { const n = cleanInt(v[k], 1000000); if (n != null) out[k] = n; }
  return Object.keys(out).length ? out : null;
}

// parking.lots: the lots with a price or a walk: { name, walk_min?, rate? }. The names also read as 주변 on the card, so a lot is kept in one of the lists.
export function cleanPricedLots(v) {
  return (Array.isArray(v) ? v : []).slice(0, MAX_PARKING_LOTS).map((l) => {
    if (!isPlainObject(l) || typeof l.name !== 'string') return null;
    const name = l.name.replaceAll(';', ',').trim().slice(0, MAX_PARKING_LOT_NAME).trim();
    if (!name) return null;
    const walk = cleanInt(l.walk_min, 120);
    const rate = cleanRate(l.rate);
    return { name, ...(walk ? { walk_min: walk } : {}), ...(rate ? { rate } : {}) };
  }).filter(Boolean);
}

function cleanParking(v) {
  if (!isPlainObject(v) || !PARKING.includes(v.status)) return null;
  const note = typeof v.note === 'string' ? v.note.trim().slice(0, MAX_PARKING_NOTE) : '';
  const fee = typeof v.fee === 'string' ? v.fee.trim().slice(0, MAX_PARKING_FEE) : ''; // the price in one line, apart from the lot names
  const onsite = cleanLots(v.onsite);
  const nearby = cleanLots(v.nearby);
  const rate = cleanRate(v.rate);
  const cost = cleanCost(v.cost);
  const lots = cleanPricedLots(v.lots);
  const checked_at = isDateStr(v.checked_at) ? v.checked_at : null; // the parking's own check date (the wall's checked_at is its hours')
  return { status: v.status, ...(note ? { note } : {}), ...(fee ? { fee } : {}), ...(onsite.length ? { onsite } : {}), ...(nearby.length ? { nearby } : {}), ...(rate ? { rate } : {}), ...(cost ? { cost } : {}), ...(lots.length ? { lots } : {}), ...(checked_at ? { checked_at } : {}) };
}

// indoor/outdoor: absent means 'outdoor' (the app is about outdoor walls); anything else is dropped
export const VENUES = ['outdoor', 'indoor', 'both'];
// 실내 시설 종류: the allowed values in their fixed display order; cleanIndoorKinds drops duplicates and anything else and sorts by this order
export const INDOOR_KINDS = ['리드', '지구력', '오토빌레이', '볼더링'];
export const cleanIndoorKinds = (v) => (Array.isArray(v) ? INDOOR_KINDS.filter((k) => v.includes(k)) : []);

const cleanStamp = (v) => (typeof v === 'string' && STAMP_RE.test(v) && !v.includes('..') ? v : null);
const cleanPhoto = (v) => (typeof v === 'string' && PHOTO_RE.test(v) && !v.includes('..') ? v : null);

// 사진 여러 장: at most MAX_PHOTOS of { src, credit?, date?, main? } in the order they were approved (oldest first), one at most `main`.
// `photo` / `photo_credit` stay as the card's first picture (the main one, else the newest), so a reader of the single photo keeps working.
export const MAX_PHOTOS = 10;
function cleanPhotos(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const p of v) {
    const src = isPlainObject(p) ? cleanPhoto(p.src) : null;
    if (!src || out.some((x) => x.src === src)) continue;
    const credit = cleanCredit(p.credit);
    out.push({ src, ...(credit ? { credit } : {}), ...(isDateStr(p.date) ? { date: p.date } : {}), ...(p.main === true && !out.some((x) => x.main) ? { main: true } : {}) });
    if (out.length === MAX_PHOTOS) break;
  }
  return out;
}
/** coverOf(photos) → the item the card shows first: the main one, else the newest; undefined for none. */
export const coverOf = (photos) => photos.find((p) => p.main) ?? photos[photos.length - 1];

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

// sun_note: one line under the sun verdict for a wall whose walls face different ways ("벽 3개: …, 판정은 메인벽 기준"). A top-level field, not inside `sun`, so editing the facing never drops it.
export const MAX_SUN_NOTE = 80;
const cleanSunNote = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_SUN_NOTE) : '');

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

// rope_m: the wall's own (official) rope length in metres, one of the lengths people carry; it replaces the height-based guess on the card.
// Anything else is dropped (no rope_m → the card works it out from the wall height).
export const ROPE_LENGTHS = [40, 45, 50, 60, 70];
const cleanRope = (v) => (ROPE_LENGTHS.includes(v) ? v : null);

// suspended: 임시 휴관 중 with no end date, { since?: 'YYYY-MM-DD', note?: short reason }. An object (even empty) means
// suspended; anything else means not. Removing it brings the wall back to its timetable.
export const MAX_SUSPENDED_NOTE = 60;
export function cleanSuspended(v) {
  if (!isPlainObject(v)) return null;
  const note = typeof v.note === 'string' ? v.note.trim().slice(0, MAX_SUSPENDED_NOTE) : '';
  return { ...(isDateStr(v.since) ? { since: v.since } : {}), ...(note ? { note } : {}) };
}

// seasons: [{from_month, to_month, hours}] — bad entries dropped (bad months, hours that are not an object)
function cleanSeasons(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((s) => isPlainObject(s) && isMonth(s.from_month) && isMonth(s.to_month) && isPlainObject(s.hours))
    .map((s) => ({ from_month: s.from_month, to_month: s.to_month, hours: cleanHours(s.hours) }))
    .filter((s) => Object.keys(s.hours).length);
}

// fees: [{item, adult?, youth?, child?, groups?: [{label, adult?, youth?, child?}], note?}], each who = {all} or {weekday?, weekend?} in won (integers >= 0);
// bad numbers/groups dropped, an item with no price and no note dropped; discount: one line of text.
export const MAX_FEES = 20;
const MAX_FEE_TEXT = 40;
const MAX_FEE_NOTE = 120;
const MAX_FEE_TIMES = 60;
export const MAX_FEE_GROUPS = 4; // groups: one item priced per 거주지 (관외 / 관내, 시민 / 타시민): a short label, then the same who prices
export const MAX_GROUP_LABEL = 10;
const MAX_DISCOUNT = 160;
const MAX_WON = 10_000_000;
const cleanWon = (n) => (Number.isInteger(n) && n >= 0 && n <= MAX_WON ? n : undefined);
function cleanWho(v) {
  if (!isPlainObject(v)) return null;
  const out = {};
  for (const k of ['all', 'weekday', 'weekend']) if (cleanWon(v[k]) !== undefined) out[k] = v[k];
  if (out.all !== undefined) return { all: out.all }; // "all" says weekday and weekend are the same
  return Object.keys(out).length ? out : null;
}
// times: when the sessions run ("1부 13~17시 · 2부 18~22시"), {all} or {weekday?, weekend?}, one short line each
function cleanTimes(v) {
  if (!isPlainObject(v)) return null;
  const t = {};
  for (const k of ['all', 'weekday', 'weekend']) if (typeof v[k] === 'string' && v[k].trim()) t[k] = v[k].trim().slice(0, MAX_FEE_TIMES);
  if (t.all !== undefined) return { all: t.all };
  return Object.keys(t).length ? t : null;
}
function cleanGroups(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const g of v) {
    if (!isPlainObject(g) || typeof g.label !== 'string' || !g.label.trim()) continue;
    const row = { label: g.label.trim().slice(0, MAX_GROUP_LABEL) };
    for (const who of ['adult', 'youth', 'child']) {
      const w = cleanWho(g[who]);
      if (w) row[who] = w;
    }
    if (row.adult || row.youth || row.child) out.push(row);
    if (out.length === MAX_FEE_GROUPS) break;
  }
  return out;
}
function cleanFees(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const f of v) {
    if (!isPlainObject(f) || typeof f.item !== 'string' || !f.item.trim()) continue;
    const row = { item: f.item.trim().slice(0, MAX_FEE_TEXT) };
    for (const who of ['adult', 'youth', 'child']) {
      const w = cleanWho(f[who]);
      if (w) row[who] = w;
    }
    const groups = cleanGroups(f.groups);
    if (groups.length) row.groups = groups;
    const times = cleanTimes(f.times);
    if (times) row.times = times;
    const note = typeof f.note === 'string' ? f.note.trim().slice(0, MAX_FEE_NOTE) : '';
    if (note) row.note = note;
    if (row.adult || row.youth || row.child || row.groups || row.times || row.note) out.push(row);
    if (out.length === MAX_FEES) break;
  }
  return out;
}
const cleanDiscount = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_DISCOUNT) : '');

export const isDateStr = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().startsWith(s);
};

// [{ day: 'sun', nth: [2, 4] }] = 둘째·넷째 일요일 휴무. nth 1–5, or -1 = the month's last one (매월 마지막 주 월요일);
// sorted (-1 last), no repeats; bad entries dropped, entries of the same day merged.
function cleanNthClosed(v) {
  if (!Array.isArray(v)) return [];
  const byDay = new Map();
  for (const r of v) {
    if (!isPlainObject(r) || !DAYS.includes(r.day) || !Array.isArray(r.nth)) continue;
    const nth = r.nth.filter((n) => Number.isInteger(n) && (n === -1 || (n >= 1 && n <= 5)));
    if (nth.length) byDay.set(r.day, [...(byDay.get(r.day) ?? []), ...nth]);
  }
  return [...byDay].map(([day, nth]) => ({ day, nth: [...new Set(nth)].sort((a, b) => (a === -1) - (b === -1) || a - b) }));
}

function getExceptions(v) {
  if (!isPlainObject(v)) return { closed_dates: [], rain_rule: false };
  const closed_dates = Array.isArray(v.closed_dates) ? v.closed_dates.filter(isDateStr) : [];
  const rain_rule = typeof v.rain_rule === 'boolean' ? v.rain_rule : false;
  const nth_closed = cleanNthClosed(v.nth_closed);
  return { closed_dates, rain_rule, ...(nth_closed.length ? { nth_closed } : {}) };
}

// 세팅일: { last?, next? } as real calendar dates ('YYYY-MM-DD'); anything else is dropped key by key, null when both are gone.
export function cleanSetting(v) {
  if (!isPlainObject(v)) return null;
  const out = {};
  for (const k of ['last', 'next']) if (isDateStr(v[k])) out[k] = v[k];
  return Object.keys(out).length ? out : null;
}

// 루트 분포: [{ checked: 'YYYY-MM-DD', counts: { '10a': 4 } }] or, by wall section, { checked, walls: [{ name, counts }] } (the total is
// computed, never stored). Newest first, at most 12; a snapshot with no date or nothing counted is dropped; no valid snapshot = no field.
export const MAX_ROUTE_SETS = 12;
export const MAX_ROUTE_WALLS = 8;
export const MAX_ROUTE_WALL_NAME = 10;
function cleanRouteWalls(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const w of v) {
    if (!isPlainObject(w) || typeof w.name !== 'string') continue;
    const name = [...w.name.normalize('NFC').replace(/\s+/g, ' ').trim()].slice(0, MAX_ROUTE_WALL_NAME).join('').trim(); // by characters, not UTF-16 halves
    const counts = cleanCounts(w.counts);
    const venue = w.venue === 'indoor' || w.venue === 'outdoor' ? w.venue : null; // which kind of wall this section is; absent = not said
    const id = `${venue ?? ''}|${name}`; // the same name may repeat across kinds (실내 리드벽 / 실외 리드벽)
    if (!name || seen.has(id) || !Object.keys(counts).length) continue;
    seen.add(id);
    out.push({ name, counts, ...(venue ? { venue } : {}) });
    if (out.length === MAX_ROUTE_WALLS) break;
  }
  return out;
}
export function cleanRouteSets(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const s of v) {
    if (!isPlainObject(s) || !isDateStr(s.checked)) continue;
    const walls = cleanRouteWalls(s.walls);
    const counts = cleanCounts(s.counts);
    if (walls.length) out.push({ checked: s.checked, walls });
    else if (Object.keys(counts).length) out.push({ checked: s.checked, counts });
  }
  return out.sort((a, b) => (a.checked < b.checked ? 1 : a.checked > b.checked ? -1 : 0)).slice(0, MAX_ROUTE_SETS);
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

  const name = typeof raw.name === 'string' ? raw.name.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
  const tags = getStringArray(raw.tags);
  const hours = cleanHours(raw.hours);
  const winter = getWinter(raw.winter);
  const seasons = cleanSeasons(raw.seasons);
  const suspended = cleanSuspended(raw.suspended);
  const rope_m = cleanRope(raw.rope_m);
  const fees = cleanFees(raw.fees);
  const discount = fees.length ? cleanDiscount(raw.discount) : ''; // a discount line belongs to a fee table
  const exceptions = getExceptions(raw.exceptions);
  const contact = cleanContact(raw.contact);
  const sun = cleanSun(raw.sun);
  const sun_note = cleanSunNote(raw.sun_note);
  const region = typeof raw.region === 'string' ? raw.region.slice(0, MAX_REGION) : '';
  const memo = typeof raw.memo === 'string' ? raw.memo.slice(0, MAX_MEMO) : '';
  // address: one line (the card's 주소 row and the geocoder read it before a memo "주소 …" line); anything that is not a non-empty string drops the key
  const address = typeof raw.address === 'string' ? raw.address.normalize('NFC').replace(/[\x00-\x1f\x7f\s]+/g, ' ').trim().slice(0, MAX_ADDRESS).trim() : '';
  const height_m = typeof raw.height_m === 'number' && isFinite(raw.height_m) ? raw.height_m : null;
  const width_m = cleanMeters(raw.width_m);
  const indoor_height_m = cleanMeters(raw.indoor_height_m, MAX_INDOOR_HEIGHT); // only meaningful for venue 'both' (for 'indoor' height_m is the indoor wall), but kept as data whatever the venue
  const checked_at = typeof raw.checked_at === 'string' ? raw.checked_at : null;
  const notice_checked_at = isDateStr(raw.notice_checked_at) ? raw.notice_checked_at : null; // the notice address's own check date (the hours' is checked_at)

  const shadow = cleanShadow(raw.shadow);
  const sun_override = cleanOverride(raw.sun_override);
  const location = cleanLocation(raw.location);
  const parking = cleanParking(raw.parking);
  const photos = cleanPhotos(raw.photos);
  const cover = coverOf(photos); // with a photos list, photo and photo_credit follow its cover and never disagree with it
  const photo = cover ? cover.src : cleanPhoto(raw.photo);
  const stamp = cleanStamp(raw.stamp);
  const photo_credit = cover ? cover.credit ?? null : photo ? cleanCredit(raw.photo_credit) : null;
  const short_name = typeof raw.short_name === 'string' ? raw.short_name.trim() : '';
  const venue = VENUES.includes(raw.venue) ? raw.venue : null;
  const indoor_kinds = cleanIndoorKinds(raw.indoor_kinds);
  // optional indoor timetable of a wall with an indoor part ('both'); same shapes as hours / winter
  const indoor_hours = isPlainObject(raw.indoor_hours) ? cleanHours(raw.indoor_hours) : {};
  const indoor_winter = getWinter(raw.indoor_winter);
  const holiday = HOLIDAY_RULES.includes(raw.holiday) ? raw.holiday : null;
  const blog_posts = cleanBlogPosts(raw.blog_posts);
  const setting = cleanSetting(raw.setting);
  const route_sets = cleanRouteSets(raw.route_sets);

  return {
    region,
    height_m,
    ...(width_m ? { width_m } : {}),
    ...(indoor_height_m ? { indoor_height_m } : {}),
    tags,
    memo,
    ...(address ? { address } : {}),
    checked_at,
    ...(notice_checked_at ? { notice_checked_at } : {}),
    hours,
    winter,
    exceptions,
    contact,
    sun,
    name,
    ...(seasons.length ? { seasons } : {}),
    ...(suspended ? { suspended } : {}),
    ...(rope_m ? { rope_m } : {}),
    ...(sun_note ? { sun_note } : {}),
    ...(fees.length ? { fees } : {}),
    ...(discount ? { discount } : {}),
    ...(shadow ? { shadow } : {}),
    ...(sun_override.length ? { sun_override } : {}),
    ...(location ? { location } : {}),
    ...(parking ? { parking } : {}),
    ...(photo ? { photo } : {}),
    ...(photos.length ? { photos } : {}),
    ...(stamp ? { stamp } : {}),
    ...(photo_credit ? { photo_credit } : {}),
    ...(short_name && short_name.length <= 20 ? { short_name } : {}),
    ...(venue ? { venue } : {}),
    ...(indoor_kinds.length ? { indoor_kinds } : {}),
    ...(Object.keys(indoor_hours).length ? { indoor_hours } : {}),
    ...(indoor_winter.type !== 'none' ? { indoor_winter } : {}),
    ...(holiday ? { holiday } : {}),
    ...(blog_posts.length ? { blog_posts } : {}),
    ...(setting ? { setting } : {}),
    ...(route_sets.length ? { route_sets } : {}),
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
  // a CSV carries no fee rule: keep the stored one while the fee wording it was made from is unchanged (an edited fee means the rule may be stale)
  if (out.parking && old.parking && out.parking.status === old.parking.status && out.parking.fee === old.parking.fee) {
    const kept = Object.fromEntries(['rate', 'cost', 'lots', 'checked_at'].filter((k) => old.parking[k] !== undefined && out.parking[k] === undefined).map((k) => [k, old.parking[k]]));
    if (Object.keys(kept).length) out.parking = { ...out.parking, ...kept };
  }
  if (!out.photo && old.photo) {
    out.photo = old.photo;
    if (old.photos) out.photos = old.photos;
    if (old.photo_credit) out.photo_credit = old.photo_credit;
  } else if (out.photo === old.photo) { // the same cover coming back (an older export) keeps the stored gallery and credit
    if (!out.photos && old.photos) out.photos = old.photos;
    if (!out.photo_credit && old.photo_credit) out.photo_credit = old.photo_credit;
  }
  if (!out.short_name && old.short_name) out.short_name = old.short_name;
  if (!out.venue && old.venue) out.venue = old.venue; // an older CSV without 구분 keeps the stored one
  if (!out.indoor_kinds && old.indoor_kinds) out.indoor_kinds = old.indoor_kinds; // so does one without 실내종류
  if (!out.contact?.chat_url && old.contact?.chat_url) out.contact = { ...out.contact, chat_url: old.contact.chat_url }; // so does one without 오픈채팅
  if (!out.contact?.reserve && old.contact?.reserve) out.contact = { ...out.contact, reserve: old.contact.reserve }; // and one without 예약
  for (const k of ['sun_note', 'indoor_hours', 'indoor_winter', 'seasons', 'fees', 'discount', 'blog_posts', 'stamp', 'address', 'width_m', 'indoor_height_m', 'rope_m', 'route_sets']) if (!out[k] && old[k]) out[k] = old[k]; // not in the CSV/form
  // an older CSV without 공휴일/격주휴무 (or the cells left empty) keeps the stored rules
  if (!out.holiday && old.holiday) out.holiday = old.holiday;
  if (!out.exceptions?.nth_closed && old.exceptions?.nth_closed) out.exceptions = { ...out.exceptions, nth_closed: old.exceptions.nth_closed };
  // 세팅일: the form doesn't carry it and a CSV may leave 세팅일/다음세팅 out or empty; each date left out keeps the stored one
  if (old.setting) out.setting = { ...old.setting, ...out.setting };
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
      for (const k of ['sun_note', 'location', 'parking', 'photo', 'short_name', 'venue', 'indoor_kinds', 'indoor_hours', 'indoor_winter', 'seasons', 'fees', 'discount', 'blog_posts', 'address', 'width_m', 'indoor_height_m', 'rope_m', 'route_sets']) if (w[k] && !old[k]) fill[k] = w[k];
      if (fill.photo && w.photo_credit) fill.photo_credit = w.photo_credit;
      if (fill.photo && w.photos) fill.photos = w.photos;
      if (w.contact.reserve && !old.contact?.reserve) fill.contact = { ...old.contact, reserve: w.contact.reserve }; // an edited reserve stays
      // holiday / nth closures fill only walls that have none (an edited rule stays)
      if (w.holiday && !old.holiday) fill.holiday = w.holiday;
      if (w.exceptions.nth_closed && !old.exceptions?.nth_closed) fill.exceptions = { ...old.exceptions, nth_closed: w.exceptions.nth_closed };
      // 세팅일: only the dates this wall lacks (a date the user set stays)
      if (w.setting && (!old.setting || Object.keys(w.setting).some((k) => !old.setting[k]))) fill.setting = { ...w.setting, ...old.setting };
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
  const r = await fetchFn('data/national.json', { cache: 'no-cache' }); // revalidate (304 is cheap): Pages' max-age=600 would show a data deploy up to 10 minutes late
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
