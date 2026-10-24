# 암장 관리자 공지 채널 타당성 조사

- 작성일/접근일: 2026-10-24
- 참고: 이 저장소에는 `docs/` 폴더 관례가 없다(작업 저장소의 `docs/system/*`, `docs/prd/*`는 README가 가리킬 뿐 여기엔 없음). 이 파일이 `docs/` 아래 첫 문서이므로 위치는 임시이며 옮겨도 된다.
- 목적: 암장 관리자에게 암장 전용 링크를 주고 임시휴무·공지·변경을 받을 때, "한 번 입력 -> 네이버 카페/인스타 등에 자동 게시 또는 게시 준비"라는 혜택을 줄 수 있는지 확인.

## 조사의 한계 (먼저 읽을 것)

이번 실행 환경의 프록시 정책이 대부분의 1차 출처 도메인을 403으로 차단했다. 직접 확인한 도메인별 결과(2026-10-24, `curl`/WebFetch):

| 도메인 | 결과 |
|---|---|
| developers.naver.com, navercorp.com, help.naver.com | 접속 불가 (CONNECT 403) |
| developers.facebook.com, help.instagram.com | 접속 불가 (DNS 실패 또는 CONNECT 403) |
| developer.mozilla.org, caniuse.com, developer.chrome.com, chromestatus.com, webkit.org | 접속 불가 |
| www.rfc-editor.org, datatracker.ietf.org, www.w3.org, w3c.github.io, spec.whatwg.org | 접속 불가 |
| developers.google.com, support.google.com, support.apple.com | 접속 불가 |
| developer.apple.com | 접속 가능 (단, 본문은 JS 렌더링이라 `tutorials/data/...json` 경로로 읽음) |

그 결과 **검증된 사실은 아래 두 가지뿐**이고, 나머지는 전부 확인 불가다. 기억에 의존한 내용은 사실로 적지 않았다. 후속 확인용 "가설"은 각 절에 따로 표시했다(출처 미확인, 의사결정 근거로 쓰지 말 것).

검증된 사실:
1. Safari 15 릴리스 노트에 "Web Share level 2 ... 웹 페이지에서 앱으로 파일 공유" 지원 추가가 적혀 있다.
2. 이 저장소가 이미 `navigator.canShare({files})` + `navigator.share` + 다운로드/클립보드 폴백 + Canvas `toBlob('image/png')` 패턴을 쓰고 있다 (코드 확인).

## 요약 표

| 채널 | 판정 | 핵심 조건 | 출처 |
|---|---|---|---|
| 네이버 카페 글쓰기 API | 확인 불가 | developers.naver.com 접속 불가. 웹검색(2차)에서도 쓰기 API 문서는 발견되지 않음(부재의 증명 아님) | 없음 (미접속) |
| 네이버 블로그 글쓰기 API | 확인 불가 | 위와 동일 | 없음 |
| 네이버 스마트플레이스 휴무/영업시간 변경 | 확인 불가 | 공식 문서 미접속 | 없음 |
| Instagram 피드 게시 (Graph API) | 확인 불가 | developers.facebook.com 미접속. 계정 유형·앱 심사·토큰은 가설만 있음 | 없음 |
| Instagram 스토리 게시 (Graph API) | 확인 불가 | 위와 동일 | 없음 |
| Web Share L2 (파일 공유), iOS Safari | 조건부 | Safari 15부터 지원(Apple 릴리스 노트). 인스타 스토리/피드로 직접 전달 가능 여부는 확인 불가 | Apple Safari 15 Release Notes |
| Web Share L2, Android Chrome / 인앱브라우저 | 확인 불가 | MDN/caniuse 미접속 | 없음 |
| .ics 구독 (정적 파일) | 확인 불가 | RFC 5545, Google/Apple 갱신 주기 모두 미접속 | 없음 |
| Clipboard API (텍스트/이미지) | 확인 불가 (텍스트 복사는 앱이 이미 사용 중) | MDN 미접속 | 저장소 코드만 |
| Canvas toBlob PNG | 확인 불가 (앱이 이미 사용 중) | MDN 미접속 | 저장소 코드만 |
| Google Business Profile API | 확인 불가 | developers.google.com 미접속 | 없음 |

## 1. 네이버 카페 / 블로그 / 스마트플레이스

판정: **확인 불가**.

- 시도: `developers.naver.com/docs/common/openapiguide/apilist.md`, `.../docs/login/cafe-api/cafe-api.md` WebFetch (2026-10-24) -> "unable to fetch". `curl`로도 CONNECT 403.
- 웹검색(2026-10-24, "네이버 카페 API 글쓰기 developers.naver.com"): 공식 카페 글쓰기 API 문서를 찾지 못했다. 검색 결과는 블로그, 스크레이퍼(Apify), 보도기사뿐이며 모두 2차 출처라 증거로 쓰지 않는다. 검색에서 못 찾은 것은 "없다"의 증명이 아니다.
- 약관(자동화 제한): 네이버 서비스 이용약관/카페 운영정책 미접속 -> 확인 불가.
- 가설(출처 미확인, 후속 확인용): (a) 카페 API 목록에 가입/조회류만 있고 쓰기는 별도 승인이 필요할 수 있음, (b) 스마트플레이스에는 외부 서비스용 공개 쓰기 API가 없을 수 있음. 둘 다 반드시 공식 페이지로 검증할 것.
- 확인 방법: 브라우저로 직접 열어 (1) developers.naver.com > API 소개 목록 (2) 카페 API 문서 (3) 공지사항 (4) 스마트플레이스(smartplace.naver.com) 도움말을 확인. 확인 전에는 "네이버 자동 게시"를 혜택으로 약속하지 말 것.

## 2. Instagram (Meta Graph API) 콘텐츠 게시

판정: **확인 불가**.

- 시도: `https://developers.facebook.com/docs/instagram-platform/content-publishing/` WebFetch (2026-10-24) -> DNS 실패. `curl` -> CONNECT 403.
- 아래 항목은 모두 미검증이다: 필요 계정 유형(프로페셔널 계정 여부), 페이스북 페이지 연결 필요성, 권한과 앱 심사, 토큰 수명, 24시간 게시 한도, 스토리 지원 여부, 이미지가 공개 URL이어야 하는지.
- 가설(출처 미확인): 게시 API는 이미지를 공개 URL로 받는 방식일 수 있고, 이 경우 서버리스 정적 사이트 + 관리자별 OAuth 토큰 보관이 필요해 현재 "개인정보 미수집" 원칙과 충돌한다. 이것이 맞는지는 문서로 확인해야 한다.
- 확인 방법: developers.facebook.com의 Instagram Platform > Content Publishing 문서, Permissions, Rate Limits, App Review 페이지.

## 3. Web Share API Level 2 와 인앱브라우저

판정: iOS Safari는 **조건부**, 나머지는 **확인 불가**.

검증된 사실:
- Safari 15 릴리스 노트: "Added support for Web Share level 2 enhancements to Web Share that enable sharing files from a web page to an app." (w3c.github.io/web-share 참조 링크 포함)
  - 출처: https://developer.apple.com/documentation/safari-release-notes/safari-15-release-notes (본문은 `https://developer.apple.com/tutorials/data/documentation/safari-release-notes/safari-15-release-notes.json`로 읽음), 접근 2026-10-24.

확인 불가:
- Android Chrome 지원 버전, `navigator.canShare` 지원표, 보안 컨텍스트/사용자 제스처 요구, 인스타그램 스토리/피드로 이미지 직접 전달 가능 여부: MDN, caniuse, W3C 스펙 모두 접속 불가. Instagram/Apple의 "공유 시트에서 인스타 스토리로 이미지를 받는지"에 대한 1차 문서도 확보하지 못했다.
- KakaoTalk/Naver/Instagram 인앱브라우저에서의 `navigator.share(files)` 동작: 1차 출처 없음 -> 확인 불가. 실기기 테스트로만 확인 가능.

저장소 현황 (코드 직접 확인):
- `src/inapp.js`는 카카오톡만 감지한다: `isKakaoInApp = (ua) => /KAKAOTALK/i.test(ua)`. 네이버/인스타그램 인앱 감지는 없다. 카카오톡이면 `kakaotalk://web/openExternal?url=...`로 외부 브라우저 열기를 안내한다(저장소 주석: 인앱 저장소가 크롬/사파리와 분리됨).
- `src/share-image.js` `shareInvite()`는 `navigator.canShare?.({files, text}) && matchMedia('(pointer: coarse)')`일 때 `navigator.share`, 실패/미지원이면 PNG 저장 + `navigator.clipboard.writeText`로 문구 복사 폴백. 탭 직후 호출하도록 이미지를 미리 생성해 둔다. 이 패턴이 그대로 공지 카드에 재사용 가능하다.

## 4. 서버리스 편의 기능 (.ics, Clipboard, Canvas)

판정: 모두 **확인 불가**(1차 출처 미접속). 저장소는 이미 두 가지를 쓰고 있다.

- Canvas `toBlob('image/png')`: `src/share-image.js:336`, `src/month-share.js`에서 사용 중. 표준 문서(MDN/HTML 스펙)는 미접속이라 일반 지원 현황은 확인 불가. 이 앱은 실사용 중이라는 사실만 있다.
- Clipboard 텍스트: `navigator.clipboard.writeText`를 사용 중(`src/share-image.js:358`), 실패 시 `copied:false` 처리. 이미지 복사(`ClipboardItem`)는 저장소에 사용 없음, 지원 여부 확인 불가.
- .ics: 저장소에 `.ics`/`webcal` 사용 없음(grep 확인). RFC 5545 내용, Google Calendar/Apple Calendar의 구독 피드 갱신 주기는 확인 불가. 가설(미검증): Google은 구독 갱신 주기를 사용자가 제어할 수 없고 느릴 수 있음 -> "임시휴무 실시간 반영" 용도로는 부적합할 수 있음. 검증 전에는 약속하지 말 것.
- 확인 방법: RFC 5545(rfc-editor.org), Google Calendar 도움말 "Use a calendar link / subscribe"(support.google.com), Apple 지원 문서, MDN Clipboard/HTMLCanvasElement.toBlob.

## 5. 기타 채널: Google Business Profile 등

판정: **확인 불가**.

- 시도 없이 도메인이 차단됨(developers.google.com 접속 불가, 2026-10-24).
- 미검증 항목: 휴무/특별 영업시간/게시물 API 존재 여부, 접근 신청 요건, 소규모 업장 사용 가능 여부.
- 네이버 플레이스 대안: 1차 출처 없음. 확인 불가.

## 6. 저장소에서 재사용할 수 있는 것 (읽기 전용 확인)

- 이미지 생성: `src/share-image.js` (1080x1920 Canvas, `wrapLines`/`pillRows` 순수 함수, `pictureBlob`, `saveFile`, `shareInvite`, `shareSay`), `src/poster-image.js`(4:5 / 9:16 카드, `cleanLine`, `coverCrop`), `src/poster-lockup.js`(로고 락업), `src/record-image.js`, `src/month-share.js`(시트 UI + 미리 `toBlob` 후 탭에서 즉시 공유하는 패턴). 공지 카드는 `drawInviteCard`류 함수를 복제해 "암장명 / 날짜 / 사유 / 확인일" 레이아웃을 그리면 된다.
- 제보 입력: `src/report.js`에 `KINDS`(운영시간, 임시휴무 ...), `NOTICE_KIND='공지'`, `INSTA_RE`(인스타 URL 검증), 구글 폼 전송, `cleanNote`(마크업/링크/전화번호 제거)가 있다. `config.noticeReport`는 현재 false로 꺼져 있고 주석에 "이용자 제보를 기대하지 않기로 함"이 있다.
- 관리: `src/manage.js`는 CSV 헤더 기반 편집기(`임시휴장일`, `공휴일`, `격주휴무` 등 열 힌트 포함)로, 사용자 본인 브라우저에만 저장. 관리자용 입력 폼의 필드 정의 참고용.
- 인앱: `src/inapp.js`는 카카오톡만 감지(네이버·인스타그램 UA 감지는 없음).
- 데이터: `data/national.json` 74개 암장 중 `holiday` 38, `closed_dates`(임시휴장일) 13, `nth_closed` 6, `notice_url` 40, `notice_checked_at` 8, `suspended` 2, `contact` 61 (키 이름은 grep 집계). `data/single-pitch.json`은 7개. 공휴일 판정은 `src/holidays.js`(2026-2027 하드코딩).
- 주의: 이 앱은 README상 서버리스이지만 `config.boardUrl`에 Cloudflare Worker(`open-wall-board...workers.dev`)가 이미 있다. 관리자 토큰을 보관하는 외부 게시 기능은 이 Worker로도 개인정보 미수집 원칙과 충돌할 수 있으니 별도 판단 필요.

## 7. 미확인 / 추가 확인 필요 목록

1. 네이버: API 목록, 카페 API 문서 및 쓰기 엔드포인트 유무, 공지사항, 스마트플레이스 도움말, 자동화 관련 약관.
2. Instagram: 콘텐츠 게시 문서 전부(계정 유형, 페이지 연결, 권한/심사, 토큰 수명, 한도, 스토리, 공개 URL 요구).
3. Web Share: MDN/caniuse(Android Chrome 및 지원 버전), W3C 스펙, 인스타그램 스토리/피드 수신 여부, 카카오/네이버/인스타 인앱브라우저 동작(실기기 테스트 필요).
4. .ics: RFC 5545, Google/Apple 구독 갱신 주기.
5. Clipboard 이미지 복사(`ClipboardItem`) 지원, Canvas `toBlob` 표준 문서.
6. Google Business Profile API 접근 요건과 소규모 업장 사용 가능성.

해결 방법: 차단 해제된 환경(또는 사람이 브라우저로) 위 도메인을 열어 같은 질문을 재실행. 이 파일의 "확인 불가" 항목만 갱신하면 된다.

## 8. 먼저 만들 혜택에 대한 제안 (현재 검증된 범위 안에서)

외부 API 게시는 어느 것도 검증되지 않았으므로 약속하지 않는다. 이미 저장소에서 동작하는 것만으로 구성하는 안:

1. **암장 전용 링크 -> 공지 카드 이미지 생성**(Canvas PNG) + 공유 시트(`shareInvite` 재사용) + 문구 복사. 관리자는 한 번 입력해 이미지를 인스타/카페 앱에 직접 올린다("게시 준비" 수준의 혜택). 서버 없이 가능하고 개인정보 수집이 없다.
2. 같은 입력을 제보 폼(`report.js` 경로)으로 보내 해벽 데이터 갱신에 쓴다.
3. 네이버/인스타 자동 게시, .ics 구독은 위 확인 목록이 해소된 뒤에 재평가한다. 특히 인스타 인앱브라우저 안내(감지 추가)는 실기기 테스트 후 결정.
