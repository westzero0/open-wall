// src/photo-upload.js — 외벽 사진 제보: shrink the picked photo to a small JPEG in the browser, then POST it to the board Worker (worker/index.js
// /v1/photos). Re-drawing the picture on a canvas drops every metadata block (EXIF, so no GPS), and the Worker strips any left over.
// fitSize, photoPath and uploadPhoto are pure (tested); shrinkToJpeg needs a canvas and takes its pieces as arguments.
export const MAX_EDGE = 1280; // longest side after shrinking
export const QUALITY = 0.82;
export const OVERVIEW_EDGE = 2048; // a 전경 picture is looked at zoomed in, so it keeps more pixels
export const FIT_BYTES = 680 * 1024; // under the Worker's 700 KB limit (worker/index.js MAX_PHOTO_BYTES)
const FALLBACK_QUALITY = [0.74, 0.66]; // tried in turn at each size when the picture is still too big
const FALLBACK_EDGES = [1, 0.875, 0.75]; // × the edge
export const MAX_NOTE = 100;
export const MAX_PICK_BYTES = 30 * 1024 * 1024; // refuse a pick this large before decoding it

/** fitSize(w, h, max) → [w', h']: scaled down to fit max on the long side, never up. */
export function fitSize(w, h, max = MAX_EDGE) {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

/** photoPath(wall, note) → '/v1/photos?wall=…&note=…' (note omitted when empty). */
export const photoPath = (wall, note = '', nick = '') => `/v1/photos?wall=${encodeURIComponent(wall)}${note ? `&note=${encodeURIComponent(note)}` : ''}${nick ? `&nick=${encodeURIComponent(nick)}` : ''}`;

/** What the sheet says for each outcome of an upload. */
export const PHOTO_SAY = {
  ok: '사진을 보냈어요. 확인 후 반영해요.',
  rate_limited: '잠시 뒤에 다시 보내 주세요. 사진은 하루에 몇 장까지 받아요.',
  too_big: '사진이 너무 커요. 다른 사진으로 골라 주세요.',
  bad_image: '이 사진은 보낼 수 없어요. 다른 사진(JPG·PNG)으로 골라 주세요.',
  full: '지금은 사진을 더 받을 수 없어요. 나중에 다시 시도해 주세요.',
  network: '보내지 못했어요. 연결을 확인하고 다시 눌러 주세요.',
};

const whyOf = (status) => (status === 429 ? 'rate_limited' : status === 413 ? 'too_big' : status === 400 ? 'bad_image' : status === 503 ? 'full' : 'network');

/**
 * shrinkToJpeg(file, { bitmap, canvas, edge, maxBytes }) → Promise<Blob> (image/jpeg). bitmap(file) decodes with the camera's rotation applied
 * (createImageBitmap … 'from-image'); canvas(w, h) makes a canvas. Throws when the file is not a picture the browser can decode.
 * maxBytes (optional): when the JPEG is bigger, lower the quality and then the size step by step until it fits; the last try is returned
 * even if it still does not (the Worker then says 413).
 */
export async function shrinkToJpeg(file, {
  bitmap = (f) => createImageBitmap(f, { imageOrientation: 'from-image' }),
  canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
  edge = MAX_EDGE,
  maxBytes = 0,
} = {}) {
  if (!file || file.size > MAX_PICK_BYTES) throw new Error('too_big');
  const bmp = await bitmap(file);
  let blob = null;
  try {
    for (const k of maxBytes ? FALLBACK_EDGES : [1]) {
      const [w, h] = fitSize(bmp.width, bmp.height, Math.round(edge * k));
      const c = canvas(w, h);
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      for (const q of maxBytes ? [QUALITY, ...FALLBACK_QUALITY] : [QUALITY]) {
        blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));
        if (!blob) throw new Error('bad_image');
        if (!maxBytes || blob.size <= maxBytes) return blob;
      }
    }
    return blob;
  } finally {
    bmp.close?.();
  }
}

/** uploadPhoto({ url, wall, blob, note, nick, fetchFn }) → { ok: true } | { ok: false, why }. Empty url = feature off: nothing is sent. */
export async function uploadPhoto({ url, wall, blob, note = '', nick = '', fetchFn = (...a) => fetch(...a), timeoutMs = 20000 }) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!base) return { ok: false, why: 'network' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchFn(base + photoPath(wall, note, nick), { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'omit', signal: ctl.signal });
    return r.ok ? { ok: true } : { ok: false, why: whyOf(r.status) };
  } catch {
    return { ok: false, why: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

// ---- 여러 장 보내기 (사진 보내기 탭만; 정보 수정 요청의 증빙 사진은 한 장 그대로) ----
export const MAX_PHOTOS = 5; // pictures in one send
export const PHOTO_GAP_MS = 3500; // between two uploads; longer than the Worker's PHOTO_MIN_GAP_MS (3 s)
export const PHOTO_DAY = 10; // what the Worker accepts per day (worker/index.js PHOTO_DAY_LIMIT); only used in the message
export const PICK_MAX_SAY = `최대 ${MAX_PHOTOS}장까지 보낼 수 있어요.`;

/** addPicks(have, added) → { files, cut }: appends, keeps the first MAX_PHOTOS; cut = some were left out. */
export function addPicks(have, added) {
  const all = [...have, ...added];
  return { files: all.slice(0, MAX_PHOTOS), cut: all.length > MAX_PHOTOS };
}

// a failure that makes the rest pointless: stop there. Anything else (a bad or oversized picture) skips only that one.
const STOPS = new Set(['rate_limited', 'network', 'full']);

/**
 * sendPhotos({ files, send, gapMs, sleep, onProgress }) → { total, sent: number[], failed: [{ i, why }], stopped: why|null }
 * Sends one at a time, in order. send(file, i) → '' on success or a reason ('rate_limited' | 'too_big' | 'bad_image' | 'full' | 'network').
 * Waits gapMs between pictures (sleep is injectable so tests do not wait). onProgress(n, total) runs before each upload.
 */
export async function sendPhotos({ files, send, gapMs = PHOTO_GAP_MS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onProgress = () => {} }) {
  const out = { total: files.length, sent: [], failed: [], stopped: null };
  for (let i = 0; i < files.length; i++) {
    if (i > 0 && gapMs > 0) await sleep(gapMs);
    onProgress(i + 1, files.length);
    const why = await send(files[i], i);
    if (!why) { out.sent.push(i); continue; }
    out.failed.push({ i, why });
    if (STOPS.has(why)) { out.stopped = why; break; }
  }
  return out;
}

/** photosMessage(result) → the line the sheet shows. One picture keeps the single-photo wording. */
export function photosMessage({ total, sent, failed, stopped }) {
  const n = sent.length;
  if (total === 1) return n ? PHOTO_SAY.ok : PHOTO_SAY[failed[0].why];
  if (n === total) return `사진 ${n}장을 보냈어요. 확인 후 반영해요.`;
  const head = `${total}장 중 ${n}장 보냈어요.`;
  if (stopped === 'rate_limited') return `${head} 나머지는 잠시 뒤에 다시 보내 주세요(하루 ${PHOTO_DAY}장까지 받아요).`;
  if (stopped === 'network') return `${head} 연결을 확인하고 나머지를 다시 보내 주세요.`;
  if (stopped === 'full') return `${head} ${PHOTO_SAY.full}`;
  const skipped = failed.map((f) => `${f.i + 1}번`).join(', ');
  return `${n ? head : '보내지 못했어요.'} ${skipped} 사진은 너무 크거나 사진이 아니라서 건너뛰었어요.`;
}
