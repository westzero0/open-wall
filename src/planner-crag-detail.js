// src/planner-crag-detail.js — 자연암장 페이지의 어프로치·루트 칸. 어프로치는 읽기 전용(crag-detail-model.js), 루트 칸은 기록도 한다(저장은 h.savePlan 경유).
// 루트 데이터는 CragPlace(planner-wall.js)가 handlers.loadRoutes()로 열어 넘긴다(fetch·storage 없음). ask = 빈 상태의 알려 주기 버튼(vnode 또는 null).
import { html, useState } from './planner-ui.js';
import { Note } from './planner-parts.js';
import { approachView, routesView } from './crag-detail-model.js';
import { Chosen, RoutePicker } from './planner-routes.js';
import { putAscent, dropAscent, recordTarget, chosenHead, styleFlash, recordBand, startRecordPlan, ascentKey, historyMap, MAX_ASCENTS } from './plan-record.js';
import { saveRecord } from './plan-actions.js';
import { fieldsKeyOf } from './plan-fields.js';
import { resolveFor } from './plan-view.js';
import { resolvePlace } from './plan-place.js';
import { randomId } from './plan-model.js';
import { placeKeyOf, routesAt, findMyRoute } from './my-routes.js';
import { routeGradeLabel } from './grades.js';
import { SAVE_FAIL } from './plan-sheet.js';
import { wallPageId } from './share-id.js';

const hide = (e) => { e.currentTarget.hidden = true; }; // 사진이 안 뜨면 글만 남는다
const Photo = ({ src, alt }) => html`<img class="cd-img" src=${'data/' + src} alt=${alt} loading="lazy" decoding="async" onError=${hide} />`;

export function ApproachPane({ crag, ask = null }) {
  const v = approachView(crag);
  if (!v) return html`<div class="cd-pane"><${Note}>아직 어프로치 정보가 없어요<//>${ask}</div>`;
  return html`<div class="cd-pane">
    ${v.head && html`<p class="cd-head">${v.head}</p>`}
    ${(v.parkNote || v.parkPhoto) && html`<section><h3 class="lbl">주차</h3>
      ${v.parkNote && html`<p>${v.parkNote}</p>`}${v.parkPhoto && html`<${Photo} src=${v.parkPhoto} alt="주차장 사진" />`}</section>`}
    ${v.steps.length > 0 && html`<section><h3 class="lbl">길 안내</h3><ol class="cd-steps">
      ${v.steps.map((s, i) => html`<li key=${i}><p>${s.turn && html`<b>${s.turn}</b> `}${s.text}</p>
        ${s.wrong && html`<p class="cd-wrong">${s.wrong}</p>`}${s.photo && html`<${Photo} src=${s.photo} alt=${`${i + 1}번째 갈림길 사진`} />`}</li>`)}</ol></section>`}
  </div>`;
}

/** 루트 칸: 기록 띠, 개념도, 구역 칩·루트 찾기, 묶음(오늘 한 루트 · 이어서 도전 · 내가 추가한 루트 · 이 암장의 루트), 새 루트. Taps save into the record target (recordTarget): none yet → the first style tap makes today's 가요 plan.
 * crag: the page's 자연암장; s: planner state; h: handlers (savePlan, flash, saveMyRoute, …). No fetch/storage here. */
export function RoutesPane({ entry, data, multi, ask = null, crag, s, h }) {
  const [area, setArea] = useState(null);
  const [err, setErr] = useState('');
  if (!data) return html`<p role="status">불러오는 중이에요</p>`;
  const cragId = wallPageId(crag);
  const targetOf = (st) => recordTarget({ plans: st.db.plans, today: st.today, planId: st.wallCtx?.planId ?? null, isHere: (p) => { const c = resolveFor(p, st).crag; return Boolean(c) && wallPageId(c) === cragId; } });
  const target = targetOf(s);
  const ascents = target?.record?.ascents ?? [];
  const routes = entry?.routes ?? [];
  const place = { kind: 'official', id: cragId };
  const key = placeKeyOf({ cragId, place });
  const mine = key ? routesAt(s.db.myRoutes, key) : [];
  const history = historyMap(s.db.plans, target?.id ?? null, routes);
  const gradeOf = new Map(routes.map((r) => [r.id, r.grade]));
  const gradeFor = (a) => { if (a.routeId) return gradeOf.get(a.routeId); const g = key && findMyRoute(s.db.myRoutes, key, a.routeName)?.grade; return g ? routeGradeLabel(g) : null; };
  const patchList = (fn, ...args) => {
    const st = h.getState();
    const t = targetOf(st);
    let r;
    if (t) {
      const gone = fn === dropAscent ? t.record.ascents.find((a) => ascentKey(a) === args[0]) : null; // look it up before the save removes it
      r = h.savePlan(saveRecord(t, { ...t.record, ascents: fn(t.record.ascents, ...args) }, fieldsKeyOf(resolveFor(t, st), t)));
      if (r && r.ok !== false) {
        if (fn === putAscent) h.flash?.(styleFlash(args[0]));
        else if (gone) h.flash?.(`${gone.routeName} 기록에서 뺐어요`); // a removal must not be silent: the row vanishes under the finger
      }
    } else {
      const next = fn([], ...args);
      if (!next.length) return;
      const resolved = resolvePlace(place, { walls: st.walls, crags: st.crags, mine: st.db.mine, aliases: st.aliases });
      const plan = startRecordPlan({ place, today: st.today, id: randomId(), now: Date.now(), resolved });
      r = plan && h.savePlan(saveRecord(plan, { ...plan.record, ascents: next }, 'crag'));
      if (r && r.ok !== false) h.flash?.('일정에 추가했어요');
    }
    setErr(!r || r.ok === false ? SAVE_FAIL : '');
  };
  const full = ascents.length >= MAX_ASCENTS;
  const focusSearch = { current: { focus: () => document.getElementById('rq')?.focus() } };
  const v = routesView(entry, area, multi);
  const chosenGroup = ascents.length > 0 && html`<h3 class="lbl">${chosenHead({ date: target?.date ?? s.today, today: s.today })}</h3>
    ${ascents.map((a) => html`<${Chosen} key=${ascentKey(a)} a=${a} grade=${gradeFor(a)} hist=${history.get(a.routeId)} full=${full} patchList=${patchList} cragId=${cragId} notes=${s.db.routeNotes} h=${h} onErr=${setErr} btn=${focusSearch} />`)}`;
  return html`<div class="cd-pane">
    <h3 class="lbl" role="status">${recordBand({ date: target?.date ?? s.today, today: s.today, count: ascents.length })}</h3>
    ${!v && html`<${Note}>아직 루트 정보가 없어요<//>${ask}`}
    ${v && v.topos.map((t) => html`<figure class="cd-topo" key=${t.src}>
      <a href=${t.src} target="_blank" rel="noopener noreferrer"><img class="cd-img" src=${t.src} alt=${t.caption || '루트 개념도'} loading="lazy" decoding="async" onError=${hide} /></a>
      ${html`<figcaption>${[t.caption, t.credit, '크게 보기 ›'].filter(Boolean).join(' · ')}</figcaption>`}</figure>`)}
    <${RoutePicker} routes=${routes} multi=${multi} rec=${{ ascents }} history=${history} patchList=${patchList} cragId=${cragId} notes=${s.db.routeNotes} place=${key} mine=${mine}
      h=${h} onErr=${setErr} area=${area} onArea=${setArea} lead=${chosenGroup || null} hideChosen=${true} />
    <p class="err" role="alert">${err}</p>
  </div>`;
}
