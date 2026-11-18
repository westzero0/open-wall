// src/plan-ice.js — what an ice plan says about the week before it: the conditions its temperatures meet, as facts. DOM 없음, 네트워크 없음.
// 등급·안전 판단은 만들지 않는다(색 단계 없음): level은 'ice'(센 결과) 아니면 'none'(자료 없음)뿐이다.
// Spec: docs/superpowers/specs/2026-11-16-ice-planner-design.md. 문구는 이 파일에서만 만든다.
import { iceConditions } from './ice-cond.js';
import { wallPageId } from './share-id.js';

export const ICE_FLAG_TEXT = '확인할 것 있음';
export const ICE_LINE_MAX = 2; // conditions named in the one-line phrase; the rest are counted ("외 N개") and listed in the detail
export const ICE_DAYS = 7; // the plan's day and the six before it (사용자 결정 2026-11-16)
const DAY_MS = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const utc = (d) => Date.parse(`${d}T00:00Z`);

/** names of the conditions ice-cond.js counts (the detail's "알 수 없음" lines use them) */
export const CONDITION_NAME = { warm_night: '밤 최저 영상', mild: '낮 0~5도·밤 영하', cold: '영하 10도 아래', rapid_drop: '하루 사이 급강하', rain: '비', freeze: '종일 영하' };
/** freeze is a formation reference (natural ice), not something to check before going: it stays out of the one-line phrase and the flag. */
export const REFERENCE_ONLY = new Set(['freeze']);

/** conditionWords(c) → one met condition in words; '' for an id this file does not know. */
export function conditionWords(c) {
  if (c?.id === 'rapid_drop') return `하루 사이 ${Math.round(c.drop)}도 하강`;
  if (c?.id === 'cold') return `${CONDITION_NAME.cold} ${c.nights ?? c.count}일`; // nights: days whose low went below −10°C
  return Object.hasOwn(CONDITION_NAME, c?.id ?? '') ? `${CONDITION_NAME[c.id]} ${c.count}일` : '';
}

/**
 * iceWindow(data, planDate, today) → { days, hours, forecast } | null
 * data: one place of parseIceForecast ({ days, hours }). days/hours of planDate-6 … planDate; forecast = some of those days are today or later.
 * null when planDate itself is not in the data (too far ahead, or nothing loaded).
 */
export function iceWindow(data, planDate, today) {
  if (!DATE_RE.test(planDate ?? '') || !Array.isArray(data?.days)) return null;
  const to = utc(planDate);
  const from = to - (ICE_DAYS - 1) * DAY_MS;
  const inside = (d) => DATE_RE.test(d ?? '') && utc(d) >= from && utc(d) <= to;
  const days = data.days.filter((d) => inside(d?.date));
  if (!days.some((d) => d.date === planDate)) return null;
  const hours = (data.hours ?? []).filter((h) => inside(String(h?.time ?? '').slice(0, 10)));
  return { days, hours, forecast: days.some((d) => d.date >= today) };
}

const none = (phrase, far) => ({ level: 'none', phrase, reason: null, far, note: null, flag: false, ice: null });

/**
 * iceRisk(resolved, plan, wx, { today, far, noForecast }) → { level, phrase, reason: null, far, note: null, flag, ice }
 * resolved: resolvePlace's ice result. wx.ice.byId: Map id → { days, hours }. noForecast(): the caller's "예보는 M/D부터" words.
 * ice: { from, to, forecast, conditions, unknown, trend } when counted, else null. flag: at least one condition is met.
 */
export function iceRisk(resolved, plan, wx, { today, far = false, noForecast = () => '아직 예보 없음' } = {}) {
  if (resolved?.ice?.type === 'mountain') return none('폭포를 골라야 기온을 볼 수 있어요', far);
  if (!resolved?.located) return none('기온 정보 없음(위치 미등록)', far);
  const data = wx?.ice?.byId?.get?.(wallPageId(resolved.ice));
  if (!data) return none('기온을 불러오지 못했어요', far);
  const win = iceWindow(data, plan?.date, today);
  if (!win) return none(noForecast(), far);
  const r = iceConditions(win.days, { kind: resolved.ice?.ice_kind ?? null, hours: win.hours });
  const words = r.conditions.filter((c) => !REFERENCE_ONLY.has(c.id)).map(conditionWords).filter(Boolean);
  const missing = ICE_DAYS - win.days.filter((d) => typeof d.tmin === 'number' && Number.isFinite(d.tmin)).length; // days of the week with no low: said, never read as "없음"
  const tail = (missing > 0 ? ` · ${missing}일은 기온 없음` : '') + (win.forecast ? ' (예보 포함)' : '');
  const phrase = missing >= ICE_DAYS ? '기온을 알 수 없어요' : (words.length ? words.slice(0, ICE_LINE_MAX).join(' · ') + (words.length > ICE_LINE_MAX ? ` 외\u00a0${words.length - ICE_LINE_MAX}개` : '') : '해당 조건 없음') + tail;
  return { level: 'ice', phrase, reason: null, far, note: null, flag: words.length > 0,
    ice: { from: r.from, to: r.to, forecast: win.forecast, missing, conditions: r.conditions, unknown: r.unknown, trend: r.trend } };
}

const md = (d) => `${+String(d).slice(5, 7)}/${+String(d).slice(8, 10)}`;
const deg = (t) => (typeof t === 'number' && Number.isFinite(t) ? `${Math.round(t) || 0}°` : '—'); // a missing number is never drawn as 0°
const num = (t) => (typeof t === 'number' && Number.isFinite(t) ? t : null);

/** The plan day's min/max °C from the ice weather already loaded; null when there is nothing to read (mountain, no location, no data, day gone). */
export function iceDayTemp(resolved, plan, wx) {
  if (!resolved?.ice || resolved.ice.type === 'mountain' || !resolved.located) return null;
  const day = wx?.ice?.byId?.get?.(wallPageId(resolved.ice))?.days?.find((d) => d.date === plan?.date);
  const tmin = num(day?.tmin), tmax = num(day?.tmax);
  return tmin == null && tmax == null ? null : { tmin, tmax };
}

/** ['최저 -8°', '최고 -1°'] — only the sides that are numbers. */
export const iceTempWords = (ice) => [['최저', ice?.tmin], ['최고', ice?.tmax]].filter(([, t]) => num(t) != null).map(([n, t]) => `${n} ${deg(t)}`);

const DROP_DATES = (c) => [...new Set(c.basis === 'daily' ? [c.from.date, c.to.date] : [c.from.time.slice(0, 10), c.to.time.slice(0, 10)])];
const DETAIL_V = {
  warm_night: (c) => c.dates.map(md).join(', '),
  mild: (c) => c.dates.map(md).join(', '),
  cold: (c) => `${c.dates.map(md).join(', ')} · 가장 낮은 기온 ${deg(c.coldest)}`,
  rapid_drop: (c) => (c.basis === 'daily'
    ? `${md(c.from.date)} 최고 ${deg(c.from.t)} → ${md(c.to.date)} 최저 ${deg(c.to.t)} (일 최고·최저로 어림)`
    : `${md(c.from.time)} ${c.from.time.slice(11, 13)}시 ${deg(c.from.t)} → ${md(c.to.time)} ${c.to.time.slice(11, 13)}시 ${deg(c.to.t)}`),
  rain: (c) => `${c.dates.map(md).join(', ')} · 합계 ${c.mm}mm`,
  freeze: (c) => `${c.dates.map(md).join(', ')} · 형성 참고`,
};

/**
 * iceDetail(ice) → { period, rows: [{ id, k, v, note, dates }], trend, closing } for the plan detail, or null. Words only: the screen draws them as they are.
 * rows: met conditions (date · number · source), then the ones that could not be measured ("알 수 없음", never "없음"). trend: the daily lows, no label.
 */
export function iceDetail(ice) {
  if (!ice) return null;
  const met = ice.conditions.filter((c) => DETAIL_V[c.id]).map((c) => ({
    id: c.id, k: conditionWords(c), v: DETAIL_V[c.id](c), note: c.id === 'warm_night' ? `${c.prelimDays ?? 3}일은 논문 결론의 예비 기준이에요` : null,
    dates: c.id === 'rapid_drop' ? DROP_DATES(c) : [...(c.dates ?? [])] }));
  const unknown = ice.unknown.filter((id) => Object.hasOwn(CONDITION_NAME, id)).map((id) => ({ id, k: CONDITION_NAME[id], v: '알 수 없음', note: null, dates: [] }));
  return {
    period: `${md(ice.from)} ~ ${md(ice.to)} 기온 기준${ice.missing > 0 ? ` · ${ice.missing}일은 기온 없음` : ''}${ice.forecast ? ' · 예보 포함' : ''}`,
    rows: [...met, ...unknown],
    trend: ice.trend.map((t) => `${md(t.date)} ${deg(t.tmin)}`).join(' · '),
    closing: '기온에서 센 사실이에요. 얼음 상태는 현장에서 확인하세요.',
  };
}
