# Promotion Trend AI Planner Real Product Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 현재 단일 HTML 프로토타입을 실제 개발 가능한 구조로 전환해, 샘플 데이터 기반 MVP → 로그인/개인 찜/데이터 수집/AI 기획안 생성이 가능한 웹 서비스로 확장한다.

**Architecture:** 1차 구현은 기존 HTML 프로토타입의 UI/업무 흐름을 보존하면서 Vite + React + TypeScript 기반 프론트엔드로 재구성한다. 데이터는 먼저 `src/data/sampleTrends.ts`로 분리하고, 검색/필터/선택/북마크/프롬프트 생성 로직을 순수 함수와 컴포넌트로 나눈다. 2차 구현에서 FastAPI + SQLite/PostgreSQL 백엔드를 붙여 계정별 북마크, 트렌드 데이터, AI 생성 결과를 저장한다.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, CSS modules or plain CSS, 향후 FastAPI, SQLAlchemy, SQLite/PostgreSQL, Playwright.

---

## 1. 현재 상태

### 현재 프로젝트 경로

```text
D:\OneDrive - CJWorld\CJ\1.Project\promotion-trend-mvp
```

### 현재 파일

```text
promotion-trend-mvp/
├── index.html
├── README.md
└── backup/
```

### 현재 프로토타입 기능

- 단일 HTML 파일
- 샘플 트렌드 6개 내장
- 검색/필터
- 트렌드 상세
- 근거 데이터 vs AI 해석 구분
- 안정형/공격형/혼합형 기획안
- 기획안 구체화 프롬프트 복사
- 개인 찜/localStorage 저장
- 내가 찜한 기획안 목록

### 현재 한계

- HTML/CSS/JS가 한 파일에 결합되어 유지보수 어려움
- 데이터 업데이트가 코드 수정에 의존
- 테스트 없음
- 로그인/계정별 저장 없음
- 실제 수집/AI 생성 파이프라인 없음
- 팀 공유/서버 배포 구조 없음

---

## 2. 구현 방향 결정

### 권장 1차 목표

바로 서버/DB/로그인까지 가지 않고, **현재 프로토타입을 유지보수 가능한 프론트엔드 앱으로 전환**한다.

이유:

1. 사용자가 이미 확인한 화면/흐름을 보존할 수 있다.
2. 실제 백엔드 붙이기 전에 데이터 모델과 UI 상태를 안정화할 수 있다.
3. 검색/필터/찜/프롬프트 생성 로직을 테스트할 수 있다.
4. 이후 로그인/DB/API로 교체하기 쉽다.

### 1차 결과물

```text
promotion-trend-mvp/
├── package.json
├── index.html                  # Vite entry
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── data/
│   │   └── sampleTrends.ts
│   ├── domain/
│   │   ├── types.ts
│   │   ├── filters.ts
│   │   ├── prompts.ts
│   │   └── bookmarks.ts
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── WeeklyOverview.tsx
│   │   ├── TrendExplorer.tsx
│   │   ├── TrendDetail.tsx
│   │   ├── IdeaCompare.tsx
│   │   └── SelectedIdeaDetail.tsx
│   └── test/
│       └── setup.ts
├── tests/
│   ├── filters.test.ts
│   ├── prompts.test.ts
│   └── bookmarks.test.ts
├── README.md
└── backup/
```

---

## 3. 제품 기능 설계

## 3.1 사용자 플로우

### 기본 플로우

1. 사용자가 대시보드 접속
2. 이번 주 트렌드 요약 확인
3. 검색/필터로 관심 트렌드 탐색
4. 트렌드 상세에서 근거 데이터와 AI 해석 확인
5. 안정형/공격형/혼합형 기획안 비교
6. 마음에 드는 기획안 찜
7. 내가 찜한 기획안에서 모아보기
8. 필요한 기획안의 구체화 프롬프트 복사
9. 별도 AI 도구/Hermes/문서에서 상세 기획안 작성

### 향후 로그인 버전 플로우

1. 사용자 로그인
2. 주간 데이터 선택
3. 개인별 찜/북마크 조회
4. 기획안별 메모/태그 추가
5. 계정별 저장 목록에서 다시 열기
6. 필요 시 기획안 구체화 프롬프트 복사 또는 문서 내보내기

---

## 3.2 핵심 도메인 모델

### `TrendTopic`

```ts
export type SourceType = '기사' | '검색' | 'SNS' | '경쟁사';
export type IdeaMode = 'stable' | 'aggressive' | 'mixed';

export interface EvidenceItem {
  type: SourceType;
  title: string;
  source: string;
  date: string;
  url: string;
  summary: string;
}

export interface Idea {
  title: string;
  concept: string;
  target: string;
  category: string;
  benefit: string;
  message: string;
  channels: string[];
  expectedEffect: string;
  risk: string;
  buzz: string;
  difficulty: string;
  copy: {
    banner: string;
    push: string;
    live: string;
  };
  checklist: string[];
  teams: string[];
}

export interface TrendTopic {
  id: string;
  name: string;
  summary: string;
  keywords: string[];
  channels: string[];
  categories: string[];
  promotionTypes: string[];
  modeBias: 'stable' | 'aggressive';
  scores: {
    momentum: number;
    onstyleFit: number;
    risk: number;
  };
  evidence: EvidenceItem[];
  aiInterpretation: {
    consumerInsight: string;
    opportunity: string;
    caution: string;
  };
  ideas: {
    stable: Idea;
    aggressive: Idea;
  };
}
```

### `BookmarkedIdea`

```ts
export interface BookmarkedIdea {
  key: string;
  id: string;
  createdAt: string;
  trendId: string;
  trendName: string;
  modeKey: IdeaMode;
  mode: string;
  title: string;
  summary: string;
  keywords: string[];
  scores: TrendTopic['scores'];
  prompt: string;
  status: '찜한 기획안';
  trendSnapshot: TrendTopic;
  ideaSnapshot: Idea;
}
```

중요: 실제 로그인 버전에서도 단순 `idea_id`만 저장하지 말고 `trendSnapshot`과 `ideaSnapshot`을 함께 저장한다. 데이터가 나중에 갱신되어도 사용자가 찜했던 당시 내용을 보존하기 위해서다.

---

## 4. 테스트 전략

TDD 원칙을 적용한다. 새 로직은 테스트 먼저 작성한다.

### 우선 테스트할 순수 로직

1. 필터링
   - 검색어로 트렌드 필터링
   - 채널/카테고리/프로모션 유형 필터링
   - 안정형/공격형 추천 필터링
   - 결과 없음 상태

2. 프롬프트 생성
   - 선택 기획안 정보 포함
   - 근거 데이터 포함
   - AI 해석 포함
   - 출력 형식 지시 포함

3. 북마크
   - 찜 추가
   - 중복 찜 방지
   - 찜 해제
   - localStorage read/write
   - snapshot 보존

4. 혼합형 기획안 생성
   - 안정형과 공격형의 주요 항목을 결합
   - 채널/체크리스트/팀 중복 제거

### 테스트 명령

```bash
npm test -- --run
```

### 브라우저 검증

```bash
npm run dev
```

브라우저에서:

```text
http://localhost:5173
```

검증 항목:

- 콘솔 에러 없음
- 트렌드 6개 표시
- 검색/필터 정상
- 안정형/공격형/혼합형 선택 정상
- 프롬프트 복사 정상
- 찜하기/찜 해제/찜 목록 정상

---

## 5. 단계별 구현 계획

## Phase 1 — 프론트엔드 앱화

### Task 1: 수정 전 백업 생성

**Objective:** 기존 단일 HTML 프로토타입을 안전하게 보존한다.

**Files:**
- Create: `backup/index_<timestamp>_before_react_migration.html`
- Create: `backup/README_<timestamp>_before_react_migration.md`

**Steps:**
1. 현재 `index.html`과 `README.md`를 `backup/`에 복사한다.
2. 백업 파일 존재 여부를 확인한다.

**Verification:**

```bash
python - <<'PY'
from pathlib import Path
root = Path('D:/OneDrive - CJWorld/CJ/1.Project/promotion-trend-mvp')
print((root/'backup').exists())
print(any(p.name.endswith('_before_react_migration.html') for p in (root/'backup').iterdir()))
PY
```

---

### Task 2: Vite React TypeScript 프로젝트 골격 생성

**Objective:** 기존 폴더 안에 React 기반 개발 환경을 만든다.

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Modify: `index.html`

**Important:** 기존 `index.html`은 백업 후 Vite entry HTML로 교체한다.

**Steps:**
1. `package.json` 작성
2. React/Vite/Vitest 의존성 추가
3. `index.html`을 Vite entry로 교체
4. `src/main.tsx`, `src/App.tsx`, `src/styles.css` 생성
5. `npm install` 실행

**Expected `package.json`:**

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest",
    "test:run": "vitest --run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  }
}
```

**Verification:**

```bash
npm install
npm run build
```

Expected: build succeeds.

---

### Task 3: 도메인 타입 정의

**Objective:** 트렌드/근거/기획안/북마크 타입을 명확히 분리한다.

**Files:**
- Create: `src/domain/types.ts`

**TDD:** 타입 파일 자체는 컴파일 검증으로 확인한다.

**Steps:**
1. `SourceType`, `IdeaMode` 정의
2. `EvidenceItem`, `Idea`, `TrendTopic`, `BookmarkedIdea` 정의
3. `MixedIdea`는 `Idea`로 반환하도록 설계

**Verification:**

```bash
npm run build
```

---

### Task 4: 샘플 데이터 분리

**Objective:** 현재 HTML 내부의 `trendData`를 독립 데이터 파일로 이동한다.

**Files:**
- Create: `src/data/sampleTrends.ts`
- Modify: `src/App.tsx`

**Steps:**
1. 기존 `trendData` 6개를 TypeScript 배열로 옮긴다.
2. `sampleTrends` export
3. App에서 import

**Verification:**

```bash
npm run build
```

브라우저에서 6개 트렌드가 표시되어야 한다.

---

### Task 5: 필터 로직 TDD 구현

**Objective:** 검색/필터를 UI와 분리한 순수 함수로 만든다.

**Files:**
- Create: `src/domain/filters.ts`
- Create: `tests/filters.test.ts`

**Step 1: Write failing tests**

Test cases:

```ts
import { describe, expect, it } from 'vitest';
import { filterTrends } from '../src/domain/filters';
import { sampleTrends } from '../src/data/sampleTrends';

describe('filterTrends', () => {
  it('검색어가 트렌드 키워드와 일치하면 해당 트렌드를 반환한다', () => {
    const result = filterTrends(sampleTrends, { query: '멤버십', channel: '전체', category: '전체', type: '전체', mode: '전체' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(t => t.name.includes('멤버십') || t.keywords.includes('멤버십'))).toBe(true);
  });

  it('채널 필터가 적용되면 해당 채널을 가진 트렌드만 반환한다', () => {
    const result = filterTrends(sampleTrends, { query: '', channel: '경쟁사', category: '전체', type: '전체', mode: '전체' });
    expect(result.every(t => t.channels.includes('경쟁사'))).toBe(true);
  });

  it('공격형 추천 강함 필터는 modeBias가 aggressive인 트렌드만 반환한다', () => {
    const result = filterTrends(sampleTrends, { query: '', channel: '전체', category: '전체', type: '전체', mode: '공격형 추천 강함' });
    expect(result.every(t => t.modeBias === 'aggressive')).toBe(true);
  });
});
```

**Step 2: Run RED**

```bash
npm test -- --run tests/filters.test.ts
```

Expected: FAIL because `filterTrends` does not exist.

**Step 3: Implement minimal `filterTrends`**

**Step 4: Run GREEN**

```bash
npm test -- --run tests/filters.test.ts
```

Expected: PASS.

---

### Task 6: 프롬프트 생성 로직 TDD 구현

**Objective:** `기획안 구체화 프롬프트 복사` 내용을 테스트 가능한 함수로 분리한다.

**Files:**
- Create: `src/domain/prompts.ts`
- Create: `tests/prompts.test.ts`

**Test cases:**

- 프롬프트에 역할 지시가 포함된다.
- 프롬프트에 트렌드명/기획명/혜택 구조가 포함된다.
- 프롬프트에 근거 데이터가 포함된다.
- 프롬프트에 KPI/리스크/회의 질문 출력 형식이 포함된다.

**Verification:**

```bash
npm test -- --run tests/prompts.test.ts
```

---

### Task 7: 혼합형 기획안 생성 로직 TDD 구현

**Objective:** 안정형+공격형 혼합안을 UI와 분리한다.

**Files:**
- Create: `src/domain/ideas.ts`
- Create: `tests/ideas.test.ts`

**Test cases:**

- `mode='stable'`이면 stable idea 반환
- `mode='aggressive'`이면 aggressive idea 반환
- `mode='mixed'`이면 혼합 idea 반환
- 혼합 idea는 stable/aggressive 채널 중복을 제거한다.

**Verification:**

```bash
npm test -- --run tests/ideas.test.ts
```

---

### Task 8: 북마크 로직 TDD 구현

**Objective:** 개인 찜 기능을 localStorage 어댑터와 순수 로직으로 분리한다.

**Files:**
- Create: `src/domain/bookmarks.ts`
- Create: `tests/bookmarks.test.ts`

**Test cases:**

- 북마크 key 생성
- 찜 추가
- 중복 찜 방지
- 찜 해제
- snapshot 저장

**Verification:**

```bash
npm test -- --run tests/bookmarks.test.ts
```

---

### Task 9: 컴포넌트 분리 1 — Header/Summary/Overview

**Objective:** 상단 화면을 React 컴포넌트로 분리한다.

**Files:**
- Create: `src/components/Header.tsx`
- Create: `src/components/SummaryCards.tsx`
- Create: `src/components/WeeklyOverview.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Steps:**
1. 기존 hero 영역을 `Header`로 이전
2. metric cards를 `SummaryCards`로 이전
3. Top Trends/Rising Keywords/Channel Mix를 `WeeklyOverview`로 이전

**Verification:**

```bash
npm run build
```

브라우저에서 상단 화면이 기존 프로토타입과 유사해야 한다.

---

### Task 10: 컴포넌트 분리 2 — Trend Explorer

**Objective:** 검색/필터/트렌드 리스트를 React 상태 기반으로 구현한다.

**Files:**
- Create: `src/components/TrendExplorer.tsx`
- Modify: `src/App.tsx`

**Steps:**
1. `FilterState`를 App state로 관리
2. `filterTrends` 함수 사용
3. 트렌드 선택 이벤트를 App으로 전달
4. 결과 없음 상태 표시

**Verification:**

- 검색어 `멤버십` 입력 시 2개 트렌드 표시
- `경쟁사` 필터 클릭 시 경쟁사 포함 트렌드만 표시

---

### Task 11: 컴포넌트 분리 3 — Detail/Compare/Selected Idea

**Objective:** 상세/비교/선택 기획안 영역을 React 컴포넌트로 구현한다.

**Files:**
- Create: `src/components/TrendDetail.tsx`
- Create: `src/components/IdeaCompare.tsx`
- Create: `src/components/SelectedIdeaDetail.tsx`
- Modify: `src/App.tsx`

**Steps:**
1. Trend summary/evidence/AI interpretation 구현
2. 안정형/공격형 비교 카드 구현
3. selectedIdeaMode 상태 구현
4. 혼합형 선택 구현
5. selected idea detail 구현

**Verification:**

- 트렌드 카드 클릭 시 상세 변경
- 안정형/공격형/혼합형 선택 시 상세 변경

---

### Task 12: 프롬프트 복사와 찜 기능 연결

**Objective:** 실제 사용자 액션을 React 앱에 연결한다.

**Files:**
- Modify: `src/components/SelectedIdeaDetail.tsx`
- Modify: `src/domain/bookmarks.ts`
- Modify: `src/domain/prompts.ts`

**Steps:**
1. `buildDevelopmentPrompt` 사용
2. `navigator.clipboard.writeText` 연결
3. 북마크 추가/삭제 연결
4. 내가 찜한 기획안 목록 표시
5. 찜한 기획안 열기 연결

**Verification:**

- 프롬프트 복사 버튼 클릭 시 토스트 표시
- 찜하기 클릭 시 목록에 추가
- 찜 해제 시 목록에서 제거
- 찜 목록의 열기 클릭 시 해당 트렌드/기획안으로 이동

---

### Task 13: 스타일 정리와 기존 UI 재현

**Objective:** 기존 단일 HTML의 업무용 대시보드 느낌을 유지한다.

**Files:**
- Modify: `src/styles.css`

**Steps:**
1. 기존 CSS 토큰 이전
2. 카드/칩/버튼/그리드 스타일 정리
3. 반응형 레이아웃 유지
4. focus/hover 상태 유지

**Verification:**

브라우저 시각 검증:

- 텍스트 겹침 없음
- 상단/중단/상세 섹션 정상
- 찜 목록 영역 자연스러움

---

### Task 14: README 업데이트

**Objective:** 개발형 프로젝트 실행 방법을 문서화한다.

**Files:**
- Modify: `README.md`

**Include:**

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

그리고 기존 단일 HTML 프로토타입은 `backup/`에 보존되었음을 명시한다.

---

### Task 15: 전체 검증

**Objective:** 구현 완료 상태를 실제 실행으로 확인한다.

**Commands:**

```bash
npm test -- --run
npm run build
npm run dev
```

브라우저 검증:

- `http://127.0.0.1:5173` 접속
- JS 콘솔 에러 없음
- 검색/필터 작동
- 상세 변경 작동
- 안정형/공격형/혼합형 작동
- 프롬프트 복사 작동
- 찜하기/찜 해제 작동

---

## Phase 2 — 백엔드/API 설계

Phase 1이 안정화된 뒤 진행한다.

### API 후보

```text
GET    /api/weeks
GET    /api/trends?week=2026-W25
GET    /api/trends/:trendId
GET    /api/me/bookmarks
POST   /api/me/bookmarks
DELETE /api/me/bookmarks/:bookmarkId
POST   /api/ideas/develop-prompt
```

### DB 테이블 후보

```text
users
trend_topics
evidence_items
promotion_ideas
user_idea_bookmarks
collection_runs
```

### 로그인 방식 후보

초기:

- 사내 환경이면 SSO/OAuth 가능성 확인 전까지 mock user 또는 간단한 email login

운영:

- 사내 인증 체계 연동
- 계정별 북마크 저장
- 팀/부서별 공유 가능 여부는 나중에 결정

---

## Phase 3 — 데이터 수집/AI 생성 파이프라인

Phase 2 이후 진행한다.

### 우선순위

1. 뉴스/기사 검색 수집
2. 경쟁사 프로모션 페이지 수집
3. 검색 트렌드 키워드 수동 업로드
4. SNS는 공식 API/약관 검토 후 제한적으로 적용

### 파이프라인 출력

```text
raw_items → cleaned_items → trend_topics → promotion_ideas
```

### AI 생성 원칙

- 모든 생성 기획안은 근거 ID와 연결
- UI에서 근거/AI 해석 분리
- 근거 부족 시 `근거 부족` 표시
- 확정 사실과 가정을 구분

---

## 6. 리스크와 대응

### 리스크 1: OneDrive 경로와 Node 프로젝트 충돌

**대응:** 파일명/경로에 공백이 있으므로 명령어는 항상 따옴표 처리한다. Node/Vite가 문제를 일으키면 동일 폴더 유지 대신 `D:\codex_project`에 개발 repo를 두고 빌드 산출물만 OneDrive에 복사하는 대안을 고려한다.

### 리스크 2: 로그인/계정 저장을 너무 일찍 붙임

**대응:** Phase 1에서는 localStorage 기반으로 개인 찜 UX를 확정하고, Phase 2에서 API로 교체한다.

### 리스크 3: 데이터 수집이 약관/보안 이슈로 막힘

**대응:** MVP는 샘플/수동 업로드/뉴스/경쟁사 공식 페이지 중심으로 유지하고, SNS는 공식 API 또는 외부 솔루션을 검토한다.

### 리스크 4: AI 기획안 신뢰 부족

**대응:** 모든 기획안에 근거 요약과 출처 연결을 유지한다. 프롬프트에도 근거 데이터 요약을 넣는다.

---

## 7. 구현 착수 기준

구현은 Phase 1부터 시작한다. 첫 번째 실제 작업은 다음 순서다.

1. 수정 전 백업
2. Vite React TypeScript 프로젝트 골격 생성
3. 테스트 환경 구성
4. 도메인 타입/데이터 분리
5. 필터/프롬프트/북마크 로직 TDD 구현
6. React 컴포넌트 이관
7. 브라우저 검증

---

## 8. 최종 완료 기준 — Phase 1

- [ ] `npm install` 성공
- [ ] `npm test -- --run` 성공
- [ ] `npm run build` 성공
- [ ] React 앱이 브라우저에서 정상 로드
- [ ] 기존 프로토타입의 핵심 기능이 모두 유지됨
- [ ] 검색/필터/선택/비교/프롬프트 복사/찜 기능 작동
- [ ] 기존 단일 HTML은 backup에 보존됨
- [ ] README가 개발 실행 방식으로 업데이트됨
