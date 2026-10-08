// 서비스 워커 등록(sw.js, 범위는 파일 위치 = 이 사이트 폴더). 보안 컨텍스트(https·localhost)에서만, 실패는 조용히 무시.
export function registerSw(nav = globalThis.navigator, secure = globalThis.isSecureContext) {
  if (!secure || !nav?.serviceWorker) return false;
  nav.serviceWorker.register('sw.js').catch(() => {});
  return true;
}
if (typeof window !== 'undefined') window.addEventListener('load', () => registerSw(), { once: true });
