// src/month-share.js — the sheet "이 달 기록 그림": the month picture (record-image.js), 암장 이름 넣기, 공유하기. DOM.
// The picture is made on this device; nothing is sent anywhere but by the phone's own share sheet (or a download).
import { canSaveMonth, drawMonth, monthPicture } from './record-image.js';
import { loadRatio, saveRatio } from './poster-image.js';
import { saveFile, shareInvite, shareSay } from './share-image.js';

const $ = (id) => document.getElementById(id);
const safeStorage = () => { try { return localStorage; } catch { return null; } };
const p2 = (n) => String(n).padStart(2, '0');

/** createMonthShare({ getWalls, icon }) → { open({ log, year, month, from }) }. `from`: the button to give focus back to. */
export function createMonthShare({ getWalls, icon = null, storage = safeStorage() }) {
  const dlg = $('month-share');
  const canvas = $('ms-canvas');
  const names = $('ms-names');
  const go = $('ms-share');
  const say = $('ms-say');
  const save = $('ms-save');
  if (icon) { save.prepend(icon('download')); go.prepend(icon('share')); } // the icons lead the buttons' own words, as in the 오늘의 해벽 sheet
  const ratioBtns = { '4:5': $('ms-ratio-45'), '9:16': $('ms-ratio-916') };
  let ratio = '4:5'; // the same choice as the 오늘의 해벽 card, kept on this device
  let ctx = null;
  let blob = null;
  let text = '';
  let file = 'haebyeok.png';
  let token = 0; // only the newest redraw may enable the button
  let from = null;

  async function redraw() {
    const mine = ++token;
    go.disabled = save.disabled = true;
    blob = null;
    say.textContent = '';
    const pic = monthPicture(ctx.log, getWalls(), ctx.year, ctx.month, { names: names.getAttribute('aria-pressed') === 'true' });
    if (!pic) { say.textContent = '이 달에는 기록이 없어요.'; return; }
    try {
      await drawMonth(canvas, pic, ratio);
      const b = await new Promise((ok) => canvas.toBlob(ok, 'image/png')); // ready before the tap, so sharing needs no wait
      if (mine !== token) return;
      if (!b) throw new Error('no picture');
      blob = b;
      text = `해벽 ${pic.year}년 ${pic.month}월 기록 · ${pic.visits}번 · ${pic.walls}곳\n${new URL('.', location.href).href}`;
      file = `haebyeok-${pic.year}-${p2(pic.month)}${ratio === '4:5' ? '-feed' : '-story'}.png`;
      if (canSaveMonth(pic.year, pic.month)) go.disabled = save.disabled = false;
      else say.textContent = `이번 달은 미리보기만 볼 수 있어요. ${pic.month % 12 + 1}월 1일부터 그림으로 저장하고 공유할 수 있어요.`; // a month still going on is not final
    } catch {
      if (mine === token) say.textContent = '그림을 만들지 못했어요. 잠시 뒤에 다시 열어 주세요.';
    }
  }

  // the months with a record, oldest first (this month's is a preview only: sharing waits for its end); the arrows step between them
  const months = () => [...new Set(ctx.log.map((r) => r.date.slice(0, 7)))].sort()
    .map((k) => ({ year: +k.slice(0, 4), month: +k.slice(5, 7) }));
  const key = (m) => m.year * 12 + m.month;
  function show() {
    const ms = months();
    const i = ms.findIndex((m) => key(m) === key(ctx));
    $('ms-month').textContent = `${ctx.year}년 ${ctx.month}월`;
    prevMo.disabled = i <= 0; // a month not in the list (no record) has no neighbour to step to
    nextMo.disabled = i < 0 || i >= ms.length - 1;
    redraw();
  }
  const step = (by) => {
    const ms = months();
    const i = ms.findIndex((m) => key(m) === key(ctx));
    if (i < 0 || !ms[i + by]) return;
    ctx = { ...ctx, ...ms[i + by] };
    show();
    (by < 0 ? prevMo : nextMo).focus();
  };
  const prevMo = $('ms-prevmo');
  const nextMo = $('ms-nextmo');
  prevMo.addEventListener('click', () => step(-1));
  nextMo.addEventListener('click', () => step(1));

  const showRatio = () => { for (const [r, b] of Object.entries(ratioBtns)) b.setAttribute('aria-pressed', String(r === ratio)); };
  for (const [r, b] of Object.entries(ratioBtns)) {
    b.addEventListener('click', () => {
      if (r === ratio) return;
      ratio = r;
      saveRatio(storage, ratio);
      showRatio();
      redraw();
    });
  }

  names.addEventListener('click', () => {
    names.setAttribute('aria-pressed', String(names.getAttribute('aria-pressed') !== 'true'));
    redraw();
  });
  go.addEventListener('click', () => {
    if (!blob) return;
    const r = shareInvite(blob, text, file); // straight from the tap: nothing is awaited before it
    r.done.then((res) => { say.textContent = shareSay(res); });
  });
  save.addEventListener('click', () => { if (blob) saveFile(blob, file); });
  dlg.addEventListener('close', () => { token++; from?.focus(); });

  return {
    open({ log, year, month, from: opener = null }) {
      ctx = { log, year, month };
      from = opener;
      ratio = loadRatio(storage);
      showRatio();
      names.setAttribute('aria-pressed', 'false');
      dlg.showModal();
      show();
    },
  };
}
