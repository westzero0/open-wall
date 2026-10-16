// src/version-check.js — 배포본(index.html 에 <meta name="build">가 찍힌 것)에서만 하는 일: 열릴 때마다 version.json 만 새로 받아 자기 번호와 비교하고,
// 다르면 새 주소(?_v=)로 다시 연다. 카카오톡 인앱 같은 웹뷰가 옛 페이지를 붙들고 있어도 한 번 열면 최신으로 바뀐다. 개발 중(번호 없음)에는 아무것도 안 한다.
// 일반 스크립트(모듈 아님)라서 import 맵이나 다른 파일에 기대지 않는다. 같은 번호로는 세션당 한 번만 다시 열어 반복을 막는다.
(function () {
  try {
    var meta = document.querySelector('meta[name="build"]');
    if (!meta) return;
    var mine = meta.getAttribute('content');
    var here = new URL(location.href);
    if (here.searchParams.has('_v')) { here.searchParams.delete('_v'); history.replaceState(null, '', here); } // our own marker: gone before the app reads the address
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.v || j.v === mine) return;
        var key = 'open-wall:reloaded-for';
        try { if (sessionStorage.getItem(key) === j.v) return; sessionStorage.setItem(key, j.v); } catch (e) { return; } // no storage = no way to stop a loop
        var next = new URL(location.href);
        next.searchParams.set('_v', j.v);
        location.replace(next);
      })
      .catch(function () {});
  } catch (e) { /* never in the way of the app */ }
})();
