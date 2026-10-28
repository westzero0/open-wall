// src/schedule-view.js — 운동 스케줄 비 알림: the home card (a folded line; opened, the week as seven days and the picked day's other walls) and the
// 내 정보 sheet's rows (a wall and the weekdays it is trained on). DOM; the numbers come from schedule.js, the parts from the 이번 주말 추천 card.
import { el } from './dom.js';
import { DAY_KO } from './time.js';
import { NEAR_KM, addWall, alternatives, hintOf, nextDryDay, removeWall, toggleDay, MAX_SCHEDULE } from './schedule.js';

const sel = new Map(); // wall name → the picked day's time (ms; the strip moves with today, so an index would not hold); the first rainy 운동 요일 until a tap
let current = []; // the sheet rows' list as last drawn, for 되돌리기
let last = null; // the card's arguments, to draw it again after a tap
let say = ''; // what the picked day says, for the status line a screen reader hears after a tap

const dayLong = (d, i) => (i === 0 ? `${DAY_KO[d.dow]}요일 · 오늘` : `${DAY_KO[d.dow]}요일`);
const heart = () => el('span', { class: 'rfav', role: 'img', 'aria-label': '즐겨찾기' }, '♥');

/**
 * renderScheduleCard({ box, chip, hint, body }, { alerts, walls, favs, forecasts, today, icon, onOpen(wall, date) })
 * box: the <details>; hidden when there is no alert. alerts: schedule.js rainAlerts. A tap on another wall calls onOpen.
 */
export function renderScheduleCard(dom, args, { focus = false, key = null } = {}) {
  last = [dom, args];
  const { box, chip, hint, body, live } = dom;
  const keep = focus ? key ?? document.activeElement?.dataset?.focus : null; // read before the old buttons are replaced
  const { alerts, walls, favs, forecasts, today, icon, onOpen } = args;
  box.hidden = !alerts.length;
  if (!alerts.length) return;
  hint.textContent = hintOf(alerts);
  chip.replaceChildren(el('span', { class: 'sd-rain' }, icon('sky-rain')));

  const redraw = (key = null) => renderScheduleCard(last[0], last[1], { focus: true, key });
  const groups = alerts.map((a) => {
    const name = a.wall.name;
    const at = a.strip.findIndex((d) => +d.date === sel.get(name));
    const i = at >= 0 ? at : a.pick;
    const days = a.entry.days.map((d) => DAY_KO[d]).join('·');
    const week = el('ul', { class: 'sd-week', 'aria-label': `이번 주 ${name} 비 예보` }, ...a.strip.map((d, k) => {
      const b = el('button', {
        type: 'button', class: `sd-day${d.rain ? ' wet' : ''}${d.mine ? ' mine' : ''}`, 'aria-pressed': String(k === i), 'data-focus': `sd-${name}-${k}`,
        'aria-label': `${DAY_KO[d.dow]}요일 ${d.rain ? d.text : d.known ? '비 없음' : '예보 없음'}${d.mine ? ' · 내 운동 요일' : ''}`,
      }, el('b', {}, d.label), d.rain ? icon('sky-rain') : d.known ? icon('check') : el('span', { 'aria-hidden': 'true' }, '–'));
      b.addEventListener('click', () => { sel.set(name, +d.date); say = `${name} ${dayLong(d, k)} ${d.rain ? d.text : d.known ? '비 없어요' : '예보 없어요'}`; redraw(); });
      return el('li', {}, b);
    }));
    return [
      el('p', { class: 'pick-basis' }, `${a.wall.short_name || name} · ${days} 운동`),
      week,
      el('p', { class: 'pick-key sd-key' }, '테두리는 내 운동 요일이에요'),
      el('div', { class: 'pick-cols' }, detail(a, i, { walls, favs, forecasts, today, onOpen, pickDay: (k) => { sel.set(name, +a.strip[k].date); say = `${name} ${dayLong(a.strip[k], k)} 비 없어요`; redraw(`sd-${name}-${k}`); } })),
    ];
  });
  body.replaceChildren(...groups.flat(), el('p', { class: 'pick-note' }, '운영시간·휴무는 가기 전에 확인해 주세요.'));
  if (say && live) live.textContent = say;
  say = '';
  if (keep) body.querySelector(`[data-focus="${CSS.escape(keep)}"]`)?.focus({ preventScroll: true });
}

// the picked day's box: its head, the nearest dry wall large, two more under it, and the next dry day for the scheduled wall
function detail(a, i, { walls, favs, forecasts, today, onOpen, pickDay }) {
  const d = a.strip[i];
  const head = el('div', { class: `pick-dh${d.rain ? ' wet' : ''}` }, el('span', {}, dayLong(d, i)), el('em', {}, d.rain ? d.text : d.known ? '비 없어요' : '예보 없어요'));
  const kids = [head];
  if (!d.known) kids.push(el('p', { class: 'pick-empty' }, '이 날은 아직 예보가 없어요'));
  else if (!d.rain) kids.push(el('p', { class: 'pick-empty' }, `이 날은 ${a.wall.short_name || a.wall.name}에 비 예보가 없어요`));
  else {
    const alts = alternatives(a.wall, d.date, { walls, favs, forecasts, now: today });
    const why = (r) => ['비 없음', r.km === null ? null : `${Math.round(r.km)}km`, r.fav && !(r.km <= NEAR_KM) ? '즐겨찾기' : null].filter(Boolean).join(' · ');
    const open = (r) => () => onOpen(r.wall, d.date);
    if (!alts.length) kids.push(el('p', { class: 'pick-empty' }, '비 없는 외벽이 근처에 없어요'));
    else {
      const [lead, ...rest] = alts;
      const lb = el('button', { type: 'button', class: 'pick-lead' }, el('span', { class: 'pick-name' }, ...(lead.fav ? [heart()] : []), lead.wall.short_name || lead.wall.name), el('span', { class: 'pick-why' }, why(lead)));
      lb.addEventListener('click', open(lead));
      kids.push(lb);
      if (rest.length) {
        kids.push(el('div', { class: 'pick-rest' }, ...rest.map((r) => {
          const b = el('button', { type: 'button', class: 'pick-next' }, el('span', { class: 'pick-name' }, ...(r.fav ? [heart()] : []), r.wall.short_name || r.wall.name), el('span', { class: 'pick-why' }, why(r)));
          b.addEventListener('click', open(r));
          return b;
        })));
      }
    }
    const j = nextDryDay(a.strip, i);
    if (j !== null) {
      const nb = el('button', { type: 'button', class: 'pick-next pick-alt' }, el('span', { class: 'pick-altk' }, '날짜'), el('span', { class: 'pick-name' }, `${DAY_KO[a.strip[j].dow]}요일은 비 없어요`));
      nb.addEventListener('click', () => pickDay(j));
      kids.push(nb);
    }
  }
  return el('div', { class: 'pick-col' }, ...kids);
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월 … 일

/**
 * renderScheduleRows(body, { schedule, walls, favs, onChange(next), toast })
 * The 내 정보 sheet's rows: each wall with its seven weekdays, 삭제 (undoable), and 암장 추가 (a picker of outdoor walls, ♥ first).
 */
export function renderScheduleRows(body, { schedule: stored, walls, favs, onChange, toast }, { focus = null, adding = false } = {}) {
  const known = (e) => walls.some((w) => w.name === e.wall);
  const schedule = walls.length ? stored.filter(known) : stored; // a wall that is gone from the list (or a stored id that matches none) would show as a bare id: dropped at the first change
  current = schedule;
  const again = (opts) => renderScheduleRows(body, { schedule, walls, favs, onChange, toast }, opts);
  const set = (next, opts) => { onChange(next); renderScheduleRows(body, { schedule: next, walls, favs, onChange, toast }, opts); };
  const rows = schedule.map((e) => {
    const shown = walls.find((w) => w.name === e.wall)?.short_name || e.wall; // the short name, as on the home card
    const del = el('button', { type: 'button', class: 'sh-toggle', 'aria-label': `${shown} 스케줄 삭제` }, '삭제');
    del.addEventListener('click', () => {
      set(removeWall(schedule, e.wall), { focus: 'sd-add-btn' });
      toast(`${shown} 스케줄을 삭제했어요`, () => set(current.length >= MAX_SCHEDULE || current.some((x) => x.wall === e.wall) ? current : [...current, e]), '되돌리기'); // adds this wall back to what is there now
    });
    const cells = WEEK_ORDER.map((dow) => {
      const input = el('input', { type: 'checkbox', class: 'sr-only', 'data-focus': `sdt-${e.wall}-${dow}` });
      input.checked = e.days.includes(dow);
      input.addEventListener('change', () => set(toggleDay(schedule, e.wall, dow), { focus: `sdt-${e.wall}-${dow}` }));
      return el('label', { class: 'sd-day sd-tog' }, input, el('b', {}, DAY_KO[dow]));
    });
    return el('div', { class: 'sd-wall' }, el('div', { class: 'sd-wallh' }, el('span', { class: 'pick-name' }, shown), del), el('div', { class: 'sd-week', role: 'group', 'aria-label': `${shown} 운동 요일` }, ...cells));
  });
  const free = walls.filter((w) => w.venue !== 'indoor' && !schedule.some((e) => e.wall === w.name));
  let adder = null;
  if (schedule.length < MAX_SCHEDULE && free.length) {
    if (adding) {
      const opt = (w) => el('option', { value: w.name }, w.short_name || w.name);
      const mine = free.filter((w) => favs.includes(w.name));
      const rest = free.filter((w) => !favs.includes(w.name)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      const pick = el('select', { id: 'sdAdd', 'data-focus': 'sd-add' }, el('option', { value: '', selected: '', disabled: '' }, '암장 고르기'),
        ...(mine.length ? [el('optgroup', { label: '즐겨찾기' }, ...mine.map(opt))] : []), el('optgroup', { label: '전체' }, ...rest.map(opt)));
      pick.addEventListener('change', () => set(addWall(schedule, pick.value), { focus: 'sd-add-btn' }));
      adder = el('div', { class: 'pf-grade' }, el('label', { class: 'sr-only', for: 'sdAdd' }, '운동할 암장'), pick);
    } else {
      adder = el('button', { type: 'button', class: 'sh-toggle', 'data-focus': 'sd-add-btn' }, '+ 암장 추가');
      adder.addEventListener('click', () => again({ adding: true, focus: 'sd-add' }));
    }
  }
  const empty = schedule.some((e) => !e.days.length);
  body.replaceChildren(...rows, ...(adder ? [adder] : []),
    ...(empty ? [el('p', { class: 'sh-hint' }, '요일을 눌러 주세요')] : []),
    el('p', { class: 'sh-hint' }, '운동하는 요일을 누르면, 그 날 비 예보가 있을 때 홈에 알려 줘요. 최대 5곳. ', el('span', { class: 'sent' }, '이 기기에만 저장돼요.')));
  if (focus) body.querySelector(`[data-focus="${CSS.escape(focus)}"]`)?.focus();
}

/**
 * renderScheduleAsk({ box }, { ask, onRecord(ask, button), onSkip(ask) }) — "어제(월) ○○ 다녀왔어요?" with 기록하기 and 안 갔어요 (schedule.js askYesterday).
 * box: the element; hidden without an ask. 기록하기 opens the 기록 추가 sheet with the wall and day filled in; nothing is recorded here.
 */
const asked = new WeakMap(); // box → the question drawn in it (wall|day): an unchanged one is left alone, so a tap that spans a minute tick still lands
export function renderScheduleAsk({ box }, { ask, onRecord, onSkip }) {
  box.hidden = !ask;
  if (!ask) { asked.delete(box); return; }
  const key = `${ask.wall.name}|${ask.date}`;
  if (asked.get(box) === key && box.children.length) return;
  asked.set(box, key);
  const yes = el('button', { type: 'button', class: 'sh-toggle sd-yes' }, '기록하기');
  yes.addEventListener('click', () => onRecord(ask, yes));
  const no = el('button', { type: 'button', class: 'sh-toggle', 'aria-label': `${ask.wall.short_name || ask.wall.name} ${ask.label} 안 갔어요` }, '안 갔어요');
  no.addEventListener('click', () => onSkip(ask));
  box.replaceChildren(
    el('p', { class: 'sd-asktext' }, el('span', { class: 'pick-eyebrow' }, '운동 기록'), el('span', {}, `${ask.label} ${ask.wall.short_name || ask.wall.name} 다녀왔어요?`)),
    el('div', { class: 'sd-askbtns' }, yes, no));
}
