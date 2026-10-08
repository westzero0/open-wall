// Report sheet: opens on wall:report, posts to the Google Form (no-cors: the response is unreadable, only a network error counts as failure).
import { config } from './config.js';
import { MAX_BODY, MAX_NICK, buildPayload, cooldownLeft, loadNick, nickMode, validateReport } from './report.js';

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
  const NICK_KEY = 'open-wall:nick';
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
  };
  const syncKind = () => {
    const kind = f.elements.kind.value;
    for (const x of f.querySelectorAll('.rp-extra')) x.hidden = x.dataset.kind !== kind;
    const [label, hint] = MEMO[kind] ?? ['내용', ''];
    f.querySelector('.rp-label').textContent = label;
    f.elements.body.placeholder = hint;
  };
  for (const r of f.elements.kind) r.addEventListener('change', syncKind);

  document.addEventListener('wall:report', (e) => {
    f.reset();
    if (mode !== 'off') f.elements.nick.value = readNick();
    const { name, kind } = typeof e.detail === 'string' ? { name: e.detail } : e.detail; // a card can open the sheet on a kind
    const pick = [...f.elements.kind].find((r) => r.value === kind);
    if (pick) pick.checked = true;
    syncKind();
    wallName = name; nameEl.textContent = name; // read-only text, never typed
    chatNameEl.textContent = `[해벽] ${name} 모임`;
    f.elements.send.disabled = false;
    alt.hidden = true;
    say('');
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.elements.send.disabled) return;
    const v = validateReport({
      name: wallName, kind: f.elements.kind.value, body: f.elements.body.value,
      from: f.elements.from.value, to: f.elements.to.value, parking: f.elements.parking.value, chat: f.elements.chat.value,
      setLast: f.elements.setLast.value, setNext: f.elements.setNext.value,
      note: f.elements.note.value, hp: f.elements.website.value, nick: f.elements.nick.value,
    }, new Date(), { nick: mode });
    if (!v.ok) return say(v.error);
    const wait = cooldownLeft(get(), Date.now());
    if (wait) return say(`${Math.ceil(wait / 1000)}초 뒤에 다시 보낼 수 있어요.`);
    f.elements.send.disabled = true;
    if (v.report.nick) saveNick(v.report.nick);
    if (!v.honeypot) {
      try {
        await fetch(config.reportEndpoint, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: buildPayload(v.report, config.reportNickEntry),
        });
      } catch {
        f.elements.send.disabled = false;
        alt.hidden = false;
        return say('보내지 못했어요. 연결을 확인하거나 아래 링크로 직접 제보해 주세요.');
      }
      set();
    }
    say('제보 고마워요. 확인 후 반영해요.');
  });
}
