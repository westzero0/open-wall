// src/invite-view.js — 같이 가요: the invite sheet and the banner an invite link opens with.
// Logic is in invite.js; this file only draws and wires it. Whatever came from a link is shown with textContent.
import { el } from './dom.js';
import { ymd } from './time.js';
import { dayText, fmtMin, sunIntervals } from './viewmodel.js';
import { weekendDays } from './pick.js';
import { CHAT_URL_RE } from './store.js';
import { MAX_COUNT, MAX_NOTE, TAGS, buildInviteUrl, checkMoment, cleanNote, cleanTags, headsPhrase, inviteText } from './invite.js';
import { pictureBlob, shareInvite, shareSay } from './share-image.js';
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
      drawSoon();
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
    drawSoon();
  }
  for (const name of ['date', 'time', 'n', 'note']) form.elements[name].addEventListener('input', update);

  // The picture is drawn ahead, shortly after the last change, so a tap on 그림으로 공유 can hand it over at once (a wait
  // between the tap and navigator.share or the download makes the browser refuse them). A picture of older values is never
  // sent or shown: the key is everything it draws. The preview is there to long-press and save where downloads are blocked.
  const pic = $('inv-pic');
  const picImg = $('inv-pic-img');
  let ready = null; // { key, blob, url }
  let drawTimer;
  let drawingKey = null;
  let waiting = false; // the user tapped before the picture was ready
  const keyOf = () => JSON.stringify(picture);
  function drawSoon(ms = 350) {
    clearTimeout(drawTimer);
    if (!picture || past) { pic.hidden = true; return; }
    if (ready?.key === keyOf()) { pic.hidden = false; return; }
    pic.hidden = true;
    drawTimer = setTimeout(async () => {
      const key = keyOf();
      drawingKey = key;
      const blob = await pictureBlob(picture).catch(() => null);
      if (drawingKey === key) drawingKey = null;
      if (key !== keyOf() || past) return; // changed meanwhile: a newer draw is on its way
      if (!blob) {
        if (waiting) feedback('그림을 만들지 못했어요. 공유하기나 문구 복사로 보내 주세요.');
        waiting = false;
        return;
      }
      if (ready) { const old = ready.url; setTimeout(() => URL.revokeObjectURL(old), 60000); }
      ready = { key, blob, url: URL.createObjectURL(blob) };
      picImg.src = ready.url;
      picImg.alt = `같이 가요 그림: ${picture.name}, ${picture.date} ${picture.time}`;
      pic.hidden = false;
      if (waiting) feedback('그림이 준비됐어요. ‘그림으로 공유’를 한 번 더 눌러 주세요.');
      waiting = false;
    }, ms);
  }

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
  // no await before shareInvite: the tap's permission to share or download must still hold
  $('inv-image').addEventListener('click', () => {
    if (past) return feedback('이미 지난 시각이에요. 날짜나 시간을 바꿔 주세요.');
    const text = $('inv-preview').textContent;
    if (!text || !picture) return feedback('날짜와 시간을 골라 주세요.');
    if (ready?.key !== keyOf()) {
      waiting = true;
      if (drawingKey !== keyOf()) drawSoon(0);
      return feedback('그림을 만드는 중이에요… 다 되면 한 번 더 눌러 주세요.');
    }
    const { via, done } = shareInvite(ready.blob, text);
    if (via === 'share') feedback('공유 창을 열었어요.');
    const key = ready.key;
    done.then((r) => { if (key === keyOf()) feedback(shareSay(r)); });
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
    waiting = false;
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
