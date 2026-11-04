// 새 암장 제보 → 싱글피치 목록의 '검토 중' 줄 모델 (DOM 없음). 싱글피치(kind 'crag')만: 외벽·실내 제보는 기록 탭에서만 보인다.
import { facingTendency } from './crag-submit-fields.js';

export const NO_SUN = '일사는 반영하지 않았어요';
export const PENDING_NOTE = '이름과 위치만 받았어요. 접근·주차는 확인된 뒤에 열려요';

/** 읽어 올지: ?lab=crag AND cragSubmitOn() 둘 다일 때만 (config.singlePitch 와는 별개 스위치) (아니면 api.list를 부르지 않는다). */
export const shouldLoadSubmissions = ({ lab, on }) => !!(lab && on);

/** subs: api.list() 행. → [{id,name,mine,chip,short,sun,sunLabel,dot}] (dot=false: 지도 점 없음 — visible:false) */
export function pendingRows(subs, mineIds = new Set()) {
  return (Array.isArray(subs) ? subs : [])
    .filter((s) => s && s.kind === 'crag' && (s.status === 'pending' || s.status === 'approved'))
    .map((s) => {
      const mine = mineIds.has(s.id);
      const t = s.facing ? facingTendency(s.facing) : null;
      return {
        id: s.id, name: s.name, mine,
        note: PENDING_NOTE, chip: mine ? '내가 제보 · 검토 중' : '검토 중 · 제보 기준', short: '검토 중',
        sun: t ? t.text : NO_SUN, sunLabel: t ? t.label : null,
        dot: s.visible !== false,
      };
    });
}

/** A just-submitted crag as a 'mine' row at the top of the pending rows; the same id is replaced, not doubled. */
export const withMine = (pending, crag) => [...pendingRows([crag], new Set([crag?.id])), ...pending.filter((p) => p.id !== crag?.id)];
