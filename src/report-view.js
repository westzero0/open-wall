// Report sheet: opens on wall:report, posts to the Google Form (no-cors: the response is unreadable, only a network error counts as failure).
import { config } from './config.js';
import { el } from './dom.js';
import { searchPicks } from './viewmodel.js';
import { createSectionWall } from './route-sections.js';
import { CRAG_KINDS, CRAG_TOPICS, MAX_BODY, MAX_NICK, NICK_KEY, NOTICE_KIND, OVERVIEW_KIND, PHOTO_KIND, isPhotoKind, cleanNick, buildPayload, cooldownLeft, loadNick, nickCommit, nickConfirmText, nickLocked, nickMode, validateReport } from './report.js';
import { FIT_BYTES, MAX_NOTE, OVERVIEW_EDGE, PHOTO_SAY, PICK_MAX_SAY, addPicks, photosMessage, sendPhotos, shrinkToJpeg, uploadPhoto } from './photo-upload.js';

const dlg = document.getElementById('report');
if (dlg) {
  const f = dlg.querySelector('form');
  const status = dlg.querySelector('.rp-status');
  const alt = dlg.querySelector('.rp-alt');
  const KEY = 'open-wall:report-ts';
  const get = () => { try { return Number(localStorage.getItem(KEY)); } catch { return NaN; } };
  const set = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode: no cooldown */ } };
  // 닉네임 field: shown only while config.reportNickEntry is set; the last nickname is kept on this device (open-wall:nick, cleaned on read).
  const mode = nickMode(config);
  const nickBox = dlg.querySelector('.rp-nick');
  const readNick = () => { try { return loadNick(localStorage.getItem(NICK_KEY)); } catch { return ''; } };
  // A first nickname while the ranking runs cannot be changed afterwards: the first press says so, the second sends and saves it.
  let confirmedNick = '';
  const commitNick = (typed) => {
    const c = nickCommit(mode, readNick(), typed);
    if (c.confirm && confirmedNick !== c.nick) { confirmedNick = c.nick; say(nickConfirmText(c.nick)); return null; }
    return c;
  };
  const saveNick = (v) => { try { localStorage.setItem(NICK_KEY, v); } catch { /* private mode: not remembered */ } };
  if (mode !== 'off') {
    nickBox.hidden = false;
    nickBox.querySelector('.rp-nick-label').textContent = `닉네임 (${mode === 'required' ? '필수' : '선택'} · ${MAX_NICK}자까지)`;
    f.elements.nick.maxLength = MAX_NICK;
  }
  let wallName = '';
  const nameEl = dlg.querySelector('.rp-name');
  const chatNameEl = dlg.querySelector('.rp-chat-name'); // the suggested room name, one tap selects it
  const say = (msg) => { status.textContent = msg; };
  const pickBox = dlg.querySelector('.rp-pick');
  const pickEl = f.elements.wall;
  const setWall = (n) => { wallName = n; nameEl.textContent = n; chatNameEl.textContent = n ? `[해벽] ${n} 모임` : '[해벽] 암장이름 모임'; };
  const picks = dlg.querySelector('.rp-picks');
  let wallNames = [];
  // same search as the 방문 기록 sheet: type part of a name, tap a hit; typed text alone never counts as a wall
  function drawHits() {
    const q = pickEl.value.trim();
    picks.hidden = !q;
    if (!q) return picks.replaceChildren();
    const hits = searchPicks(wallNames.map((name) => ({ name })), q);
    picks.replaceChildren(...(hits.length ? hits.slice(0, 30).map(({ wall: w }) => {
      const b = el('button', { type: 'button', class: 'la-hit' }, el('span', { class: 'pn' }, w.name));
      b.addEventListener('click', () => { pickEl.value = w.name; setWall(w.name); picks.hidden = true; });
      return el('li', {}, b);
    }) : [el('li', { class: 'none' }, '맞는 암장이 없어요. 이름 일부로 찾아보세요.')]));
  }
  pickEl.addEventListener('input', () => { setWall(''); drawHits(); });
  pickEl.addEventListener('keydown', (e) => { // Enter never submits; with exactly one match it picks it (not while a Korean IME is composing)
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.isComposing && picks.querySelectorAll('.la-hit').length === 1) picks.querySelector('.la-hit').click();
  });

  if (!config.noticeReport) f.querySelector(`input[name="kind"][value="${NOTICE_KIND}"]`).closest('label').hidden = true; // off: the 공지 choice (and its fields) never show
  f.elements.body.maxLength = MAX_BODY;
  alt.href = config.reportFormUrl; // fixed constant, not user input

  // Per kind: the extra pick it needs and what the memo asks for. 운영시간 stays a memo (with an example), not a form.
  const MEMO = {
    운영시간: ['바뀐 운영시간', '예) 평일 10:00–22:00, 토 10:00–18:00, 일 휴무. 휴게시간이나 계절(동절기) 차이도 편하게 적어 주세요.'],
    임시휴무: ['메모 (선택)', '예) 시설 공사, 대회 개최'],
    주차: ['메모 (선택)', '예) 건물 뒤 공영주차장 2시간 무료'],
    세팅일: ['메모 (선택)', '예) 왼쪽 벽 새 루트 12개, 공지에서 확인'],
    '루트 분포': ['메모 (선택)', '예) 왼쪽 벽 6개 · 오른쪽 벽 4개 · 오버행 2개'],
    어프로치: ['내용', '예) 입구 철문이 잠겨 옆길로 돌아가요 · 도보 20분쯤 걸려요'],
    '루트·개념도': ['내용', '예) 3번 루트 볼트 하나가 흔들려요 · 개념도에 없는 새 루트가 있어요'],
    컨디션: ['내용', '예) 비 온 지 이틀인데 아래쪽 벽이 아직 젖어 있어요'],
    시설: ['내용', '예) 샤워실이 생겼어요 · 대여 신발이 없어졌어요'],
    요금: ['내용', '예) 일일 이용 15,000원 · 학생 할인 생겼어요'],
    기타: ['내용', '무엇이 어떻게 달라졌는지 적어 주세요.'],
    공지: ['메모 (선택)', '예) 10/20 휴관 공지가 올라왔어요 · 공지 주소가 바뀌었어요 · 링크가 안 열려요'],
    오픈채팅방: ['메모 (선택)', '예) 매주 토요일 저녁 모임, 초보 환영'],
    '암장 사진': [`메모 (선택 · ${MAX_NOTE}자까지)`, '예) 입구 쪽 벽, 오늘 오후에 찍었어요'],
    '전경 사진': [`메모 (선택 · ${MAX_NOTE}자까지)`, '예) 주차장 쪽에서 찍은 전체 모습, 왼쪽이 슬랩 벽'],
  };
  // One report per tab: each kind keeps its own memo/source draft, the send button lives only while the current kind has something to send,
  // and a sent report empties just its own tab.
  let crag = false; // opened from a 싱글피치 card: CRAG_KINDS only, no picture (the board Worker knows walls only)
  const EVIDENCE_OK = (kind) => !crag && !!kind && !isPhotoKind(kind) && kind !== '오픈채팅방' && kind !== NOTICE_KIND; // kinds that can carry a supporting picture
  let cur = '';
  let routeWall = null; // 루트 분포's wall of holds (made below; hasText may run before it exists)
  let drafts = {};
  let busy = false;
  // 암장 사진 tab's picked pictures (declared up here: the grade wall below calls refresh while it is being built)
  const thumbs = dlg.querySelector('.rp-thumbs');
  const pickSum = dlg.querySelector('.rp-pick-sum');
  let picked = [];
  let thumbUrls = [];
  let sending = false; // a photo send is running (the sheet may be closed and reopened meanwhile)
  let gen = 0; // bumps each time the sheet opens, so a late send never touches a newer sheet
  const hasEvidence = (kind) => EVIDENCE_OK(kind) && !!f.elements.evidence.files?.length;
  const hasContent = (kind) => hasText(kind) || hasEvidence(kind);
  const hasText = (kind) => {
    const v = (n) => f.elements[n].value.trim();
    switch (kind) {
      case '': return false;
      case '임시휴무': return !!v('from');
      case '주차': return !!f.elements.parking.value;
      case '오픈채팅방': return !!v('chat');
      case NOTICE_KIND: return true; // every field is optional
      case '세팅일': return !!(v('setLast') || v('setNext') || v('body'));
      case '루트 분포': return (routeWall?.hasCounts() ?? false) || !!v('body');
      case PHOTO_KIND: case OVERVIEW_KIND: return picked.length > 0;
      default: return !!v('body'); // 운영시간, 기타
    }
  };
  const refresh = () => { f.elements.send.disabled = busy || !hasContent(f.elements.kind.value); f.elements.photo.disabled = busy; for (const b of thumbs.querySelectorAll('button')) b.disabled = busy; };
  // 루트 분포: pick the wall (좌측벽 …, or 벽 구분 없이), then the shared wall of holds counts that wall's routes; refresh runs on every tap
  routeWall = createSectionWall({ onChange: () => refresh() });
  dlg.querySelector('.rp-wall').append(routeWall.el);
  const clearTab = (kind) => {
    for (const x of [...f.querySelectorAll('.rp-extra')].filter((e) => e.dataset.kind.split('|').includes(kind))) {
      for (const i of x.querySelectorAll('input, textarea')) { if (i.type === 'radio' || i.type === 'checkbox') i.checked = false; else i.value = ''; }
    }
    f.elements.body.value = ''; f.elements.note.value = '';
    delete drafts[kind];
    if (kind === '루트 분포') routeWall.clear();
    if (isPhotoKind(kind)) clearPicked();
    else { f.elements.evidence.value = ''; clearEvidencePreview(); }
  };
  const onKind = () => {
    const prev = cur;
    if (prev) drafts[prev] = { body: f.elements.body.value, note: f.elements.note.value };
    cur = f.elements.kind.value;
    if (prev) { const d = drafts[cur] ?? {}; f.elements.body.value = d.body ?? ''; f.elements.note.value = d.note ?? ''; } // text typed before any kind was picked goes to the first one
    syncKind();
    refresh();
  };
  f.addEventListener('input', refresh);
  f.addEventListener('change', refresh);

  const syncKind = () => {
    const kind = f.elements.kind.value;
    for (const x of f.querySelectorAll('.rp-extra')) x.hidden = !x.dataset.kind.split('|').includes(kind);
    const [label, hint] = MEMO[kind] ?? ['내용', ''];
    f.querySelector('.rp-label').textContent = label;
    f.elements.body.placeholder = hint;
    const photo = isPhotoKind(kind); // no source-link line for a photo; the nickname stays (it is the photo's credit and counts for the ranking)
    f.querySelector('.rp-note').hidden = photo;
    nickBox.hidden = mode === 'off';
    evidenceBox.hidden = !EVIDENCE_OK(kind);
  };
  const evidenceBox = dlg.querySelector('.rp-evidence');
  const evidencePreview = evidenceBox.querySelector('.rp-photo-preview');
  let evidenceUrl = '';
  const clearEvidencePreview = () => { if (evidenceUrl) URL.revokeObjectURL(evidenceUrl); evidenceUrl = ''; evidencePreview.hidden = true; evidencePreview.removeAttribute('src'); };
  f.elements.evidence.addEventListener('change', () => {
    clearEvidencePreview();
    const file = f.elements.evidence.files?.[0];
    if (!file) return;
    evidenceUrl = URL.createObjectURL(file);
    evidencePreview.src = evidenceUrl;
    evidencePreview.hidden = false;
  });
  // 암장 사진 tab: up to 5 pictures, shown as a thumbnail grid (each with a × to take it out). Picking again adds to the ones already there.
  const drawPicked = () => {
    for (const u of thumbUrls) URL.revokeObjectURL(u);
    thumbUrls = picked.map((x) => URL.createObjectURL(x));
    thumbs.hidden = pickSum.hidden = !picked.length;
    pickSum.textContent = `${picked.length}장 선택됨`;
    thumbs.replaceChildren(...picked.map((_, i) => {
      const x = el('button', { type: 'button', class: 'rp-thumb-x', 'aria-label': `사진 ${i + 1} 빼기` }, '×');
      x.addEventListener('click', () => { picked.splice(i, 1); drawPicked(); refresh(); say(''); });
      return el('li', {}, el('img', { src: thumbUrls[i], alt: `고른 사진 ${i + 1}` }), x);
    }));
  };
  const clearPicked = () => { picked = []; drawPicked(); };
  f.elements.photo.addEventListener('change', () => {
    const r = addPicks(picked, [...(f.elements.photo.files ?? [])]);
    f.elements.photo.value = ''; // the list lives in `picked`; the input only collects
    picked = r.files;
    drawPicked(); refresh();
    if (r.cut) say(PICK_MAX_SAY);
  });
  dlg.addEventListener('close', () => { clearPicked(); clearEvidencePreview(); });
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close()); // no inline onclick: the CSP blocks it

  // 암장 사진: shrink in the browser (drops EXIF/GPS), then POST to the board Worker. No Google Form, no name or email.
  // Shrink + upload one picked file. Returns '' on success, else the message to show.
  // Returns '' on success, else the reason key of PHOTO_SAY.
  async function postPhotoWhy(file, note, nick, big = false) {
    if (!config.boardUrl) return 'network';
    let blob;
    try { blob = await shrinkToJpeg(file, big ? { edge: OVERVIEW_EDGE, maxBytes: FIT_BYTES } : {}); } catch (e) { return e.message === 'too_big' ? 'too_big' : 'bad_image'; }
    const r = await uploadPhoto({ url: config.boardUrl, wall: wallName, blob, note, nick });
    return r.ok ? '' : r.why;
  }
  const postPhoto = async (file, note, nick) => { const why = await postPhotoWhy(file, note, nick); return why ? PHOTO_SAY[why] : ''; }; // the message to show, or ''
  // Photo-only send: the 암장 사진 tab (up to 5 pictures, one by one), or any other kind that has one picture but no text.
  async function sendPhoto(kind) {
    const files = isPhotoKind(kind) ? picked.slice() : [f.elements.evidence.files?.[0]].filter(Boolean);
    if (!wallName) return say('암장을 먼저 골라 주세요.');
    if (!files.length) return say('보낼 사진을 골라 주세요.');
    if (mode === 'required' && !nickCommit(mode, readNick(), f.elements.nick.value).nick) return say('닉네임을 적어 주세요.');
    const memo = f.elements.body.value.replace(/s+/g, ' ').trim();
    if ([...memo].length > MAX_NOTE) return say(`메모는 ${MAX_NOTE}자까지 적을 수 있어요.`);
    const wait = cooldownLeft(get(), Date.now());
    if (wait) return say(`${Math.ceil(wait / 1000)}초 뒤에 다시 보낼 수 있어요.`);
    const c = commitNick(f.elements.nick.value);
    if (!c) return;
    const nick = c.nick;
    const mine = gen;
    busy = true; sending = true; refresh();
    const done = () => { sending = false; if (mine === gen) { busy = false; refresh(); } };
    if (f.elements.website.value !== '') { set(); clearTab(kind); done(); return say(PHOTO_SAY.ok); } // the hidden honeypot field: look successful, send nothing
    const note = kind === PHOTO_KIND ? memo : kind === OVERVIEW_KIND ? [...`[전경] ${memo}`.trim()].slice(0, MAX_NOTE).join('') : evidenceNote(kind, memo);
    const say2 = (m) => { if (mine === gen) say(m); };
    say(files.length > 1 ? `1/${files.length} 보내는 중…` : '사진을 줄여서 보내는 중…');
    const res = await sendPhotos({
      files,
      send: (file) => postPhotoWhy(file, note, nick, kind === OVERVIEW_KIND),
      onProgress: (n, total) => { if (total > 1) say2(`${n}/${total} 보내는 중…`); },
    });
    if (res.sent.length) { if (c.save) saveNick(c.nick); set(); document.dispatchEvent(new CustomEvent('stats:report-send')); }
    if (mine === gen) {
      if (res.sent.length === res.total) clearTab(kind); // all sent: empty this tab, so the same photos are not sent twice
      else if (isPhotoKind(kind) && res.sent.length) { picked = picked.filter((_, i) => !res.sent.includes(i)); drawPicked(); } // keep only what is left to send
    }
    done();
    say2(photosMessage(res));
  }
  // The Worker keeps only a wall + short memo per photo, so the kind rides in the memo: "[운영시간] 입구 안내문".
  const evidenceNote = (kind, memo) => [...`[${kind}] ${memo}`.trim()].slice(0, MAX_NOTE).join('');
  for (const r of f.elements.kind) r.addEventListener('change', onKind);

  f.elements.nick.addEventListener('input', () => { confirmedNick = ''; });
  document.addEventListener('wall:report', (e) => {
    f.reset();
    confirmedNick = '';
    if (mode !== 'off') {
      f.elements.nick.value = readNick();
      const locked = nickLocked(mode, f.elements.nick.value);
      f.elements.nick.readOnly = locked;
      nickBox.querySelector('.rp-nick-lock').hidden = !locked;
    }
    const { name, kind, kinds, names, crag: isCrag } = typeof e.detail === 'string' ? { name: e.detail } : e.detail; // a card can open the sheet on a kind; 내 정보 sends no wall, so the sheet shows a picker of `names`
    const picking = Array.isArray(names) && !name;
    pickBox.hidden = !picking;
    nameEl.parentElement.hidden = picking; // the whole "암장 이름" row, not just the empty value
    wallNames = picking ? names : [];
    picks.hidden = true; picks.replaceChildren();
    crag = isCrag === true && !!name;
    const offer = crag ? CRAG_KINDS : kinds; // a crag gets its own list; a wall never sees the crag-only kinds
    for (const r of f.elements.kind) r.closest('label').hidden = offer ? !offer.includes(r.value) : CRAG_TOPICS.includes(r.value); // opened from a tab: only that tab's kinds
    const pick = [...f.elements.kind].find((r) => r.value === kind);
    if (pick) pick.checked = true;
    clearPicked(); clearEvidencePreview();
    gen++;
    drafts = {}; cur = f.elements.kind.value;
    routeWall.clear();
    syncKind();
    setWall(name || ''); // read-only text or a pick from the list, never typed
    if (picking) pickEl.value = '';
    busy = sending; refresh();
    alt.hidden = true;
    say('');
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.elements.send.disabled) return;
    const kind = f.elements.kind.value;
    if (isPhotoKind(kind) || (hasEvidence(kind) && !hasText(kind))) return sendPhoto(kind);
    const v = validateReport({
      name: wallName, kind: f.elements.kind.value, body: f.elements.body.value,
      from: f.elements.from.value, to: f.elements.to.value, parking: f.elements.parking.value, chat: f.elements.chat.value, insta: f.elements.insta.value, newUrl: f.elements.newUrl.value,
      setLast: f.elements.setLast.value, setNext: f.elements.setNext.value, routes: routeWall.routes(), sections: routeWall.sections(),
      note: f.elements.note.value, hp: f.elements.website.value, nick: nickCommit(mode, readNick(), f.elements.nick.value).nick,
    }, new Date(), { nick: mode, crag });
    if (!v.ok) return say(v.error);
    const wait = cooldownLeft(get(), Date.now());
    if (wait) return say(`${Math.ceil(wait / 1000)}초 뒤에 다시 보낼 수 있어요.`);
    const c = commitNick(f.elements.nick.value);
    if (!c) return;
    busy = true; refresh();
    if (c.save) saveNick(c.nick);
    if (!v.honeypot) {
      try {
        await fetch(config.reportEndpoint, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: buildPayload(v.report, config.reportNickEntry),
        });
      } catch {
        busy = false; refresh();
        alt.hidden = false;
        return say('보내지 못했어요. 연결을 확인하거나 아래 링크로 직접 제보해 주세요.');
      }
      set();
      document.dispatchEvent(new CustomEvent('stats:report-send')); // stats.js counts it (no wall name or text in it)
    }
    // text report went out; a attached picture goes to the board Worker after it (a failed picture must not hide that the text was sent)
    const ev = hasEvidence(kind) ? f.elements.evidence.files[0] : null;
    const memo = f.elements.body.value.replace(/\s+/g, ' ').trim();
    const err = ev && !v.honeypot ? await postPhoto(ev, evidenceNote(kind, memo), v.report.nick) : '';
    clearTab(kind); // sent: this tab is emptied and the button goes off until it has new content
    busy = false; refresh();
    say(err ? `글은 보냈어요. 사진은 보내지 못했어요: ${err}` : '제보 고마워요. 확인 후 반영해요.');
  });
}
