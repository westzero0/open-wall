// notice/model.js — 외벽 관리자 공지 도구의 순수 로직(DOM 없음): 날짜 → 제목·본문·인스타 캡션·해벽 반영 패치.
// 이미지(card.js)와 글(여기)이 같은 notice 객체에서 나오므로, 날짜나 사유를 바꾸면 둘이 함께 바뀐다.
import { holidayName } from '../src/holidays.js';
import { DAY_KO } from '../src/time.js';

export const KINDS = {
  today: { label: '오늘 상태·마감', head: '이용안내', tag: '이용안내' },
  holiday: { label: '월별 공휴일 휴관', head: '휴관안내', tag: '휴관안내' },
  temp: { label: '임시휴무', head: '임시휴무', tag: '임시휴무' },
  hours: { label: '운영시간 변경·단축운영', head: '운영시간 변경', tag: '운영시간변경' },
  zone: { label: '점검·세팅 (구역 이용 제한)', head: '이용제한', tag: '구역이용제한' },
  info: { label: '안내문 (안전 수칙·분실물·민원)', head: '안내', tag: '이용안내' },
};

// 안내문의 세 갈래. 상태·날짜가 아니라 글이 중심이라 해벽 상태에는 반영하지 않고 글과 이미지만 만든다.
export const INFO_TYPES = { safety: '안전 수칙', lost: '분실물(습득물)', civil: '이용·민원 안내' };

// 맺음말 문체: 공단·공공시설은 격식체, 민간은 부드러운 말투. 은평인공암벽장 공지를 본뜬 formal 이 기본.
export const CLOSINGS = {
  formal: {
    label: '격식체',
    holiday: ['해당일에는 암벽장 이용이 불가하오니, 착오 없으시길 바랍니다.', '앞으로도 안전하고 쾌적한 시설 운영을 위해 최선을 다하겠습니다.', '감사합니다.'],
    temp: ['해당일에는 암벽장 이용이 불가하오니, 착오 없으시길 바랍니다.', '이용에 불편을 드려 죄송합니다.', '감사합니다.'],
    hours: ['해당일에는 변경된 시간에 맞춰 이용해 주시기 바랍니다.', '이용에 불편을 드려 죄송합니다.', '감사합니다.'],
    today: ['상황이 바뀌면 다시 안내드리겠습니다.', '이용에 불편을 드려 죄송합니다.', '감사합니다.'],
    zone: ['해당 구역은 위 일시 동안 이용이 제한되오니 양해 부탁드립니다.', '이용에 불편을 드려 죄송합니다.', '감사합니다.'],
    info: { safety: ['모두의 안전을 위해 협조 부탁드립니다.', '감사합니다.'], lost: ['본인의 물품이 맞다면 위 방법으로 문의해 주시기 바랍니다.', '감사합니다.'], civil: ['이용에 참고해 주시기 바랍니다.', '감사합니다.'] },
  },
  friendly: {
    label: '부드러운 말투',
    holiday: ['이날은 쉬어가요! 방문 전에 꼭 확인해 주세요 :)', '더 좋은 모습으로 만나요.'],
    temp: ['이날은 문을 닫아요. 헛걸음하지 않도록 미리 알려드려요.', '불편을 드려 죄송해요!'],
    hours: ['이날은 운영시간이 달라요. 방문 전에 꼭 확인해 주세요 :)', '불편을 드려 죄송해요!'],
    today: ['상황이 바뀌면 바로 다시 알려드릴게요.', '헛걸음 없으시길 바라요!'],
    zone: ['이 구역은 위 시간에 쉬어가요. 양해 부탁드려요!', '불편을 드려 죄송해요.'],
    info: { safety: ['모두가 안전하게 오래 즐길 수 있게 함께 지켜 주세요!'], lost: ['내 물건이 맞다면 위 방법으로 편하게 문의해 주세요 :)'], civil: ['이용에 참고해 주세요 :)'] },
  },
};

// 오늘 상태: 한 번 누르면 공지가 완성된다. tone 은 카드 색(초록=정상, 주황=조심, 빨강=이용 불가·마감), alt 는 대체 외벽을 같이 안내할지.
export const STATUSES = {
  open: { label: '정상 운영', short: '정상 운영', badge: '정상', tone: '#2e9e5b', line: () => '현재 정상 운영 중입니다.', alt: false, timed: false },
  resume: { label: '다시 이용 가능', short: '이용 재개', badge: '이용 가능', tone: '#2e9e5b', line: () => '자리가 나서 다시 이용하실 수 있습니다.', alt: false, timed: false },
  caution: { label: '일부 구역 이용 제한', short: '일부 구역 이용 제한', badge: '일부 제한', tone: '#d98a00', line: (u) => `일부 구역은 ${u ? `${u}까지` : '현재'} 이용이 제한됩니다.`, alt: true, timed: true },
  rain: { label: '우천으로 이용 불가', short: '우천 이용 불가', badge: '우천', tone: '#d98a00', line: (u) => `우천으로 벽면이 젖어 ${u ? `${u}까지` : '현재'} 이용이 어렵습니다.`, alt: true, timed: true },
  wind: { label: '강풍으로 이용 불가', short: '강풍 이용 불가', badge: '강풍', tone: '#d98a00', line: (u) => `강풍으로 안전을 위해 ${u ? `${u}까지` : '현재'} 이용을 제한합니다.`, alt: true, timed: true },
  full: { label: '정원 초과 · 마감', short: '마감', badge: '마감', tone: '#c0392b', line: (u) => `현장 정원이 차서 ${u ? `${u}까지` : '오늘'} 이용이 마감되었습니다.`, alt: true, timed: true },
};

// 점검·세팅: 구역은 외벽마다 다르다. 해벽 데이터에는 구역 목록이 아직 없어서 여기에 둔다(은평: 데이터의 메모 '실내 1~3층 지구력 암장 · 실외 리드 벽'과 태그 '스피드월').
// 데이터에 zones 필드가 생기면 이 표는 없앤다. 목록에 없는 외벽은 기본 구역에서 시작하고, 관리자가 직접 더할 수 있다(이 기기에 저장).
export const ZONE_PRESETS = {
  은평인공암벽장: ['지구력벽 1층', '지구력벽 2층', '지구력벽 3층', '외부 리드월', '스피드월'],
};
export const DEFAULT_ZONES = ['리드벽', '스피드월', '볼더링벽', '지구력벽'];
export const ZONE_REASONS = ['정기 점검', '루트 세팅', '볼트·로프 점검', '청소·보수', '강습·전용 사용'];

export const REASON_CHIPS = ['기상 악화', '시설 점검', '볼트·루트 세팅', '행사·대회', '공사'];

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const ymKey = (s) => s.slice(0, 7);

/** "10월 3일(토)" */
export const fmtDate = (s) => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일(${DAY_KO[d.getDay()]})`; };

/** reasonFor(state, date) → the reason printed after the date, '' when none. */
export function reasonFor(st, date) {
  if (st.kind === 'holiday') return st.reasons?.[date] ?? holidayName(parse(date)) ?? '';
  return st.reason ?? '';
}

/** runs(st, dates) → consecutive days with the same reason folded into one row: [{ from, to, reason }]. */
export function runs(st, dates) {
  const out = [];
  for (const date of [...dates].sort()) {
    const reason = reasonFor(st, date);
    const last = out[out.length - 1];
    const next = last && key(new Date(parse(last.to).getTime() + 26 * 3600 * 1000)) === date; // +26h survives DST
    if (last && next && last.reason === reason) last.to = date;
    else out.push({ from: date, to: date, reason });
  }
  return out;
}

/** rangeText({from,to}) → "10월 3일(토)" or "2월 16일(월) ~ 18일(수)" (month repeats only when it changes). */
export function rangeText({ from, to }) {
  if (from === to) return fmtDate(from);
  const a = parse(from), b = parse(to);
  const end = a.getMonth() === b.getMonth() ? `${b.getDate()}일(${DAY_KO[b.getDay()]})` : fmtDate(to);
  return `${fmtDate(from)} ~ ${end}`;
}

/** holidayCandidates(month 'YYYY-MM') → [{ date, name }] public holidays (not plain Sundays) in that month. */
export function holidayCandidates(month) {
  const [y, m] = month.split('-').map(Number);
  const out = [];
  for (let d = 1; d <= 31; d += 1) {
    const dt = new Date(y, m - 1, d);
    if (dt.getMonth() !== m - 1) break;
    const name = holidayName(dt);
    if (name) out.push({ date: key(dt), name });
  }
  return out;
}

/** The dates that belong in the notice: the holiday notice is for one month, the others take every chosen day. */
export const activeDates = (st) => [...(st.dates ?? [])].filter((d) => st.kind !== 'holiday' || ymKey(d) === st.month).sort();

const hoursText = (st) => (st.open && st.close ? `${st.open}~${st.close}` : '');

/** buildNotice(state) → { ok, kind, rows, title, head, badge, body, caption, patch }. state: see notice/app.js. */
export function buildNotice(st) {
  if (st.kind === 'today') return buildToday(st);
  if (st.kind === 'zone') return buildZone(st);
  if (st.kind === 'info') return buildInfo(st);
  const kind = KINDS[st.kind] ?? KINDS.holiday;
  const dates = activeDates(st);
  const rs = runs(st, dates);
  const wall = (st.wall ?? '').trim() || '암벽장';
  const m = st.kind === 'holiday' ? Number(st.month.slice(5)) : null;
  const first = rs[0] ? rangeText(rs[0]) : '';
  const title = st.kind === 'holiday' ? `${wall} ${m}월 법정공휴일 휴관일 안내`
    : st.kind === 'temp' ? `${wall} 임시휴무 안내${first ? ` (${first}${rs.length > 1 ? ` 외 ${rs.length - 1}건` : ''})` : ''}`
      : `${wall} 운영시간 변경 안내${first ? ` (${first}${rs.length > 1 ? ` 외 ${rs.length - 1}건` : ''})` : ''}`;
  const badge = st.kind === 'holiday' ? '법정 공휴일' : st.kind === 'temp' ? (st.reason || '임시휴무') : (hoursText(st) || '시간 변경');

  const rowLine = (r) => {
    const tail = st.kind === 'hours' ? ` : ${hoursText(st) || '운영시간 미정'}${r.reason ? ` (${r.reason})` : ''}` : r.reason ? ` : ${r.reason}` : '';
    return `${rangeText(r)}${tail}`;
  };
  const note = (st.note ?? '').trim();
  const closing = (CLOSINGS[st.closing] ?? CLOSINGS.formal)[st.kind];
  const sign = (st.sign ?? '').trim() || wall;
  const signLine = st.closing === 'formal' ? `- ${sign} 드림 -` : `- ${sign} -`;

  const bodyLines = [`■ ${title}`, ...rs.map(rowLine), ...(note ? ['', note] : []), '', ...closing, signLine];
  const hash = (s) => `#${s.replace(/[\s·]/g, '')}`;
  const caption = [`${title}`, '', ...rs.map(rowLine), ...(note ? ['', note] : []), '', ...closing, '', [hash(wall), '#해벽', '#클라이밍', '#실외암벽', hash(kind.tag)].join(' ')].join('\n');

  const patch = dates.length === 0 ? null : st.kind === 'hours'
    ? { wall, kind: 'hours', hours_dates: dates.map((date) => ({ date, open: st.open, close: st.close, reason: reasonFor(st, date) })) }
    : { wall, kind: st.kind, exceptions: { closed_dates: dates }, reason: st.kind === 'temp' ? st.reason ?? '' : undefined };
  return {
    ok: dates.length > 0 && (st.kind !== 'hours' || Boolean(st.open && st.close)),
    kind: st.kind, wall, month: m, color: null, rows: rs.map((r) => ({ ...r, text: rangeText(r), line: rowLine(r) })), title, head: kind.head, badge,
    panelHead: rs[0] ? `${rs[0].from.slice(0, 4)}년 ${Number(rs[0].from.slice(5, 7))}월` : '날짜를 골라 주세요',
    note, closing, sign, body: bodyLines.join('\n'), caption, patch,
  };
}

const altLine = (a) => `${a.name}${a.venue ? ` (${a.venue === 'indoor' ? '실내' : a.venue === 'both' ? '실내·외벽' : '외벽'})` : ''} · 직선 ${a.km < 10 ? Math.round(a.km * 10) / 10 : Math.round(a.km)}km`;

/** buildToday(state) — 오늘 상태 공지. state.date 'YYYY-MM-DD' and state.at 'HH:MM' are when the button was pressed; the notice is valid to the end of that day. */
function buildToday(st) {
  const status = STATUSES[st.status] ?? STATUSES.open;
  const wall = (st.wall ?? '').trim() || '암벽장';
  const day = st.date ? fmtDate(st.date) : '';
  const stamp = [day, st.at ? `${st.at} 기준` : ''].filter(Boolean).join(' ');
  // 마감 시각: 기본은 그날 운영 종료 시각, 관리자가 바꿀 수 있다. 누른 시각 이전이거나 형식이 틀리면 '오늘 하루'로 본다.
  const until = status.timed && /^\d\d:\d\d$/.test(st.until ?? '') && (!st.at || st.until > st.at) ? st.until : '';
  const alts = status.alt ? (st.alts ?? []) : [];
  const note = (st.note ?? '').trim();
  const closing = (CLOSINGS[st.closing] ?? CLOSINGS.formal).today;
  const sign = (st.sign ?? '').trim() || wall;
  const signLine = st.closing === 'formal' ? `- ${sign} 드림 -` : `- ${sign} -`;
  const title = `${wall} ${day} ${until ? `${until}까지 ` : ''}${status.short} 안내`.replace(/\s+/g, ' ');
  const altBlock = alts.length ? ['', '가까운 다른 외벽', ...alts.map((a) => `· ${altLine(a)}`)] : [];
  const bodyLines = [`■ ${title}`, stamp, '', status.line(until), ...(note ? [note] : []), ...altBlock, '', ...closing, signLine];
  const hash = (s) => `#${s.replace(/[\s·]/g, '')}`;
  const caption = [title, stamp, '', status.line(until), ...(note ? [note] : []), ...altBlock, '', ...closing, '', [hash(wall), '#해벽', '#클라이밍', '#실외암벽', hash(KINDS.today.tag)].join(' ')].join('\n');
  const label = `${status.label}${until ? ` (${until}까지)` : ''}`;
  const rows = [{ from: st.date, to: st.date, reason: '', text: label, line: label },
    ...(note ? [{ from: st.date, to: st.date, reason: '', text: note, line: note }] : []),
    ...alts.map((a) => ({ from: st.date, to: st.date, reason: '', text: `인근 ${altLine(a)}`, line: `인근 ${altLine(a)}` }))];
  return {
    ok: Boolean(st.status), kind: 'today', wall, month: null, color: status.tone, rows, title, head: KINDS.today.head, badge: status.badge,
    panelHead: stamp || '오늘', note, closing, sign, body: bodyLines.join('\n'), caption,
    patch: st.date ? { wall, kind: 'today', status: st.status, at: `${st.date}T${st.at ?? '00:00'}`, until: until || undefined, expires: `${st.date}T${until || '23:59'}`, note: note || undefined, alternatives: alts.map((a) => a.name) } : null,
  };
}

const timeOk = (st) => !st.timed || Boolean(st.open && st.close && st.close > st.open);

/** buildZone(state) — 점검·세팅: which zones are limited, when (whole day or a time range) and why; the rest stay open. */
function buildZone(st) {
  const wall = (st.wall ?? '').trim() || '암벽장';
  const zones = (st.zones ?? []).filter((z) => (st.zoneAll ?? []).includes(z));
  const rest = (st.zoneAll ?? []).filter((z) => !zones.includes(z));
  const dates = activeDates(st);
  const rs = runs(st, dates);
  const when = st.timed && st.open && st.close ? `${st.open}~${st.close}` : '종일';
  const first = rs[0] ? rangeText(rs[0]) : '';
  const zoneName = zones.length <= 2 ? zones.join('·') : `${zones[0]} 외 ${zones.length - 1}곳`;
  const title = `${wall} ${zoneName ? `${zoneName} ` : ''}이용 제한 안내${first ? ` (${first}${rs.length > 1 ? ` 외 ${rs.length - 1}건` : ''})` : ''}`.replace(/\s+/g, ' ');
  const reason = (st.reason ?? '').trim();
  const note = (st.note ?? '').trim();
  const closing = (CLOSINGS[st.closing] ?? CLOSINGS.formal).zone;
  const sign = (st.sign ?? '').trim() || wall;
  const signLine = st.closing === 'formal' ? `- ${sign} 드림 -` : `- ${sign} -`;
  const lines = [
    `· 제한 구역 : ${zones.join(', ') || '(구역을 골라 주세요)'}`,
    ...rs.map((r) => `· 일시 : ${rangeText(r)} ${when}`),
    ...(reason ? [`· 사유 : ${reason}`] : []),
    ...(rest.length && zones.length ? [`· 이용 가능 : 그 외 구역(${rest.join(', ')})은 정상 운영합니다.`] : []),
  ];
  const bodyLines = [`■ ${title}`, ...lines, ...(note ? ['', note] : []), '', ...closing, signLine];
  const hash = (s) => `#${s.replace(/[\s·]/g, '')}`;
  const caption = [title, '', ...lines, ...(note ? ['', note] : []), '', ...closing, '', [hash(wall), '#해벽', '#클라이밍', '#실외암벽', hash(KINDS.zone.tag)].join(' ')].join('\n');
  const rows = rs.map((r) => { const text = `${rangeText(r)} ${when}`; return { ...r, reason: '', text, line: text }; });
  // 카드 머리띠에는 구역이 2곳까지만 들어간다. 더 많으면 첫 줄에 전부 적어 이미지만 봐도 알 수 있게 한다.
  if (zones.length > 2) rows.unshift({ from: rs[0]?.from, to: rs[0]?.from, reason: '', text: zones.join(' · '), line: zones.join(' · ') });
  return {
    ok: dates.length > 0 && zones.length > 0 && timeOk(st), kind: 'zone', wall, month: null, color: null, rows, title, head: KINDS.zone.head,
    badge: reason || '구역 제한', panelHead: zoneName || '구역을 골라 주세요', note, closing, sign, body: bodyLines.join('\n'), caption,
    patch: dates.length && zones.length ? { wall, kind: 'zone', zone_limits: [{ zones, dates, from: st.timed ? st.open : undefined, to: st.timed ? st.close : undefined, reason: reason || undefined }] } : null,
  };
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const lines = (s) => String(s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

/** buildInfo(state) — 안내문: 안전 수칙(줄마다 한 수칙), 분실물(물품·장소·보관), 이용·민원 안내(제목+내용). 내용은 관리자가 직접 쓴다. */
function buildInfo(st) {
  const wall = (st.wall ?? '').trim() || '암벽장';
  const type = INFO_TYPES[st.infoType] ? st.infoType : 'safety';
  const t = (st.infoTitle ?? '').trim();
  const contact = (st.contact ?? '').trim();
  const note = (st.note ?? '').trim();
  const closing = (CLOSINGS[st.closing] ?? CLOSINGS.formal).info[type];
  const sign = (st.sign ?? '').trim() || wall;
  const signLine = st.closing === 'formal' ? `- ${sign} 드림 -` : `- ${sign} -`;
  const field = (label, v) => (v && String(v).trim() ? [`· ${label} : ${String(v).trim()}`] : []);
  let title, rows, badge, panelHead, ok;
  if (type === 'lost') {
    title = `${wall} 분실물(습득물) 안내`;
    const item = (st.item ?? '').trim();
    rows = [
      ...field('물품', item), ...field('발견 장소', st.where),
      ...(st.whenDate ? field('발견 일시', fmtDate(st.whenDate)) : []),
      ...field('보관 장소', st.keep), ...(st.keepUntil ? field('보관 기간', `${fmtDate(st.keepUntil)}까지`) : []), ...field('문의', contact),
    ];
    badge = '습득물'; panelHead = clip(item || '습득물', 22); ok = Boolean(item);
  } else if (type === 'safety') {
    title = t || `${wall} 안전 수칙 안내`;
    const rules = lines(st.infoBody);
    rows = rules.map((r, i) => `${i + 1}. ${r}`);
    badge = '안전'; panelHead = clip(t || '안전 수칙', 22); ok = rules.length > 0;
  } else {
    title = t || `${wall} 이용 안내`;
    rows = [...lines(st.infoBody), ...field('문의', contact)];
    badge = '안내'; panelHead = clip(t || '이용 안내', 22); ok = lines(st.infoBody).length > 0;
  }
  const body = [`■ ${title}`, ...rows, ...(note ? ['', note] : []), '', ...closing, signLine].join('\n');
  const hash = (s) => `#${s.replace(/[\s·]/g, '')}`;
  const caption = [title, '', ...rows, ...(note ? ['', note] : []), '', ...closing, '', [hash(wall), '#해벽', '#클라이밍', '#실외암벽', hash(KINDS.info.tag)].join(' ')].join('\n');
  const cardRows = rows.map((r) => { const text = r.replace(/^· /, ''); return { from: '', to: '', reason: '', text, line: text }; });
  return { ok, kind: 'info', wall, month: null, color: null, rows: cardRows, title, head: type === 'lost' ? '분실물안내' : type === 'safety' ? '안전수칙' : KINDS.info.head, badge, panelHead, note, closing, sign, body, caption, patch: null };
}
