// src/schedule-view.js — 운동 스케줄 비 알림: the home card (a folded line; opened, the week as seven days and the picked day's box) and the
// 내 정보 sheet's rows (a wall and the weekdays it is trained on). DOM; the numbers come from schedule.js, the parts from the 이번 주말 추천 card.
import { el } from './dom.js';
import { DAY_KO, ymd } from './time.js';
import { searchPicks } from './viewmodel.js';
import { NEAR_KM, addWall, alternatives, closedWeekdays, keyDay, moveTargets, removeWall, toggleDay, weekHint, MAX_SCHEDULE } from './schedule.js';

let pickedDay = null; // the picked day's time (ms; the strip moves with today, so an index would not hold); null until a tap: the nearest 운동일
let pickedWall; // the picked wall line of that day: undefined = the first shut or rainy one, '' = closed by a tap, a name = that line
let current = []; // the sheet rows' list as last drawn, for 되돌리기
let last = null; // the card's arguments, to draw it again after a tap
let pending = null; // the key to focus after a move redraws the card (the app draws it again, not this file)
let say = ''; // what the picked day says, for the status line a screen reader hears after a tap

const dayLong = (c, i) => (i === 0 ? `${DAY_KO[c.dow]}요일 · 오늘` : `${DAY_KO[c.dow]}요일`);
const heart = () => el('span', { class: 'rfav', role: 'img', 'aria-label': '즐겨찾기' }, '♥');
const used = (c) => c.items.length || c.out.length; // a day with nothing to say is not a button
const state = (c) => (!c.items.length ? '운동 없음' : c.bad ? (c.items[0].state === 'rain' ? c.items[0].text : c.text) : c.icon === 'check' ? '비 없음' : '예보 없음');

/**
 * renderScheduleCard({ box, chip, hint, body, live }, { plan, moves, walls, favs, forecasts, today, icon, onOpen(wall, date), onMove(name, from, to, say), onClear(name, from, say) })
 * box: the <details>; hidden without a 운동일. plan: schedule.js weekPlan (null: nothing to show). Folded: weekHint. Opened: the week as one strip of seven days and
 * the picked day's box (its walls; under the picked one ← 하루 전 / 하루 뒤 → / 원래대로 and, when it is shut or rainy, the walls to go to instead). A tap on another wall calls onOpen.
 * onMove / onClear take day keys 'YYYY-MM-DD' (from: where the day started) and the sentence a screen reader hears; the app saves and draws the card again.
 */
export function renderScheduleCard(dom, args, { focus = false, key = null } = {}) {
  last = [dom, args];
  const { box, chip, hint, body, live } = dom;
  const keep = pending ?? (focus ? key ?? document.activeElement?.dataset?.focus : null); // read before the old buttons are replaced
  pending = null;
  const { plan, moves = [], walls, favs, forecasts, today, icon, onOpen, onMove, onClear } = args;
  box.hidden = !plan || !plan.some((c) => c.items.length);
  if (box.hidden) return;
  const sum = weekHint(plan);
  hint.textContent = sum.text;
  chip.replaceChildren(el('span', { class: sum.icon === 'check' ? 'sd-ok' : 'sd-rain' }, icon(sum.icon)));

  const redraw = (key = null) => renderScheduleCard(last[0], last[1], { focus: true, key });
  const at = plan.findIndex((c) => +c.date === pickedDay && used(c));
  const i = at >= 0 ? at : Math.max(0, plan.findIndex((c) => c.items.length)); // after midnight or a removed day: the nearest 운동일
  const day = plan[i];
  const week = el('ul', { class: 'sd-week', 'aria-label': '이번 주 내 운동' }, ...plan.map((c, k) => {
    const b = el('button', {
      type: 'button', class: `sd-day${c.bad ? ' wet' : ''}${c.items.length ? ' mine' : ''}${c.out.length ? ' out' : ''}`, 'aria-pressed': String(k === i), 'data-focus': `sd-day-${k}`,
      'aria-label': `${DAY_KO[c.dow]}요일 ${state(c)}${c.items.length ? ' · 내 운동 요일' : ''}${c.items.some((x) => x.moved) ? ' · 옮겨 온 날' : ''}${c.out.length ? ' · 옮긴 날' : ''}`,
    }, el('b', {}, c.label), ...(c.icon ? [c.icon === 'dash' ? el('span', { 'aria-hidden': 'true' }, '–') : icon(c.icon)] : []), ...(c.out.length ? [el('span', { class: 'pick-altk' }, '옮김')] : []));
    if (used(c)) b.addEventListener('click', () => { pickedDay = +c.date; pickedWall = undefined; say = `${dayLong(c, k)} ${state(c)}`; redraw(); });
    else b.disabled = true;
    return el('li', {}, b);
  }));
  body.replaceChildren(week, el('p', { class: 'pick-key sd-key' }, '테두리는 내 운동 요일이에요'), el('div', { class: 'pick-cols' }, detail(day, i, { walls, favs, forecasts, today, onOpen, moves, onMove, onClear, pick: (name, k) => { pickedWall = name; say = ''; redraw(k); } })), el('p', { class: 'pick-note' }, '운영시간·휴무는 가기 전에 확인해 주세요.'));
  if (say && live) live.textContent = say;
  say = '';
  if (keep) {
    const at = body.querySelector(`[data-focus="${CSS.escape(keep)}"]`);
    (at && !at.disabled ? at : pickedWall && body.querySelector(`[data-focus="${CSS.escape(`sd-line-${pickedWall}`)}"]`))?.focus({ preventScroll: true }); // a button that went away or off (the move reached an end): its line keeps the focus
  }
}

// the walls to go to instead on `date` (schedule.js alternatives): the nearest large, two more under it; or one line when there is none
function altKids(wall, date, { walls, favs, forecasts, today, onOpen, shut = false }) {
  const alts = alternatives(wall, date, { walls, favs, forecasts, now: today, limit: 2 }); // this card shows two: the lead and one under it
  const why = (r) => [r.wall.venue === 'indoor' ? '실내' : shut ? '열어요' : '비 없음', r.km === null ? null : `${Math.round(r.km)}km`, r.fav && !(r.km <= NEAR_KM) ? '즐겨찾기' : null].filter(Boolean).join(' · ');
  if (!alts.length) return [el('p', { class: 'pick-empty' }, '갈 만한 암장이 근처에 없어요')];
  const btn = (r, cls) => {
    const b = el('button', { type: 'button', class: cls }, el('span', { class: 'pick-name' }, ...(r.fav ? [heart()] : []), r.wall.short_name || r.wall.name), el('span', { class: 'pick-why' }, why(r)));
    b.addEventListener('click', () => onOpen(r.wall, date));
    return b;
  };
  const [lead, ...rest] = alts;
  return [btn(lead, 'pick-lead'), ...(rest.length ? [el('div', { class: 'pick-rest' }, ...rest.map((r) => btn(r, 'pick-next')))] : [])];
}

const go = (key, day, name, msg, fn) => { pending = key; pickedDay = day; pickedWall = name; say = msg; fn(); }; // a move or 원래대로: the pick follows the wall to its new day, then the app draws the card again

// under a picked wall line: a day earlier / a day later (off, with the reasons in one line, when it cannot) and, for a moved day, 원래대로; 맑음 marks the side that is dry when this day is not
function moveBox(it, c, { forecasts, today, moves, onMove, onClear }) {
  const name = it.wall.name;
  const short = it.wall.short_name || name;
  const from = it.from ?? ymd(c.date);
  const targets = moveTargets(it, c.date, { forecasts, today, moves });
  const btns = targets.map((t) => {
    const b = el('button', { type: 'button', class: 'sh-toggle', 'data-focus': `sd-move-${t.dir}` }, t.dir < 0 ? '← 하루 전' : '하루 뒤 →', ...(t.sunny ? [el('span', { class: 'pick-altk' }, '맑음')] : []));
    if (t.disabled) { b.disabled = true; b.setAttribute('aria-describedby', 'sd-why'); }
    else {
      const to = ymd(t.date);
      const msg = to === from ? `${short} 원래 ${DAY_KO[t.date.getDay()]}요일로 돌려놨어요` : `${short} ${DAY_KO[keyDay(from).getDay()]}요일을 ${DAY_KO[t.date.getDay()]}요일로 옮겼어요`;
      b.addEventListener('click', () => go(`sd-move-${t.dir}`, +t.date, name, msg, () => onMove(name, from, to, msg)));
    }
    return b;
  });
  if (it.from) {
    const back = el('button', { type: 'button', class: 'sh-toggle', 'data-focus': 'sd-move-0' }, '원래대로');
    const msg = `${short} 원래 ${DAY_KO[keyDay(from).getDay()]}요일로 돌려놨어요`;
    back.addEventListener('click', () => go(`sd-line-${name}`, +keyDay(from), name, msg, () => onClear(name, from, msg)));
    btns.push(back);
  }
  const why = targets.filter((t) => t.reason).map((t) => `${t.dir < 0 ? '하루 전' : '하루 뒤'}: ${t.reason}`).join(' · '); // which button each reason is of
  return el('div', { class: 'sd-move' }, el('div', { class: 'sd-moveb' }, ...btns), ...(why ? [el('p', { class: 'sh-hint', id: 'sd-why' }, why)] : []));
}

// the picked day's box: its head (the worst words), a line for each wall trained on that day (a tap picks it) and, under the picked shut or rainy one, the walls to go to instead
function detail(c, i, { walls, favs, forecasts, today, onOpen, moves, onMove, onClear, pick }) {
  const head = el('div', { class: `pick-dh${c.bad ? ' wet' : ''}` }, el('span', {}, dayLong(c, i)), el('em', {}, c.text || '운동 없음'));
  const open = pickedWall === undefined ? c.items.find((it) => it.state === 'suspended' || it.state === 'closed' || it.state === 'rain')?.wall.name : pickedWall;
  const busy = new Set(c.items.map((it) => it.wall.name)); // a wall already trained on that day is not one to go to instead
  const kids = [head];
  for (const it of c.items) {
    const name = it.wall.name;
    const bad = it.state === 'suspended' || it.state === 'closed' || it.state === 'rain';
    const on = open === name;
    const row = el('button', { type: 'button', class: `pick-lead sd-line${bad ? ' wet' : ''}`, 'aria-expanded': String(on), 'data-focus': `sd-line-${name}` },
      el('span', { class: 'pick-name' }, it.wall.short_name || name, ...(it.moved ? [el('span', { class: 'pick-altk' }, '옮김')] : [])), el('span', { class: 'pick-why' }, it.text));
    row.addEventListener('click', () => pick(on ? '' : name, `sd-line-${name}`));
    kids.push(row);
    if (on) kids.push(moveBox(it, c, { forecasts, today, moves, onMove, onClear }));
    if (on && bad) kids.push(el('p', { class: 'pick-skip' }, '대신 갈 곳'), ...altKids(it.wall, c.date, { walls: walls.filter((w) => !busy.has(w.name)), favs, forecasts, today, onOpen, shut: it.state !== 'rain' }));
  }
  for (const o of c.out) {
    const name = o.wall.name;
    const back = el('button', { type: 'button', class: 'sh-toggle', 'data-focus': `sd-back-${name}` }, '원래대로');
    back.addEventListener('click', () => go(`sd-line-${name}`, +c.date, name, `${o.wall.short_name || name} 원래 ${DAY_KO[c.dow]}요일로 돌려놨어요`, () => onClear(name, ymd(c.date), `${o.wall.short_name || name} 원래 ${DAY_KO[c.dow]}요일로 돌려놨어요`)));
    kids.push(el('div', { class: 'pick-skip sd-out' }, el('span', {}, `${o.wall.short_name || name} · ${DAY_KO[o.to.getDay()]}요일로 옮겼어요`), back));
  }
  return el('div', { class: 'pick-col' }, ...kids);
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월 … 일

/** weekPicker(e, walls, onPick(dow)) → { cells, why }: the seven weekday toggles of a schedule entry (a closing weekday of the wall is off, with its reason in `why`). Shared by the rows and the card's 매주 가요 popover. */
export function weekPicker(e, walls, onPick) {
  const { days: closed, nth } = closedWeekdays(walls.find((w) => w.name === e.wall) ?? {});
  const cells = WEEK_ORDER.map((dow) => {
    const input = el('input', { type: 'checkbox', class: 'sr-only', 'data-focus': `sdt-${e.wall}-${dow}` });
    input.checked = e.days.includes(dow);
    if (closed.includes(dow) && !input.checked) input.disabled = true; // a closing day cannot be added; one already saved stays shown (and can be taken off)
    input.addEventListener('change', () => onPick(dow));
    return el('label', { class: `sd-day sd-tog${dow === 6 ? ' sat' : dow === 0 ? ' sun' : ''}` }, input, el('b', {}, DAY_KO[dow]));
  });
  const why = [closed.length && `${closed.map((d) => DAY_KO[d]).join('·')}요일은 쉬는 날이에요`, ...nth.map((n) => `${n.words.join('·')} ${DAY_KO[n.dow]}요일은 쉬어요`)].filter(Boolean).join(' · ');
  return { cells, why };
}

// one scheduled wall: its name, 삭제 (undoable) and the seven weekdays; `set(next, opts)` saves and draws again
function wallRow(e, { schedule, walls, set, toast, showName = true, draft = false }) {
  const shown = walls.find((w) => w.name === e.wall)?.short_name || e.wall; // the short name, as on the home card
  const del = el('button', { type: 'button', class: 'sh-toggle', 'aria-label': `${shown} 스케줄 삭제` }, '삭제');
  del.addEventListener('click', () => {
    set(removeWall(schedule, e.wall), { focus: 'sd-add-btn' });
    toast(`${shown} 스케줄을 삭제했어요`, () => set(current.length >= MAX_SCHEDULE || current.some((x) => x.wall === e.wall) ? current : [...current, e]), '되돌리기'); // adds this wall back to what is there now
  });
  const { cells, why } = weekPicker(e, walls, (dow) => set(toggleDay(schedule, e.wall, dow), { focus: `sdt-${e.wall}-${dow}` }));
  return el('div', { class: 'sd-wall' }, el('div', { class: `sd-wallh${showName ? '' : ' end'}` }, ...(showName ? [el('span', { class: 'pick-name' }, shown)] : []), ...(draft ? [] : [del])), el('div', { class: 'sd-week', role: 'group', 'aria-label': `${shown} 운동 요일` }, ...cells), ...(why ? [el('p', { class: 'sh-hint' }, why)] : []));
}

/**
 * renderScheduleRows(body, { schedule, walls, favs, onChange(next), toast })
 * The 내 정보 sheet's rows: each wall with its seven weekdays, 삭제 (undoable), and 암장 추가 (a picker of outdoor walls, ♥ first).
 */
export function renderScheduleRows(body, { schedule: stored, walls, favs, onChange, toast, getOrigin = () => null }, { focus = null, adding = false } = {}) {
  const known = (e) => walls.some((w) => w.name === e.wall);
  const schedule = walls.length ? stored.filter(known) : stored; // a wall that is gone from the list (or a stored id that matches none) would show as a bare id: dropped at the first change
  current = schedule;
  const deps = { walls, favs, onChange, toast, getOrigin };
  const again = (opts) => renderScheduleRows(body, { schedule, ...deps }, opts);
  const set = (next, opts) => { onChange(next); renderScheduleRows(body, { schedule: next, ...deps }, opts); };
  const rows = schedule.map((e) => wallRow(e, { schedule, walls, set, toast }));
  const free = walls.filter((w) => !schedule.some((e) => e.wall === w.name));
  let adder = null;
  if (schedule.length < MAX_SCHEDULE && free.length) {
    if (adding) {
      // the 기록 추가 sheet's picker: ♥ chips (one tap), and a search by name or region (nearest first when the position is known); picking lands on the new row's first day
      const addIt = (name) => set(addWall(schedule, name), { focus: `sdt-${name}-${WEEK_ORDER[0]}` });
      const chips = favs.map((n) => free.find((w) => w.name === n)).filter(Boolean).map((w) => { // in the order they were ♥'d, all of them (the row wraps)
        const b = el('button', { type: 'button', class: 'la-chip', 'aria-label': `${w.name} 스케줄에 추가` }, heart(), ' ', w.short_name || w.name);
        b.addEventListener('click', () => addIt(w.name));
        return b;
      });
      const q = el('input', { type: 'search', id: 'sdAdd', 'data-focus': 'sd-add', placeholder: '암장 이름이나 지역으로 찾기', autocomplete: 'off' });
      const picks = el('ul', { class: 'la-picks' });
      picks.hidden = true;
      let shown = []; // the hit buttons now listed
      const drawHits = () => {
        const k = q.value.trim();
        picks.hidden = !k;
        shown = [];
        if (!k) return picks.replaceChildren();
        const hits = searchPicks(free, k, { origin: getOrigin() }).slice(0, 30);
        picks.replaceChildren(...(hits.length ? hits.map(({ wall: w }) => {
          const b = el('button', { type: 'button', class: 'la-hit' },
            el('span', { class: 'pn' }, favs.includes(w.name) ? heart() : null, favs.includes(w.name) ? ' ' : null, w.name),
            el('span', { class: 'pr' }, [w.venue === 'indoor' ? '실내' : null, w.region].filter(Boolean).join(' · ')));
          b.addEventListener('click', () => addIt(w.name));
          shown.push(b);
          return el('li', {}, b);
        }) : [el('li', { class: 'none' }, '맞는 암장이 없어요. 이름 일부로 찾아보세요.')]));
      };
      q.addEventListener('input', drawHits);
      q.addEventListener('keydown', (e) => { // Enter picks only when one wall matches; a Korean IME's committing Enter must not pick early
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (e.isComposing) return;
        if (shown.length === 1) shown[0].click();
      });
      const close = el('button', { type: 'button', class: 'sh-toggle' }, '닫기');
      close.addEventListener('click', () => again({ focus: 'sd-add-btn' }));
      adder = el('div', { class: 'sd-adder' },
        ...(chips.length ? [el('div', { class: 'la-chips', role: 'group', 'aria-label': '즐겨찾기 암장' }, ...chips)] : []),
        el('label', { class: 'la-field' }, el('span', { class: 'sr-only' }, '운동할 암장 찾기'), q), picks, close);
    } else {
      adder = el('button', { type: 'button', class: 'sh-toggle', 'data-focus': 'sd-add-btn' }, '+ 암장 추가');
      adder.addEventListener('click', () => again({ adding: true, focus: 'sd-add' }));
    }
  }
  const empty = schedule.some((e) => !e.days.length);
  body.replaceChildren(...rows, ...(adder ? [adder] : []),
    ...(empty ? [el('p', { class: 'sh-hint' }, '요일을 눌러 주세요')] : []),
    el('p', { class: 'sh-hint' }, '운동하는 요일을 누르면, 그 날 비 예보가 있을 때 홈에 알려 줘요(실내 암장은 비와 무관해 알리지 않아요). ', schedule.length >= MAX_SCHEDULE ? '5곳이 가득 찼어요. 하나를 삭제하면 다른 암장을 넣을 수 있어요. ' : '최대 5곳. ', el('span', { class: 'sent' }, '이 기기에만 저장돼요.')));
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
