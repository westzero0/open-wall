// src/sched-tab-view.js — 일정 탭 (docs/superpowers/specs/2026-11-06-schedule-tab-flow-design.md 0-2c·4·5-2): 헤더 `일정` + 달력 ⇄ 목록 토글,
// 달력(기록 탭의 .cal-* 모양, 일정 있는 날은 .cal-plan 점, 고른 날 아래에 그날 카드와 `이 날 외벽 보기`), 목록(다녀온 일정 → 다음 일정 → + 일정 추가),
// 일정 0개면 첫 화면(이번 주말 질문 · 토/일 · 장소 후보). 맨 아래는 index.html의 `매주 운동` 구획(.sched-week, #sched·#schedAsk가 든 노드)을 그대로 옮겨 붙인다.
// 그리기만 한다: 보기·달·고른 날은 app.js가 들고 콜백으로 바꾼다. 저장·요청은 모른다. 카드는 trip-view의 tripCard(날씨 상세·플랜B 없음, 배지와 홈에서 보기).
//   renderSchedTab(host, { trips, backs, today, view, month, selected, model, picks?, icon?, onToggle, onMonth, onSelect, onAdd, onOpenHome, onMove, onDelete, onWallsOfDay })
//   model(trip) → tripCard 모델 | null (null = 장소가 사라진 일정: 그리지 않고 점도 찍지 않는다).
import { el } from './dom.js';
import { goRow } from './card-parts.js';
import { monthGrid, dayParts } from './log.js';
import { tripState, tripsOnDate } from './trips.js';
import { weekendDays } from './pick.js';
import { ymd } from './time.js';
import { tripCard, foldLine } from './trip-view.js';

const md = (date) => { const p = dayParts(date); return `${p.dow} ${p.month}/${p.day}`; }; // '토 11/14'

export function renderSchedTab(host, o) {
  const { trips = [], backs = [], today, view, month, selected, model, icon } = o;
  const a = document.activeElement;
  const key = a && host.contains?.(a) ? a.dataset?.focus : null; // the redraw replaces the focused button: focus its new copy
  const week = host.querySelector('.sched-week');
  const backIds = new Set(backs.map((t) => t.id));
  const withModel = (list) => list.map((t) => ({ t, m: model(t) })).filter((x) => x.m);
  const backList = withModel(backs);
  const next = withModel(trips.filter((t) => !backIds.has(t.id) && ['plan', 'day'].includes(tripState(t, today, false))));
  const items = [...backList, ...next];
  const zero = !items.length;

  const btn = (label, cls, f, focus = null) => {
    const b = el('button', { type: 'button', class: cls, 'data-focus': focus }, label);
    b.addEventListener('click', (e) => f(e.currentTarget));
    return b;
  };
  const add = (preset, label = '+ 일정 추가', main = true) => btn(label, `trip-btn${main ? ' main' : ''} sched-add`, (b) => o.onAdd?.(preset, b), 'sched-add');
  // 계획 중인 일정만 옮기기·삭제; 당일·다녀옴은 홈이 맡으므로 홈에서 보기만 (0-2c). 홈에서 보기는 가장 가까운 일정(홈 맨 위에 있는 것)만 채운 모양
  const card = ({ t, m }) => tripCard(m, { icon, onHome: o.onOpenHome, homeMain: t === next[0]?.t, ...(tripState(t, today, false) === 'plan' && !backIds.has(t.id) ? { onMove: o.onMove, onDelete: o.onDelete } : {}) });

  const toList = view !== 'list'; // the toggle shows where it goes: 목록 그림 on the calendar, 달력 그림 on the list
  const tg = el('button', { type: 'button', class: 'sched-tg', 'aria-label': toList ? '목록으로 보기' : '달력으로 보기', 'data-focus': 'sched-tg' }, // a word next to the icon: an icon alone is a guess
    icon ? icon(toList ? 'list' : 'calendar') : null, el('span', { 'aria-hidden': 'true' }, toList ? '목록' : '달력'));
  tg.addEventListener('click', () => o.onToggle?.(toList ? 'list' : 'cal'));
  const header = el('div', { class: 'sched-hd' }, el('h2', { class: 'sched-title' }, '일정'), zero ? null : tg); // 일정 0개: 바꿔 볼 것이 없다

  let body;
  if (zero) {
    const [y, m, d] = today.split('-').map(Number);
    const sat = weekendDays(new Date(y, m - 1, d)).map((w) => ymd(w.date));
    body = [el('section', { class: 'sched-sec sched-first' },
      el('h3', { class: 'sched-h sched-q' }, '이번 주말, 어디 가세요?'),
      el('div', { class: 'trip-acts' }, ...sat.map((date) => btn(md(date), 'trip-btn', (b) => o.onAdd?.({ date }, b)))),
      ...(o.picks ?? []).map((p) => foldLine({ id: p.id, title: p.name, dateText: p.kind, wx: p.wx ?? null }, (_, b) => o.onAdd?.({ placeId: p.id }, b), { icon })),
      add({}, '다른 장소 찾기', false))]; // 첫 화면: 주말 칩과 후보가 먼저, 찾기는 옅은 칸
  } else if (view === 'list') {
    const sec = (title, count, list, ...extra) => el('section', { class: 'sched-sec' },
      el('h3', { class: 'sched-h' }, title, ' ', el('span', { class: 'sched-n' }, count)), ...list.map(card), ...extra);
    body = [
      ...(backList.length ? [sec('다녀온 일정', `기록 대기 ${backList.length}건`, backList)] : []),
      sec('다음 일정', `${next.length}건`, next, ...(next.length ? [] : [el('p', { class: 'sh-hint' }, '다음 일정이 없어요')]), add({})),
    ];
  } else {
    body = [calendar(o, items), selected
      ? el('section', { class: 'sched-day', 'aria-label': `${md(selected)} 일정` }, ...onDay(items, selected).map(card),
        goRow('시간표', ['이 날 외벽 보기'], 'walls', (e) => o.onWallsOfDay?.(selected, e.currentTarget)))
      : el('p', { class: 'sh-hint sched-hint' }, '날짜를 누르면 그날 일정이 아래에 열려요'),
    add(selected ? { date: selected } : {})];
  }
  const wh = week?.querySelector('.sched-h'); // 일정 0개: 주말 질문과 같은 무게의 평일 질문으로
  if (wh) { wh.setAttribute('class', zero ? 'sched-h sched-q' : 'sched-h'); wh.textContent = zero ? '평일엔 어디서 운동하세요?' : '매주 운동'; }
  for (const n of [...host.children]) if (n !== week) n.remove(); // the 매주 운동 section stays put: moving it would drop the focus inside #sched
  if (week) week.before(header, ...body); else host.append(header, ...body);
  if (key) (host.querySelector(`[data-focus="${key}"]`) ?? (key.startsWith('trip-') ? host.querySelector('[data-focus="sched-add"]') : null))?.focus(); // a deleted card's button: the add button
}

const onDay = (items, date) => { const ids = new Set(tripsOnDate(items.map((x) => x.t), date).map((t) => t.id)); return items.filter((x) => ids.has(x.t.id)); };

// month grid: buttons in a role=grid table, one tab stop (the picked day, else today, else the 1st); arrows move it inside the month.
function calendar(o, items) {
  const { today, month, selected } = o;
  const grid = monthGrid(month.year, month.month);
  const days = grid.weeks.flat().filter(Boolean).map((c) => c.date);
  const stop = [selected, today].find((d) => days.includes(d)) ?? days[0];
  const cell = (c) => {
    if (!c) return el('td', { role: 'gridcell', class: 'cal-pad' });
    const p = dayParts(c.date);
    const here = onDay(items, c.date);
    const b = el('button', {
      type: 'button', class: 'cal-day', 'data-date': c.date, 'data-focus': `day-${c.date}`, tabindex: c.date === stop ? '0' : '-1',
      'aria-label': `${p.month}월 ${p.day}일 ${p.dow}요일${c.date === today ? ', 오늘' : ''}, ${here.length ? `일정 ${here.map((x) => x.m.title).join(', ')}` : '일정 없음'}`,
      'aria-current': c.date === today ? 'date' : null,
    }, el('span', { class: 'cal-n', 'aria-hidden': 'true' }, String(c.day)), here.length ? el('span', { class: 'cal-plan', 'aria-hidden': 'true' }) : null);
    b.addEventListener('click', () => o.onSelect?.(c.date));
    return el('td', { role: 'gridcell', 'aria-selected': String(c.date === selected) }, b);
  };
  const table = el('table', { class: 'cal-grid', role: 'grid', 'aria-labelledby': 'sched-cal-t' },
    el('thead', {}, el('tr', {}, ...['일', '월', '화', '수', '목', '금', '토'].map((d) => el('th', { scope: 'col', abbr: `${d}요일` }, d)))),
    el('tbody', {}, ...grid.weeks.map((w) => el('tr', {}, ...w.map(cell)))));
  table.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    const b = e.target.closest?.('.cal-day');
    if (!b || !step) return;
    const all = [...table.querySelectorAll('.cal-day')];
    const to = all[all.indexOf(b) + step];
    if (!to) return; // ponytail: arrows stop at the month's edge; ‹ › change the month (the 기록 달력 crosses months, add it here if asked)
    e.preventDefault();
    b.tabIndex = -1;
    to.tabIndex = 0;
    to.focus();
  });
  const nav = (label, text, by, focus) => {
    const b = el('button', { type: 'button', class: 'cal-nav', 'aria-label': label, 'data-focus': focus }, text);
    b.addEventListener('click', () => o.onMonth?.(by));
    return b;
  };
  return el('section', { class: 'cal sched-cal', 'aria-label': '일정 달력' },
    el('div', { class: 'cal-head' }, nav('이전 달', '‹', -1, 'sched-prev'), el('h3', { id: 'sched-cal-t' }, grid.label), nav('다음 달', '›', 1, 'sched-next')),
    table);
}
