import { isKakaoInApp } from './inapp.js';
// src/install.js — 내 정보 › 홈 화면에 추가. Chrome (Android) offers an install prompt we keep until the button asks for it;
// iOS Safari has none, so it only gets the way to do it by hand. Already installed, or any other browser: nothing shown.
let saved = null; // the beforeinstallprompt event

/** The row to show: 'prompt' (a button), 'ios' (a line of steps) or 'none'. */
export const installMode = ({ standalone, prompt, ios, inApp = false }) => (standalone ? 'none' : inApp ? 'inapp' : prompt ? 'prompt' : ios ? 'ios' : 'none'); // inapp: KakaoTalk's browser cannot install; the way out is the default browser

const win = globalThis.window;
if (win) {
  win.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); saved = e; });
  win.addEventListener('appinstalled', () => { saved = null; });
}

const isIos = (nav) => /iphone|ipad|ipod/i.test(nav.userAgent ?? '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1); // iPadOS says Mac
export const currentInstallMode = () => installMode({
  standalone: !!(win?.matchMedia?.('(display-mode: standalone)').matches || win?.navigator?.standalone),
  prompt: !!saved,
  ios: !!win && isIos(win.navigator),
  inApp: !!win && isKakaoInApp(win.navigator.userAgent),
});

/** Shows the install prompt; true when the visitor accepted. The event works once, so it is dropped either way. */
export async function promptInstall() {
  if (!saved) return false;
  const e = saved;
  saved = null;
  try {
    e.prompt();
    return (await e.userChoice)?.outcome === 'accepted';
  } catch { return false; }
}
