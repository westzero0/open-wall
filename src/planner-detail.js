// src/planner-detail.js — the v3 detail screen of one plan: date + title + `분야 · 지역`, icon cells, sun card, 동행, alternatives (hard days),
// actions. Words/flags come from plan-view.js; handlers from planner.js (h.savePlan / removePlan / onEdit / onCard). No fetch, no storage here.
import { html, useState, useEffect, useRef } from './planner-ui.js';
import { alternatives } from './plan-alt.js';
import { rest, changePlace } from './plan-actions.js';
import { crowdHint } from './plan-crowd.js';
import { dayParts, homeCells, placeLine, altRow, cellsQuiet } from './plan-view.js';
import { DisciplineIcon } from './planner-icons.js';
import { Cells } from './planner-cells.js';
import { SunCard } from './planner-sun.js';

const ALT_WHY = '같은 날 비 예보가 없는 곳 중, 원래 장소와 가까운 순으로 보여 드려요';

function Alternatives({ plan, v, s, now, h }) {
  const { picks } = alternatives(plan, v.resolved, { walls: s.walls, wx: s.wx, now });
  if (!picks.length) return null;
  return html`<section class="alts" aria-labelledby="alt-h"><h3 id="alt-h" class="lbl">대신 이렇게 해볼까요</h3><p class="why">${ALT_WHY}</p>
    <ul>${picks.map((pick) => { const a = altRow(pick, v.resolved); return html`<li class="alt" key=${a.key}>
      <${DisciplineIcon} kind=${a.symbol} cls="sy" />
      <div class="ab"><b>${a.name}</b>${a.sub && html`<em>${a.sub}</em>`}</div>
      <button type="button" class="btn" onClick=${() => h.savePlan(changePlace(plan, a.place, a.placeName))}>이곳으로 바꾸기</button>
    </li>`; })}</ul></section>`;
}

/** props: plan, v (rowView), s, now, h, onBack, onRecord(plan) (reopen a record), onAnswer(plan, 'went'|'missed') (record a past plan right here) */
export function DetailView({ plan, v, s, now, h, onBack, onRecord, onAnswer }) {
  const back = useRef(null);
  const [armed, setArmed] = useState(false); // delete needs a second press; no modal
  useEffect(() => { back.current?.focus(); window.scrollTo?.(0, 0); }, []);
  const p = dayParts(plan.date);
  const line = placeLine(v.resolved);
  const cells = v.live ? homeCells(v.resolved, plan, s, { now }) : null;
  const quiet = cells ? cellsQuiet(cells) : null;
  const place = v.resolved.wall ?? v.resolved.crag;
  const crowd = v.live && v.resolved.kind === 'wall' ? crowdHint(s.crowd ?? [], v.resolved, plan, new Date(now)) : null;
  const facts = [v.changed && ['장소', v.changed], plan.record?.memo && ['메모', plan.record.memo]].filter(Boolean);
  const phrase = (v.level !== 'ok' || cells?.weather.dim || !v.live) && v.phrase !== cells?.weather.label ? v.phrase : ''; // not twice when the weather cell already says it (실내)
  const toAnswer = v.past && !v.recorded && !v.rest && onAnswer;
  return html`<section class="dv" key="detail">
    <button type="button" class="txt back" ref=${back} onClick=${onBack}>‹ 일정</button>
    <header class="dh">
      <div class="k">${plan.date === s.today ? '오늘' : `${p.month}월`}</div>
      <div class="dd n">${p.d}<small>${p.dow}${v.time ? ` · ${v.time}` : ''}</small></div>
      <h2><${DisciplineIcon} kind=${v.symbol} cls="sy" />${v.title}</h2>
      ${line && html`<p class="pl">${line}</p>`}
      ${phrase && html`<p class=${'wx n ' + (v.level === 'caution' || v.level === 'hard' ? v.level : '')}>${phrase}</p>`}
    </header>
    ${cells && (quiet ? html`<p class="quiet n">${quiet}</p>` : html`<${Cells} c=${cells} />`)}
    ${crowd && html`<p class="hint n">${crowd}</p>`}
    ${v.live && place && html`<${SunCard} key=${plan.id} place=${place} resolved=${v.resolved} plan=${plan} s=${s} now=${now} kind=${v.symbol} />`}
    ${v.who.length > 0 && html`<section class="people" aria-labelledby="pp-h"><h3 id="pp-h" class="lbl">동행</h3>
      <ul>${v.who.map((n, i) => html`<li key=${i}><span class="av" aria-hidden="true">${[...n][0]}</span><b>${n}</b></li>`)}</ul></section>`}
    ${facts.length > 0 && html`<dl class="facts">${facts.map(([k, val]) => html`<dt key=${'k' + k}>${k}</dt><dd key=${'v' + k} class=${k === '메모' ? 'memo' : ''}>${val}</dd>`)}</dl>`}
    ${v.atRisk && html`<${Alternatives} plan=${plan} v=${v} s=${s} now=${now} h=${h} />`}
    ${toAnswer && html`<section class="rec-here"><h3 class="lbl">기록하기</h3>
      <div class="row2"><button type="button" class="btn p" onClick=${() => onAnswer(plan, 'went')}>갔다</button><button type="button" class="btn" onClick=${() => onAnswer(plan, 'missed')}>못 갔다</button></div></section>`}
    <div class="dacts">
      ${v.atRisk && html`<button type="button" class="btn full" onClick=${() => h.savePlan(rest(plan))}>이날은 쉬기</button>`}
      ${v.live && !v.atRisk && html`<button type="button" class="btn p full" onClick=${() => h.onCard(plan.id)}>약속 카드 보내기</button>`}
      <div class="acts">
        ${v.live && v.atRisk && html`<button type="button" class="txt" onClick=${() => h.onCard(plan.id)}>약속 카드 보내기</button>`}
        ${v.recorded && onRecord && html`<button type="button" class="txt" onClick=${() => onRecord(plan)}>기록 고치기</button>`}
        <button type="button" class="txt" onClick=${() => h.onEdit(plan.id)}>${v.rest ? '다시 일정 잡기' : '편집'}</button>
        <button type="button" class="txt del" onBlur=${() => setArmed(false)} onClick=${() => (armed ? h.removePlan(plan.id) : setArmed(true))}>${armed ? '한 번 더 누르면 지워요' : '삭제'}</button>
      </div>
    </div>
  </section>`;
}
