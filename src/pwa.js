// 서비스 워커 등록(sw.js, 범위는 파일 위치 = 이 사이트 폴더). 보안 컨텍스트(https·localhost)에서만, 실패는 조용히 무시.
// localhost·127.0.0.1 등 개발 서버에서는 등록하지 않고, 앞선 방문이 남긴 워커도 해제한다(워커가 src/를 캐시해 고친 코드가 안 보이던 문제).
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)$/;

export function registerSw(nav = globalThis.navigator, secure = globalThis.isSecureContext, host = globalThis.location?.hostname ?? '') {
  if (!secure || !nav?.serviceWorker) return false;
  if (LOCAL.test(host)) {
    nav.serviceWorker.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    return false;
  }
  nav.serviceWorker.register('sw.js').catch(() => {});
  return true;
}
if (typeof window !== 'undefined') window.addEventListener('load', () => registerSw(), { once: true });
