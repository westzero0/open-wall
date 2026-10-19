// src/card-model.js — one list row → every value the list row, the expanded row and the map card draw.
// No DOM: app.js only draws what this returns, so the three views can't phrase the same rule differently.
import { hasHours, openIntervals } from './hours.js';
import { hhmm, ymd } from './time.js';
import { CHAT_URL_RE, ROPE_LENGTHS } from './store.js';
export { ROPE_LENGTHS }; // (the list lives in store.js: normalizeWall cleans rope_m against it)
import { dayParts, recordNote } from './log.js';
import { LEVELS as CROWD_LEVELS } from './crowd.js';
import { weatherLine, windy } from './weather.js';
import {
  axisFrac, barSegments, dayBar, dayLine, dayText, endingSoon, fmtMin, formatRanges, shortName, unknownText, wallPosition,
} from './viewmodel.js';

// ---- status ----
const whenText = (d, base) => (ymd(d) === ymd(base) ? hhmm(d) : `${dayText(d)} ${hhmm(d)}`);

// "2시간 30분 남음 · 21:00 마감" (card, expanded row)
// dropClose: the expanded row's "오늘 운영 08:00–22:00" line already says when it ends
function statusText(status, at, wall, { dropClose = false } = {}) {
  if (status.suspended) return '임시 휴관 중';
  if (status.state === 'unknown') return unknownText(wall);
  if (status.state === 'closed') {
    if (status.onBreak && status.nextOpenAt) return `휴게 중 · ${whenText(status.nextOpenAt, at)} 재개`;
    return status.nextOpenAt ? `닫힘 · 다음 오픈 ${whenText(status.nextOpenAt, at)}` : '닫힘 · 다음 오픈 정보 없음';
  }
  const h = Math.floor(status.remainingMin / 60);
  const m = status.remainingMin % 60;
  const left = `${h ? `${h}시간 ` : ''}${m || !h ? `${m}분 ` : ''}남음`;
  if (dropClose && status.endKind !== 'break') return left.trim();
  return `${left} · ${whenText(status.closeAt, at)} ${status.endKind === 'break' ? '휴게 시작' : '마감'}`;
}

// "2시간 가능" / "곧 마감 · 20분 남음" / "10/8 10:00 오픈" (list row)
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
function rowLeft(status, at, wall) {
  if (status.suspended) return wall.suspended?.note ?? ''; // the 임시 휴관 중 group already says it: only the reason, if any
  if (status.state === 'unknown') return unknownText(wall);
  if (status.state === 'closed') {
    const d = status.nextOpenAt;
    if (!d) return '다음 오픈 정보 없음';
    return `${ymd(d) === ymd(at) ? '' : `${md(d)} `}${fmtMin(d.getHours() * 60 + d.getMinutes())} 오픈`;
  }
  const r = status.remainingMin;
  const brk = status.endKind === 'break';
  if (r <= 60) return brk ? `곧 휴게 · ${r}분 후` : `곧 마감 · ${r}분 남음`;
  // whole hours only ("3시간 45분" rounds down): the list says roughly how long, the card has the exact minutes
  return `${Math.floor(r / 60)}시간 ${brk ? '뒤 휴게' : '가능'}`; // "가능": the slider is the arrival time, so it is how long you can stay from then
}

// ---- sun ----
// Sun word on an open list row, so 응달 and "facing unknown" read apart too (not only the orange band).
function sunTag(row) {
  if (row.status.state !== 'open') return null;
  if (row.wall?.venue === 'indoor') return { text: '실내', tone: 'indoor' }; // no sun indoors
  if (row.lit === true) return { text: '양달', tone: 'sun' };
  if (row.lit === false) return { text: '응달', tone: 'shade' };
  return { text: '방향 모름', tone: 'unknown' };
}

function sunNote(row) {
  if (row.wall.venue === 'indoor') return '실내 · 양달/응달 해당 없음';
  if (row.lit === null) return '벽 방향 미입력';
  const est = row.method === 'override' ? '' : '예상 '; // typed-in times keep their own 직접 입력 tag instead
  const label = row.lit ? `${est}양달` : row.reason === 'terrain' ? `${est}응달 · 산에 가려짐` : `${est}응달`; // words only: ☀/☁ are drawn differently on every phone
  return `${label}${row.method === 'azimuth' ? ' · 방위각 기준' : row.method === 'override' ? ' · 직접 입력' : ''}`;
}

// ---- bar ----
const noSunText = (wall) => (wall.venue === 'indoor' ? '실내' : '양달 정보 없음');

// A closed row whose next opening falls on a later day draws that day's hours (openIntervals of nextOpenAt's
// day, the same source as getStatus), so "10/8 10:00 오픈" sits on 10/8's bar. `ahead` is that day; it has
// no "now" (nowMin null) and nothing is past.
function rowBar(wall, status, at) {
  const next = status.state === 'closed' ? status.nextOpenAt : null;
  if (!next || ymd(next) === ymd(at)) return { ...dayBar(wall, at), ahead: null };
  const day = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const { open, sun } = dayBar(wall, day);
  const sunText = sun ? `예상 양달 ${formatRanges(sun)}` : noSunText(wall);
  return { open, sun, nowMin: null, ahead: day, label: `${day.getMonth() + 1}/${day.getDate()} 운영 ${formatRanges(open)}, ${sunText}` };
}

// segments: the list row's bar on the 06–24 axis ([a, b, past]); sunBands: its sun, only where the wall is open (sun before opening or
// after closing says nothing about a visit, and drew as an orange line detached from the green bar), empty pieces dropped;
// note: the card's line under its full-day bar ("10/8(목) 운영 · 양달 정보 없음"), null when nothing to say.
function barOf(wall, status, at) {
  const bar = rowBar(wall, status, at);
  const words = [bar.ahead ? `${dayText(bar.ahead)} 운영` : null, bar.sun ? null : noSunText(wall)].filter(Boolean);
  return {
    ...bar,
    segments: barSegments(bar.open, bar.nowMin ?? -1),
    sunBands: (bar.sun ?? []).flatMap(([s, e]) => bar.open.map(([a, b]) => [Math.max(s, a), Math.min(e, b)])).filter(([a, b]) => axisFrac(b) > axisFrac(a)),
    note: bar.ahead || !bar.sun ? words.join(' · ') : null,
  };
}

// Gaps between a day's open intervals (lunch break etc.), as chip words.
function breakTags(wall, at) {
  const open = openIntervals(wall, at);
  return open.slice(1).map(([a], i) => [open[i][1], a]).filter(([x, y]) => y > x).map((r) => `휴게 ${formatRanges([r])}`);
}

// ---- facts ----
const PARKING_TEXT = {
  free: ['주차 가능', 'good'], // 무료·유료 is no reason to leave the car at home: both read 가능 (the price is the 요금 line)
  paid: ['주차 가능', 'good'],
  none: ['주차 불가', 'warn'],
};
function parkingLabel(parking) {
  const [text, tone] = PARKING_TEXT[parking?.status] ?? ['주차 확인 필요', 'muted'];
  return { text, word: text.replace(/^주차 /, ''), tone, note: parking?.note ?? '', ...(parking?.fee ? { fee: parking.fee } : {}) };
}
// Parking names from the note ("외벽 앞 · 롯데몰 · 공영주차장").
const parkingNames = (parking) => (parking?.note ?? '').split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
// The note mixes the wall's own lot ("외벽 앞(협소)", "건물 주차장") with lots nearby; the first kind is told apart
// by its wording, everything else reads as 주변.
const ON_SITE = /^(?:(?:인공)?(?:외벽|암벽장)\s*앞|(?:건물|센터)\s*주차장)/;
// Lists kept in the data (parking.onsite / nearby) win; a wall without them (older storage, an import) falls back to the note's wording.
// A fee counts too: a wall that has its price in the data has its note as advice, not as lot names.
const hasLots = (parking) => Boolean(parking?.onsite?.length || parking?.nearby?.length || parking?.fee);
const parkingWhereOf = (parking) => {
  if (hasLots(parking)) return { onsite: parking.onsite ?? [], nearby: parking.nearby ?? [] };
  const names = parkingNames(parking);
  return { onsite: names.filter((n) => ON_SITE.test(n)), nearby: names.filter((n) => !ON_SITE.test(n)) };
};

/**
 * parkingView(parking) → the parking part of the card model: the badge (`parking`), the lots (`parkingWhere`), the advice line (`parkingTip`),
 * what the wall sheet's 주차 section adds (`parkingMore`). The admin editor draws its preview from this same function.
 */
export function parkingView(parking) {
  const parkingWhere = parkingWhereOf(parking);
  const parkingTip = hasLots(parking) ? parking.note ?? '' : ''; // with the lots in the data the note is not names to split but a line of advice
  return {
    parking: parkingLabel(parking),
    parkingNames: parkingNames(parking),
    parkingWhere,
    parkingTip,
    parkingMore: [ // what the 주차 section of the wall sheet adds to the face's one line (status + the wall's own lot)
      { k: '요금', v: parking?.fee ?? '' },
      { k: '주변', v: parkingWhere.nearby.join(' · ') },
      { k: '참고', v: parkingTip },
    ].filter((r) => r.v),
    parkingMemo: parking?.note ? `주차 메모 · ${parking.note}` : null,
  };
}

export function formatDistance(km) {
  if (km < 1) {
    const m = Math.round(km * 100) * 10;
    return m >= 1000 ? '1.0km' : `${m}m`;
  }
  return `${km.toFixed(1)}km`;
}

// Hours older than a year may have changed (seasonal schedules, notices): flag them. Only walls with hours are judged.
const STALE_DAYS = 365;
export function staleness(wall, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wall.checked_at ?? '');
  const days = m ? Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5) : null;
  const stale = hasHours(wall) && (days === null || days > STALE_DAYS);
  return { stale, label: m ? `${m[1]}-${m[2]}` : '확인일 없음' };
}

// which timetable a 'both' wall is read on (viewOf); indoor-missing already says so in its status
const BASIS = { outdoor: '실외 시간 기준', indoor: '실내 시간 기준' };
// 무료/유료 tags mean the entrance fee: shown beside the name, not among the chips (parking has its own).
const isFee = (t) => t === '무료' || t === '유료';
/** The label under the height on a photo-less card: the first of these tags the wall has ('' when none). The admin preview calls this too. */
export const placeholderSecondary = (tags) => ['스피드월', '리드', '볼더', '실내벽'].find((t) => (tags ?? []).includes(t)) ?? '';
/** The tags that go on the expanded card's tags line (the 무료/유료 fee tags have their own place beside the name). */
export const cardTags = (tags) => (tags ?? []).filter((t) => !isFee(t));
const safeUrl = (u) => (/^https?:\/\//i.test(u ?? '') ? u : null);
// 예약 pill: a link to the reservation site
// 공지: one cell however many places the wall posts its notices (its site, its Naver place page, Instagram); with several the card asks which.
function noticeLink(c) {
  const from = [
    safeUrl(c.notice_url) && { id: 'site', label: '공지사항', href: c.notice_url },
    safeUrl(c.naver_map) && { id: 'naver', label: '네이버', href: c.naver_map },
    c.instagram && { id: 'insta', label: '인스타그램', href: `https://www.instagram.com/${encodeURIComponent(c.instagram.replace(/^@/, ''))}/` },
  ].filter(Boolean);
  if (!from.length) return null;
  return from.length === 1 ? { label: '공지', href: from[0].href } : { label: '공지', href: from[0].href, choices: from, ask: true };
}

// 전화: one cell however many numbers (the wall's own, plus any 문의 number from the memo, all just 전화); with several the card asks which to call.
function phoneLink(main, extra) {
  const tel = (n) => `tel:${n.replace(/[^\d+]/g, '')}`;
  const nums = [main && { id: 'main', label: main, href: tel(main) }, ...extra.map((n, i) => ({ id: `x${i}`, label: n, href: tel(n) }))].filter(Boolean);
  if (!nums.length) return null;
  if (nums.length > 1) return { label: '전화', href: nums[0].href, choices: nums.map(({ id, label, href }) => ({ id, label, href })), ask: true };
  return { label: '전화', href: nums[0].href };
}

const reserveLink = (r) => safeUrl(r?.url) && { label: '예약', sub: r.name || null, href: r.url };

// ---- memo ----
// Memo text → [{label, value, key}] lines. Lines split on newlines, then on sentence-ending periods
// (not "..." and not after a single letter/digit like "A. B."); a known word at the start becomes the
// label, "짧은 말: 값" too (a colon followed by a space, so "11:00" stays a time). Closures
// (휴무·휴관·휴장·미운영) go first, unless the line says there is none ("정기휴무 없음").
const MEMO_LABEL = /^(?:(주소|폭|정기휴무|정기휴장|휴무|휴관|휴장|겨울 휴장|이용료|문의)(?=[\s(])\s*|([^:()]{1,12}):\s+)(.*)$/;
const CLOSED_LABEL = /^(?:정기\s*)?(?:휴무|휴관|휴장)$/; // 정기휴무 · 휴관 · 휴장 · 정기휴장 read as one 정기휴무 line
const MEMO_KEY = /휴무|휴관|휴장|미운영/;
const MEMO_NONE = /(휴무|휴관|휴장|미운영)\S*\s*없/;
function memoLines(memo) {
  const parts = String(memo ?? '').split('\n')
    .flatMap((l) => l.split(/(?<=(?:[^.\s]{2}|[가-힣])\.)\s+/))
    .map((s) => s.trim().replace(/(?<!\.)\.$/, ''))
    .filter(Boolean);
  const lines = parts.map((part) => {
    // a leading "!" marks a line that can stop a visit: the card face shows it (the mark itself is dropped)
    const marked = /^!/.test(part);
    const s = part.replace(/^!+\s*/, '');
    if (!s) return null;
    const key = marked || (MEMO_KEY.test(s) && !MEMO_NONE.test(s));
    const m = s.match(MEMO_LABEL);
    const raw = (m?.[1] ?? m?.[2])?.trim();
    const label = raw && CLOSED_LABEL.test(raw) ? '정기휴무' : raw;
    const value = m?.[3].replace(/^\(([^()]*)\)$/, '$1').trim();
    return label && value ? { label, value, key } : { label: null, value: s, key };
  }).filter(Boolean);
  return [...lines.filter((l) => l.key), ...lines.filter((l) => !l.key)];
}

// ---- fees (wall.fees / wall.discount, cleaned in normalizeWall) ----
const won = (n) => (n === 0 ? '무료' : `${String(n).replace(/\B(?=(\d{3})+$)/g, ',')}원`);
const WHO = [['adult', '성인'], ['youth', '청소년'], ['child', '어린이']];
// The 요금 tab as rows: per item, one row per who that has a price (성인 always when priced; 청소년·어린이
// only with a value). `all`: one cell over weekday and weekend; weekday/weekend: '-' when only one is known.
// An item with only a note is one row (noteOnly). `split` false: every price is the same on weekdays and holidays. null without fees.
export function feeTable(wall) {
  const fees = wall.fees ?? [];
  if (!fees.length) return null;
  const items = fees.map((f) => {
      const rows = WHO.filter(([k]) => f[k]).map(([k, who]) => (
        f[k].all !== undefined ? { who, all: won(f[k].all) }
          : { who, weekday: f[k].weekday !== undefined ? won(f[k].weekday) : '-', weekend: f[k].weekend !== undefined ? won(f[k].weekend) : '-' }));
      const noteOnly = !rows.length && !f.times;
      // the 부제 times as a row of their own under the prices, in the same weekday / weekend columns
      if (f.times) rows.push(f.times.all !== undefined ? { who: '시간', all: f.times.all, times: true } : { who: '시간', weekday: f.times.weekday ?? '-', weekend: f.times.weekend ?? '-', times: true });
      return { item: f.item, rows, note: withWon(f.note ?? null), noteOnly };
  });
  // split: some price differs between weekday and weekend; without one the 휴일 column is dropped (one 요금 column)
  return { items, split: items.some((it) => it.rows.some((r) => r.all === undefined)), discount: wall.discount || null };
}
// A note is free text, so its prices may come without the unit ("1일 500 · 월 5,000"): add 원 to a comma-grouped number or one of 3+ digits,
// unless a unit already follows (원 명 % 년 시 분 cm 개월 세 타임) or it is part of a time or range (15:00, 09~13).
export const withWon = (s) => (s == null ? s : s.replace(/(?<![\d,.:~])(\d{1,3}(?:,\d{3})+|\d{3,})(?![\d:~]|\s?(?:원|명|%|년|시|분|cm|개월|세|타임))/g, '$1원'));

// One word of price for a pick on a weekend day: 무료, 성인 1,500원 (the first priced 성인 item: weekend, then all, then
// weekday; a 0 won item such as a free lesson is skipped), 유료 when only the tag says so, else null.
export function feeWord(wall) {
  if (wall.tags?.includes('무료')) return '무료';
  for (const f of wall.fees ?? []) {
    const p = [f.adult?.weekend, f.adult?.all, f.adult?.weekday].find((n) => n > 0);
    if (p) return `성인 ${won(p)}`;
  }
  return wall.tags?.includes('유료') ? '유료' : null;
}

// The memo sorted into what the expanded row draws. address: the 주소 line; sizes: 폭 (from "폭 30m") and
// 높이 (height_m); rest: the other lines as 안내, closures and warnings first, then lines about
// hours/seasons, then the rest (each group in memo order).
const SIZE_RE = /^(\d+(?:\.\d+)?)\s*m$/;
const WARN_RE = /주의|금지|제한|불가|⚠/;
const TIME_RE = /휴게|하계|동계|하절기|동절기|평일|주말|운영|개장|재개|\d:\d\d|\d시(?!간)/;
const restRank = (l) => (l.key || WARN_RE.test(l.value) ? 0 : TIME_RE.test(`${l.label ?? ''} ${l.value}`) ? 1 : 2);
const PHONE_RE = /^\+?[\d][\d\- ]{6,}\d$/;
const digits = (v) => String(v ?? '').replace(/\D/g, '');
function memoFacts(wall, lines) {
  let address = wall.address || null; // wall.address wins; the memo 주소 line is then only swallowed (no 안내 duplicate)
  let seenAddr = false;
  let navAddress = null; // "내비 주소": what to type into a navigation app; it rides under the address, not as another 안내 row
  const phones = []; // "문의 010-…": a phone number in the memo goes to the phone cell, unless it is the contact's own number
  const sizes = [];
  const rest = [];
  for (const l of lines) {
    if (l.label === '주소' && !seenAddr) { seenAddr = true; if (!address) address = l.value; }
    else if (!l.label && /^내비 주소\s/.test(l.value) && !navAddress) navAddress = l.value.replace(/^내비 주소\s+/, '');
    else if (l.label === '문의' && PHONE_RE.test(l.value.trim())) {
      if (digits(l.value) !== digits(wall.contact?.phone)) phones.push(l.value.trim());
    }
    else if (l.label === '폭' && SIZE_RE.test(l.value)) { if (!wall.width_m) sizes.push(`폭 ${l.value.match(SIZE_RE)[1]}m`); } // wall.width_m wins; the memo line is then only swallowed
    else rest.push(l);
  }
  if (wall.width_m) sizes.unshift(`폭 ${wall.width_m}m`);
  if (wall.height_m) sizes.push(`높이 ${wall.height_m}m`);
  return { address, navAddress, phones, sizes, rest: rest.sort((a, b) => restRank(a) - restRank(b)) };
}

// 안내 lines: the card face shows the ones that can stop a visit (closures, warnings, "!" lines); every other line goes to the
// wall sheet's 시설 section.
function splitInfo(lines) {
  const shown = lines.filter((l) => l.key || WARN_RE.test(l.value));
  return { shown, folded: lines.filter((l) => !shown.includes(l)) };
}

// 희노애Rock 후기 (the maker's blog): posts newest first; the label shows year-month only. Titles/urls were checked in normalizeWall.
function blogOf(wall) {
  const posts = [...(wall.blog_posts ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!posts.length) return null;
  return {
    posts,
    first: { url: posts[0].url, label: `희노애Rock 후기 · ${posts[0].date.slice(0, 7)}` },
    moreLabel: posts.length > 1 ? `외 ${posts.length - 1}개` : null,
  };
}

// 내 기록 (log.js records of this wall, newest first): "✓ 다녀옴 2번" on the row, the latest 3 in the open card.
function visitsOf(records) {
  return {
    count: records.length,
    label: `✓ 다녀옴 ${records.length}번`,
    recent: records.slice(0, 3).map((r) => {
      const p = dayParts(r.date);
      return { id: r.id, date: `${p.year}.${p.month}.${p.day}(${p.dow})`, memo: recordNote(r) }; // "15:00 · 메모"
    }),
  };
}

// 혼잡도 (crowd.js): the chip under 오늘 운영, only while the wall is open. Reports are sent from the 기록 추가 sheet.
// crowd: { stat: aggregate() or null (no CSV yet) }
function crowdOf(crowd, state) {
  if (!crowd || state !== 'open') return null;
  const s = crowd.stat;
  const chipOf = (level, text) => ({ text, level, bars: CROWD_LEVELS.indexOf(level) + 1, muted: false });
  const chip = !s ? null
    : s.recent ? chipOf(s.recent.level, `방금 제보 ${s.recent.level} · 제보 ${s.recent.n}건 · 최근 90분`)
      : s.level ? chipOf(s.level, `이 시간대 대개 ${s.level} · 제보 ${s.n}건 · ${s.basis}`) // "대개": the adverb "보통" would read as a level
        : { text: '제보 모으는 중', level: null, bars: 0, muted: true };
  return chip ? { chip } : null;
}

// The list row's 혼잡 pill: only when a level is settled (fewer than 3 reports → nothing on the row).
// text is the word alone; aria adds where it comes from.
function crowdTagOf(s) {
  const level = s.recent ? s.recent.level : s.level;
  return { level, text: level, aria: s.recent ? `혼잡도 ${level}, 방금 제보 ${s.recent.n}건` : `혼잡도 ${level}, 이 시간대 제보 ${s.n}건` };
}

// 세팅일: "마지막 세팅 2026-09-12 · 다음 예정 2026-11-03", whichever is known; a next date already past is left out
// (never shown as upcoming). null when there is nothing to say.
export function settingText(setting, today) {
  const parts = [
    setting?.last && `마지막 세팅 ${setting.last}`,
    setting?.next && setting.next >= today && `다음 예정 ${setting.next}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// ---- the model ----
/**
 * cardModel(row, at, {now, visits, crowd}) → plain data for one wall's list row, expanded row and map card.
 * row: a buildList row ({wall, status, lit, reason, method, short}, plus distanceKm from withDistance).
 * at: the picked moment. now: the real clock, only to call the picked day "오늘".
 * visits: this wall's 기록 (newest first). Without any, the model has no `visits` key (same output as before).
 * crowd: see crowdOf. Without it (혼잡도 not set up), or with nothing to show, the model has no `crowd` key.
 * weather: the forecast hour {t, w, g} for the picked moment (weather.js pickHour); adds `weather` {line, windy, temp, wind, gust} (the chips of the line). Without it, no key.
 * settingNew: this ♥ wall's 세팅일 changed since last seen (setting.js); adds `settingBadge`.
 */
// ---- 로프: how long a rope the wall's height asks for (벽 높이 × 2 + 여유 5m, rounded up to a length people carry) ----
// The one number behind every card's rope pill: the rope has to cover the wall twice (up and back down) plus this margin (knots, stretch, the anchor above the top).
// Conservative on purpose; change it here and every card follows.
export const ROPE_MARGIN_M = 5;
export function ropeNeeded(heightM) {
  if (!(heightM > 0)) return null; // no height known: say nothing
  const need = heightM * 2 + ROPE_MARGIN_M;
  const m = ROPE_LENGTHS.find((l) => l >= need);
  return { m: m ?? null, over: m === undefined, need };
}
// The card's rope pills: what the wall asks (ask) and, with a rope picked (ownM), whether mine is enough (own). A hint, never a verdict:
// the basis (height × 2 + the margin) is under the pills for screen readers and as a tooltip.
// officialM (wall.rope_m): the length the wall itself asks for, which replaces the height-based guess (the basis then says so).
export function ropeLine(heightM, ownM = 0, officialM = 0) {
  const official = ROPE_LENGTHS.includes(officialM) ? officialM : 0;
  const r = official ? { m: official, over: false, need: official } : ropeNeeded(heightM);
  if (!r) return null;
  const mine = ROPE_LENGTHS.includes(ownM) ? ownM : 0;
  const ask = r.over ? `로프 ${ROPE_LENGTHS.at(-1)}m 초과` : `로프 ${r.m}m 이상`;
  const own = !mine ? null : mine >= r.need ? { text: `내 ${mine}m 충분`, tone: 'ok' } : { text: `내 ${mine}m 부족`, tone: 'short' };
  return { ask, own, basis: official ? '암장 공식 안내 기준 · 참고용' : `벽 높이 ${heightM}m×2+여유 ${ROPE_MARGIN_M}m 기준 · 참고용` };
}

export function cardModel(row, at, { now = new Date(), visits = null, crowd = null, settingNew = false, weather = null, ropeM = 0 } = {}) {
  const { wall, status } = row;
  const tags = wall.tags ?? [];
  const fee = tags.find(isFee);
  const dist = row.distanceKm != null ? formatDistance(row.distanceKm) : null;
  const basis = BASIS[wall.timeBasis] ?? null;
  const distLine = dist ? `직선 ${dist}` : null;
  const text = statusText(status, at, wall);
  const bar = status.state === 'unknown' || status.suspended ? null : barOf(wall, status, at); // no day bar for a wall that is shut
  const old = staleness(wall, at);
  const pos = wallPosition(wall);
  const approxNote = pos?.approx ? '위치 추정(확인 전)' : null;
  const winterNote = status.winterNote ? `❄ 동절기 · ${status.winterNote}` : null;
  const rainNote = wall.exceptions?.rain_rule ? '☔ 우천 시 운영 여부는 비 온 뒤 확인하세요' : null;
  // a wall with a fee table keeps its prices in the 요금 tab only: no 이용료 line in the card's text
  // a line that starts with a date ("2026-10-17(토)은 …") is a notice: the face keeps it until that day has passed
  const today = ymd(at);
  const noticed = (l) => { const d = /^\d{4}-\d{2}-\d{2}/.exec(l.value)?.[0]; return d && d >= today ? { ...l, key: true } : l; };
  const memo = (wall.fees?.length ? memoLines(wall.memo).filter((l) => l.label !== '이용료') : memoLines(wall.memo)).map(noticed);
  const facts = memoFacts(wall, memo);
  // the 주소 row right below already starts with the region ("서울 광진구 자양동 …"): don't say it twice
  const regionShown = wall.region && !facts.address?.startsWith(wall.region) ? wall.region : null;
  const where = [regionShown, distLine, basis].filter(Boolean).join(' · ');
  const place = [regionShown, distLine].filter(Boolean).join(' · '); // the open card's line under the name; 실외 시간 기준 rides on the 오늘 운영 line there
  const notes = [winterNote && { value: winterNote, key: true }, rainNote && { value: rainNote, key: true }, approxNote && { value: approxNote, key: true }].filter(Boolean); // a guessed position can send you to the wrong place: the face shows it
  const day = dayLine(wall, at);
  const dayLabel = ymd(at) === ymd(now) ? '오늘' : dayText(at);
  const plain = day.closed || /시간 미입력$/.test(day.text); // not "오늘 운영 운영시간 미입력"
  const route = pos ? `https://map.kakao.com/link/to/${encodeURIComponent(wall.name)},${pos.lat},${pos.lng}` : null;
  const routeNaver = pos ? `https://map.naver.com/p/directions/-/${pos.lng},${pos.lat},${encodeURIComponent(wall.name)}/-/transit` : null;
  const c = wall.contact ?? {};
  const hasChat = CHAT_URL_RE.test(c.chat_url ?? '');
  const photo = wall.photo ? `data/${wall.photo}` : null;
  const crowdModel = crowdOf(crowd, status.state);
  const creditOf = (c) => c ? { text: `사진 · ${c.text}${c.license ? ` · ${c.license}` : ''}`, url: c.url || null } : null;
  const credit = photo ? creditOf(wall.photo_credit) : null;
  // every picture of the wall, the main one first then the newest approved (the list is oldest first); the card swipes the first CARD_PHOTOS, the gallery shows all
  const list = Array.isArray(wall.photos) ? wall.photos : [];
  const photos = photo
    ? list.length ? [...list.filter((p) => p.main), ...list.filter((p) => !p.main).reverse()].map((p) => ({ src: `data/${p.src}`, credit: creditOf(p.credit), date: p.date ?? null }))
      : [{ src: photo, credit, date: null }]
    : [];
  return {
    name: wall.name,
    shortName: shortName(wall),
    fee: fee ? `입장 ${fee}` : null,
    tags: cardTags(tags),
    region: wall.region || null,
    dist, // "850m" (list row)
    distLine, // "직선 850m" (card)
    basis,
    meta: [wall.region, dist].filter(Boolean).join(' · ') || null, // list row
    where,
    place, // expanded row
    state: status.state,
    soon: endingSoon(row),
    short: Boolean(row.short),
    statusText: text,
    left: rowLeft(status, at, wall),
    sub: [where, plain ? text : statusText(status, at, wall, { dropClose: true })].filter(Boolean).join(' · '),
    sun: sunTag(row),
    sunNote: sunNote(row),
    bar,
    barBreaks: breakTags(wall, bar?.ahead ?? at), // the card's chips follow its bar's day
    breaks: breakTags(wall, at), // the expanded row's: the picked day
    ...parkingView(wall.parking),
    stale: old.stale,
    staleNote: old.stale ? `⚠ 마지막 확인 ${old.label} · 운영시간이 바뀌었을 수 있어요` : null,
    checked: wall.checked_at ? `정보 확인일 ${wall.checked_at}` : '정보 확인일 없음',
    setting: settingText(wall.setting, ymd(now)),
    settingBadge: settingNew && wall.setting?.last ? '세팅일이 바뀌었어요' : null,
    notes: [winterNote, rainNote, sunNote(row)].filter(Boolean), // card
    info: splitInfo([...notes, ...facts.rest]), // expanded row's 안내 (face) and 시설 (wall sheet)
    sizes: facts.sizes,
    rope: ropeLine(wall.height_m, ropeM, wall.rope_m),
    indoorKinds: (wall.indoor_kinds ?? []).join('+'), // '리드+지구력+볼더링' ('' when unknown); app.js draws it on the tags line as 실내 …
    indoorHeight: wall.venue === 'both' && wall.indoor_height_m ? `실내 높이 ${wall.indoor_height_m}m` : '', // only for 실내+실외 walls (for 'indoor' the plain height is the indoor wall); app.js adds it to the tags line
    address: facts.address,
    navAddress: facts.navAddress,
    memo,
    fees: feeTable(wall),
    approxNote,
    today: { lead: `${day.season ? `${day.season} · ` : ''}${dayLabel}${plain ? '' : `${wall.timeBasis === 'outdoor' ? ' 실외' : ''} 운영`}`, text: day.text },
    holiday: day.holiday,
    closedDay: day.closed,
    suspended: wall.suspended ? { since: wall.suspended.since ? `${+wall.suspended.since.slice(5, 7)}/${+wall.suspended.since.slice(8)}부터` : null, note: wall.suspended.note ?? null } : null,
    dayLabel,
    route,
    hasChat, // the card offers 오픈채팅 추가 only while there is none
    links: [
      // the order a visitor reaches for them: the notice (the evidence for the hours), the chat room, then the phone
      noticeLink(c),
      reserveLink(c.reserve),
      hasChat && { label: '오픈채팅', href: c.chat_url },
      phoneLink(c.phone, facts.phones),
      route && { label: '길찾기', href: route, primary: true, choices: [{ id: 'kakao', label: '카카오맵', href: route }, { id: 'naver', label: '네이버지도', href: routeNaver }] }, // the card asks which app, once
    ].filter(Boolean),
    blog: blogOf(wall),
    photo,
    placeholder: {
      primary: wall.height_m ? `${wall.height_m}m` : '외벽',
      secondary: placeholderSecondary(tags),
    },
    credit,
    photos,
    // 다녀왔어요 pill: "다녀왔어요" until the first record, then "다녀옴 N번" (a tap adds one more)
    beenLabel: visits?.length ? `다녀옴 ${visits.length}번` : '다녀왔어요',
    ...(visits?.length ? { visits: visitsOf(visits), beenAria: `다녀왔어요 기록 추가, 지금까지 ${visits.length}번` } : {}),
    ...(crowdModel ? { crowd: crowdModel } : {}),
    ...(weather ? { weather: { line: weatherLine(weather), windy: windy(weather), temp: `${Math.round(weather.t)}°`, wind: `바람 ${Math.round(weather.w)}m/s`, gust: `돌풍 ${Math.round(weather.g)}m/s` } } : {}),
    ...(crowdModel?.chip?.level ? { crowdTag: crowdTagOf(crowd.stat) } : {}),
  };
}
