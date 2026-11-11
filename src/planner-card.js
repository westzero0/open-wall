// src/planner-card.js — 약속 카드 sheet (spec §7): edit → making → done through invite-state, picture from plan-card-draw, send/save through share-image.
// The picture is drawn when 카드 만들기 is pressed, so 보내기 runs straight from its own tap (share-image: nothing awaited before navigator.share).
import { html, useState, useEffect, useRef, usePlannerState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { initialInviteState, nextInviteState } from './invite-state.js';
import { cardModel, cardKey, cardText, cardSay } from './plan-card.js';
import { drawPlanCard } from './plan-card-draw.js';
import { pictureBlob, shareInvite, saveFile } from './share-image.js';
import { rowView, partnerNames, hourFor, rowWeatherCell } from './plan-view.js';

const FILE = 'planner-card.png';
const ERR = { past: '지난 일정은 카드를 만들 수 없어요', empty: '장소를 확인해 주세요' };
const MAKE_FAIL = '그림을 만들지 못했어요. 잠시 뒤 다시 해 주세요.';

function CardForm({ s, plan, h }) {
  const [withNames, setWithNames] = useState(false); // per plan, off every time: the card leaves the device
  const [st, setSt] = useState(initialInviteState);
  const [say, setSay] = useState('');
  const blobs = useRef(new Map()); // key → Blob (a drawn result that arrives late is kept, not mistaken for the current one)
  const v = rowView(plan, { s, now: Date.now() });
  const wxIcon = rowWeatherCell(hourFor(v.resolved, plan, s.wx))?.icon ?? null;
  const model = cardModel(plan, v.resolved, v.risk, s.db.partners, { withNames, wxIcon });
  const key = cardKey(model);
  const names = partnerNames(plan, s.db.partners);
  const ev = (e) => setSt((x) => nextInviteState(x, e));
  useEffect(() => { ev({ type: 'change', key }); setSay(''); }, [key]);

  const make = () => {
    ev({ type: 'save', key, past: model.past });
    if (model.past || !key || (st.cache === key && blobs.current.has(key))) return;
    setSay('');
    pictureBlob(model, drawPlanCard).then((b) => { blobs.current.set(key, b); ev({ type: 'drawn', key }); },
      () => { ev({ type: 'failed', key }); setSay(MAKE_FAIL); });
  };
  const blob = () => blobs.current.get(key);
  const send = () => { const b = blob(); if (b) shareInvite(b, cardText(model), FILE).done.then((r) => setSay(cardSay(r))); };
  const save = () => { const b = blob(); if (b) { saveFile(b, FILE); setSay(cardSay({ how: 'file' })); } };

  const done = st.phase === 'done' && blobs.current.has(key);
  return html`<${Sheet} title="약속 카드" onClose=${h.onClose}>
    <div class="f">
      ${model.badge && html`<p class="vd">${model.badge}</p>`}
      <p class="n"><b>${model.when}</b></p><p>${model.title}</p>
      ${model.wx && html`<p class="n">${model.wx}</p>`}
      ${model.who && html`<p>${model.who}</p>`}
    </div>
    ${names.length > 0 && html`<div class="f"><label class="ck"><input type="checkbox" disabled=${st.phase === 'making'} checked=${withNames} onChange=${(e) => setWithNames(e.target.checked)} />동행 이름 넣기</label>
      <p class="n">동행 이름은 기본으로 빠져요. 일정마다 넣을지 고를 수 있어요.</p></div>`}
    <p class="err" role="alert">${st.err ? ERR[st.err] : ''}</p>
    <p class="n" role="status">${say}</p>
    <div class="row2">${done ? html`<button type="button" class="btn p" onClick=${send}>보내기</button><button type="button" class="btn" onClick=${save}>그림 저장</button>`
      : html`<button type="button" class="btn p" disabled=${st.phase === 'making'} onClick=${make}>${st.phase === 'making' ? '만드는 중…' : '카드 만들기'}</button>`}
      <button type="button" class="btn" onClick=${h.onClose}>닫기</button></div>
  <//>`;
}

export function CardSheet({ store, handlers }) {
  const s = usePlannerState(store);
  if (s.sheet !== 'card') return null;
  const plan = s.db.plans.find((p) => p.id === s.cardId);
  if (!plan) return null;
  return html`<${CardForm} key=${plan.id} s=${s} plan=${plan} h=${handlers} />`;
}
