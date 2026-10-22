// 어프로치 사진을 사용자가 누를 때만 폰에 저장한다(Cache Storage). 읽기는 sw.js가 한다.
import { PHOTO_RE } from './store.js';
import { photoUrl } from './crag-approach.js';

export const PHOTO_CACHE = 'haebyeok-photos-v1'; // sw.js에 같은 문자열이 있다(테스트가 비교)

const valid = (paths) => [...new Set(paths)].filter((p) => typeof p === 'string' && PHOTO_RE.test(p) && !p.includes('..'));

export async function saveRoute(paths, { caches, fetchFn = fetch }) {
  const cache = await caches.open(PHOTO_CACHE);
  let saved = 0;
  let failed = 0;
  for (const p of valid(paths)) {
    try {
      const res = await fetchFn(photoUrl(p));
      if (!res || !res.ok) { failed++; continue; }
      await cache.put(photoUrl(p), res);
      saved++;
    } catch { failed++; }
  }
  return { saved, failed };
}

export async function routeState(paths, { caches }) {
  const cache = await caches.open(PHOTO_CACHE);
  const list = valid(paths);
  let saved = 0;
  for (const p of list) if (await cache.match(photoUrl(p))) saved++;
  return { saved, total: list.length };
}

export async function clearRoute(paths, { caches }) {
  const cache = await caches.open(PHOTO_CACHE);
  for (const p of valid(paths)) await cache.delete(photoUrl(p));
}
