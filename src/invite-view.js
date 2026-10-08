// src/invite-view.js — 같이 가요: the invite sheet and the banner an invite link opens with.
// Logic is in invite.js; this file only draws and wires it. Whatever came from a link is shown with textContent.
import { el } from './dom.js';
import { ymd } from './time.js';
import { dayText, fmtMin, sunIntervals } from './viewmodel.js';
import { weekendDays } from './pick.js';
import { CHAT_URL_RE } from './store.js';
import { MAX_COUNT, MAX_NOTE, TAGS, buildInviteUrl, checkMoment, cleanNote, cleanTags, headsPhrase, inviteText } from './invite.js';
import { pictureBlob, saveFile, shareInvite, shareSay } from './share-image.js';
import { initialInviteState, nextInviteState } from './invite-state.js';
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
      $('inv-preview').textContent = '';
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
    $('inv-preview').textContent = inviteText({
      name: wall.name, ...f, sunLine, caution,
      chatUrl: CHAT_URL_RE.test(wall.contact?.chat_url ?? '') ? wall.contact.chat_url : null,
      url: buildInviteUrl(location.href, { name: wall.name, ...f }),
    });
    redraw();
  }
  for (const name of ['date', 'time', 'n', 'note']) form.elements[name].addEventListener('input', update);

  // The picture is drawn ahead, 0.8 s after the last change; 저장 fixes it for the values at that moment (invite-state.js).
  // Only then do 그림으로 공유 and 그림 저장 work, and they hand over a Blob that is already there: nothing is awaited in the tap
  // (a wait between the tap and navigator.share or the download makes the browser refuse them). A picture of older values is
  // never sent or shown: the key is everything it draws.
  const pic = $('inv-pic');
  const picImg = $('inv-pic-img');
  const saveBtn = $('inv-save');
  const gated = [$('inv-image'), $('inv-dl')];
  const why = $('inv-why');
  let st = initialInviteState();
  let ready = null; // { key, blob, url }: the last picture drawn for the current values
  let drawTimer;
  let drawingKey = null;
  const keyOf = () => (picture && !past ? JSON.stringify(picture) : null);
  const ERR = { past: '이미 지난 시각이에요. 날짜나 시간을 바꿔 주세요.', empty: '날짜와 시간을 골라 주세요.' };
  function render(was) {
    const { phase } = st;
    saveBtn.disabled = phase === 'making';
    saveBtn.textContent = phase === 'making' ? '확정하는 중…' : '저장';
    saveBtn.setAttribute('aria-busy', String(phase === 'making'));
    for (const b of gated) b.setAttribute('aria-disabled', String(phase !== 'done'));
    why.hidden = phase === 'done';
    pic.hidden = phase !== 'done';
    if (phase === 'done') {
      if (picImg.src !== ready.url) picImg.src = ready.url;
      picImg.alt = `같이 가요 그림: ${picture.name}, ${picture.date} ${picture.time}`;
      if (was !== 'done') feedback('저장했어요. 이제 공유할 수 있어요.');
    } else if (phase === 'making') feedback('그림을 확정하는 중이에요…');
    else if (st.err) feedback(ERR[st.err]);
    else if (was === 'done') feedback('내용을 바꿨어요. 저장을 눌러 주세요.');
  }
  function dispatch(event) {
    const was = st.phase;
    st = nextInviteState(st, event);
    render(was);
  }
  function drawSoon(ms) {
    clearTimeout(drawTimer);
    const key = keyOf();
    if (!key || ready?.key === key) return;
    drawTimer = setTimeout(async () => {
      drawingKey = key;
      const blob = await pictureBlob(picture).catch(() => null);
      if (drawingKey === key) drawingKey = null;
      if (key !== keyOf()) return; // changed meanwhile: a newer draw is on its way, this one is dropped
      if (!blob) {
        const wasMaking = st.phase === 'making';
        dispatch({ type: 'failed', key });
        if (wasMaking) feedback('그림을 만들지 못했어요. 공유하기나 문구 복사로 보내 주세요.');
        return;
      }
      if (ready) URL.revokeObjectURL(ready.url);
      ready = { key, blob, url: URL.createObjectURL(blob) };
      dispatch({ type: 'drawn', key });
    }, ms);
  }
  const redraw = () => {
    dispatch({ type: 'change', key: keyOf() });
    drawSoon(st.phase === 'making' ? 0 : 800);
  };

  const feedback = (msg) => { say.textContent = msg; }; // cleared by the next change (update)
  async function send(viaSheet) {
    if (past) return feedback('이미 지난 시각이에요. 날짜나 시간을 바꿔 주세요.');
    const text = $('inv-preview').textContent;
    if (!text) return feedback('날짜와 시간을 골라 주세요.');
    try {
      if (viaSheet && navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      feedback('문구를 복사했어요. 메신저에 붙여 넣어 보내세요.');
    } catch (e) {
      if (e?.name !== 'AbortError') prompt('문구를 복사하세요', text); // no clipboard (http, denied); AbortError = sheet closed
    }
  }
  $('inv-share').addEventListener('click', () => send(true));
  $('inv-copy').addEventListener('click', () => send(false));
  saveBtn.addEventListener('click', () => {
    dispatch({ type: 'save', key: keyOf(), past });
    if (st.phase === 'making' && drawingKey !== st.key) drawSoon(0);
  });
  // no await before shareInvite or saveFile: the tap's permission to share or download must still hold
  const needSave = () => st.phase !== 'done' && (feedback('먼저 저장을 눌러 주세요.'), true);
  $('inv-image').addEventListener('click', () => {
    if (needSave()) return;
    const { via, done } = shareInvite(ready.blob, $('inv-preview').textContent);
    if (via === 'share') feedback('공유 창을 열었어요.');
    const key = ready.key;
    done.then((r) => { if (key === keyOf() && st.phase === 'done') feedback(shareSay(r)); });
  });
  $('inv-dl').addEventListener('click', () => {
    if (needSave()) return;
    saveFile(ready.blob);
    feedback('그림을 저장했어요(다운로드 폴더). 문구는 복사하지 않았어요.');
  });

  function openInvite(name) {
    wall = getWalls().find((w) => w.name === name) ?? null;
    if (!wall) return;
    tags = new Set();
    kind = 'look';
    for (const b of kindBtns) b.setAttribute('aria-pressed', String(b.dataset.kind === 'look'));
    for (const b of tagBox.children) b.setAttribute('aria-pressed', 'false');
    form.reset();
    const first = weekendDays(new Date())[0].date; // the nearest weekend day, 14:00: a sensible start to change
    form.elements.date.min = ymd(new Date());
    form.elements.date.value = ymd(first);
    form.elements.time.value = '14:00';
    $('inv-wall').textContent = wall.name; // read-only text
    dispatch({ type: 'open' });
    update();
    dlg.showModal();
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
