// src/overview-view.js — the 전경 section at the top of the wall sheet's 루트 tab: the whole-wall picture people use to find a route.
// With pictures: the first one (16:9, 1/N), its credit, and a link to send one more; a tap opens the full-screen gallery, where a picture can be zoomed.
// Without: a dotted box that asks for one. Hidden when the board Worker is off and there is nothing to show (no way to send). DOM via el()/textContent only.
import { el } from './dom.js';
import { openGallery } from './gallery-view.js';
import { config } from './config.js';

const KIND = '전경 사진';
const mmdd = (d) => (/^\d{4}-\d\d-\d\d$/.test(d ?? '') ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '');

/** overviewSection(name, overview, kinds) → a <section> or null. overview: the wall's `overview` list ([{ src, credit?, date? }]); kinds: the report sheet's tabs for this tab. */
export function overviewSection(name, overview, kinds) {
  const list = (overview ?? []).map((p) => ({ src: `data/${p.src}`, credit: p.credit, date: p.date }));
  const canSend = Boolean(config.boardUrl);
  if (!list.length && !canSend) return null;
  const send = (label, cls = 'ws-ask sub') => {
    const b = el('button', { type: 'button', class: cls }, label);
    b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name, kind: KIND, kinds } })));
    return b;
  };
  const head = el('div', { class: 'ws-sec-h' }, el('h3', {}, '전경'));
  if (!list.length) {
    return el('section', { class: 'ws-sec empty ov-sec', 'aria-label': '전경', 'data-sec': 'overview' }, head,
      el('div', { class: 'ws-empty' },
        el('p', {}, '사진 한 장이면 루트 찾기가 쉬워져요'),
        el('p', { class: 'ws-empty-sub' }, '벽 전체가 보이는 사진을 보내 주시면 다음에 오는\u00a0분이 루트를 더 빨리 찾아요.'),
        send('전경 사진 보내기')));
  }
  const open = el('button', { type: 'button', class: 'ov-photo', 'aria-label': `${name} 전경 사진 크게 보기` },
    el('img', { src: list[0].src, alt: `${name} 전경`, decoding: 'async', loading: 'lazy' }),
    list.length > 1 ? el('span', { class: 'ov-n', 'aria-hidden': 'true' }, `1/${list.length}`) : null);
  open.addEventListener('click', () => openGallery({ name, photos: list, index: 0, canSend, sendKind: KIND, sendLabel: '전경 사진 더 보내기', what: '전경 사진' }));
  const c = list[0].credit;
  const who = c ? c.text.replace(/^사진 · /, '') : '';
  const credit = ['사진', who, mmdd(list[0].date)].filter(Boolean).join(' · ');
  return el('section', { class: 'ws-sec ov-sec', 'aria-label': '전경', 'data-sec': 'overview' }, head,
    el('p', { class: 'ws-chk' }, '루트를 찾을 때 보세요 · 누르면 크게 봐요'),
    open,
    credit === '사진' ? null : el('p', { class: 'ws-chk' }, credit),
    canSend ? send('전경 사진 보내기') : null);
}
