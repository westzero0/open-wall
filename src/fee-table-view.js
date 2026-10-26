import { el, tightParens } from './dom.js';

// The 요금 table of a wall (feeTable() in card-model.js made the rows): 구분 / 대상 / 평일 / 휴일. Same price on both days: one cell
// over the two columns; an item with only a note: its name and the note over the others. An item priced per 거주지 (관외 | 관내):
// a small header row of the group names, then one row per 대상 with a price under each name. `t.wide`: the table has two price
// columns (a weekday / holiday split, or a grouped item); `t.split`: the two columns are 평일 / 휴일.
export function feeTableEl(t) {
  const cell = (tag, text, attrs = {}) => el(tag, attrs, text);
  const span = t.wide ? '3' : '2'; // the cells under 구분 for a note
  const body = el('tbody', {});
  for (const it of t.items) {
    if (it.noteOnly) {
      body.append(el('tr', {}, cell('th', it.item, { scope: 'row' }), cell('td', tightParens(it.note), { colspan: span, class: 'f-note' })));
      continue;
    }
    const head = it.groupCols ? 1 : 0; // the small header row of the group names
    let first = true;
    const start = (tr) => {
      if (first) tr.append(cell('th', it.item, { scope: 'rowgroup', rowspan: String(head + it.rows.length) }));
      first = false;
    };
    if (it.groupCols) {
      const tr = el('tr', { class: 'f-sub' });
      start(tr);
      tr.append(cell('td', '', { class: 'f-who' }), ...it.groupCols.map((g) => cell('th', g, { scope: 'col', class: 'f-gh' })));
      body.append(tr);
    }
    for (const r of it.rows) {
      const tr = el('tr', {});
      start(tr);
      // a 대상 priced per 거주지: the 대상 once (the rows after it keep it for a screen reader only), then the 거주지 name at the right edge (the 대상 stays at the left)
      tr.append(r.group ? el('td', { class: 'f-who' }, el('div', { class: 'f-pg' }, el('span', { class: r.dup ? 'f-dup' : 'f-w' }, r.who), el('span', {}, r.group))) : cell('td', r.who, { class: 'f-who' }));
      // session times ("1부 13~17시 · 2부 18~22시") stack one session per line
      const val = (text, attrs) => (r.times ? el('td', { ...attrs, class: `${attrs.class} f-times` }, ...text.split(' · ').map((p) => el('span', {}, ...p.split(' ').flatMap((w, i) => [i ? ' ' : '', ...w.split(/(?<=~)/).map((h) => el('span', { class: 'f-nb' }, h))])))) : cell('td', text, attrs));
      if (r.cells) tr.append(...r.cells.map((c) => cell('td', c, { class: 'f-won' })));
      else if (r.all !== undefined) tr.append(val(r.all, t.wide ? { colspan: '2', class: 'f-all' } : { class: 'f-won' }));
      else tr.append(val(r.weekday, { class: 'f-won' }), val(r.weekend, { class: 'f-won' }));
      body.append(tr);
    }
    if (it.note) body.append(el('tr', {}, cell('td', tightParens(it.note), { colspan: String(Number(span) + 1), class: 'f-note' }))); // the note runs under the whole row, 구분 column too
  }
  return el('section', { class: 'fees', 'aria-label': '요금' },
    el('table', {}, el('thead', {}, el('tr', {}, cell('th', '구분'), cell('th', '대상'),
      ...(t.wide ? (t.split ? [cell('th', '평일'), cell('th', '휴일')] : [cell('th', '요금', { colspan: '2' })]) : [cell('th', '요금')]))), body),
    t.discount ? el('p', { class: 'f-disc' }, t.discount) : null);
}
