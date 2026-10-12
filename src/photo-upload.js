// src/photo-upload.js — 외벽 사진 제보: shrink the picked photo to a small JPEG in the browser, then POST it to the board Worker (worker/index.js
// /v1/photos). Re-drawing the picture on a canvas drops every metadata block (EXIF, so no GPS), and the Worker strips any left over.
// fitSize, photoPath and uploadPhoto are pure (tested); shrinkToJpeg needs a canvas and takes its pieces as arguments.
export const MAX_EDGE = 1280; // longest side after shrinking
export const QUALITY = 0.82;
export const MAX_NOTE = 100;
export const MAX_PICK_BYTES = 30 * 1024 * 1024; // refuse a pick this large before decoding it

/** fitSize(w, h, max) → [w', h']: scaled down to fit max on the long side, never up. */
export function fitSize(w, h, max = MAX_EDGE) {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

/** photoPath(wall, note) → '/v1/photos?wall=…&note=…' (note omitted when empty). */
export const photoPath = (wall, note = '') => `/v1/photos?wall=${encodeURIComponent(wall)}${note ? `&note=${encodeURIComponent(note)}` : ''}`;

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
 * shrinkToJpeg(file, { bitmap, canvas }) → Promise<Blob> (image/jpeg). bitmap(file) decodes with the camera's rotation applied
 * (createImageBitmap … 'from-image'); canvas(w, h) makes a canvas. Throws when the file is not a picture the browser can decode.
 */
export async function shrinkToJpeg(file, {
  bitmap = (f) => createImageBitmap(f, { imageOrientation: 'from-image' }),
  canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
} = {}) {
  if (!file || file.size > MAX_PICK_BYTES) throw new Error('too_big');
  const bmp = await bitmap(file);
  const [w, h] = fitSize(bmp.width, bmp.height);
  const c = canvas(w, h);
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('bad_image');
  return blob;
}

/** uploadPhoto({ url, wall, blob, note, fetchFn }) → { ok: true } | { ok: false, why }. Empty url = feature off: nothing is sent. */
export async function uploadPhoto({ url, wall, blob, note = '', fetchFn = (...a) => fetch(...a), timeoutMs = 20000 }) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!base) return { ok: false, why: 'network' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchFn(base + photoPath(wall, note), { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'omit', signal: ctl.signal });
    return r.ok ? { ok: true } : { ok: false, why: whyOf(r.status) };
  } catch {
    return { ok: false, why: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
