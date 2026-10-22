// 방문 통계(GoatCounter, 쿠키 없음): 외부 스크립트 없이 이미지 요청 하나(GET /count)만 보낸다.
// config.statsCode(사이트 코드)가 비어 있거나 localhost·Do Not Track이면 아무것도 보내지 않는다. 경로만 보내고 쿼리(한마디·인원 등)는 보내지 않는다.
// 이벤트: view(페이지뷰), share-open(공유 링크로 들어옴), return(하루 이상 지나 다시 옴), click-tel/insta/route/chat/link(링크 종류만; 근처 외벽 시트의 data-near-map 지도 링크는 세지 않는다),
// climber-done(클라이머 유형 테스트를 끝냄: 횟수만, 유형·점수는 보내지 않는다),
// card-open(목록에서 카드를 엶), log-add(방문 기록을 저장함), share-send(링크 복사로 공유함), weather-shown(날씨 상자를 처음 봄), fav-add(즐겨찾기를 켬),
// sun-filter(양달·응달 칩을 켬), tab-map·tab-log(탭을 누름), region-set(내 지역을 고름), invite-make(초대 링크를 만듦·보냄), report-send(제보를 보냄), board-post(게시판 글을 씀), gear-view(근처 탭을 처음 봄: 횟수만), gear-<업체 id>(근처 탭의 업체 링크를 누름; id는 data/partners.json의 고정 이름): 모두 이름만 센다.
// 날씨 상자를 한 번이라도 본 기기는 재방문을 return-wx로 센다(상자를 본 쪽과 못 본 쪽의 재방문율을 비교하려고; 기기 안 표시 하나, 암장·내용은 없다).
import { config } from './config.js';

// 북극성 지표(행동으로 이어진 방문)의 갈래: 고른다·쌓는다·퍼뜨린다. 문서 이벤트를 받아 이름만 센다(암장·내용·위치는 없다).
const ACTIONS = { 'stats:card-open': 'card-open', 'stats:log-add': 'log-add', 'stats:share-send': 'share-send', 'stats:weather-shown': 'weather-shown', 'stats:fav-add': 'fav-add',
  'stats:sun-filter': 'sun-filter', 'stats:tab-map': 'tab-map', 'stats:tab-log': 'tab-log', 'stats:region-set': 'region-set',
  'stats:invite-make': 'invite-make', 'stats:report-send': 'report-send', 'stats:board-post': 'board-post', 'stats:gear-view': 'gear-view' };
const WX_SEEN = 'open-wall:wx-seen';

// 근처 장비점 sheet partner link: `gear-<id>` for a well-formed id (the id pattern is src/gear.js's ID_RE; kept here so counting never imports the wall code), else null
export const gearEventName = (id) => (typeof id === 'string' && /^[a-z0-9-]{1,24}$/.test(id) ? `gear-${id}` : null);

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
    if (last && Date.now() - last > 864e5) send(win.localStorage.getItem(WX_SEEN) ? 'return-wx' : 'return', true);
    win.localStorage.setItem('open-wall:last-visit', String(Date.now()));
  } catch { /* 저장 불가면 재방문만 못 센다 */ }
  win.document.addEventListener('climber:done', () => send('climber-done', true)); // climber-view.js dispatches it when a result is made
  for (const [type, name] of Object.entries(ACTIONS)) win.document.addEventListener(type, () => send(name, true));
  win.document.addEventListener('stats:weather-shown', () => { try { win.localStorage.setItem(WX_SEEN, '1'); } catch { /* 저장 불가면 비교만 못 한다 */ } });
  win.document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    const gear = a && gearEventName(a.dataset?.gear); // a 근처 partner link: only the partner's id as an event name (a fixed list of ours, no wall or user data)
    if (gear) { send(gear, true); return; } // not also click-route/link: those count the wall's own links
    if (a?.dataset?.nearMap) return; // the 근처 외벽 sheet's 지도 link: not the wall's own 길찾기, so not click-route (nothing sent)
    const kind = a && linkKind(a.href);
    if (kind) send(`click-${kind}`, true);
  }, true);
  return true;
}
if (typeof window !== 'undefined') initStats();
