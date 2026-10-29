// 방문 통계(GoatCounter, 쿠키 없음): 외부 스크립트 없이 이미지 요청 하나(GET /count)만 보낸다.
// config.statsCode(사이트 코드)가 비어 있거나 localhost·Do Not Track이면 아무것도 보내지 않는다. 경로만 보내고 쿼리(한마디·인원 등)는 보내지 않는다.
// 이벤트: view(페이지뷰), share-open(공유 링크로 들어옴), return(하루 이상 지나 다시 옴), click-tel/insta/route/chat/link(링크 종류만; 근처 외벽 시트의 data-near-map 지도 링크는 세지 않는다),
// climber-done(클라이머 유형 테스트를 끝냄: 횟수만, 유형·점수는 보내지 않는다),
// card-open(목록에서 카드를 엶), log-add(방문 기록을 저장함), share-send(링크 복사로 공유함), weather-shown(날씨 상자를 처음 봄), fav-add(즐겨찾기를 켬),
// sun-filter(양달·응달 칩을 켬), tab-map·tab-log(탭을 누름), region-set(내 지역을 고름), invite-make(초대 링크를 만듦·보냄), report-send(제보를 보냄), board-post(게시판 글을 씀), gear-view(근처 탭을 처음 봄: 횟수만), gear-<업체 id>(근처 탭의 업체 링크를 누름; id는 data/partners.json의 고정 이름): 모두 이름만 센다.
// 방문자 구분(docs/superpowers/specs/2026-10-29-visit-exclude-design.md): ?me 로 한 번 연 기기('me')는 아무것도 보내지 않고, ?beta 로 연 기기('beta')는 모든 이벤트 이름 앞에 beta- 를 붙인다(페이지뷰는 beta-view 이벤트).
// 표시는 localStorage open-wall:visitor 한 줄(me | beta | none). 두 파라미터는 읽은 뒤 주소에서 지운다(공유 링크로 새지 않게). 이 표시가 없던 옛 기기(last-visit만 있음)는 배포 전 방문이므로 beta 로 본다.
// 날씨 상자를 한 번이라도 본 기기는 재방문을 return-wx로 센다(상자를 본 쪽과 못 본 쪽의 재방문율을 비교하려고; 기기 안 표시 하나, 암장·내용은 없다).
import { config } from './config.js';

// 북극성 지표(행동으로 이어진 방문)의 갈래: 고른다·쌓는다·퍼뜨린다. 문서 이벤트를 받아 이름만 센다(암장·내용·위치는 없다).
const ACTIONS = { 'stats:card-open': 'card-open', 'stats:log-add': 'log-add', 'stats:share-send': 'share-send', 'stats:weather-shown': 'weather-shown', 'stats:fav-add': 'fav-add',
  'stats:sun-filter': 'sun-filter', 'stats:tab-map': 'tab-map', 'stats:tab-log': 'tab-log', 'stats:region-set': 'region-set',
  'stats:invite-make': 'invite-make', 'stats:report-send': 'report-send', 'stats:board-post': 'board-post', 'stats:gear-view': 'gear-view' };
const WX_SEEN = 'open-wall:wx-seen';
export const VISITOR_KEY = 'open-wall:visitor';

/** visitorFlag(search, stored, hadVisit) → { flag: 'me'|'beta'|null, store } ; store: a value to save, or undefined to leave the mark alone.
 *  Order: ?me=off > ?me > stored me > ?beta > stored beta/none > (no mark yet) an old device is beta, a new one is marked none. */
export function visitorFlag(search, stored, hadVisit = false) {
  const q = new URLSearchParams(search);
  const mark = ['me', 'beta', 'none'].includes(stored) ? stored : null;
  if (q.has('me')) return q.get('me') === 'off' ? { flag: null, store: 'none' } : { flag: 'me', store: 'me' };
  if (mark === 'me') return { flag: 'me', store: undefined };
  if (q.has('beta')) return { flag: 'beta', store: 'beta' };
  if (mark) return { flag: mark === 'beta' ? 'beta' : null, store: undefined };
  return hadVisit ? { flag: 'beta', store: 'beta' } : { flag: null, store: 'none' };
}

/** The event name a device sends: beta devices get the beta- prefix, everyone else the plain name. */
export const eventName = (flag, name) => (flag === 'beta' ? `beta-${name}` : name);

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

// Reads ?me/?beta and the saved mark, saves what changed, and takes the two parameters out of the address. Storage may be blocked: then only this visit is marked.
function readVisitor(win) {
  const { search, pathname, hash } = win.location;
  let stored = null, hadVisit = false;
  try { stored = win.localStorage.getItem(VISITOR_KEY); hadVisit = Number(win.localStorage.getItem('open-wall:last-visit')) > 0; } catch { /* 막히면 이번 방문만 */ }
  const { flag, store } = visitorFlag(search, stored, hadVisit);
  if (store !== undefined) { try { win.localStorage.setItem(VISITOR_KEY, store); } catch { /* 저장 불가 */ } }
  const q = new URLSearchParams(search);
  if (q.has('me') || q.has('beta')) {
    q.delete('me'); q.delete('beta');
    const rest = q.toString();
    try { win.history?.replaceState(null, '', pathname + (rest ? `?${rest}` : '') + (hash || '')); } catch { /* 주소는 그대로 둬도 된다 */ }
  }
  return flag;
}

export function initStats(win = globalThis.window, code = config.statsCode) {
  if (!win) return false;
  const flag = readVisitor(win);
  if (flag === 'me' || !shouldTrack(code, win.location.hostname, win.navigator.doNotTrack === '1')) return false;
  const send = (path, event) => { new win.Image().src = countUrl(code, { path: event ? eventName(flag, path) : path, event, ref: event ? '' : win.document.referrer }); };
  if (flag === 'beta') send('view', true); else send(win.location.pathname || '/', false);
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
