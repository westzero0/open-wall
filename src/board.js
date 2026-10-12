// src/board.js — 한 줄 타임라인 (per-wall board): validation shared by the browser and the Worker. Pure, no DOM.
// Imports only clean-line.js so the Worker bundle stays small. Everything read back from the server is untrusted.
import { cleanLine } from './clean-line.js';

export const MAX_BODY = 140;
export const MAX_NICK = 6;
export const PAGE = 5;
export const PREVIEW = 3; // posts on the wall card; the rest is on the board page
export const COUNT_FROM = 11; // the 전체 글 보기 button shows the count from this many posts up
const MAX_ROWS = 100;
const MAX_REPLY_COUNT = 1000; // a reply_count above this (or not a whole number) is not believed
const SKEW = 5 * 60 * 1000;
const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;

export const cleanBody = (v) => cleanLine(v, MAX_BODY);
export const cleanBoardNick = (v) => cleanLine(v, MAX_NICK);

/** validatePost({wall, nick, body}) → { ok, post } with cleaned text, or { ok:false, error }. The wall allow-list is the Worker's job. */
export function validatePost(p) {
  const wall = p && typeof p.wall === 'string' ? p.wall : '';
  const nick = cleanBoardNick(p?.nick);
  const body = cleanBody(p?.body);
  if (!wall) return { ok: false, error: '암장을 알 수 없어요' };
  if (!nick) return { ok: false, error: '닉네임을 적어 주세요' };
  if (!body) return { ok: false, error: '내용을 적어 주세요' };
  return { ok: true, post: { wall, nick, body } };
}

/** parseBoard(raw, wallName, now) → the usable posts of an untrusted { posts: [...] } response. */
export function parseBoard(raw, wallName, now) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.posts)) return [];
  const out = [];
  for (const r of raw.posts.slice(0, MAX_ROWS)) {
    if (!r || typeof r !== 'object' || r.wall !== wallName) continue;
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) continue;
    const t = r.created_at;
    if (!Number.isInteger(t) || t < 0 || t > now + SKEW) continue;
    const nick = cleanBoardNick(r.nick);
    const body = cleanBody(r.body);
    const rc = r.reply_count;
    if (nick && body) out.push({ id: r.id, wall: r.wall, nick, body, created_at: t, replyCount: Number.isInteger(rc) && rc >= 0 && rc <= MAX_REPLY_COUNT ? rc : 0 });
  }
  return out;
}

const TOKEN_RE = /^[0-9a-f]{32}$/;
export const MAX_MINE = 200;
/** the delete token of a create response when it has the expected form, else null (old Workers send none). */
export const parseToken = (raw) => (typeof raw?.delete_token === 'string' && TOKEN_RE.test(raw.delete_token) ? raw.delete_token : null);
/** saved { postId: token } is untrusted storage: valid pairs only, the newest MAX_MINE (insertion order). */
export function cleanMine(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const pairs = Object.entries(raw).filter(([id, t]) => ID_RE.test(id) && typeof t === 'string' && TOKEN_RE.test(t));
  return Object.fromEntries(pairs.slice(-MAX_MINE));
}

/** parseTotal(raw) → the response's `total` when it is a whole number >= 0, else null (old Workers send none). */
export const parseTotal = (raw) => (Number.isInteger(raw?.total) && raw.total >= 0 ? raw.total : null);

/** more posts to fetch? The Worker's total when known, else a full last page; an empty last page always ends it (parseBoard may drop rows, so loaded can stay below total). */
export const hasMore = (total, loaded, lastPage) => lastPage > 0 && (total != null ? loaded < total : lastPage >= PAGE);

/** show the 전체 글 보기 button on the card? */
export const showAll = (total, loaded) => (total ?? loaded) > PREVIEW;
export const allLabel = (total) => (total != null && total >= COUNT_FROM ? `전체 글 보기 (${total})` : '전체 글 보기');

/** parseReplies(raw, wallName, now) → the usable rows of an untrusted { replies: [...] } response (same checks as posts). */
export const parseReplies = (raw, wallName, now) => parseBoard({ posts: raw?.replies }, wallName, now);

/** ageText(createdAt, now) → '방금' / '12분 전' / '3시간 전' / 'M/D' (local date once a day has passed). */
export function ageText(createdAt, now) {
  const s = (now - createdAt) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  const d = new Date(createdAt);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
