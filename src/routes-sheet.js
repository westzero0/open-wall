// 싱글피치 개념도·루트 시트(docs/superpowers/specs/2026-10-21-crag-routes-topo-design.md 화면 1단계).
// 머리: 이름 · 완료 ✓. 위 개념도 사진(누르면 크게 보고 스크롤, 개념도가 여럿이면 칩으로 전환), 아래 루트 표(번호 · 이름 · 난이도 · 길이 · 장비).
// 값 없는 칸은 –, 모든 루트에 값이 없는 열은 그리지 않는다. 1단계에서 이름은 눌리지 않는다. DOM은 el()과 텍스트 노드만 쓴다.
import { el } from './dom.js';
import { sortRoutes, routeColumns, equipLabel } from './crag-routes.js';
import { photoUrl } from './crag-approach.js';
import { sheetForm } from './approach-sheet.js';
import { routeSummary, routeLineText, rowMine } from './crag-grades.js';

const DASH = '–';

// 칩 글자: caption이 서로 다르면 caption, 겹치면 1, 2…
function chipLabels(topos) {
  const caps = topos.map((t) => t.caption ?? '');
  const distinct = caps.every((c) => c) && new Set(caps).size === caps.length;
  return topos.map((t, i) => (distinct ? caps[i] : String(i + 1)));
}

function routeTable(routes, mine) {
  if (!routes.length) return null;
  const col = routeColumns(routes);
  const heads = ['번호', '이름', col.grade && '난이도', col.length && '길이', col.equip && '장비'].filter(Boolean);
  const rows = sortRoutes(routes).map((r) => el('tr', { class: rowMine(r, mine) ? 'is-mine' : null },
    el('th', { scope: 'row' }, r.no == null ? DASH : String(r.no)),
    el('td', {}, el('span', { class: 'rs-name' }, r.name), col.pioneer && r.pioneer ? el('span', { class: 'rs-pioneer' }, `초등 ${r.pioneer}`) : null),
    col.grade ? el('td', {}, r.grade ?? DASH) : null,
    col.length ? el('td', {}, r.length_m != null ? `${r.length_m}m` : DASH) : null,
    col.equip ? el('td', {}, equipLabel(r)) : null));
  return el('div', { class: 'rs-tablebox' }, el('table', { class: 'rs-table' },
    el('thead', {}, el('tr', {}, ...heads.map((h) => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, ...rows)));
}

/**
 * openRoutesSheet(name, entry, { onClose, icon, mine }) → { close() }
 * entry: loadCragRoutes's { areas?, topos[], routes[] } for that crag. onClose(): after the sheet closed. icon(name): app.js's icon() (optional; without it the ✓ is text).
 */
export function openRoutesSheet(name, entry, { onClose = () => {}, icon = null, mine = null } = {}) {
  const topos = entry?.topos ?? [];
  const routes = entry?.routes ?? [];
  const sum = routeSummary(routes, mine);
  const dlg = document.getElementById('routes-sheet')
    ?? document.body.appendChild(el('dialog', { id: 'routes-sheet', class: 'sheet routes-sheet', 'aria-labelledby': 'rs-title' }));
  const opener = document.activeElement;
  let cur = 0;
  let zoom = false;

  const done = el('button', { type: 'button', class: 'sh-ok', 'aria-label': '완료' }, (icon && icon('close')) ?? '✕'); // the sheets' ✓ (app.js .sh-ok)
  done.addEventListener('click', () => dlg.close());
  const view = el('div', { class: 'rs-topo' });
  const credit = el('p', { class: 'rs-credit' });
  const labels = chipLabels(topos);
  const chips = topos.length > 1 ? topos.map((t, i) => {
    const b = el('button', { type: 'button', class: 'rt-chip' }, labels[i]); // the wall sheet's 벽 고르기 chip (app.js .rt-chip)
    b.addEventListener('click', () => { cur = i; zoom = false; paint(); });
    return b;
  }) : [];

  function paint() {
    chips.forEach((b, i) => b.setAttribute('aria-pressed', String(i === cur)));
    const t = topos[cur];
    credit.textContent = t?.credit ? `출처 ${t.credit}` : '';
    credit.hidden = !t?.credit;
    if (!t) { view.hidden = true; return; }
    view.hidden = false;
    view.className = `rs-topo${zoom ? ' is-zoom' : ''}`;
    const img = el('img', { src: photoUrl(t.image), alt: `${name} 개념도${chips.length ? ` ${labels[cur]}` : ''}`, decoding: 'async' });
    img.addEventListener('error', () => { if (!view.contains(img)) return; view.className = 'rs-topo is-fail'; view.replaceChildren(el('p', { class: 'rs-fail' }, '개념도를 못 불러왔어요')); });
    const btn = el('button', { type: 'button', class: 'rs-zoom', 'aria-pressed': String(zoom), 'aria-label': zoom ? '개념도 작게 보기' : '개념도 크게 보기' }, img);
    btn.addEventListener('click', () => { zoom = !zoom; paint(); view.querySelector('.rs-zoom')?.focus(); });
    view.replaceChildren(btn);
  }

  sheetForm(dlg, // .sheet form: the padding; the grab bar src/sheet-gestures.js put in it stays (the dialog is reused)
    el('div', { class: 'sh-head rs-head' }, el('h2', { id: 'rs-title' }, name), el('div', { class: 'sh-okw' }, done)),
    sum ? el('p', { class: 'rs-sum' }, `루트 ${routeLineText(routeSummary(routes, null))}`) : null, // no 루트 label here: the line says the word
    sum?.mineLabel ? el('p', { class: 'rs-mine' }, `내 그레이드 ${sum.mineLabel} · ${sum.mineCount}개`) : null,
    chips.length ? el('div', { class: 'rt-chips', role: 'group', 'aria-label': '개념도' }, ...chips) : null,
    view, credit, routeTable(routes, mine));
  dlg.onclose = () => {
    dlg.onclose = null;
    const back = opener?.isConnected ? opener : document.querySelector('.crag-row.is-open [data-opens="routes"]'); // the card may have been drawn again: its 루트 row
    back?.focus();
    onClose();
  };
  paint();
  dlg.showModal();
  done.focus();
  return { close: () => { if (dlg.open) dlg.close(); } };
}
