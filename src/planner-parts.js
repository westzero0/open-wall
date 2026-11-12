// src/planner-parts.js — the planner's small shared parts (tab bar, link button, chip, field, button row, icon button). Preact only: no fetch, no storage.
// Shapes come from planner.css `/* 부품 */` (tokens only). New screens use these instead of one-off markup.
import { html } from './planner-ui.js';
import { Icon } from './planner-icons.js';

/** Bottom tabs: 일정 / 달력. current: 'home' | 'calendar'. */
export function TabBar({ current }) {
  const tab = (key, href, label) => html`<a key=${key} href=${href} aria-current=${current === key ? 'page' : null}>${label}</a>`;
  return html`<nav class="p-tabs" aria-label="화면">${tab('home', '#/', '일정')}${tab('calendar', '#/calendar', '달력')}</nav>`;
}

/** A text link (href) or a text button (onClick). external → new tab with noopener. */
export function LinkButton({ href, onClick, external = false, children, ...rest }) {
  if (href) return html`<a class="p-link" href=${href} target=${external ? '_blank' : null} rel=${external ? 'noopener noreferrer' : null} ...${rest}>${children}</a>`;
  return html`<button type="button" class="p-link" onClick=${onClick} ...${rest}>${children}</button>`;
}

export const Chip = ({ pressed, onClick, children }) => html`<button type="button" class="p-chip" aria-pressed=${pressed ? 'true' : 'false'} onClick=${onClick}>${children}</button>`;

export const Field = ({ id, label, children }) => html`<div class="p-field"><label for=${id}>${label}</label>${children}</div>`;

export const ButtonRow = ({ children }) => html`<div class="p-row">${children}</div>`;

export const IconButton = ({ name, label, onClick, ...rest }) => html`<button type="button" class="p-ic" aria-label=${label} onClick=${onClick} ...${rest}><${Icon} name=${name} /></button>`;
