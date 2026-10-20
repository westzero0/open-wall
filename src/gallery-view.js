// src/gallery-view.js — the full-screen photo gallery of one wall (mockup 2026-10-14-gallery): swipe, "n / N", a thumbnail strip, the
// credit of the photo on view and a button that always sits at the bottom to send one more. A <dialog>: Esc and focus come with it.
// DOM via el()/textContent only; photo credits come from data and go in as text.
import { el } from './dom.js';

let dlg = null, track, thumbs, counter, meta, prev, next, sendBtn;
let photos = [], cur = 0, wallName = '', onClose = null, opener = null;

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const at = (i) => Math.max(0, Math.min(photos.length - 1, i));
const goTo = (i, smooth) => track.scrollTo({ left: at(i) * track.clientWidth, behavior: smooth && !reduce() ? 'smooth' : 'instant' });

function show(i) {
  cur = i;
  counter.textContent = `${i + 1} / ${photos.length}`;
  [...thumbs.children].forEach((b, k) => b.classList.toggle('on', k === i));
  thumbs.children[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
  const c = photos[i].credit;
  const who = c ? c.text.replace(/^사진 · /, '') : '';
  meta.replaceChildren(...[who && el('b', {}, who), photos[i].date].filter(Boolean).flatMap((x, k) => (k ? [' · ', x] : [x])));
  prev.disabled = i === 0;
  next.disabled = i === photos.length - 1;
}

function build() {
  counter = el('b', { class: 'gal-count', 'aria-live': 'polite' });
  const close = el('button', { type: 'button', class: 'gal-btn', 'aria-label': '닫기' }, '✕');
  close.addEventListener('click', () => dlg.close());
  track = el('div', { class: 'gal-track', tabindex: '0', role: 'group', 'aria-roledescription': 'carousel', 'aria-label': '사진 목록' });
  track.addEventListener('scroll', () => { const i = at(Math.round(track.scrollLeft / track.clientWidth)); if (i !== cur) show(i); }, { passive: true });
  prev = el('button', { type: 'button', class: 'gal-btn', 'aria-label': '이전 사진' }, '‹');
  next = el('button', { type: 'button', class: 'gal-btn', 'aria-label': '다음 사진' }, '›');
  prev.addEventListener('click', () => goTo(cur - 1, true));
  next.addEventListener('click', () => goTo(cur + 1, true));
  meta = el('p', { class: 'gal-meta' });
  thumbs = el('div', { class: 'gal-thumbs' });
  sendBtn = el('button', { type: 'button', class: 'gal-send' }, '이 암장 사진 더 보내기');
  sendBtn.addEventListener('click', () => {
    const name = wallName;
    dlg.close();
    document.dispatchEvent(new CustomEvent('wall:report', { detail: { name, kind: '암장 사진', kinds: ['암장 사진'] } }));
  });
  dlg = el('dialog', { class: 'gal', 'aria-label': '암장 사진' },
    el('div', { class: 'gal-bar' }, counter, close),
    track,
    el('div', { class: 'gal-navs' }, prev, next),
    meta, thumbs,
    el('div', { class: 'gal-foot' }, sendBtn));
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') goTo(cur + 1, true); else if (e.key === 'ArrowLeft') goTo(cur - 1, true); });
  dlg.addEventListener('close', () => { onClose?.(cur); onClose = null; if (opener?.isConnected) opener.focus(); opener = null; });
  document.body.append(dlg);
}

/** openGallery({ name, photos: [{ src, credit?, date? }], index, canSend, onClose(index) }) */
export function openGallery(opts) {
  if (!dlg) build();
  photos = opts.photos;
  wallName = opts.name;
  onClose = opts.onClose ?? null;
  opener = document.activeElement;
  dlg.setAttribute('aria-label', `${wallName} 사진`);
  track.replaceChildren(...photos.map((p, i) => el('div', { class: 'gal-slide' }, el('img', { src: p.src, alt: `${wallName} 외벽 사진 ${i + 1}`, decoding: 'async', loading: i === opts.index ? 'eager' : 'lazy' }))));
  thumbs.replaceChildren(...photos.map((p, k) => {
    const b = el('button', { type: 'button', 'aria-label': `${k + 1}번째 사진` }, el('img', { src: p.src, alt: '', loading: 'lazy', decoding: 'async' }));
    b.addEventListener('click', () => goTo(k, true));
    return b;
  }));
  sendBtn.parentElement.hidden = !opts.canSend;
  dlg.showModal();
  show(opts.index);
  goTo(opts.index, false);
  dlg.querySelector('.gal-btn').focus();
}
