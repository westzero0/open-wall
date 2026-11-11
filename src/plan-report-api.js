// Sends a new-wall report through the existing report form. Never throws.
import { config } from './config.js';
import { validateReport, buildPayload } from './report.js';
import { postForm } from './remote.js';

export const REPORT_OK = '알렸어요, 고마워요';
export const REPORT_LATER = '나중에 다시 알릴게요';
export const OFFER_ASK = '이 암장을 운영자에게 알릴까요?';
export const NAME_ONLY_NOTE = '목록에 없어도 일정은 잡혀요';

/** → {state:'off'|'sent'|'later'}: one silent retry, then 'later' (the screen says it). */
export async function sendNewWall(input, { fetchFn, buildLabel } = {}) {
  if (!/^https?:\/\//.test(config.reportEndpoint ?? '')) return { state: 'off' };
  const v = validateReport(input, new Date(), { nick: 'off' });
  if (!v.ok) return { state: 'later' };
  const body = buildPayload(v.report, '', typeof buildLabel === 'function' ? buildLabel() : '');
  for (let i = 0; i < 2; i++) {
    try { await postForm(config.reportEndpoint, body, { fetchFn }); return { state: 'sent' }; } catch { /* retry once */ }
  }
  return { state: 'later' };
}
