// src/splash.js — the logo shown while the app opens (index.html #splash). It stays at least MIN_MS from the start of the
// navigation (so a fast phone still shows it, a slow one never waits longer than the load itself), then fades out.
// If the app never reports ready (a script error), MAX_MS takes it away so the page is never covered for good.
const MIN_MS = 300;
const FADE_MS = 200;
const MAX_MS = 8000;
const el = document.getElementById('splash');
let hidden = false;

function hide() {
  if (hidden || !el) return;
  hidden = true;
  el.classList.add('done');
  setTimeout(() => el.remove(), FADE_MS + 100);
}

/** hideSplash() — the app is ready: fade the logo out once MIN_MS have passed since the navigation began. */
export function hideSplash() {
  setTimeout(hide, Math.max(0, MIN_MS - performance.now()));
}

setTimeout(hide, MAX_MS);
