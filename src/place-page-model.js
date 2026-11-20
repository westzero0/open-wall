// src/place-page-model.js — tabs, start tab, report chips of the place page. No DOM.
const TABS = {
  crag: [['cond', '컨디션'], ['approach', '어프로치'], ['routes', '루트']],
  wall: [['cond', '컨디션'], ['use', '이용'], ['routes', '루트']],
  ice: [['cond', '결빙'], ['use', '이용'], ['routes', '루트']],
};
const tabsOf = (kind) => TABS[kind] ?? TABS.wall;

export function placePageTabs(kind, model = {}) {
  return tabsOf(kind).map(([key, label]) => ({ key, label, empty: model?.empty?.[key] === true }));
}

export function pickTab(kind, key) {
  const t = tabsOf(kind);
  return t.some(([k]) => k === key) ? key : t[0][0];
}

export function startTab(kind, from) {
  if (from === 'detail') return kind === 'crag' ? 'approach' : kind === 'ice' ? 'cond' : 'use';
  if (from === 'record' && kind === 'crag') return 'routes';
  return tabsOf(kind)[0][0];
}

// Only kinds that report.js accepts: KINDS for wall/ice, CRAG_KINDS for crag.
export function reportKinds(kind, tab) {
  if (kind === 'crag') return tab === 'routes' ? ['루트·개념도'] : tab === 'approach' ? ['어프로치', '기타'] : ['기타'];
  return tab === 'routes' ? ['루트 분포'] : tab === 'use' ? ['요금', '운영시간'] : ['기타'];
}

// detail → none; alt → swap (with a plan) / create; no from → create; any other from (search, record, unknown) → none (a second new plan over the sheet)
export function planRowKind(from, hasPlan) {
  if (from === 'alt') return hasPlan ? 'swap' : 'create';
  return from == null ? 'create' : 'none';
}
