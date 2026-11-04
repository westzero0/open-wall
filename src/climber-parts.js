// src/climber-parts.js — 내 클라이밍: the level card for the 기록 tab. Takes climberStats(log) and returns one element; it knows no storage and no network.
// Same look as the 내 활동 card (lg-track / lg-fill), so no new tokens.
import { el } from './dom.js';
import { gradeLabel } from './grades.js';

// "5.11b", "5.9", "5.8 이하", "V5": how a top grade reads
const topText = (key, g) => (key === 'boulder' || gradeLabel(g) !== g ? gradeLabel(g) : `5.${g}`);

function meter(info, aria) {
  const fill = el('div', { class: 'lg-fill' });
  fill.style.width = `${info.frac * 100}%`;
  return el('div', { class: 'lg-track', role: 'progressbar', 'aria-label': aria, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(info.frac * 100)) }, fill);
}

/** climberCard(stats) → <section class="lg-clm">: the total level and its bar, then a row per discipline (level, top grade, bar). */
export function climberCard({ total, disciplines }) {
  return el('section', { class: 'lg-clm', 'aria-label': '내 클라이밍' },
    el('div', { class: 'lg-clm-hd' },
      el('b', { class: 'lg-clm-lv' }, `Lv ${total.level}`),
      el('span', { class: 'lg-clm-say' }, `다음 레벨까지 ${total.need} XP`)),
    meter(total, '다음 레벨까지'),
    el('ul', { class: 'lg-clm-list' }, ...disciplines.map((d) => el('li', { class: `lg-clm-row${d.xp ? '' : ' zero'}` },
      el('p', {}, el('span', {}, d.name), el('span', {}, `Lv ${d.level}${d.top ? ` · 최고 ${topText(d.key, d.top)}` : ''}`)),
      meter(d, `${d.name} 다음 레벨까지`)))));
}
