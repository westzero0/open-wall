// 싱글피치 컨디션 탭 화면 (시안: docs/superpowers/mockups/2026-10-22-crag-cond-tab.html). 구역 순서: 컨디션 → 비 → 시간별.
// 값 계산(rainDays·lastRain·hourCells·gustWindow·dryProgress)은 순수 함수이고, condPane만 DOM을 만든다(el()과 텍스트만 쓴다).
import { el } from './dom.js';
import { COND_HINT_NO_DRY, FAR_NOTE } from './crag-model.js';
import { forecastTrusted, skyKind, windy } from './weather.js';

const RAIN_PAST = 5; // 마르는 데 걸리는 날이 대개 5일 안이고, 사흘 뒤 예보는 믿기 어렵다 (예전 crag-view rainBars와 같은 범위)
const RAIN_AHEAD = 2;
// 비로 치는 하루 강수(mm): 마지막 비 알약, 막대 숫자·색, 읽어 주는 말이 모두 이 한 기준을 쓴다(0.1mm 이슬비는 '마지막 비'가 아니고 화면에 '0'을 찍지 않는다)
export const RAIN_MIN = 1;
const HOURS = [6, 9, 12, 15, 18, 21];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const SKY_ICON = { clear: 'sun', partly: 'sky-partly', cloud: 'sky-cloud', fog: 'sky-fog', rain: 'sky-rain', snow: 'sky-snow', storm: 'sky-storm' };
const p2 = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const shift = (now, n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
const num = (v) => (Number.isFinite(v) ? v : null);

/** rainDays(days, now) → 지난 5일 + 오늘 + 예보 2일 (있는 날만, 날짜순): { key, mm, wd, today, fc, c, tmax }. */
export function rainDays(days, now) {
  if (!days || !days.size) return [];
  const today = keyOf(now);
  const from = keyOf(shift(now, -RAIN_PAST));
  const to = keyOf(shift(now, RAIN_AHEAD));
  return [...days.keys()].filter((k) => k >= from && k <= to).sort().map((k) => {
    const d = days.get(k);
    const [y, m, dd] = k.split('-').map(Number);
    return { key: k, mm: d.mm, wd: k === today ? '오늘' : WD[new Date(y, m - 1, dd).getDay()], today: k === today, fc: k >= today, c: num(d.c), tmax: num(d.tmax) === null ? null : Math.round(d.tmax) };
  });
}

/** lastRain(days, now) → 오늘 이전에 비(mm >= RAIN_MIN)가 온 가장 최근 날 { key, md: '20일', mm(정수, 막대 숫자와 같다) }, 없으면 null. */
export function lastRain(days, now) {
  if (!days) return null;
  const today = keyOf(now);
  const k = [...days.keys()].filter((x) => x < today && days.get(x).mm >= RAIN_MIN).sort().at(-1);
  return k ? { key: k, md: `${Number(k.slice(8, 10))}일`, mm: Math.round(days.get(k).mm) } : null;
}

/** hourCells(hours, at, now) → `at` 날짜의 6·9·12·15·18·21시 중 값이 있는 칸 { hh, t, c, g }. 예보를 믿을 수 없는 날은 []. */
export function hourCells(hours, at, now) {
  if (!hours || !forecastTrusted(at, now)) return [];
  return HOURS.flatMap((hh) => { const h = hours.get(`${keyOf(at)}T${p2(hh)}:00`); return h ? [{ hh, t: h.t, c: h.c, g: h.g }] : []; });
}

/** gustWindow(cells) → 돌풍이 센(8m/s↑) 칸의 첫·마지막 시각과 최댓값, 없으면 null. */
export function gustWindow(cells) {
  const w = cells.filter(windy);
  return w.length ? { from: w[0].hh, to: w.at(-1).hh, max: Math.round(Math.max(...w.map((c) => c.g))) } : null;
}

/** dryProgress(cond, dryDays = cond.dry_days) → 마르는 칸 { total (dry_days 올림, 최대 5), done, left }. 마르는 중이 아니거나 dry_days가 없으면 null. */
export function dryProgress(cond, dryDays = cond?.dry_days) {
  if (cond?.state !== 'drying' || !Number.isFinite(dryDays) || dryDays <= 0 || !Number.isFinite(cond.daysLeft)) return null;
  const total = Math.min(5, Math.ceil(dryDays));
  const left = Math.min(total, Math.max(0, Math.ceil(cond.daysLeft)));
  return { total, done: total - left, left };
}

// 하늘/상태 아이콘. icon이 없으면(DOM 없는 테스트) 하늘 말 글자로 대신한다.
function pic(icon, name, label) {
  const n = icon ? icon(name) : el('span', {}, label ?? '');
  if (label) { n.setAttribute('aria-label', label); n.setAttribute('role', 'img'); n.removeAttribute?.('aria-hidden'); }
  return n;
}
const skyPic = (icon, c) => { const s = skyKind(c); return pic(icon, SKY_ICON[s.kind], s.text); };
const rainy = (d) => d.mm >= RAIN_MIN;
const secHead = (icon, name, label, end) => el('h3', { class: 'crag-sec-h' }, icon ? icon(name) : null, label, end);

function rainSection(icon, days, now) {
  const list = rainDays(days, now);
  const last = lastRain(days, now);
  const top = Math.max(10, ...list.map((d) => d.mm)); // 10 mm가 막대 한 칸 가득, 더 많으면 그 날이 기준
  const wet = list.filter(rainy);
  const label = wet.length ? `일별 강수: ${wet.map((d) => `${Number(d.key.slice(5, 7))}/${Number(d.key.slice(8, 10))} ${Math.round(d.mm)}mm`).join(', ')}` : `지난 ${RAIN_PAST}일과 예보에 강수가 없어요`;
  const cols = list.flatMap((d, i) => {
    // is-* names and .rbar: the wall's .today span / .bar rules must not reach these (they painted today's column grey)
    const bar = el('span', { class: `rbar${rainy(d) ? '' : ' is-none'}` }); // under RAIN_MIN: the no-rain line (blue means rain)
    bar.style.setProperty('--h', `${rainy(d) ? Math.max(8, Math.round((d.mm / top) * 100)) : 2}%`);
    const sky = d.c === null && d.tmax === null ? null : el('span', { class: d.c === null ? 'sk' : `sk ${skyKind(d.c).kind}` }, d.c === null ? null : skyPic(icon, d.c), d.tmax === null ? null : el('span', { class: 'tx' }, `${d.tmax}°`));
    const col = el('div', { class: `col${d.today ? ' is-today' : ''}${d.fc ? ' is-fc' : ''}` }, el('span', { class: 'mm' }, rainy(d) ? String(Math.round(d.mm)) : null), bar, el('span', { class: 'd' }, d.wd), sky);
    return d.today && i > 0 ? [el('span', { class: 'split', 'aria-hidden': 'true' }), col] : [col];
  });
  const past = list.filter((d) => !d.fc).length;
  const capSpan = (text, n) => { const s = el('span', {}, text); s.style.setProperty('flex-grow', String(n)); return s; }; // 칸 수만큼 폭을 나눠 막대 위치와 맞춘다
  const cap = el('p', { class: 'crag-rain-cap', 'aria-hidden': 'true' }, past ? capSpan(`지난 ${RAIN_PAST}일`, past) : null, capSpan('예보', list.length - past));
  const end = el('span', { class: 'end' }, last ? `마지막 비 ${last.md} · ${last.mm}mm` : '최근 비 없음');
  return el('section', { class: 'crag-sec' },
    secHead(icon, 'sky-rain', '비', end),
    el('div', { class: 'crag-rain2', role: 'img', 'aria-label': label }, ...cols), cap,
    el('p', { class: 'crag-legend' }, el('span', {}, el('i'), '내린 비(mm)'), el('span', {}, el('i', { class: 'is-fc' }), '예보')));
}

function hoursSection(icon, hourly, at, now) {
  const cells = hourCells(hourly, at, now);
  if (!cells.length) return null;
  const g = gustWindow(cells);
  const cur = cells.filter((c) => c.hh <= at.getHours()).at(-1)?.hh; // 지금 보는 시각이 속한 열
  const isToday = keyOf(at) === keyOf(now);
  const strong = cells.filter(windy).map((c) => Math.round(c.g));
  const end = g ? el('span', { class: 'end wind' }, icon ? icon('wind') : null, ` ${g.from === g.to ? `${g.from}시` : `${g.from}–${g.to}시`} 돌풍 ${Math.min(...strong) === g.max ? g.max : `${Math.min(...strong)}–${g.max}`}m/s`) : null;
  const on = (c) => (c.hh === cur ? ' at' : '');
  const th = (c) => el('th', { scope: 'col', class: c.hh === cur ? 'at' : null, 'aria-current': c.hh === cur ? 'time' : null }, `${p2(c.hh)}시`);
  return el('section', { class: 'crag-sec' },
    secHead(icon, 'clock', isToday ? '오늘 시간별' : `${at.getMonth() + 1}월 ${at.getDate()}일 시간별`, end),
    el('table', { class: 'crag-hours' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, el('span', { class: 'sr-only' }, '시각')), ...cells.map(th))),
      el('tbody', {},
        el('tr', {}, el('th', { scope: 'row', 'aria-label': '하늘' }), ...cells.map((c) => el('td', { class: `sky ${skyKind(c.c).kind}${on(c)}` }, skyPic(icon, c.c)))),
        el('tr', {}, el('th', { scope: 'row', 'aria-label': '기온' }), ...cells.map((c) => el('td', { class: `t${on(c)}` }, `${Math.round(c.t)}°`))),
        el('tr', {}, el('th', { scope: 'row', 'aria-label': '돌풍, 초속 미터' }, icon ? icon('wind') : '돌풍', el('small', { class: 'unit', 'aria-hidden': 'true' }, 'm/s')), ...cells.map((c) => el('td', { class: `g${windy(c) ? ' strong' : ''}${on(c)}` }, String(Math.round(c.g))))))));
}

/** condPane(row, { daily, hourly, at, now, icon }) → 컨디션 탭 한 장. row: cragRow의 결과({ cond, crag }), daily/hourly: 이 암장의 Map. */
export function condPane(row, { daily, hourly, at = new Date(), now = new Date(), icon } = {}) {
  const cond = row.cond;
  const prog = dryProgress(cond, row.crag?.dry_days);
  const state = cond.state;
  const wetBasis = cond.basis === 'wetness'; // 젖음 계산(crag-wetness.js): 상태 문구와 근거 줄이 계산에서 온다
  const big = state === 'drying' ? '마르는 중' : cond.text;
  const when = state !== 'drying' ? null : wetBasis ? cond.when : `약 ${cond.daysLeft}일 뒤`;
  const wetting = ['drying', 'rain', 'recent', 'wet', 'frozen'].includes(state);
  const badgeIcon = state === 'good' ? 'sun' : state === 'frozen' ? 'sky-snow' : wetting ? 'sky-rain' : 'info';
  const tone = state === 'good' ? 'is-good' : wetting ? 'is-wet' : 'is-unknown'; // the badge icon's grouping
  const head = el('div', { class: `crag-cond ${tone}` },
    el('span', { class: 'badge' }, icon ? icon(badgeIcon) : null),
    el('div', {}, el('p', { class: 'state' }, big), when ? el('p', { class: 'when' }, when) : null, wetBasis && cond.evidence[0] ? el('p', { class: 'when' }, cond.evidence[0].text) : null),
    prog ? el('div', { class: 'crag-dry', role: 'img', 'aria-label': `마르는 데 ${prog.total}일, 지금 ${prog.done}일 지남, ${prog.left}일 남음` },
      el('span', { class: 'segs' }, ...Array.from({ length: prog.total }, (_, i) => el('i', { class: `seg${i < prog.done ? ' on' : ''}` }))), el('b', {}, `${prog.left}일 남음`))
      : wetBasis && cond.evidence.length > 1 ? el('p', { class: 'crag-dry' }, cond.evidence.slice(1).map((l) => l.text).join(' · ')) // 근거 첫 줄만 크게, 믿음 표시(일사 미반영·기준 시각·예상)는 한 줄 보조 글
      : cond.why === 'no-dry-days' ? el('p', { class: 'crag-dry' }, COND_HINT_NO_DRY) : null);
  const hours = hoursSection(icon, hourly, at, now);
  if (!daily?.size && !hours) return el('div', { class: 'crag-cond-pane' }, head, el('p', { class: 'crag-note' }, icon ? icon('info') : null, '예보를 받지 못했어요'));
  return el('div', { class: 'crag-cond-pane' }, head, daily?.size ? rainSection(icon, daily, now) : null, hours,
    el('p', { class: 'crag-note' }, icon ? icon('info') : null, '예상이에요. 현장과 다를 수 있어요', cond.far ? ` · ${FAR_NOTE}` : null));
}
