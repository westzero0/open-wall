// src/planner-card.js — 약속 카드 sheet (spec §7): edit → making → done through invite-state, picture from plan-card-draw, send/save through share-image.
// The picture is drawn as soon as the sheet opens (and again when the 이름 넣기 switch flips), so 공유 runs straight from its own tap (share-image: nothing awaited before navigator.share).
import { html, useState, useEffect, useRef, usePlannerState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { initialInviteState, nextInviteState } from './invite-state.js';
import { cardModel, cardKey, cardText, cardSay } from './plan-card.js';
import { drawPlanCard } from './plan-card-draw.js';
import { pictureBlob, shareInvite, saveFile } from './share-image.js';
import { rowView, partnerNames, hourFor, rowWeatherCell } from './plan-view.js';

const FILE = 'planner-card.png';
const ERR = { past: '지난 일정은 카드를 만들 수 없어요', empty: '장소를 확인해 주세요' };
const MAKE_FAIL = '카드를 만들지 못했어요. 잠시 뒤 다시 해 주세요.';

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
  const make = () => {
    ev({ type: 'save', key, past: model.past });
    if (model.past || !key) return;
    if (blobs.current.has(key)) { ev({ type: 'drawn', key }); return; } // drawn before (invite-state keeps one cache slot): confirm without drawing again
    setSay('');
    pictureBlob(model, drawPlanCard).then((b) => { blobs.current.set(key, b); ev({ type: 'drawn', key }); },
      () => { ev({ type: 'failed', key }); setSay(MAKE_FAIL); });
  };
  useEffect(() => { ev({ type: 'change', key }); setSay(''); make(); }, [key]); // open and every change of the values: draw the card at once
  const blob = () => blobs.current.get(key);
  const send = () => { const b = blob(); if (b) shareInvite(b, cardText(model), FILE).done.then((r) => setSay(cardSay(r))); };
  const save = () => { const b = blob(); if (b) { saveFile(b, FILE); setSay(cardSay({ how: 'file' })); } };

  const done = st.phase === 'done' && blobs.current.has(key);
  const [preview, setPreview] = useState(''); // object URL of the drawn card (shown before 공유). The old picture stays until the new one is ready, so the sheet never shrinks and grows; the old URL is revoked after the swap
  const shown = useRef('');
  useEffect(() => {
    const b = done ? blobs.current.get(key) : null;
    if (!b) return;
    const url = URL.createObjectURL(b);
    const old = shown.current; shown.current = url;
    setPreview(url);
    if (old) setTimeout(() => URL.revokeObjectURL(old), 0);
  }, [done, key]);
  useEffect(() => () => { if (shown.current) URL.revokeObjectURL(shown.current); }, []);
  const failed = st.phase === 'edit' && say === MAKE_FAIL; // drawing failed: the primary button turns into 다시 만들기
  const alt = '약속 카드 미리보기: ' + [model.when, model.title, model.wx, model.who ? '동행 ' + model.who : model.people > 0 && '동행 ' + model.people + '명', model.badge].filter(Boolean).join(', ');
  return html`<${Sheet} title="약속 카드" onClose=${h.onClose}>
    ${names.length > 0 && html`<div class="f"><label class="ck"><input type="checkbox" checked=${withNames} onChange=${(e) => setWithNames(e.target.checked)} />이름 넣기</label>
      <p class="n">${withNames ? '동행 이름이 카드에 들어가요' : '동행 이름은 기본으로 빠져요'}</p></div>`}
    ${!st.err && html`<div class="cardprev">${preview && html`<img src=${preview} alt=${alt} />`}</div>`}
    <p class="err" role="alert">${st.err ? ERR[st.err] : ''}</p>
    <p class="n" role="status">${say}</p>
    <div class="row2 foot">${st.err ? null : failed ? html`<button type="button" class="btn p" onClick=${make}>다시 만들기</button>`
      : html`<button type="button" class="btn p" aria-disabled=${!done} onClick=${done ? send : undefined}>공유</button>
      <button type="button" class="btn" aria-disabled=${!done} onClick=${done ? save : undefined}>카드 저장</button>`}</div>
  <//>`;
}

export function CardSheet({ store, handlers }) {
  const s = usePlannerState(store);
  if (s.sheet !== 'card') return null;
  const plan = s.db.plans.find((p) => p.id === s.cardId);
  if (!plan) return null;
  return html`<${CardForm} key=${plan.id} s=${s} plan=${plan} h=${handlers} />`;
}
