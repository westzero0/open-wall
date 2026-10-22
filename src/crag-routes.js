// 자연암장 루트 목록·개념도(topo) 데이터: 믿지 않는 입력을 정제하고 표시용 도우미를 둔다(DOM 없음).
// 모양은 { version, crags: { [암장]: { areas?, topos, routes } } }. 정제 결과는 crags 객체만 돌려준다.
import { PHOTO_RE } from './store.js';

const ID_RE = /^r[0-9]+$/;
const MAX_ROUTES = 150;
const MAX_TOPOS = 6;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

function cleanRoute(v) {
  if (!isObj(v) || typeof v.id !== 'string' || !ID_RE.test(v.id)) return null;
  const name = str(v.name, 30);
  if (!name) return null;
  const r = { id: v.id, no: Number.isInteger(v.no) ? v.no : null, name };
  const grade = str(v.grade, 8), pioneer = str(v.pioneer, 40), area = str(v.area, 20);
  if (grade) r.grade = grade;
  for (const [k, max] of [['length_m', 400], ['quickdraws', 40], ['cams', 20]]) {
    const n = int(v[k], k === 'length_m' ? 1 : 0, max);
    if (n !== null) r[k] = n;
  }
  if (pioneer) r.pioneer = pioneer;
  if (area) r.area = area;
  return r;
}

function cleanTopo(v) {
  if (!isObj(v) || typeof v.image !== 'string' || !PHOTO_RE.test(v.image) || v.image.includes('..')) return null;
  const t = { image: v.image };
  for (const [k, max] of [['caption', 60], ['area', 20], ['credit', 40]]) {
    const s = str(v[k], max);
    if (s) t[k] = s;
  }
  return t;
}

const cleanList = (list, fn, max) => (Array.isArray(list) ? list.map(fn).filter(Boolean).slice(0, max) : []);

/** cleanCragRoutes(raw) → { [암장]: { areas?, topos, routes } }. raw는 { crags } 래퍼나 그 안쪽 객체. 결과는 프로토타입이 없는 객체(Object.hasOwn·in으로 접근). */
export function cleanCragRoutes(raw) {
  const src = isObj(raw) && isObj(raw.crags) ? raw.crags : raw;
  const out = Object.create(null); // 암장 이름이 __proto__여도 그냥 키로 담긴다
  if (!isObj(src)) return out;
  for (const [name, c] of Object.entries(src)) {
    if (!isObj(c)) continue;
    const routes = cleanList(c.routes, cleanRoute, MAX_ROUTES);
    const topos = cleanList(c.topos, cleanTopo, MAX_TOPOS);
    if (!routes.length && !topos.length) continue;
    const entry = { topos, routes };
    const areas = cleanList(c.areas, (a) => str(a, 20), 20);
    if (areas.length) entry.areas = areas;
    out[name] = entry;
  }
  return out;
}

/** no 오름차순, null은 뒤, 같으면 입력 순서(sort는 안정). */
export const sortRoutes = (routes) => [...routes].sort((a, b) => (a.no ?? Infinity) - (b.no ?? Infinity) || 0);

/** 그 열에 값이 하나라도 있으면 true. */
export function routeColumns(routes) {
  const has = (f) => routes.some(f);
  return {
    grade: has((r) => r.grade),
    length: has((r) => r.length_m != null),
    equip: has((r) => r.quickdraws != null || r.cams != null),
    pioneer: has((r) => r.pioneer),
  };
}

export function equipLabel(r) {
  const parts = [];
  if (r.quickdraws != null) parts.push(`퀵 ${r.quickdraws}`);
  if (r.cams != null) parts.push(`캠 ${r.cams}`);
  return parts.join(' · ') || '–';
}

/** 실패·잘못된 JSON이면 빈 객체. 예외 없음. */
export async function loadCragRoutes({ fetchFn = fetch, url = 'data/crag-routes.json' } = {}) {
  try {
    const res = await fetchFn(url, { credentials: 'omit' });
    return res.ok ? cleanCragRoutes(await res.json()) : {};
  } catch { return {}; /* no routes shown */ }
}
