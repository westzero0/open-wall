// 로딩 화면(#boot)의 라이트/다크를 첫 그림 전에 정한다. 직접 고른 화면(라이트/다크)은 index.html 위쪽 짧은 코드가 이미 처리하고,
// 여기서는 '자동'이면서 지난번에 밤(즐겨찾기가 모두 닫힘)이라 다크였던 경우만 다룬다. 값은 src/app.js 의 BOOT_NIGHT 가 쓴다.
try {
  const t = JSON.parse(localStorage.getItem('open-wall:ui'))?.theme;
  if ((t === undefined || t === 'auto') && localStorage.getItem('open-wall:boot-night') === '1') document.documentElement.dataset.theme = 'dark';
} catch {}
