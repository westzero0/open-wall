// 방문 통계(GoatCounter, 쿠키 없음): 외부 스크립트 없이 이미지 요청 하나(GET /count)만 보낸다.
// config.statsCode(사이트 코드)가 비어 있거나 localhost·Do Not Track이면 아무것도 보내지 않는다. 경로만 보내고 쿼리(한마디·인원 등)는 보내지 않는다.
// 이벤트: view(페이지뷰), share-open(공유 링크로 들어옴), return(하루 이상 지나 다시 옴), click-tel/insta/route/chat/link(링크 종류만).
import { config } from './config.js';

export const countUrl = (code, { path, event = false, ref = '' }) =>
  `https://${code}.goatcounter.com/count?p=${encodeURIComponent(path)}${event ? '&e=true' : ''}${ref ? `&r=${encodeURIComponent(ref)}` : ''}&rnd=${Math.random().toString(36).slice(2, 8)}`;

export function linkKind(href) {
  let u; try { u = new URL(href, 'https://x.invalid/'); } catch { return null; }
  if (u.protocol === 'tel:') return 'tel';
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname;
  if (/(^|\.)instagram\.com$/.test(h)) return 'insta';
  if (/(^|\.)open\.kakao\.com$/.test(h)) return 'chat';
  if (/(^|\.)(map\.naver\.com|naver\.me|map\.kakao\.com|tmap\.co\.kr|maps\.google\.com)$/.test(h) || (h === 'www.google.com' && u.pathname.startsWith('/maps'))) return 'route';
  return 'link';
}

export const shouldTrack = (code, hostname, dnt) =>
  !!code && !dnt && !/^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)$/.test(hostname);

export function initStats(win = globalThis.window, code = config.statsCode) {
  if (!win || !shouldTrack(code, win.location.hostname, win.navigator.doNotTrack === '1')) return false;
  const send = (path, event) => { new win.Image().src = countUrl(code, { path, event, ref: event ? '' : win.document.referrer }); };
  send(win.location.pathname || '/', false);
  const q = new URLSearchParams(win.location.search);
  if (q.has('wall')) send('share-open', true);
  try {
    const last = Number(win.localStorage.getItem('open-wall:last-visit')) || 0;
    if (last && Date.now() - last > 864e5) send('return', true);
    win.localStorage.setItem('open-wall:last-visit', String(Date.now()));
  } catch { /* 저장 불가면 재방문만 못 센다 */ }
  win.document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    const kind = a && linkKind(a.href);
    if (kind) send(`click-${kind}`, true);
  }, true);
  return true;
}
if (typeof window !== 'undefined') initStats();
