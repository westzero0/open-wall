// src/poster-store.js — the finished 오늘의 해벽 cards, kept in this browser only (IndexedDB, never sent anywhere).
// A card is {id (the record's id), v: 1, made (ISO time), wall, date, blob (JPEG, ≤ 400 KB)} in store `posters`, and it always has a row in
// store `thumbs`: {id, made, wall, date, thumb (a small JPEG ≤ 30 KB, or null)} — the 기록 tab reads only these small rows. The newest 60 are kept.
// Everything is best effort: a blocked or full store never throws, the card is just not kept.
// exportAll / importAll are the way out and in, for the day the records move to a server (the app runs them in the browser that holds them).
import { ID_RE } from './log.js';

export const MAX_POSTERS = 60;
export const MAX_BYTES = 400 * 1024;
export const MAX_THUMB = 30 * 1024;
export const V = 1;

const MADE_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isJpeg = (b, max) => b instanceof Blob && b.type === 'image/jpeg' && b.size <= max;

/** validPoster(p) → whether p is a card this store will keep. */
export function validPoster(p) {
  return !!p && typeof p === 'object' && typeof p.id === 'string' && ID_RE.test(p.id) && p.v === V
    && typeof p.made === 'string' && MADE_RE.test(p.made) && typeof p.wall === 'string' && typeof p.date === 'string' && DATE_RE.test(p.date)
    && isJpeg(p.blob, MAX_BYTES);
}

/** validThumb(t) → whether t is a thumbnail this store will keep (a small JPEG). */
export const validThumb = (t) => isJpeg(t, MAX_THUMB);

/** pruneKeys(posters, max = MAX_POSTERS) → the ids to drop: the oldest `made` first (ties by id) beyond max. */
export function pruneKeys(posters, max = MAX_POSTERS) {
  const old = [...posters].sort((a, b) => (a.made < b.made ? -1 : a.made > b.made ? 1 : a.id < b.id ? -1 : 1));
  return old.slice(0, Math.max(0, old.length - max)).map((p) => p.id);
}

/**
 * createPosterStore(backend) → { put, get, remove, ids, list, exportAll, importAll }.
 * backend: { metas(), get(id), all(), put(p, thumb|null), delete(id) } (promises). metas() are the small rows of `thumbs`;
 * put and delete touch both stores together.
 */
export function createPosterStore(backend) {
  const safe = async (fn, fallback) => {
    try { return await fn(); } catch { return fallback; }
  };
  const prune = () => safe(async () => {
    for (const id of pruneKeys(await backend.metas())) await backend.delete(id);
  });
  return {
    /** put(p, thumb = null) → true when kept. A card or a thumb that does not pass its check is not kept at all. */
    put: (p, thumb = null) => safe(async () => {
      if (!validPoster(p) || (thumb !== null && !validThumb(thumb))) return false;
      await backend.put(p, thumb);
      await prune();
      return true;
    }, false),
    get: (id) => safe(async () => {
      const p = await backend.get(id);
      return validPoster(p) ? p : null;
    }, null),
    remove: (id) => safe(() => backend.delete(id)),
    ids: () => safe(async () => new Set((await backend.metas()).map((m) => m.id)), new Set()),
    /** list() → [{id, wall, date, made, thumb}] newest first, the cards that have a thumbnail; never reads a big image. */
    list: () => safe(async () => (await backend.metas())
      .filter((m) => validThumb(m.thumb))
      .sort((a, b) => (a.made < b.made ? 1 : a.made > b.made ? -1 : a.id < b.id ? 1 : -1))
      .map(({ id, wall, date, made, thumb }) => ({ id, wall, date, made, thumb })), []),
    exportAll: () => safe(async () => (await backend.all()).filter(validPoster), []),
    importAll: (list) => safe(async () => {
      const have = new Set((await backend.metas()).map((m) => m.id));
      let added = 0;
      let dropped = 0;
      for (const p of Array.isArray(list) ? list : []) {
        if (!validPoster(p)) { dropped++; continue; }
        if (have.has(p.id)) continue;
        await backend.put(p, null);
        have.add(p.id);
        added++;
      }
      await prune();
      return { added, dropped };
    }, { added: 0, dropped: Array.isArray(list) ? list.length : 0 }),
  };
}

const request = (req) => new Promise((ok, no) => {
  req.onsuccess = () => ok(req.result);
  req.onerror = () => no(req.error);
});

/**
 * idbBackend(factory = indexedDB) → the real backend: database 'open-wall-posters' (version 2), stores 'posters' and 'thumbs' (keyPath 'id').
 * A write is one transaction over both stores and is done when it commits. Browser only.
 */
export function idbBackend(factory = globalThis.indexedDB) {
  let opened = null;
  const open = () => (opened ??= new Promise((ok, no) => {
    const req = factory.open('open-wall-posters', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ['posters', 'thumbs']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error);
    req.onblocked = () => no(new Error('blocked'));
  }).catch((e) => { opened = null; throw e; }));
  // a write is done when its transaction commits: a full disk fails there, after every request has already "succeeded"
  const write = async (fn) => {
    const db = await open();
    await new Promise((ok, no) => {
      const tx = db.transaction(['posters', 'thumbs'], 'readwrite');
      fn(tx.objectStore('posters'), tx.objectStore('thumbs'));
      tx.oncomplete = () => ok();
      tx.onabort = tx.onerror = () => no(tx.error ?? new Error('aborted'));
    });
  };
  const read = async (name, fn) => request(fn((await open()).transaction(name, 'readonly').objectStore(name)));
  return {
    all: () => read('posters', (s) => s.getAll()),
    get: (id) => read('posters', (s) => s.get(id)),
    metas: () => read('thumbs', (s) => s.getAll()),
    put: (p, thumb) => write((posters, thumbs) => {
      posters.put(p);
      thumbs.put({ id: p.id, made: p.made, wall: p.wall, date: p.date, thumb });
    }),
    delete: (id) => write((posters, thumbs) => {
      posters.delete(id);
      thumbs.delete(id);
    }),
  };
}
