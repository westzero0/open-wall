// src/home-view.js — 일정이 0개인 홈의 위쪽 (docs/superpowers/specs/2026-11-07-home-schedule-record-frame.md, 시안 ⑦-a~c): `일정 잡기` 줄과 추천 줄. DOM only: the choice is home-suggest.js's.
// Every line is card-parts lineRow (one button, one ›); a note with nothing to press is one grey line with no card face. No fetch, no storage: the app passes the handlers.
import { el } from './dom.js';
import { arrow, lineRow } from './card-parts.js';
import { shortName } from './viewmodel.js';

const hour = (min) => `${Math.floor(min / 60)}시`;
const when = (r) => (r.open ? `열림 · ${hour(r.endMin)}까지` : `${hour(r.startMin)}에 열어요`);
const mdOf = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const HEAD = { fav: '내 암장', visited: '자주 간 곳', near: '가까운 곳' };

/** suggestBlock(suggest, { icon, onOpenWall(name, button) }) → the heading and the wall lines of one suggest result (also the folded 내 암장 on a trip day). */
export function suggestBlock(suggest, { icon, onOpenWall, tail = null }) { // tail: a line that closes the box (시안 ⑤: 외벽 더 찾기 sits in the same box as the rows)
  const fav = suggest.kind === 'fav';
  return el('section', { class: 'trip-blk' }, el('h4', { class: 'trip-blk-t' }, HEAD[suggest.kind] ?? ''), el('div', { class: 'ln-box' },
    ...suggest.rows.map((r) => {
      const sub = [Number.isFinite(r.km) ? `${Math.round(r.km)}km` : null, r.sun || null, r.last ? `지난 방문 ${mdOf(r.last)}` : null].filter(Boolean).join(' · ');
      const b = lineRow({ lead: el('span', { class: 'ln-tile', 'aria-hidden': 'true' }, icon ? icon(fav ? 'heart' : 'route', fav) : null), title: shortName(r.wall), sub: sub || null,
        end: el('span', { class: 'ln-end' }, el('span', { class: r.open ? 'ln-v open' : 'ln-v' }, when(r)), arrow()), data: { 'data-wall': r.wall.name } });
      b.addEventListener('click', () => onOpenWall?.(r.wall.name, b));
      return b;
    }), tail));
}

/**
 * renderEmptyHome(host, { suggest, onAsk(button), onOpenWall(name, button), onLocate(button), icon(name, filled) })
 * suggest: home-suggest.js's { kind, rows, note }. Draws: 일정 잡기 · the heading and the rows (fav ♥, else 기록, else 가까운 곳) · or the note (far: grey line, locate: 위치 허용 줄).
 */
export function renderEmptyHome(host, { suggest, onAsk, onOpenWall, onLocate, icon, tail = null }) {
  const ask = lineRow({ title: '일정 잡기', sub: '일정을 잡으면 그날 날씨·운영 정보를 카드에서 보여 드려요', data: { 'data-home': 'ask' } });
  ask.addEventListener('click', () => onAsk?.(ask));
  const parts = [ask];
  if (suggest.rows.length) {
    parts.push(suggestBlock(suggest, { icon, onOpenWall, tail }));
    tail = null;
  } else if (suggest.note === 'far') {
    parts.push(el('p', { class: 'sh-hint home-note' }, '30km 안에 가까운 암장이 없어요. 아래 외벽 시간표에서 찾아보세요.'));
  } else if (suggest.note === 'locate') {
    const loc = lineRow({ title: '위치 허용하고 가까운 순으로 보기', sub: '위치는 이 기기에서만 쓰고 저장하지 않아요', data: { 'data-home': 'locate' } });
    loc.addEventListener('click', () => onLocate?.(loc));
    parts.push(loc);
  }
  host.replaceChildren(...parts, ...(tail ? [tail] : []));
}
