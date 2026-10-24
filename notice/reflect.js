// notice/reflect.js — 해벽에 반영: 확정한 공지를 서버로 보내는 자리.
// 해벽에는 아직 공지를 받는 서버 쪽이 없다. NOTICE_ENDPOINT 가 비어 있으면 요청을 보내지 않고(src/config.js 의 boardUrl 과 같은 규칙),
// 화면은 만들어질 반영 내용(patch)만 보여 준다. 서버가 생기면 이 주소와 아래 요청 형식만 맞추면 된다.
export const NOTICE_ENDPOINT = '';

export const reflectReady = () => Boolean(NOTICE_ENDPOINT);

/** reflect({ patch, notice, token }) → resolves when the server accepted it. Throws when the feature is off or the request fails. */
export async function reflect({ patch, title, body, token }) {
  if (!NOTICE_ENDPOINT) throw new Error('off');
  const r = await fetch(NOTICE_ENDPOINT, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json', 'X-Wall-Token': token ?? '' },
    body: JSON.stringify({ patch, title, body }),
  });
  if (!r.ok) throw new Error(String(r.status));
}
