// src/plan-card.js — what the promise card says (no DOM). plan-card-draw.js paints it.
import { dayText, fmtMin } from './viewmodel.js';
import { config } from './config.js';

/** discipline symbol of a place: wall | lead (indoor) | boulder | single | multi */
export function symbolKind(resolved) {
  if (resolved.kind === 'crag') return resolved.crag?.type === 'multi' ? 'multi' : resolved.crag?.type === 'boulder' ? 'boulder' : 'single';
  return resolved.venue === 'indoor' ? 'lead' : 'wall';
}

/** `실내 · 서울` / `외벽 · 경기 양주시` / `자연암장 · 서울`; '' when nothing is known (a name-only place). */
export function placeLine(resolved) {
  const region = resolved.wall?.region ?? resolved.crag?.region ?? resolved.mineWall?.region ?? '';
  const kind = resolved.kind === 'crag' ? '자연암장' : resolved.kind === 'mine' ? (resolved.venue === 'indoor' ? '실내' : resolved.venue === 'outdoor' ? '외벽' : '내 암장')
    : resolved.kind === 'wall' ? (resolved.venue === 'indoor' ? '실내' : '외벽') : '';
  return [kind, region].filter(Boolean).join(' · ');
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const WX_ICONS = ['sun', 'cloud', 'rain'];

/** cardModel(plan, resolved, risk, partners, {withNames, wxIcon}) → the words and facts on the card. Names are left off unless asked; `people` is only a count.
 *  wxIcon: the weather icon of the plan's hour (sun | cloud | rain, anything else → none). Rows the model cannot fill stay null (the card leaves them out). */
export function cardModel(plan, resolved, risk, partners = [], { withNames = false, wxIcon = null } = {}) {
  const [y, m, d] = String(plan.date).split('-').map(Number);
  const r = resolved ?? {};
  const when = dayText(new Date(y, m - 1, d)) + (Number.isFinite(plan.min) ? ` ${fmtMin(plan.min)}` : '');
  const found = (plan.partnerIds ?? []).map((id) => partners.find((p) => p.id === id)?.name).filter(Boolean);
  const wx = risk && risk.level !== 'none' && risk.level !== 'past' ? risk.phrase : null;
  const icon = wx && WX_ICONS.includes(wxIcon) ? wxIcon : null;
  return {
    title: plan.placeName || r.name || '',
    when,
    month: Number.isFinite(m) ? `${m}월` : null,
    day: Number.isFinite(d) ? d : null,
    dow: Number.isFinite(y) ? `${DOW[new Date(y, m - 1, d).getDay()]}요일` : null,
    time: Number.isFinite(plan.min) ? fmtMin(plan.min) : null,
    kind: r.kind ? symbolKind(r) : null,
    sub: placeLine(r) || null,
    who: withNames && found.length ? found.join(', ') : null,
    people: found.length,
    wx,
    wxIcon: icon,
    wxWarn: icon === 'rain',
    wxSub: icon === 'rain' && /%/.test(wx) ? '강수 확률' : null,
    badge: plan.status === '쉼' ? '취소됨' : plan.changedFrom ? '변경됨' : null,
    link: config.appUrl || null,
    past: risk?.level === 'past',
  };
}

/** the host of the card's link (`https://example.kr/x` → `example.kr`); null without a link, the raw text if it is not a URL. */
export const linkHost = (link) => { if (!link) return null; try { return new URL(link).host || link; } catch { return link; } };

/** badge line for a changed plan: '변경됨 · 원래는 선바위' (just '변경됨' without a remembered original). */
export const changedPhrase = (plan) => (plan.changedFrom?.placeName ? `변경됨 · 원래는 ${plan.changedFrom.placeName}` : '변경됨');

/** cardKey(model) → same words, same key; a past plan has nothing to draw (null). Feeds invite-state's key. */
export const cardKey = (model) => (!model || model.past ? null : JSON.stringify([model.title, model.when, model.kind, model.sub, model.who, model.people, model.wx, model.wxIcon, model.badge, model.link]));

/** cardText(model) → the message that goes with the picture, one fact per line. The link only when config.appUrl is set. */
export const cardText = (model) => ['[희노애Rock] ' + model.title, model.when, model.badge, model.who, model.wx, model.link].filter(Boolean).join('\n');

/** cardSay(result) → the line after 보내기/그림 저장 (shareSay talks about the invite sheet's text box, which this sheet has not). */
export function cardSay({ how, copied } = {}) {
  if (how === 'shared') return '공유 창을 열었어요. 그림과 문구를 함께 넘겼어요.';
  if (how === 'saved') return copied ? '그림을 저장했어요. 문구도 복사했어요. 그림과 문구를 함께 보내세요.' : '그림을 저장했어요. 문구는 복사하지 못했어요.';
  return how === 'file' ? '그림을 저장했어요.' : '';
}
