// 싱글피치 컨디션: 비 온 뒤 벽이 마른 정도를 날씨 데이터로 계산한다(젖음 양동이 W, 설계 11-6). 순수 함수, DOM·네트워크 없음.
// 상수는 전부 현장 제보로 맞추기 전의 추정값이다: 화면에 숫자 W를 내지 않고 상태와 근거 문장만 낸다.
import { isSunlit } from './sun.js';
import { RAIN_MM, RAIN_PROB, dayKey } from './weather.js';

export const WETNESS = Object.freeze({
  rainOnWall: 0.3, // a: 벽에 닿는 비 비율(수직 벽은 대부분 흘러내림)
  melt: 0.5, // mm/h per ℃ 위: 눈 녹는 속도
  Ebase: 0.061, // mm/h per kPa: 증기압 결손(VPD) 1kPa·무풍일 때의 마름(10℃·습도 60%에서 예전 선형 식과 같아지게 맞춤)
  Esun: 0.0004, // mm/h per W/m²: 벽에 해가 들 때 일사 마름
  EsunMax: 0.3, // mm/h: 일사 마름 상한(비·기온·바람이 골격)
  wind: 0.15, // 바람 보정 1 + wind·ln(1+v): 무풍이어도 마르고, 센 바람은 로그로 눌린다
  canopyWind: 0.3, // 나무 그늘 있음이면 바람 보정에 곱한다(숲 속은 바람이 바위에 덜 닿음, 추정)
  windMax: 8, // m/s
  Wmax: 5, // mm: 벽 젖음 상한
  dry: 0.4, // W가 이 아래면 좋아 보여요
  wet: 1.5, // W가 이 이상이면 젖었을 수 있어요
  snowMm: 1, // 쌓인 눈(물 환산)이 이만큼이면 얼었을 수 있어요
  freezeLookH: 3, // 고른 시각 직전 이 시간 안에 0℃ 이하가 있으면 "얼음" 후보
  leafMonths: [5, 10], // 잎 있는 달(포함)
  canopyLeaf: 0.3, // c: 나무 그늘 있음 + 잎 있음
  canopyBare: 0.8, // c: 나무 그늘 있음 + 낙엽
  mRange: [0.5, 2], // dry_days 보정 곱의 범위
  coastalRh: 10, // %p: 해안 암장은 짠기(조해성) 때문에 마름 식의 습도에 이만큼 더한다(추정, 결빙은 건드리지 않음)
  reportHours: 24, // 제보를 쓰는 최대 경과 시간
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const HOUR = 36e5;
// 증기압 결손(kPa): 포화수증기압(Tetens) × (1 − RH/100)
const vpd = (t, rh) => 0.61078 * Math.exp((17.27 * t) / (t + 237.3)) * (1 - rh / 100);

// 암장 곱 m: dry_days가 3일이면 1, 길수록 느리게 마른다(0.5~2). 없으면 1.
const dryMult = (dryDays) => (Number.isInteger(dryDays) && dryDays > 0 ? clamp(3 / dryDays, ...WETNESS.mRange) : 1);

/**
 * integrate(hours, { wall, sunTrusted, canopy, dryDays }) → 시간별 단계 [{ at, W, Z, inn, base, sun, lit, rain, t }]
 * hours: [{ at: Date, r (mm), t (℃), rh (%), v (m/s), s (W/m²), p (% | null) }] 오래된 것부터 한 시간 간격. 첫 시간 W = 0에서 시작한다.
 * sunTrusted: 좌표 지문이 확인된 곳만 true → 벽에 해가 드는 시간(isSunlit)만 일사로 센다. 아니면 일사 미반영.
 * coastal: 해안 암장이면 true(호출하는 쪽이 정함, 기본 false). 마름의 유효 습도만 올린다.
 * canopy: 'yes' | 'no' | null (태그 없음 = 1).
 * Open-Meteo의 강수·일사는 그 시각 직전 한 시간의 값이라 해는 시각 30분 전으로 판정한다.
 */
export function integrate(hours, { wall, sunTrusted = false, canopy = null, dryDays, coastal = false } = {}) {
  const c = WETNESS;
  const m = dryMult(dryDays);
  let W = 0;
  let Z = 0;
  return hours.map((h) => {
    const snowing = h.t <= 0;
    if (snowing) Z += h.r;
    const melt = snowing ? 0 : Math.min(Z, c.melt * h.t);
    Z -= melt;
    const rain = snowing ? 0 : h.r;
    const inn = c.rainOnWall * (rain + melt);
    let base = 0;
    let sun = 0;
    let lit = false;
    if (!snowing) {
      base = c.Ebase * vpd(h.t, Math.min(100, h.rh + (coastal ? c.coastalRh : 0))) * (1 + c.wind * (canopy === 'yes' ? c.canopyWind : 1) * Math.log(1 + Math.min(h.v, c.windMax)));
      lit = sunTrusted && !!wall && isSunlit(wall, new Date(h.at.getTime() - HOUR / 2)).lit === true;
      if (lit) {
        const month = h.at.getMonth() + 1;
        const leaf = month >= c.leafMonths[0] && month <= c.leafMonths[1];
        const shade = canopy === 'yes' ? (leaf ? c.canopyLeaf : c.canopyBare) : 1;
        sun = Math.min(c.EsunMax, c.Esun * h.s * shade);
      }
    }
    const dried = Math.min((base + sun) * m, W + inn);
    W = clamp(W + inn - (base + sun) * m, 0, c.Wmax);
    return { at: h.at, W, Z, inn, base: base * m, sun: sun * m, dried, lit: lit && sun > 0, rain: h.r, t: h.t, snowing };
  });
}

const daysBetween = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);

// 지금 젖은 구간(W ≥ dry가 이어진 부분)에서 W에 가장 크게 들어간 항: rain(비 입력) / freeze(결빙으로 못 마름) / sun(일사 마름).
function reasonOf(steps, i, hours, sunApplied, canopy, coastal) {
  const c = WETNESS;
  let s = i;
  while (s > 0 && steps[s - 1].W >= c.dry) s--;
  const part = steps.slice(s, i + 1);
  const rainIn = part.reduce((a, x) => a + x.inn, 0);
  const frozenH = part.filter((x) => x.t <= 0).length;
  const freezeAmt = frozenH * c.Ebase * 0.5; // 0.5kPa: 순한 날의 마름
  const sunDry = part.reduce((a, x) => a + (x.base + x.sun > 0 ? x.dried * (x.sun / (x.base + x.sun)) : 0), 0);
  const byDay = new Map();
  for (const x of part) byDay.set(dayKey(x.at), (byDay.get(dayKey(x.at)) ?? 0) + (x.t > 0 ? x.rain : 0));
  const [peakDay, peakMm] = [...byDay].reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0]);
  const key = steps[i].W < c.dry ? 'good' : rainIn >= freezeAmt && rainIn >= sunDry ? 'rain' : freezeAmt >= sunDry ? 'freeze' : 'sun';
  const peak = peakDay ? new Date(`${peakDay}T12:00:00`) : null;
  return {
    key,
    rainMm: Math.round(peakMm),
    daysAgo: peak && peakMm >= RAIN_MM ? Math.max(0, daysBetween(peak, steps[i].at)) : null,
    freezeHours: frozenH,
    sunHours: part.filter((x) => x.lit).length,
    meanT: Math.round(part.reduce((a, x) => a + x.t, 0) / part.length),
    sunApplied,
    shadeUnknown: sunApplied && canopy == null,
    coastal,
  };
}

/**
 * wetnessAt(hours, at, opts) → { state, hoursLeft, reason, snow } 또는 { state: 'out' }
 * state: 'good' | 'drying'(hoursLeft = 지금부터 W < dry가 되기까지 시간, 예보 끝까지 안 마르면 null) | 'wet' | 'frozen' | 'rain'(그 시각 예보) | 'out'.
 * 서향·동향 벽은 같은 날도 고른 시각에 따라 달라지므로 at은 항상 사용자가 고른 시각이다.
 */
export function wetnessAt(hours, at, opts = {}) {
  const c = WETNESS;
  let i = -1;
  for (let k = 0; k < hours.length && hours[k].at <= at; k++) i = k;
  if (i < 0 || at - hours[i].at >= HOUR) return { state: 'out' };
  const steps = integrate(hours, opts);
  const cur = steps[i];
  const reason = reasonOf(steps, i, hours, !!opts.sunTrusted, opts.canopy ?? null, !!opts.coastal);
  const h = hours[i];
  let state;
  let hoursLeft = null;
  const recentFreeze = steps.slice(Math.max(0, i - c.freezeLookH), i + 1).some((x) => x.t <= 0);
  if (h.r >= RAIN_MM && h.p != null && h.p >= RAIN_PROB) state = 'rain';
  else if (recentFreeze && (cur.W >= c.dry || cur.Z >= c.snowMm)) state = 'frozen';
  else if (cur.W >= c.wet) state = 'wet';
  else if (cur.W >= c.dry) state = 'drying';
  else state = 'good';
  if (state === 'drying' || state === 'wet') {
    const j = steps.findIndex((x, k) => k > i && x.W < c.dry);
    hoursLeft = j < 0 ? null : j - i;
  }
  return { state, hoursLeft, reason, snow: cur.Z >= c.snowMm };
}

const STATE_TEXT = { good: '좋아 보여요', drying: '마르는 중일 수 있어요', wet: '젖었을 수 있어요', frozen: '얼었을 수 있어요', rain: '비 예보' };
const REPORT_TEXT = { wet: '젖음', ice: '얼음·눈', dry: '말랐음' };
const agoText = (d) => (d === 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`);

/** reasonText(reason) → 판정을 가장 크게 움직인 항 한 문장 (날씨 데이터 출처 표시). */
export function reasonText(r) {
  if (r.key === 'good') return '날씨 데이터 기준 최근 비가 없었거나 이미 말랐어요';
  if (r.key === 'freeze') return `날씨 데이터 기준 젖은 뒤 기온이 0°C 이하로 ${r.freezeHours}시간 있었어요`;
  if (r.key === 'sun') return `날씨 데이터 기준 벽에 해가 든 약 ${r.sunHours}시간이 마름을 도왔어요`;
  const when = r.daysAgo == null ? '최근' : agoText(r.daysAgo);
  return `날씨 데이터 기준 ${when} 비 ${r.rainMm}mm, 이후 평균 ${r.meanT}°C`;
}

/**
 * evidenceOf(calc, { report, at, now }) → { state, source: 'report' | 'weather', conflict, lines: [{ text, trust }] }
 * 근거 층: 제보 > 날씨 데이터 > 추정(13-1). 제보 { state: 'wet'|'ice'|'dry', at: Date }는 reportHours 안의 것만 쓴다.
 * 안전 쪽 비대칭: 제보 젖음·얼음이고 계산이 좋음·마르는 중이면 제보를 상태로 쓴다. 제보 말랐음 대 계산 젖음·얼음·마르는 중은
 * 상태를 덮지 않고 둘 다 보인다(conflict). 비 예보는 항상 계산을 쓴다.
 */
export function evidenceOf(calc, { report = null, at, now = new Date() } = {}) {
  if (calc.state === 'out') return { state: 'out', source: 'weather', conflict: null, lines: [] };
  const fresh = report && now - report.at >= 0 && now - report.at <= WETNESS.reportHours * HOUR && REPORT_TEXT[report.state];
  let state = calc.state;
  let source = 'weather';
  let conflict = null;
  const lines = [];
  if (fresh && calc.state !== 'rain') {
    if (report.state !== 'dry' && ['good', 'drying'].includes(calc.state)) {
      state = report.state === 'ice' ? 'frozen' : 'wet';
      source = 'report';
      lines.push({ text: `제보: ${REPORT_TEXT[report.state]} · 앱 예상은 ${STATE_TEXT[calc.state]}`, trust: 'report' });
    } else if (report.state === 'dry' && calc.state !== 'good') {
      conflict = { report: 'dry', app: calc.state };
      lines.push({ text: `제보: 말랐음 · 앱 예상: ${STATE_TEXT[calc.state]}`, trust: 'report' });
    }
  }
  if (source === 'weather') lines.push({ text: reasonText(calc.reason), trust: 'data' });
  const r = calc.reason;
  if (r.coastal && calc.state !== 'good') lines.push({ text: '해안이라 짠기로 더 늦게 마를 수 있어요', trust: 'estimate' });
  if (!r.sunApplied) lines.push({ text: '일사는 반영하지 않았어요', trust: 'estimate' });
  else if (r.shadeUnknown) lines.push({ text: '나무 그늘은 반영하지 않았어요', trust: 'estimate' });
  if (at && source === 'weather') lines.push({ text: `${at.getHours()}시 기준 · 예상이에요`, trust: 'estimate' });
  return { state, source, conflict, lines };
}

// ---- 화면 문구: 상태 → 줄/칩 말, 남은 시간, 마지막 비 ----
const leftText = (h) => (h == null ? null : h < 36 ? `약 ${Math.max(1, Math.round(h))}시간 뒤` : `약 ${Math.round(h / 24)}일 뒤`);
// 칩(줄)은 짧게: 마르는 중일 수 있어요는 카드 컨디션 줄과 시트에서 말한다
const CHIP_TEXT = { good: '좋아 보여요', drying: '마르는 중', wet: '젖음 예상', frozen: '얼음 예상', rain: STATE_TEXT.rain };

/** lastRainAgoH(hours, at) → at 이전에 비(RAIN_MM↑, 0℃ 위)가 마지막으로 온 시간부터 몇 시간 지났나. 없으면 Infinity (목록 정렬: 오래된 순). */
export function lastRainAgoH(hours, at) {
  for (let k = hours.length - 1; k >= 0; k--) {
    if (hours[k].at <= at && hours[k].r >= RAIN_MM && hours[k].t > 0) return (at - hours[k].at) / HOUR;
  }
  return Infinity;
}

/**
 * wetnessCond(calc, { at, now, hours }) → cragRow의 cond와 같은 모양 { state, daysLeft: null, hoursLeft, far, text, short, when, ago, basis: 'wetness', evidence: [{ text, trust }] }
 * calc: wetnessAt의 결과(state 'out'이 아닐 때). far: 고른 시각이 사흘 이상 뒤(예보가 바뀔 수 있음). 제보는 아직 없어서 넘기지 않는다.
 */
export function wetnessCond(calc, { at, now = new Date(), hours = [] } = {}) {
  const ev = evidenceOf(calc, { at, now });
  const left = ev.state === 'drying' ? leftText(calc.hoursLeft) : null;
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return {
    state: ev.state,
    daysLeft: null,
    hoursLeft: calc.hoursLeft,
    far: Math.round((day(at) - day(now)) / 864e5) >= 3,
    text: left ? `${STATE_TEXT.drying} · ${left}` : STATE_TEXT[ev.state],
    when: left,
    short: CHIP_TEXT[ev.state],
    ago: lastRainAgoH(hours, at),
    basis: 'wetness',
    evidence: ev.lines,
  };
}
