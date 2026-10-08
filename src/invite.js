// src/invite.js — 같이 가요: an invite is a share link that also carries a moment ("토요일 14:00") and a few words.
// Pure logic, no DOM: building and reading the link, cleaning what a stranger put in it, checking the moment against the
// wall's hours and sun, and the message text. Everything read back from a link is untrusted (see cleanNote).
import { hasHours, openIntervals } from './hours.js';
import { isSunlit } from './sun.js';
import { dayText, fmtMin, sunIntervals } from './viewmodel.js';
import { CHAT_URL_RE } from './store.js';
import { sharePageUrl } from './share-id.js';

// The only tags an invite can carry: an id in the link, a label on screen. Free text never becomes a tag.
export const TAGS = [['beginner', '초보 환영'], ['lead', '리드'], ['rope', '로프 챙겨 와요'], ['meet', '주차장에서 만나요']];
export const MAX_NOTE = 40;
export const MAX_COUNT = 10;

const p2 = (n) => String(n).padStart(2, '0');
const toDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * cleanNote(v) → a short plain line. The note is typed by whoever made the link and shown to whoever opens it, so
 * links, markup, e-mails and phone-like numbers are removed (no way to lead a stranger off the page or to a number), control and
 * direction-changing characters are dropped, spaces collapse, and it is cut at MAX_NOTE characters.
 */
export function cleanNote(v) {
  if (typeof v !== 'string') return '';
  const s = v.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/<[^>]*>/g, ' ') // markup: the tag goes, its text stays
    .replace(/[<>]/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/\+?(?:\d[\s().-]*){7,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...s].slice(0, MAX_NOTE).join('').trim();
}

/** cleanTags(v) → the known tag ids, once each, in TAGS order. v: an array or a comma list. */
export function cleanTags(v) {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return TAGS.map(([id]) => id).filter((id) => list.includes(id));
}

/** cleanCount(v) → a whole number 1..MAX_COUNT, else null. */
export function cleanCount(v) {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= MAX_COUNT ? n : null;
}

/** cleanKind(v) → 'have' (a group is already going) or 'look' (looking for people); anything else is 'look'. */
export const cleanKind = (v) => (v === 'have' ? 'have' : 'look');

/** headsPhrase(n, kind) → "3명 정도 찾아요" / "3명 있어요"; null without a head-count. */
export const headsPhrase = (n, kind = 'look') => {
  const count = cleanCount(n);
  if (!count) return null;
  return cleanKind(kind) === 'have' ? `${count}명 있어요` : `${count}명 정도 찾아요`;
};

/** parseMoment('2026-10-10T14:30') → { date, min } for a real calendar day and a real time, else null. */
export function parseMoment(s) {
  const m = typeof s === 'string' ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s) : null;
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d || h > 23 || mi > 59) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, min: h * 60 + mi };
}

export const momentString = (date, min) => `${date}T${p2(Math.floor(min / 60))}:${p2(min % 60)}`;

/**
 * buildInviteUrl(href, { name, date, min, n, tags, note }) → the wall's share page (w/<id>/, its own link preview) with only
 * the invite params; the page adds wall=<name> and keeps these when it sends the visitor on to the app.
 */
export function buildInviteUrl(href, { name, date, min, n = null, kind = 'look', tags = [], note = '' }) {
  const u = sharePageUrl(href, name);
  u.searchParams.set('at', momentString(date, min));
  const count = cleanCount(n);
  const kinds = cleanTags(tags);
  const text = cleanNote(note);
  if (count) u.searchParams.set('n', String(count));
  if (count && cleanKind(kind) === 'have') u.searchParams.set('k', 'have'); // looking is the default, so it is not written
  if (kinds.length) u.searchParams.set('tags', kinds.join(','));
  if (text) u.searchParams.set('note', text);
  return u.toString();
}

/**
 * parseInvite(search, now) → { name, date, min, n, tags, note, past } or null. Null unless the link names a wall and a
 * valid moment (anything else is an ordinary share link). The wall is only a name here; the caller matches it to its list.
 */
export function parseInvite(search, now = new Date()) {
  const p = new URLSearchParams(search);
  const name = p.get('wall')?.normalize('NFC').trim();
  const at = parseMoment(p.get('at'));
  if (!name || !at) return null;
  const when = toDate(at.date);
  when.setMinutes(at.min);
  return { name, ...at, n: cleanCount(p.get('n')), kind: cleanKind(p.get('k')), tags: cleanTags(p.get('tags')), note: cleanNote(p.get('note')), past: when < now };
}

// How the sun is then: null (no facing known, or indoors) | { kind: 'night' } | { kind: 'lit', until } | { kind: 'shade', from }
// (from: when it turns sunny, or null for shade the rest of the day). Minutes since midnight.
function sunInfoOf(wall, day, min) {
  if (wall.venue === 'indoor') return null;
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(min / 60), min % 60);
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
  if (isSunlit(wall, noon).lit === null) return null;
  if (isSunlit(wall, at).reason === 'night') return { kind: 'night' };
  const sun = sunIntervals(wall, day);
  const lit = sun.find(([a, b]) => a <= min && min < b);
  if (lit) return { kind: 'lit', until: lit[1] };
  const next = sun.find(([a]) => a > min);
  return { kind: 'shade', from: next ? next[0] : null };
}

// "그때는 양달이에요 (17:50까지)" / "그때는 응달이에요 (10:20부터 양달)"; null when there is no news
function sunLineOf(info) {
  if (!info) return null;
  if (info.kind === 'night') return '그때는 해가 없는 시간이에요';
  if (info.kind === 'lit') return `그때는 양달이에요 (${fmtMin(info.until)}까지)`;
  return info.from === null ? '그때는 응달이에요' : `그때는 응달이에요 (${fmtMin(info.from)}부터 양달)`;
}

/**
 * checkMoment(wall, date, min) → { state: 'open' | 'closed' | 'unknown', alt, closedDay, sunLine, sunInfo }
 * alt: a better time when it is closed then (the next opening that day, else two hours before the last closing).
 */
export function checkMoment(wall, date, min) {
  if (!hasHours(wall)) return { state: 'unknown', alt: null, closedDay: false, sunLine: null, sunInfo: null };
  const day = toDate(date);
  const open = openIntervals(wall, day);
  const isOpen = open.some(([a, b]) => a <= min && min < b);
  let alt = null;
  if (!isOpen && open.length) {
    const next = open.find(([a]) => a > min);
    const last = open[open.length - 1];
    alt = next ? next[0] : Math.max(last[0], last[1] - 120);
  }
  const sunInfo = sunInfoOf(wall, day, min);
  return { state: isOpen ? 'open' : 'closed', alt, closedDay: open.length === 0, sunLine: sunLineOf(sunInfo), sunInfo };
}

/** inviteText({ name, date, min, n, tags, note, sunLine, chatUrl, url }) → the message to send, one fact per line. */
export function inviteText({ name, date, min, n = null, kind = 'look', tags = [], note = '', sunLine = null, caution = false, chatUrl = null, url }) {
  const labels = cleanTags(tags).map((id) => TAGS.find(([t]) => t === id)[1]);
  const count = cleanCount(n);
  const who = [...labels, headsPhrase(count, kind)].filter(Boolean).join(' · ');
  const words = cleanNote(note);
  return [
    `[해벽] ${name} 같이 가요`,
    `${dayText(toDate(date))} ${fmtMin(min)}`,
    caution ? '※ 운영시간 확인 필요' : null,
    sunLine,
    who,
    words ? `"${words}"` : null,
    chatUrl && CHAT_URL_RE.test(chatUrl) ? `방에서 얘기해요: ${chatUrl}` : null,
    url,
  ].filter(Boolean).join('\n');
}
