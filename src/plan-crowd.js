// When to ask "how crowded was it?" for a plan, and the hint shown before a visit. No DOM, no storage, no network.
import { aggregate, canReport, parseWhen, MIN_REPORTS } from './crowd.js';

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const whenOf = (plan) => (Number.isInteger(plan?.min) ? `${plan.date} ${hhmm(plan.min)}` : null);

/** `ready` = crowdReady(config.crowdEndpoint, config.crowdFields), passed in by the caller. */
export function shouldAsk(plan, resolved, { settings, sent, now = Date.now(), ready } = {}) {
  const when = whenOf(plan);
  return Boolean(ready && when && resolved?.kind === 'wall' && settings?.crowdAsk && settings.crowdSkips < 3
    && plan.record?.crowdAsked !== true && canReport(sent, resolved.name, +now, when).ok);
}

export const skipped = (s) => ({ ...s, crowdSkips: Math.min(3, (s.crowdSkips ?? 0) + 1) });
export const answered = (s) => ({ ...s, crowdSkips: 0 });

/** { level: '여유'|'보통'|'혼잡', n } when enough reports cover the plan's time, else null. */
export function crowdLevel(reports, resolved, plan, now = new Date()) {
  const at = parseWhen(whenOf(plan));
  if (!at || !resolved?.name) return null;
  const { level, n } = aggregate(reports, resolved.name, at, { now: new Date(+now) });
  return level && n >= MIN_REPORTS ? { level, n } : null;
}

export function crowdHint(reports, resolved, plan, now = new Date()) {
  const c = crowdLevel(reports, resolved, plan, now);
  return c ? `이 시간엔 대체로 ${c.level}${c.level === '여유' ? '예요' : '이에요'} · 제보 ${c.n}건` : null;
}
