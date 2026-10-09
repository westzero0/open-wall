// src/invite-view.js — 같이 가요: the invite sheet and the banner an invite link opens with.
// Logic is in invite.js; this file only draws and wires it. Whatever came from a link is shown with textContent.
import { el } from './dom.js';
import { ymd } from './time.js';
import { dayText, fmtMin, sunIntervals } from './viewmodel.js';
import { weekendDays } from './pick.js';
import { MAX_COUNT, MAX_NOTE, TAGS, buildInviteUrl, checkMoment, cleanNote, cleanTags, headsPhrase } from './invite.js';
import { drawInviteCard, pictureBlob, saveFile } from './share-image.js';
import { KAKAO_SAY, kakaoPayload, loadKakao, shareKakao } from './kakao-share.js';
import { openIntervals } from './hours.js';

const $ = (id) => document.getElementById(id);
const toMin = (hhmm) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** createInviteView({ getWalls }) → { openInvite(name), banner(invite, wall) } */
export function createInviteView({ getWalls }) {
  const dlg = $('invite');
  const form = dlg.querySelector('form');
  const say = $('inv-say');
  const check = $('inv-check');
  let wall = null;
  let tags = new Set();
  let past = false;
  let kind = 'look'; // 'look': looking for people; 'have': a group is already going
  let picture = null; // what the picture shows, set with the preview

  // ---- the sheet
  const tagBox = $('inv-tags');
  for (const [id, label] of TAGS) {
    const b = el('button', { type: 'button', class: 'sh-toggle inv-tag', 'aria-pressed': 'false', 'data-tag': id }, label);
    b.addEventListener('click', () => {
      tags.has(id) ? tags.delete(id) : tags.add(id);
      b.setAttribute('aria-pressed', String(tags.has(id)));
      update();
    });
    tagBox.append(b);
  }
  const count = form.elements.n;
  count.append(el('option', { value: '' }, '인원 미정'), ...Array.from({ length: MAX_COUNT }, (_, i) => el('option', { value: String(i + 1) }, `${i + 1}명`)));
  const kindBtns = [...dlg.querySelectorAll('.inv-kind button')];
  for (const b of kindBtns) {
    b.addEventListener('click', () => {
      kind = b.dataset.kind;
      for (const o of kindBtns) o.setAttribute('aria-pressed', String(o === b));
      update();
    });
  }
  form.elements.note.maxLength = MAX_NOTE;
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  const fields = () => ({
    date: form.elements.date.value, min: toMin(form.elements.time.value),
    n: form.elements.n.value, kind, tags: [...tags], note: form.elements.note.value,
  });

  // the check line (open or not, the sun) and the preview of what will be sent
  function update() {
    if (!wall) return;
    say.textContent = ''; // what the last send said stays until the next change
    const f = fields();
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(f.date) && f.min !== null;
    const now = new Date();
    past = !valid || f.date < ymd(now) || (f.date === ymd(now) && f.min < now.getHours() * 60 + now.getMinutes());
    check.replaceChildren();
    if (!valid) {
      check.append('날짜와 시간을 골라 주세요.');
      picture = null;
      redraw();
      return;
    }
    if (past) check.append('이미 지난 시각이에요. 날짜나 시간을 바꿔 주세요.');
    else {
      const c = checkMoment(wall, f.date, f.min);
      if (c.state === 'unknown') check.append('운영시간을 아직 몰라요. 가기 전에 꼭 확인해 주세요.');
      else if (c.state === 'open') check.append(`그 시간엔 열려 있어요.${c.sunLine ? ` ${c.sunLine}.` : ''}`);
      else if (c.closedDay) check.append('그날은 쉬는 날이에요. 다른 날을 골라 주세요.');
      else {
        check.append('그 시간엔 닫혀 있어요. ');
        if (c.alt !== null) {
          const alt = el('button', { type: 'button', class: 'inv-alt' }, `${fmtMin(c.alt)}로 바꾸기`);
          alt.addEventListener('click', () => { form.elements.time.value = fmtMin(c.alt); update(); });
          check.append(alt);
        }
      }
    }
    const open = !past && checkMoment(wall, f.date, f.min);
    const caution = !!open && open.state !== 'open'; // closed then, or hours unknown: the message says to check
    const sunLine = open && open.state === 'open' ? open.sunLine : null;
    const day = new Date(`${f.date}T00:00`);
    const hasOpen = !past && open && open.state !== 'unknown';
    const kinds = cleanTags(f.tags).map((id) => TAGS.find(([t]) => t === id)[1]);
    picture = {
      name: wall.name, date: dayText(day), time: fmtMin(f.min), at: f.min,
      open: hasOpen ? openIntervals(wall, day) : [], sun: open && open.sunLine !== null ? sunIntervals(wall, day) : [],
      sunLine: caution ? '※ 운영시간 확인 필요' : sunLine, sunInfo: caution ? null : open?.sunInfo ?? null,
      tags: [...kinds, headsPhrase(f.n, f.kind)].filter(Boolean), note: cleanNote(f.note),
      made: `${ymd(now)} ${fmtMin(now.getHours() * 60 + now.getMinutes())}`.replace(/-/g, '.'), // 2026.10.08 14:32
    };
    redraw();
  }
  for (const name of ['date', 'time', 'n', 'note']) form.elements[name].addEventListener('input', update);

  // Both pictures are drawn ahead, 0.8 s after the last change: the 9:16 one is shown under the button (long-press or the icon saves
  // it for a story), the 3:4 card goes to KakaoTalk with the link. A picture of older values is never sent: the key is everything
  // it draws, and the button stays off until the picture matches the current values.
  const pic = $('inv-pic');
  const picImg = $('inv-pic-img');
  const kakaoBtn = $('inv-kakao');
  let ready = null; // { key, blob, url, card }: the last picture drawn (card: the 3:4 one for KakaoTalk, or null)
  let kakao = null; // the SDK once loaded and initialised; null while loading or when it cannot load
  let kakaoOff = false; // it failed to load: the button stays off with a reason
  const uploaded = {}; // { key, url }: the card last uploaded to Kakao, reused for the same picture
  let drawTimer;
  const keyOf = () => (picture && !past ? JSON.stringify(picture) : null);
  const ERR = { past: '이미 지난 시각이에요. 날짜나 시간을 바꿔 주세요.', empty: '날짜와 시간을 골라 주세요.' };
  const feedback = (msg) => { say.textContent = msg; }; // cleared by the next change (update)
  function render() {
    const key = keyOf();
    const fresh = !!key && ready?.key === key;
    kakaoBtn.setAttribute('aria-disabled', String(!(fresh && kakao && ready.card)));
    $('inv-kakao-note').textContent = kakaoOff ? KAKAO_SAY.unavailable : '그림은 카카오 서버에 올라가요.';
    pic.hidden = !ready || !key;
    pic.classList.toggle('stale', !fresh);
    if (ready && key) {
      if (picImg.src !== ready.url) picImg.src = ready.url;
      picImg.alt = `같이 가요 그림: ${picture.name}, ${picture.date} ${picture.time}`;
    }
  }
  function drawSoon(ms) {
    clearTimeout(drawTimer);
    const key = keyOf();
    if (!key || ready?.key === key) return;
    drawTimer = setTimeout(async () => {
      const drawn = picture;
      const blob = await pictureBlob(drawn).catch(() => null);
      const card = blob && await pictureBlob(drawn, drawInviteCard).catch(() => null); // a card that fails only turns KakaoTalk off
      if (key !== keyOf()) return; // changed meanwhile: a newer draw is on its way, this one is dropped
      if (!blob) return feedback('그림을 만들지 못했어요. 잠시 뒤 다시 해 주세요.');
      if (ready) URL.revokeObjectURL(ready.url);
      ready = { key, blob, url: URL.createObjectURL(blob), card };
      render();
    }, ms);
  }
  const redraw = () => {
    render();
    drawSoon(800);
  };

  // no await before saveFile: the tap's permission to download must still hold
  $('inv-pic-save').addEventListener('click', () => {
    if (!ready || ready.key !== keyOf()) return;
    saveFile(ready.blob);
    feedback('그림을 저장했어요(갤러리의 “다운로드” 앨범).');
  });

  // 카카오톡 공유하기: the 3:4 card drawn for these values is uploaded (once per picture) and sent as a feed message with the
  // invite link. Only the upload is awaited; nothing is drawn here.
  kakaoBtn.addEventListener('click', async () => {
    if (!kakao) return feedback(kakaoOff ? KAKAO_SAY.unavailable : '카카오톡 공유를 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요.');
    const now = keyOf();
    if (!now) return feedback(past ? ERR.past : ERR.empty);
    if (ready?.key !== now) return feedback('그림을 만드는 중이에요. 잠시 뒤 다시 눌러 주세요.');
    if (!ready.card) return feedback(KAKAO_SAY.unavailable);
    const { key, card } = ready;
    const shown = picture;
    const url = buildInviteUrl(location.href, { name: wall.name, ...fields() });
    if (uploaded.key !== key) feedback('그림을 카카오 서버에 올리는 중이에요…');
    const r = await shareKakao(kakao, { key, blob: card, build: (imageUrl) => kakaoPayload({ picture: shown, url, imageUrl }) }, uploaded);
    if (key === keyOf()) feedback(r.ok ? KAKAO_SAY.ok : KAKAO_SAY[r.why]);
  });
  function startKakao() {
    if (kakao) return;
    loadKakao().then((K) => { kakao = K; kakaoOff = false; }, () => { kakaoOff = true; }).then(render);
  }

  function openInvite(name) {
    wall = getWalls().find((w) => w.name === name) ?? null;
    if (!wall) return;
    tags = new Set();
    kind = 'look';
    for (const b of kindBtns) b.setAttribute('aria-pressed', String(b.dataset.kind === 'look'));
    for (const b of tagBox.children) b.setAttribute('aria-pressed', 'false');
    form.reset();
    if (ready) { URL.revokeObjectURL(ready.url); ready = null; }
    const first = weekendDays(new Date())[0].date; // the nearest weekend day, 14:00: a sensible start to change
    form.elements.date.min = ymd(new Date());
    form.elements.date.value = ymd(first);
    form.elements.time.value = '14:00';
    $('inv-wall').textContent = wall.name; // read-only text
    update();
    dlg.showModal();
    startKakao(); // the SDK loads only when the sheet is first opened, never with the page
  }

  return {
    openInvite,
    // The invite a link opened with. `past`: the moment is gone, so the page only says so.
    banner(inv, found) {
      const box = $('invite-banner');
      const when = `${dayText(new Date(`${inv.date}T00:00`))} ${fmtMin(inv.min)}`;
      $('ib-title').textContent = inv.past ? `지난 약속이에요 · ${when}` : `같이 가요 초대 · ${when}`;
      const labels = inv.tags.map((id) => TAGS.find(([t]) => t === id)[1]);
      $('ib-meta').textContent = [found.name, ...labels, headsPhrase(inv.n, inv.kind)].filter(Boolean).join(' · ');
      const note = $('ib-note');
      const words = cleanNote(inv.note); // cleaned again where it is shown
      note.hidden = !words;
      note.replaceChildren(...(words ? [`"${words}"`, el('span', { class: 'ib-from' }, ' 보낸 사람이 쓴 문구예요')] : []));
      const again = $('ib-again');
      again.hidden = !inv.past;
      again.onclick = () => { box.hidden = true; openInvite(found.name); };
      box.hidden = false;
    },
  };
}
