// src/crag-submit-view.js — 새 암장 제보 (docs/superpowers/specs/2026-11-02-crag-submit-design.md 3절): 핀 → 가까운 곳 확인 → 이름·종류 → 완료(방향 선택).
// DOM via el()/textContent only. The api, the known places and the picker come from the caller: this file never calls fetch or localStorage.
import { el } from './dom.js';
import { openPinPicker } from './pin-picker.js';
import { metersApart } from './fill-fields.js';
import { CRAG_KINDS, FACINGS, KIND_LABEL, MAX_NAME, NEAR_M, cleanCragName, cleanCragPin, nearbyKnown } from './crag-submit-fields.js';

const FACING_LABEL = { N: '북', NE: '북동', E: '동', SE: '남동', S: '남', SW: '남서', W: '서', NW: '북서' };
const SAY = { rate_limited: '잠시 뒤에, 또는 내일 다시 제보해 주세요', bad_request: '이름과 위치를 확인해 주세요' };
const WEEK = 7 * 24 * 60 * 60 * 1000;
const round4 = (n) => Number(n.toFixed(4));

/** candidates within NEAR_M of pin: the local list plus the server's, nearest first, one per id. */
async function candidatesAt(pin, known, api) {
  const out = nearbyKnown(pin, known).map((c) => ({ ...c, known: true })); // known: a real wall/crag the app can open
  try {
    for (const r of await api.nearby(pin.lat, pin.lng)) {
      const dist = metersApart(pin, r);
      if (dist <= NEAR_M && !out.some((o) => o.id === r.id)) out.push({ id: r.id, name: r.name, dist, known: false });
    }
  } catch { /* the server list is a bonus: the local one still protects against a duplicate */ }
  return out.sort((a, b) => a.dist - b.dist);
}

/** openCragSubmitSheet({ api, known, openPicker, onDone }) → the picker dialog that starts the flow; the sheet opens once a pin is confirmed. */
export function openCragSubmitSheet({ api, known = [], openPicker = openPinPicker, onDone = () => {} }) {
  const start = () => openPicker({ title: '새 암장', start: null, onPick: (p) => pinned(p) });
  async function pinned(raw) {
    const pin = cleanCragPin(round4(raw.lat), round4(raw.lng)); // 4 decimals, Korea only
    const body = el('div', { class: 'csub-body' });
    let send = null; // the 제보하기 button of the form step, while it shows
    let form0 = null;
    const close = el('button', { type: 'button', class: 'sh-close', 'data-close': '' }, '닫기');
    const dlg = el('dialog', { class: 'sheet crag-submit', 'aria-labelledby': 'csub-title' },
      form0 = el('form', { method: 'dialog' }, el('div', { class: 'sh-head' }, el('h2', { id: 'csub-title', tabindex: '-1' }, '새 암장 제보')), body, close));
    document.body.append(dlg);
    close.addEventListener('click', () => dlg.close());
    form0.addEventListener('submit', (e) => { e.preventDefault(); if (send && !send.disabled) send.click(); }); // Enter in the name field sends; it never closes the sheet
    dlg.addEventListener('close', () => { dlg.remove(); setTimeout(() => document.querySelector?.('.csub-entry')?.focus?.(), 0); }, { once: true }); // the entry is re-drawn by then: ask for it afresh
    const show = (...kids) => body.replaceChildren(...kids);
    dlg.showModal();
    if (!pin) { // outside Korea: the server would refuse it too
      const again = el('button', { type: 'button', class: 'btn primary' }, '지도에서 다시 고르기');
      again.addEventListener('click', () => { dlg.close(); start(); });
      return show(el('p', { class: 'sh-hint', role: 'status' }, '한국 안의 위치를 골라 주세요.'), again);
    }
    const near = await candidatesAt(pin, known, api);
    if (near.length) {
      const rows = near.map((c) => {
        const label = el('span', {}, `${c.name} · `, el('span', { class: 'csub-dist' }, `${Math.round(c.dist)}m`));
        if (!c.known) return el('div', { class: 'csub-near' }, label, el('span', { class: 'sh-hint' }, '이미 제보된 곳이에요')); // not in the app's lists: nowhere to send the person
        const yes = el('button', { type: 'button', class: 'btn primary csub-nowrap' }, '이 곳이에요');
        yes.addEventListener('click', () => { dlg.close(); onDone({ existing: c }); });
        return el('div', { class: 'csub-near' }, label, yes);
      });
      const no = el('button', { type: 'button', class: 'btn csub-nowrap' }, '다른 곳이에요');
      no.addEventListener('click', () => form(pin));
      return show(el('p', { class: 'sh-hint', role: 'status' }, '가까운 곳에 이미 있어요. 같은 곳인가요?'), ...rows, no);
    }
    form(pin);

    function form(p) {
      let kind = null;
      const name = el('input', { class: 'fill-in', type: 'text', maxlength: String(MAX_NAME), placeholder: '암장 이름 (20자까지)', autocomplete: 'off', 'aria-label': '암장 이름' });
      const chips = CRAG_KINDS.map((k) => {
        const b = el('button', { type: 'button', class: 'la-chip', 'aria-pressed': 'false' }, KIND_LABEL[k]);
        b.addEventListener('click', () => { kind = k; chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b))); sync(); });
        return b;
      });
      send = el('button', { type: 'button', class: 'btn primary csub-nowrap' }, '제보하기');
      const msg = el('p', { class: 'fill-msg', role: 'status' });
      const sync = () => { send.disabled = !(cleanCragName(name.value) && kind); };
      name.addEventListener('input', sync);
      send.addEventListener('click', async () => {
        msg.textContent = '';
        send.disabled = true;
        try {
          const crag = await api.submit({ name: cleanCragName(name.value), kind, lat: p.lat, lng: p.lng });
          onDone({ crag });
          done(crag);
        } catch (e) {
          msg.textContent = SAY[e?.code] ?? '지금은 보낼 수 없어요';
          sync();
        }
      });
      sync();
      show(name, el('p', { class: 'sh-hint' }, '어떤 곳인가요?'), el('div', { class: 'la-chips', role: 'group', 'aria-label': '종류' }, ...chips), msg, send);
    }

    function done(crag) {
      send = null;
      const note = el('p', { role: 'status', tabindex: '-1' }, el('b', {}, '제보했어요 · 검토 중.'), ' 지금은 이름과 위치만 보여요');
      const ask = el('p', { class: 'sh-hint' }, '벽이 어느 쪽을 향하나요? (선택) 벽 앞에 서서 바라보는 쪽이 아니라, 벽면이 향하는 쪽을 골라 주세요');
      const msg = el('p', { class: 'fill-msg', role: 'status' });
      const chips = FACINGS.map((f) => {
        const b = el('button', { type: 'button', class: 'la-chip' }, FACING_LABEL[f]);
        b.addEventListener('click', async () => {
          msg.textContent = '';
          try { const next = await api.addFacing(crag.id, f); onDone({ crag: next }); dlg.close(); } catch (e) { msg.textContent = SAY[e?.code] ?? '지금은 보낼 수 없어요'; }
        });
        return b;
      });
      const skip = el('button', { type: 'button', class: 'btn csub-nowrap' }, '건너뛰기');
      skip.addEventListener('click', () => dlg.close());
      show(note, ask, el('div', { class: 'la-chips' }, ...chips), msg, skip);
      note.focus?.();
    }
  }
  return start();
}

/** the 기록 tab's entry: one line that opens the sheet, then the person's own submissions. null when the feature is off (cragSubmit null). */
export function cragEntry(cragSubmit, now = Date.now()) {
  if (!cragSubmit) return null;
  const open = el('button', { type: 'button', class: 'lg-card-link csub-entry' }, '새 암장 제보하기 ›');
  open.addEventListener('click', () => cragSubmit.open());
  return el('section', { class: 'csub-entry-sec', 'aria-label': '새 암장 제보' }, open, mineSection({ rows: cragSubmit.mineRows(), now }));
}

/** mineSection({ rows, now }) → "내가 제보한 곳": pending gets a chip, approved just the name, rejected/duplicate one line for a week. */
export function mineSection({ rows = [], now = Date.now() }) {
  const lines = rows.flatMap((r) => {
    const fresh = !r.created_at || now - r.created_at < WEEK;
    if (r.status === 'pending') return [el('li', { class: 'csub-mine-row' }, el('span', {}, r.name), el('span', { class: 'chip parking warn' }, '내가 제보 · 검토 중'))];
    if (r.status === 'approved') return [el('li', { class: 'csub-mine-row' }, el('span', {}, r.name))];
    if (!fresh) return [];
    return [el('li', { class: 'csub-mine-row' }, el('span', {}, r.name), el('span', { class: 'sh-hint' }, r.status === 'duplicate' ? '이미 있는 곳이에요' : '받지 못했어요'))];
  });
  return el('ul', { class: 'csub-mine', hidden: lines.length ? null : '' }, ...lines);
}
