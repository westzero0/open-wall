// src/planner-detail.js — the v3 detail screen of one plan: date + title + `분야 · 지역`, icon cells, sun card, 동행, alternatives (hard days),
// actions. Words/flags come from plan-view.js; handlers from planner.js (h.savePlan / removePlan / onEdit / onCard). No fetch, no storage here.
import { html, useState, useEffect, useRef } from './planner-ui.js';
import { alternatives, rockAlternatives } from './plan-alt.js';
import { rest, changePlace } from './plan-actions.js';
import { crowdHint } from './plan-crowd.js';
import { dayParts, homeCells, placeLine, altRow, rockRow, cellsQuiet } from './plan-view.js';
import { Icon, DisciplineIcon } from './planner-icons.js';
import { openLabel } from './plan-wall.js';
import { Cells } from './planner-cells.js';
import { SunCard } from './planner-sun.js';
import { LinkButton, Note } from './planner-parts.js';
import { wallPageId } from './share-id.js';
import { toggleReserved } from './reserve.js';
import { findIce } from './plan-ice-sheet.js';
import { ICE_FLAG_TEXT, iceDetail } from './plan-ice.js';
import { rainMapOn } from './config.js';
import { RainMapSheet } from './planner-rain-map.js';

/** 예약: the line (reserve.js reserveCopy), the 확인일, the booking link and the 예약했어요 check. r = rowView's `reserve` (null = nothing). */
function ReserveNote({ plan, r, h }) {
  if (!r) return null;
  const label = `${r.name ?? '예약 사이트'} ↗`; // the 외벽 card's band says the same (card-parts reserveBand); names already read "…예약"
  return html`<section class="rsv" aria-labelledby="rsv-h"><h3 id="rsv-h" class="lbl">예약</h3>
    ${r.line && html`<p class=${'rsv-line' + (r.state === 'late' ? ' late' : '')}>${r.line}</p>`}
    ${r.checked && html`<${Note} class="rsv-at n">${r.checked}<//>`}
    <div class="rsv-acts">
      <${LinkButton} href=${r.url} external aria-label=${`${r.name ?? '예약 사이트'} (새 창)`}>${label}<//>
      <label class="ck"><input type="checkbox" checked=${r.reserved} onChange=${(e) => h.savePlan(toggleReserved(plan, e.target.checked))} />예약했어요</label>
    </div></section>`;
}

const ALT_WHY = '가까운 실내와 비 예보 없는 야외예요';

// Hook-free body so a test can read the vnode; Alternatives below holds the open state of the 전국 비 예보 sheet.
export function AlternativesView({ plan, v, s, now, h, rainOpen = false, onRainOpen = () => {} }) {
  const { picks } = alternatives(plan, v.resolved, { walls: s.walls, wx: s.wx, now });
  const rocks = rockAlternatives(plan, v.resolved, { crags: s.crags, wx: s.wx, now }).picks.map((pick) => rockRow(pick, v.resolved)); // D1: crag plans only
  const rainBtn = rainMapOn() && v.resolved.kind === 'crag'; // D3b: crag plans only, and only while config.rainMap is on
  if (!picks.length && !rocks.length && !rainBtn) return null;
  const ctx = { planId: plan.id, date: plan.date, min: plan.min };
  const row = (a, name) => html`<li class="alt" key=${a.key}>
      <${DisciplineIcon} kind=${a.symbol} cls="sy" />
      <div class="ab"><b>${name}</b>${a.sub && html`<em>${a.sub}</em>`}</div>
      <button type="button" class="p-link" aria-label=${`${a.name} 이곳으로 바꾸기`} onClick=${() => h.savePlan(changePlace(plan, a.place, a.placeName))}>바꾸기</button>
    </li>`;
  return html`<section class="alts" aria-labelledby="alt-h"><h3 id="alt-h" class="lbl">대신 이렇게 해볼까요</h3>${(picks.length > 0 || rocks.length > 0) && html`<p class="why">${ALT_WHY}</p>`}
    ${picks.length > 0 && html`<ul>${picks.map((pick) => { const a = altRow(pick, v.resolved); return row(a, html`<${LinkButton} onClick=${() => h.openWall(a.key, { from: 'alt', ...ctx })}>${a.name}<//>`); })}</ul>`}
    ${rocks.length > 0 && html`<h4 class="lbl alt-rock">다른 바위</h4><ul>${rocks.map((a) => row(a, a.name))}</ul>`}
    ${rainBtn && html`<button type="button" class="p-link rm-open" onClick=${() => onRainOpen(true)}>전국 비 예보 보기</button>`}
    ${rainBtn && rainOpen && html`<${RainMapSheet} plan=${plan} v=${v} s=${s} now=${now} h=${h} onClose=${() => onRainOpen(false)} />`}</section>`;
}

function Alternatives(props) {
  const [rainOpen, setRainOpen] = useState(false);
  return AlternativesView({ ...props, rainOpen, onRainOpen: setRainOpen });
}

/** props: plan, v (rowView), s, now, h, onBack, onAnswer(plan, 'went'|'missed') → true when saved, renderRecordExtra (the record fields, opened in place) */
// The 어디 row's opener: wall / waterfall / natural crag sheet, or null (mountain).
export function placeOpener(v, plan, h) {
  const r = v.resolved;
  const ctx = { from: 'detail', planId: plan.id, date: plan.date, min: plan.min };
  if (r.kind === 'wall' && r.wall) return () => h.openWall(wallPageId(r.wall), ctx);
  if (r.kind === 'ice' && findIce([r.ice], wallPageId(r.ice ?? {}))) return () => h.openWall(wallPageId(r.ice), { from: 'detail', planId: plan.id, date: plan.date }); // a waterfall opens the 빙벽장 sheet (the mountain does not)
  if (r.kind === 'crag' && r.crag) return () => h.openWall(wallPageId(r.crag), ctx);
  return null;
}

export function DetailView({ plan, v, s, now, h, onBack, onAnswer, renderRecordExtra }) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const [armed, setArmed] = useState(false); // delete needs a second press; no modal
  const [recKind, setRecKind] = useState(null); // 'went' | 'missed' while the record fields are open right here (no jump to home)
  const answer = (kind) => { if (onAnswer(plan, kind)) setRecKind(kind); };
  // `‹ 일정` lives in the header (index.html #hd-back) in place of the date: show it while a detail is open, focus it on entry
  useEffect(() => {
    const b = document.getElementById('hd-back'), t = document.getElementById('today');
    const go = () => onBackRef.current();
    if (b) { b.hidden = false; b.addEventListener("click", go); b.focus(); }
    if (t) t.hidden = true;
    window.scrollTo?.(0, 0);
    return () => { if (b) { b.hidden = true; b.removeEventListener("click", go); } if (t) t.hidden = false; };
  }, []);
  const p = dayParts(plan.date);
  const line = placeLine(v.resolved);
  const cells = v.live && v.resolved.kind !== 'ice' ? homeCells(v.resolved, plan, s, { now }) : null; // 빙벽: no hourly sky/wind/crowd cells, the 결빙 조건 block speaks instead
  const quiet = cells ? cellsQuiet(cells) : null;
  const place = v.resolved.wall ?? v.resolved.crag;
  const crowd = v.live && v.resolved.kind === 'wall' ? crowdHint(s.crowd ?? [], v.resolved, plan, new Date(now)) : null;
  const facts = [v.changed && ['장소', v.changed], plan.record?.memo && ['메모', plan.record.memo]].filter(Boolean);
  const openNote = v.live && v.resolved.kind === 'wall' && v.resolved.wall ? openLabel(v.resolved.wall, plan.date, Number.isInteger(plan.min) ? plan.min : null) : '';
  const shut = /닫힘|쉼|휴관/.test(openNote) ? openNote : ''; // 그 시간 닫힘·그날 쉼·임시 휴관만 말한다(열림은 말하지 않음)
  const [kind0, ...rest] = (line || '').split(' · ');
  const [mainWord, ...subWords] = rest.length > 0 ? [rest.join(' · '), kind0] : [kind0]; // 어디 = 곳: 지역을 굵게, 종류는 뒤에 작게
  const iceSheet = v.resolved.kind === 'ice' && findIce([v.resolved.ice], wallPageId(v.resolved.ice ?? {})) ? () => h.openWall(wallPageId(v.resolved.ice), { from: 'detail', planId: plan.id, date: plan.date }) : null; // a waterfall opens the 빙벽장 sheet (the mountain does not)
  const openAny = placeOpener(v, plan, h);
  const iceFacts = iceDetail(v.ice);
  const phrase = iceFacts ? '' : (v.level !== 'ok' || cells?.weather.dim || !v.live) && v.phrase !== cells?.weather.label ? v.phrase : ''; // not twice when the weather cell already says it (실내) or the 결빙 조건 block lists it (빙벽)
  const toAnswer = v.past && !v.recorded && !v.rest && onAnswer;
  return html`<section class="dv" key="detail">
    <header class="dh">
      <h2><${DisciplineIcon} kind=${v.symbol} cls="sy" /><span>${v.title}</span></h2>
      <dl class="kv">
        <div><dt>언제</dt><dd><b class="n">${plan.date === s.today ? '오늘' : `${p.dow}요일`}${v.time ? ` ${v.time}` : ''}</b><span class="n">${p.month}월 ${p.d}일</span>${shut && html`<span class="op-no">${shut}</span>`}</dd></div>
        ${line && html`<div><dt>어디</dt><dd>${openAny
          ? html`<button type="button" class="kv-go" aria-label=${`${v.title} ${iceSheet ? '빙벽장' : '암장'} 정보`} onClick=${openAny}><b>${mainWord}</b>${subWords.length > 0 && html`<span>${subWords.join(' · ')}</span>`}<${Icon} name="next" /></button>`
          : html`<b>${mainWord}</b>${subWords.length > 0 && html`<span>${subWords.join(' · ')}</span>`}`}</dd></div>`}
      </dl>
      ${phrase && html`<p class=${'wx n ' + (v.level === 'caution' || v.level === 'hard' ? v.level : '')}>${phrase}</p>`}
      ${v.flag && html`<p class="ice-flag">${ICE_FLAG_TEXT}</p>`}
    </header>
    <${ReserveNote} plan=${plan} r=${v.reserve} h=${h} />
    ${iceFacts && html`<section class="ice-facts" aria-labelledby="ice-h"><h3 id="ice-h" class="lbl">결빙 조건</h3>
      <p class="wx n">${iceFacts.period}</p>
      ${iceFacts.rows.length > 0 && html`<dl class="facts">${iceFacts.rows.map((r, i) => html`<dt key=${'k' + i}>${r.k}</dt><dd key=${'v' + i} class="n">${r.v}${r.note && html`<small>${r.note}</small>`}</dd>`)}</dl>`}
      ${iceFacts.trend && html`<p class="wx n"><b>일 최저</b> ${iceFacts.trend}</p>`}
      <p class="wx">${iceFacts.closing}</p>
      ${iceSheet && html`<${LinkButton} onClick=${iceSheet}>기온 그래프 보기 ›<//>`}
    </section>`}
    ${cells && (quiet ? !phrase && html`<${Note} ruled class="n">${quiet}<//>` : html`<${Cells} c=${cells} />`)}
    ${crowd && html`<${Note} ruled class="n">${crowd}<//>`}
    ${v.live && place && html`<${SunCard} key=${plan.id} place=${place} resolved=${v.resolved} plan=${plan} s=${s} now=${now} kind=${v.symbol} />`}
    ${v.who.length > 0 && html`<section class="people" aria-labelledby="pp-h"><h3 id="pp-h" class="lbl">동행</h3>
      <ul>${v.who.map((n, i) => html`<li key=${i}><span class="av" aria-hidden="true">${[...n][0]}</span><b>${n}</b></li>`)}</ul></section>`}
    ${facts.length > 0 && html`<dl class="facts">${facts.map(([k, val]) => html`<dt key=${'k' + k}>${k}</dt><dd key=${'v' + k} class=${k === '메모' ? 'memo' : ''}>${val}</dd>`)}</dl>`}
    ${v.atRisk && html`<${Alternatives} plan=${plan} v=${v} s=${s} now=${now} h=${h} />`}
    ${(toAnswer || recKind) && onAnswer && html`<section class="rec-here"><h3 class="lbl">기록하기</h3>
      <div class="row2"><button type="button" class="btn p" aria-pressed=${recKind === 'went' ? 'true' : 'false'} onClick=${() => answer('went')}>다녀왔어요</button><button type="button" class="btn" aria-pressed=${recKind === 'missed' ? 'true' : 'false'} onClick=${() => answer('missed')}>못 갔어요</button></div>
      ${recKind && renderRecordExtra && renderRecordExtra(plan, { kind: recKind, resolved: v.resolved, done: () => setRecKind(null) })}</section>`}
    <div class="dacts">
      ${v.atRisk && html`<button type="button" class="btn full" onClick=${() => h.savePlan(rest(plan))}>이날은 쉬기</button>`}
      ${v.live && !v.atRisk && html`<button type="button" class="btn p full" onClick=${() => h.onCard(plan.id)}>약속 카드 공유</button>`}
      <div class="acts">
        ${v.live && v.atRisk && html`<button type="button" class="txt" onClick=${() => h.onCard(plan.id)}>약속 카드 공유</button>`}
        ${v.recorded && onAnswer && !recKind && html`<button type="button" class="txt" onClick=${() => setRecKind(plan.status === '갔다' ? 'went' : 'missed')}>기록 고치기</button>`}
        <button type="button" class="txt" onClick=${() => h.onEdit(plan.id)}>${v.rest ? '다시 일정 잡기' : '일정 고치기'}</button>
        <button type="button" class=${'txt del' + (armed ? '' : ' weak')} onBlur=${() => setArmed(false)} onClick=${() => (armed ? h.removePlan(plan.id) : setArmed(true))}>${armed ? '한 번 더 누르면 지워요' : '삭제'}</button>
      </div>
    </div>
  </section>`;
}
