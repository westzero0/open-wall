// src/tap-api.js — fetch adapter for the 운영시간 탭 제보 routes of the board Worker (worker/taps.js). Empty url = off: no request is ever made.
// ponytail: the same call() as board-api.js; merge both into remote.js when the fetches are gathered there (server-migration-principles, tidy item 4).
const fail = (code) => Object.assign(new Error(code), { code });

export function createTapApi({ url, fetchFn = (...a) => fetch(...a), timeoutMs = 8000 }) {
  const base = String(url || '').replace(/\/+$/, '');
  async function call(path, init = {}) {
    if (!base) throw fail('network');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchFn(base + path, { ...init, credentials: 'omit', signal: ctl.signal });
      if (!r.ok) throw fail(r.status === 429 ? 'rate_limited' : r.status >= 400 && r.status < 500 ? 'bad_request' : 'server');
      return r.status === 204 ? null : await r.json();
    } catch (e) {
      throw e.code ? e : fail('network');
    } finally {
      clearTimeout(timer);
    }
  }
  const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return {
    on: Boolean(base),
    /** tap: the body from buildTap(). → the row's id (a string) */
    async send(tap) {
      const out = await call('/v1/taps', json('POST', tap));
      if (typeof out?.id !== 'string' || out.id.length > 64) throw fail('server');
      return out.id;
    },
    async setOnsite(id, onsite) {
      await call(`/v1/taps/${encodeURIComponent(id)}`, json('PATCH', { onsite: Boolean(onsite) }));
    },
    /** the raw answer of GET /v1/tap-summary (parseTapSummary in tap.js cleans it); null when off */
    async summary() {
      return base ? call('/v1/tap-summary') : null;
    },
  };
}
