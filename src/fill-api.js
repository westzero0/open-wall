// src/fill-api.js — fetch adapter for 빈칸 채우기 제보 (worker/fills.js). Empty url = off: no request is ever made.
import { createCaller, fail } from './worker-call.js';
import { FILL_FIELDS, cleanFillValue } from './fill-fields.js';

const STATUSES = ['pending', 'confirmed'];

// idOf(name) → the wall's id or null (src/wall-ids.js); getAuthorId() → this device's authorId or null (src/author-id.js).
export function createFillApi({ url, fetchFn, timeoutMs, idOf = () => null, getAuthorId = () => null }) {
  const base = String(url || '').replace(/\/+$/, '');
  const call = createCaller({ url, fetchFn, timeoutMs });
  return {
    /** the shown fills ({wall_id, field, value, nick, status}); rows that do not check out are dropped. */
    async list() {
      if (!base) return [];
      const raw = await call('/v1/fills');
      const rows = Array.isArray(raw?.fills) ? raw.fills : [];
      return rows.filter((f) => f && typeof f.wall_id === 'string' && FILL_FIELDS.includes(f.field) && STATUSES.includes(f.status) && cleanFillValue(f.field, f.value) != null)
        .map((f) => ({ wall_id: f.wall_id, field: f.field, value: cleanFillValue(f.field, f.value), nick: typeof f.nick === 'string' ? f.nick.slice(0, 12) : '', status: f.status }));
    },
    async submit({ wall, field, value, nick }) {
      if (!base) throw fail('network');
      const wall_id = idOf(wall);
      const author = getAuthorId();
      if (!wall_id || !author) throw fail('bad_request'); // no id, no request: an anonymous fill cannot count
      return call('/v1/fills', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Author-Id': author }, body: JSON.stringify({ wall_id, field, value, nick }) });
    },
  };
}
