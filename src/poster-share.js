// src/poster-share.js — the sheet "오늘의 해벽": pick a photo (drag and zoom it into the card), write one line, see the card (poster-image.js), share or save it. DOM.
// Made on this device; nothing is sent anywhere but by the phone's own share sheet (or a download). Sharing or saving also keeps the
// finished card (and a small thumbnail) in this browser (poster-store.js) so the 기록 row can open it again. A record that has one opens it first.
// For a record of today the forecast hour is asked for (getWeather, at most 2 s) after the card is first drawn, and the card is drawn again with it.
import { MAX_PICK_BYTES } from './photo-upload.js';
import { MAX_LINE, MIN_ZOOM, RATIOS, clampZoom, coverSize, drawPoster, freeRoom, loadRatio, moveFocus, posterPicture, rezoom, saveRatio, thumbSize, todayStr } from './poster-image.js';
import { loadDome, saveDome, seedOf } from './poster-scene.js';
import { MAX_BYTES, MAX_THUMB, V } from './poster-store.js';
import { saveFile, shareInvite, shareSay } from './share-image.js';

const OPEN_WAIT = 1500; // the saved poster is looked up for at most this long: a stuck IndexedDB must not keep the sheet from opening
const KEY_STEP = 0.05; // an arrow key moves the window by this much of the room it has
const ZOOM_STEP = 0.25;

const $ = (id) => document.getElementById(id);
const QUALITIES = [0.85, 0.7, 0.55];
const THUMB_QUALITIES = [0.7, 0.55, 0.4];
const SAY = {
  too_big: `사진이 너무 커요(${MAX_PICK_BYTES / 1024 / 1024}MB까지). 다른 사진을 골라 주세요.`,
  bad_image: '이 사진은 열 수 없어요. 다른 사진(JPG·PNG)으로 골라 주세요.',
  failed: '카드를 만들지 못했어요. 잠시 뒤에 다시 열어 주세요.',
  keep_failed: '이 기기에 남기지 못했어요. 공유와 저장은 그대로 할 수 있어요.',
  hard: '사진이 복잡해서 글자가 잘 안 보일 수 있어요. 사진을 옮기거나 확대해 보세요.',
  kept: '카드를 이 기기에도 남겼어요. 기록에서 다시 열 수 있어요.',
};
const toBlob = (canvas, q) => new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', q));
const unit = (v) => Math.min(1, Math.max(0, v));
const safeStorage = () => { try { return localStorage; } catch { return null; } };

// the thumbnail the 기록 tab shows: 180 wide, the card's own shape, the first quality that fits MAX_THUMB (null when none does)
async function makeThumb(src, ratio) {
  const [w, h] = thumbSize(ratio);
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  c.getContext('2d').drawImage(src, 0, 0, w, h);
  for (const q of THUMB_QUALITIES) {
    const b = await toBlob(c, q);
    if (b && b.size <= MAX_THUMB) return b;
  }
  return null;
}

const shareText = (pic) => `${pic.title} ${pic.issue} · ${pic.name}\n${new URL('.', location.href).href}`;

/**
 * createPosterShare({ getWalls, getLog, getWeather, icon, posters, onChange, storage }) → { open({ record, from }) }. `from`: the button to give focus back to.
 * getLog() → the records (for the visit numbers); getWeather(wall name, Date) → Promise<{t, w}|null>; storage: where the last ratio and sun-path choice are kept.
 */
export function createPosterShare({ getWalls, getLog = () => [], getWeather = async () => null, icon = null, posters, onChange = () => {}, storage = safeStorage() }) {
  const dlg = $('poster-share');
  const canvas = $('ps-canvas');
  const img = $('ps-img');
  const pickBtn = $('ps-pick');
  const file = $('ps-file');
  const line = $('ps-line');
  const tools = $('ps-tools');
  const zoomRow = $('ps-zoomrow');
  const zoomEl = $('ps-zoom');
  const centerBtn = $('ps-center');
  const domeBtn = $('ps-dome');
  const go = $('ps-share');
  const save = $('ps-save');
  const again = $('ps-again');
  const say = $('ps-say');
  const live = $('ps-live');
  const ratioBtns = { '4:5': $('ps-ratio-45'), '9:16': $('ps-ratio-916') };
  if (icon) go.append(icon('share'));
  line.setAttribute('maxlength', String(MAX_LINE));
  let ctx = null; // { record, wall, weather }
  let bitmap = null;
  let ratio = '4:5';
  let focus = { x: 0.5, y: 0.5 }; // where the card's window sits within the room the photo leaves it
  let zoom = MIN_ZOOM;
  let dome = 'on';
  let shareBlob = null; // the poster as the share sheet gets it
  let keepBlob = null; // ...and the one kept on this device (≤ 400 KB), or null when no quality fits
  let keepThumb = null; // ...with its small thumbnail (≤ 30 KB), or null
  let text = '';
  let name = 'haebyeok-poster.jpg';
  let viewUrl = null;
  let token = 0; // only the newest redraw may enable the buttons
  let from = null;
  let timer = 0;
  let opening = false;
  let sealed = false; // the card was shared or saved (and kept): a late forecast must not redraw the preview any more
  let painting = false;
  let repaint = false;
  let flip = false;
  let picking = 0;
  const ptrs = new Map(); // pointer id → last position: one finger drags the photo, two pinch it

  const lines = (...parts) => parts.filter(Boolean).join(' ');
  const setMode = (view) => {
    canvas.hidden = view;
    img.hidden = !view;
    tools.hidden = view;
    zoomRow.hidden = view;
    again.hidden = !view;
  };
  const buttons = (on) => { go.disabled = !on; save.disabled = !on; };
  const freeUrl = () => { if (viewUrl) URL.revokeObjectURL(viewUrl); viewUrl = null; };
  const announce = (msg) => { flip = !flip; live.textContent = msg + (flip ? '​' : ''); };
  const syncControls = () => {
    for (const [r, b] of Object.entries(ratioBtns)) b.setAttribute('aria-pressed', String(r === ratio));
    domeBtn.setAttribute('aria-pressed', String(dome === 'on'));
    zoomEl.disabled = centerBtn.disabled = !bitmap;
    zoomEl.value = String(zoom);
    canvas.classList.toggle('can-drag', !!bitmap);
  };
  const picture = () => posterPicture(ctx.record, ctx.wall, line.value, { log: getLog(), weather: ctx.weather });
  const options = () => ({ ratio, focus, zoom, dome, seed: seedOf(ctx.record.id) });
  const show = (off) => {
    canvas.width = off.width;
    canvas.height = off.height;
    canvas.getContext('2d').drawImage(off, 0, 0);
  };
  const room = () => freeRoom(bitmap.width, bitmap.height, RATIOS[ratio].w, RATIOS[ratio].h, zoom);

  async function redraw() {
    const mine = ++token;
    buttons(false);
    shareBlob = keepBlob = keepThumb = null;
    say.textContent = '';
    const pic = picture();
    try {
      const off = document.createElement('canvas'); // drawn off screen: two redraws can never mix on the visible canvas
      const r = await drawPoster(off, pic, bitmap, options());
      if (mine !== token) return;
      show(off);
      let first = null;
      let fit = null;
      for (const q of QUALITIES) { // ready before the tap, so sharing needs no wait; the first fitting quality is also what is kept
        const b = await toBlob(off, q);
        if (mine !== token) return;
        if (!b) throw new Error('no picture');
        first ??= b;
        if (b.size <= MAX_BYTES) { fit = b; break; }
      }
      const thumb = await makeThumb(off, ratio);
      if (mine !== token) return;
      shareBlob = fit ?? first;
      keepBlob = fit;
      keepThumb = thumb;
      text = shareText(pic);
      name = `haebyeok-poster-${ctx.record.date}.jpg`;
      buttons(true);
      if (!r.ok) say.textContent = SAY.hard;
    } catch {
      if (mine === token) say.textContent = SAY.failed;
    }
  }
  const later = () => { // until the redraw runs the buttons would send the poster as it was before the last key
    token++; // a redraw already under way must not enable them with the old picture
    clearTimeout(timer);
    buttons(false);
    shareBlob = keepBlob = keepThumb = null;
    timer = setTimeout(redraw, 250);
  };
  // while a finger drags or a slider moves: only the visible card is drawn again (as fast as it can, never two at once); the pictures to share wait for later()
  async function quick() {
    if (painting) { repaint = true; return; }
    painting = true;
    try {
      do {
        repaint = false;
        const off = document.createElement('canvas');
        await drawPoster(off, picture(), bitmap, options());
        if (!dlg.open || viewUrl) return;
        show(off);
      } while (repaint);
    } catch { /* the redraw that follows says so */ } finally {
      painting = false;
    }
  }
  const touched = (msg) => { quick(); later(); if (msg) announce(msg); };

  function setZoom(z1) {
    if (!bitmap) return;
    const z = clampZoom(z1);
    if (z === zoom) return;
    focus = rezoom(bitmap.width, bitmap.height, RATIOS[ratio].w, RATIOS[ratio].h, focus, zoom, z);
    zoom = z;
    zoomEl.value = String(z);
    touched();
  }

  // the tap makes it final: share/save first (nothing awaited before it), then keep the poster on this device
  function keep() {
    sealed = true;
    if (!keepBlob) { say.textContent = SAY.keep_failed; return Promise.resolve(); }
    const { record } = ctx;
    return posters.put({ id: record.id, v: V, made: new Date().toISOString(), wall: record.wall, date: record.date, blob: keepBlob }, keepThumb)
      .then((ok) => { if (!ok) say.textContent = SAY.keep_failed; else { say.textContent = lines(say.textContent, SAY.kept); onChange(); } });
  }
  go.addEventListener('click', () => {
    if (!shareBlob) return;
    const r = shareInvite(shareBlob, text, name);
    if (!viewUrl) keep();
    r.done.then((res) => { say.textContent = lines(shareSay(res), say.textContent); });
  });
  save.addEventListener('click', () => {
    if (!shareBlob) return;
    saveFile(shareBlob, name);
    if (!viewUrl) keep();
  });
  again.addEventListener('click', () => {
    freeUrl();
    setMode(false);
    sealed = false;
    syncControls();
    redraw();
    askWeather(ctx);
    line.focus();
  });
  pickBtn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    if (f.size > MAX_PICK_BYTES) { say.textContent = SAY.too_big; return; }
    try {
      const session = ctx; // the sheet may be closed and opened for another record while the photo decodes
      const pick = ++picking;
      const full = await createImageBitmap(f, { imageOrientation: 'from-image' }); // the camera's rotation applied; redrawing drops EXIF
      const tall = RATIOS['9:16']; // the larger of the two cards: a photo scaled to cover it covers the other too
      const [w, h] = coverSize(full.width, full.height, tall.w, tall.h); // keep no more than the page needs (a 48 MP photo is ~200 MB decoded)
      let b = full;
      if (w < full.width) {
        const small = Object.assign(document.createElement('canvas'), { width: w, height: h });
        small.getContext('2d').drawImage(full, 0, 0, w, h);
        b = await createImageBitmap(small);
        full.close?.();
      }
      if (!dlg.open || ctx !== session || pick !== picking) { b.close?.(); return; } // closed, reopened for another record, or a newer photo was picked
      bitmap?.close?.();
      bitmap = b;
      focus = { x: 0.5, y: 0.5 };
      zoom = MIN_ZOOM;
      pickBtn.textContent = '다른 사진 고르기';
      syncControls();
      redraw();
    } catch {
      say.textContent = SAY.bad_image;
    }
  });
  line.addEventListener('input', later);
  line.addEventListener('keydown', (e) => { // Enter would submit the sheet's form (닫기 is its submit button) and drop the photo
    if (e.key === 'Enter') { e.preventDefault(); line.blur(); }
  });
  for (const [r, b] of Object.entries(ratioBtns)) {
    b.addEventListener('click', () => {
      ratio = r;
      saveRatio(storage, r);
      syncControls();
      touched();
    });
  }
  domeBtn.addEventListener('click', () => {
    dome = dome === 'on' ? 'off' : 'on';
    saveDome(storage, dome);
    syncControls();
    touched();
  });
  centerBtn.addEventListener('click', () => {
    focus = { x: 0.5, y: 0.5 };
    zoom = MIN_ZOOM;
    syncControls();
    touched('사진 위치와 크기를 처음으로 되돌렸어요');
  });
  zoomEl.addEventListener('input', () => setZoom(Number(zoomEl.value)));
  zoomEl.addEventListener('change', () => announce('사진 크기를 바꿨어요'));

  // drag the photo under the card with one finger, pinch with two; the arrow keys and + / - do the same for the keyboard
  const gap = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  let pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!bitmap || viewUrl) return;
    canvas.setPointerCapture?.(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.classList.add('dragging');
    if (ptrs.size === 2) pinch = { d0: gap(), z0: zoom };
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p || !bitmap) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (ptrs.size >= 2) { if (pinch) setZoom(pinch.z0 * (gap() / pinch.d0)); return; }
    const k = RATIOS[ratio].w / (canvas.getBoundingClientRect().width || RATIOS[ratio].w); // screen pixels → card pixels
    focus = moveFocus(focus, { dx: dx * k, dy: dy * k }, room());
    touched();
  });
  const release = (e) => {
    if (!ptrs.delete(e.pointerId)) return;
    pinch = ptrs.size === 2 ? { d0: gap(), z0: zoom } : null; // a finger left: the one that stays carries on from where it is, without a jump
    if (!ptrs.size) canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey || !bitmap || viewUrl) return; // a plain wheel still scrolls the page; Ctrl or a trackpad pinch zooms
    e.preventDefault();
    setZoom(zoom * Math.exp(-e.deltaY * 0.01));
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    if (!bitmap || viewUrl || e.ctrlKey || e.metaKey || e.altKey) return;
    const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (move) {
      const r = room();
      focus = { x: r.x > 0 ? unit(focus.x + move[0] * KEY_STEP) : focus.x, y: r.y > 0 ? unit(focus.y + move[1] * KEY_STEP) : focus.y };
      e.preventDefault();
      touched('사진 위치를 옮겼어요');
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom(zoom + ZOOM_STEP);
      announce('사진 크기를 바꿨어요');
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setZoom(zoom - ZOOM_STEP);
      announce('사진 크기를 바꿨어요');
    }
  });

  dlg.addEventListener('close', () => {
    token++;
    clearTimeout(timer);
    freeUrl();
    bitmap?.close?.();
    bitmap = null;
    ptrs.clear();
    pinch = null;
    canvas.classList.remove('dragging');
    // the list may have been redrawn behind the sheet: then the same button is found again by its data-focus key
    (from?.isConnected ? from : from?.dataset?.focus ? document.querySelector(`[data-focus="${from.dataset.focus}"]`) : null)?.focus();
  });

  // a record of today: ask for the forecast hour; when it comes (and the sheet is still the same one, in make mode) draw the card again with it
  function askWeather(mine) {
    const { record } = mine;
    if (!record.time || record.date !== todayStr()) return;
    getWeather(record.wall, new Date(`${record.date}T${record.time}:00`)).then((w) => {
      if (!w || ctx !== mine || !dlg.open) return;
      mine.weather = w; // kept even after sharing: the next share of this sheet has it
      if (viewUrl || sealed) return;
      redraw();
    }, () => {});
  }

  return {
    async open({ record, from: opener = null }) {
      if (opening || dlg.open) return; // a second tap while the first is still looking the poster up
      opening = true;
      ctx = { record, wall: getWalls().find((w) => w.name === record.wall) ?? null, weather: null };
      sealed = false;
      from = opener;
      bitmap = null;
      line.value = '';
      pickBtn.textContent = '사진 고르기';
      ratio = loadRatio(storage);
      dome = loadDome(storage);
      focus = { x: 0.5, y: 0.5 };
      zoom = MIN_ZOOM;
      domeBtn.hidden = !picture().arc; // no sun to show for this record: no switch for it
      syncControls();
      say.textContent = '';
      live.textContent = '';
      const kept = await Promise.race([posters.get(record.id), new Promise((ok) => setTimeout(ok, OPEN_WAIT, null))]);
      opening = false;
      dlg.showModal();
      if (kept) { // already made: show the kept poster, shared as it is
        shareBlob = kept.blob;
        keepBlob = null;
        text = shareText(posterPicture(record, ctx.wall, '', { log: getLog() }));
        name = `haebyeok-poster-${record.date}.jpg`;
        viewUrl = URL.createObjectURL(kept.blob);
        img.src = viewUrl;
        setMode(true);
        buttons(true);
      } else {
        setMode(false);
        redraw();
        askWeather(ctx);
      }
    },
  };
}
