// src/planner-home.js — the v3 home: week strip, today hero (date, place, weather/wind/crowd cells, sun line), upcoming rows, 기록하기 (oldest one),
// `지난 일정 보기 ›`. A row opens the plan's detail (store.detailId); until batch E draws the detail screen it shows RowDetail. Words/flags come from plan-view.js.
// Hook points: `renderRecordExtra(plan, { kind: 'went'|'missed', resolved, done })` (record fields) and handlers.onAdd/onEdit/onCard.
import { html, useState, useEffect, usePlannerState } from './planner-ui.js';
import { buildTimeline } from './plan-timeline.js';
import { markWent, markMissed } from './plan-actions.js';
import { rowView, verdictOf, pastBlocks, dayParts, homeCells, sunNow, weekStrip, nextPlanText } from './plan-view.js';
import { Row } from './planner-row.js';
import { Cells } from './planner-cells.js';
import { DetailView } from './planner-detail.js';
import { Icon, DisciplineIcon } from './planner-icons.js';

const PEAKS = 'assets/planner-peaks.svg';
const byTime = (a, b) => a.date.localeCompare(b.date) || (Number.isInteger(a.min) ? a.min : 1e9) - (Number.isInteger(b.min) ? b.min : 1e9);

function RecordItem({ plan, v, kind, extra, onAnswer, onLater }) {
  const p = dayParts(plan.date);
  const meta = [`${p.md}(${p.dow})${v.time ? ' ' + v.time : ''}`, v.resolved.kind === 'crag' ? '자연암장' : null].filter(Boolean).join(' · ');
  return html`<div class="ri">
    <h3>${p.month}월 ${p.day}일 ${v.title}, 다녀오셨나요?</h3>
    <p class="n">${meta}</p>
    <div class="row2">
      <button type="button" class="btn p" aria-pressed=${kind === 'went' ? 'true' : 'false'} onClick=${() => onAnswer('went')}>갔다</button>
      <button type="button" class="btn" aria-pressed=${kind === 'missed' ? 'true' : 'false'} onClick=${() => onAnswer('missed')}>못 갔다</button>
    </div>
    <div class="later"><button type="button" class="txt weak" onClick=${onLater}>나중에 할게요</button></div>
    ${extra}
  </div>`;
}

function Strip({ days }) {
  return html`<ol class="strip">${days.map((d) => html`<li key=${d.date} class=${'dy' + (d.today ? ' t' : '')}
    aria-label=${`${d.month}월 ${d.d}일 ${d.dow}요일${d.today ? ', 오늘' : ''}${d.count ? `, 일정 ${d.count}개` : ''}${d.hard ? ', 어려움' : ''}`}>
    <span aria-hidden="true">${d.dow}<i>${d.d}</i><u class=${d.hard ? 'hard' : d.count ? 'has' : ''}></u></span></li>`)}</ol>`;
}

function Hero({ plan, v, s, now, onOpen }) {
  const p = dayParts(plan.date);
  const c = homeCells(v.resolved, plan, s, { now });
  const sun = v.live ? sunNow(v.resolved, { now }) : null;
  const verdict = verdictOf(v.risk.level);
  const aria = `${verdict ? verdict + '. ' : ''}${v.aria}`;
  return html`<section class="hero" key="hero">
      <div class="hero-t">
        <div class="k">오늘</div>
        <div class="big n" aria-hidden="true">${p.d}<small>${p.dow}</small></div>
        <h2><button type="button" class="hl" data-row=${plan.id} aria-label=${aria} onClick=${() => onOpen(plan.id)}>
          <${DisciplineIcon} kind=${v.symbol} cls="sy" />
          <span>
            <span class="t">${v.title}${' '}${v.time && html`<span class="tm n">${v.time}</span>`}</span>
            ${verdict && html`<span class="vd">${verdict}</span>`}
            ${(v.level === 'caution' || v.level === 'hard') && html`<span class=${'wx n ' + v.level}>${v.phrase}</span>`}
          </span>
        </button></h2>
      </div>
      <img class="pk" src=${PEAKS} alt="" width="600" height="460" />
    </section>
    <${Cells} c=${c} />
    ${sun && html`<div class="sunline"><${Icon} name=${sun.lit ? 'lit' : 'shade'} /><b>${sun.title}</b>${sun.note && html`<span>${sun.note}</span>`}</div>`}`;
}

export function Home({ store, handlers: h, renderRecordExtra = null }) {
  const s = usePlannerState(store);
  const [later, setLater] = useState(false); // 나중에 할게요: this session only (nothing is stored, nothing nags)
  const [answered, setAnswered] = useState(() => new Map()); // id -> 'went'|'missed' while a record extra is open
  const [showPast, setShowPast] = useState(false);
  const now = Date.now();
  const plans = s.db.plans;
  const detail = s.detailId ? plans.find((p) => p.id === s.detailId) : null;

  // the open plan was deleted: leave the detail and park focus on #app (its opener is gone)
  useEffect(() => {
    if (s.detailId && !detail) { store.update({ detailId: null }); document.getElementById('app')?.focus(); }
  }, [s.detailId, detail, store]);

  const views = new Map();
  const viewOf = (p) => { if (!views.has(p.id)) views.set(p.id, rowView(p, { s, now })); return views.get(p.id); };
  const open = (id) => store.update({ detailId: id });
  const close = () => {
    const id = s.detailId;
    store.update({ detailId: null });
    setTimeout(() => document.querySelector(`[data-row="${id}"]`)?.focus(), 0);
  };
  // a recorded plan can be reopened to fill the same fields again (only where a record extra exists)
  const toRecord = (p, kind) => { setAnswered((m) => new Map(m).set(p.id, kind)); store.update({ detailId: null }); setTimeout(() => document.getElementById('app')?.focus(), 0); };
  const reopen = renderRecordExtra ? (p) => toRecord(p, p.status === '갔다' ? 'went' : 'missed') : null;
  // a past plan with no record yet can be answered right from its detail (same save as the 기록하기 block)
  const answerHere = renderRecordExtra ? (p, kind) => { if (h.savePlan(kind === 'went' ? markWent(p) : markMissed(p))?.ok !== false) toRecord(p, kind); } : null;

  if (detail) return html`<${DetailView} plan=${detail} v=${viewOf(detail)} s=${s} now=${now} h=${h} onBack=${close} onRecord=${reopen} onAnswer=${answerHere} />`;

  const strip = html`<${Strip} key="strip" days=${weekStrip(plans, s.today, (p) => { const v = viewOf(p); return v.live && v.risk.level === 'hard'; })} />`;
  const addBtn = (cls, key) => html`<button type="button" key=${key} class=${cls} onClick=${() => h.onAdd()}>＋ 일정 추가</button>`;
  const partnersBtn = html`<div key="partners" class="pl-foot"><button type="button" class="txt" onClick=${() => h.onPartners()}>동행인</button></div>`;
  if (!plans.length) {
    return html`${strip}<section class="empty" key="empty"><div class="k">이번 주 · 일정 없음</div><h2>이번 주말은 비어 있어요</h2><p>날짜와 장소만 정하면 날씨를 같이 봐 드려요</p>${addBtn('btn p', 'add0')}</section>
      <img class="pk end" key="pk" src=${PEAKS} alt="" width="600" height="460" />${partnersBtn}`;
  }

  const tl = buildTimeline(plans, s.today, s.nowMin);
  const pendingIds = new Set(tl.record.map((p) => p.id));
  const recorded = (p) => p.status === '갔다' || p.status === '못 갔다';
  const upcoming = plans.filter((p) => p.date >= s.today && !recorded(p) && !pendingIds.has(p.id)).sort(byTime);
  const hero = upcoming.find((p) => p.date === s.today && p.status === '예정') ?? null;
  const rows = upcoming.filter((p) => p !== hero);

  // 기록하기: the oldest pending plan only (newest-first list → last) + the ones just answered whose extra is still open
  const openRec = plans.filter((p) => answered.has(p.id));
  const oldest = !later && !openRec.length && tl.record.length ? tl.record[tl.record.length - 1] : null; // one prompt at a time: the next waits until the open one is saved
  const recPlans = oldest ? [oldest] : openRec;
  const recIds = new Set(recPlans.map((p) => p.id));
  const answer = (p, kind) => {
    const same = p.status === (kind === 'went' ? '갔다' : '못 갔다'); // tapping the answer already given must not wipe missReason
    const r = same ? null : h.savePlan(kind === 'went' ? markWent(p) : markMissed(p));
    if (r?.ok === false) return;
    if (renderRecordExtra) setAnswered(new Map([...answered, [p.id, kind]]));
  };
  const items = recPlans.map((p) => {
    const v = viewOf(p);
    const kind = answered.get(p.id) ?? null;
    const done = () => { setAnswered((m) => { const n = new Map(m); n.delete(p.id); return n; }); setTimeout(() => document.getElementById('app')?.focus(), 0); }; // the open form unmounts: park focus on #app
    const extra = kind && renderRecordExtra ? renderRecordExtra(p, { kind, resolved: v.resolved, done }) : null;
    return html`<${RecordItem} key=${p.id} plan=${p} v=${v} kind=${kind} extra=${extra} onAnswer=${(k) => answer(p, k)}
      onLater=${() => { done(); setLater(true); }} />`;
  });

  // past view: everything that is not ahead and not shown in the 기록하기 block, newest first (done records live only here)
  const upIds = new Set(upcoming.map((p) => p.id));
  const pastPlans = plans.filter((p) => !upIds.has(p.id) && !recIds.has(p.id));
  const days = [];
  for (const p of pastPlans.sort((a, b) => b.date.localeCompare(a.date) || byTime(a, b))) {
    const last = days[days.length - 1];
    if (last && last.date === p.date) last.plans.push(p); else days.push({ date: p.date, plans: [p] });
  }
  const row = (p) => html`<li key=${p.id}><${Row} plan=${p} v=${viewOf(p)} onOpen=${open} s=${s} now=${now} /></li>`;

  const nodes = [strip];
  if (hero) nodes.push(html`<${Hero} key="hero" plan=${hero} v=${viewOf(hero)} s=${s} now=${now} onOpen=${open} />`);
  else {
    const next = nextPlanText(plans, s.today);
    const p = dayParts(s.today);
    nodes.push(html`<section class="empty" key="td"><div class="k">오늘 · ${p.dow}</div><h2>오늘은 비어 있어요</h2>${next && html`<p>${next}</p>`}${addBtn('btn p', 'add1')}</section>`);
  }
  if (rows.length) nodes.push(html`<ul class="rows" key="rows">${rows.map(row)}</ul>`);
  if (items.length) nodes.push(html`<section class="rec" key="rec"><div class="k">기록하기</div>${items}</section>`);
  if (days.length) {
    nodes.push(html`<button type="button" class="more" key="more" aria-expanded=${showPast ? 'true' : 'false'} onClick=${() => setShowPast(!showPast)}>${showPast ? '지난 일정 접기' : '지난 일정 보기 ›'}</button>`);
    if (showPast) {
      nodes.push(html`<div key="past">${pastBlocks(days).map((b) => html`<div key=${'m' + b.days[0].date}><div class="wk">${b.month}월</div>
        <ul class="rows">${b.days.flatMap((d) => d.plans).map(row)}</ul></div>`)}</div>`);
    }
  }
  if (hero) nodes.push(addBtn('btn p add', 'add2'));
  return html`<div key="list">${nodes}</div>${partnersBtn}`;
}
