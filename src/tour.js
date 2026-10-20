// 첫 방문 투어: 화면을 어둡게 하고 설명할 곳만 뚫어 보여 준다 (구멍 = box-shadow 가 달린 div, 위치는 타깃의 사각형).
import { el } from './dom.js';
import { TOUR_STEPS, pickSteps } from './tour-steps.js';

const GAP = 6; // 구멍이 타깃보다 사방으로 더 큰 만큼
const EDGE = 16;

// 첫 번째 '보이는' 일치: 접힌 그룹 안의 같은 선택자(예: 닫힌 details 의 막대)는 건너뛴다
const find = (sel) => {
  try { // 선택자를 모르는 브라우저(:has 등)는 그 단계만 건너뛴다
    return [...document.querySelectorAll(sel)].find((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
  } catch { return null; }
};
const visible = (sel) => find(sel) !== null;

/** startTour({ onClose }) → boolean: false (and nothing opens) when no step has a visible target.
 *  onClose({ completed }) runs once however the tour ends; completed = 마지막 단계에서 끝내기를 눌렀다. */
export const startTour = ({ onClose = () => {} } = {}) => {
  const steps = pickSteps(TOUR_STEPS, visible);
  if (!steps.length) return false;
  const from = document.activeElement;
  let i = 0;
  let completed = false;

  const num = el('span', { class: 'tour-num', 'aria-hidden': 'true' });
  const title = el('h2', { id: 'tour-title' });
  const body = el('p');
  const txt = el('div', { class: 'tour-txt', 'aria-live': 'polite' }, title, body); // 단계가 바뀌면 제목·본문을 읽어 준다
  const count = el('span', { class: 'sr-only' });
  const dots = el('span', { class: 'tour-dots', 'aria-hidden': 'true' }, ...steps.map(() => el('i')));
  const prev = el('button', { type: 'button', class: 'tour-btn' }, '이전');
  const next = el('button', { type: 'button', class: 'tour-btn primary' });
  const skip = el('button', { type: 'button', class: 'tour-skip' }, '건너뛰기');
  const hole = el('div', { class: 'tour-hole', 'aria-hidden': 'true' });
  const arrow = el('span', { class: 'tour-arrow', 'aria-hidden': 'true' });
  const tip = el('div', { class: 'tour-tip' }, arrow, el('div', { class: 'tour-top' }, num, skip), txt, el('div', { class: 'tour-foot' }, dots, count, el('span', { class: 'tour-nav' }, prev, next)));
  const dlg = el('dialog', { class: 'tour', 'aria-labelledby': 'tour-title' }, hole, tip);

  let last = ''; // 마지막으로 그린 타깃 사각형: 같으면 다시 그리지 않는다
  let settle = 0; // 단계를 옮긴 직후(이 시각까지)에만 구멍이 미끄러진다. 스크롤·리렌더를 따라갈 때는 즉시 붙는다
  const place = () => {
    const target = find(steps[i].target);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const key = `${i}|${r.left}|${r.top}|${r.width}|${r.height}|${innerWidth}|${innerHeight}`;
    if (key === last) return;
    last = key;
    dlg.classList.toggle('follow', performance.now() > settle);
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    Object.assign(hole.style, { left: `${r.left - GAP}px`, top: `${r.top - GAP}px`, width: `${r.width + GAP * 2}px`, height: `${r.height + GAP * 2}px` });
    const t = tip.getBoundingClientRect();
    const below = r.bottom + GAP + 12;
    const top = below + t.height <= vh - EDGE ? below : Math.max(EDGE, r.top - GAP - 12 - t.height);
    const left = Math.min(Math.max(EDGE, r.left), Math.max(EDGE, vw - t.width - EDGE));
    Object.assign(tip.style, { left: `${left}px`, top: `${top}px` });
    tip.dataset.side = top >= below ? 'below' : 'above'; // which side of the hole the card sits: the arrow points back at it
    tip.style.setProperty('--ax', `${Math.min(Math.max(22, r.left + r.width / 2 - left), t.width - 22)}px`);
  };

  const go = (n) => {
    i = n;
    const s = steps[i];
    title.textContent = s.title;
    body.textContent = s.body;
    num.textContent = String(i + 1).padStart(2, '0');
    count.textContent = `${i + 1}/${steps.length}`;
    dots.childNodes.forEach((d, k) => d.classList.toggle('on', k <= i));
    txt.classList.remove('swap'); void txt.offsetWidth; txt.classList.add('swap'); // the words fade in again on every step
    next.textContent = i === steps.length - 1 ? '끝내기' : '다음';
    if (i === 0 && document.activeElement === prev) next.focus(); // 숨기기 전에 포커스를 옮겨야 ←/→가 이어진다
    prev.hidden = i === 0;
    settle = performance.now() + 450;
    last = '';
    find(s.target)?.scrollIntoView({ block: 'center', behavior: 'instant' });
    place();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowRight' && i < steps.length - 1) go(i + 1);
    else if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
  };
  const onResize = () => place();
  let raf = 0;
  const follow = () => { place(); raf = requestAnimationFrame(follow); }; // 뒤 페이지가 스크롤되거나 목록이 다시 그려져도 구멍이 타깃을 따라간다

  next.addEventListener('click', () => { if (i < steps.length - 1) go(i + 1); else { completed = true; dlg.close(); } });
  prev.addEventListener('click', () => go(i - 1));
  skip.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { // 어두운 배경만 닫는다: 밝은 구멍은 설명만 하므로 눌러도 닫지 않는다
    const h = hole.getBoundingClientRect();
    const inHole = e.clientX >= h.left && e.clientX <= h.right && e.clientY >= h.top && e.clientY <= h.bottom;
    if (e.target === dlg && !inHole) dlg.close();
  });
  dlg.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  dlg.addEventListener('close', () => {
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(raf);
    dlg.remove();
    (from && from !== document.body && from.isConnected ? from : document.getElementById('tab-list'))?.focus();
    onClose({ completed });
  });

  document.body.append(dlg);
  dlg.showModal();
  go(0);
  next.focus();
  raf = requestAnimationFrame(follow);
  return true;
};
