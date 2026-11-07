// src/trip-sheet.js — 일정 추가 시트 (docs/superpowers/specs/2026-11-06-schedule-tab-flow-design.md 5-1, 12-9): 달력의 날짜에서 와도, `일정 추가`·장소 후보에서 와도
// 같은 시트. 장소(이름 검색 + 후보 줄, 이 시트에만 날씨 칩 예외) → 날짜(토 · 일 · 토~일 · 직접 고르기: 하루 또는 범위) → 일정 저장.
// 기록 추가 시트(#log-add)의 조각을 그대로 쓴다: .la-field 검색 칸, .la-chip 날짜 칩, 아래에 붙는 .la-foot 저장 줄. 후보 줄은 trip-view의 접힌 줄 모양.
// 저장·요청은 모른다: onSave({ place, from, to })를 부르고 닫는다. 10건이 차 있으면(full) 고르기 대신 자리가 생기는 때만 알린다.
//   openTripSheet({ dialog, choices, today, preset: { placeId?, date?, to? }, forecastText?, forecastWx?, full?, icon?, opener?, onSave, onClose?, title? })  title: 기본 일정 추가(옮기기는 일정 옮기기)
import { el } from './dom.js';
import { dayParts, validDate } from './log.js';
import { MAX_TRIPS, comingWeekend } from './trips.js';
import { wxChip } from './trip-view.js';
import { lineRow } from './card-parts.js';

const SHOWN = 5; // 검색어가 없을 때 보이는 후보 수(choices 앞쪽 = 싱글피치 먼저)
const md = (date) => { const p = dayParts(date); return `${p.dow} ${p.month}/${p.day}`; }; // '토 11/14'
const span = (from, to) => (from === to ? md(from) : `${md(from)} ~ ${md(to)}`);

export function openTripSheet({ dialog, choices = [], today, preset = {}, forecastText = () => null, forecastWx = () => null, full = false, icon, opener = null, onSave, onClose, title: titleText = '일정 추가' }) {
  const close = el('button', { type: 'button', class: 'sh-close', 'data-close': '' }, '닫기');
  close.addEventListener('click', () => dialog.close());
  const title = el('h2', { id: 'tripadd-title', tabindex: '-1' }, titleText);
  const head = el('div', { class: 'sh-head' }, title);
  const show = () => { dialog.showModal(); title.focus?.(); }; // showModal would focus the search box and pop the phone keyboard open: start on the title
  dialog.addEventListener('close', () => {
    const key = opener?.dataset?.focus; // the opener may have been redrawn while the sheet was open: find its new copy
    (opener?.isConnected ? opener : key ? document.querySelector(`[data-focus="${key}"]`) : null)?.focus();
    onClose?.();
  }, { once: true });

  if (full) {
    dialog.replaceChildren(el('div', { class: 'tripadd-form' }, head,
      el('p', { class: 'sh-row tripadd-full', role: 'status' }, `일정은 ${MAX_TRIPS}개까지 잡을 수 있어요. 지난 일정이 지나면 자리가 생겨요.`), close));
    return show();
  }

  let place = choices.find((c) => c.id === preset.placeId) ?? null;
  let from = null;
  let to = null;
  const { sat, sun } = comingWeekend(today);

  // ---- 장소 ----
  const q = el('input', { type: 'search', name: 'q', placeholder: '암장·구역 이름으로 찾기', autocomplete: 'off' });
  const list = el('div', { class: 'tripadd-cands' });
  const rows = [];
  const mark = () => { for (const r of rows) { r.b.setAttribute('aria-pressed', String(r.c === place)); r.badge.hidden = r.c !== place; } };
  function drawCands() {
    const t = q.value.trim().toLowerCase();
    let shown = t ? choices.filter((c) => c.name.toLowerCase().includes(t)) : choices.slice(0, SHOWN);
    if (!t && place && !shown.includes(place)) shown = [place, ...shown.slice(0, SHOWN - 1)]; // the preset place is always in view
    const day = from ?? sat; // 날씨 칩·줄: 고른 첫날, 아직 없으면 이번 토요일
    rows.length = 0;
    list.replaceChildren(...(shown.length ? shown.map((c) => {
      const badge = el('span', { class: 'trip-badge mine' }, '선택');
      const b = lineRow({ lead: wxChip(forecastWx(c, day), null, icon, true), title: c.name, sub: [c.kind, forecastText(c, day)].filter(Boolean).join(' · '), end: badge, cls: 'tripadd-cand', data: { 'data-id': c.id } });
      b.addEventListener('click', () => { place = c; mark(); drawFoot(); });
      rows.push({ c, b, badge });
      return b;
    }) : [el('p', { class: 'sh-hint tripadd-none' }, '맞는 곳이 없어요. 이름 일부로 찾아보세요.')]),
    ...(!t && choices.length > shown.length ? [el('p', { class: 'sh-hint tripadd-more' }, `이름을 입력하면 더 찾아요 (${choices.length - shown.length}곳 더)`)] : []));
    mark();
  }
  q.addEventListener('input', drawCands);
  q.addEventListener('keydown', (e) => { // Enter never saves; with exactly one match it picks that place
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.isComposing && rows.length === 1) rows[0].b.click();
  });

  // ---- 날짜 ----
  const fromIn = el('input', { type: 'date', name: 'from', min: today });
  const toIn = el('input', { type: 'date', name: 'to', min: today });
  const custom = el('div', { class: 'tripadd-custom' },
    el('label', { class: 'la-field' }, el('span', { class: 'sh-label' }, '가는 날'), fromIn),
    el('label', { class: 'la-field' }, el('span', { class: 'sh-label' }, '마지막 날 (하루면 비워 두세요)'), toIn));
  custom.hidden = true;
  const pre = validDate(preset.date) && preset.date >= today ? preset.date : null; // a past day from the calendar is not a plan
  const preTo = pre && validDate(preset.to) && preset.to > pre ? preset.to : pre; // 일정 옮기기 of a range keeps the range
  const known = (f, t) => ((f === sat || f === sun) && t === f) || (f === sat && t === sun); // already one of the weekend chips
  const opts = [
    ...(pre && !known(pre, preTo) ? [{ label: span(pre, preTo), from: pre, to: preTo }] : []),
    { label: md(sat), from: sat, to: sat },
    { label: md(sun), from: sun, to: sun },
    { label: '토~일', from: sat, to: sun },
    { label: '직접 고르기', custom: true },
  ].filter((o) => o.custom || o.from >= today);
  const chips = opts.map((o) => {
    const b = el('button', { type: 'button', class: 'la-chip' }, o.label);
    b.addEventListener('click', () => {
      if (o.custom) { if (from) { fromIn.value = from; toIn.value = to === from ? '' : to; } }
      else { from = o.from; to = o.to; }
      pick(o);
      if (o.custom) fromIn.focus?.();
    });
    return { o, b };
  });
  function pick(o) {
    for (const c of chips) c.b.setAttribute('aria-pressed', String(c.o === o));
    custom.hidden = !o?.custom;
    toIn.setAttribute('min', from ?? today);
    drawCands();
    drawFoot();
  }
  const readCustom = () => {
    from = validDate(fromIn.value) && fromIn.value >= today ? fromIn.value : null;
    to = from && validDate(toIn.value) && toIn.value > from ? toIn.value : from; // 끝이 비었거나 앞이면 하루
    pick(chips.at(-1).o);
  };
  fromIn.addEventListener('input', readCustom);
  toIn.addEventListener('input', readCustom);

  // ---- 저장 ----
  const need = el('p', { class: 'sh-hint la-need', id: 'tripadd-need' });
  const save = el('button', { type: 'submit', class: 'la-save tripadd-save', 'aria-describedby': 'tripadd-need' }, '일정 저장');
  function drawFoot() {
    save.disabled = !(place && from);
    need.textContent = place && from ? `${place.name} · ${span(from, to)}` : !place && !from ? '장소와 날짜를 골라 주세요' : !place ? '장소를 골라 주세요' : '날짜를 골라 주세요';
  }
  const form = el('form', { class: 'tripadd-form', novalidate: '' }, head,
    el('fieldset', { class: 'sh-row' }, el('legend', {}, '장소'), el('label', { class: 'la-field' }, el('span', { class: 'sr-only' }, '장소 검색'), q), list),
    el('div', { class: 'sh-row tripadd-when', role: 'group', 'aria-labelledby': 'tripadd-when' }, el('p', { class: 'sh-label', id: 'tripadd-when' }, '날짜'),
      el('div', { class: 'la-chips tripadd-days' }, ...chips.map((c) => c.b)), custom),
    el('div', { class: 'la-foot' }, need, save), close);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (save.disabled) return;
    const trip = { place: { type: place.type, id: place.id }, from, to };
    dialog.close(); // close first: the focus goes back before onSave redraws the screen behind
    onSave?.(trip);
  });

  dialog.replaceChildren(form);
  const start = pre ? chips.find((c) => !c.o.custom && c.o.from === pre && c.o.to === preTo) : null;
  if (start) { from = pre; to = preTo; fromIn.value = from; toIn.value = to === from ? '' : to; pick(start.o); } else pick(null); // 직접 고르기 opens on the same days
  show();
}
