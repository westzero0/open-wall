// src/month-share.js — the sheet "이 달 그림으로 공유": the month picture (record-image.js), 암장 이름 넣기, 공유하기. DOM.
// The picture is made on this device; nothing is sent anywhere but by the phone's own share sheet (or a download).
import { canSaveMonth, drawMonth, monthPicture } from './record-image.js';
import { shareInvite, shareSay } from './share-image.js';

const $ = (id) => document.getElementById(id);
const p2 = (n) => String(n).padStart(2, '0');

/** createMonthShare({ getWalls, icon }) → { open({ log, year, month, from }) }. `from`: the button to give focus back to. */
export function createMonthShare({ getWalls, icon = null }) {
  const dlg = $('month-share');
  const canvas = $('ms-canvas');
  const names = $('ms-names');
  const go = $('ms-share');
  const say = $('ms-say');
  if (icon) go.append(icon('share')); // the share button is an icon; its name is the button's aria-label
  let ctx = null;
  let blob = null;
  let text = '';
  let file = 'haebyeok.png';
  let token = 0; // only the newest redraw may enable the button
  let from = null;

  async function redraw() {
    const mine = ++token;
    go.disabled = true;
    blob = null;
    say.textContent = '';
    const pic = monthPicture(ctx.log, getWalls(), ctx.year, ctx.month, { names: names.getAttribute('aria-pressed') === 'true' });
    if (!pic) { say.textContent = '이 달에는 기록이 없어요.'; return; }
    try {
      await drawMonth(canvas, pic);
      const b = await new Promise((ok) => canvas.toBlob(ok, 'image/png')); // ready before the tap, so sharing needs no wait
      if (mine !== token) return;
      if (!b) throw new Error('no picture');
      blob = b;
      text = `해벽 ${pic.year}년 ${pic.month}월 기록 · ${pic.visits}번 · ${pic.walls}곳\n${new URL('.', location.href).href}`;
      file = `haebyeok-${pic.year}-${p2(pic.month)}.png`;
      if (canSaveMonth(pic.year, pic.month)) go.disabled = false;
      else say.textContent = `이번 달은 미리보기만 볼 수 있어요. ${pic.month % 12 + 1}월 1일부터 그림으로 저장하고 공유할 수 있어요.`; // a month still going on is not final
    } catch {
      if (mine === token) say.textContent = '그림을 만들지 못했어요. 잠시 뒤에 다시 열어 주세요.';
    }
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
  dlg.addEventListener('close', () => { token++; from?.focus(); });

  return {
    open({ log, year, month, from: opener = null }) {
      ctx = { log, year, month };
      from = opener;
      names.setAttribute('aria-pressed', 'false');
      dlg.showModal();
      redraw();
    },
  };
}
