# Promotion Trend AI Planner Free Operation + Login Bookmark Development Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 서버 비용 없이 소규모 팀이 사용할 수 있는 구조를 전제로, 현재 프로토타입을 `정적 웹 MVP → 무료 배포 → Supabase 로그인/개인 찜 → 데이터 업데이트/AI 확장` 순서로 개발한다.

**Architecture:** Vite + React + TypeScript 정적 프론트엔드를 GitHub 기반으로 관리하고 Cloudflare Pages 또는 GitHub Pages에 무료 배포한다. 개인 로그인/찜 기능은 Supabase Free의 Auth + Postgres로 구현하되, 초기에는 localStorage 북마크로 UX를 먼저 검증한다. 자동 수집/AI 생성은 사용성 검증 이후 GitHub Actions, Supabase, 서버리스 함수 또는 별도 백엔드로 확장한다.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, GitHub, Cloudflare Pages or GitHub Pages, Supabase Free(Auth/Postgres), optional GitHub Actions, optional serverless functions.

---

## 0. 핵심 의사결정

### 운영 목표

- 초기 서버 비용: `0원`
- 사용 규모: 팀 내부 소규모, 3~20명 우선
- 초기 배포: URL 공유 가능한 정적 웹앱
- 로그인/개인 찜: Supabase Free로 시작 가능
- AI 생성/자동 수집: 무료 운영 검증 후 별도 확장

### 추천 운영 구조

```text
GitHub repository
  → Cloudflare Pages 또는 GitHub Pages
  → React/Vite static app
  → Supabase Free Auth + Postgres
  → user별 찜한 기획안 저장
```

### 왜 이 구조인가

1. React/Vite 앱은 정적 빌드라 서버 운영비가 없다.
2. Cloudflare Pages/GitHub Pages는 소규모 정적 웹앱에 충분하다.
3. Supabase Free는 소규모 로그인/DB 저장에는 충분히 넉넉하다.
4. 개인 찜 기능은 데이터 용량이 작아 무료 범위 초과 가능성이 낮다.
5. AI API 호출과 자동 수집은 비용/보안 변수가 있으므로 뒤로 미룬다.

---

## 1. 개발 단계 요약

| 단계 | 이름 | 목표 | 비용 | 완료 기준 |
|---|---|---|---:|---|
| Phase 0 | 현재 프로토타입 보존 | 기존 HTML/README 백업, 기준선 확정 | 0원 | 백업 생성, 현 기능 목록 확정 |
| Phase 1 | React 정적 앱 전환 | 유지보수 가능한 프론트 구조로 이관 | 0원 | `npm test`, `npm run build` 통과 |
| Phase 1.5 | 무료 정적 배포 | GitHub + Cloudflare/GitHub Pages로 URL 공유 | 0원 | 배포 URL에서 MVP 기능 작동 |
| Phase 2 | Supabase 로그인/개인 찜 | 개인 계정 기반 저장 기능 구현 | 0원 예상 | 로그인 후 찜 목록이 기기 간 유지 |
| Phase 2.5 | 개인 저장함 UX 고도화 | 찜한 기획안 모아보기/검색/메모/태그 | 0원 예상 | 저장함이 실제 업무에 쓸 만함 |
| Phase 3 | 데이터 업데이트 운영 | JSON/관리자 업로드/간단한 주간 갱신 | 0원 예상 | 주간 트렌드 데이터 교체 가능 |
| Phase 4 | 자동 수집/AI PoC | 뉴스/경쟁사 수집과 AI 요약 실험 | 변동 | 비용/보안 검토 포함 PoC |
| Phase 5 | 운영화 판단 | 유료/사내 서버/보안 검토 결정 | 변동 | 실제 팀 운영 기준 결정 |

---

## 2. Phase 0 — 프로토타입 보존 및 기준선 확정

### 목표

현재 HTML 프로토타입을 안전하게 보존하고, 이후 React 전환 시 동일 기능을 재현할 기준선으로 삼는다.

### 작업

1. 현재 파일 백업
2. 현재 기능 목록 체크리스트 작성
3. 현재 UX 기준 스크린샷 또는 브라우저 검증 로그 확보
4. 앞으로 구현할 기능과 제외할 기능 확정

### Files

- Read: `index.html`
- Read: `README.md`
- Create: `backup/index_<timestamp>_before_react_migration.html`
- Create: `backup/README_<timestamp>_before_react_migration.md`
- Create: `.hermes/notes/current-prototype-feature-baseline.md`

### 검증

```bash
python - <<'PY'
from pathlib import Path
root = Path('D:/OneDrive - CJWorld/CJ/1.Project/promotion-trend-mvp')
print((root / 'index.html').exists())
print((root / 'README.md').exists())
print((root / 'backup').exists())
PY
```

### 완료 기준

- [ ] 기존 HTML/README 백업 완료
- [ ] 현재 기능 체크리스트 완료
- [ ] React 전환 중 비교할 기준선 확보

---

## 3. Phase 1 — React/Vite 정적 앱 전환

### 목표

현재 단일 HTML을 실제 개발 가능한 React 앱으로 전환한다. 이 단계에서는 서버, 로그인, Supabase를 붙이지 않는다.

### 구현 범위

- Vite + React + TypeScript 프로젝트 구성
- 샘플 데이터 분리
- 도메인 로직 분리
- 컴포넌트 분리
- Vitest 테스트 추가
- 기존 UI/기능 재현

### 권장 폴더 구조

```text
promotion-trend-mvp/
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── data/
│   │   └── sampleTrends.ts
│   ├── domain/
│   │   ├── types.ts
│   │   ├── filters.ts
│   │   ├── ideas.ts
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
└── tests/
    ├── filters.test.ts
    ├── ideas.test.ts
    ├── prompts.test.ts
    └── bookmarks.test.ts
```

### TDD 우선 로직

1. `filterTrends`
2. `getIdeaForMode`
3. `buildMixedIdea`
4. `buildDevelopmentPrompt`
5. `createBookmark`
6. `toggleBookmark`
7. `isBookmarked`

### 테스트 명령

```bash
npm test -- --run
```

### 빌드 명령

```bash
npm run build
```

### 완료 기준

- [ ] React 앱 로컬 실행 가능
- [ ] 기존 6개 트렌드 표시
- [ ] 검색/필터 작동
- [ ] 안정형/공격형/혼합형 작동
- [ ] 프롬프트 복사 작동
- [ ] localStorage 찜 작동
- [ ] `npm test -- --run` 통과
- [ ] `npm run build` 통과

---

## 4. Phase 1.5 — 무료 정적 배포

### 목표

서버 비용 없이 팀원에게 URL로 공유 가능한 상태를 만든다.

### 배포 후보

#### 1순위: Cloudflare Pages

추천 이유:

- 무료 정적 배포에 강함
- GitHub 연동 가능
- 나중에 Workers/KV/D1로 확장 가능
- Vercel Hobby의 회사 업무용 약관 애매함을 피할 수 있음

#### 2순위: GitHub Pages

추천 이유:

- 가장 단순
- GitHub repo만 있으면 가능
- 순수 정적 앱에 충분

#### 보류: Vercel Hobby

기술적으로는 가능하지만, Hobby 플랜은 non-commercial/personal use 성격이 강해 회사 내부 업무용 무료 운영은 약관 검토 필요.

### 작업

1. Git repo 초기화
2. `.gitignore` 생성
3. GitHub repo 생성
4. GitHub remote 연결
5. Cloudflare Pages 또는 GitHub Pages 연결
6. 배포 설정
7. 배포 URL 검증

### Files

- Create: `.gitignore`
- Create: `.github/workflows/deploy.yml` if GitHub Pages 선택
- Modify: `vite.config.ts` if GitHub Pages base path 필요
- Modify: `README.md`

### Cloudflare Pages 설정

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Node version: 20 or latest LTS
```

### GitHub Pages 설정

```text
Build command: npm run build
Output directory: dist
Deployment: GitHub Actions
```

### 검증

배포 URL에서 확인:

- [ ] 페이지 로드
- [ ] JS 콘솔 에러 없음
- [ ] 검색/필터 작동
- [ ] 프롬프트 복사 작동
- [ ] localStorage 찜 작동
- [ ] 모바일/노트북 화면 확인

### 완료 기준

- [ ] GitHub repo에 코드 push 완료
- [ ] 무료 정적 배포 URL 확보
- [ ] 팀원에게 URL 공유 가능

---

## 5. Phase 2 — Supabase Free 로그인 + 개인 찜

### 목표

localStorage 찜을 로그인 계정 기반 찜으로 전환한다.

### 운영 구조

```text
React app on Cloudflare Pages
  → Supabase Auth
  → Supabase Postgres
  → user_idea_bookmarks
```

### Supabase Free에서 기대 가능한 범위

소규모 팀 기준으로 충분할 가능성이 높다.

- 로그인 사용자 수: 팀 내부 수십 명 수준이면 매우 작음
- 북마크 데이터: 텍스트 JSON 위주라 용량 매우 작음
- DB: 500MB 무료 범위 내 충분할 가능성 높음
- 주의: 프로젝트가 일정 기간 미사용이면 pause 될 수 있음

### DB 설계

#### `user_idea_bookmarks`

```sql
create table user_idea_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trend_id text not null,
  idea_mode text not null check (idea_mode in ('stable', 'aggressive', 'mixed')),
  idea_title text not null,
  idea_summary text not null,
  development_prompt text not null,
  trend_snapshot jsonb not null,
  idea_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, trend_id, idea_mode)
);
```

#### RLS 정책

```sql
alter table user_idea_bookmarks enable row level security;

create policy "Users can read own bookmarks"
on user_idea_bookmarks
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
on user_idea_bookmarks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
on user_idea_bookmarks
for delete
to authenticated
using (auth.uid() = user_id);
```

### 앱 구현 작업

1. Supabase 프로젝트 생성
2. `@supabase/supabase-js` 설치
3. 환경변수 설정
4. 로그인 UI 구현
5. Auth state 관리
6. 북마크 API 어댑터 구현
7. localStorage 북마크에서 Supabase 북마크로 전환
8. 비로그인 사용자는 localStorage fallback 또는 로그인 유도 결정

### Files

- Create: `src/lib/supabase.ts`
- Create: `src/domain/bookmarkRepository.ts`
- Create: `src/components/LoginPanel.tsx`
- Modify: `src/components/SelectedIdeaDetail.tsx`
- Modify: `src/App.tsx`
- Create: `.env.example`
- Modify: `README.md`

### Environment variables

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

주의: Supabase anon key는 클라이언트에 노출되는 것이 정상이다. 보안은 RLS 정책으로 통제한다.

### 테스트 전략

- 순수 로직은 Vitest로 유지
- Supabase API는 repository interface를 두고 mock adapter로 테스트
- 실제 Supabase 연결은 수동/브라우저 검증

### 완료 기준

- [ ] 사용자가 이메일 또는 OAuth로 로그인 가능
- [ ] 로그인 사용자별 찜 저장 가능
- [ ] 다른 브라우저/기기에서도 로그인하면 찜 목록 조회 가능
- [ ] 로그아웃 시 개인 찜 데이터 보호
- [ ] RLS로 본인 데이터만 조회 가능
- [ ] 무료 티어 안에서 운영 가능성 확인

---

## 6. Phase 2.5 — 개인 저장함 UX 고도화

### 목표

찜 기능을 단순 버튼에서 실제 업무에 유용한 개인 저장함으로 확장한다.

### 기능

1. `내가 찜한 기획안` 전용 페이지 또는 탭
2. 찜한 기획안 검색
3. 안정형/공격형/혼합형 필터
4. 키워드/카테고리 필터
5. 찜한 기획안 열기
6. 프롬프트 다시 복사
7. 선택 메모 추가
8. 개인 태그 추가

### 추가 DB 컬럼 후보

```sql
alter table user_idea_bookmarks add column memo text;
alter table user_idea_bookmarks add column tags text[] default '{}';
alter table user_idea_bookmarks add column archived boolean default false;
```

### 완료 기준

- [ ] 저장함에서 내가 저장한 기획안을 한 번에 볼 수 있음
- [ ] 검색/필터 가능
- [ ] 메모/태그는 필요성 확인 후 적용

---

## 7. Phase 3 — 데이터 업데이트 운영

### 목표

개발자가 매번 코드를 수정하지 않아도 주간 트렌드 데이터를 업데이트할 수 있게 한다.

### 1차 방식: 정적 JSON

```text
public/data/trends/2026-W25.json
public/data/trends/2026-W26.json
public/data/weeks.json
```

장점:

- 여전히 정적 배포 가능
- 서버 비용 없음
- GitHub PR로 데이터 리뷰 가능

한계:

- 데이터 업데이트가 GitHub workflow에 의존
- 비개발자가 직접 수정하기 어려움

### 2차 방식: Supabase 테이블

```text
trend_topics
evidence_items
promotion_ideas
```

장점:

- 앱에서 주차별 데이터 조회 가능
- 관리자 화면 추가 가능
- 로그인/권한과 결합 가능

한계:

- 데이터 입력/관리 UI 필요
- DB 구조 관리 필요

### 추천 순서

1. 먼저 정적 JSON으로 시작
2. 데이터 수정 빈도가 높아지면 Supabase 테이블화
3. 관리자 입력 UI는 필요성이 확인된 뒤 구현

### 완료 기준

- [ ] 주차별 데이터 파일 또는 DB 구조 확정
- [ ] 앱에서 주차 선택 가능
- [ ] 데이터 교체 후 배포 URL에서 새 주차 데이터 확인

---

## 8. Phase 4 — 자동 수집/AI PoC

### 목표

실제 데이터 수집과 AI 기획안 생성을 작은 범위에서 검증한다.

### 우선순위

1. 뉴스/기사 검색 수집
2. 경쟁사 공식 프로모션 페이지 수집
3. 검색 키워드 수동 업로드
4. SNS는 공식 API/약관 검토 후 진행

### 가능한 무료/저비용 구조

```text
GitHub Actions weekly workflow
  → Python script runs
  → outputs JSON
  → commit JSON to repo or upload to Supabase
```

### AI 비용 관리 원칙

- 초기에는 AI API 자동 호출하지 않음
- 프롬프트 복사 기반으로 수동 구체화 유지
- 자동 요약/생성은 샘플 10~20건으로만 PoC
- 비용 상한 또는 수동 실행 방식 적용

### 완료 기준

- [ ] 수집 대상 2~3개만 PoC
- [ ] 수집 결과가 JSON으로 저장됨
- [ ] 근거 링크/요약이 UI에 표시됨
- [ ] AI 생성 비용 추정 완료

---

## 9. Phase 5 — 운영화 판단

### 목표

무료/소규모 구조를 계속 유지할지, 유료/사내 인프라로 전환할지 결정한다.

### 판단 기준

#### 무료 구조 유지 가능

- 사용자 20명 이하
- 주간 데이터 업데이트 빈도 낮음
- 내부 민감 데이터 없음
- 개인 찜/메모 수준의 저장만 필요
- AI 자동 생성 사용량 낮음

#### 유료/Supabase Pro 검토

- 사용자가 많아짐
- DB 용량/트래픽 증가
- 안정적 백업/지원 필요
- 프로젝트 pause가 운영상 문제
- 이메일/로그/권한 관리가 중요해짐

#### 사내 서버/사내 DB 검토

- 고객/매출/내부 성과 데이터 연동
- 실제 프로모션 전략/민감 정보 저장
- 사내 SSO 필요
- 외부 SaaS DB 사용 제한

---

## 10. 구현 우선순위

### 바로 구현할 것

1. Phase 0 백업
2. Phase 1 React/Vite 전환
3. Phase 1.5 Cloudflare Pages 또는 GitHub Pages 배포

### 그 다음 구현할 것

4. Phase 2 Supabase 로그인/개인 찜
5. Phase 2.5 찜한 기획안 저장함

### 나중에 검토할 것

6. Phase 3 데이터 업데이트 운영
7. Phase 4 자동 수집/AI PoC
8. Phase 5 유료/사내 운영 판단

---

## 11. 세부 작업 체크리스트

## Phase 0 Checklist

- [ ] `index.html` 백업
- [ ] `README.md` 백업
- [ ] 현재 기능 기준선 문서 작성
- [ ] 브라우저에서 현행 페이지 정상 확인

## Phase 1 Checklist

- [ ] `package.json` 생성
- [ ] Vite/React/TypeScript 설치
- [ ] Vitest 설정
- [ ] `src/domain/types.ts` 작성
- [ ] `src/data/sampleTrends.ts` 작성
- [ ] `src/domain/filters.ts` TDD
- [ ] `src/domain/ideas.ts` TDD
- [ ] `src/domain/prompts.ts` TDD
- [ ] `src/domain/bookmarks.ts` TDD
- [ ] 컴포넌트 분리
- [ ] 스타일 이전
- [ ] `npm test -- --run` 통과
- [ ] `npm run build` 통과

## Phase 1.5 Checklist

- [ ] `.gitignore` 생성
- [ ] Git 초기화
- [ ] GitHub repo 생성
- [ ] Cloudflare Pages 또는 GitHub Pages 선택
- [ ] 빌드 설정
- [ ] 배포 URL 확인
- [ ] 팀원 공유용 README 업데이트

## Phase 2 Checklist

- [ ] Supabase 프로젝트 생성
- [ ] Auth provider 선택: 이메일 magic link 우선 추천
- [ ] `user_idea_bookmarks` 테이블 생성
- [ ] RLS 정책 생성
- [ ] `.env.example` 작성
- [ ] Supabase client 연결
- [ ] 로그인 UI 구현
- [ ] 계정별 찜 저장 구현
- [ ] 계정별 찜 조회 구현
- [ ] localStorage fallback 정책 결정
- [ ] 배포 환경변수 설정
- [ ] 배포 URL에서 로그인/찜 검증

---

## 12. 무료 운영 리스크 관리

### Supabase Free pause

Supabase Free 프로젝트는 일정 기간 미사용 시 pause될 수 있다.

대응:

- MVP 기간에는 문제 가능성 낮음
- 운영화 시 Pro 또는 사내 인프라 검토
- 팀 사용 전후로 접속 확인

### 외부 SaaS 보안

Supabase/Cloudflare에 회사 데이터가 저장/전송된다.

대응:

- 초기에는 공개/샘플/비민감 데이터만 사용
- 실제 내부 성과/고객 데이터 저장 금지
- 보안 검토 전에는 민감 데이터 업로드 금지

### 무료 티어 한도 초과

소규모 팀 찜 기능은 한도 초과 가능성이 낮다.

대응:

- AI 자동 호출과 대량 수집은 별도 비용 추정 후 진행
- DB에 저장하는 snapshot 크기 관리
- 오래된 북마크 archive/delete 정책 준비

---

## 13. 추천 착수 순서

다음 구현 세션에서는 아래 순서로 바로 진행한다.

1. 현재 파일 백업
2. Vite React TypeScript 프로젝트 생성
3. 테스트 환경 설정
4. 도메인 타입/샘플 데이터 분리
5. 필터/아이디어/프롬프트/북마크 로직 TDD
6. UI 컴포넌트 이관
7. 로컬 빌드/브라우저 검증
8. 무료 정적 배포 준비

이후 배포 플랫폼은 다음 기준으로 결정한다.

- 가장 단순하게: GitHub Pages
- 나중에 서버리스 확장을 고려: Cloudflare Pages
- Vercel은 회사 업무용 무료 약관 검토 전까지 보류
