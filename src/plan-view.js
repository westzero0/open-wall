// src/plan-view.js — what a home row says, as plain data (no DOM). planner-home.js / planner-row.js only paint it.
// All copy comes from the modules planner-copy.md names (riskOf, recordSummary, changedPhrase, crowdHint); this file adds no new weather/crowd wording.
import { DAY_KO } from './time.js';
import { resolvePlace } from './plan-place.js';
import { riskOf } from './plan-risk.js';
import { recordSummary } from './plan-actions.js';
import { changedPhrase, placeLine, symbolKind } from './plan-card.js';
export { placeLine, symbolKind };
import { pickHour, skyKind, skyWet, GUST_STRONG, RAIN_PROB } from './weather.js';
import { cragRow } from './crag-model.js';
import { isSunlit, dayWindow, fmt } from './sun.js';
import { wallPageId } from './share-id.js';
import { shortName } from './viewmodel.js';
import { crowdLevel } from './plan-crowd.js';
import { nextShadeMin, sunTitle, HOME_SHADE_NOTE } from './plan-sun.js';

export const LOADING = '날씨를 불러오는 중이에요';
const dateOf = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };

/** '2026-11-14' → { d: '14', dow: '토', md: '11/14', month: 11, day: 14 } */
export function dayParts(date) {
  const at = dateOf(date);
  const month = at.getMonth() + 1, day = at.getDate();
  return { d: String(day), dow: DAY_KO[at.getDay()], md: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`, month, day };
}

/** header time: '11월 10일 화' */
export function todayText(today) { const p = dayParts(today); return `${p.month}월 ${p.day}일 ${p.dow}`; }

export const timeText = (min) => (Number.isInteger(min) ? fmt(min) : '');

export function resolveFor(plan, s) {
  return resolvePlace(plan.place, { walls: s.walls, crags: s.crags, mine: s.db.mine, aliases: s.aliases, savedName: plan.placeName });
}

export const partnerNames = (plan, partners) => (plan.partnerIds ?? []).map((id) => partners.find((p) => p.id === id)?.name).filter(Boolean);

/** '오늘은 가능' for the today row; null when the risk has nothing to say (none / past). */
export const verdictOf = (level) => ({ ok: '오늘은 가능', caution: '오늘은 주의', hard: '오늘은 어려움' }[level] ?? null);

/** rowView(plan, { s, now }) → the words and flags of one row. */
export function rowView(plan, { s, now = Date.now() }) {
  const resolved = resolveFor(plan, s);
  const risk = riskOf(resolved, plan, s.wx, now);
  const rest = plan.status === '쉼';
  const recorded = plan.status === '갔다' || plan.status === '못 갔다';
  const name = plan.placeName || resolved.name || '장소 미정';
  const title = rest ? `${name} · 쉼` : name;
  // the places/forecast are still on their way: say so instead of flashing 예보를 불러오지 못했어요 / 아직 앱에 없는 암장
  const loading = s.wxLoaded === false && plan.place?.kind === 'official' && !rest && !recorded && plan.date >= s.today && (risk.level === 'none' || !resolved.located);
  const phrase = rest ? recordSummary(plan, s.today) : recorded ? `${recordSummary(plan)} · 기록됨` : loading ? LOADING : risk.phrase;
  const level = rest ? 'rest' : recorded ? 'done' : loading ? 'none' : risk.level;
  const live = !rest && !recorded && plan.date >= s.today; // a card / alternatives make sense only for a plan still ahead
  const p = dayParts(plan.date);
  const verdict = level === 'hard' ? '어려움, ' : '';
  const aria = `${p.month}월 ${p.day}일 ${p.dow}요일 ${title}${plan.min != null ? ` ${timeText(plan.min)}` : ""}. ${verdict}${phrase}`;
  return {
    id: plan.id, resolved, risk, level, title, time: timeText(plan.min), phrase, symbol: plan.discipline ?? symbolKind(resolved), rest, recorded, live, aria,
    past: plan.date < s.today,
    changed: plan.changedFrom ? changedPhrase(plan) : null,
    who: partnerNames(plan, s.db.partners),
    atRisk: live && (risk.level === 'hard' || risk.level === 'caution'),
  };
}

export const planAt = (plan) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plan.date);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], Number.isInteger(plan.min) ? Math.floor(plan.min / 60) : 12, Number.isInteger(plan.min) ? plan.min % 60 : 0);
};

/** The hour forecast a plan's place has at the plan's time ({ t, w, g, p, c } or null). Indoor / unlocated places have none. */
export function hourFor(resolved, plan, wx, { now = Date.now() } = {}) {
  const at = planAt(plan);
  if (!at || resolved.venue === 'indoor' || !resolved.located) return null;
  if (resolved.kind === 'crag') return cragRow(resolved.crag, at, { now: new Date(now), ...(wx?.crag ?? {}) }).wx ?? null;
  if (resolved.kind === 'wall') { const hours = wx?.hourly?.get?.(resolved.name); return hours ? pickHour(hours, at) : null; }
  return null;
}

/** Weather detail of the expanded row, taken from the same values the crag/wall rows use. [{ k, v }] — empty when nothing is known. */
export function weatherDetail(resolved, plan, wx, { now = Date.now() } = {}) {
  const at = planAt(plan);
  if (!at || resolved.venue === 'indoor' || !resolved.located) return [];
  const h = hourFor(resolved, plan, wx, { now });
  const out = [];
  if (h && Number.isFinite(h.w)) out.push({ k: '바람', v: `${Math.round(h.w)}m/s` });
  if (h && Number.isFinite(h.p)) out.push({ k: '강수확률', v: `${Math.round(h.p)}%` });
  const place = resolved.wall ?? resolved.crag;
  if (place) {
    const sun = isSunlit(place, at);
    const win = dayWindow(place, at);
    if (sun.lit !== null && win) {
      const t = at.getHours() * 60 + at.getMinutes();
      out.push({ k: sun.lit ? '양달' : '응달', v: `해가 ${fmt(win.sunset)}에 ${t >= win.sunset ? '졌어요' : '져요'}` });
    }
  }
  return out;
}

export const PAST_LIMIT = 20;
/** Past days (newest first) → month blocks [{ month, days }] holding at most `limit` plans, skipping `skip` ids. */
export function pastBlocks(days, skip = new Set(), limit = PAST_LIMIT) {
  const blocks = [];
  let n = 0;
  for (const day of days) {
    const plans = day.plans.filter((p) => !skip.has(p.id)).slice(0, Math.max(0, limit - n));
    if (!plans.length) continue;
    n += plans.length;
    const month = dayParts(day.date).month;
    const last = blocks[blocks.length - 1];
    if (last && last.month === month) last.days.push({ date: day.date, plans });
    else blocks.push({ month, days: [{ date: day.date, plans }] });
    if (n >= limit) break;
  }
  return blocks;
}

// ---- home (v3): hero cells, row weather, sun line, week strip ----
const isNum = Number.isFinite;
const WIND_MID = 5; // m/s gust: from here `보통`; a gust at GUST_STRONG (weather.js) is `강함` — a plain three-step reading, not a safety rule. Outdoor-wall hours carry the gust only (no mean wind)

const wetOf = (h) => (isNum(h.p) && h.p >= RAIN_PROB) || skyWet(h.c);

/** Short weather for a list row's right side: { icon, text, warn } or null. */
export function rowWeatherCell(h) {
  if (!h || !isNum(h.t)) return null;
  const kind = isNum(h.c) ? skyKind(h.c).kind : 'clear';
  const wet = wetOf(h);
  return { icon: wet ? 'rain' : kind === 'clear' || kind === 'partly' ? 'sun' : kind === 'cloud' || kind === 'fog' ? 'cloud' : 'rain', text: wet && isNum(h.p) ? `${Math.round(h.p)}%` : `${Math.round(h.t) || 0}°`, warn: wet };
}

/** The three icon cells of the today hero: weather, wind, crowd. Unknown values keep the cell with a dash and a reason. */
export function homeCells(resolved, plan, s, { now = Date.now() } = {}) {
  const h = hourFor(resolved, plan, s.wx, { now });
  const row = rowWeatherCell(h);
  const sky = h && isNum(h.c) ? skyKind(h.c) : null;
  const weather = row
    ? { icon: row.icon, value: row.text, warn: row.warn, label: row.warn ? (sky?.kind === 'snow' ? '눈 예보' : '비 예보') : sky ? sky.text : isNum(h.p) ? `강수 ${Math.round(h.p)}%` : '' }
    : { icon: 'sun', value: '—', warn: false, dim: true, label: resolved.venue === 'indoor' ? '실내' : s.wxLoaded === false && plan.place?.kind === 'official' ? '불러오는 중' : '예보 없음' };
  const wind = h && isNum(h.g)
    ? { value: h.g >= GUST_STRONG ? '강함' : h.g >= WIND_MID ? '보통' : '약함', label: '바람' }
    : { value: '—', label: '바람', dim: true };
  const c = resolved.kind === 'wall' ? crowdLevel(s.crowd ?? [], resolved, plan, new Date(now)) : null;
  const crowd = c ? { n: 1 + ['여유', '보통', '혼잡'].indexOf(c.level), value: c.level, label: `제보 ${c.n}건` } : { n: 0, value: '—', label: '제보 없음', dim: true };
  return { weather, wind, crowd };
}

/** When all three cells are empty the detail shows one quiet line instead: `실내 · 제보 없음`; null when any cell has data. */
export const cellsQuiet = (c) => (c.weather.dim && c.wind.dim && c.crowd.dim ? [c.weather.label, c.crowd.label].filter(Boolean).join(' · ') : null);

/** "지금 양달 · 15:40부터 응달" for a place now: { lit, title, note } or null (no sun data, indoor, night). */
export function sunNow(resolved, { now = Date.now() } = {}) {
  const place = resolved.wall ?? resolved.crag;
  if (!place) return null;
  const at = new Date(now);
  const sun = isSunlit(place, at);
  if (sun.lit === null || sun.reason === 'night') return null;
  if (!sun.lit) return { lit: false, title: sunTitle(false, true), note: HOME_SHADE_NOTE };
  const m = nextShadeMin(place, at);
  return { lit: true, title: sunTitle(true, true), note: m == null ? '' : `${fmt(m)}부터 응달` };
}

/** Seven days from today for the week strip: [{ date, d, month, dow, today, count, hard }]. hardOf(plan) → true for a plan whose weather is 어려움. */
export function weekStrip(plans, today, hardOf = () => false) {
  const t = dateOf(today);
  return Array.from({ length: 7 }, (_, i) => {
    const at = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
    const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    const day = plans.filter((p) => p.date === date && p.status === '예정');
    return { date, d: at.getDate(), month: at.getMonth() + 1, dow: DAY_KO[at.getDay()], today: i === 0, count: day.length, hard: day.some(hardOf) };
  });
}

/** `다음 일정은 토요일이에요` — the first plan still ahead after today; '' when there is none. */
export function nextPlanText(plans, today) {
  const next = plans.filter((p) => p.date > today && p.status === '예정').sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? `다음 일정은 ${dayParts(next.date).dow}요일이에요` : '';
}

// ---- detail (v3): the `분야 · 지역` line and the alternative rows ----
/** One alternative as a row: { key, name, symbol, sub: tags joined by ' · ' (one muted line, no chips), tags[], place, placeName }. Distance is from the ORIGINAL place (pick.km); no user position is used. */
export function altRow(pick, resolved) {
  const w = pick.wall;
  const tags = [];
  if (pick.indoor) tags.push('실내 · 비 영향 없음');
  else if (pick.risk.phrase) tags.push(pick.risk.phrase);
  const sido = (r) => String(r ?? '').trim().split(/\s+/)[0];
  const here = sido(resolved.wall?.region ?? resolved.crag?.region);
  if (here && sido(w.region) === here) tags.push('같은 지역'); // the 시·도 really matches (경기 양주 ≠ 인천), else the tag is left out
  if (Number.isFinite(pick.km)) tags.push(`약 ${Math.max(1, Math.round(pick.km))}km`);
  return {
    key: wallPageId(w), name: shortName(w), symbol: pick.indoor ? 'lead' : 'wall',
    sub: tags.join(' · '), tags,
    place: { kind: 'official', id: wallPageId(w) }, placeName: w.name,
  };
}
