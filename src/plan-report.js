// "새 암장 알리기": when to offer it once, and what it sends. No DOM, no storage, no network.
import { cleanLine } from './clean-line.js';
import { MAX_NAME, MAX_REGION, MAX_ADDRESS } from './store.js';

const VENUE = { indoor: '실내', outdoor: '야외' };
const nfc = (s) => String(s ?? '').trim().normalize('NFC');

export const reportKey = (place) => (place?.kind === 'mine' ? `mine:${place.id}` : `name:${nfc(place?.name)}`);

/** → {key} while an unlocated mine/name place may be offered for reporting; null otherwise (official, off, dismissed, already sent). */
export function offerFor(plan, resolved, settings, ready) {
  if (!ready || resolved?.located !== false || (resolved.kind !== 'mine' && resolved.kind !== 'name')) return null;
  const key = reportKey(resolved.kind === 'mine' ? plan.place : { kind: 'name', name: resolved.name });
  return settings.reportDismissed.includes(key) || settings.reportedKeys.includes(key) ? null : { key };
}

export const dismiss = (s, key) => ({ ...s, reportDismissed: [...new Set([...s.reportDismissed, key])] });
export const markReported = (s, key) => ({ ...s, reportedKeys: [...new Set([...s.reportedKeys, key])] });

export function reportInput(resolved) {
  const m = resolved?.mineWall ?? {};
  const parts = [
    ['지역', cleanLine(m.region, MAX_REGION)],
    ['구분', VENUE[resolved?.venue] ?? ''],
    ['주소', cleanLine(m.address, MAX_ADDRESS)],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  return { name: cleanLine(resolved?.name, MAX_NAME), kind: '기타', body: parts.length ? `[새 암장]\n${parts.join(' · ')}` : '[새 암장]' };
}
