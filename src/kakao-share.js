// src/kakao-share.js — 카카오톡으로 보내기: the invite as a KakaoTalk feed message (the 3:4 card + the invite link).
// The Kakao JavaScript SDK is loaded only when the invite sheet opens (loadKakao), pinned to one version with SRI.
// kakaoPayload, clip and kakaoFail are pure; loadKakao and shareKakao take the document / the SDK as arguments (tested with stubs).
// What leaves the device: the card picture (uploaded to Kakao's server by Share.uploadImage) and the message the user sends.

// The JavaScript key is public by design: Kakao only accepts it from the domains registered for the app (https://westzero0.github.io).
export const KAKAO_JS_KEY = '6190c3972efc1f76b12408d8ee832981';
export const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
// sha384 of that file (docs/system/permissions.md: how it was taken and checked)
export const SDK_SRI = 'sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy';
export const CARD_W = 600;
export const CARD_H = 800;
const MAX_TITLE = 60;
const MAX_DESC = 90;

/** clip(s, n) → s cut to n characters (code points, never half a pair) with … when cut. */
export function clip(s, n) {
  const chars = [...String(s ?? '').replace(/\s+/g, ' ').trim()];
  return chars.length <= n ? chars.join('') : `${chars.slice(0, n - 1).join('').trimEnd()}…`;
}

/**
 * kakaoPayload({ picture, url, imageUrl }) → the argument of Kakao.Share.sendDefault. title: the place and the moment (the moment
 * is never cut off: the name gives way); description: the tags and head-count, then the note. picture: the values the card was
 * drawn from (already cleaned). url: the invite link (buildInviteUrl).
 */
export function kakaoPayload({ picture, url, imageUrl }) {
  const when = `${picture.date} ${picture.time}`;
  const title = `${clip(picture.name, MAX_TITLE - [...when].length - 3)} · ${when}`;
  const who = (picture.tags ?? []).filter(Boolean).join(' · ');
  const desc = [who, picture.note ? `"${picture.note}"` : ''].filter(Boolean).join(' ') || '같이 가요';
  const link = { mobileWebUrl: url, webUrl: url };
  return {
    objectType: 'feed',
    content: { title, description: clip(desc, MAX_DESC), imageUrl, imageWidth: CARD_W, imageHeight: CARD_H, link },
    buttons: [{ title: '해벽에서 보기', link }],
  };
}

/**
 * kakaoFail(e, stage) → 'cancelled' | 'key' | stage. 'key': Kakao refused the app key or this domain (KAPIError -401, KOE…,
 * "domain mismatched"), stage: 'upload' or 'send' for anything else. The SDK has no cancel signal of its own; an AbortError is
 * taken as one.
 */
export function kakaoFail(e, stage) {
  if (e?.name === 'AbortError') return 'cancelled';
  const said = `${e?.code ?? ''} ${e?.msg ?? ''} ${e?.message ?? ''}`;
  if (e?.code === -401 || /domain|app ?key|KOE\d|unauthori[sz]ed|not initialized/i.test(said)) return 'key';
  return stage;
}

/** What the sheet says after a try (cancelled: nothing). */
export const KAKAO_SAY = {
  ok: '카카오톡을 열었어요. 받을 사람을 골라 보내세요.',
  unavailable: '카카오톡 공유를 쓸 수 없어요. 그림으로 공유나 문구 복사로 보내 주세요.',
  key: '카카오톡 공유가 이 주소에서는 막혀 있어요. 그림으로 공유나 문구 복사로 보내 주세요.',
  upload: '그림을 카카오 서버에 올리지 못했어요. 잠시 뒤 다시 눌러 주세요.',
  send: '카카오톡을 열지 못했어요. 그림으로 공유나 문구 복사로 보내 주세요.',
  cancelled: '',
};

let loading = null;
/**
 * loadKakao({ doc, win, timeout }) → Promise<Kakao>, initialised once. Adds the pinned SDK script with integrity and
 * crossorigin once; a block, an offline phone, a wrong hash or a timeout rejects, and the next call tries again.
 */
export function loadKakao({ doc = globalThis.document, win = globalThis, timeout = 10000 } = {}) {
  loading ??= new Promise((ok, fail) => {
    if (win.Kakao) { ok(win.Kakao); return; }
    const s = doc.createElement('script');
    s.src = SDK_URL;
    s.integrity = SDK_SRI;
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.onload = () => (win.Kakao ? ok(win.Kakao) : fail(new Error('no Kakao')));
    s.onerror = () => fail(new Error('Kakao SDK did not load'));
    setTimeout(() => fail(new Error('Kakao SDK timed out')), timeout);
    doc.head.append(s);
  }).then((K) => {
    if (!K.isInitialized()) K.init(KAKAO_JS_KEY);
    if (!K.isInitialized() || !K.Share) throw new Error('Kakao not initialized'); // Share appears only after init
    return K;
  });
  loading.catch(() => { loading = null; });
  return loading;
}

/**
 * shareKakao(Kakao, { key, blob, build }, memo) → { ok: true } | { ok: false, why }. Uploads the card once per key (memo
 * keeps { key, url } of the last upload, so the same saved invite is never uploaded twice), then sendDefault(build(imageUrl)).
 * blob: the card drawn when the invite was saved; nothing is drawn here.
 */
export async function shareKakao(Kakao, { key, blob, build }, memo) {
  let imageUrl = memo.key === key ? memo.url : null;
  if (!imageUrl) {
    try {
      const res = await Kakao.Share.uploadImage({ file: [new File([blob], 'haebyeok-invite.png', { type: 'image/png' })] });
      imageUrl = res?.infos?.original?.url;
    } catch (e) {
      return { ok: false, why: kakaoFail(e, 'upload') };
    }
    if (typeof imageUrl !== 'string' || !/^https?:\/\//.test(imageUrl)) return { ok: false, why: 'upload' };
    memo.key = key;
    memo.url = imageUrl;
  }
  try {
    await Kakao.Share.sendDefault(build(imageUrl));
    return { ok: true };
  } catch (e) {
    return { ok: false, why: kakaoFail(e, 'send') };
  }
}
