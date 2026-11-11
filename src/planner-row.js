// src/planner-row.js — one home row (a button that opens the plan's detail).
// Words come from plan-view.js. The detail screen itself is planner-detail.js. No fetch, no storage here.
import { html } from './planner-ui.js';
import { dayParts, hourFor, rowWeatherCell } from './plan-view.js';
import { Icon, DisciplineIcon } from './planner-icons.js';

/** A list row: date + weekday on one line, discipline symbol, place, weather, ›. props: plan, v (rowView), onOpen(id), s, now */
export function Row({ plan, v, onOpen, s, now }) {
  const p = dayParts(plan.date);
  const rc = v.live && !v.rest ? rowWeatherCell(hourFor(v.resolved, plan, s.wx, { now })) : null;
  const cls = ['d', v.past && 'past', v.rest && 'rest'].filter(Boolean).join(' ');
  const showPhrase = v.level !== 'ok' || !rc;
  return html`
    <h3 class="rh"><button type="button" class=${cls} data-row=${plan.id} aria-label=${v.aria} onClick=${() => onOpen(plan.id)}>
      <span class="in">
        <span class="rn n" aria-hidden="true">${p.d}<small>${p.dow}</small></span>
        <${DisciplineIcon} kind=${v.symbol} cls="sy" />
        <span class="b">
          <span class="t">${v.title}${' '}${v.time && html`<span class="tm n">${v.time}</span>`}</span>
          ${showPhrase && html`<span class=${'wx n ' + (v.level === 'caution' || v.level === 'hard' ? v.level : '')}>${v.phrase}</span>`}
        </span>
        ${rc && html`<span class=${'rw n' + (rc.warn ? ' warn' : '')}><${Icon} name=${rc.icon} />${rc.text}</span>`}
        <span class="ch" aria-hidden="true">›</span>
      </span>
    </button></h3>`;
}
