// src/board-view.js — 한 줄 타임라인: the latest posts on the wall card (preview) or all of them on the board page (full), a one-line form, 신고.
// One state per wall (boardState) feeds both views, so a post written in one shows in the other and nothing is fetched twice.
// DOM via el()/textContent only. The pure helpers and the state are unit-tested; boardBox is the only DOM part. No config.boardUrl = no box, no request.
import { el } from './dom.js';
import { config } from './config.js';
import { NICK_KEY, loadNick, nickLocked, nickMode } from './report.js';
import { createBoardApi } from './board-api.js';
import { MAX_BODY, MAX_NICK, PREVIEW, ageText, cleanBoardNick, allLabel, cleanMine, hasMore, showAll, validatePost } from './board.js';

export const COOLDOWN_MS = 20_000;
const MAX_REPORTED = 200;
const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;
const K_TS = 'open-wall:board-ts', K_REP = 'open-wall:board-reported', K_MINE = 'open-wall:board-mine', K_NICK_DRAFT = 'open-wall:board-nick-draft';

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

const HUES = [160, 38, 340, 215, 95, 20]; // moss, sun, wine, slate blue, olive, clay: the brand's colours, so no name lands on an off-palette hue
/** a nickname's colour (hue 0-359): the same name always gets the same one. */
export function avatarOf(nick) {
  const name = String(nick ?? '').trim() || '익명';
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) % 360;
  return { hue: HUES[h % HUES.length] };
}
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const clockText = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dot = (nick) => {
  const d = el('i', { class: 'bd-dot', 'aria-hidden': 'true' });
  d.style.setProperty('--h', String(avatarOf(nick).hue));
  return d;
};
const SEND_ICON = 'M3.4 20.4 21 12 3.4 3.6l-.01 6.5L15 12 3.39 13.9z';
const sendIcon = () => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', SEND_ICON); path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
};

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

/** replies are read oldest first, like a conversation (mergePosts sorts newest first). */
export function mergeReplies(existing, incoming) {
  const seen = new Set(existing.map((p) => p.id));
  return [...existing, ...incoming.filter((p) => !seen.has(p.id) && seen.add(p.id))].sort((a, b) => a.created_at - b.created_at);
}

/** a cached box whose last load failed is worth another try when the card is shown again (and none is in flight). */
export const needsRefetch = ({ failed, fetching }) => !!failed && !fetching;

/** The posts of one wall plus what is known about them. Views subscribe and redraw on every change. */
export function makeBoardState(wallName, api) {
  const s = { posts: [], total: null, more: false, loaded: false, failed: false, fetching: false, refused: false };
  s.replies = new Map(); // post id -> { list (oldest first), loaded, failed, loading }
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
  const entry = (id) => s.replies.get(id) || s.replies.set(id, { list: [], loaded: false, failed: false, loading: false }).get(id);
  const bump = (id, by) => { s.posts = s.posts.map((p) => (p.id === id ? { ...p, replyCount: Math.max(0, (p.replyCount || 0) + by) } : p)); };
  const drop = (id) => {
    s.replies.delete(id);
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
  /** the replies of one post, read once when it is first opened (again after a failure). A 404 means the post is gone. */
  s.loadReplies = async (id) => {
    const e = entry(id);
    if (e.loaded || e.loading) return;
    e.loading = true; e.failed = false;
    emit();
    try {
      e.list = mergeReplies(e.list, await api.replies(wallName, id));
      e.loaded = true;
    } catch (err) {
      if (isRefused(err)) { drop(id); return; }
      e.failed = true;
    }
    e.loading = false;
    emit();
  };
  /** like submit, under a post: appended last, the post's count + 1. Resolves { post, token }. */
  s.submitReply = async (parent, post) => {
    const { post: p, token } = await api.post({ ...post, parent });
    const e = entry(parent);
    e.list = mergeReplies(e.list, [p]);
    bump(parent, 1);
    emit();
    return { post: p, token };
  };
  s.deleteReply = async (parent, id, token) => {
    try { await api.remove(id, token); } catch (err) { if (!isRefused(err)) throw err; }
    const e = entry(parent);
    e.list = e.list.filter((p) => p.id !== id);
    bump(parent, -1);
    emit();
  };
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
  const reported = new Set(loadReported());
  const open = new Set(); // posts whose replies are shown (full mode)
  const threads = new Map(); // post id -> { box, ul, st }: built once, so a half-written reply survives a redraw
  const forms = []; // { send, busy } of every form in this view: they share one cooldown
  let refocus = null; // the post id whose 답글 button was just pressed

  const list = el('ul', { class: 'bd-list' });
  const status = el('p', { class: 'bd-status', role: 'status' });
  const retryBtn = el('button', { type: 'button', class: 'bd-more bd-retry', hidden: '' }, '다시 시도');
  const moreBtn = el('button', { type: 'button', class: 'bd-more', hidden: '' }, '더 보기');
  const allBtn = el('button', { type: 'button', class: 'bd-more bd-all', hidden: '' }, allLabel(null));
  const say = (t) => { status.textContent = t; };

  /** the one-line form: a new post (parent null) or a reply under `parent`. Errors go to statusEl. */
  function makeForm(parent, statusEl) {
    const nick = el('input', { class: 'bd-nick', type: 'text', maxlength: String(MAX_NICK), placeholder: '닉네임', 'aria-label': '닉네임', autocomplete: 'off' });
    // The ranking nickname is set in 내 정보 / the report sheet, never here: this field shows it (locked while the ranking runs) or,
    // with none saved, a draft that only prefills the field. The lock reads the saved name alone, and again at send time.
    const savedNick = () => loadNick(store.get(NICK_KEY));
    const isLocked = () => nickLocked(nickMode(config), savedNick());
    nick.value = savedNick() || loadNick(store.get(K_NICK_DRAFT) || '');
    if (isLocked()) nick.readOnly = true;
    nick.addEventListener('input', () => { if (!isLocked()) store.set(K_NICK_DRAFT, cleanBoardNick(nick.value)); });
    const label = parent ? '답글 남기기' : '한 줄 남기기';
    const body = el('input', { class: 'bd-body', type: 'text', maxlength: String(MAX_BODY), placeholder: label, 'aria-label': label, autocomplete: 'off' });
    // honeypot: unguessable name, hidden + inert + aria-hidden wrapper so no user or screen reader reaches it; bots that fill every input fill it
    const hp = el('input', { type: 'text', name: 'bd_q7x2', tabindex: '-1', autocomplete: 'off' });
    const trap = el('div', { class: 'bd-hp', hidden: '', 'aria-hidden': 'true', inert: '' }, hp);
    const count = el('span', { class: 'bd-count' }, `0/${MAX_BODY}`);
    const send = el('button', { type: 'submit', class: 'bd-send', 'aria-label': '남기기', title: '남기기' }, sendIcon());
    const form = el('form', { class: 'bd-form' },
      el('div', { class: 'bd-row bd-who' }, nick, el('span', { class: 'bd-hint' }, '모두에게 공개돼요')),
      el('div', { class: 'bd-row bd-compose' }, body, count, send), trap);
    const me = { send, busy: false };
    forms.push(me);
    body.addEventListener('input', () => { count.textContent = `${[...body.value].length}/${MAX_BODY}`; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (send.disabled) return;
      if (isLocked()) { nick.value = savedNick(); nick.readOnly = true; } // the name was saved elsewhere since this form was built
      const v = validatePost({ wall: wallName, nick: nick.value, body: body.value });
      if (!v.ok) { statusEl.textContent = v.error; return; }
      me.busy = true; tick();
      try {
        const payload = { ...v.post, hp: hp.value };
        const made = parent ? await s.submitReply(parent, payload) : await s.submit(payload); // redraws every view of this wall
        rememberMine(made.post.id, made.token);
        store.set(K_NICK_DRAFT, v.post.nick); // the next form starts with it; it never becomes the saved (ranking) nickname
        store.set(K_TS, String(Date.now()));
        body.value = ''; count.textContent = `0/${MAX_BODY}`;
        s.notify();
      } catch (err) {
        statusEl.textContent = err.code === 'bad_request' ? (parent ? '이 글에는 답글을 달 수 없어요. 내용을 다시 확인해 주세요' : '내용을 다시 확인해 주세요') : '잠시 뒤에 다시 써 주세요';
      }
      me.busy = false; tick();
    });
    return form;
  }
  const mainForm = makeForm(null, status);
  const box = el('section', { class: `bd-box bd-${mode}`, tabindex: '-1', 'aria-label': '한 줄 타임라인' }, mode === 'full' ? el('header', { class: 'bd-hero' }, el('i', { class: 'bd-sun' }), el('i', { class: 'bd-slab' }), el('h3', {}, '한 줄 타임라인'), el('p', {}, '오늘 이 벽에서 있었던 일, 한 줄로')) : el('h4', { class: 'bd-title' }, '한 줄 타임라인'), list, status, retryBtn, moreBtn, allBtn, mainForm);

  /** the author's own button: 삭제, then 정말 삭제 (press again within 4 s), then gone. `parent`: this is a reply under it. */
  function deleteButton(id, token, parent) {
    const b = el('button', { type: 'button', class: 'bd-rep bd-del' }, '삭제');
    let armed = 0;
    b.addEventListener('click', async () => {
      if (!armed) { b.textContent = '정말 삭제'; armed = setTimeout(() => { armed = 0; b.textContent = '삭제'; }, 4000); return; }
      clearTimeout(armed); armed = 0; b.disabled = true;
      try {
        await (parent ? s.deleteReply(parent, id, token) : s.delete(id, token));
        forgetMine(id);
      } catch {
        b.disabled = false; b.textContent = '삭제';
        say('지우지 못했어요. 잠시 뒤에 다시 눌러 주세요');
      }
    });
    return b;
  }
  function reportButton(p) {
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
    return rep;
  }
  const actionFor = (p, parent) => (getMine()[p.id] ? deleteButton(p.id, getMine()[p.id], parent) : reportButton(p));

  function toggleThread(id) {
    if (open.has(id)) open.delete(id); else { open.add(id); s.loadReplies(id); }
    refocus = id;
    draw();
  }
  /** the replies of one post and the form to answer, built once per post. */
  function threadFor(id) {
    let t = threads.get(id);
    if (!t) {
      const ul = el('ul', { class: 'bd-replies' });
      const st = el('p', { class: 'bd-status', role: 'status' });
      t = { box: el('div', { class: 'bd-thread' }, ul, st, makeForm(id, st)), ul, st };
      threads.set(id, t);
    }
    const e = s.replies.get(id);
    const now = Date.now();
    t.ul.replaceChildren(...(e?.list ?? []).map((r) => el('li', { class: 'bd-post bd-reply' },
      el('div', { class: 'bd-main' },
        el('p', { class: 'bd-head' }, dot(r.nick), el('b', { class: 'bd-by' }, r.nick), el('span', { class: 'bd-meta' }, ageText(r.created_at, now))),
        el('p', { class: 'bd-text' }, r.body),
        el('p', { class: 'bd-acts' }, actionFor(r, id))))));
    t.st.textContent = e?.failed ? '답글을 불러오지 못했어요' : e?.loading ? '불러오는 중…' : '';
    return t.box;
  }
  function postItem(p, now, fresh = false) {
    const n = p.replyCount || 0;
    let replyBtn = null;
    if (mode === 'full') {
      replyBtn = el('button', { type: 'button', class: 'bd-rep bd-rp', 'aria-expanded': String(open.has(p.id)), 'data-toggle': p.id }, n ? `답글 ${n}` : '답글');
      replyBtn.addEventListener('click', () => toggleThread(p.id));
    } else if (n) {
      replyBtn = el('button', { type: 'button', class: 'bd-rep bd-rp' }, `답글 ${n}`);
      replyBtn.addEventListener('click', () => onOpenAll?.(replyBtn));
    }
    const today = sameDay(p.created_at, now);
    const li = el('li', { class: `bd-post${fresh ? ' bd-new' : ''}${today ? '' : ' bd-old'}` },
      el('time', { class: 'bd-time', datetime: new Date(p.created_at).toISOString() }, today ? clockText(p.created_at) : ageText(p.created_at, now)),
      el('div', { class: 'bd-main' },
        el('p', { class: 'bd-head' }, el('b', { class: 'bd-by' }, p.nick)),
        el('p', { class: 'bd-text' }, p.body),
        el('p', { class: 'bd-acts' }, replyBtn, actionFor(p, null)),
        mode === 'full' && open.has(p.id) ? threadFor(p.id) : null));
    return li;
  }
  let newest = 0; // created_at of the newest post drawn so far: only a post newer than that, arriving after the first load, animates in (not older ones from 더 보기)
  let wasLoaded = false;
  function draw() {
    box.hidden = s.refused && mode !== 'full'; // a wall the Worker does not know: the card's preview hides; the sheet's tab says there is no board instead of going blank
    box.classList.toggle('bd-off', s.refused);
    const a = document.activeElement; // a redraw (the replies arriving) must not drop focus from the 답글 button that was pressed
    const keep = refocus ?? (a && list.contains(a) ? a.dataset.toggle : null);
    const typing = a && list.contains(a) && !a.dataset.toggle && (a.tagName === 'INPUT') ? a : null; // a reply input: its thread box is kept, only detached by the redraw
    refocus = null;
    const now = Date.now();
    const shown = mode === 'preview' ? s.posts.slice(0, PREVIEW) : s.posts;
    const items = [];
    let day = null; // full mode: 오늘 / 지난 글 headings (볕과 그늘)
    for (const p of shown) {
      const today = sameDay(p.created_at, now);
      if (mode === 'full' && day !== today) { day = today; items.push(el('li', { class: `bd-day${today ? '' : ' bd-shade'}` }, today ? '오늘' : '지난 글')); }
      items.push(postItem(p, now, wasLoaded && p.created_at > newest));
    }
    list.replaceChildren(...items);
    for (const p of shown) newest = Math.max(newest, p.created_at);
    wasLoaded = s.loaded;
    moreBtn.hidden = mode !== 'full' || !s.more;
    allBtn.hidden = mode !== 'preview' || !showAll(s.total, s.posts.length);
    allBtn.textContent = allLabel(s.total);
    retryBtn.hidden = !(s.failed && !s.posts.length);
    if (s.failed) say('지금은 불러올 수 없어요');
    else if (s.loaded && !s.posts.length) say('아직 글이 없어요. 첫 줄을 남겨 보세요.');
    else say('');
    if (s.refused) say('이 암장은 게시판이 없어요.');
    if (keep) list.querySelector(`[data-toggle="${keep}"]`)?.focus();
    else if (typing?.isConnected) typing.focus({ preventScroll: true });
    tick();
  }
  retryBtn.addEventListener('click', () => s.retryIfFailed());
  moreBtn.addEventListener('click', async () => {
    moreBtn.disabled = true;
    await s.fetchPage(s.posts.at(-1)?.created_at);
    moreBtn.disabled = false;
  });
  allBtn.addEventListener('click', () => onOpenAll?.(allBtn));
  let timer = 0;
  function tick() {
    clearTimeout(timer);
    const left = cooldownLeft(Number(store.get(K_TS)), Date.now());
    for (const f of forms) f.send.disabled = f.busy || left > 0;
    if (left > 0) timer = setTimeout(tick, Math.min(left, 1000));
  }
  s.subscribe(draw);
  box.retryIfFailed = () => s.retryIfFailed();
  draw();
  s.start();
  return box;
}
