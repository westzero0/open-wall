// src/board-view.js — 한 줄 타임라인 on the wall card: last posts, 더 보기, a one-line form, 신고. DOM via el()/textContent only.
// The pure helpers on top are unit-tested; boardBox is the only DOM part. No config.boardUrl = no box, no request.
import { el } from './dom.js';
import { config } from './config.js';
import { NICK_KEY, loadNick, nickLocked, nickMode } from './report.js';
import { createBoardApi } from './board-api.js';
import { MAX_BODY, MAX_NICK, PAGE, ageText, validatePost } from './board.js';

export const COOLDOWN_MS = 20_000;
const MAX_REPORTED = 200;
const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;
const K_TS = 'open-wall:board-ts', K_REP = 'open-wall:board-reported';

/** append incoming posts to existing ones, skipping ids already shown (parseBoard does not dedupe). */
export function mergePosts(existing, incoming) {
  const seen = new Set(existing.map((p) => p.id));
  // newest first, so posts.at(-1) (the 더 보기 cursor) stays the oldest even if a page-1 refetch lands after a failed 더 보기
  return [...existing, ...incoming.filter((p) => !seen.has(p.id) && seen.add(p.id))].sort((a, b) => b.created_at - a.created_at);
}
/** the Worker answered 4xx (unknown wall, post already hidden): retrying cannot help. */
export const isRefused = (e) => e?.code === 'bad_request';
/** saved report ids are untrusted storage: valid ids only, the newest 200. */
export const cleanReported = (raw) => (Array.isArray(raw) ? raw.filter((x) => typeof x === 'string' && ID_RE.test(x)).slice(-MAX_REPORTED) : []);
/** ms left of the post cooldown; a bad or future timestamp locks nothing. */
export function cooldownLeft(ts, now) {
  if (!Number.isFinite(ts) || ts > now) return 0;
  return Math.max(0, COOLDOWN_MS - (now - ts));
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage may be blocked */ } },
};
const loadReported = () => { try { return cleanReported(JSON.parse(store.get(K_REP) || '[]')); } catch { return []; } };

const boxes = new Map(); // one box per wall: re-renders of an open card reuse it instead of fetching again
/** a cached box whose last load failed is worth another try when the card is shown again (and none is in flight). */
export const needsRefetch = ({ failed, fetching }) => !!failed && !fetching;
export function boardBox(wallName) {
  if (!config.boardUrl) return null;
  const box = boxes.get(wallName) || boxes.set(wallName, build(wallName)).get(wallName);
  box.retryIfFailed();
  return box;
}
function build(wallName) {
  const api = createBoardApi({ url: config.boardUrl });
  let posts = [], more = false, loaded = false, failed = false, busy = false, fetching = false;
  const reported = new Set(loadReported());

  const list = el('ul', { class: 'bd-list' });
  const status = el('p', { class: 'bd-status', role: 'status' });
  const retryBtn = el('button', { type: 'button', class: 'bd-more bd-retry', hidden: '' }, '다시 시도');
  const moreBtn = el('button', { type: 'button', class: 'bd-more' }, '더 보기');
  const nick = el('input', { class: 'bd-nick', type: 'text', maxlength: String(MAX_NICK), placeholder: '닉네임', 'aria-label': '닉네임', autocomplete: 'off' });
  nick.value = loadNick(store.get(NICK_KEY) || '');
  const lockedNick = nickLocked(nickMode(config), nick.value); // same ranking-period lock as 내 정보: shown, not editable, never rewritten here
  if (lockedNick) nick.readOnly = true;
  const body = el('input', { class: 'bd-body', type: 'text', maxlength: String(MAX_BODY), placeholder: '한 줄 남기기', 'aria-label': '한 줄 남기기', autocomplete: 'off' });
  // honeypot: unguessable name, hidden + inert + aria-hidden wrapper so no user or screen reader reaches it; bots that fill every input fill it
  const hp = el('input', { type: 'text', name: 'bd_q7x2', tabindex: '-1', autocomplete: 'off' });
  const trap = el('div', { class: 'bd-hp', hidden: '', 'aria-hidden': 'true', inert: '' }, hp);
  const count = el('span', { class: 'bd-count' }, `0/${MAX_BODY}`);
  const send = el('button', { type: 'submit', class: 'bd-send' }, '남기기');
  const form = el('form', { class: 'bd-form' }, el('div', { class: 'bd-row' }, nick, body), trap, el('div', { class: 'bd-row bd-foot' }, count, send));
  const box = el('section', { class: 'bd-box', 'aria-label': '한 줄 타임라인' }, el('h4', { class: 'bd-title' }, '한 줄 타임라인'), list, status, retryBtn, moreBtn, form);

  const say = (t) => { status.textContent = t; };
  function draw() {
    const now = Date.now();
    list.replaceChildren(...posts.map((p) => {
      const rep = el('button', { type: 'button', class: 'bd-rep' }, reported.has(p.id) ? '신고했어요' : '신고');
      rep.disabled = reported.has(p.id);
      rep.addEventListener('click', async () => {
        rep.disabled = true;
        try {
          await api.report(p.id);
        } catch (e) {
          if (!isRefused(e)) { // not recorded: the user can press again
            rep.disabled = false;
            say('신고하지 못했어요. 잠시 뒤에 다시 눌러 주세요');
            return;
          } // 404: already hidden or gone, which is what the report wanted; count it as done
        }
        const saved = new Set(loadReported()); // re-read: another wall's box may have saved since
        saved.add(p.id);
        store.set(K_REP, JSON.stringify([...saved].slice(-MAX_REPORTED)));
        reported.add(p.id);
        rep.textContent = '신고했어요';
      });
      return el('li', { class: 'bd-post' },
        el('p', { class: 'bd-text' }, el('b', { class: 'bd-by' }, p.nick), ' ', p.body),
        el('p', { class: 'bd-meta' }, ageText(p.created_at, now), ' · ', rep));
    }));
    moreBtn.hidden = !more;
    retryBtn.hidden = !(failed && !posts.length);
    if (loaded && !failed && !posts.length) say('아직 글이 없어요. 첫 줄을 남겨 보세요.');
    else if (!failed) say('');
  }
  async function fetchPage(before) {
    fetching = true;
    try {
      const got = await api.list(wallName, before == null ? {} : { before });
      more = got.length >= PAGE; // a full page may have a next one
      posts = mergePosts(posts, got); // merge, never replace: the user may have posted while this was in flight
      failed = false;
    } catch (e) {
      if (isRefused(e)) box.hidden = true; // e.g. a wall the Worker does not know (added or renamed locally): no board, and no retry
      else { failed = true; say('지금은 불러올 수 없어요'); }
    }
    loaded = true; fetching = false;
    draw();
  }
  retryBtn.addEventListener('click', () => { if (needsRefetch({ failed, fetching })) fetchPage(); });
  moreBtn.addEventListener('click', async () => {
    moreBtn.disabled = true;
    await fetchPage(posts.at(-1)?.created_at);
    moreBtn.disabled = false;
  });
  body.addEventListener('input', () => { count.textContent = `${[...body.value].length}/${MAX_BODY}`; });
  function tick() {
    const left = cooldownLeft(Number(store.get(K_TS)), Date.now());
    send.disabled = busy || left > 0;
    if (left > 0) setTimeout(tick, Math.min(left, 1000));
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    const v = validatePost({ wall: wallName, nick: nick.value, body: body.value });
    if (!v.ok) { say(v.error); return; }
    busy = true; tick();
    try {
      const p = await api.post({ ...v.post, hp: hp.value });
      if (!lockedNick) store.set(NICK_KEY, v.post.nick);
      store.set(K_TS, String(Date.now()));
      posts = mergePosts([p], posts); // newest first; a later fetch returning it is deduped
      body.value = ''; count.textContent = `0/${MAX_BODY}`;
      failed = false; draw();
    } catch (err) {
      say(err.code === 'bad_request' ? '내용을 다시 확인해 주세요' : '잠시 뒤에 다시 써 주세요');
    }
    busy = false; tick();
  });
  tick();
  box.retryIfFailed = () => { if (needsRefetch({ failed, fetching })) fetchPage(); };
  fetchPage(); // once: rowDetails builds this box when the card opens
  return box;
}
