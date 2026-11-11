// 일정 목록 → 주말 묶음 타임라인. DOM 없음, 날짜는 'YYYY-MM-DD' 문자열, 계산은 로컬 달력(Date(y, m-1, d+o)).
import { ymd } from './time.js';
import { comingWeekend } from './trips.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const parts = (s) => s.split('-').map(Number);
const toDate = (s) => { const [y, m, d] = parts(s); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const [y, m, d] = parts(s); return ymd(new Date(y, m - 1, d + n)); };
const validDate = (s) => typeof s === 'string' && DATE_RE.test(s) && ymd(toDate(s)) === s;
const usable = (p) => !!p && typeof p === 'object' && validDate(p.date);
const hasMin = (p) => Number.isInteger(p.min);

// 같은 날은 min 순(null 뒤), 입력 순서 유지(안정 정렬).
const byTime = (a, b) => (hasMin(a) ? a.min : 1e9) - (hasMin(b) ? b.min : 1e9);

export function needsRecord(plan, today, nowMin = null) {
  if (!usable(plan) || plan.status !== '예정') return false;
  if (plan.date < today) return true;
  return plan.date === today && hasMin(plan) && Number.isInteger(nowMin) && nowMin >= plan.min + 120;
}

const mdText = (s) => { const [, m, d] = parts(s); return `${m}/${d}`; };
const rangeText = (sat) => {
  const sun = addDays(sat, 1);
  return parts(sat)[1] === parts(sun)[1] ? `${mdText(sat)}–${parts(sun)[2]}` : `${mdText(sat)}–${mdText(sun)}`;
};

export function buildTimeline(plans, today, nowMin = null) {
  const list = (Array.isArray(plans) ? plans : []).filter(usable).sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
  // record: 날짜 최근 우선, 같은 날은 늦은 시각 먼저
  const record = list.filter((p) => needsRecord(p, today, nowMin)).reverse();
  const todayPlans = list.filter((p) => p.date === today);
  const thisSat = comingWeekend(today).sat;
  const nextSat = addDays(thisSat, 7);

  const byDate = (arr) => {
    const m = new Map();
    for (const p of arr) m.set(p.date, [...(m.get(p.date) || []), p]);
    return [...m].map(([date, ps]) => ({ date, isToday: date === today, plans: ps }));
  };

  const sunday = toDate(today).getDay() === 0; // 일요일엔 이번 주말이 오늘뿐이라 다가오는 토·일이 '다음 주말'
  const weekendLabel = (sat) =>
    sat === thisSat ? (sunday ? '다음 주말' : `이번 주말 ${rangeText(sat)}`) : sat === nextSat && !sunday ? '다음 주말' : `${rangeText(sat)} 주말`;
  // 날짜순 한 번에: 주말은 토요일 기준 묶음, 평일은 주말 묶음 사이의 연속 구간마다 하나.
  const groups = [];
  const satOf = new Map();
  for (const p of list.filter((x) => x.date > today)) {
    const dow = toDate(p.date).getDay();
    const last = groups[groups.length - 1];
    if (dow === 6 || dow === 0) {
      const sat = dow === 6 ? p.date : addDays(p.date, -1);
      if (last && last.kind === 'weekend' && satOf.get(last) === sat) last.plans.push(p);
      else { const g = { kind: 'weekend', label: weekendLabel(sat), plans: [p] }; satOf.set(g, sat); groups.push(g); }
    } else if (last && last.kind === 'weekday') last.plans.push(p);
    else groups.push({ kind: 'weekday', label: '평일', plans: [p] });
  }
  for (const g of groups) { g.days = byDate(g.plans); delete g.plans; }

  const past = byDate(list.filter((p) => p.date < today)).reverse(); // 날짜 최근 우선, 하루 안은 시각 순
  if (past.length) groups.push({ kind: 'past', label: '지난 일정', days: past });

  return { record, today: { date: today, plans: todayPlans }, groups };
}
