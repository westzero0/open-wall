// The network side of plan-crowd: the existing crowd form out, the published CSV back. Never throws.
import { config } from './config.js';
import { canReport, crowdPayload, markSent, parseCrowdCsv, crowdReady } from './crowd.js';
import { postForm, getText } from './remote.js';
import { wallPageId } from './share-id.js';

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** → {ok, sent}: `sent` is the store to keep (marked on success, unchanged otherwise). */
export async function sendCrowd({ resolved, plan, level, sent, fetchFn, now = Date.now() }) {
  if (!crowdReady(config.crowdEndpoint, config.crowdFields) || !Number.isInteger(plan?.min) || !resolved?.name) return { ok: false, sent };
  const when = `${plan.date} ${hhmm(plan.min)}`;
  if (!canReport(sent, resolved.name, +now, when).ok) return { ok: false, sent };
  try {
    const id = resolved.wall ? wallPageId(resolved.wall) : '';
    await postForm(config.crowdEndpoint, crowdPayload(config.crowdFields, resolved.name, level, when, id), { fetchFn });
    return { ok: true, sent: markSent(sent, resolved.name, +now, when) };
  } catch { return { ok: false, sent }; }
}

export async function loadCrowdReports({ fetchFn, names, now = new Date() }) {
  if (!config.crowdCsvUrl) return [];
  try { return parseCrowdCsv(await getText(config.crowdCsvUrl, { fetchFn }), names, now); } catch { return []; }
}
