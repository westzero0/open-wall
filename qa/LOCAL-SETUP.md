# 로컬 컴퓨터에서 qa/ 실행하기 (Claude Code 포함)

이 안내서는 **본인 컴퓨터(한국 IP)** 에서 `qa/` 도구를 처음 켜는 순서예요.
클라우드 세션에서는 외부 사이트에 접속할 수 없어서 감시 도구를 한 번도 실제 사이트로 돌려 보지 못했어요. 로컬에서 하는 첫 실행이 가장 중요한 검증이에요.

## 0. 준비물
| 필요한 것 | 확인 방법 | 비고 |
| --- | --- | --- |
| Node.js 18 이상 | `node -v` | 없으면 https://nodejs.org 에서 LTS 설치 |
| Git | `git --version` | |
| (선택) Playwright + axe-core | 아래 2번 | 화면 검사(스모크·접근성·시각 비교)에만 필요. 감시 도구는 필요 없어요 |
| (선택) Claude Code | `claude --version` | 이 안내서를 따라 하게 시키려면 |
| (선택, 카페·오픈채팅 에이전트용) Claude 데스크톱 앱 + 크롬 확장 | | 7번. 연결 방법은 앱의 안내를 따르세요 |

## 1. 코드 받기 — "배포 저장소를 따로 한 벌 더 받는" 방식 (권장)
작업 저장소(원본)는 건드리지 않아요. 배포된 결과물을 검사하는 용도예요.

```
git clone https://github.com/westzero0/open-wall.git open-wall-qa
cd open-wall-qa
git checkout claude/cloud-qa-agent-ideas-t5cgvv     # PR 병합 전
# PR 을 병합한 뒤에는: git checkout main && git pull
```
- `qa/.out/`, `qa/inbox/`, `qa/sources.local.json` 은 git 에서 제외돼서 `git pull` 해도 충돌하지 않아요.
- 데이터(`data/national.json`)를 **고치는 곳은 작업 저장소**예요. 여기서 고치면 배포 때 덮어써져요. 고친 뒤 배포하고 이 폴더에서 `git pull` 하면 검사에 반영돼요.

## 2. 1분 점검 (설치 거의 없이)
```
node qa/check-integrity.mjs        # 1초. 오류 0 이면 정상, 경고는 정리 후보
node qa/watch.mjs --selftest       # 가짜 글로 감시 도구 점검
```
화면 검사까지 하려면:
```
npm i -g playwright axe-core
npx playwright install chromium
node qa/all.mjs                    # 무결성 + 스모크 + 접근성 + 감시 자가 테스트 (약 1분)
```
Windows PowerShell 에서 `npm i -g` 가 권한 오류를 내면 관리자 권한 터미널로 한 번 실행하세요.

## 3. 로컬 Claude Code 로 시키기
이 폴더에서 `claude` 를 실행하고 첫 요청으로 이렇게 말하세요.

> qa/README.md 와 qa/LOCAL-SETUP.md 를 읽고, 3번부터 순서대로 도와줘. 먼저 `node qa/all.mjs` 를 돌려서 결과를 알려 줘. 파일은 고치지 말고, 실패하면 이유만 설명해 줘.

이후 단계마다 "다음 단계 진행해 줘"라고 하면 돼요. **API 키·비밀번호는 대화에 붙여 넣지 마세요.** 환경 변수로만 넣어요(5번).

## 4. 처음 한 번: 감시할 곳이 열리는지 시험
```
node qa/reach.mjs
```
결과 읽는 법(보고서: `qa/.out/reach.md`):
- ✓ 열림 → 자동 감시 가능
- △ 글자가 거의 없음 → 자바스크립트로 그리는 페이지. 자동 감지가 어려워요(수동 확인 목록으로)
- ✗ 막힘(403·429) → 그 사이트가 이 네트워크를 막아요. VPN 을 끄고 다시, 그래도 막히면 그곳은 수동으로
- ✗ 주소 없음(404) → `notice_url` 이 바뀐 것. **작업 저장소의 데이터에서 주소를 고치세요**
- ✗ 접속 실패 → 인터넷·방화벽 확인
디시인사이드·네이버·카카오 API 주소가 열리는지도 같이 나와요.

## 5. 공지 변경 감시 시작 + (선택) 검색 API 키
```
node qa/notices.mjs      # 첫 실행: 지금 상태를 저장만 해요(알림 없음)
node qa/notices.mjs      # 다음 날 다시: 달라진 곳과 휴관·시간·공사 단어가 있는 줄(⚠)을 알려 줘요
```
검색 API(선택): 키를 각 사이트에서 직접 발급하세요 — 네이버 개발자센터(애플리케이션 등록 → 검색 API), 카카오 디벨로퍼스(앱의 REST API 키, 다음 검색 사용).
환경 변수로만 넣고, 이 폴더·대화·git 어디에도 적지 마세요.
```
# macOS / Linux (~/.zshrc 또는 ~/.bashrc 에 추가한 뒤 새 터미널)
export NAVER_CLIENT_ID="..."  NAVER_CLIENT_SECRET="..."  KAKAO_REST_API_KEY="..."
# Windows PowerShell (한 번 실행하고 새 터미널을 여세요)
setx NAVER_CLIENT_ID "..."; setx NAVER_CLIENT_SECRET "..."; setx KAKAO_REST_API_KEY "..."
```
시험은 한 곳만: `node qa/search-api.mjs --walls 뚝섬`. 오류가 나면 출력을 그대로 알려 주세요(응답 형식을 문서 기준으로 만들었고 실서버로 확인하지 못했어요).

## 6. 평소 쓰는 법 — 켜졌을 때 한 번
```
node qa/watch-run.mjs
```
- 마지막으로 돈 지 12시간이 안 됐으면 알아서 건너뛰어요(`--force` 로 강제).
- 결과는 `qa/.out/watch-summary.md` 한 장. **후보일 뿐**이에요. 공지 원문·전화로 확인한 뒤 작업 저장소에서 `national.json` 과 `checked_at` 을 고치세요.
- 직접 저장한 디시인사이드 목록 페이지(.html)나 오픈채팅 내보내기(.txt)는 `qa/inbox/` 에 넣어 두면 함께 읽어요.
- 컴퓨터를 켤 때 자동으로 돌리기: `qa/README.md` 7번.

## 7. 카페·오픈채팅 자동 읽기 (선택, 약관·개인정보 위험을 이해한 뒤에)
먼저 `qa/DESIGN-agent-reading.md` 의 4번(위험) 표를 읽으세요.
1. `qa/sources.example.json` 을 `qa/sources.local.json` 으로 복사하고, **카페 한 곳만** 적어요.
2. 카페: 크롬 확장이 연결된 Claude 에게 "`qa/agents/cafe-reader.md` 를 따라 `sources.local.json` 의 카페 한 곳만 읽어 줘". 끝나면 `qa/inbox/cafe-*.jsonl` 을 눈으로 확인하고 `node qa/watch-run.mjs`.
3. 오픈채팅: **먼저 카카오톡에서 직접** "대화 내보내기"가 되는지 확인하세요. 되면 같은 방식으로 `qa/agents/openchat-exporter.md` 를 한 방으로 시험.
4. 막히면(로그인 풀림, 캡차, 메뉴 없음) 에이전트가 멈추고 `_agent-log.jsonl` 에 기록해요. `watch-summary.md` 에 "N일째 못 읽음"으로 보여요.
이 부분은 클라우드 세션에서 실행해 보지 못했어요. 첫 시험에서 지시문을 고쳐야 할 가능성이 높아요.

## 8. 문제 해결
| 증상 | 해결 |
| --- | --- |
| `Playwright 를 찾지 못했어요` | `npm i -g playwright && npx playwright install chromium` |
| `axe-core 를 찾지 못했어요` | `npm i -g axe-core` |
| `reach` 가 전부 실패 | VPN·회사망·방화벽 확인. 브라우저로 같은 주소가 열리는지 확인 |
| 한글이 깨짐(Windows) | PowerShell 에서 `chcp 65001` 후 다시 실행 |
| `감시 도구가 새 글을 계속 다시 보여 줘요` | `qa/.out/*-seen.json` 을 지우면 처음부터. 정상이라면 같은 글은 한 번만 나와요 |
| 공지 저장본을 초기화 | `node qa/notices.mjs --reset` |
| 무결성에서 해시 오류 | 배포가 끝나기 전에 검사했을 수 있어요. 배포 후 `git pull` 하고 다시 |

## 9. 실행 순서 한눈에
1. 클론·브랜치 → 2. `check-integrity` → 3. `all.mjs` → 4. `reach.mjs` → 5. `notices.mjs` 두 번(첫날·다음 날) → 6. (선택) API 키 → 7. 평소 `watch-run.mjs` → 8. (선택) 에이전트 읽기
