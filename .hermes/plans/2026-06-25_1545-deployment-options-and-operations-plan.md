# Promotion Trend AI Planner 배포/운영 환경 검토

## 결론 요약

서버 비용 없이 소규모 인원이 사용하는 구조는 가능하다. 다만 기능 범위에 따라 가능한 운영 구조가 달라진다.

1. **로그인 없이 공개/반공개 MVP**라면 GitHub Pages, Cloudflare Pages, Netlify, Vercel 같은 정적 호스팅으로 거의 무료 운영 가능하다.
2. **로그인 + 개인 찜/북마크**까지 필요하면 정적 호스팅만으로는 부족하고, Supabase/Firebase 같은 무료 티어 BaaS 또는 서버리스 백엔드가 필요하다.
3. **회사 업무 데이터/민감 정보/사내 계정 연동**이 들어가면 무료 호스팅보다 보안/약관/사내 승인 여부가 우선이다.

현재 우리 프로젝트는 1차로 React 정적 앱으로 만들고, 초기 데이터는 샘플/수동 JSON으로 운영할 수 있으므로 **정적 호스팅 기반 MVP**가 가장 적합하다.

---

## 1. 현재 프로젝트 기준 가능 여부

현재 기능:

- 트렌드 탐색
- 검색/필터
- 안정형/공격형/혼합형 기획안 비교
- 기획안 구체화 프롬프트 복사
- 개인 찜/localStorage 저장

이 기능만 기준이면 서버 없이 가능하다.

```text
GitHub repository
  → GitHub Actions or hosting platform build
  → Static hosting
  → Browser에서 React 앱 실행
  → 찜 데이터는 localStorage에 저장
```

하지만 localStorage 방식은 기기/브라우저별 저장이라, 로그인한 개인 계정 기준으로 동기화되지는 않는다.

---

## 2. 배포 옵션 비교

| 옵션 | 비용 | 적합도 | 장점 | 한계 |
|---|---:|---|---|---|
| GitHub Pages | 무료 가능 | 정적 MVP에 적합 | GitHub만 있으면 간단, React 정적 빌드 배포 가능 | 서버 API 없음, 로그인/DB 없음, 상업/SaaS성 사용 제한 유의 |
| Cloudflare Pages | 무료 가능 | 정적 MVP + 확장에 적합 | 정적 배포 강함, 무료 티어, Workers/KV/D1로 확장 가능 | 사내 보안 승인 필요, 구성 학습 필요 |
| Netlify | 무료 가능 | 정적 MVP에 적합 | 배포 쉬움, Forms/Functions 등 확장 | 팀/상업/사용량 정책 확인 필요 |
| Vercel | 개인/비상업 Hobby 무료 | Next.js/React에 적합 | GitHub 연동 매우 쉬움, Preview URL 좋음 | Hobby는 non-commercial personal use 제한. 회사 내부 업무용이면 Pro 검토 필요 |
| Supabase + 정적 호스팅 | 무료 티어 가능 | 로그인/개인 찜까지 적합 | Auth/DB를 빠르게 붙일 수 있음 | 회사 데이터 저장/보안 정책 확인 필요 |
| Firebase + 정적 호스팅 | 무료 티어 가능 | 로그인/개인 저장에 적합 | Auth/Firestore/Hosting 통합 | Google Cloud 정책/보안 검토 필요 |
| 사내 서버 | 비용/승인 필요 | 운영 안정성/보안 우선 시 적합 | 사내망/권한/데이터 보안 유리 | 초기 세팅과 운영 부담 |

---

## 3. 서비스 단계별 추천 운영 구조

## Stage 0 — 현재 프로토타입 공유

### 구조

```text
OneDrive 폴더의 index.html 직접 공유
```

### 적합한 경우

- 나 혼자 확인
- 1~2명에게 파일로 공유
- 화면/기능 방향 피드백

### 한계

- 버전 관리 어려움
- 각자 localStorage가 분리됨
- URL 공유 경험이 약함

---

## Stage 1 — 무료 정적 웹 MVP

### 추천 구조

```text
GitHub repo
  → GitHub Pages 또는 Cloudflare Pages
  → React static build
  → 데이터는 src/data/sampleTrends.ts 또는 public/data/trends.json
  → 개인 찜은 localStorage
```

### 가장 추천하는 선택

**Cloudflare Pages 또는 GitHub Pages**

- GitHub Pages: 가장 단순
- Cloudflare Pages: 추후 Workers/KV/D1로 확장하기 좋음
- Vercel: 기술적으로는 좋지만, 회사 내부 업무용이면 Hobby 무료 약관상 애매할 수 있음

### 장점

- 서버 비용 없음
- URL로 팀원 공유 가능
- GitHub push만으로 자동 배포 가능
- 현재 React 전환 계획과 잘 맞음

### 한계

- 로그인 없음
- 개인 찜은 브라우저 localStorage 기준
- 데이터 업데이트는 코드/JSON 업데이트 필요

### 이 단계에서 구현할 것

- Vite React 앱
- 정적 빌드
- GitHub Actions 또는 Pages/Cloudflare 자동 배포
- `public/data/trends.json`로 데이터 외부화

---

## Stage 2 — 로그인 + 개인 찜/북마크

### 추천 구조 A: Static Hosting + Supabase

```text
Cloudflare Pages or GitHub Pages
  → React app
  → Supabase Auth
  → Supabase Postgres
  → user_idea_bookmarks 저장
```

### 추천 구조 B: Firebase Hosting + Firebase Auth + Firestore

```text
Firebase Hosting
  → React app
  → Firebase Auth
  → Firestore bookmarks
```

### 장점

- 별도 서버 직접 운영 없음
- 무료 티어로 소규모 테스트 가능
- 로그인한 개인 계정 기준으로 찜 목록 동기화 가능

### 한계

- 회사 데이터가 외부 SaaS DB에 저장됨
- 사내 보안 승인 필요
- 무료 티어는 운영 보장/제한 확인 필요

### 이 단계에서 구현할 것

- 로그인
- 사용자별 북마크 테이블
- 찜한 기획안 모아보기 페이지
- 저장 당시 trend/idea snapshot 보존

---

## Stage 3 — 수집/AI 생성 자동화

이 단계부터는 순수 정적 호스팅만으로는 부족하다.

### 가능한 구조

```text
Frontend: Cloudflare Pages / Vercel / Netlify
Backend: FastAPI or serverless functions
DB: Supabase Postgres / Cloudflare D1 / 사내 DB
Scheduler: GitHub Actions / Cloudflare Cron Triggers / 사내 스케줄러
```

### 자동화 대상

- 뉴스 검색 수집
- 경쟁사 프로모션 페이지 수집
- 검색 트렌드 수동/반자동 업로드
- AI 요약/기획안 생성
- 주간 데이터 스냅샷 저장

### 주의

SNS 크롤링은 약관/권한/보안 검토 전까지 MVP 범위에서 제외하는 것이 안전하다.

---

## 4. Vercel 사용 가능성

기술적으로는 가능하다.

현재 프로젝트를 Vite/React 또는 Next.js로 만들면 GitHub와 Vercel을 연결해 자동 배포할 수 있다.

다만 Vercel 문서상 Hobby 플랜은 **non-commercial, personal use** 성격으로 안내되어 있다. 우리처럼 회사 업무용 내부 도구로 사용하려는 경우에는 무료 Hobby로 운영해도 되는지 애매하므로, 실제 운영 전에는 Vercel Pro 또는 회사 정책 검토가 필요하다.

따라서 초기 무료 MVP 운영 후보로는 다음 순서를 추천한다.

1. GitHub Pages — 가장 단순한 정적 MVP
2. Cloudflare Pages — 무료 정적 운영 + 향후 서버리스 확장
3. Vercel — 개인 PoC에는 좋지만 회사 업무용 무료 운영은 약관 확인 필요

---

## 5. 최종 추천안

### 지금 바로 구현할 운영 구조

```text
GitHub private repo or organization repo
  → React/Vite app
  → GitHub Pages 또는 Cloudflare Pages 배포
  → 데이터는 정적 JSON
  → 찜은 localStorage
```

### 로그인 기능이 필요해지는 시점의 확장 구조

```text
React/Vite frontend
  → Cloudflare Pages
  → Supabase Auth + Postgres
  → user_idea_bookmarks
```

또는 회사 내부 보안 기준이 엄격하면:

```text
React frontend
  → 사내 정적 웹 서버
  → 사내 인증/DB
```

---

## 6. 구현 계획에 반영할 변경점

기존 구현 계획의 Phase 1은 유지한다.

추가로 아래 Phase 1.5를 넣는다.

## Phase 1.5 — 무료 정적 배포 준비

### Task A: GitHub 저장소 초기화

- `.gitignore` 생성
- Git 초기화
- 첫 커밋
- GitHub repo 생성
- remote 연결

### Task B: 정적 빌드 검증

```bash
npm run build
```

### Task C: 배포 타깃 선택

1. GitHub Pages 선택 시:
   - `vite.config.ts`에 `base` 설정
   - GitHub Actions workflow 추가
   - Pages source를 GitHub Actions로 설정

2. Cloudflare Pages 선택 시:
   - GitHub repo 연결
   - build command: `npm run build`
   - output directory: `dist`

3. Vercel 선택 시:
   - GitHub repo 연결
   - framework: Vite
   - build command: `npm run build`
   - output directory: `dist`
   - 단, 회사 업무용 무료 사용은 약관 확인 필요

### Task D: 배포 후 검증

- 배포 URL 접속
- 검색/필터 정상
- 프롬프트 복사 정상
- 찜/localStorage 정상
- 모바일/노트북 화면 확인

---

## 7. 판단 기준

### GitHub Pages를 선택할 조건

- 로그인 없이 정적 MVP만 필요
- 가장 단순하게 URL 공유하고 싶음
- GitHub 기반으로 관리하고 싶음

### Cloudflare Pages를 선택할 조건

- 무료 운영을 유지하면서 나중에 서버리스/DB 확장 가능성을 남기고 싶음
- 배포 성능과 확장성을 조금 더 보고 싶음

### Supabase를 붙일 조건

- 팀원이 로그인해서 각자 찜 목록을 유지해야 함
- 기기/브라우저가 달라도 저장 목록이 유지되어야 함
- 나중에 저장한 기획안에 메모/태그/상태를 붙이고 싶음

### 사내 서버를 선택할 조건

- 실제 경쟁사/내부 성과/고객 데이터가 들어감
- 회사 보안 정책상 외부 SaaS DB 사용이 어려움
- 사내 계정/SSO 연동이 필요함

---

## 8. 추천 의사결정

지금은 다음 순서로 가는 것을 추천한다.

1. **React/Vite 앱으로 전환**
2. **GitHub repo 생성**
3. **Cloudflare Pages 또는 GitHub Pages로 무료 정적 배포**
4. **팀원 3~10명에게 URL 공유해 사용성 피드백 수집**
5. **찜 기능이 실제로 필요하다는 피드백이 확인되면 Supabase Auth/DB 검토**
6. **실제 데이터/AI 자동화가 필요해지면 백엔드/API/스케줄러 설계**

이 방식이면 초기 서버 비용 없이 시작할 수 있고, 실제 사용성이 검증되기 전까지 불필요한 인프라 비용과 운영 부담을 피할 수 있다.
