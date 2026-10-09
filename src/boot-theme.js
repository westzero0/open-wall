// 로딩 화면(#boot)의 라이트/다크를 첫 그림 전에 정한다. 직접 고른 화면(라이트/다크)은 index.html 위쪽 짧은 코드가 이미 처리하고,
// 여기서는 '자동'이면서 밤(23:00~08:00)인 경우만 다룬다. 같은 규칙: src/time.js 의 isNight.
try {
  const t = JSON.parse(localStorage.getItem('open-wall:ui'))?.theme;
  const h = new Date().getHours();
  if ((t === undefined || t === 'auto') && (h >= 23 || h < 8)) document.documentElement.dataset.theme = 'dark';
} catch {}
