// 싱글피치 어프로치 탭(docs/superpowers/specs/2026-10-21-crag-approach-design.md, 시안 mockups/2026-10-21-crag-approach.html): 암장 시트(wall-sheet.js)의 한 탭.
// 위 줄: 저장 칩(기기에 저장). 길 띠(지금 정지점 강조, 걸어 온 구간 채움, 원을 누르면 그 단계로), 사진(왼쪽·오른쪽 절반 = 이전·다음,
// 가로로 밀기), 방향 글자(turn 화살표 + text), wrong이면 와인 줄, 아래 이전/다음. 사진이 안 뜨면 글·띠·방향은 그대로 둔다.
// 첫 정지점은 주차(park.chip·line), 마지막은 암장 도착. DOM은 el()과 텍스트 노드만 쓴다.
import { el } from './dom.js';
import { approachModel, stepTo, photoUrl } from './crag-approach.js';

const TURN_WORD = { left: '왼쪽', right: '오른쪽', straight: '직진', up: '오르막', down: '내리막' };
const SWIPE_PX = 40;

// st: { saved, total, failed? } | null. → the chip's words and kind; no photos = no chip
// no/saved are icon buttons (aria-label 기기에 저장 / 저장됨, as the card's save button was); busy and fail say it in words
function chipOf(st, busy) {
  if (!st || !st.total) return null;
  if (busy) return { text: '저장 중…', kind: 'busy' };
  if (st.failed) return { text: `${st.failed}장 못 받았어요`, kind: 'fail' };
  return st.saved >= st.total ? { text: '저장됨', kind: 'saved', glyph: 'check' } : { text: '기기에 저장', kind: 'no', glyph: 'download' };
}

/**
 * approachPane(crag, { saveState, onSave, onClear, icon }) → { node, setSaved(st?) } | null (null: approachModel(crag) has nothing to show).
 * The 어프로치 tab of the crag sheet (src/wall-sheet.js holds the head, ✓/닫기 and the dialog). node: the save chip on top, the strip,
 * the place line, the photo, the direction, the wrong-way line, 이전/다음 and 기기에서 사진 지우기.
 * saveState(name): { saved, total, failed? } | null (read at build and by setSaved()); onSave(name): the chip was pressed (app.js saves,
 * then calls setSaved). onClear(): 기기에서 지우기. icon(name): app.js's icon() (optional).
 */
export function approachPane(crag, { saveState = null, onSave = () => {}, onClear = () => {}, icon = null } = {}) {
  const m = approachModel(crag);
  if (!m) return null;
  const pic = (name) => (icon ? icon(name) : null);
  const len = m.stops.length;
  let cur = 0;
  let st = saveState?.(crag.name) ?? null;
  let busy = false;

  const chipBox = el('span', { class: 'ap-chipbox', 'aria-live': 'polite' });
  const fill = el('span', { class: 'ap-fill', 'aria-hidden': 'true' });
  const dots = m.stops.map((s, i) => {
    const b = el('button', { type: 'button', class: 'ap-stop', 'aria-label': Number.isFinite(s.min) && s.type !== 'park' ? `${s.label} ${s.min}분` : s.label },
      el('span', { class: 'ap-dot' }, s.type === 'fork' ? String(s.n) : s.type === 'park' ? 'P' : (pic('route') ?? '끝')),
      el('span', { class: 'ap-min', 'aria-hidden': 'true' }, s.type === 'park' ? '출발' : Number.isFinite(s.min) ? `${s.min}분` : ''));
    b.style.setProperty('--x', `${s.pos * 100}%`);
    b.addEventListener('click', () => go(i));
    return b;
  });
  const strip = el('div', { class: 'ap-strip', role: 'group', 'aria-label': '길 띠' }, el('span', { class: 'ap-line', 'aria-hidden': 'true' }), fill, ...dots);
  const where = el('p', { class: 'ap-where', 'aria-live': 'polite' });
  const view = el('div', { class: 'ap-view' });
  const dir = el('div', { class: 'ap-dir' });
  const wrong = el('p', { class: 'ap-wrong' });
  const prev = el('button', { type: 'button', class: 'ap-prev' }, '‹ 이전');
  const next = el('button', { type: 'button', class: 'ap-next' }, '다음 ›');
  prev.addEventListener('click', () => go(stepTo(cur, -1, len)));
  next.addEventListener('click', () => go(stepTo(cur, 1, len)));
  const clear = el('button', { type: 'button', class: 'ap-clear' }, '기기에서 사진 지우기');
  clear.addEventListener('click', () => onClear());

  // 사진: 왼쪽·오른쪽 절반을 누르면 이전·다음, 가로로 밀어도 같다 (버튼 이전/다음이 키보드 길이다)
  let downX = null, swiped = false;
  view.addEventListener('pointerdown', (e) => { downX = e.clientX; swiped = false; });
  view.addEventListener('pointercancel', () => { downX = null; });
  view.addEventListener('pointerup', (e) => {
    if (downX === null) return;
    const dx = e.clientX - downX;
    downX = null;
    if (Math.abs(dx) >= SWIPE_PX) { swiped = true; go(stepTo(cur, dx < 0 ? 1 : -1, len)); }
  });
  view.addEventListener('click', (e) => {
    if (swiped || !view.querySelector('img')) return;
    const r = view.getBoundingClientRect();
    go(stepTo(cur, e.clientX - r.left < r.width / 2 ? -1 : 1, len));
  });

  function paintChip() {
    const c = chipOf(st, busy);
    const had = chipBox.contains(document.activeElement) || document.activeElement === clear; // the pressed chip (or 지우기) goes: the focus moves to the new chip
    clear.hidden = !(st?.saved > 0) || busy;
    if (!c) return chipBox.replaceChildren();
    const g = c.glyph ? pic(c.glyph) : null; // no icon (tests, old callers): the words
    const kids = g ? [g, c.text] : [c.text]; // the icon with its words: an icon alone says nothing
    const attrs = { class: `ap-chip is-${c.kind}` };
    const chip = c.kind === 'no' || c.kind === 'fail'
      ? el('button', { type: 'button', ...attrs }, ...kids) // 못 받은 사진이 있으면 다시 누를 수 있다
      : el('span', { ...attrs, tabindex: '-1' }, ...kids);
    if (chip.tagName === 'BUTTON') chip.addEventListener('click', () => { busy = true; paintChip(); onSave(crag.name); });
    chipBox.replaceChildren(chip);
    if (had && (clear.hidden || document.activeElement !== clear)) chip.focus();
  }

  function failBox() {
    const savedAll = st && st.total && st.saved >= st.total;
    return el('div', { class: 'ap-fail' }, el('b', {}, '사진을 못 불러왔어요'),
      el('span', {}, '아래 글로 계속 갈 수 있어요.'), savedAll ? null : el('span', {}, '집에서 저장해 두면 산에서도 보여요.'));
  }

  function showPhoto(s) { // 사진이 있는 정지점(분기·주차)은 모두 이 길로 그린다
    const img = el('img', { src: photoUrl(s.photo), alt: `${s.label} 사진`, decoding: 'async', draggable: 'false' });
    img.addEventListener('error', () => { if (!view.contains(img)) return; view.className = 'ap-view is-fail'; view.replaceChildren(failBox()); }); // 사진을 못 불러왔어요: 글·띠·방향은 그대로
    view.className = 'ap-view is-photo';
    view.replaceChildren(img);
  }

  const lotNames = [...(crag.parking?.onsite ?? []), ...(crag.parking?.nearby ?? [])];
  // the card no longer lists the lots or the free-text approach (crag.approach): the first stop holds them
  const lots = [lotNames.length && el('p', { class: 'ap-sub' }, `주차장 ${lotNames.join(', ')}`), crag.approach && el('p', { class: 'ap-sub ap-text' }, crag.approach)].filter(Boolean);

  function paint() {
    const s = m.stops[cur];
    fill.style.setProperty('--x', `${s.pos * 100}%`);
    dots.forEach((b, i) => {
      b.className = `ap-stop is-${m.stops[i].type} ${i === cur ? 'is-cur' : i < cur ? 'is-done' : 'is-todo'}`;
      if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    where.textContent = `${s.label}${s.type === 'fork' && Number.isFinite(s.min) ? ` · ${s.min}분` : ''} (${cur + 1}/${len})`;
    dir.className = 'ap-dir';
    wrong.hidden = !s.wrong;
    wrong.replaceChildren(el('b', {}, '이쪽은 아니에요'), s.wrong ? ` · ${s.wrong}` : '');
    if (s.type === 'park' && s.photo) { // 주차 사진: 칩·글은 방향 줄에, 사진은 기존 사진 칸에
      dir.hidden = false;
      dir.replaceChildren(el('b', { class: `pk-word ${m.park.tone}` }, m.park.chip), ...(m.park.line ? [el('b', {}, m.park.line)] : []), ...lots);
      showPhoto(s);
    } else if (s.type === 'park') {
      view.className = 'ap-view is-text';
      view.replaceChildren(el('b', { class: `pk-word ${m.park.tone}` }, m.park.chip), ...(m.park.line ? [el('p', { class: 'ap-big' }, m.park.line)] : []), ...lots); // replaceChildren writes null as text
      dir.hidden = true;
    } else if (s.type === 'end') {
      view.className = 'ap-view is-text';
      view.replaceChildren(el('p', { class: 'ap-big' }, '암장 도착'), ...(Number.isFinite(m.totalMin) ? [el('p', { class: 'ap-sub' }, `주차에서 걸어서 ${m.totalMin}분`)] : []));
      dir.hidden = true;
    } else {
      dir.hidden = false;
      const word = s.turn ? TURN_WORD[s.turn] : null;
      const turn = word && icon ? el('span', { class: 'ap-arrow', role: 'img', 'aria-label': word }, pic(`turn-${s.turn}`)) : null;
      dir.replaceChildren(...(turn ? [turn] : []), el('b', {}, s.text || word || s.label)); // the arrow says the turn; the words alone when there is no text
      if (s.photo) {
        showPhoto(s);
      } else { // 사진 없는 단계: 글만 크게
        view.className = 'ap-view';
        view.replaceChildren();
        dir.className = 'ap-dir is-big';
      }
    }
    view.hidden = !view.children.length;
    const held = document.activeElement;
    prev.disabled = cur === 0;
    next.disabled = cur === len - 1;
    if (held === next && next.disabled) prev.focus(); // a disabled button drops the focus: keep it on the other one
    if (held === prev && prev.disabled) next.focus();
  }

  function go(i) {
    cur = i;
    paint();
  }

  // the save chip sits at the end of the step caption (.ap-cap): no line of its own
  const node = el('div', { class: 'approach-pane' }, strip,
    el('div', { class: 'ap-cap' }, where, chipBox), view, dir, wrong, el('div', { class: 'ap-nav' }, prev, next), clear);
  // ←/→ step only inside the pane: on the tab bar the same keys move between tabs (src/wall-sheet.js)
  node.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (d && !e.target.closest?.('input, textarea')) { e.preventDefault(); go(stepTo(cur, d, len)); }
  });
  paintChip();
  paint();
  return {
    node,
    setSaved(next) { st = next === undefined ? (saveState?.(crag.name) ?? st) : next; busy = false; paintChip(); },
  };
}
