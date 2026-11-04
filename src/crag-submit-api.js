// src/crag-submit-api.js — fetch adapter for 새 암장 제보 (worker/crags.js). Empty url = off: no request is ever made.
import { createCaller, fail } from './worker-call.js';
import { cleanCragApiRow } from './crag-submit-store.js';

const rows = (raw) => (Array.isArray(raw?.crags) ? raw.crags.map(cleanCragApiRow).filter(Boolean) : []);

// getAuthorId() → this device's authorId (made if missing) or null, for writes; peekAuthorId() → the saved id or null, never creates (src/author-id.js).
export function createCragSubmitApi({ url, fetchFn, timeoutMs, getAuthorId = () => null, peekAuthorId = getAuthorId }) {
  const base = String(url || '').replace(/\/+$/, '');
  const call = createCaller({ url, fetchFn, timeoutMs });
  const authed = async (path, init = {}, getId = getAuthorId) => {
    if (!base) throw fail('network');
    const author = getId();
    if (!author) throw fail('bad_request'); // no id, no request
    return call(path, { ...init, headers: { ...init.headers, 'X-Author-Id': author } });
  };
  const json = { 'content-type': 'application/json' };
  const one = (raw) => { const c = cleanCragApiRow(raw?.crag); if (!c) throw fail('server'); return c; };
  return {
    async submit({ name, kind, lat, lng, facing, nick }) {
      return one(await authed('/v1/crags', { method: 'POST', headers: json, body: JSON.stringify({ name, kind, lat, lng, ...(facing ? { facing } : {}), ...(nick ? { nick } : {}) }) }));
    },
    async addFacing(id, facing) {
      return one(await authed(`/v1/crags/${encodeURIComponent(id)}`, { method: 'PATCH', headers: json, body: JSON.stringify({ facing }) }));
    },
    async list() { return base ? rows(await call('/v1/crags')) : []; },
    async nearby(lat, lng) { return base ? rows(await call(`/v1/crags?near=${encodeURIComponent(`${lat},${lng}`)}`)) : []; },
    async mine() { // peek only: a visitor who never submitted gets no id minted and no request
      if (!base) throw fail('network');
      if (!peekAuthorId()) return [];
      return rows(await authed('/v1/crags/mine', {}, peekAuthorId));
    },
    async report(id) { await authed(`/v1/crags/${encodeURIComponent(id)}/report`, { method: 'POST' }); },
  };
}
