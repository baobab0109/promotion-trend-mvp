# Notion Data Schema — Promotion Trend AI Planner

이 문서는 GitHub Pages 배포 웹이 Notion을 CMS처럼 사용하기 위한 데이터 구조를 정의합니다.

## 생성 위치

- Hub page: [Promotion Trend AI Planner Data Hub](https://app.notion.com/p/Promotion-Trend-AI-Planner-Data-Hub-38a09436352481f3a1e4d60bcb057e1b)
- Parent page: `프로모션 관련 PMO 과제 리스트 정리`
- Local config: `config/notion-data-sources.json`

## 운영 원칙

브라우저에서 Notion API를 직접 호출하지 않습니다. Notion API token은 GitHub Secrets에만 저장하고, GitHub Actions가 Notion DB를 읽어 정적 JSON을 생성합니다.

```text
외부 공개 신호(뉴스 RSS + 경쟁사 공개 프로모션 페이지)
  → 07:00 KST collect-trend-signals workflow
  → Notion Evidence Items DB에 Status=Draft로 upsert
  → 사람이 검토 후 Published 선택
  → 08:00 KST sync-notion-data workflow
  → public/data/trends/latest.json
  → GitHub Pages React app fetch
```

## Databases

| 역할 | Notion DB | ID |
|---|---|---|
| 주차 관리 | `[PTAI] Weeks` | `38a09436-3524-81a3-9f07-edce398bc153` |
| 트렌드 주제 | `[PTAI] Trend Topics` | `38a09436-3524-8127-9136-ed82c4b24295` |
| 근거 데이터 | `[PTAI] Evidence Items` | `38a09436-3524-81fc-8dde-d506158ea93b` |
| 프로모션 기획안 | `[PTAI] Promotion Ideas` | `38a09436-3524-81ef-8f8b-e10df8971ac3` |

## `[PTAI] Weeks`

주차/배포 단위입니다. 웹은 `Status = Published`인 최신 주차를 기본 로드합니다.

| Property | Type | 설명 |
|---|---|---|
| Name | Title | 표시명. 예: `2026-W25 · 2026.06.17 - 2026.06.23` |
| Week ID | Text | 고유 주차 ID. 예: `2026-W25` |
| Label | Text | 웹 표시 기간. 예: `2026.06.17 - 2026.06.23` |
| Status | Select | `Draft`, `Published`, `Archived` |
| Start Date | Date | 시작일 |
| End Date | Date | 종료일 |
| Notes | Text | 운영 메모 |

## `[PTAI] Trend Topics`

웹의 `TrendTopic` 하나에 해당합니다.

| Property | Type | 설명 |
|---|---|---|
| Name | Title | 트렌드명 |
| Trend ID | Text | 앱 내부 고유 ID. 예: `membership-preview` |
| Week | Relation → Weeks | 주차 연결 |
| Status | Select | `Draft`, `Published`, `Archived` |
| Summary | Text | 트렌드 요약 |
| Keywords | Multi-select | 키워드 chips |
| Channels | Multi-select | `SNS`, `검색`, `기사`, `경쟁사` 등 |
| Categories | Multi-select | `뷰티`, `패션`, `리빙`, `멤버십/CRM` 등 |
| Promotion Types | Multi-select | `멤버십`, `큐레이션`, `한정판`, `할인` 등 |
| Mode Bias | Select | `stable` 또는 `aggressive` |
| Momentum | Number | 0~100 |
| OnStyle Fit | Number | 0~100 |
| Risk | Number | 0~100 |
| AI Consumer Insight | Text | 고객 인사이트 해석 |
| AI Opportunity | Text | 온스타일 적용 기회 |
| AI Caution | Text | 운영/리스크 주의사항 |
| Sort Order | Number | 표시 순서 |

## `[PTAI] Evidence Items`

근거 데이터입니다. 한 트렌드에 여러 개 연결됩니다.

| Property | Type | 설명 |
|---|---|---|
| Name | Title | 근거 제목 |
| Trend | Relation → Trend Topics | 연결 트렌드 |
| Type | Select | `기사`, `검색`, `SNS`, `경쟁사` |
| Source | Text | 출처명 |
| Evidence Date | Date | 근거 날짜 |
| URL | URL | 원문 링크. 샘플은 비워둘 수 있음 |
| Summary | Text | 근거 요약 |
| Status | Select | `Draft`, `Published`, `Archived` |

### Crawler/upsert 정책

1차 크롤러 MVP(`scripts/collect-trend-signals.mjs`)는 Evidence Items DB만 생성/수정합니다. Trend Topics/Weeks/Promotion Ideas는 자동 생성하지 않습니다.

- 수집 대상: `config/trend-signal-sources.json`의 Google News RSS keyword feeds와 로그인 없이 접근 가능한 경쟁사 공개 프로모션 페이지입니다.
- 기본 상태: 신규/갱신 Evidence Item은 `Status = Draft`가 기본값입니다. 웹 반영은 운영자가 Notion에서 검토 후 `Published`로 변경한 항목만 대상입니다.
- Trend relation: 최신 `Published` Week에 속한 `Published` Trend Topics를 조회하고, 제목/요약/키워드/hints 기반 점수로 가장 적절한 Trend 후보에 연결합니다.
- 중복 기준: URL canonicalization 결과를 기준으로 upsert합니다. `utm_*`, `fbclid`, `gclid` 등 tracking query와 hash는 제거합니다.
- 기존 page 처리:
  - 같은 URL이 없으면 `create`.
  - 같은 URL의 기존 Evidence Item이 `Draft`이면 최신 title/source/date/summary/trend relation으로 `update`.
  - 같은 URL의 기존 Evidence Item이 `Published`이면 `Draft`로 다운그레이드하지 않도록 `skip`합니다.
  - 같은 URL의 기존 Evidence Item이 `Archived`이면 재노출 방지를 위해 `skip`합니다.
- Dry-run: `--dry-run` 옵션은 Notion write 없이 create/update/skip 계획과 샘플을 출력합니다.
- 실패 정책: 개별 RSS/경쟁사 source fetch 실패는 source error로 기록하고 전체 수집은 계속합니다.

## `[PTAI] Promotion Ideas`

안정형/공격형 기획안입니다. 혼합형은 웹에서 stable/aggressive를 조합해 생성합니다.

| Property | Type | 설명 |
|---|---|---|
| Name | Title | 기획안 제목 |
| Trend | Relation → Trend Topics | 연결 트렌드 |
| Mode | Select | `stable` 또는 `aggressive` |
| Status | Select | `Draft`, `Published`, `Archived` |
| Concept | Text | 컨셉 |
| Target | Text | 타깃 |
| Category | Text | 적용 카테고리 |
| Benefit | Text | 혜택 구조 |
| Message | Text | 핵심 메시지 |
| Channels | Multi-select | 실행 채널 |
| Expected Effect | Text | 기대 효과 |
| Risk | Text | 리스크 |
| Buzz | Select | 화제성 |
| Difficulty | Select | 실행 난이도 |
| Banner Copy | Text | 배너 카피 |
| Push Copy | Text | 푸시 카피 |
| Live Copy | Text | 라이브/콘텐츠 카피 |
| Checklist | Text | 줄바꿈으로 구분한 체크리스트 |
| Teams | Multi-select | 협업 부서 |

## 생성/시드 결과

초기 생성 시 Phase 1 MVP 샘플 데이터도 seed했습니다.

- Weeks: 1
- Trend Topics: 6
- Evidence Items: 13
- Promotion Ideas: 12

## GitHub Secrets

아래 secrets를 repo에 등록했습니다.

- `NOTION_API_KEY`
- `NOTION_HUB_PAGE_ID`
- `NOTION_WEEKS_DATABASE_ID`
- `NOTION_TRENDS_DATABASE_ID`
- `NOTION_EVIDENCE_DATABASE_ID`
- `NOTION_IDEAS_DATABASE_ID`

## 운영 조건

1. `scripts/collect-trend-signals.mjs`가 매일 07:00 KST 외부 공개 신호를 Evidence Items DB에 `Draft`로 upsert합니다.
2. 운영자가 Notion에서 근거를 검토하고 웹에 반영할 항목만 `Published`로 변경합니다.
3. `scripts/sync-notion-trends.mjs`가 Notion DB query 결과를 `public/data/trends/latest.json`으로 변환합니다.
4. 앱은 시작 시 `latest.json`을 fetch해 Published 주차 데이터를 표시합니다.
5. GitHub Actions `sync-notion-data.yml`은 매일 08:00 KST에 1회 자동 실행됩니다.
6. GitHub Actions `workflow_dispatch` 수동 실행 버튼을 제공하며, 필요 시 `week_id` input으로 특정 주차를 동기화할 수 있습니다.
7. 수동 실행/스케줄 실행 후 변경된 정적 JSON은 commit되고 Pages deploy workflow로 자동 배포됩니다.
