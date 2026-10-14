// src/climber-test.js — 클라이머 유형 테스트: 12문항, 채점, 8유형, 저장. No DOM.
// 12 answers (A strongly +2 / A slightly +1 / B slightly −1 / B strongly −2) → three type axes + the 종목 axis. Only the derived
// result is kept (open-wall:climber); the answers are dropped. Spec: docs/superpowers/specs/2026-10-14-climber-test-design.md
import { TYPES } from './climber-content.js';
import { cleanPledge } from './pledge.js'; // a real calendar day 'YYYY-MM-DD' or null

export const CLIMBER_KEY = 'open-wall:climber';

export const CODES = Object.freeze(['owl', 'spider', 'goat', 'otter', 'gecko', 'cat', 'raccoon', 'squirrel']);
// the screen order of the questions (by id): no two of the same axis in a row
const TYPE_AXES = ['plan', 'solo', 'steady'];
export const ORDER = Object.freeze([1, 4, 7, 10, 2, 5, 8, 11, 3, 6, 9, 12]);
// [A pole, B pole]; the A direction is positive
export const AXES = Object.freeze({
  plan: ['계획', '직관'], solo: ['혼자', '함께'], steady: ['꾸준', '폭발'], route: ['볼더링', '루트'],
});

const Q = (id, axis, q, a, b) => Object.freeze({ id, axis, q, a, b });
export const QUESTIONS = Object.freeze([
  Q(1, 'plan', '새 루트 앞에 섰다. 나는?', '아래에서 홀드를 한참 올려다보며 루트 파인딩을 한다', '일단 붙어서 몸이 가는 대로 간다'),
  Q(2, 'plan', '암장에 가기 전날 밤, 나는?', '오늘 어떤 루트를 풀지 대충 생각해 둔다', '가서 분위기를 보고 정한다'),
  Q(3, 'plan', '중간에 막혔다. 나는?', '내려와서 다음 동작을 머릿속으로 파인딩해 본다', '일단 다른 쪽으로 손을 뻗어 본다'),
  Q(4, 'solo', '벽 앞에서 가장 편한 순간은?', '내 루트에만 조용히 집중할 때', '친구들과 번갈아 오르며 떠들 때'),
  Q(5, 'solo', '친구가 내 루트에서 막혔다. 나는?', '일단 지켜보다가, 물어보면 알려 준다', '바로 "여기 이렇게!" 하며 같이 풀어 본다'),
  Q(6, 'solo', '처음 간 암장에서 나는?', '한쪽 구석에서 혼자 몸을 푼다', '근처 사람들에게 말을 걸거나 같이 오른다'),
  Q(7, 'steady', '오늘의 체력을 쓰는 방식은?', '처음부터 끝까지 비슷한 페이스로 여러 루트를 오른다', '한 루트에 오늘 힘을 모아서 쏟는다'),
  Q(8, 'steady', '어려운 루트를 풀 때 나는?', '시도할 때마다 조금씩 나아지다가 어느새 성공한다', '몇 번 안 되다가 어느 순간 한 번에 성공한다'),
  Q(9, 'steady', '지쳤을 때 나는?', '쉬는 시간을 넣어 가며 꾸준히 이어 간다', '충분히 쉬었다가 마지막 한 번에 집중한다'),
  Q(10, 'route', '더 끌리는 것은?', '짧고 센 동작을 푸는 한 문제 (볼더링)', '길게 이어 가며 올라가는 루트'),
  Q(11, 'route', '높이에 대한 마음은?', '낮아도 어려운 문제가 재밌다', '높이 올라갈수록 재밌다'),
  Q(12, 'route', '가장 뿌듯한 순간은?', '안 풀리던 문제를 마침내 풀었을 때', '끝까지 올라서 안전하게 내려왔을 때'),
]);

// one tap per question: the statement it is under (A: +2, B: −2). Three answers on an axis never tie, so two of three decide it.
const VALUES = [2, -2];

/** axisScores(answers) → { plan, solo, steady, route }, each −6..6 (a new result is −6, −2, 2 or 6). answers[id − 1] ∈ {2, −2}. */
export function axisScores(answers) {
  const sum = { plan: 0, solo: 0, steady: 0, route: 0 };
  for (const q of QUESTIONS) sum[q.axis] += answers[q.id - 1];
  return sum;
}

/** pickType(answers) → one of CODES: (계획|직관) × (혼자|함께) × (꾸준|폭발), A = 0 and B adds 4 / 2 / 1. */
export function pickType(answers) {
  const s = axisScores(answers);
  const i = (s.plan > 0 ? 0 : 4) + (s.solo > 0 ? 0 : 2) + (s.steady > 0 ? 0 : 1);
  return CODES[i];
}

/** oppositeOf(code) → the type that is the other pole on all three axes. */
export const oppositeOf = (code) => CODES[CODES.length - 1 - CODES.indexOf(code)];

/**
 * routeLine(m) → the 종목 chip (A is 볼더링: positive). Two strengths a side; the all-rounder line is only for results saved before the
 * two-choice answers (−1..1 could happen then).
 */
export function routeLine(m) {
  if (m >= 4) return '볼더링 성향 · 짧고 센 한 문제에 끌려요';
  if (m >= 2) return '볼더링 쪽에 조금 더 끌려요';
  if (m <= -4) return '루트 성향 · 길게 이어 오르는 걸 좋아해요';
  if (m <= -2) return '루트 쪽에 조금 더 끌려요';
  return '볼더링도 루트도 즐기는 올라운더';
}

/**
 * axisWords(type, s) → [{ word, dots }] for 계획/직관, 혼자/함께, 꾸준/폭발: the side the type took on each axis (read from the type, not the
 * sign: an older result could be a tie) and 3 dots for a clear lean (|score| ≥ 4: all three answers), 2 for a slight one.
 */
export function axisWords(type, s) {
  const i = Math.max(0, CODES.indexOf(type));
  return TYPE_AXES.map((axis, k) => ({ word: AXES[axis][(i >> (2 - k)) & 1], dots: Math.abs(s[k]) >= 4 ? 3 : 2 }));
}

/** scoreResult(answers, at) → { type, s: [plan, solo, steady], m, at }. at: 'YYYY-MM-DD'. */
export function scoreResult(answers, at) {
  const s = axisScores(answers);
  return { type: pickType(answers), s: [s.plan, s.solo, s.steady], m: s.route, at };
}

/** startQuiz() → { i, answers }: i is the position in ORDER (0..11); answers by question id − 1, null until answered. */
export const startQuiz = () => ({ i: 0, answers: Array(12).fill(null) });

/** answerQuiz(q, value) → the next state (q itself for a value that is not +2 or −2). Never changes q. */
export function answerQuiz(q, value) {
  if (!VALUES.includes(value) || q.i >= ORDER.length) return q;
  const answers = [...q.answers];
  answers[ORDER[q.i] - 1] = value;
  return { i: q.i + 1, answers };
}

/** backQuiz(q) → one question back (never before the first); the answer given there is kept until it is replaced. */
export const backQuiz = (q) => (q.i === 0 ? q : { i: q.i - 1, answers: [...q.answers] });

export const quizDone = (q) => q.i >= ORDER.length && q.answers.every((v) => v !== null);

const int6 = (n) => Number.isInteger(n) && n >= -6 && n <= 6;

/** cleanResult(v) → a new { type, s, m, at } or null: storage and links are not trusted. */
export function cleanResult(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const at = cleanPledge(v.at);
  if (!CODES.includes(v.type) || !Array.isArray(v.s) || v.s.length !== 3 || !v.s.every(int6) || !int6(v.m) || !at) return null;
  return { type: v.type, s: [...v.s], m: v.m, at };
}

/** loadClimber(storage) → { latest, prev }, each a cleaned result or null. Bad JSON, a wrong version or a blocked store: both null. */
export function loadClimber(storage) {
  try {
    const o = JSON.parse(storage.getItem(CLIMBER_KEY));
    if (o && typeof o === 'object' && !Array.isArray(o) && o.v === 1) return { latest: cleanResult(o.latest), prev: cleanResult(o.prev) };
  } catch { /* nothing stored, bad JSON or a blocked store */ }
  return { latest: null, prev: null };
}

/** saveClimber(storage, result) → true when stored. The stored latest becomes prev (one deep); a bad result writes nothing. */
export function saveClimber(storage, result) {
  const r = cleanResult(result);
  if (!r) return false;
  try {
    storage.setItem(CLIMBER_KEY, JSON.stringify({ v: 1, latest: r, prev: loadClimber(storage).latest }));
    return true;
  } catch { return false; }
}

/** compareLine(prev, latest) → one line on what moved since last time ('' when there is no earlier result). */
export function compareLine(prev, latest) {
  if (!prev) return '';
  const diff = latest.s.map((v, i) => v - prev.s[i]);
  let at = 0;
  diff.forEach((d, i) => { if (Math.abs(d) > Math.abs(diff[at])) at = i; });
  if (Math.abs(diff[at]) < 2) return '지난번과 비슷해요.';
  return `지난번보다 ${AXES[TYPE_AXES[at]][diff[at] > 0 ? 0 : 1]} 쪽이 늘었어요.`;
}

/** typeFromSearch(search) → the code a ?type= link names (exact, lower case), else null. */
export function typeFromSearch(search) {
  const t = new URLSearchParams(search).get('type');
  return CODES.includes(t) ? t : null;
}

/** typeUrl(href, code) → the app address with only ?type=<code> (no other query, no hash). */
export function typeUrl(href, code) {
  const u = new URL(href);
  u.search = '';
  u.hash = '';
  if (CODES.includes(code)) u.searchParams.set('type', code);
  return u.toString();
}

export const shareText = (code, url) => `나는 ${TYPES[code].name} 클라이머! 너는 어떤 유형이야? ${url}`;

const TIP_TAIL = { plan: '동선 짜기 좋은 날.', team: '같이 갈 사람을 찾아볼까요?', solo: '집중해서 오르기 좋은 날.', social: '오늘 같이 오를 사람 모아 볼까요?' };

/** tipText(code, openCount) → the 오늘의 팁 line. openCount: walls open now (as the header counts them), null when it is not known. */
export function tipText(code, openCount) {
  if (openCount === null || openCount === undefined) return '지금 열린 외벽을 확인해 보세요.';
  if (openCount === 0) return '오늘은 열린 외벽이 없어요. 내일 시간을 확인해 보세요.';
  return `지금 열린 외벽 ${openCount}곳. ${TIP_TAIL[TYPES[code]?.tip] ?? ''}`.trim();
}

/** characterSrc(code) → the picture of the type (the owl for anything else). */
export const characterSrc = (code) => `assets/climbers/${CODES.includes(code) ? code : 'owl'}.png`;
