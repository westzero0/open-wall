// src/trip-view.js — 외출(일정) 카드 부품. 외벽 카드의 조각을 그대로 쓴다: 날씨 칩(.wxset 칸 + 아래 한 줄), 누르는 줄(card-parts goRow → .irow),
// 날짜 칩(chipBar → .cchip), 버튼은 카드 dock의 두 모양(채움 = 이 카드의 일, 옅은 칸 = 나머지). 데이터는 app.js가 만든 평범한 model, 동작은 콜백.
// 저장·요청은 모른다. icon(name)은 app.js의 icon(); 없으면 그림 없이 그린다.
//   tripCard(model, { onHome, onMove, onDelete, homeMain, icon })   일정 탭의 카드: 칩 · 이름 · 날짜 줄(D-n 포함) · 배지, 아래 홈에서 보기 · 일정 옮기기 · 삭제 (homeMain: 홈에서 보기를 채운 모양으로)
//   foldLine(model, onOpen, { icon })                            홈의 접힌 줄: 40px 칩 · '다음 · 이름' / 날짜 · ›
//   dayCard(model, { onApproach, onRoutes, onProject, onReport, onRecord, icon })   당일 카드: model.order대로, 맨 아래 오늘 한 것 남기기
//   (m.plan = trip-plan.js planHead: tripCard와 rainCard가 새 날씨 머리를 쓴다)
//   rainCard(model, { onOtherDay, onInstead, onKeep, onOpenSched, icon })          비 예보 카드: 날짜 칩, '비를 피하려면' 선택지 줄(같은 곳 다른 날 · 대신 갈 곳 · 그대로), 근거 있는 첫 줄에 '추천'
//   ddayLine(model)                                              홈의 칩 줄과 카드 사이 한 줄: 'D-5 다음 일정' (카드는 장소·날짜를 스스로 말하고 D-day는 여기)
//   backCard(model, { onRecord, onSkip, icon })                  다녀온 뒤: '어제 다녀왔어요?' (model.when = '어제' | 'N일 전', 배지도 같은 말)
import { el } from './dom.js';
import { WX_ICON, wxLabel, goRow, chipBar, lineRow, tag } from './card-parts.js';

const pic = (icon, name) => (icon ? icon(name) : null);
// 칩 그림 하나: 예보가 없으면 날씨를 그리지 않는다(달력 그림 = "아직 예보 없음", 맑다고 말하지 않는다). wx.kind null = 맑음.
const glyphOf = (wx) => (!wx ? 'calendar' : wx.kind ? WX_ICON[wx.kind] ?? 'sky-partly' : 'sun');
const chipLabel = (wx, under) => [wx ? wxLabel('', wx) || '맑음' : '예보 없음', under].filter(Boolean).join(' · ');

// 날씨 칩: 외벽 줄의 칩 칸(.wxset)과 그 아래 한 줄(.wx-temp: 기온). 읽는 말은 칸 하나에 모은다.
export function wxChip(wx, under, icon, small = false) {
  const label = chipLabel(wx, under);
  return el('span', { class: `wxset trip-wx${small ? ' small' : ''}${wx?.kind ? ` is-${wx.kind}` : ''}${wx ? '' : ' no-fc'}`, role: 'img', 'aria-label': label, title: label },
    el('span', { class: 'trip-chip', 'aria-hidden': 'true' }, pic(icon, glyphOf(wx))),
    under && !small ? el('span', { class: 'wx-temp', 'aria-hidden': 'true' }, under) : null);
}

const underOf = (m) => (Number.isFinite(m.wx?.t) ? `${m.wx.t}°` : null); // D-n lives in the date line, not in the chip's temperature slot
const badge = (text, kind) => (text ? el('span', { class: `trip-badge${kind ? ` ${kind}` : ''}` }, text) : null);
const head = (m, icon, end = badge(m.badge, m.badgeKind)) => el('div', { class: 'trip-head' }, wxChip(m.wx, underOf(m), icon),
  el('div', { class: 'trip-t' }, el('h3', { class: 'trip-name' }, m.title), m.dateText ? el('p', { class: 'trip-date' }, [m.dateText, m.dday].filter(Boolean).join(' · ')) : null), end);

// 날씨 머리(m.plan = trip-plan.js planHead, 시안 home-v3): 장소 · 날짜 줄(+ 알약) → 날씨 제목 → 날씨 칸 둘(비 오는 칸은 --rain-tint) → 안내. m.plan이 없으면 예전 머리(칩 · 이름 · 날짜).
const planHeader = (m, icon, end) => [
  el('div', { class: 'pc-eye' }, el('span', { class: 'pc-place' }, [m.title, m.dateText].filter(Boolean).join(' · ')), end),
  el('h3', { class: 'pc-head' }, m.plan.headline),
  m.plan.cells.length ? el('div', { class: 'pc-wx' }, ...m.plan.cells.map((c) => el('div', { class: `pc-cell${c.rain ? ' wet' : ''}` }, el('span', { class: 'pc-g', 'aria-hidden': 'true' }, pic(icon, c.glyph)),
    el('div', { class: 'pc-t' }, el('b', {}, c.day), el('small', {}, c.text))))) : null,
  m.plan.note ? el('p', { class: 'pc-note' }, m.plan.note) : null,
];
const kindTag = (p) => tag(p.kind === 'zone' ? '구역' : p.indoor ? '실내' : '외벽');

const btn = (label, f, main = false, focus = null) => { // focus: data-focus, so a redraw (or a closing sheet) can find the new copy
  if (!f) return null;
  const b = el('button', { type: 'button', class: `trip-btn${main ? ' main' : ''}`, 'data-focus': focus }, label);
  b.addEventListener('click', (e) => f(e.currentTarget));
  return b;
};
const btnRow = (...bs) => (bs.some(Boolean) ? el('div', { class: 'trip-acts' }, ...bs) : null);

export function tripCard(m, { onHome, onMove, onDelete, homeMain = false, icon } = {}) {
  return el('article', { class: m.plan ? 'trip-card pc' : 'trip-card', 'data-trip': m.id }, ...(m.plan ? planHeader(m, icon, badge(m.badge, m.badgeKind)) : [head(m, icon)]),
    btnRow(btn('홈에서 보기', onHome && (() => onHome(m.id)), homeMain, `trip-home-${m.id}`), btn('일정 옮기기', onMove && ((b) => onMove(m.id, b)), false, `trip-move-${m.id}`),
      btn('삭제', onDelete && (() => onDelete(m.id)), false, `trip-delete-${m.id}`)));
}

export const ddayLine = (m, label = '다음 일정') => (m.dday ? el('p', { class: 'trip-dday' }, el('b', {}, m.dday), el('span', {}, label)) : null);

export function foldLine(m, onOpen, { icon } = {}) {
  const b = lineRow({ lead: wxChip(m.wx, null, icon, true), title: [m.lead, m.title].filter(Boolean).join(' · '), sub: [m.dateText, m.dday].filter(Boolean).join(' · '), data: { 'data-trip': m.id } });
  b.addEventListener('click', () => onOpen?.(m.id, b));
  return b;
}

// 블록 하나 = 작은 제목 + 외벽 카드의 .irow 줄들. 어프로치 줄은 order에 없어도 가는 길에 꼭 넣는다(저장된 정보가 없어도 시트는 열린다).
const block = (title, ...rows) => el('section', { class: 'trip-blk' }, el('h4', { class: 'trip-blk-t' }, title), ...rows);
export function dayCard(m, { onApproach, onRoutes, onProject, onReport, onRecord, icon } = {}) {
  const order = m.order?.includes('approach') ? m.order : [...(m.order ?? []), 'approach'];
  // 시안 ③: 작은 장소 줄(+ 오늘 알약) → 큰 상태 제목(m.now) → 줄들. 줄은 외벽 카드의 .ln(제목 위 보조 · ›)
  const ln = (title, sub, opens, f, label = null) => { const b = lineRow({ title, sub, label, data: { 'data-opens': opens } }); b.addEventListener('click', (e) => f?.(m.id, e.currentTarget)); return b; };
  const row = {
    project: () => ln(m.project.name, m.project.sub, 'project', onProject),
    approach: () => (m.approach // 저장된 정보가 없으면: 아직 몰라요 · 알려 주기 ›
      ? ln(`어프로치 · ${m.approach.text || '길 보기'}`, m.approach.sub, 'approach', onApproach)
      : ln('어프로치 · 아직 몰라요', '알려 주기', 'approach', onApproach, '어프로치 정보 없음, 알려 주기')),
    routes: () => ln('개념도·루트 보기', m.routes?.sub, 'routes', onRoutes),
    report: () => ln('정보가 달라요', '어프로치·루트·주차·컨디션', 'report', onReport),
  };
  const out = [];
  for (const k of order) { // 어프로치·루트·제보가 이어지면 가는 길 블록 하나로 묶는다
    if (k === 'approach' || k === 'routes' || k === 'report') {
      const last = out.at(-1);
      if (last?.way) { last.rows.push(row[k]()); continue; }
      out.push({ way: true, rows: [row[k]()] });
    } else if (k === 'project' && m.project) out.push({ title: '내 프로젝트', rows: [row.project()] });
  }
  const blocks = out.map((b) => block(b.way ? '가는 길' : b.title, ...b.rows));
  const top = m.now
    ? [el('div', { class: 'pc-eye' }, el('span', { class: 'pc-place' }, m.title), badge(m.badge, m.badgeKind)), el('h3', { class: 'pc-head' }, m.now.text), m.now.sub ? el('p', { class: 'pc-note' }, m.now.sub) : null]
    : [head(m, icon)];
  return el('article', { class: `trip-card trip-top${m.now ? ' pc' : ''}`, 'data-trip': m.id }, ...top, ...blocks, btn('오늘 한 것 남기기', () => onRecord?.(m.id), true));
}

export function rainCard(m, { onOtherDay, onInstead, onKeep, onOpenSched, icon } = {}) {
  const days = m.plan ? null : chipBar((m.days ?? []).map((d) => ({ kind: 'trip-day', text: d.text, icon: glyphOf(d.wx), tone: d.rain ? 'warn' : 'plain' })), { icon: icon ?? (() => null), pick() {} });
  const line = (key, title, sub, f) => { // 선택지 한 줄: 이름 · 이유, 근거가 있는 첫 줄만 '추천'(m.recommend), 누르면 f
    const b = lineRow({ title: m.recommend === key ? [].concat(title, tag('추천', 'ok')) : title, sub, cls: `trip-opt${m.recommend === key ? ' sel' : ''}`, data: { 'data-opt': key } });
    if (f) b.addEventListener('click', () => f());
    return b;
  };
  const opts = [
    m.otherDay && onOtherDay ? line('otherDay', m.otherDayLabel || '다른 날로 옮기기', m.otherDaySub, () => onOtherDay(m.id, m.otherDay)) : null,
    ...(m.instead ?? []).map((p, k) => (onInstead ? line(k ? `instead-${k}` : 'instead', [p.name, kindTag(p)], p.sub, () => onInstead(m.id, p)) : null)),
    onKeep ? line('keep', '그대로 가기', m.keepSub, () => onKeep(m.id)) : null,
  ].filter(Boolean);
  return el('article', { class: `trip-card trip-top trip-rain${m.plan ? ' pc' : ''}`, 'data-trip': m.id }, ...(m.plan ? planHeader(m, icon, tag('비 예보', 'rain')) : [head(m, icon, tag('비 예보', 'rain'))]), days,
    block('비를 피하려면', ...opts),
    onOpenSched ? goRow('일정', ['일정 탭에서 보기'], 'sched', (e) => onOpenSched(m.id, e.currentTarget)) : null);
}

export function backCard(m, { onRecord, onSkip, icon } = {}) {
  const when = m.when || '어제'; // 다녀옴 is only for a trip with a record; before that the card asks
  return el('article', { class: 'trip-card trip-top trip-back', 'data-trip': m.id }, head(m, icon, badge(when, 'back')),
    el('p', { class: 'trip-ask' }, `${when} 다녀왔어요?`),
    btnRow(btn('다녀왔어요', onRecord && (() => onRecord(m.id)), true), btn('안 갔어요', onSkip && (() => onSkip(m.id)))));
}
