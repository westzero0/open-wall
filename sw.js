// 서비스 워커: 화면 틀(페이지·CSS·스크립트·로고·라이브러리)만 저장해 두고 먼저 보여 준 뒤 뒤에서 새로 받는다(stale-while-revalidate).
// 홈 화면 앱의 시작 화면은 첫 그림이 나올 때까지 떠 있으므로, 틀을 폰에서 바로 꺼내 그 시간을 줄이는 게 목적이다.
// 운영시간 등 데이터(data/), 암장 공유 페이지(w/), 이 파일 자신은 저장하지 않고 항상 네트워크에서 받는다(오래된 운영시간을 보이지 않기 위해).
const CACHE = 'haebyeok-shell-a572059'; // 저장 방식이 바뀌거나 화면 틀(HTML·CSS·JS)이 서로 어긋난 채 저장됐을 때 올린다(activate 가 다른 이름의 저장소를 지운다)
const PHOTO_CACHE = 'haebyeok-photos-v1'; // 길 안내 사진: 사용자가 저장을 눌렀을 때만 src/crag-photos.js가 채운다. activate 가 지우지 않는다
const OFFLINE = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>해벽</title><body style="font:16px/1.6 sans-serif;word-break:keep-all;padding:2rem;text-align:center"><p>인터넷에 연결되면 다시 열어 주세요.</p></body></html>';

// 이 워커가 있는 폴더 기준 경로: '' (첫 화면), index.html, style.css, manifest, src/*.js, assets/**, vendor/**
const BASE = new URL('./', self.location.href).pathname;
const SHELL = /^(?:|index\.html|style\.css|manifest\.webmanifest|src\/[^/]+\.js|assets\/.+|vendor\/.+)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE && n !== PHOTO_CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim())));

const offline = (req) => (req.mode === 'navigate'
  ? new Response(OFFLINE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } })
  : Response.error());

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const rel = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : null;
  if (rel !== null && /^data\/photos\//.test(rel)) { // saved route photos: the stored copy first, else the network (nothing is stored here)
    e.respondWith(caches.open(PHOTO_CACHE).then((c) => c.match(req)).catch(() => undefined).then((hit) => hit ?? fetch(req)).catch(() => offline(req)));
    return;
  }
  if (rel === null || !SHELL.test(rel)) { // data, share pages, the worker: the network, as it is
    e.respondWith(fetch(req).catch(() => offline(req)));
    return;
  }
  const page = url.origin + url.pathname; // a share link's ?wall=… shares the stored page
  if (req.mode === 'navigate' && url.searchParams.has('_v')) { // src/version-check.js sent us to a newer page: the network, then kept for the next visit
    e.respondWith(caches.open(CACHE).then((cache) => fetch(url.href, { cache: 'no-cache' })
      .then((res) => { if (res.ok) cache.put(page, res.clone()); return res; })
      .catch(async () => (await cache.match(page)) ?? offline(req))));
    return;
  }
  const key = req.mode === 'navigate' ? page : page + url.search; // ?v=<build> assets are one stored file per build
  const versioned = url.search.startsWith('?v=');
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(key);
    if (hit && versioned) return hit; // a numbered file never changes: no refresh
    // no-cache: 브라우저 HTTP 캐시(Pages max-age=600)가 아니라 서버에 확인해 받는다. 안 그러면 HTML 은 새것, CSS·JS 는 10분 전 것으로 저장돼 화면이 깨진다
    const refresh = fetch(url.href, { cache: 'no-cache' }).then((res) => { if (res.ok) cache.put(key, res.clone()); return res; });
    if (hit) { e.waitUntil(refresh.catch(() => {})); return hit; }
    return refresh.catch(() => offline(req));
  }));
});
