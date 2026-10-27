// src/gear.js — 근처 장비점 (data/partners.json): 정제, 거리 필터·정렬, 로드. DOM 없음.
// 정보 영역(info)은 무료·대가 없음, 광고·제휴 영역(sponsored)은 대가를 받는 업체만(시범에서는 비어 있음).
// 순위·가중치 필드는 없다: 정렬은 암장 좌표에서 업체까지의 거리순(같으면 가나다순). 이용자 위치는 쓰지 않는다.
import { config } from './config.js';
import { distanceKm } from './viewmodel.js';

export const GEAR_RADIUS_KM = 7;
export const KINDS = ['장비점'];
const ID_RE = /^[a-z0-9-]{1,24}$/;
const EMPTY = () => ({ info: [], sponsored: [] });

const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

/** One partner entry, or null when it cannot be shown. The input is not trusted (the file is a plain JSON in the public site). */
export function normalizeGear(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { id, name, kind, note, lat, lng } = raw;
  const mapUrl = safeUrl(raw.mapUrl), storeUrl = safeUrl(raw.storeUrl);
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  if (typeof name !== 'string' || !name.trim() || name.length > 30) return null;
  if (!KINDS.includes(kind)) return null;
  if (!mapUrl && !storeUrl) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { id, name: name.trim(), kind, note: typeof note === 'string' && note.length <= 40 ? note : '', mapUrl, storeUrl, lat, lng };
}

const list = (raw) => {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).map(normalizeGear).filter((g) => g && !seen.has(g.id) && seen.add(g.id));
};

export function normalizePartners(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY();
  const sponsored = list(raw.sponsored);
  const paid = new Set(sponsored.map((g) => g.id));
  return { info: list(raw.info).filter((g) => !paid.has(g.id)), sponsored }; // a shop that pays is shown once, in the marked zone
}

/** The compass bearing from `from` to `to` ({lat, lng}), degrees clockwise from north, 0 ≤ b < 360 (flat-earth: fine for a few km). */
export function bearingDeg(from, to) {
  const dy = to.lat - from.lat;
  const dx = (to.lng - from.lng) * Math.cos(((from.lat + to.lat) / 2) * Math.PI / 180);
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}

export const SKETCH = { w: 343, h: 168, cx: 171.5, cy: 84, rx: 112, ry: 38 }; // the 약도's box; the points stay inside rx/ry so a label never leaves it or meets the north mark
/**
 * The 약도 (a sketch, not a map): the wall and the shop on a line whose DIRECTION is the real bearing (north up) and whose length is fixed (the
 * distance is told in km, not drawn). → { wall: {x, y}, shop: {x, y}, wallAbove, shopAbove }: points in the sketch's box; `Above` = the label goes
 * above its point (the point is the upper end of the line), else below (a level line puts both labels below).
 */
export function sketchLayout(bearing) {
  const t = bearing * Math.PI / 180, vx = Math.sin(t), vy = -Math.cos(t); // screen y grows downward: north is up
  const k = Math.min(Math.abs(vx) > 1e-6 ? SKETCH.rx / Math.abs(vx) : Infinity, Math.abs(vy) > 1e-6 ? SKETCH.ry / Math.abs(vy) : Infinity);
  const r1 = (n) => Math.round(n * 10) / 10;
  const wall = { x: r1(SKETCH.cx - vx * k), y: r1(SKETCH.cy - vy * k) }, shop = { x: r1(SKETCH.cx + vx * k), y: r1(SKETCH.cy + vy * k) };
  const level = Math.abs(vy) < 0.2;
  return { wall, shop, wallAbove: !level && wall.y < shop.y, shopAbove: !level && shop.y < wall.y };
}

/** The entries within radiusKm of `position` ({lat, lng}, a wall's), nearest first; same distance → 가나다순. */
export function nearGear(partners, position, radiusKm = GEAR_RADIUS_KM) {
  if (!position) return [];
  return partners
    .map((g) => ({ ...g, km: distanceKm(position, g), bearing: bearingDeg(position, g) }))
    .filter((g) => g.km <= radiusKm)
    .sort((a, b) => a.km - b.km || a.name.localeCompare(b.name, 'ko'));
}

/** Read data/partners.json; any failure (offline, 404, bad JSON) is simply "no partners". */
export async function loadPartners(fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(config.data.partners, { credentials: 'omit' });
    if (!res?.ok) return EMPTY();
    return normalizePartners(await res.json());
  } catch { return EMPTY(); }
}

/**
 * What the 근처 tab shows, as plain data: one section per zone, the free info zone first (never marked), then the paid zone (always
 * marked 광고·제휴, drawn apart). An empty zone is left out; both empty → null. `info`/`sponsored` come from nearGear (nearest first).
 */
export function gearModel(info = [], sponsored = []) {
  const zones = [];
  for (const kind of KINDS) {
    const items = (info ?? []).filter((g) => g.kind === kind);
    if (items.length) zones.push({ title: kind, sponsored: false, mark: null, items });
  }
  for (const kind of KINDS) {
    const items = (sponsored ?? []).filter((g) => g.kind === kind);
    if (items.length) zones.push({ title: kind, sponsored: true, mark: '광고·제휴', items });
  }
  return zones.length ? zones : null;
}

/**
 * The card's one line under 주차: the nearest shop and its distance, "클라임러버 · 5.1km"; with more than one, "클라임러버 외 1곳 · 5.1km부터".
 * `info`/`sponsored` come from nearGear (nearest first). The nearest of both zones leads; null when there is none.
 */
export function gearLine(info = [], sponsored = []) {
  const all = [...(info ?? []), ...(sponsored ?? [])].sort((a, b) => a.km - b.km || a.name.localeCompare(b.name, 'ko'));
  if (!all.length) return null;
  const km = (n) => (n < 1 ? `${Math.round(n * 1000)}m` : `${n.toFixed(1)}km`);
  const [first] = all;
  return all.length === 1 ? `${first.name} · ${km(first.km)}` : `${first.name} 외 ${all.length - 1}곳 · ${km(first.km)}부터`;
}
