// src/board-view.js — 한 줄 타임라인: the latest posts on the wall card (preview) or all of them on the board page (full), a one-line form, 신고.
// One state per wall (boardState) feeds both views, so a post written in one shows in the other and nothing is fetched twice.
// DOM via el()/textContent only. The pure helpers and the state are unit-tested; boardBox is the only DOM part. No config.boardUrl = no box, no request.
import { el } from './dom.js';
import { config } from './config.js';
import { NICK_KEY, loadNick, nickLocked, nickMode } from './report.js';
import { createBoardApi } from './board-api.js';
import { MAX_BODY, MAX_NICK, PREVIEW, ageText, allLabel, cleanMine, hasMore, showAll, validatePost } from './board.js';

export const COOLDOWN_MS = 20_000;
const MAX_REPORTED = 200;
const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;
const K_TS = 'open-wall:board-ts', K_REP = 'open-wall:board-reported', K_MINE = 'open-wall:board-mine';

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

// The posts this device wrote and the token that deletes each one ({ postId: token }). Shared by every view; the token never leaves the device except in the DELETE header.
let mine = null;
const getMine = () => mine ??= (() => { try { return cleanMine(JSON.parse(store.get(K_MINE) || '{}')); } catch { return {}; } })();
const saveMine = () => { mine = cleanMine(mine); store.set(K_MINE, JSON.stringify(mine)); };
const rememberMine = (id, token) => { if (token) { getMine()[id] = token; saveMine(); } };
const forgetMine = (id) => { delete getMine()[id]; saveMine(); };

/** a cached box whose last load failed is worth another try when the card is shown again (and none is in flight). */
export const needsRefetch = ({ failed, fetching }) => !!failed && !fetching;

/** The posts of one wall plus what is known about them. Views subscribe and redraw on every change. */
export function makeBoardState(wallName, api) {
  const s = { posts: [], total: null, more: false, loaded: false, failed: false, fetching: false, refused: false };
  const subs = new Set();
  const emit = () => subs.forEach((f) => f());
  let started = false;
  s.subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
  s.fetchPage = async (before) => {
    s.fetching = true;
    try {
      const got = await api.list(wallName, before == null ? {} : { before });
      if (got.total != null) s.total = got.total;
      s.posts = mergePosts(s.posts, got.posts); // merge, never replace: the user may have posted while this was in flight
      s.more = hasMore(s.total, s.posts.length, got.posts.length);
      s.failed = false;
    } catch (e) {
      if (isRefused(e)) s.refused = true; // e.g. a wall the Worker does not know (added or renamed locally): no board, and no retry
      else s.failed = true;
    }
    s.loaded = true; s.fetching = false;
    emit();
  };
  s.start = () => { if (!started) { started = true; s.fetchPage(); } }; // once: by the first view built
  s.retryIfFailed = () => { if (needsRefetch(s)) s.fetchPage(); };
  /** throws the api's error; on success the new post is first and a known total grows by one. Resolves { post, token }. */
  s.submit = async (post) => {
    const { post: p, token } = await api.post(post);
    s.posts = mergePosts([p], s.posts); // a later fetch returning it is deduped
    if (s.total != null) s.total += 1;
    s.failed = false;
    emit();
    return { post: p, token };
  };
  const drop = (id) => {
    s.posts = s.posts.filter((p) => p.id !== id);
    if (s.total != null) s.total = Math.max(0, s.total - 1);
    emit();
  };
  /** the author deletes: gone from the server (or already gone, 404) = gone from the list; other errors throw and keep the post. */
  s.delete = async (id, token) => {
    try { await api.remove(id, token); } catch (e) { if (!isRefused(e)) throw e; }
    drop(id);
  };
  s.report = (id) => api.report(id);
  s.notify = emit; // views redraw (e.g. the post cooldown that one of them just started)
  return s;
}
const states = new Map(); // one state per wall
export const boardState = (wallName) => states.get(wallName) || states.set(wallName, makeBoardState(wallName, createBoardApi({ url: config.boardUrl }))).get(wallName);

const boxes = new Map(); // one view per wall and mode: re-renders of an open card reuse it instead of building again
/**
 * The 한 줄 타임라인 of a wall, or null when the board is off.
 * mode 'preview' (default): the latest PREVIEW posts and a 전체 글 보기 button (calls onOpenAll(button)); 'full': every post, 더 보기.
 */
export function boardBox(wallName, { mode = 'preview', onOpenAll } = {}) {
  if (!config.boardUrl) return null;
  const key = `${mode}|${wallName}`;
  const box = boxes.get(key) || boxes.set(key, build(wallName, mode, onOpenAll)).get(key);
  box.retryIfFailed();
  return box;
}
function build(wallName, mode, onOpenAll) {
  const s = boardState(wallName);
  let busy = false;
  const reported = new Set(loadReported());

  const list = el('ul', { class: 'bd-list' });
  const status = el('p', { class: 'bd-status', role: 'status' });
  const retryBtn = el('button', { type: 'button', class: 'bd-more bd-retry', hidden: '' }, '다시 시도');
  const moreBtn = el('button', { type: 'button', class: 'bd-more', hidden: '' }, '더 보기');
  const allBtn = el('button', { type: 'button', class: 'bd-more bd-all', hidden: '' }, allLabel(null));
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
  const form = el('form', { class: 'bd-form' }, el('div', { class: 'bd-row' }, nick, body), trap, el('div', { class: 'bd-row bd-foot' }, el('span', { class: 'bd-hint' }, count, ' · 모두에게 공개돼요'), send));
  const box = el('section', { class: `bd-box bd-${mode}`, tabindex: '-1', 'aria-label': '한 줄 타임라인' }, mode === 'full' ? null : el('h4', { class: 'bd-title' }, '한 줄 타임라인'), list, status, retryBtn, moreBtn, allBtn, form);

  const say = (t) => { status.textContent = t; };
  /** the author's own button: 삭제, then 정말 삭제 (press again within 4 s), then gone. */
  function deleteButton(id, token) {
    const b = el('button', { type: 'button', class: 'bd-rep bd-del' }, '삭제');
    let armed = 0;
    b.addEventListener('click', async () => {
      if (!armed) { b.textContent = '정말 삭제'; armed = setTimeout(() => { armed = 0; b.textContent = '삭제'; }, 4000); return; }
      clearTimeout(armed); armed = 0; b.disabled = true;
      try {
        await s.delete(id, token);
        forgetMine(id);
      } catch {
        b.disabled = false; b.textContent = '삭제';
        say('지우지 못했어요. 잠시 뒤에 다시 눌러 주세요');
      }
    });
    return b;
  }
  function draw() {
    box.hidden = s.refused;
    const now = Date.now();
    const shown = mode === 'preview' ? s.posts.slice(0, PREVIEW) : s.posts;
    list.replaceChildren(...shown.map((p) => {
      const token = getMine()[p.id];
      if (token) return el('li', { class: 'bd-post' }, el('p', { class: 'bd-text' }, el('b', { class: 'bd-by' }, p.nick), ' ', p.body), el('p', { class: 'bd-meta' }, ageText(p.created_at, now), ' · ', deleteButton(p.id, token)));
      const rep = el('button', { type: 'button', class: 'bd-rep' }, reported.has(p.id) ? '신고했어요' : '신고');
      rep.disabled = reported.has(p.id);
      rep.addEventListener('click', async () => {
        rep.disabled = true;
        try {
          await s.report(p.id);
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
    moreBtn.hidden = mode !== 'full' || !s.more;
    allBtn.hidden = mode !== 'preview' || !showAll(s.total, s.posts.length);
    allBtn.textContent = allLabel(s.total);
    retryBtn.hidden = !(s.failed && !s.posts.length);
    if (s.failed) say('지금은 불러올 수 없어요');
    else if (s.loaded && !s.posts.length) say('아직 글이 없어요. 첫 줄을 남겨 보세요.');
    else say('');
    tick();
  }
  retryBtn.addEventListener('click', () => s.retryIfFailed());
  moreBtn.addEventListener('click', async () => {
    moreBtn.disabled = true;
    await s.fetchPage(s.posts.at(-1)?.created_at);
    moreBtn.disabled = false;
  });
  allBtn.addEventListener('click', () => onOpenAll?.(allBtn));
  body.addEventListener('input', () => { count.textContent = `${[...body.value].length}/${MAX_BODY}`; });
  let timer = 0;
  function tick() {
    clearTimeout(timer);
    const left = cooldownLeft(Number(store.get(K_TS)), Date.now());
    send.disabled = busy || left > 0;
    if (left > 0) timer = setTimeout(tick, Math.min(left, 1000));
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    const v = validatePost({ wall: wallName, nick: nick.value, body: body.value });
    if (!v.ok) { say(v.error); return; }
    busy = true; tick();
    try {
      const made = await s.submit({ ...v.post, hp: hp.value }); // redraws every view of this wall
      rememberMine(made.post.id, made.token);
      if (!lockedNick) store.set(NICK_KEY, v.post.nick);
      store.set(K_TS, String(Date.now()));
      body.value = ''; count.textContent = `0/${MAX_BODY}`;
      s.notify();
    } catch (err) {
      say(err.code === 'bad_request' ? '내용을 다시 확인해 주세요' : '잠시 뒤에 다시 써 주세요');
    }
    busy = false; tick();
  });
  s.subscribe(draw);
  box.retryIfFailed = () => s.retryIfFailed();
  draw();
  s.start();
  return box;
}
