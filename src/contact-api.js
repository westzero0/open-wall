// src/contact-api.js — fetch adapter for 서비스 문의 (worker/contact.js). Empty url = off: no request is ever made.
import { createCaller, fail } from './worker-call.js';

export function createContactApi({ url, fetchFn, timeoutMs }) {
  const base = String(url || '').replace(/\/+$/, '');
  const call = createCaller({ url, fetchFn, timeoutMs });
  return {
    async submit({ body, nick = '', reply = '', hp = '' }) {
      if (!base) throw fail('network');
      await call('/v1/contacts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body, nick, reply, hp }) });
    },
  };
}
