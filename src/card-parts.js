// src/card-parts.js — the pieces of an open card that every kind of place (외벽, 싱글피치, 빙벽, 실내) can reuse.
// Each part takes plain data (from card-model.js) and returns one element, or null when its data is missing: a kind that has no
// sun simply passes a bar with `sunBands: []` and leaves the sun box out; nothing here knows about 양달.
//   gaugeBar(bar)      the day's bar: open stretches, sun bands, the pin at the picked time
//   gaugeEnds(bar)     open time (left) and close time (right) under the bar's ends
//   remainPill(left)   "10시간" / "10시간 가능", "곧 마감", "3시간 뒤 휴게" (the closing time is the gauge's right end): the wording is picked by css width (.lf-s / .lf-l)
//   warnPill(warn, call) / warnNote(warn)  closure-warning: "닫혔을 수 있어요 · 확인 중" in the place of remainPill, and its line ("12분 전 제보 · …") in the expanded card
//   heroCap(m)         today's hours on a photo; dropped when the gauge already says them
//   dock(go, been, tel) the actions under the photo: 길찾기 · 전화 (icons only; no 전화 without a number) and 다녀왔어요
//   goRow(mk, kids, …) a tappable info line (이름 칸 · 내용 · ›) that opens a sheet
//   photoTools(…)      round buttons (share) in the photo's corner
//   cameraBtn(…)       the camera that sends a photo (on a photo: one more; on the placeholder: the first)
//   placeholderHero(…) the block that stands where a photo would: hours cap, camera (left), share (right), laid out as a photo card's foot (style.css --icon-row)
//   sheetLine(name, f) the 48px line into the wall sheet
//   reserveBand(r, …)  the 예약하기 band (예약 필수 when required), only with a reservation link
//   chipBar(chips, …)  one line of chips from card-model `chips` [{kind, text, icon, tone, to}]
import { el } from './dom.js';
import { AXIS, axisFrac, fmtMin } from './viewmodel.js';
import { boardText } from './card-model.js';

export const axisX = (min) => `${axisFrac(min) * 100}%`;
export const span = (cls, a, b) => {
  const s = el('span', { class: cls });
  s.style.left = axisX(a);
  s.style.width = `${(axisFrac(b) - axisFrac(a)) * 100}%`;
  return s;
};
// An orange sun band that starts or ends where the open bar does takes the bar's round end (the list's bar and the sheet's alike);
// inside the bar it stays square so two colours meet cleanly.
export const capCls = (a, b, open) => `${open.some(([x]) => x === a) ? ' cap-l' : ''}${open.some(([, y]) => y === b) ? ' cap-r' : ''}`;

// The one bar of a wall's day, drawn the same in the list row and on the map card: green where open (grey once gone in the open card),
// orange where it is sunny inside those hours, the pin at the picked time. `ahead` (a later day) has no pin.
export function gaugeBar(bar) {
  const onAxis = bar.nowMin >= AXIS[0] && bar.nowMin <= AXIS[1]; // before 06:00 the pin would stand on the axis' left end like a stray mark: no pin
  const tick = bar.ahead || !onAxis ? null : el('span', { class: 'tick' });
  tick?.style.setProperty('left', axisX(bar.nowMin));
  return el('span', { class: 'bar', role: 'img', 'aria-label': bar.label },
    // past and to-come are one tone in the list: the pin says "now"; the two halves of a split interval meet square
    ...bar.segments.map(([a, b, past], i, all) => span(`${past ? 'seg past' : 'seg'}${all[i + 1]?.[0] === b ? ' j-end' : ''}${all[i - 1]?.[1] === a ? ' j-start' : ''}`, a, b)),
    // the part before the pin is already gone: its orange is paler, like the bar under it
    ...bar.sunBands.flatMap(([a, b]) => (bar.nowMin == null || bar.nowMin <= a ? [[a, b, false]] : bar.nowMin >= b ? [[a, b, true]] : [[a, bar.nowMin, true], [bar.nowMin, b, false]]))
      .map(([a, b, past]) => span(`${past ? 'sunband past' : 'sunband'}${capCls(a, b, bar.open)}`, a, b)),
    tick);
}

// Open and close time under the ends of the stretch the viewed time is in (with a lunch break: that stretch's own start and end).
// Hidden from screen readers: the bar's own label already reads the hours. Drawn on every row; css shows it once a list card is open (not in a folded row, not on the map card).
export function gaugeEnds(bar) {
  if (!bar?.open?.length) return null; // (a later day's bar says that day's hours too: the card keeps its hours in one place, under the bar)
  // a lunch break splits the day: the labels belong to the stretch of the viewed time (else the next one, else the last)
  const seg = bar.open.find(([x, y]) => bar.nowMin >= x && bar.nowMin < y) ?? bar.open.find(([x]) => x > bar.nowMin) ?? bar.open.at(-1);
  const a = seg[0], b = seg[1];
  const short = b - a < 240; // under 4 hours the two labels would touch: one label over the stretch
  const box = el('span', { class: 'gauge-ends', 'aria-hidden': 'true' }, ...(short ? [el('span', {}, `${fmtMin(a)}–${fmtMin(b)}`)] : [el('span', {}, fmtMin(a)), el('span', {}, fmtMin(b))]));
  box.style.paddingLeft = short ? `min(${axisX(a)}, calc(100% - 6.6em))` : axisX(a); // one label over the stretch: never past the bar's right end, even in big type
  box.style.paddingRight = `${(1 - axisFrac(b)) * 100}%`;
  return box;
}

// left: card-model's `leftCard` {short, long}; null (a closed wall) draws nothing
export function remainPill(left) {
  if (!left) return null;
  // the short wording is hidden from screen readers; the long one is always read (css only clips it on a narrow screen)
  return el('span', { class: 'lf-card' }, el('span', { class: 'lf-s', 'aria-hidden': 'true' }, left.short), el('span', { class: 'lf-l' }, left.long));
}

// 닫힘·단축 제보 (closure-warning.js `warn`): amber pill in the place of remainPill. `call` is the phone button the app built (null: no number).
// The pill has the words, so colour is never the only signal; the phone beside it is how the visitor checks before going.
export function warnPill(warn, call = null) {
  if (!warn) return null;
  return el('span', { class: 'warn-wrap' },
    el('span', { class: 'warn-pill', 'aria-label': `제보로 ${warn.phrase}, 확인 중` }, el('span', { class: 'wp-t' }, warn.phrase), el('span', { class: 'wp-s', 'aria-hidden': 'true' }, ' · 확인 중')),
    call);
}

// The expanded card's line under the name: when it was reported and what to do about it.
export function warnNote(warn, agoWord, how) {
  if (!warn) return null;
  return el('p', { class: 'warn-note' }, [warn.onsite ? '현장 제보' : null, warn.onsite ? agoWord?.replace(/ 제보$/, '') : agoWord || null, how || null].filter(Boolean).join(' · '));
}

// 누르는 .irow (주차·근처·어프로치 줄): 이름 칸 · 내용 · ›. data-opens: 시트가 닫힐 때 카드가 다시 그려졌으면 포커스가 돌아올 곳.
// arrow: the mark at the right end (a row with no value says `알려 주기 ›` there)
export function goRow(mk, kids, opens, onClick, label = null, arrow = '›') {
  const b = el('button', { type: 'button', class: 'pv pv-go', 'data-opens': opens, 'aria-label': label },
    el('span', { class: 'pv-t' }, ...kids), el('span', { class: 'pv-arrow', 'aria-hidden': 'true' }, arrow));
  b.addEventListener('click', onClick);
  return el('div', { class: 'irow' }, el('span', { class: 'mk' }, mk), b);
}

// The three rows under the chips (운영 · 이용 · 게시판), each opening its tab of the wall sheet. `row` is card-model's {text} | {empty: true} (value not known:
// a quiet 아직 몰라요 and 알려 주기 › in the arrow's place, the whole row asks the wall's report) | null (no row). open(button) opens the tab; ask(button) the report.
// a time range (08:00–21:00) stays on one line: the value may break between ranges and words, never inside one
const rangesKept = (t) => t.split(/(\d{1,2}:\d{2}[–-]\d{1,2}:\d{2})/).map((p, i) => (i % 2 ? el('span', { class: 'tr' }, p) : p));
export function infoRow(mk, row, { opens, open, ask, text = null }) {
  if (!row) return null;
  if (row.empty) return goRow(mk, [el('span', { class: 'pv-none' }, '아직 몰라요')], opens, (e) => ask(e.currentTarget), `${mk} 정보 없음, 알려 주기`, '알려 주기 ›');
  return goRow(mk, text ? [text] : rangesKept(row.text), opens, (e) => open(e.currentTarget), `${mk} ${row.text ?? ''}`.trim());
}

// 게시판 row: the wall's 한 줄 타임라인 (the same words as the pill, boardText). board: the summary or null (not here yet: a plain 한 줄 타임라인);
// open(button) opens the wall sheet on its board tab. setBoardRow repaints the row when the summary arrives.
export function boardRow(board, { name, open, blog = null }) {
  const row = goRow('게시판', [], 'board', (e) => open(e.currentTarget), null);
  row.dataset.board = name;
  row.blog = blog; // the row repaints itself when the summary arrives: it keeps what it needs
  setBoardRow(row, board);
  return row;
}
export function setBoardRow(row, board) {
  const blog = row.blog;
  const t = boardText(board, row.dataset.board, { blog });
  row.querySelector('.pv-t').textContent = t?.text ?? (blog ? `블로그 후기 ${blog.posts.length}개` : '한 줄 타임라인');
  row.querySelector('.pv-go').setAttribute('aria-label', t?.label ?? `${row.dataset.board} 한 줄 타임라인`);
}

// 휴무안내: one line under the chips, only when the card has a closing to tell (card-model `notice`). 'sure' (an admin-entered closing) is red and final;
// 'maybe' (a weather condition) is quiet, blue when rain is coming (lit), and asks for a report (report(button) opens the 임시휴무 sheet).
export function noticeLine(n, { lit = false, report = null, icon = null } = {}) {
  if (!n) return null;
  const on = n.tone === 'maybe' && n.rain && lit;
  const ask = n.tone === 'maybe' && report
    ? el('button', { type: 'button', class: 'nt-go', 'aria-label': '오늘 휴무 제보하기' }, icon ? icon('megaphone') : null, '제보하기') : null;
  ask?.addEventListener('click', () => report(ask));
  return el('div', { class: `irow notice ${n.tone}${on ? ' rain' : ''}`, role: 'note' },
    el('span', { class: 'mk' }, '휴무안내'), el('span', { class: 'nt-t' }, on ? `${n.text} · 오늘 비 예보` : n.text), ask);
}

// The dock's icon buttons (길찾기, 전화): no words on them, the label and title say it; the same 48px square. `icon` draws the glyph.
export const dockIcon = (cls, label, glyph, attrs, icon) => el('a', { class: `dock-go dock-ic ${cls}`, 'aria-label': label, title: label, ...attrs }, icon(glyph));
// 전화: `link` is the card model's phone link ({href}) or absent: a place with no number has no button
export const telButton = (name, link, icon) => (link ? dockIcon('dock-tel', `${name} 전화하기`, 'phone', { href: link.href }, icon) : null);

// The two actions under the photo, the same for every kind of place: [길찾기 | 다녀왔어요], side by side. Both buttons come ready-made (they belong to the
// app: the map-app dialog, the log sheet); a place with no position has no 길찾기 and the other fills the row.
export const dock = (go, been, tel = null) => el('div', { class: 'dock' }, go, tel, been);

// ♥ and share as round buttons in the photo's top-right corner (or the placeholder block's); the app passes its own buttons.
export const photoTools = (...buttons) => el('div', { class: 'photo-tools' }, ...buttons);

// The camera: opens the 제보 sheet on 암장 사진 for this wall. `more`: the card already has a photo ("one more"), else it is the first one.
// The caller decides whether to draw it at all (it needs the board Worker); `icon` is the app's own icon helper.
export function cameraBtn(name, { more = false, icon }) {
  const b = el('button', { type: 'button', class: 'rhero-add', 'aria-label': more ? `${name} 사진 더 보내기` : `${name} 외벽 사진 보내기`, title: more ? '사진 더 보내기' : '사진 보내기' }, icon('camera-plus'));
  b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('wall:report', { detail: { name, kind: '암장 사진', kinds: ['암장 사진'] } })));
  return b;
}

// The block that takes a photo's place on a card with none. Same foot as a photo card (hours cap above, camera at the left and share at the right on one
// line, the dock over its foot), so the two cards read as one frame; only the height differs (style.css .ph-hero). camera / share may be null.
export const placeholderHero = (m, camera, share) => el('div', { class: 'ph-hero' }, heroCap(m), camera, photoTools(share));

// The line into the sheet, two parts: 암장 정보 자세히 › (the › right beside the words) and, at the right end, the wall's 한 줄 타임라인 as a pill (boardPill:
// how many posts, whether one is new, or an invitation to write the first). 48px; what is in the sheet is its tabs' business. onOpen(button) opens the wall
// sheet. board: { kind: 'has' | 'new' | 'none', n } or null (no pill: the board is off or the summary has not come); onBoard(button) opens it on its tab.
// setBoardPill repaints the pill when the summary arrives or the board was read; `icon` draws the chat glyph.
export function sheetLine(name, onOpen, { board = null, onBoard = null, icon = null } = {}) {
  const b = el('button', { type: 'button', class: 'sheet-line', 'data-sheet-open': '', 'data-name': name },
    el('b', {}, '암장 정보 자세히'), el('i', { 'aria-hidden': 'true' }, '›'));
  b.addEventListener('click', () => onOpen(b));
  const row = el('div', { class: 'sheet-row', 'data-wall': name }, b);
  setBoardPill(row, board, onBoard, icon);
  return row;
}
export function setBoardPill(row, board, onBoard, icon) {
  row.querySelector('.board-pill')?.remove();
  if (!board || !onBoard) return;
  const t = boardText(board, row.dataset.wall);
  const pill = el('button', { type: 'button', class: `board-pill ${board.kind}`, 'aria-label': t.label },
    icon ? icon('chat') : null, el('span', {}, ...(t.fresh ? [`${t.lead} `, el('b', {}, '새 글')] : [t.lead])), el('i', { 'aria-hidden': 'true' }, '›'));
  pill.addEventListener('click', () => onBoard(pill));
  row.append(pill);
}

// The 예약 band under the dock: one full-width line, only for a place that takes reservations (card-model `reserve` {name, url, required}), nothing otherwise.
// "예약하기" and where; when a reservation is a must (required) it also says 예약 필수 (a yellow ! badge, a deeper tint) so nobody drives out for nothing.
// icon(name) draws the calendar of the plain band.
export function reserveBand(reserve, { icon }) {
  if (!reserve) return null;
  const lead = reserve.required ? el('i', { class: 'rb-badge', 'aria-hidden': 'true' }, '!') : icon('calendar');
  return el('a', { class: `reserve-band${reserve.required ? ' required' : ''}`, href: reserve.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${reserve.required ? '예약 필수' : '예약하기'}, ${reserve.name ? `${reserve.name} ` : ''}예약 사이트 (새 창)` },
    lead, el('b', {}, '예약하기'), el('span', { 'aria-hidden': 'true' }, `${reserve.name ?? '예약 사이트'} ↗`));
}

// One line of chips (card-model `chips`). icon(name) draws the glyph; pick(to, button) opens the sheet at `to`. A chip with no `to` is plain text.
// A chip says one fact in a few words: the detail is behind it.
export function chipBar(chips, { icon, pick }) {
  if (!chips?.length) return null;
  return el('div', { class: 'chip-bar', role: 'list', 'aria-label': '요약' }, ...chips.map((c) => {
    const kids = [c.icon ? icon(c.icon) : null, el('span', {}, c.text), c.note ? el('span', { class: 'sr-only' }, ` (${c.note})`) : null];
    const cls = `cchip ${c.kind} ${c.tone}`;
    if (!c.to) return el('span', { class: cls, role: 'listitem', title: c.note ?? null }, ...kids);
    const b = el('button', { type: 'button', class: cls, title: c.note ?? null }, ...kids);
    b.addEventListener('click', () => pick(c.to, b));
    return el('span', { role: 'listitem', class: 'cchip-cell' }, b);
  }));
}

// 오늘 운영 · 08:00~22:00 on a photo (or on the placeholder block). `hoursOnGauge` (card-model): the gauge says the hours, so the photo stays clean;
// a suspended or closed day has no gauge ends and keeps its words.
export function heroCap(m) {
  if (m.hoursOnGauge) return null;
  return el('div', { class: 'rhero-cap' }, m.suspended || m.state === 'unknown' ? null : el('small', {}, m.today.lead), el('b', { class: m.suspended ? 'susp-pill' : m.state === 'unknown' ? 'hero-note hero-unk' : 'hero-note' }, m.today.text));
}

// the card's ! (13px ring) with its bubble, the same .sun-why / .sun-limit as the sun box; `.inl` sits in a line of text instead of the picture's corner.
// A tap elsewhere or Esc closes it (app.js). `label` names the button for screen readers.
export function whyBubble(label, ...content) {
  const d = el('details', { class: 'sun-why inl' }, el('summary', { 'aria-label': label }), el('div', { class: 'sun-limit' }, ...content));
  return d;
}
