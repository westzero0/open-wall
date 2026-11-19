// src/planner-crag-detail.js — 자연암장 상세 시트: 어프로치 | 루트 두 칸. 읽기 전용. 모델(crag-detail-model.js)만 그린다.
// 루트 데이터는 handlers.loadRoutes()로만 연다(fetch·storage 없음). 시트는 CragSheet 안의 로컬 상태로 열린다(새 주소 없음).
import { html, useState, useEffect } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { Chip, Note } from './planner-parts.js';
import { approachView, routesView } from './crag-detail-model.js';

const hide = (e) => { e.currentTarget.hidden = true; }; // 사진이 안 뜨면 글만 남는다
const Photo = ({ src, alt }) => html`<img class="cd-img" src=${'data/' + src} alt=${alt} loading="lazy" decoding="async" onError=${hide} />`;

function ApproachPane({ crag }) {
  const v = approachView(crag);
  if (!v) return html`<${Note}>아직 어프로치 정보가 없어요<//>`;
  return html`<div class="cd-pane">
    ${v.head && html`<p class="cd-head">${v.head}</p>`}
    ${(v.parkNote || v.parkPhoto) && html`<section><h3 class="lbl">주차</h3>
      ${v.parkNote && html`<p>${v.parkNote}</p>`}${v.parkPhoto && html`<${Photo} src=${v.parkPhoto} alt="주차장 사진" />`}</section>`}
    ${v.steps.length > 0 && html`<section><h3 class="lbl">길 안내</h3><ol class="cd-steps">
      ${v.steps.map((s, i) => html`<li key=${i}><p>${s.turn && html`<b>${s.turn}</b> `}${s.text}</p>
        ${s.wrong && html`<p class="cd-wrong">${s.wrong}</p>`}${s.photo && html`<${Photo} src=${s.photo} alt=${`${i + 1}번째 갈림길 사진`} />`}</li>`)}</ol></section>`}
  </div>`;
}

function RoutesPane({ entry, data, multi }) {
  const [area, setArea] = useState(null);
  if (!data) return html`<p role="status">불러오는 중이에요</p>`;
  const v = routesView(entry, area, multi);
  if (!v) return html`<${Note}>아직 루트 정보가 없어요<//>`;
  return html`<div class="cd-pane">
    ${v.areas.length > 0 && html`<div class="sel" role="group" aria-label="구역">${[null, ...v.areas].map((a) => html`<${Chip} key=${a ?? 'all'} pressed=${area === a} onClick=${() => setArea(a)}>${a ?? '전체'}<//>`)}</div>`}
    ${v.topos.map((t) => html`<figure class="cd-topo" key=${t.src}>
      <a href=${t.src} target="_blank" rel="noopener noreferrer"><img class="cd-img" src=${t.src} alt=${t.caption || '루트 개념도'} loading="lazy" decoding="async" onError=${hide} /></a>
      ${html`<figcaption>${[t.caption, t.credit, '크게 보기 ›'].filter(Boolean).join(' · ')}</figcaption>`}</figure>`)}
    ${v.rows.length > 0 ? html`<ul class="cd-rows">${v.rows.map((r) => html`<li key=${r.key}>
      <span class="rg"><span class="grade n">${r.no ?? ''}</span><b>${r.name}</b><b class="n">${r.grade}</b>${r.sub && html`<small>${r.sub}</small>`}</span></li>`)}</ul>`
      : html`<${Note}>아직 루트 정보가 없어요<//>`}
  </div>`;
}

/** props: crag, h(handlers), onClose. 처음 칸은 어프로치. */
export function CragDetailSheet({ crag, h, onClose }) {
  const [tab, setTab] = useState('approach');
  const [data, setData] = useState(null);
  useEffect(() => { let on = true; h.loadRoutes().then((d) => { if (on) setData(d ?? {}); }); return () => { on = false; }; }, []);
  return html`<${Sheet} title=${`${crag.name} 루트·어프로치`} onClose=${onClose}>
    <div class="wsh">
    <div class="sel cd-tabs" role="group" aria-label="보기">
      <${Chip} pressed=${tab === 'approach'} onClick=${() => setTab('approach')}>어프로치<//>
      <${Chip} pressed=${tab === 'routes'} onClick=${() => setTab('routes')}>루트<//></div>
    ${tab === 'approach' ? html`<${ApproachPane} crag=${crag} />` : html`<${RoutesPane} entry=${data?.[crag.name]} data=${data} multi=${crag.type === 'multi'} />`}
    </div>
  <//>`;
}
