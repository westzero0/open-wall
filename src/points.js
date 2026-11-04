// src/points.js — 참여 포인트: 글·제보가 성공으로 나갔을 때 기기 안에 쌓는 적립 장부. 랭킹이 열리면 방문(스트릭)과 합산한다.
// 이벤트 하나 = {id, src:'board'|'report', at:'YYYY-MM-DD'}. 값은 저장하지 않고 VALUES에서 파생(나중에 재조정·시즌 합산 가능).
// No DOM, no network. storage는 주입받는다. 읽는 값(localStorage)은 믿지 않고 normalizePoints를 거친다.

export const POINTS_KEY = 'open-wall:points';
export const VALUES = { report: 15, board: 10 }; // 제보 15 / 글 10 (docs/superpowers/specs/2026-11-04-streak-and-points-design.md)
export const MAX_POINTS = 5000;
export const SRC = Object.keys(VALUES);

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 이벤트 하나를 정제해 돌려주거나 null. */
function cleanPoint(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  if (typeof p.id !== 'string' || !ID_RE.test(p.id)) return null;
  if (!SRC.includes(p.src)) return null;
  if (typeof p.at !== 'string' || !DATE_RE.test(p.at)) return null;
  return { id: p.id, src: p.src, at: p.at };
}

/** normalizePoints(v) → 깨끗한 이벤트 배열: 불량 제거, 중복 id는 한 번만, 최신 MAX_POINTS개(뒤쪽 유지). */
export function normalizePoints(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const item of v) {
    const p = cleanPoint(item);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out.length > MAX_POINTS ? out.slice(out.length - MAX_POINTS) : out;
}

export function loadPoints(storage) {
  try {
    return normalizePoints(JSON.parse(storage.getItem(POINTS_KEY)));
  } catch {
    return [];
  }
}

export function savePoints(storage, list) {
  try {
    storage.setItem(POINTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // 꽉 찼거나 막힘: 이번 방문 동안 메모리에만
  }
}

/** addPoint(list, src, {id, at}) → 새 배열(원본 불변). 모르는 src면 그대로 돌려준다. */
export function addPoint(list, src, { id, at }) {
  const p = cleanPoint({ id, src, at });
  return p ? [...list, p] : list;
}

/** pointsSummary(list) → {total, counts:{report, board}}. total은 VALUES로 환산한 합. */
export function pointsSummary(list) {
  const counts = Object.fromEntries(SRC.map((s) => [s, 0]));
  let total = 0;
  for (const p of list) {
    if (counts[p.src] === undefined) continue;
    counts[p.src] += 1;
    total += VALUES[p.src];
  }
  return { total, counts };
}
