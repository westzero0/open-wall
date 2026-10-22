// 등반 컨디션: 자연암장은 비가 온 뒤 벽이 마르는 데 며칠이 걸린다(dry_days). 그날의 비, 그 전 며칠의 비, 예보를 보고
// 그날의 상태를 말한다. 순수 함수, DOM·네트워크 없음 (docs/superpowers/specs/2026-10-21-crag-ui-design.md 3절).
// 판정은 예상일 뿐이다: 호출하는 쪽이 "현장과 다를 수 있어요"를 같이 보여 준다.
import { dayKey, RAIN_PROB } from './weather.js';

export const DAMP_MM = 1; // 이만큼부터 벽이 젖는다(축축한 날): 마르는 시간이 절반
export const WET_MM = 5; // 하루 강수량이 이만큼이면 "젖는 날" (시작값, 데이터가 쌓이면 여기서 조정한다)
export const FORECAST_DAYS = 7; // 오늘 + 6일: 예보가 닿는 범위
export const dampDays = (dryDays) => (dryDays <= 0 ? 0 : Math.max(1, Math.ceil(dryDays / 2)));

const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a, b) => Math.round((midnight(b) - midnight(a)) / 864e5); // DST-safe
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * conditionOf(daily, dryDays, target, now) → { state, daysLeft, far } (+ why: 'no-forecast' when unknown, 'dry-week' / 'no-dry-days' without dry_days)
 * daily: Map 'YYYY-MM-DD' → { mm, p (null when unknown), g } for this crag (past seven days + forecast), or null.
 * state: 'good' (좋아 보여요) | 'drying' (마르는 중일 수 있어요, daysLeft days to go) | 'rain' (target is a wet day) |
 *        'recent' (no dry_days and a damp or wet day in the week up to the target: daysSince from the latest one, its rounded mm,
 *        today = the target is today) | 'unknown' (no forecast) | 'out' (before today or past the forecast range).
 * Without dry_days a week with no damp day is 'good' (why 'dry-week'): dry_days is at most 7 (store.js), so the value cannot matter.
 * far: the target is three or more days away (the forecast may still change).
 */
export function conditionOf(daily, dryDays, target, now = new Date()) {
  const diff = daysBetween(now, target);
  if (diff < 0 || diff >= FORECAST_DAYS) return { state: 'out', daysLeft: null, far: false };
  const far = diff >= 3;
  const result = (state, daysLeft = null, why) => ({ state, daysLeft, far, ...(why && { why }) });
  const today = dayKey(now);
  const entry = (day) => daily?.get(dayKey(day));
  // the amount alone sets the level; a probability only matters for a rain forecast on the target (today and later)
  const levelOf = (day) => {
    const e = entry(day);
    return !e ? null : e.mm >= WET_MM ? 'full' : e.mm >= DAMP_MM ? 'damp' : null;
  };
  const t = entry(target);
  if (!t) return result('unknown', null, 'no-forecast');
  if (t.mm >= WET_MM || (dayKey(target) >= today && t.p !== null && t.p >= RAIN_PROB && t.mm >= DAMP_MM)) return result('rain'); // does not need dry_days
  if (!Number.isInteger(dryDays) || dryDays < 0) {
    for (let i = 0; i <= 7; i++) {
      const e = entry(addDays(target, -i));
      if (e && e.mm >= DAMP_MM) return { ...result('recent', null, 'no-dry-days'), daysSince: i, mm: Math.round(e.mm), today: dayKey(target) === today };
    }
    return result('good', null, 'dry-week'); // ponytail: a missing past day counts as dry (the request always asks past_days=7)
  }
  let left = 0;
  for (let i = 1; i <= 7; i++) {
    const level = levelOf(addDays(target, -i));
    if (level) left = Math.max(left, (level === 'full' ? dryDays : dampDays(dryDays)) - i);
  }
  return left > 0 ? result('drying', left) : result('good');
}
