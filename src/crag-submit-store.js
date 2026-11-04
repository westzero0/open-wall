// src/crag-submit-store.js — 이 기기에서 제보한 암장(최근 20개)과 서버 응답 행 검증. DOM 없음: 저장소 접근자는 호출자가 넘긴다(fill-store.js와 같다).
import { CRAG_KINDS, FACINGS, cleanCragName, cleanCragPin } from './crag-submit-fields.js';

export const CRAG_MINE_KEY = 'open-wall:crag-mine';
const MAX = 20;
export const CRAG_STATUSES = ['pending', 'approved', 'rejected', 'duplicate'];

/** one row → {id,name,kind,lat,lng,facing,status,created_at}, or null when it does not check out. */
export function cleanCragRow(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^[\w-]{1,64}$/.test(r.id)) return null;
  const name = cleanCragName(r.name);
  const pin = cleanCragPin(r.lat, r.lng);
  const facing = r.facing ?? null;
  if (!name || !pin || !CRAG_KINDS.includes(r.kind) || !CRAG_STATUSES.includes(r.status) || (facing !== null && !FACINGS.includes(facing))) return null;
  return { id: r.id, name, kind: r.kind, lat: pin.lat, lng: pin.lng, facing, status: r.status, created_at: Number.isFinite(r.created_at) ? r.created_at : 0 };
}

/** a server row → the stored fields plus nick (string, max 12) and visible (boolean, default true). */
export function cleanCragApiRow(r) {
  const c = cleanCragRow(r);
  return c && { ...c, nick: typeof r.nick === 'string' ? r.nick.slice(0, 12) : '', visible: r.visible !== false };
}

export const cleanMine = (raw) => (Array.isArray(raw) ? raw.map(cleanCragRow).filter(Boolean).slice(0, MAX) : []);

export function loadMine({ get }) {
  try { return cleanMine(JSON.parse(get(CRAG_MINE_KEY))); } catch { return []; }
}

export function saveMine({ set }, rows) {
  try { set(CRAG_MINE_KEY, JSON.stringify(cleanMine(rows))); } catch { /* full or blocked: the list is re-read from the server */ }
}
