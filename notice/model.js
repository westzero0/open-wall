// notice/model.js — 외벽 관리자 공지 도구의 순수 로직(DOM 없음): 날짜 → 제목·본문·인스타 캡션·해벽 반영 패치.
// 이미지(card.js)와 글(여기)이 같은 notice 객체에서 나오므로, 날짜나 사유를 바꾸면 둘이 함께 바뀐다.
import { holidayName } from '../src/holidays.js';
import { DAY_KO } from '../src/time.js';

export const KINDS = {
  today: { label: '오늘 상태·마감', head: '이용안내', tag: '이용안내' },
  holiday: { label: '월별 공휴일 휴관', head: '휴관안내', tag: '휴관안내' },
  temp: { label: '임시휴무', head: '임시휴무', tag: '임시휴무' },
  hours: { label: '운영시간 변경·단축운영', head: '운영시간 변경', tag: '운영시간변경' },
};

// 맺음말 문체: 공단·공공시설은 격식체, 민간은 부드러운 말투. 은평인공암벽장 공지를 본뜬 formal 이 기본.
export const CLOSINGS = {
  formal: {
    label: '격식체',
    holiday: ['해당일에는 암벽장 이용이 불가하오니, 착오 없으시길 바랍니다.', '앞으로도 안전하고 쾌적한 시설 운영을 위해 최선을 다하겠습니다.', '감사합니다.'],
    temp: ['해당일에는 암벽장 이용이 불가하오니, 착오 없으시길 바랍니다.', '이용에 불편을 드려 죄송합니다.', '감사합니다.'],
    hours: ['해당일에는 변경된 시간에 맞춰 이용해 주시기 바랍니다.', '이용에 불편을 드려 죄송합니다.', '감사합니다.'],
    today: ['상황이 바뀌면 다시 안내드리겠습니다.', '이용에 불편을 드려 죄송합니다.', '감사합니다.'],
  },
  friendly: {
    label: '부드러운 말투',
    holiday: ['이날은 쉬어가요! 방문 전에 꼭 확인해 주세요 :)', '더 좋은 모습으로 만나요.'],
    temp: ['이날은 문을 닫아요. 헛걸음하지 않도록 미리 알려드려요.', '불편을 드려 죄송해요!'],
    hours: ['이날은 운영시간이 달라요. 방문 전에 꼭 확인해 주세요 :)', '불편을 드려 죄송해요!'],
    today: ['상황이 바뀌면 바로 다시 알려드릴게요.', '헛걸음 없으시길 바라요!'],
  },
};

// 오늘 상태: 한 번 누르면 공지가 완성된다. tone 은 카드 색(초록=정상, 주황=조심, 빨강=이용 불가·마감), alt 는 대체 외벽을 같이 안내할지.
export const STATUSES = {
  open: { label: '정상 운영', badge: '정상', tone: '#2e9e5b', line: '현재 정상 운영 중입니다.', alt: false },
  caution: { label: '일부 구역 이용 제한', badge: '일부 제한', tone: '#d98a00', line: '일부 구역은 현재 이용이 제한됩니다.', alt: true },
  rain: { label: '우천으로 이용 불가', badge: '우천', tone: '#d98a00', line: '우천으로 벽면이 젖어 현재 이용이 어렵습니다.', alt: true },
  wind: { label: '강풍으로 이용 불가', badge: '강풍', tone: '#d98a00', line: '강풍으로 안전을 위해 현재 이용을 제한합니다.', alt: true },
  full: { label: '정원 초과 · 오늘 마감', badge: '오늘 마감', tone: '#c0392b', line: '현장 정원이 차서 오늘 이용이 마감되었습니다.', alt: true },
};

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
  const alts = status.alt ? (st.alts ?? []) : [];
  const note = (st.note ?? '').trim();
  const closing = (CLOSINGS[st.closing] ?? CLOSINGS.formal).today;
  const sign = (st.sign ?? '').trim() || wall;
  const signLine = st.closing === 'formal' ? `- ${sign} 드림 -` : `- ${sign} -`;
  const title = `${wall} ${day} ${status.label === '정상 운영' ? '정상 운영 안내' : `${status.badge === '오늘 마감' ? '오늘 마감' : status.label} 안내`}`.replace(/\s+/g, ' ');
  const altBlock = alts.length ? ['', '가까운 다른 외벽', ...alts.map((a) => `· ${altLine(a)}`)] : [];
  const bodyLines = [`■ ${title}`, stamp, '', status.line, ...(note ? [note] : []), ...altBlock, '', ...closing, signLine];
  const hash = (s) => `#${s.replace(/[\s·]/g, '')}`;
  const caption = [title, stamp, '', status.line, ...(note ? [note] : []), ...altBlock, '', ...closing, '', [hash(wall), '#해벽', '#클라이밍', '#실외암벽', hash(KINDS.today.tag)].join(' ')].join('\n');
  const rows = [{ from: st.date, to: st.date, reason: '', text: status.label, line: status.label },
    ...(note ? [{ from: st.date, to: st.date, reason: '', text: note, line: note }] : []),
    ...alts.map((a) => ({ from: st.date, to: st.date, reason: '', text: `인근 ${altLine(a)}`, line: `인근 ${altLine(a)}` }))];
  return {
    ok: Boolean(st.status), kind: 'today', wall, month: null, color: status.tone, rows, title, head: KINDS.today.head, badge: status.badge,
    panelHead: stamp || '오늘', note, closing, sign, body: bodyLines.join('\n'), caption,
    patch: st.date ? { wall, kind: 'today', status: st.status, at: `${st.date}T${st.at ?? '00:00'}`, expires: `${st.date}T23:59`, note: note || undefined, alternatives: alts.map((a) => a.name) } : null,
  };
}
