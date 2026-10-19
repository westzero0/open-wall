# 로컬 Claude Code 인수인계 안내

이 폴더는 클라우드 세션에서 만든 기획·연구를 **작업 저장소의 로컬 Claude Code**로 넘기기 위한 것이다.

## 파일
| 파일 | 용도 |
|---|---|
| `CLAUDE.md` | 작업 저장소 루트에 둘 안내 초안. 로컬 Claude가 이 프로젝트에서 지켜야 할 원칙과 문서 위치 |
| `tasks.md` | 작업별 요청문(붙여넣기용). 순서와 선행 조건 포함 |

## 넘기는 방법
1. 이 브랜치(`claude/fervent-feynman-0f54dv`)를 받아 문서를 작업 저장소로 복사한다.
   ```bash
   git clone -b claude/fervent-feynman-0f54dv https://github.com/westzero0/open-wall.git /tmp/open-wall-docs
   # 작업 저장소 폴더에서
   mkdir -p docs/prd docs/research docs/handoff
   cp /tmp/open-wall-docs/docs/prd/*.md docs/prd/
   cp /tmp/open-wall-docs/docs/research/*.md docs/research/
   cp /tmp/open-wall-docs/docs/handoff/tasks.md docs/handoff/
   ```
2. `docs/handoff/CLAUDE.md` 내용을 작업 저장소 루트 `CLAUDE.md`에 합친다(이미 있으면 아래 "원칙" 부분만 추가). **작업 저장소의 실제 구조와 다르면 작업 저장소가 우선이다.**
3. 로컬에서 Claude Code를 작업 저장소 루트로 열고, `tasks.md`의 요청문을 **한 번에 하나씩** 붙여 넣는다. 첫 응답은 구현이 아니라 계획으로 받는다(계획 모드).
4. 복사한 뒤에는 **문서 수정을 작업 저장소에서만** 한다. 양쪽에서 고치면 서로 달라진다.
5. API 키·비밀값은 로컬 환경 변수로 다루고 대화나 문서에 붙이지 않는다.

## 주의
- 이 미러 저장소(`open-wall`)는 배포용이다. 여기 `src/`나 `data/`를 직접 고치지 않는다.
- 이 폴더의 문서는 2026-10-18 기준이다. 연구 보고서의 수치(Cloudflare·GitHub 한도, 모델 가격, 약관)는 대부분 검색 요약에 근거하므로 쓰기 전에 공식 페이지에서 다시 확인한다.
