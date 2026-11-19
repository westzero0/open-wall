// src/crag-detail-model.js — 자연암장 시트의 윗줄 조각과 상세 시트(어프로치·루트) 보기 데이터. 순수 함수, DOM·fetch 없음.
import { approachModel } from './crag-approach.js';
import { pitchCount } from './crag-routes.js';
import { PHOTO_RE } from './store.js';

const TURN_WORD = { left: '왼쪽', right: '오른쪽', straight: '직진', up: '오르막', down: '내리막' };
const okPhoto = (p) => (typeof p === 'string' && PHOTO_RE.test(p) && !p.includes('..') ? p : null);

/** cragSummaryBits(crag, entry) → ['루트 24개', '걸어서 15분']: 값 있는 조각만. entry = 이 암장의 루트 데이터(없으면 undefined). */
export function cragSummaryBits(crag, entry) {
  const n = entry?.routes?.length ?? 0;
  const min = approachModel(crag)?.totalMin;
  return [n > 0 && `루트 ${n}개`, min > 0 && `걸어서 ${min}분`].filter(Boolean);
}

/** approachView(crag) → { head, parkNote, parkPhoto, steps } | null */
export function approachView(crag) {
  const m = approachModel(crag);
  if (!m) return null;
  const head = [m.totalMin > 0 && `걸어서 ${m.totalMin}분`, m.park.has && `주차 ${m.park.chip}`].filter(Boolean).join(' · ');
  const park = m.stops[0];
  return {
    head, parkNote: (crag.parking?.note ?? '').trim(), parkPhoto: okPhoto(park.photo),
    steps: m.stops.filter((s) => s.type === 'fork').map((s) => ({ text: s.text, turn: TURN_WORD[s.turn] ?? null, wrong: s.wrong, photo: okPhoto(s.photo) })),
  };
}

/** routesView(entry, area, multi) → { areas, topos, rows } | null. area null = 전체. 구역 칩은 구역이 둘 이상일 때만(areas가 빈 배열이면 칩 없음). */
export function routesView(entry, area, multi) {
  if (!entry || (!entry.routes?.length && !entry.topos?.length)) return null;
  const inArea = (x) => area == null || x.area === area;
  const sub = (r) => [r.length_m != null && `${r.length_m}m`, r.quickdraws != null && `퀵드로 ${r.quickdraws}`, pitchCount(r, multi)].filter(Boolean).join(' · ');
  return {
    areas: (entry.areas?.length ?? 0) > 1 ? entry.areas : [],
    topos: entry.topos.filter((t) => inArea(t) && okPhoto(t.image)).map((t) => ({ src: 'data/' + t.image, caption: t.caption ?? '', credit: t.credit ?? '' })),
    rows: entry.routes.filter(inArea).map((r) => ({ key: r.id, no: r.no, name: r.name, grade: r.grade ?? '', sub: sub(r) })),
  };
}
