# 로컬 컴퓨터에서 qa/ 실행하기 (Claude Code 포함)

## 0. 준비물
| 필요한 것 | 확인 방법 | 비고 |
| --- | --- | --- |
| Node.js 18 이상 | `node -v` | 없으면 https://nodejs.org 에서 LTS 설치 |
| Git | `git --version` | |
| (선택) Playwright + axe-core | 아래 2번 | 스모크·접근성·시각 비교에만 필요. 무결성 검사는 필요 없어요 |
| (선택) Claude Code | `claude --version` | 이 안내서를 따라 하게 시키려면 |

## 1. 코드 받기 — "배포 저장소를 따로 한 벌 더 받는" 방식 (권장)
작업 저장소(원본)는 건드리지 않아요. 배포된 결과물을 검사하는 용도예요.
```
git clone https://github.com/westzero0/open-wall.git open-wall-qa
cd open-wall-qa
git checkout claude/cloud-qa-agent-ideas-t5cgvv     # PR 병합 전
# PR 을 병합한 뒤에는: git checkout main && git pull
```
- `qa/.out/` 은 git 에서 제외돼서 `git pull` 해도 충돌하지 않아요.
- 데이터(`data/national.json`)·코드를 **고치는 곳은 작업 저장소**예요. 여기서 고치면 배포 때 덮어써져요.
  고친 뒤 배포하고 이 폴더에서 `git pull` 하면 검사에 반영돼요.

## 2. 1분 점검
```
node qa/check-integrity.mjs        # 1초. 오류 0 이면 정상, 경고는 정리 후보
```
화면 검사까지 하려면:
```
npm i -g playwright axe-core
npx playwright install chromium
node qa/all.mjs                    # 무결성 + 스모크 + 접근성 (약 1분)
```
Windows PowerShell 에서 `npm i -g` 가 권한 오류를 내면 관리자 권한 터미널로 한 번 실행하세요.

## 3. 로컬 Claude Code 로 시키기
이 폴더에서 `claude` 를 실행하고 첫 요청으로 이렇게 말하세요.

> qa/README.md 와 qa/LOCAL-SETUP.md 를 읽고 순서대로 도와줘. 먼저 `node qa/all.mjs` 를 돌려서 결과를 알려 줘. 파일은 고치지 말고, 실패하면 이유만 설명해 줘.

## 4. 평소 쓰는 순서 (배포 전)
1. **고치기 전**: `node qa/visual.mjs snap before`
2. 작업 저장소에서 코드를 고치고 로컬 커밋 → 평소 드라이런
3. 배포 후 이 폴더에서 `git pull`
4. `node qa/all.mjs` → 오류 0 확인(해시 불일치는 배포가 끝나기 전에 돌렸다는 뜻일 수 있어요)
5. `node qa/visual.mjs compare before` → 의도하지 않은 화면 변화가 없는지 diff 이미지로 확인

## 5. 문제 해결
| 증상 | 해결 |
| --- | --- |
| `Playwright 를 찾지 못했어요` | `npm i -g playwright && npx playwright install chromium` |
| `axe-core 를 찾지 못했어요` | `npm i -g axe-core` |
| 한글이 깨짐(Windows) | PowerShell 에서 `chcp 65001` 후 다시 실행 |
| 무결성에서 해시 오류 | 배포가 끝나기 전에 검사했을 수 있어요. 배포 후 `git pull` 하고 다시 |
| 시각 비교가 전부 다르다고 나옴 | 'before' 와 'current' 를 서로 다른 컴퓨터·폰트에서 찍었을 수 있어요. 같은 컴퓨터에서 다시 찍으세요 |
