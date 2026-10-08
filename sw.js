// 최소 서비스 워커: 저장소를 쓰지 않는 순수 네트워크 통과. 설치 가능 조건(fetch 핸들러)만 채운다.
// 같은 출처 GET 만 다루고, 페이지 이동이 네트워크 오류일 때만 짧은 안내를 보인다. 그 외 요청은 건드리지 않는다.
const OFFLINE = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>해벽</title><body style="font:16px/1.6 sans-serif;word-break:keep-all;padding:2rem;text-align:center"><p>인터넷에 연결되면 다시 열어 주세요.</p></body></html>';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).catch(() => req.mode === 'navigate'
    ? new Response(OFFLINE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } })
    : Response.error()));
});
