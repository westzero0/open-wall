// src/card-model.js — one list row → every value the list row, the expanded row and the map card draw.
// No DOM: app.js only draws what this returns, so the three views can't phrase the same rule differently.
import { hasHours, openIntervals } from './hours.js';
import { hhmm, ymd } from './time.js';
import { CHAT_URL_RE } from './store.js';
import { dayParts } from './log.js';
import {
  axisFrac, barSegments, dayBar, dayLine, dayText, endingSoon, fmtMin, formatRanges, shortName, unknownText, wallPosition,
} from './viewmodel.js';

// ---- status ----
const whenText = (d, base) => (ymd(d) === ymd(base) ? hhmm(d) : `${dayText(d)} ${hhmm(d)}`);

// "2시간 30분 남음 · 21:00 마감" (card, expanded row)
// dropClose: the expanded row's "오늘 운영 08:00–22:00" line already says when it ends
function statusText(status, at, wall, { dropClose = false } = {}) {
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

// "2시간 30분 남음" / "곧 마감 · 20분 남음" / "10/8 10:00 오픈" (list row)
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
function rowLeft(status, at, wall) {
  if (status.state === 'unknown') return unknownText(wall);
  if (status.state === 'closed') {
    const d = status.nextOpenAt;
    if (!d) return '다음 오픈 정보 없음';
    return `${ymd(d) === ymd(at) ? '' : `${md(d)} `}${fmtMin(d.getHours() * 60 + d.getMinutes())} 오픈`;
  }
  const r = status.remainingMin;
  const brk = status.endKind === 'break';
  if (r <= 60) return brk ? `곧 휴게 · ${r}분 후` : `곧 마감 · ${r}분 남음`;
  return `${Math.floor(r / 60)}시간${r % 60 ? ` ${r % 60}분` : ''} ${brk ? '뒤 휴게' : '남음'}`;
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
  const label = row.lit ? '☀ 양달' : row.reason === 'terrain' ? '☁ 응달 · 산에 가려짐' : '☁ 응달';
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
  const sunText = sun ? `양달 ${formatRanges(sun)}` : noSunText(wall);
  return { open, sun, nowMin: null, ahead: day, label: `${day.getMonth() + 1}/${day.getDate()} 운영 ${formatRanges(open)}, ${sunText}` };
}

// segments: the list row's bar on the 06–24 axis ([a, b, past]); sunBands: its sun, empty pieces dropped;
// note: the card's line under its full-day bar ("10/8(목) 운영 · 양달 정보 없음"), null when nothing to say.
function barOf(wall, status, at) {
  const bar = rowBar(wall, status, at);
  const words = [bar.ahead ? `${dayText(bar.ahead)} 운영` : null, bar.sun ? null : noSunText(wall)].filter(Boolean);
  return {
    ...bar,
    segments: barSegments(bar.open, bar.nowMin ?? -1),
    sunBands: (bar.sun ?? []).filter(([a, b]) => axisFrac(b) > axisFrac(a)),
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
  free: ['주차 무료', 'good'],
  paid: ['주차 유료', 'neutral'],
  none: ['주차 불가', 'warn'],
};
function parkingLabel(parking) {
  const [text, tone] = PARKING_TEXT[parking?.status] ?? ['주차 확인 필요', 'muted'];
  return { text, word: text.replace(/^주차 /, ''), tone, note: parking?.note ?? '' };
}
// Parking names from the note ("외벽 앞 · 롯데몰 · 공영주차장").
const parkingNames = (parking) => (parking?.note ?? '').split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
// The note mixes the wall's own lot ("외벽 앞(협소)", "건물 주차장") with lots nearby; the first kind is told apart
// by its wording, everything else reads as 주변.
const ON_SITE = /^(?:(?:인공)?(?:외벽|암벽장)\s*앞|(?:건물|센터)\s*주차장)/;
const parkingWhere = (parking) => {
  const names = parkingNames(parking);
  return { onsite: names.filter((n) => ON_SITE.test(n)), nearby: names.filter((n) => !ON_SITE.test(n)) };
};

function formatDistance(km) {
  if (km < 1) {
    const m = Math.round(km * 100) * 10;
    return m >= 1000 ? '1.0km' : `${m}m`;
  }
  return `${km.toFixed(1)}km`;
}

// Hours older than a year may have changed (seasonal schedules, notices): flag them. Only walls with hours are judged.
const STALE_DAYS = 365;
function staleness(wall, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wall.checked_at ?? '');
  const days = m ? Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5) : null;
  const stale = hasHours(wall) && (days === null || days > STALE_DAYS);
  return { stale, label: m ? `${m[1]}-${m[2]}` : '확인일 없음' };
}

// which timetable a 'both' wall is read on (viewOf); indoor-missing already says so in its status
const BASIS = { outdoor: '실외 시간 기준', indoor: '실내 시간 기준' };
// 무료/유료 tags mean the entrance fee: shown beside the name, not among the chips (parking has its own).
const isFee = (t) => t === '무료' || t === '유료';
const safeUrl = (u) => (/^https?:\/\//i.test(u ?? '') ? u : null);

// ---- memo ----
// Memo text → [{label, value, key}] lines. Lines split on newlines, then on sentence-ending periods
// (not "..." and not after a single letter/digit like "A. B."); a known word at the start becomes the
// label, "짧은 말: 값" too (a colon followed by a space, so "11:00" stays a time). Closures
// (휴무·휴관·휴장·미운영) go first, unless the line says there is none ("정기휴무 없음").
const MEMO_LABEL = /^(?:(주소|폭|정기휴무|겨울 휴장|이용료|문의)(?=[\s(])\s*|([^:()]{1,12}):\s+)(.*)$/;
const MEMO_KEY = /휴무|휴관|휴장|미운영/;
const MEMO_NONE = /(휴무|휴관|휴장|미운영)\S*\s*없/;
function memoLines(memo) {
  const parts = String(memo ?? '').split('\n')
    .flatMap((l) => l.split(/(?<=(?:[^.\s]{2}|[가-힣])\.)\s+/))
    .map((s) => s.trim().replace(/(?<!\.)\.$/, ''))
    .filter(Boolean);
  const lines = parts.map((s) => {
    const key = MEMO_KEY.test(s) && !MEMO_NONE.test(s);
    const m = s.match(MEMO_LABEL);
    const label = (m?.[1] ?? m?.[2])?.trim();
    const value = m?.[3].replace(/^\(([^()]*)\)$/, '$1').trim();
    return label && value ? { label, value, key } : { label: null, value: s, key };
  });
  return [...lines.filter((l) => l.key), ...lines.filter((l) => !l.key)];
}

// The memo sorted into what the expanded row draws. address: the 주소 line; sizes: 폭 (from "폭 30m") and
// 높이 (height_m); rest: the other lines as 안내, closures and warnings first, then lines about
// hours/seasons, then the rest (each group in memo order).
const SIZE_RE = /^(\d+(?:\.\d+)?)\s*m$/;
const WARN_RE = /주의|금지|제한|불가|⚠/;
const TIME_RE = /휴게|하계|동계|하절기|동절기|평일|주말|운영|개장|재개|\d:\d\d|\d시(?!간)/;
const restRank = (l) => (l.key || WARN_RE.test(l.value) ? 0 : TIME_RE.test(`${l.label ?? ''} ${l.value}`) ? 1 : 2);
function memoFacts(wall, lines) {
  let address = null;
  const sizes = [];
  const rest = [];
  for (const l of lines) {
    if (l.label === '주소' && !address) address = l.value;
    else if (l.label === '폭' && SIZE_RE.test(l.value)) sizes.push(`폭 ${l.value.match(SIZE_RE)[1]}m`);
    else rest.push(l);
  }
  if (wall.height_m) sizes.push(`높이 ${wall.height_m}m`);
  return { address, sizes, rest: rest.sort((a, b) => restRank(a) - restRank(b)) };
}

// 안내 lines in the first view: the first `limit` show, the rest fold. Warning/closure lines come first,
// so a run of them longer than `limit` is shown whole.
function splitInfo(lines, limit = 3) {
  let warn = 0;
  while (warn < lines.length && (lines[warn].key || WARN_RE.test(lines[warn].value))) warn++;
  const n = Math.max(limit, warn);
  const folded = lines.slice(n);
  return { shown: lines.slice(0, n), folded, moreLabel: folded.length ? `안내 ${folded.length}줄 더 보기` : null };
}

// 내 후기: posts newest first; the label shows year-month only. Titles/urls were checked in normalizeWall.
function blogOf(wall) {
  const posts = [...(wall.blog_posts ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!posts.length) return null;
  return {
    posts,
    first: { url: posts[0].url, label: `내 후기 · ${posts[0].date.slice(0, 7)}` },
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
      return { id: r.id, date: `${p.year}.${p.month}.${p.day}(${p.dow})`, memo: r.memo ?? '' };
    }),
  };
}

// ---- the model ----
/**
 * cardModel(row, at, {now, visits}) → plain data for one wall's list row, expanded row and map card.
 * row: a buildList row ({wall, status, lit, reason, method, short}, plus distanceKm from withDistance).
 * at: the picked moment. now: the real clock, only to call the picked day "오늘".
 * visits: this wall's 기록 (newest first). Without any, the model has no `visits` key (same output as before).
 */
export function cardModel(row, at, { now = new Date(), visits = null } = {}) {
  const { wall, status } = row;
  const tags = wall.tags ?? [];
  const fee = tags.find(isFee);
  const dist = row.distanceKm != null ? formatDistance(row.distanceKm) : null;
  const basis = BASIS[wall.timeBasis] ?? null;
  const distLine = dist ? `직선 ${dist}` : null;
  const where = [wall.region, distLine, basis].filter(Boolean).join(' · ');
  const text = statusText(status, at, wall);
  const bar = status.state === 'unknown' ? null : barOf(wall, status, at);
  const old = staleness(wall, at);
  const pos = wallPosition(wall);
  const approxNote = pos?.approx ? '위치 추정(확인 전)' : null;
  const winterNote = status.winterNote ? `❄ 동절기 · ${status.winterNote}` : null;
  const rainNote = wall.exceptions?.rain_rule ? '☔ 우천 시 운영 여부는 비 온 뒤 확인하세요' : null;
  const memo = memoLines(wall.memo);
  const facts = memoFacts(wall, memo);
  const notes = [winterNote && { value: winterNote, key: true }, rainNote && { value: rainNote, key: true }, approxNote && { value: approxNote }].filter(Boolean);
  const day = dayLine(wall, at);
  const dayLabel = ymd(at) === ymd(now) ? '오늘' : dayText(at);
  const plain = day.closed || /시간 미입력$/.test(day.text); // not "오늘 운영 운영시간 미입력"
  const route = pos ? `https://map.kakao.com/link/to/${encodeURIComponent(wall.name)},${pos.lat},${pos.lng}` : null;
  const c = wall.contact ?? {};
  const hasChat = CHAT_URL_RE.test(c.chat_url ?? '');
  const photo = wall.photo ? `data/${wall.photo}` : null;
  const credit = wall.photo_credit && photo
    ? { text: `사진 · ${wall.photo_credit.text}${wall.photo_credit.license ? ` · ${wall.photo_credit.license}` : ''}`, url: wall.photo_credit.url || null }
    : null;
  return {
    name: wall.name,
    shortName: shortName(wall),
    fee: fee ? `입장 ${fee}` : null,
    tags: tags.filter((t) => !isFee(t)),
    region: wall.region || null,
    dist, // "850m" (list row)
    distLine, // "직선 850m" (card)
    basis,
    meta: [wall.region, dist].filter(Boolean).join(' · ') || null, // list row
    where, // expanded row
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
    parking: parkingLabel(wall.parking),
    parkingNames: parkingNames(wall.parking),
    parkingWhere: parkingWhere(wall.parking),
    parkingMemo: wall.parking?.note ? `주차 메모 · ${wall.parking.note}` : null,
    stale: old.stale,
    staleNote: old.stale ? `⚠ 마지막 확인 ${old.label} · 운영시간이 바뀌었을 수 있어요` : null,
    checked: wall.checked_at ? `정보 확인일 ${wall.checked_at}` : '정보 확인일 없음',
    notes: [winterNote, rainNote, sunNote(row)].filter(Boolean), // card
    info: splitInfo([...notes.filter((n) => n.key), ...facts.rest, ...notes.filter((n) => !n.key)]), // expanded row's 안내
    sizes: facts.sizes,
    address: facts.address,
    memo,
    approxNote,
    today: { lead: `${day.season ? `${day.season} · ` : ''}${dayLabel}${plain ? '' : ' 운영'}`, text: day.text },
    holiday: day.holiday,
    closedDay: day.closed,
    dayLabel,
    route,
    hasChat, // the card offers 오픈채팅방 알려주기 only while there is none
    links: [
      // the order a visitor reaches for them: the notice (the evidence for the hours), the chat room, then the phone
      safeUrl(c.notice_url) && { label: '공지사항', href: c.notice_url },
      c.instagram && { label: '인스타 공지', href: `https://www.instagram.com/${encodeURIComponent(c.instagram.replace(/^@/, ''))}/` },
      hasChat && { label: '오픈채팅', href: c.chat_url },
      c.phone && { label: '전화', href: `tel:${c.phone.replace(/[^\d+]/g, '')}` },
      safeUrl(c.naver_map) && { label: '네이버지도', href: c.naver_map },
      route && { label: '길찾기', href: route, primary: true },
    ].filter(Boolean),
    blog: blogOf(wall),
    photo,
    placeholder: {
      primary: wall.height_m ? `${wall.height_m}m` : '외벽',
      secondary: ['스피드월', '리드', '볼더', '실내벽'].find((t) => tags.includes(t)) ?? '',
    },
    heroText: `${wall.height_m ? `높이 ${wall.height_m}m · ` : ''}사진 준비 중`,
    credit,
    ...(visits?.length ? { visits: visitsOf(visits) } : {}),
  };
}
