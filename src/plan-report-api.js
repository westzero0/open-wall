// Sends a new-wall report through the existing report form. Never throws.
import { config } from './config.js';
import { validateReport, buildPayload } from './report.js';
import { postForm } from './remote.js';

export const REPORT_OK = '알렸어요, 고마워요';
export const REPORT_LATER = '나중에 다시 알릴게요';
export const OFFER_ASK = '이 암장을 운영자에게 알릴까요?';

export const reportOn = () => /^https?:\/\//.test(config.reportEndpoint ?? '');

/** → {state:'off'|'sent'|'later'}: one silent retry, then 'later' (the screen says it). */
async function send(input, { crag, fetchFn, buildLabel } = {}) {
  if (!reportOn()) return { state: 'off' };
  const v = validateReport(input, new Date(), { nick: 'off', ...(crag ? { crag: true } : {}) });
  if (!v.ok) return { state: 'later' };
  const body = buildPayload(v.report, '', typeof buildLabel === 'function' ? buildLabel() : '');
  for (let i = 0; i < 2; i++) {
    try { await postForm(config.reportEndpoint, body, { fetchFn }); return { state: 'sent' }; } catch { /* retry once */ }
  }
  return { state: 'later' };
}

export const sendNewWall = (input, opts) => send(input, { ...opts, crag: false });
/** input {name, kind, body} like validateReport; crag:true → only CRAG_KINDS. */
export const sendPlaceReport = send;
