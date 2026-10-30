// src/board-api.js — fetch adapter for the 한 줄 타임라인 Worker (worker/API.md). Empty url = feature off: no request is ever made.
import { PAGE, parseBoard, parseReplies, parseToken, parseTotal } from './board.js';
import { createCaller, fail } from './worker-call.js';

// idOf(name) → the wall's id or null (src/wall-ids.js); getAuthorId() → this device's authorId or null (src/author-id.js). Both are only
// asked once a request is really going out, so an empty url never makes an id.
export function createBoardApi({ url, fetchFn = (...a) => fetch(...a), timeoutMs = 8000, idOf = () => null, getAuthorId = () => null }) {
  const base = String(url || '').replace(/\/+$/, '');
  const call = createCaller({ url, fetchFn, timeoutMs });
  return {
    async list(wall, { before } = {}) {
      if (!base) return { posts: [], total: null };
      const id = idOf(wall);
      const q = `${id ? `wall_id=${encodeURIComponent(id)}` : `wall=${encodeURIComponent(wall)}`}&limit=${PAGE}${before != null ? `&before=${encodeURIComponent(before)}` : ''}`;
      const raw = await call(`/v1/posts?${q}`);
      return { posts: parseBoard(raw, { id: idOf(wall), name: wall }, Date.now()), total: parseTotal(raw) };
    },
    async summary() { // the raw answer of GET /v1/summary (board-summary.js parses it); off without a url
      if (!base) return null;
      return call('/v1/summary');
    },
    async replies(wall, id) {
      if (!base) return [];
      return parseReplies(await call(`/v1/posts/${encodeURIComponent(id)}/replies`), { id: idOf(wall), name: wall }, Date.now());
    },
    async post({ wall, nick, body, hp = '', parent }) {
      const wallId = idOf(wall);
      const headers = { 'content-type': 'application/json' };
      const author = base ? getAuthorId() : null;
      if (author) headers['X-Author-Id'] = author;
      const raw = await call('/v1/posts', { method: 'POST', headers, body: JSON.stringify({ ...(wallId ? { wall_id: wallId } : { wall }), nick, body, hp, ...(parent ? { parent } : {}) }) });
      const [p] = parseBoard({ posts: [raw?.post] }, { id: wallId, name: wall }, Date.now());
      if (!p) throw fail('server');
      return { post: p, token: parseToken(raw) };
    },
    async remove(id, token) {
      await call(`/v1/posts/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-Delete-Token': token } });
    },
    async report(id) {
      await call(`/v1/posts/${encodeURIComponent(id)}/report`, { method: 'POST' });
    },
  };
}
