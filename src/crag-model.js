// Card values of a natural crag (data/crags.json): no hours, the sunrise-to-sunset day is the frame.
// Pure, no DOM. Not wired to any screen yet (docs/superpowers/specs/2026-10-12-single-pitch-design.md).
import { isSunlit, dayWindow, fmt as hhmm } from './sun.js';
import { conditionOf } from './crag-condition.js';
import { wetnessAt, wetnessCond } from './crag-wetness.js';
import { pickHour } from './weather.js';
import { ROPE_LENGTHS, ropeNeeded, photoCredit } from './card-model.js';
import { ymd } from './time.js';
import { dayText } from './viewmodel.js';

const STEP = 1; // minute resolution: the bar's edges are the real flips, so state, bar and nextChange agree
const NOTE = '벽 기준이며 나무 가림은 반영하지 않아요.';
// Kinds and rock sums (spec 2026-11-16-ice-venues §8, §8-2). The one place this is decided.
// noRock: ice and the mountain holding its waterfalls have no quickdraws and no "마르는 중" call (rock dryness means nothing on ice; E4 puts the freeze condition there).
// noSun: the mountain and an unknown type word (from a newer version) have no sun call, day bar or rope. Ice has its own sun words and rope (iceRope).
// noSingleCalc: neither the rock rope nor quickdraws.
const noRock = (crag) => crag?.type === 'ice' || crag?.type === 'mountain';
const noSingleCalc = (crag) => noRock(crag) || (!!crag?.type && !Object.hasOwn(TYPE_LABEL, crag.type));
const noSun = (crag) => crag?.type === 'mountain' || (!!crag?.type && !Object.hasOwn(TYPE_LABEL, crag.type));
// On ice the sun means melting and the shade means the ice holds (the reverse of rock). Said as a guess; nothing is said without a direction or pin.
export const ICE_SUN_TEXT = { sun: '햇빛이 닿아요 · 녹을 수 있어요', shade: '그늘이에요 · 얼음이 유지돼요' };
export const ICE_ROPE_MODES = { normal: 1, toprope: 2 }; // 일반등반: the waterfall's height; 탑로핑: twice it (down and up)
/** the rope an ice waterfall asks for: height × (1 normal, 2 toprope), up to a length people carry; null when the height or the mode is unknown. no margin: the height is the user's number */
export function iceRope(crag) {
  const k = Object.hasOwn(ICE_ROPE_MODES, crag?.rope_mode) ? ICE_ROPE_MODES[crag.rope_mode] : 0;
  if (!k || !(crag.height_m > 0)) return null;
  const need = crag.height_m * k;
  const m = ROPE_LENGTHS.find((l) => l >= need);
  return { m: m ?? null, over: m === undefined, need };
}
const sunStateOf = (here) => (here.lit === null ? 'unknown' : here.reason === 'night' ? 'night' : here.lit ? 'sun' : 'shade');

export function cragModel(crag, at) {
  if (noSun(crag)) {
    const { lat, lng } = crag.sun ?? {};
    const pos = Number.isFinite(lat) && Number.isFinite(lng);
    return {
      name: crag.name,
      region: crag.region,
      route: pos ? `https://map.kakao.com/link/to/${encodeURIComponent(crag.name)},${lat},${lng}` : null,
      routeNaver: pos ? `https://map.naver.com/p/directions/-/${lng},${lat},${encodeURIComponent(crag.name)}/-/transit` : null,
      day: null, state: 'unknown', remainingMin: null, nextChange: null, bar: [], note: null,
    };
  }
  const day = (m) => new Date(at.getFullYear(), at.getMonth(), at.getDate(), 0, m);
  const now = at.getHours() * 60 + at.getMinutes();
  const win = dayWindow(crag, at);
  const here = isSunlit(crag, at);
  const state = sunStateOf(here);

  const segs = []; // [from, to, lit] in minutes
  if (win && here.lit !== null) {
    let from = win.sunrise;
    let lit = isSunlit(crag, day(from)).lit;
    for (let m = from + STEP; m < win.sunset; m += STEP) {
      const l = isSunlit(crag, day(m)).lit;
      if (l !== lit) { segs.push([from, m, lit]); from = m; lit = l; }
    }
    segs.push([from, win.sunset, lit]);
  }
  const next = state === 'sun' || state === 'shade' ? segs.find(([from]) => from > now) : null; // at night there is no "change" to announce
  const inDay = win && now >= win.sunrise && now < win.sunset;
  const { lat, lng } = crag.sun ?? {};
  const pos = Number.isFinite(lat) && Number.isFinite(lng);

  return {
    name: crag.name,
    region: crag.region,
    route: pos ? `https://map.kakao.com/link/to/${encodeURIComponent(crag.name)},${lat},${lng}` : null,
    routeNaver: pos ? `https://map.naver.com/p/directions/-/${lng},${lat},${encodeURIComponent(crag.name)}/-/transit` : null, // card-model's form
    day: win ? { from: hhmm(win.sunrise), to: hhmm(win.sunset) } : null,
    state,
    remainingMin: (state === 'sun' || state === 'shade') && inDay ? win.sunset - now : null,
    nextChange: next ? { at: hhmm(next[0]), to: next[2] ? 'sun' : 'shade' } : null,
    bar: segs.map(([from, to, lit]) => ({ from: hhmm(from), to: hhmm(to), lit })),
    note: NOTE,
  };
}

// ---- 줄·카드 값: 등반 컨디션, 날씨, 장비 (docs/superpowers/specs/2026-10-21-crag-ui-design.md 2절) ----
// 컨디션은 예상일 뿐이다. "등반 가능" 같은 단정은 쓰지 않는다.
// dry_days가 없는 곳(recent / good·dry-week)은 비 지도로 아는 것만 말한다: 언제 얼마나 왔는지, 또는 한 주 동안 안 왔는지.
export const COND_TEXT = { good: '좋아 보여요', rain: '비 예보', unknown: '컨디션 정보 없음', out: '예보 범위 밖' };
const rainWhen = ({ daysSince, today }) => (daysSince > 0 ? `${daysSince}일 전 비` : today ? '오늘 비' : '그날 비');
export const condText = (c) => (c.state === 'drying' ? `마르는 중일 수 있어요 · 약 ${c.daysLeft}일 뒤`
  : c.state === 'recent' ? `${rainWhen(c)} ${c.mm}mm`
  : c.state === 'good' && c.why === 'dry-week' ? `${COND_TEXT.good} · 최근 7일 비 없음`
  : COND_TEXT[c.state] ?? COND_TEXT.unknown);
// 줄(375px)에 지역이 남도록 짧게 쓴 같은 말. 긴 말(condText)은 펼친 카드와 줄 버튼의 aria-label에 둔다.
const COND_SHORT = { good: '좋아 보여요', rain: '비 예보', unknown: '정보 없음', out: '예보 범위 밖' };
export const condShort = (c) => (c.state === 'drying' ? `마르는 중 · ${c.daysLeft}일` : c.state === 'recent' ? rainWhen(c) : COND_SHORT[c.state] ?? COND_SHORT.unknown);
export const COND_HINT_NO_DRY = '마르는 시간은 암장마다 달라요';
export const COND_NOTE = '예상 · 현장과 다를 수 있어요';
export const FAR_NOTE = '예보는 바뀔 수 있어요';
export const GEAR_BASIS = '참고용 · 개념도의 최대 루트 기준 · 현장 판단이 우선';

// 일사는 좌표 지문이 확인된 곳만 켠다(설계 11-3). 확인 여부를 담은 데이터 필드가 아직 없어 모두 끈다: 근거에 "일사는 반영하지 않았어요".
// 나무 그늘(canopy)·해안(coastal)도 필드 승인 전이라 넘기지 않는다.
const SUN_TRUSTED = false;

/**
 * cragRow(crag, at, { now, daily, hourly, wet }) → { name, region, sun, cond: {state, daysLeft, far, text, short}, wx: {t, c}|null, crag }
 * daily / hourly / wet: what loadCragWeather returns (Map name → Map … / Map name → hours), or null while there is no forecast.
 * cond: the wetness W (crag-wetness.js) when the hourly series covers the moment; else the old daily-rain conditionOf (dry_days) as the fallback.
 * The wetness cond adds hoursLeft, ago (hours since the last rain, for the list order), basis 'wetness' and evidence lines.
 */
export const TYPE_LABEL = { single: '싱글', multi: '멀티', boulder: '볼더', ice: '빙벽', mountain: '산' }; // 종류 칩: 값 없음(종류 미정)은 싱글, 모르는 값은 기타
/** an unknown type word (from a newer version) gets '기타' (and no single-pitch sums, see noSingleCalc) */
const otherType = (crag) => !!crag.type && !Object.hasOwn(TYPE_LABEL, crag.type);
export function cragRow(crag, at, { now = new Date(), daily = null, hourly = null, wet = null } = {}) {
  const series = wet?.get(crag.name);
  const calc = series?.length ? wetnessAt(series, at, { wall: crag, sunTrusted: SUN_TRUSTED, dryDays: crag.dry_days }) : null;
  const w = calc && calc.state !== 'out' ? wetnessCond(calc, { at, now, hours: series }) : null;
  const c = noRock(crag) ? { state: 'unknown' } : w ?? conditionOf(daily?.get(crag.name) ?? null, crag.dry_days, at, now); // rock dryness means nothing on ice; E4 puts the freeze condition here
  const hours = hourly?.get(crag.name);
  return {
    name: crag.name,
    region: crag.region,
    sun: noSun(crag) ? 'unknown' : sunStateOf(isSunlit(crag, at)),
    sunWords: crag.type === 'ice' ? ICE_SUN_TEXT[sunStateOf(isSunlit(crag, at))] ?? null : null,
    cond: (noRock(crag) ? null : w) ?? { ...c, text: condText(c), short: condShort(c) },
    wx: hours ? pickHour(hours, at) : null,
    typeLabel: otherType(crag) ? '기타' : TYPE_LABEL[crag.type] ?? '싱글',
    peaks: crag.peaks ?? [],
    crag,
  };
}

/** 후기 링크: blog_posts에서 https 주소만, 새 글부터(외벽 card-model blogOf와 같은 정렬), 최대 3개, {title,url,date}. */
export function blogLinks(crag) {
  return (crag?.blog_posts ?? []).filter((b) => /^https?:\/\//.test(b?.url)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 3).map(({ title, url, date }) => ({ title, url, date }));
}

/**
 * cragCard(crag, at, ctx) → cragRow's values + the day bar and route from cragModel + gear + the free-text fields.
 * ctx is cragRow's, plus ropeM (my rope in metres, 0 or missing = not set).
 * gear.rope: the rope the longest route asks for (height × 2 + 5 m, rounded up to a length people carry); gear.quickdraws: the bolts on
 * the route with the most (no margin). Both are 참고용: the card says so with GEAR_BASIS.
 */
export function cragCard(crag, at, ctx = {}) {
  const row = cragRow(crag, at, ctx);
  const m = cragModel(crag, at);
  const need = crag.type === 'ice' ? iceRope(crag) : noSingleCalc(crag) ? null : ropeNeeded(crag.height_m);
  const own = Number(ctx.ropeM) > 0 ? Number(ctx.ropeM) : 0;
  const { lat, lng } = crag.sun ?? {};
  const now = ctx.now ?? new Date();
  const photo = crag.photo ? `data/${crag.photo}` : null; // normalizeWall already held it to PHOTO_RE
  const credit = photo ? photoCredit(crag.photo_credit) : null;
  return {
    ...row,
    route: m.route,
    // the link bar's 길찾기 (the wall card's form: the dialog asks which app); geo feeds its 지도에서 보기
    links: m.route ? [{ label: '길찾기', href: m.route, primary: true, choices: [{ id: 'kakao', label: '카카오맵', href: m.route }, { id: 'naver', label: '네이버지도', href: m.routeNaver }] }] : [],
    geo: m.route ? { lat: lat.toFixed(5), lng: lng.toFixed(5), name: crag.name } : null,
    address: crag.address ?? null,
    day: m.day,
    // the open row's photo (app.js rowPhoto, like the wall's) and, with none, the .ph-hero block: the day's sun window on its foot
    photo,
    credit,
    photos: photo ? [{ src: photo, credit, date: null }] : [],
    hero: noSun(crag) ? null : { lead: `${ymd(at) === ymd(now) ? '오늘' : dayText(at)} 해`, text: m.day ? `${m.day.from}–${m.day.to}` : '해 정보 없음' },
    remainingMin: m.remainingMin,
    nextChange: m.nextChange,
    bar: m.bar,
    note: m.note,
    gear: {
      rope: need ? (need.over ? `로프 ${ROPE_LENGTHS.at(-1)}m 초과` : `로프 ${need.m}m 이상`) : null,
      ownFit: need && own ? (own >= need.need ? 'ok' : 'short') : null,
      quickdraws: !noSingleCalc(crag) && Number.isInteger(crag.bolts_max) ? `퀵드로 ${crag.bolts_max}개 이상` : null,
    },
    approach: crag.approach ?? null,
    caution: crag.caution ?? null,
    parking: crag.parking ?? null,
    blog: blogLinks(crag),
  };
}
