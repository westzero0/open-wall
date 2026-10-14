// src/climber-view.js — 클라이머 유형 테스트: the 12-question sheet, the result, the intro card and the "friend sent a type" banner.
// Off unless config.climberTest. Opened from 내 정보 (#pfClimber). Answers live in memory only; the sheet closing drops them.
// Each question is two statements, each one a button; pressing one answers and goes on (a button, so Enter/Space work and nothing submits the sheet).
// The result is saved by climber-test.js (open-wall:climber) and 'climber:done' tells stats.js a test was finished (no type in it).
// Everything is shown with textContent / el(): no HTML strings.
import { drawClimberCard } from './climber-image.js';
import { DISCLAIMER, TYPES } from './climber-content.js';
import {
  CODES, ORDER, QUESTIONS, answerQuiz, axisWords, backQuiz, characterSrc, compareLine, loadClimber, oppositeOf, quizDone, routeLine,
  saveClimber, scoreResult, shareText, startQuiz, tipText, typeUrl,
} from './climber-test.js';
import { config } from './config.js';
import { el } from './dom.js';
import { KAKAO_SAY, climberKakaoPayload, loadKakao, shareKakao } from './kakao-share.js';
import { pictureBlob, shareInvite, shareSay } from './share-image.js';
import { ymd } from './time.js';

const $ = (id) => document.getElementById(id);
const store = () => { try { return localStorage; } catch { return null; } };

/** createClimberView({ getOpenCount, isCardDone, setCardDone }) → { open(), banner(code) }. A no-op pair when config.climberTest is off. */
export function createClimberView({ getOpenCount = () => null, isCardDone = () => false, setCardDone = () => {} } = {}) {
  const dlg = $('climber-sheet');
  const quizBox = $('climberQuiz');
  const resultBox = $('climberResult');
  const card = $('climberCard');
  // off, or an older cached index.html without the sheet (sw.js shows the stored page first): do nothing rather than break the app
  if (!config.climberTest || !dlg || !quizBox || !resultBox || !card || !$('pfClimberRow') || !$('pfClimber')) return { open() {}, banner() {} };
  let quiz = startQuiz();
  let opener = $('meBtn');
  let kakao = null; // the SDK once loaded and initialised (loaded when a result shows, so the tap has nothing to wait for)
  let kakaoOff = false;
  const uploaded = {}; // { key, url }: the card last uploaded to Kakao, reused for the same result
  const startKakao = () => { if (!kakao) loadKakao().then((K) => { kakao = K; kakaoOff = false; }, () => { kakaoOff = true; }); };

  const imgOf = (code, alt, cls) => {
    const img = el('img', { class: cls, src: characterSrc(code), alt, width: '160', height: '160' });
    img.addEventListener('error', () => { img.src = characterSrc('owl'); }, { once: true }); // a picture not made yet: the owl, never a broken image
    return img;
  };

  function drawQuestion() {
    const id = ORDER[quiz.i];
    const q = QUESTIONS[id - 1];
    const pos = quiz.i + 1;
    const picked = quiz.answers[id - 1];
    const go = (value) => {
      quiz = answerQuiz(quiz, value);
      if (quizDone(quiz)) finish();
      else drawQuestion();
    };
    // the two statements are the two holds (A: +2, B: −2); one tap answers and goes on
    const option = (text, value, side) => {
      const b = el('button', { type: 'button', class: `cq-hold ${side}`, 'aria-pressed': String(picked === value) }, text);
      b.addEventListener('click', () => go(value));
      return b;
    };
    const section = el('section', { class: 'climber-q', tabindex: '-1', 'aria-labelledby': 'cq-title' },
      el('h3', { class: 'cq-title', id: 'cq-title' }, q.q), el('div', { class: 'cq-opts' }, option(q.a, 2, 'a'), option(q.b, -2, 'b')));
    // ← at the left (an empty place on the first question so the title does not move), × at the right
    const back = el('button', quiz.i === 0
      ? { type: 'button', class: 'cq-ic back gone', tabindex: '-1', 'aria-hidden': 'true' }
      : { type: 'button', class: 'cq-ic back', 'aria-label': '이전 문항' });
    back.addEventListener('click', () => { quiz = backQuiz(quiz); drawQuestion(); });
    const close = el('button', { type: 'button', class: 'cq-ic x', 'aria-label': '닫기' });
    close.addEventListener('click', () => dlg.close());
    const head = el('div', { class: 'cq-head' }, back, el('div', { class: 'cq-brand' }, '나는 어떤 클라이머일까?'), close);
    // twelve bolts, one per question: done, the one now, still to come; the count sits at the end of the row
    const bolts = el('span', { class: 'cq-bolts', role: 'progressbar', 'aria-label': '진행', 'aria-valuemin': '1', 'aria-valuemax': String(ORDER.length), 'aria-valuenow': String(pos), 'aria-valuetext': `${ORDER.length}문항 중 ${pos}번째` },
      ...ORDER.map((_, i) => el('i', { class: i < quiz.i ? 'on' : i === quiz.i ? 'here' : null })));
    quizBox.replaceChildren(head, el('div', { class: 'cq-prog' }, bolts, el('span', { class: 'cq-count', 'aria-hidden': 'true' }, el('b', {}, String(pos)), ` / ${ORDER.length}`)), section);
    section.focus({ preventScroll: true });
  }

  // the three words the type is made of, each with 3 dots (all three answers leaned that way) or 2 (two of three): filled dots first
  function triRow(r) {
    const words = axisWords(r.type, r.s);
    const label = words.map(({ word, dots }) => `${word} 3문항 중 ${dots}`).join(', ');
    return el('div', { class: 'cr-tri', role: 'img', 'aria-label': label },
      ...words.map(({ word, dots }) => el('div', {}, el('b', {}, word), el('span', { class: 'cr-dots' }, ...[0, 1, 2].map((k) => el('i', { class: k < dots ? null : 'off' }))))));
  }

  function drawResult(r, prev, saved) {
    const t = TYPES[r.type];
    const opp = TYPES[oppositeOf(r.type)];
    const compare = compareLine(prev, r);
    const again = el('button', { type: 'button', class: 'cr-again' }, '다시 하기');
    const toList = el('button', { type: 'button', class: 'cr-list' }, '지금 열린 외벽 보기');
    const kakaoBtn = el('button', { type: 'button', class: 'cr-kakao' }, '카카오톡으로 보내기');
    const imageBtn = el('button', { type: 'button', class: 'cr-image' }, '이미지 저장·공유');
    const status = el('p', { class: 'cr-status', role: 'status' }, saved ? '' : '이 브라우저에는 저장하지 못했어요.');
    const say = (msg) => { status.textContent = msg; };
    const url = typeUrl(location.href, r.type);
    const key = `${r.type}:${r.s.join(',')}:${r.m}`;
    // both pictures are drawn now, so a tap has nothing to wait for (navigator.share and the download need the tap's permission)
    let imageBlob = null;
    let cardBlob = null;
    pictureBlob(r, drawClimberCard).then((b) => { imageBlob = b; }, () => {});
    pictureBlob(r, (c, p) => drawClimberCard(c, p, { width: 600 })).then((b) => { cardBlob = b; }, () => {});
    startKakao();
    again.addEventListener('click', () => open(opener));
    toList.addEventListener('click', () => { dlg.close(); window.scrollTo({ top: 0 }); });
    imageBtn.addEventListener('click', () => {
      if (!imageBlob) return say('카드를 만드는 중이에요. 잠시 뒤 다시 눌러 주세요.');
      shareInvite(imageBlob, shareText(r.type, url), 'haebyeok-climber.png').done.then((res) => say(shareSay(res)));
    });
    async function copyInstead() { // KakaoTalk is blocked or failed: the link goes to the clipboard
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        prompt('링크를 복사하세요', url); // no clipboard (http, denied)
        return;
      }
      say(KAKAO_SAY.copied);
    }
    kakaoBtn.addEventListener('click', async () => {
      if (!kakao) return kakaoOff ? copyInstead() : say('카카오톡 공유를 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요.');
      if (!cardBlob) return say('카드를 만드는 중이에요. 잠시 뒤 다시 눌러 주세요.');
      if (uploaded.key !== key) say('그림을 카카오 서버에 올리는 중이에요…');
      const res = await shareKakao(kakao, { key, blob: cardBlob, build: (imageUrl) => climberKakaoPayload({ name: t.name, url, imageUrl }) }, uploaded);
      if (res.why === 'cancelled') return say('');
      if (res.ok) say(KAKAO_SAY.ok);
      else copyInstead();
    });
    // one plate (the same face as the shared picture), then what to read, then sharing; the side notes fold into 더 보기
    const stage = el('div', { class: 'cr-wall' }, el('span', { class: 'cr-sun' }), el('span', { class: `cr-shade ${t.wall.shade}` }), imgOf(r.type, `${t.animal}, ${t.name}`, 'cr-pic'));
    stage.style.setProperty('--tint', t.tint);
    stage.style.setProperty('--sun-x', `${t.wall.sun.x}%`);
    stage.style.setProperty('--lift', String(t.wall.sun.lift));
    const plate = el('article', { class: 'cr-plate reveal' }, // 'reveal': the plate arrives with a short sunrise (style.css; none under reduced motion)
      el('div', { class: 'cr-head' },
        el('p', { class: 'cr-fig' }, `FIG. ${String(CODES.indexOf(r.type) + 1).padStart(2, '0')} / ${String(CODES.length).padStart(2, '0')}`),
        el('span', { class: 'cr-animal' }, t.animal)),
      stage,
      el('h3', { class: 'cr-name', tabindex: '-1' }, t.name),
      el('p', { class: 'cr-nick' }, `"${t.nick}"`),
      triRow(r),
      el('p', { class: 'cr-route' }, routeLine(r.m)),
      el('p', { class: 'cr-plate-foot' }, '해벽 · 지금 열린 외벽'));
    resultBox.replaceChildren(el('div', { class: 'climber-res' },
      plate,
      t.safety ? el('p', { class: 'cr-safe' }, t.safety) : null,
      el('div', { class: 'cr-read' },
        el('ul', {}, ...t.strengths.map((x) => el('li', {}, x))),
        el('p', {}, el('b', {}, '조심할 점 '), t.caution),
        el('p', {}, el('b', {}, '이럴 때 빛나요 '), t.shine)),
      el('div', { class: 'cr-btns cr-share' }, kakaoBtn, imageBtn),
      el('p', { class: 'cr-share-note' }, '카카오톡으로 보내면 카드 그림이 카카오 서버에 올라가요.'),
      status,
      el('details', { class: 'cr-more' },
        el('summary', {}, '더 보기'),
        el('div', { class: 'cr-more-body' },
          el('p', { class: 'cr-tip' }, tipText(r.type, getOpenCount())),
          el('p', {}, el('b', {}, '정반대 유형 '), `${opp.animal} · ${opp.name}`),
          compare ? el('p', {}, compare) : null)),
      el('p', { class: 'cr-note' }, DISCLAIMER),
      el('div', { class: 'cr-btns' }, toList, again)));
    quizBox.hidden = true;
    resultBox.hidden = false;
    resultBox.querySelector('.cr-name').focus({ preventScroll: true });
  }

  function finish() {
    const result = scoreResult(quiz.answers, ymd(new Date()));
    const s = store();
    const before = s ? loadClimber(s).latest : null;
    const saved = Boolean(s) && saveClimber(s, result);
    document.dispatchEvent(new CustomEvent('climber:done')); // stats.js counts it (no type in it)
    drawResult(result, before, saved);
  }

  function open(from) {
    opener = from ?? opener;
    quiz = startQuiz(); // closing the sheet dropped the answers; a sheet opened again begins at the first question
    resultBox.hidden = true;
    quizBox.hidden = false;
    if (!dlg.open) dlg.showModal(); // before drawQuestion: focus() inside a closed dialog does nothing
    drawQuestion();
  }

  dlg.addEventListener('close', () => { quiz = startQuiz(); opener?.focus(); });
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close()); // the backdrop

  $('pfClimberRow').hidden = false;
  if ($('ab-ai')) $('ab-ai').hidden = false; // 앱 정보: the characters are AI-made
  $('pfClimber').addEventListener('click', () => {
    $('profile').close();
    open($('meBtn'));
  });

  // cast: the characters standing on the wall (the codes); tint: the wall's colour; friend: one character, bigger
  function showCard({ title, sub, go, goLabel, markDone, cast, tint, friend = false }) {
    const start = el('button', { type: 'button', class: 'cc-go' }, goLabel);
    const close = el('button', { type: 'button', class: 'cc-x', 'aria-label': '닫기' });
    start.addEventListener('click', () => { if (markDone) setCardDone(); card.hidden = true; go(); });
    close.addEventListener('click', () => { if (markDone) setCardDone(); card.hidden = true; });
    const wall = el('div', { class: 'cc-wall' }, el('span', { class: 'cc-sun' }), el('span', { class: 'cc-shade' }),
      el('div', { class: 'cc-cast' }, ...cast.map((c) => el('img', { src: characterSrc(c), alt: '', width: '92', height: '92' }))), close);
    wall.style.setProperty('--tint', tint);
    card.className = friend ? 'climber-card friend' : 'climber-card';
    card.replaceChildren(wall, el('div', { class: 'cc-body' }, el('p', { class: 'cc-title' }, title), el('p', { class: 'cc-sub' }, sub), start));
    card.hidden = false;
  }

  if (!isCardDone()) {
    showCard({ title: '나는 어떤 클라이머일까?', sub: '12문항, 1분 반. 8가지 동물 중 하나가 나와요.', goLabel: '테스트 시작', markDone: true, go: () => open($('meBtn')), cast: ['owl', 'cat', 'squirrel', 'gecko'], tint: TYPES.gecko.tint });
  }

  return {
    open,
    banner(code) { // a friend's link: their type, and the way in
      showCard({ title: `친구는 ${TYPES[code].name}!`, sub: '너는 어떤 클라이머일까? 12문항, 1분 반.', goLabel: '나도 해보기', markDone: false, go: () => open($('meBtn')), cast: [code], tint: TYPES[code].tint, friend: true });
    },
  };
}
