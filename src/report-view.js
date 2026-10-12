// Report sheet: opens on wall:report, posts to the Google Form (no-cors: the response is unreadable, only a network error counts as failure).
import { config } from './config.js';
import { MAX_BODY, MAX_NICK, NICK_KEY, PHOTO_KIND, buildPayload, cooldownLeft, loadNick, nickLocked, nickMode, validateReport } from './report.js';
import { MAX_NOTE, PHOTO_SAY, shrinkToJpeg, uploadPhoto } from './photo-upload.js';

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

  f.elements.body.maxLength = MAX_BODY;
  alt.href = config.reportFormUrl; // fixed constant, not user input

  // Per kind: the extra pick it needs and what the memo asks for. 운영시간 stays a memo (with an example), not a form.
  const MEMO = {
    운영시간: ['바뀐 운영시간', '예) 평일 10:00–22:00, 토 10:00–18:00, 일 휴무. 휴게시간이나 계절(동절기) 차이도 편하게 적어 주세요.'],
    임시휴무: ['메모 (선택)', '예) 시설 공사, 대회 개최'],
    주차: ['메모 (선택)', '예) 건물 뒤 공영주차장 2시간 무료'],
    세팅일: ['메모 (선택)', '예) 왼쪽 벽 새 루트 12개, 공지에서 확인'],
    기타: ['내용', '무엇이 어떻게 달라졌는지 적어 주세요.'],
    오픈채팅방: ['메모 (선택)', '예) 매주 토요일 저녁 모임, 초보 환영'],
    '암장 사진': [`메모 (선택 · ${MAX_NOTE}자까지)`, '예) 입구 쪽 벽, 오늘 오후에 찍었어요'],
  };
  // One report per tab: each kind keeps its own memo/source draft, the send button lives only while the current kind has something to send,
  // and a sent report empties just its own tab.
  let cur = '';
  let drafts = {};
  let busy = false;
  const hasContent = (kind) => {
    const v = (n) => f.elements[n].value.trim();
    switch (kind) {
      case '': return false;
      case '임시휴무': return !!v('from');
      case '주차': return !!f.elements.parking.value;
      case '오픈채팅방': return !!v('chat');
      case '세팅일': return !!(v('setLast') || v('setNext') || v('body'));
      case PHOTO_KIND: return !!f.elements.photo.files?.length;
      default: return !!v('body'); // 운영시간, 기타
    }
  };
  const refresh = () => { f.elements.send.disabled = busy || !hasContent(f.elements.kind.value); };
  const clearTab = (kind) => {
    for (const x of f.querySelectorAll(`.rp-extra[data-kind="${kind}"]`)) {
      for (const i of x.querySelectorAll('input, textarea')) { if (i.type === 'radio' || i.type === 'checkbox') i.checked = false; else i.value = ''; }
    }
    f.elements.body.value = ''; f.elements.note.value = '';
    delete drafts[kind];
    if (kind === PHOTO_KIND) clearPreview();
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
    for (const x of f.querySelectorAll('.rp-extra')) x.hidden = x.dataset.kind !== kind;
    const [label, hint] = MEMO[kind] ?? ['내용', ''];
    f.querySelector('.rp-label').textContent = label;
    f.elements.body.placeholder = hint;
    const photo = kind === PHOTO_KIND; // no nickname or source line for a photo; the Worker takes only the picture and a short memo
    f.querySelector('.rp-note').hidden = photo;
    nickBox.hidden = mode === 'off' || photo;
  };
  const preview = dlg.querySelector('.rp-photo-preview');
  let previewUrl = '';
  const clearPreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; preview.hidden = true; preview.removeAttribute('src'); };
  f.elements.photo.addEventListener('change', () => {
    clearPreview();
    const file = f.elements.photo.files?.[0];
    if (!file) return;
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.hidden = false;
  });
  dlg.addEventListener('close', clearPreview);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close()); // no inline onclick: the CSP blocks it

  // 암장 사진: shrink in the browser (drops EXIF/GPS), then POST to the board Worker. No Google Form, no name or email.
  async function sendPhoto() {
    if (!config.boardUrl) return say(PHOTO_SAY.network);
    const file = f.elements.photo.files?.[0];
    if (!file) return say('보낼 사진을 골라 주세요.');
    const note = f.elements.body.value.replace(/\s+/g, ' ').trim();
    if ([...note].length > MAX_NOTE) return say(`메모는 ${MAX_NOTE}자까지 적을 수 있어요.`);
    const wait = cooldownLeft(get(), Date.now());
    if (wait) return say(`${Math.ceil(wait / 1000)}초 뒤에 다시 보낼 수 있어요.`);
    busy = true; refresh();
    const done = () => { busy = false; refresh(); };
    if (f.elements.website.value !== '') { set(); clearTab(PHOTO_KIND); done(); return say(PHOTO_SAY.ok); } // the hidden honeypot field: look successful, send nothing
    say('사진을 줄여서 보내는 중…');
    let blob;
    try { blob = await shrinkToJpeg(file); } catch (e) { done(); return say(e.message === 'too_big' ? PHOTO_SAY.too_big : PHOTO_SAY.bad_image); }
    const r = await uploadPhoto({ url: config.boardUrl, wall: wallName, blob, note });
    if (!r.ok) { done(); return say(PHOTO_SAY[r.why]); }
    set();
    clearTab(PHOTO_KIND); // sent: empty this tab, so the same photo is not sent twice (the button goes off with it)
    done();
    say(PHOTO_SAY.ok);
  }
  for (const r of f.elements.kind) r.addEventListener('change', onKind);

  document.addEventListener('wall:report', (e) => {
    f.reset();
    if (mode !== 'off') {
      f.elements.nick.value = readNick();
      const locked = nickLocked(mode, f.elements.nick.value);
      f.elements.nick.readOnly = locked;
      nickBox.querySelector('.rp-nick-lock').hidden = !locked;
    }
    const { name, kind } = typeof e.detail === 'string' ? { name: e.detail } : e.detail; // a card can open the sheet on a kind
    const pick = [...f.elements.kind].find((r) => r.value === kind);
    if (pick) pick.checked = true;
    clearPreview();
    drafts = {}; cur = f.elements.kind.value;
    syncKind();
    wallName = name; nameEl.textContent = name; // read-only text, never typed
    chatNameEl.textContent = `[해벽] ${name} 모임`;
    busy = false; refresh();
    alt.hidden = true;
    say('');
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.elements.send.disabled) return;
    if (f.elements.kind.value === PHOTO_KIND) return sendPhoto();
    const v = validateReport({
      name: wallName, kind: f.elements.kind.value, body: f.elements.body.value,
      from: f.elements.from.value, to: f.elements.to.value, parking: f.elements.parking.value, chat: f.elements.chat.value,
      setLast: f.elements.setLast.value, setNext: f.elements.setNext.value,
      note: f.elements.note.value, hp: f.elements.website.value, nick: f.elements.nick.value,
    }, new Date(), { nick: mode });
    if (!v.ok) return say(v.error);
    const wait = cooldownLeft(get(), Date.now());
    if (wait) return say(`${Math.ceil(wait / 1000)}초 뒤에 다시 보낼 수 있어요.`);
    busy = true; refresh();
    if (v.report.nick) saveNick(v.report.nick);
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
    }
    clearTab(f.elements.kind.value); // sent: this tab is emptied and the button goes off until it has new content
    busy = false; refresh();
    say('제보 고마워요. 확인 후 반영해요.');
  });
}
