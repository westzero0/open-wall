// src/crag-submit-fields.js — 새 암장 제보(docs/superpowers/specs/2026-11-02-crag-submit-design.md): 앱과 Worker가 같이 쓰는 입력 규칙. DOM·fetch 없음.
import { cleanLine } from './clean-line.js';
import { cleanFillValue, metersApart } from './fill-fields.js';

export const CRAG_KINDS = ['crag', 'wall', 'indoor'];
export const KIND_LABEL = { crag: '싱글피치 자연암장', wall: '인공외벽', indoor: '리드 가능 실내 센터' };
export const FACINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const NEAR_M = 300;
export const MAX_NAME = 20;
const RESERVED = ['운영자', '해벽', '희노애', '관리'];

const norm = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, '').toLowerCase();

/** 정제된 이름, 거절이면 ''. 한 글자 더 읽어 20자 초과는 자르지 않고 거절한다. */
export function cleanCragName(raw) {
  const s = cleanLine(raw, MAX_NAME + 1);
  if ([...s].length > MAX_NAME || RESERVED.some((w) => s.includes(w))) return '';
  return s;
}

export function cleanCragPin(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' ? cleanFillValue('location', { lat, lng }) : null;
}

export function cleanCragDraft(raw) {
  const name = cleanCragName(raw?.name);
  const pin = cleanCragPin(raw?.lat, raw?.lng);
  if (!name || !pin || !CRAG_KINDS.includes(raw?.kind)) return null;
  const facing = raw.facing ?? null;
  if (facing !== null && !FACINGS.includes(facing)) return null;
  return { name, kind: raw.kind, ...pin, facing };
}

const TEXT = { E: '오전 해', NE: '오전 해', SE: '오전 해', W: '오후 해', NW: '오후 해', SW: '오후 해', S: '낮 동안 해', N: '해가 거의 안 들어요' };
export function facingTendency(facing) {
  return TEXT[facing] ? { text: TEXT[facing], label: '방향 기준 · 지형 반영 전' } : null;
}

/** the places a new submission is compared with: every wall and every official single-pitch crag that has a pin (kind: 'crag'). */
export function knownFrom(walls, crags) {
  const at = (w) => { const p = w.location ?? w.sun; return Number.isFinite(p?.lat) && Number.isFinite(p?.lng) ? p : null; };
  const pick = (list, kind) => (list ?? []).flatMap((w) => { const p = at(w); return p ? [{ id: w.id ?? w.name, name: w.name, lat: p.lat, lng: p.lng, ...(kind ? { kind } : {}) }] : []; });
  return [...pick(walls), ...pick(crags, 'crag')];
}

export function nearbyKnown(point, known, m = NEAR_M) {
  return (Array.isArray(known) ? known : [])
    .map((k) => ({ name: k.name, id: k.id, ...(k.kind ? { kind: k.kind } : {}), dist: metersApart(point, k) }))
    .filter((k) => k.dist <= m)
    .sort((a, b) => a.dist - b.dist);
}

/** 비공개 목록과 겹치는가: 이름(정규화, 초안 이름이 목록 이름을 포함/일치; 반대 방향은 아님) 또는 핀이 항목 반경(r, 기본 500m) 안. */
export function matchPrivate(draft, list) {
  if (!Array.isArray(list)) return false;
  const n = norm(draft?.name);
  return list.some((p) => {
    const pn = norm(p?.name);
    if (n && pn && n.includes(pn)) return true;
    return typeof p?.lat === 'number' && typeof p?.lng === 'number' && metersApart(draft, p) <= (Number(p.r) || 500);
  });
}
