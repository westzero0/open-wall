// src/author-id.js — this device's authorId: 32 random hex chars, made when the first post or photo is about to go out and kept in
// storage. The Worker keeps only its SHA-256, so the id links one device's posts (and, after a login, joins an account); it
// authorizes nothing. No DOM: the caller passes the storage accessors.
export const AUTHOR_KEY = 'open-wall:author';
export const AUTHOR_RE = /^[0-9a-f]{32}$/;

const read = (get) => { try { const v = get(AUTHOR_KEY); return typeof v === 'string' && AUTHOR_RE.test(v) ? v : null; } catch { return null; } };

/** the saved id, or null; never writes. */
export const peekAuthorId = ({ get }) => read(get);

/**
 * getAuthorId({ get, set, random }) → the saved id, or a new one that `set` accepted (set returns true). Blocked storage → null:
 * an id that cannot be kept would change on every post, so it is not sent at all.
 */
export function getAuthorId({ get, set, random = (a) => crypto.getRandomValues(a) }) {
  const have = read(get);
  if (have) return have;
  const id = [...random(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  try { return set(AUTHOR_KEY, id) === true ? id : null; } catch { return null; }
}
