// src/poster-strip.js — the 기록 tab's "내 오늘의 해벽": the small cards made so far, newest first. pickCta and createThumbCache are pure (tested);
// renderStrip is DOM, built with el() only. The thumbnails are blobs read from poster-store.js (the small `thumbs` rows, never the big images).
import { el } from './dom.js';

/**
 * pickCta(recs, madeIds, today) → the id of the one record that gets the big "오늘의 해벽 만들기" line: of the picked day's records (newest first)
 * the newest that is of today and has no card yet; null when there is none. Every other record gets the quiet link.
 */
export function pickCta(recs, madeIds, today) {
  return recs.find((r) => r.date === today && !madeIds.has(r.id))?.id ?? null;
}

/**
 * createThumbCache({ make, free }) → { url(id, blob) → string, keep(ids), clear() }: one object URL per card, made when a thumbnail is first shown
 * and revoked when it is replaced, no longer listed (keep) or the cache is cleared. make/free default to URL.createObjectURL/revokeObjectURL.
 */
export function createThumbCache({ make = (b) => URL.createObjectURL(b), free = (u) => URL.revokeObjectURL(u) } = {}) {
  const urls = new Map(); // id → { blob, url }
  return {
    url(id, blob) {
      const have = urls.get(id);
      if (have?.blob === blob) return have.url;
      if (have) free(have.url);
      const url = make(blob);
      urls.set(id, { blob, url });
      return url;
    },
    keep(ids) {
      const live = new Set(ids);
      for (const [id, v] of urls) if (!live.has(id)) { free(v.url); urls.delete(id); }
    },
    clear() {
      for (const v of urls.values()) free(v.url);
      urls.clear();
    },
  };
}

const p2 = (n) => String(n).padStart(2, '0');

/**
 * renderStrip(items, { cache, onOpen, walls, today }) → the section, or null when there is no card yet.
 * items: [{id, wall, date, thumb}] newest first (poster-store's list()); onOpen(id) opens the card; walls: the wall list (for the short name).
 */
export function renderStrip(items, { cache, onOpen, walls = [], today = '' }) {
  if (!items.length) return null;
  const cards = items.map((it) => {
    const [, m, d] = it.date.split('-');
    const wall = walls.find((w) => w.name === it.wall);
    const short = wall?.short_name || wall?.name || it.wall;
    const title = it.date === today ? '오늘의 해벽' : '그날의 해벽';
    const img = el('img', { class: 'pstrip-img', src: cache.url(it.id, it.thumb), alt: '' }); // the height is CSS; the width follows the card's own shape
    const cap = `${p2(Number(m))}/${p2(Number(d))} ${short}`;
    const btn = el('button', { type: 'button', class: 'pstrip-item', 'data-focus': `strip-${it.id}`, 'aria-label': `${cap} ${title} 보기` }, // the label holds the visible caption
      img, el('span', { class: 'pstrip-cap' }, cap));
    btn.addEventListener('click', () => onOpen(it.id));
    return el('li', {}, btn);
  });
  return el('section', { class: 'pstrip', 'aria-labelledby': 'pstrip-title' },
    el('h3', { id: 'pstrip-title' }, '내 오늘의 해벽', el('span', {}, ` · ${items.length}장`)),
    el('ul', { class: 'pstrip-list' }, ...cards));
}
