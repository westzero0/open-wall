// src/plan-ice-sheet.js — what the ice-venue sheet says and draws, as words and 0~1 coordinates. DOM 없음, 네트워크 없음.
// The screen (planner-ice.js) only draws this. Spec: docs/superpowers/specs/2026-11-17-ice-sheet-design.md.
import { CONDITION_NAME, iceRisk, iceDetail, iceWindow } from './plan-ice.js';
import { iceSeasonRows, statusLine, pastLine, noticeCopy } from './ice-model.js';
import { reserveOf, reserveState, reserveDeadline, reserveCopy, reserveRuleLine } from './reserve.js';
import { ICE_SUN_TEXT, iceRope, cragModel } from './crag-model.js';
import { ROPE_LENGTHS } from './card-model.js';
import { wallPosition } from './viewmodel.js';
import { wallPageId } from './share-id.js';
import { HTTP_URL_RE } from './store.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;
const utc = (d) => Date.parse(`${d}T00:00Z`);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;

/**
 * iceChart(days, { today, from, to, mark }) → null | { lo, hi, days, lines, todayX, summary }
 * days: [{ date, tmin, tmax, rain }] (any order; a day with no low is not drawn). x, y are 0~1 (y 0 = top = hi).
 * A date with no reading keeps its slot (x spacing is by calendar day) so a gap reads as a gap.
 */
export function iceChart(days, { today, from = null, to = null, mark = [] } = {}) {
  const ds = (Array.isArray(days) ? days : []).filter((d) => DAY_RE.test(d?.date ?? '') && num(d.tmin) !== null)
    .map((d) => ({ date: d.date, tmin: d.tmin, tmax: num(d.tmax), rain: num(d.rain) })).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!ds.length) return null;
  const first = utc(ds[0].date);
  const n = Math.round((utc(ds.at(-1).date) - first) / DAY_MS) + 1;
  const lo = Math.floor(Math.min(...ds.map((d) => d.tmin), -10) / 5) * 5 - 5;
  const hi = Math.ceil(Math.max(...ds.flatMap((d) => [d.tmin, d.tmax ?? d.tmin]), 0) / 5) * 5 + 5;
  const y = (t) => (hi - t) / (hi - lo);
  const slot = (date) => (Math.round((utc(date) - first) / DAY_MS) + 0.5) / n;
  const rainDays = ds.filter((d) => d.rain !== null && d.rain > 0).length;
  const mins = ds.map((d) => Math.round(d.tmin));
  return {
    lo, hi,
    days: ds.map((d) => ({ date: d.date, label: md(d.date), x: slot(d.date), yMin: y(d.tmin), yMax: d.tmax === null ? null : y(d.tmax),
      rain: d.rain !== null && d.rain > 0, forecast: !!today && d.date >= today,
      counted: !!from && !!to && d.date >= from && d.date <= to, marked: mark.includes(d.date) })),
    lines: [{ t: 0, y: y(0) }, { t: -10, y: y(-10) }],
    todayX: today && DAY_RE.test(today) && today >= ds[0].date && today <= ds.at(-1).date ? slot(today) : null,
    summary: `${ds.length}일 일 최저 ${Math.min(...mins) || 0}°에서 ${Math.max(...mins) || 0}°${rainDays ? `, 비 ${rainDays}일` : ''}`,
  };
}

/** The four flows the `!` help explains. example: seven days of { tmin, tmax } that meet the linked condition (the chart draws them like the real one). */
const run = (lows, add) => lows.map((t) => ({ tmin: t, tmax: t + add }));
export const ICE_HELP = [
  { id: 'steady', chip: '0도 안팎', links: ['mild'], text: '0도 안팎에서 오르내리며 큰 변화가 없을 때: 얼음이 무르고 도구가 잘 박혀요.',
    example: Array.from({ length: 7 }, () => ({ tmin: -3, tmax: 3 })) },
  { id: 'warm', chip: '밤에도 영상', links: ['warm_night'], text: '밤에도 영하로 내려가지 않을 때: 얼음이 바위에서 떨어지며 무너질 수 있어요.',
    example: [[1, 6], [2, 7], [3, 8], [2, 9], [1, 7], [2, 8], [3, 9]].map(([tmin, tmax]) => ({ tmin, tmax })) },
  { id: 'drop', chip: '갑자기 영하', links: ['rapid_drop'], text: '영상에서 갑자기 영하로 떨어질 때: 얼음이 줄어들며 금이 가고 깨지기 쉬워요.',
    example: [[1, 6], [2, 7], [1, 6], [-9, -3], [-10, -4], [-9, -3], [-8, -2]].map(([tmin, tmax]) => ({ tmin, tmax })) },
  { id: 'slow', chip: '천천히 추워짐', links: [], text: '천천히 오래 추워질 때: 얼음이 단단하지만 깨지기 쉽고 큰 덩어리가 떨어질 수 있어요.',
    example: run([0, -2, -4, -6, -8, -10, -12], 5) },
];

/** exampleDays(help) → days iceChart can take. The dates are placeholders (the screen draws no date labels for an example). */
export const exampleDays = (help) => help.example.map((e, i) => ({
  date: new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10), tmin: e.tmin, tmax: e.tmax, rain: 0 }));

/** helpDots(conditions) → Set of ICE_HELP ids whose linked condition is among the met ones (a dot on the chip marks it). */
export const helpDots = (conditions) => {
  const met = new Set((conditions ?? []).map((c) => c?.id));
  return new Set(ICE_HELP.filter((h) => h.links.some((id) => met.has(id))).map((h) => h.id));
};

/** One line per condition: where its number comes from. Paper names are not shown (사용자 2026-11-17); they stay in .scratch/ice-climbing/criteria-verify-2026-11-16.md. */
const SOURCE_V = {
  warm_night: '일 최저가 0도를 넘는 날 수 (3일 이상은 예비 기준)',
  mild: '일 최고 0~5도, 일 최저 영하인 날',
  cold: '일 최저가 영하 10도 아래인 날',
  rapid_drop: '24시간 안에 10도 이상 하강',
  freeze: '일 최고가 0도 아래인 날 수, 형성 참고 (폭포 한 곳의 사례)',
  rain: '관측·예보 값 그대로',
};
export const ICE_SOURCES = Object.keys(SOURCE_V).map((id) => ({ id, k: CONDITION_NAME[id], v: SOURCE_V[id] }));
export const ICE_HELP_DAILY_NOTE = '매시 기온이 없으면 급강하는 일 최고·최저로 어림해요';
export const ICE_HELP_CLOSING = '얼음은 날마다 달라 최근에 오른 사람의 정보가 중요해요(국립등산학교 표준 등산 교재). 앱은 안전 여부를 판단하지 않아요.';

/** findIce(ice, id) → the ice venue (a waterfall or wall, not the mountain entry) whose page id is id, or null. Only an id found here may be asked about. */
export const findIce = (ice, id) => (Array.isArray(ice) ? ice.find((w) => w && w.type !== 'mountain' && wallPageId(w) === id) ?? null : null);

const safeNotice = (n) => (n ? { ...n, url: HTTP_URL_RE.test(n.url ?? '') ? n.url : null } : null); // a link only when it is http(s)
const KIND_WORD = { artificial: '인공', natural: '자연' };
const EMPTY_COND = { state: 'nopos', message: null, period: null, rows: [], trendText: null, closing: null, chart: null, dots: new Set() };

function condOf(place, { date, today, wx, wxLoaded, mark }) {
  if (!wallPosition(place)) return { ...EMPTY_COND, message: '기온 정보 없음(위치 미등록)' };
  const data = wx?.ice?.byId?.get?.(wallPageId(place)); // by id only: another venue's temperatures never show here
  if (!data) return wxLoaded === false ? { ...EMPTY_COND, state: 'loading', message: '기온을 불러오는 중이에요' } : { ...EMPTY_COND, state: 'failed', message: '기온을 불러오지 못했어요' };
  const base = date ?? today;
  const risk = iceRisk({ kind: 'ice', located: true, ice: place }, { date: base }, wx, { today });
  if (!iceWindow(data, base, today)) return { ...EMPTY_COND, state: 'nodata', message: risk.phrase, chart: iceChart(data.days, { today, mark }) };
  const d = iceDetail(risk.ice);
  return { state: 'ok', message: null, period: d.period, rows: d.rows, trendText: d.trend, closing: d.closing,
    chart: iceChart(data.days, { today, from: risk.ice.from, to: risk.ice.to, mark }), dots: helpDots(risk.ice.conditions) };
}

function factsOf(place, at) {
  const facts = [];
  const state = at ? cragModel(place, at).state : null;
  if (state === 'sun' || state === 'shade') facts.push({ k: '해', v: ICE_SUN_TEXT[state] });
  const rope = iceRope(place);
  if (rope) facts.push({ k: '로프', v: rope.over ? `${ROPE_LENGTHS.at(-1)}m 초과` : `${rope.m}m 이상` });
  if (Number.isFinite(place.capacity) && place.capacity > 0) facts.push({ k: '정원', v: `${place.capacity}명` });
  if (typeof place.access_note === 'string' && place.access_note) facts.push({ k: '접근', v: place.access_note });
  return facts;
}

/**
 * iceSheetModel(place, { date, today, wx, wxLoaded, byId, at, mark }) → { name, kind, region, season, reserve, cond, facts }
 * Every word and number the ice sheet shows. date: the plan's day (null = today is the reference day). A line with nothing to say is null / not in the list.
 */
export function iceSheetModel(place, { date = null, today, wx, wxLoaded = true, byId, at = null, mark = [] } = {}) {
  const { current, past } = iceSeasonRows(place, today, byId);
  const season = current || past.length ? {
    line: current ? statusLine(current) : null, notice: safeNotice(current ? noticeCopy(current) : null), past: past.slice(0, 2).map(pastLine) } : null;
  const rule = reserveOf(place, byId);
  let reserve = null;
  if (rule?.required) {
    const copy = date ? reserveCopy(reserveState({ plan: { status: '예정', date }, reserve: rule, today, reserved: false }), { deadline: reserveDeadline(date, rule.daysBefore), checkedAt: rule.checkedAt }) : null;
    reserve = { line: copy?.line ?? reserveRuleLine(rule), url: rule.url, name: rule.name, note: rule.note ?? null, checked: copy?.checked ?? null };
  }
  return { name: place.name, kind: KIND_WORD[place.ice_kind] ?? null, region: place.region ?? null, season, reserve,
    cond: condOf(place, { date, today, wx, wxLoaded, mark }), facts: factsOf(place, at) };
}
