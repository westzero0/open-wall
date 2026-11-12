// src/planner-calendar.js — 달력 tab: one month grid (Monday first), a day picked below it shows that day's plans (same Row as home).
// Words/flags come from plan-view.js (monthGrid, dayFullText, rowView). Opening a plan goes to its address; no fetch, no storage here.
import { html, useState, usePlannerState } from './planner-ui.js';
import { monthGrid, filterByDay, dayFullText, rowView } from './plan-view.js';
import { Row } from './planner-row.js';
import { ButtonRow, IconButton } from './planner-parts.js';

const HEAD = ['월', '화', '수', '목', '금', '토', '일'];
const byTime = (a, b) => (Number.isInteger(a.min) ? a.min : 1e9) - (Number.isInteger(b.min) ? b.min : 1e9);
const summary = (m) => [m.planned && `예정 ${m.planned}`, m.went && `다녀옴 ${m.went}`, m.missed && `못 감 ${m.missed}`, m.rest && `쉼 ${m.rest}`].filter(Boolean).join(', ');

export function Calendar({ store, handlers: h }) {
  const s = usePlannerState(store);
  const [ym, setYm] = useState(() => { const [y, m] = s.today.split('-').map(Number); return { y, m }; });
  const [picked, setPicked] = useState(null); // null = today
  if (s.base.screen !== 'calendar') return null;
  const day = picked ?? s.today;
  const [ty, tm] = s.today.split('-').map(Number);
  const grid = monthGrid(s.db.plans, ym.y, ym.m, s.today);
  const move = (d) => setYm(({ y, m }) => { const n = new Date(y, m - 1 + d, 1); return { y: n.getFullYear(), m: n.getMonth() + 1 }; });
  const now = Date.now();
  const list = filterByDay(s.db.plans, day).sort(byTime);
  const add = (text) => html`<button type="button" class="btn p" onClick=${() => h.onAdd({ date: day })}>${text}</button>`;
  return html`<section class="calv" aria-label="달력">
    <div class="cal-h">
      <${IconButton} name="prev" label="이전 달" onClick=${() => move(-1)} />
      <h2 aria-live="polite">${ym.y}년 ${ym.m}월</h2>
      <${IconButton} name="next" label="다음 달" onClick=${() => move(1)} />
      ${(ym.y !== ty || ym.m !== tm) && html`<button type="button" class="txt" onClick=${() => { setYm({ y: ty, m: tm }); setPicked(null); }}>오늘</button>`}
    </div>
    <table class="cal"><thead><tr>${HEAD.map((d) => html`<th key=${d} scope="col">${d}</th>`)}</tr></thead>
      <tbody>${grid.map((wk) => html`<tr key=${wk[0].date}>${wk.map((c) => html`<td key=${c.date}>
        <button type="button" class=${'cd' + (c.inMonth ? '' : ' out') + (c.today ? ' t' : '') + (c.past ? ' past' : '')} aria-pressed=${day === c.date ? 'true' : 'false'}
          aria-label=${[dayFullText(c.date), c.today && '오늘', summary(c.marks)].filter(Boolean).join(', ')} onClick=${() => { setPicked(c.date); setTimeout(() => document.querySelector('.cal-day h3')?.scrollIntoView?.({ block: 'nearest' }), 0); }}>
          <span class="dn n">${c.d}</span>
          <span class="mk" aria-hidden="true">${c.marks.planned > 0 && html`<i class="m-plan"></i>`}${c.marks.went > 0 && html`<i class="m-went"></i>`}${(c.marks.missed + c.marks.rest) > 0 && html`<i class="m-skip"></i>`}${c.count > 1 && html`<u>${c.count}</u>`}</span>
        </button></td>`)}</tr>`)}</tbody></table>
    <section class="cal-day" aria-live="polite" aria-label=${dayFullText(day)}>
      <h3>${dayFullText(day)}</h3>
      ${list.length
        ? html`<ul class="rows">${list.map((p) => html`<li key=${p.id}><${Row} plan=${p} v=${rowView(p, { s, now })} onOpen=${(id) => h.go({ screen: 'plan', id })} s=${s} now=${now} /></li>`)}</ul>`
        : !s.db.plans.length ? html`<p>일정이 아직 없어요</p><${ButtonRow}>${add('이 날 일정 만들기')}<//>`
        : day >= s.today ? html`<${ButtonRow}>${add('이 날 일정 만들기')}<//>` : html`<p>기록이 없어요</p>`}
    </section>
  </section>`;
}
