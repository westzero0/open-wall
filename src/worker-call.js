// src/worker-call.js — the one fetch wrapper for the board Worker's adapters (board-api.js, fill-api.js): no cookies, a timeout, and
// errors reduced to a code: 'network' | 'rate_limited' | 'bad_request' | 'server'. An empty url never makes a request.
export const fail = (code) => Object.assign(new Error(code), { code });
const codeOf = (status) => (status === 429 ? 'rate_limited' : status >= 400 && status < 500 ? 'bad_request' : 'server');

export function createCaller({ url, fetchFn = (...a) => fetch(...a), timeoutMs = 8000 }) {
  const base = String(url || '').replace(/\/+$/, '');
  return async function call(path, init = {}) {
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
  };
}
