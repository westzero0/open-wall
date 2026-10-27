// src/board-api.js — fetch adapter for the 한 줄 타임라인 Worker (worker/API.md). Empty url = feature off: no request is ever made.
import { PAGE, parseBoard, parseReplies, parseToken, parseTotal } from './board.js';

const fail = (code) => Object.assign(new Error(code), { code });
const codeOf = (status) => (status === 429 ? 'rate_limited' : status >= 400 && status < 500 ? 'bad_request' : 'server');

export function createBoardApi({ url, fetchFn = (...a) => fetch(...a), timeoutMs = 8000 }) {
  const base = String(url || '').replace(/\/+$/, '');
  async function call(path, init = {}) {
    if (!base) throw fail('network');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchFn(base + path, { ...init, credentials: 'omit', signal: ctl.signal });
      if (!r.ok) throw fail(codeOf(r.status));
      return r.status === 204 ? null : await r.json();
    } catch (e) {
      throw e.code ? e : fail('network'); // fetch rejection, abort (timeout) or unreadable body
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async list(wall, { before } = {}) {
      if (!base) return { posts: [], total: null };
      const q = `wall=${encodeURIComponent(wall)}&limit=${PAGE}${before != null ? `&before=${encodeURIComponent(before)}` : ''}`;
      const raw = await call(`/v1/posts?${q}`);
      return { posts: parseBoard(raw, wall, Date.now()), total: parseTotal(raw) };
    },
    async summary() { // the raw answer of GET /v1/summary (board-summary.js parses it); off without a url
      if (!base) return null;
      return call('/v1/summary');
    },
    async replies(wall, id) {
      if (!base) return [];
      return parseReplies(await call(`/v1/posts/${encodeURIComponent(id)}/replies`), wall, Date.now());
    },
    async post({ wall, nick, body, hp = '', parent }) {
      const raw = await call('/v1/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wall, nick, body, hp, ...(parent ? { parent } : {}) }) });
      const [p] = parseBoard({ posts: [raw?.post] }, wall, Date.now());
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
