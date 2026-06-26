# Promotion Trend AI Planner MVP

SNS·검색·기사·경쟁사 프로모션 신호를 샘플 데이터로 구성한 온스타일 프로모션 트렌드 AI 기획 도구의 React 기반 Phase 1 MVP입니다.

## 현재 버전

기존 단일 HTML 프로토타입을 Vite + React + TypeScript 구조로 전환했습니다. UI/업무 흐름은 유지하면서 데이터, 도메인 로직, 컴포넌트를 분리했습니다.

## 접속 URL

- 배포 URL: https://baobab0109.github.io/promotion-trend-mvp/
- GitHub repo: https://github.com/baobab0109/promotion-trend-mvp

## 실행 방법

처음 한 번 의존성을 설치합니다.

```bash
npm install --strict-ssl=false --no-audit --no-fund
```

개발 서버 실행:

```bash
npm run dev
```

브라우저에서 접속:

```text
http://127.0.0.1:5173
```

테스트 실행:

```bash
npm test -- --run
```

프로덕션 빌드:

```bash
npm run build
```

## Phase 1 포함 범위

- Vite + React + TypeScript 개발 환경
- Vitest 테스트 환경
- 샘플 트렌드 데이터 분리: `src/data/sampleTrends.ts`
- 도메인 타입 분리: `src/domain/types.ts`
- 검색/필터 로직: `src/domain/filters.ts`
- 안정형/공격형/혼합형 기획안 선택 로직: `src/domain/ideas.ts`
- 기획안 구체화 프롬프트 생성 로직: `src/domain/prompts.ts`
- 개인 찜/localStorage 로직: `src/domain/bookmarks.ts`
- React 컴포넌트 분리:
  - `Header`
  - `SummaryCards`
  - `WeeklyOverview`
  - `TrendExplorer`
  - `TrendDetail`
  - `IdeaCompare`
  - `SelectedIdeaDetail`

## MVP 포함 기능

- 주간 트렌드 요약 카드
- Top 트렌드 / 급상승 키워드 / 채널 믹스 / 프로모션 유형 믹스
- 검색 및 필터 가능한 Trend Explorer
- 트렌드별 근거 데이터와 AI 해석 구분
- 안정형 vs 공격형 프로모션 기획안 비교
- 혼합형 기획안 생성
- 선택한 기획안 상세와 카피/체크리스트
- 기획안 구체화 프롬프트 복사 버튼
- 개인 북마크/찜 기능: MVP에서는 브라우저 localStorage에 저장
- 내가 찜한 기획안을 한 번에 모아보고 다시 열기/찜 해제

## 테스트

순수 도메인 로직은 TDD로 먼저 테스트를 작성한 뒤 구현했습니다.

```bash
npm test -- --run
```

현재 테스트 파일:

- `tests/filters.test.ts`
- `tests/ideas.test.ts`
- `tests/prompts.test.ts`
- `tests/bookmarks.test.ts`

## 중요한 전제

현재 버전은 실제 크롤링 데이터가 아니라 샘플 데이터 기반입니다. 화면 구조와 업무 흐름을 검증하기 위한 MVP이며, 실제 운영 버전에서는 수집 파이프라인, DB, 출처 검증, 사내 보안 기준 검토가 필요합니다.

## 백업 정책

기존 단일 HTML/README는 React 전환 전에 `backup/` 폴더에 타임스탬프가 포함된 파일로 보존했습니다.

예:

```text
backup/index_YYYYMMDD_HHMMSS_before_react_migration.html
backup/README_YYYYMMDD_HHMMSS_before_react_migration.md
```

## Notion 데이터 허브

실제 데이터 연동은 Notion을 CMS처럼 사용하고, GitHub Actions가 Notion DB를 읽어 정적 JSON으로 변환하는 방향으로 설계했습니다.

- Notion schema 문서: `docs/notion-data-schema.md`
- Notion data source config: `config/notion-data-sources.json`
- 수동 동기화: `npm run sync:notion`
- 생성 JSON: `public/data/weeks.json`, `public/data/trends/latest.json`
- 자동/수동 GitHub Actions: `.github/workflows/sync-notion-data.yml` (`workflow_dispatch` 수동 실행 버튼 제공)

운영 흐름:

```text
Notion에서 Status=Published로 정리
  ↓
Sync Notion Trend Data workflow 수동 실행 버튼 또는 매일 08:00 KST 자동 실행
  ↓
public/data/trends/latest.json 갱신 commit
  ↓
GitHub Pages deploy workflow 자동 배포
```

## 다음 단계 후보

1. Notion CMS 데이터로 화면 QA 및 팀원 피드백 수집
2. 실제 모니터링 대상 경쟁사·채널·카테고리 확정
3. 필요 시 `sync-notion-data.yml` 매일 08:00 KST 자동 실행 및 수동 실행 버튼 운영 권한 점검
4. 로그인 전 개인 찜 UX 검증
5. Phase 2에서 Supabase/Auth 기반 계정별 저장 구조 설계
