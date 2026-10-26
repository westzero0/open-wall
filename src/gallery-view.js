// src/gallery-view.js — the full-screen photo gallery of one wall (mockup 2026-10-14-gallery): swipe, "n / N", a thumbnail strip, the
// credit of the photo on view and a button that always sits at the bottom to send one more. A <dialog>: Esc and focus come with it.
// DOM via el()/textContent only; photo credits come from data and go in as text.
import { el } from './dom.js';

let dlg = null, track, thumbs, counter, meta, prev, next, sendBtn, hint;
let photos = [], cur = 0, wallName = '', onClose = null, opener = null, sendKind = '암장 사진';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const at = (i) => Math.max(0, Math.min(photos.length - 1, i));
const goTo = (i, smooth) => track.scrollTo({ left: at(i) * track.clientWidth, behavior: smooth && !reduce() ? 'smooth' : 'instant' });

// 누르면 그 자리를 크게 본다(눌린 곳이 가운데로), 한 번 더 누르면 돌아온다. 확대 중에는 사진 안에서 끌어 움직이고 옆 사진으로는 넘어가지 않는다.
function unzoom() {
  dlg.classList.remove('is-zoomed');
  for (const s of track.querySelectorAll('.gal-slide.zoomed')) { s.classList.remove('zoomed'); s.querySelector('.gal-zoom')?.setAttribute('aria-pressed', 'false'); s.scrollTo(0, 0); }
}
function toggleZoom(slide, e) {
  if (slide.classList.contains('zoomed')) return unzoom();
  const img = slide.querySelector('img');
  const r = img.getBoundingClientRect();
  const fx = r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0.5; // a keyboard press has no position: the middle
  const fy = r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0.5;
  slide.classList.add('zoomed');
  dlg.classList.add('is-zoomed');
  slide.querySelector('.gal-zoom').setAttribute('aria-pressed', 'true');
  slide.scrollTo({ left: fx * slide.scrollWidth - slide.clientWidth / 2, top: fy * slide.scrollHeight - slide.clientHeight / 2, behavior: 'instant' });
}

function show(i) {
  if (i !== cur) unzoom();
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
  hint = el('p', { class: 'gal-hint' }, '사진을 누르면 확대돼요');
  sendBtn.addEventListener('click', () => {
    const name = wallName;
    dlg.close();
    document.dispatchEvent(new CustomEvent('wall:report', { detail: { name, kind: sendKind, kinds: [sendKind] } }));
  });
  dlg = el('dialog', { class: 'gal', 'aria-label': '암장 사진' },
    el('div', { class: 'gal-bar' }, counter, close),
    track,
    el('div', { class: 'gal-navs' }, prev, next),
    hint, meta, thumbs,
    el('div', { class: 'gal-foot' }, sendBtn));
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') goTo(cur + 1, true); else if (e.key === 'ArrowLeft') goTo(cur - 1, true); });
  dlg.addEventListener('close', () => { unzoom(); onClose?.(cur); onClose = null; if (opener?.isConnected) opener.focus(); opener = null; });
  document.body.append(dlg);
}

function slideOf(p, i, what, first) {
  const slide = el('div', { class: 'gal-slide' });
  const b = el('button', { type: 'button', class: 'gal-zoom', 'aria-label': `${i + 1}번째 사진 확대해서 보기`, 'aria-pressed': 'false' },
    el('img', { src: p.src, alt: `${wallName} ${what} ${i + 1}`, decoding: 'async', loading: i === first ? 'eager' : 'lazy' }));
  b.addEventListener('click', (e) => toggleZoom(slide, e));
  slide.append(b);
  return slide;
}

/** openGallery({ name, photos: [{ src, credit?, date? }], index, canSend, onClose(index), sendKind?, sendLabel?, what? }) — sendKind: the 제보 tab the button opens (default 암장 사진); what: how the pictures are called (default 외벽 사진) */
export function openGallery(opts) {
  if (!dlg) build();
  photos = opts.photos;
  wallName = opts.name;
  onClose = opts.onClose ?? null;
  opener = document.activeElement;
  sendKind = opts.sendKind ?? '암장 사진';
  sendBtn.textContent = opts.sendLabel ?? '이 암장 사진 더 보내기';
  const what = opts.what ?? '외벽 사진';
  dlg.setAttribute('aria-label', `${wallName} ${what}`);
  track.replaceChildren(...photos.map((p, i) => slideOf(p, i, what, opts.index)));
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
