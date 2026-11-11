// src/planner-cells.js — the three icon cells (weather, wind, crowd) shared by the home hero and the detail screen. c = homeCells() of plan-view.js.
import { html } from './planner-ui.js';
import { Icon, Crowd } from './planner-icons.js';

function Cell({ cls = '', icon, value, label, hideValue }) {
  return html`<li class=${'cell n ' + cls}>${icon}<b aria-hidden=${hideValue ? 'true' : 'false'}>${value}</b><em>${label}</em></li>`;
}

export function Cells({ c }) {
  return html`<ul class="cells">
    <${Cell} cls=${(c.weather.warn ? 'warn ' : '') + (c.weather.dim ? 'dim' : '')} icon=${html`<${Icon} name=${c.weather.icon} />`} value=${c.weather.value} label=${c.weather.label} hideValue=${c.weather.dim} />
    <${Cell} cls=${c.wind.dim ? 'dim' : ''} icon=${html`<${Icon} name="wind" />`} value=${c.wind.value} label=${c.wind.label} hideValue=${c.wind.dim} />
    <${Cell} cls=${c.crowd.dim ? 'dim' : ''} icon=${html`<${Crowd} n=${c.crowd.n} />`} value=${c.crowd.value} label=${c.crowd.label} hideValue=${c.crowd.dim} />
  </ul>`;
}
