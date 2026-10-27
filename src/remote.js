// src/remote.js — the plain network calls DOM modules used to make inline: a JSON GET, a text GET, a form POST.
// No DOM. fetchFn is injected so tests don't touch the network; the app's own Worker has its own adapter (board-api.js).

/** getJson(url, {fetchFn, timeoutMs}) → parsed JSON, or null when the server answered not-ok. Throws on a network failure or bad JSON. */
export async function getJson(url, { fetchFn = (...a) => fetch(...a), timeoutMs = 8000 } = {}) {
  const res = await fetchFn(url, { credentials: 'omit', signal: AbortSignal.timeout?.(timeoutMs) });
  return res.ok ? res.json() : null;
}

/** getText(url, {fetchFn}) → the body text. Throws on a network failure or a not-ok answer. */
export async function getText(url, { fetchFn = (...a) => fetch(...a) } = {}) {
  const res = await fetchFn(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(String(res.status));
  return res.text();
}

/** postForm(url, body, {fetchFn}) — a Google Form answer (no-cors: the reply can't be read). Throws only on a network failure. */
export async function postForm(url, body, { fetchFn = (...a) => fetch(...a) } = {}) {
  await fetchFn(url, { method: 'POST', mode: 'no-cors', credentials: 'omit', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
}
