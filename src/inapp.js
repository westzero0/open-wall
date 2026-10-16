// src/inapp.js — 카카오톡 인앱브라우저 안내. 그 안의 저장소는 크롬·사파리와 따로라서 닉네임·필터가 다른 브라우저에선 안 보인다.
// 카카오톡이 열어 주는 외부 브라우저 주소(kakaotalk://web/openExternal)는 iOS·Android 모두 된다.
export const isKakaoInApp = (ua = '') => /KAKAOTALK/i.test(ua);

// from=kakao rides along so the browser it lands in can offer the install once (app.js reads it and removes it).
export const externalOpenUrl = (href) => {
  const u = new URL(href);
  u.searchParams.set('from', 'kakao');
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(u.href)}`;
};
// The address the page was opened with: app.js strips ?wall/&type=… with replaceState at startup, so a later click must not read location.href.
export const entryHref = typeof location === 'undefined' ? '' : location.href;
export const fromKakao = (search = '') => new URLSearchParams(search).get('from') === 'kakao';

const KEY = 'open-wall:inapp-closed';
export const inAppClosed = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const closeInApp = () => { try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked: shows again next visit */ } };

const INSTALL_KEY = 'open-wall:install-closed';
export const installClosed = () => { try { return localStorage.getItem(INSTALL_KEY) === '1'; } catch { return false; } };
export const closeInstall = () => { try { localStorage.setItem(INSTALL_KEY, '1'); } catch { /* storage blocked: shows again next visit */ } };

/** howtoDue({introDone, kakao, kakaoClosed, shareLink}) → {intro, kakao} | null: what the "화면 읽는 법" sheet shows when it opens by itself.
 *  A share link skips the reading guide (the visitor came for one wall) but still gets the KakaoTalk notice: that one has a consequence. */
export const howtoDue = ({ introDone, kakao, kakaoClosed, shareLink }) => {
  const intro = !introDone && !shareLink;
  const k = Boolean(kakao) && !kakaoClosed;
  return intro || k ? { intro, kakao: k } : null;
};
