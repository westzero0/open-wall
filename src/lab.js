// 시범 스위치: 앱 주소에 ?lab=crag 를 붙여 열면 그 기기에서만 싱글피치가 켜지고(기기에 저장), ?lab=off 로 끈다.
// config.singlePitch 가 꺼진 동안 링크를 받은 시범 참가자만 쓰게 하려는 것. 저장소가 막혀도 이번 방문만 켠다.
export const LAB_KEY = 'open-wall:lab';
export const LAB_NOTE = '시범 기능이에요 · 데이터가 틀릴 수 있어요';

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

/** labCrag(search, store) → true when the 시범 싱글피치 is on for this device (reads ?lab=, remembers it). */
export function labCrag(search, store) {
  const asked = new URLSearchParams(search).get('lab');
  if (asked === 'crag') { safe(() => store.setItem(LAB_KEY, 'crag')); return true; }
  if (asked === 'off') { safe(() => store.removeItem(LAB_KEY)); return false; }
  return safe(() => store.getItem(LAB_KEY), null) === 'crag';
}

/** The address without ?lab= (it has been read; the entry under the app is the clean address). */
export function withoutLab(href) {
  const u = new URL(href);
  u.searchParams.delete('lab');
  return u;
}
