// src/planner-calendar.js — 달력 tab: one month grid (Monday first), a day picked below it shows that day's plans (same Row as home).
// Words/flags come from plan-view.js (monthGrid, dayFullText, rowView). Opening a plan goes to its address; no fetch, no storage here.
import { html, useState, usePlannerState } from './planner-ui.js';
import { monthGrid, filterByDay, dayFullText, rowView, shortPlaceName, MARK_OF } from './plan-view.js';
import { Row } from './planner-row.js';
import { IconButton } from './planner-parts.js';

const HEAD = ['월', '화', '수', '목', '금', '토', '일'];
const byTime = (a, b) => (Number.isInteger(a.min) ? a.min : 1e9) - (Number.isInteger(b.min) ? b.min : 1e9);
const summary = (m) => [m.planned && `예정 ${m.planned}`, m.hard && '어려움', m.went && `다녀옴 ${m.went}`, m.missed && `못 감 ${m.missed}`, m.rest && `쉼 ${m.rest}`].filter(Boolean).join(', '); // 쉼·못 감은 말로만(표시 점 없음)

export function Calendar({ store, handlers: h }) {
  const s = usePlannerState(store);
  const [ym, setYm] = useState(() => { const [y, m] = s.today.split('-').map(Number); return { y, m }; });
  const [picked, setPicked] = useState(null); // null = today
  if (s.base.screen !== 'calendar') return null;
  const day = picked ?? s.today;
  const [ty, tm] = s.today.split('-').map(Number);
  const now = Date.now();
  const grid = monthGrid(s.db.plans, ym.y, ym.m, s.today, (p) => { const v = rowView(p, { s, now }); return v.live && v.risk.level === 'hard'; });
  const first = new Map(); // 날짜별 첫 일정(시간순)
  for (const p of [...s.db.plans].sort(byTime)) if (MARK_OF[p?.status] && typeof p.date === 'string' && !first.has(p.date)) first.set(p.date, p);
  const move = (d) => setYm(({ y, m }) => { const n = new Date(y, m - 1 + d, 1); return { y: n.getFullYear(), m: n.getMonth() + 1 }; });
  const list = filterByDay(s.db.plans, day).sort(byTime);
  const dt = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  const dcol = html`<span class="ce-d n" aria-hidden="true">${dt.getDate()}<small>${HEAD[(dt.getDay() + 6) % 7]}</small></span>`;
  // 일정 없는 날: 목록 줄 모양(날짜 열 + 문구 + 밑줄 글자). 지난 날은 행동 없이 문구만
  const emptyRow = (msg, act) => act
    ? html`<button type="button" class="ce" onClick=${() => h.onAdd({ date: day })}>${dcol}<span class="ce-t"><b>${msg}</b><em>일정 추가</em></span><span class="ce-p" aria-hidden="true">+</span></button>`
    : html`<div class="ce">${dcol}<span class="ce-t"><b>${msg}</b></span></div>`;
  return html`<section class="calv" aria-label="달력">
    <div class="cal-h">
      <${IconButton} name="prev" label="이전 달" onClick=${() => move(-1)} />
      <h2 aria-live="polite">${ym.y}년 ${ym.m}월</h2>
      <${IconButton} name="next" label="다음 달" onClick=${() => move(1)} />
      ${(ym.y !== ty || ym.m !== tm) && html`<button type="button" class="txt" onClick=${() => { setYm({ y: ty, m: tm }); setPicked(null); }}>오늘</button>`}
    </div>
    <table class="cal"><thead><tr>${HEAD.map((d) => html`<th key=${d} scope="col">${d}</th>`)}</tr></thead>
      <tbody>${grid.map((wk) => html`<tr key=${wk[0].date}>${wk.map((c) => { const fp = first.get(c.date); const full = fp ? rowView(fp, { s, now }).name : ''; return html`<td key=${c.date}>
        <button type="button" class=${'cd' + (c.inMonth ? '' : ' out') + (c.today ? ' t' : '') + (c.past ? ' past' : '')} aria-pressed=${day === c.date ? 'true' : 'false'}
          aria-label=${[dayFullText(c.date), c.today && '오늘', full, summary(c.marks)].filter(Boolean).join(', ')} onClick=${() => { setPicked(c.date); setTimeout(() => document.querySelector('.cal-day h3')?.scrollIntoView?.({ block: 'nearest' }), 0); }}>
          <span class="dn n">${c.d}</span>
          ${fp && html`<span class=${'nm' + (fp.status === '쉼' || fp.status === '못 갔다' ? ' dim' : '')}>${shortPlaceName(full)}</span>`}
          <span class="mk" aria-hidden="true">${c.marks.planned > 0 && html`<i class=${c.marks.hard > 0 ? 'm-hard' : 'm-plan'}></i>`}${c.marks.went > 0 && html`<i class="m-went"></i>`}${c.count > 1 && html`<u>+${c.count - 1}</u>`}</span>
        </button></td>`; })}</tr>`)}</tbody></table>
    <section class="cal-day" aria-live="polite" aria-label=${dayFullText(day)}>
      <h3 class=${list.length ? '' : 'vh'}>${dayFullText(day)}</h3>
      ${list.length
        ? html`<ul class="rows">${list.map((p) => html`<li key=${p.id}><${Row} plan=${p} v=${rowView(p, { s, now })} onOpen=${(id) => h.go({ screen: 'plan', id })} s=${s} now=${now} /></li>`)}</ul>`
        : !s.db.plans.length ? emptyRow('일정이 아직 없어요', true)
        : day >= s.today ? emptyRow('비어 있어요', true) : emptyRow('기록이 없어요', false)}
    </section>
  </section>`;
}
