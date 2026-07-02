# Trend Signal Crawler MVP

`collect:signals`는 외부 공개 신호를 수집해 Notion `[PTAI] Evidence Items` DB에 Draft 근거로 쌓는 1차 MVP입니다. 일일 자동 운영에서는 `daily-trend-update.yml`이 수집 후 `curate:trends`로 대표 근거를 Published 처리하고 Trend Topic/Promotion Ideas를 갱신한 뒤 정적 JSON과 GitHub Pages까지 반영합니다.

## 운영 흐름

```text
07:00 KST daily-trend-update.yml
  ↓
완료된 주차가 있으면 ensure:weekly-rollover가 새 Week/Trend/Idea 템플릿 생성
  ↓
외부 공개 신호 수집
  ↓
collect:signals가 Evidence Items DB에 Status=Draft로 upsert
  ↓
curate:trends가 대표 근거 Published, 테스트/노이즈/중복 Archived, Trend Topic + Promotion Ideas 갱신
  ↓
sync:notion이 Published 데이터만 정적 JSON으로 반영
  ↓
같은 workflow에서 테스트/빌드/commit/Pages 배포
```

## 로컬 실행

```bash
npm run collect:signals -- --dry-run --limit=5 --json
```

옵션:

- `--dry-run`: Notion write 없이 계획만 출력합니다.
- `--limit=N`: upsert plan 대상 수집 아이템 수를 제한합니다.
- `--status=Draft`: 생성/갱신할 Evidence Item 상태값입니다. 기본값은 `Draft`입니다.
- `--json`: GitHub Actions와 로컬 검증에 적합한 JSON summary를 출력합니다.

`NOTION_API_KEY`가 있으면 Notion에서 최신 Published Week/Trend Topics와 기존 Evidence Items를 조회합니다. `--dry-run`이고 토큰이 없으면 로컬 `public/data/trends/latest.json`을 fallback context로 사용해 수집/매칭/계획 출력까지 검증합니다.

## 수집 source

설정 파일: `config/trend-signal-sources.json`

- Google News RSS keyword feeds 9개
  - 홈쇼핑형 커머스 경쟁사: GS샵, 현대홈쇼핑/Hmall, 롯데홈쇼핑, NS홈쇼핑, 홈앤쇼핑, CJ온스타일 + 혜택/프로모션/쿠폰/이벤트/기획전
  - 국내 대형 이커머스: 쿠팡, 네이버쇼핑, G마켓, 11번가, 컬리, SSG, 무신사 + 프로모션/혜택/쿠폰/멤버십/할인
  - 중소·D2C·브랜드몰·전문몰 discovery: 온라인몰/쇼핑몰/D2C/브랜드몰/전문몰/버티컬커머스 + 행사/혜택/쿠폰/프로모션/기획전
  - 기존 모니터링 축: 커머스 멤버십, 라이브커머스/숏폼, 뷰티·패션 기획전, 리테일 큐레이션
- 경쟁사 공개 프로모션/event 페이지 15개
  - 홈쇼핑형 커머스: GS SHOP, 현대Hmall, 롯데홈쇼핑, NS홈쇼핑, 홈앤쇼핑
  - 대형 이커머스: 쿠팡, 네이버쇼핑, G마켓, 11번가, 컬리, SSG, 카카오쇼핑/톡딜
  - 기존 버티컬/인접 경쟁사: 무신사, 올리브영, W컨셉

경쟁사 페이지는 로그인, 우회, 세션 조작 없이 공개 HTML의 `title`/meta title/meta description만 읽습니다. 각 RSS feed의 `maxItems`는 2개, 경쟁사 page는 1개 신호로 제한해 초반 `--limit`이 특정 feed에 과도하게 쏠리지 않도록 했습니다. 개별 fetch 실패나 랜딩 품질 실패는 `sourceResults[].error`로 남기고 전체 실행은 계속합니다. EUC-KR/CP949 랜딩은 `Content-Type`/HTML charset 기준으로 디코딩하고, `invalidContentPatterns`/`expectedTitlePatterns`로 준비중·오류·깨진 랜딩을 차단합니다. 사이트 title이 너무 일반적인 page-snapshot은 `titleOverride`로 리뷰용 근거명을 고정합니다.

## 기간 조건

- 핵심 RSS source는 Google News query의 `when:14d`와 코드의 `lookbackDays=14`를 함께 사용해 발행일 기준 최근 14일 자료만 후보로 둡니다.
- 중소·D2C·브랜드몰 discovery RSS는 누락 방지를 위해 `when:30d`, `lookbackDays=30`을 유지합니다.
- 경쟁사 직접 페이지는 개별 행사 발행일을 아직 파싱하지 않는 1차 MVP이므로 `observationMode=page-snapshot`으로 명시하고, Evidence Date는 수집일을 사용합니다. 같은 page-snapshot Draft가 최근 7일 안에 있으면 신규 생성/갱신하지 않고 skip합니다.
- Notion Week는 수집된 근거를 연결하는 운영 주차이며, RSS 발행일 필터는 source별 `lookbackDays`가 담당합니다.

## 중복 방지 정책

수집 직후와 Notion upsert 직전에 두 번 중복을 차단합니다.

1. `canonicalUrl`: `utm_*`, `fbclid`, `gclid` 등 tracking query와 hash를 제거한 URL입니다.
2. `sourceTitleFingerprint`: 같은 source와 정규화된 제목 조합입니다. Google News redirect URL이 달라도 같은 매체/제목이면 같은 근거로 봅니다.
3. 기존 Notion Evidence Item과 같은 URL이면 신규 생성하지 않고 Draft는 update, Published/Archived는 skip합니다.
4. 기존 URL은 다르지만 같은 source/title fingerprint가 있으면 신규 create 대신 기존 Draft를 update합니다.
5. 같은 실행 내 중복은 첫 항목만 유지하고 `duplicatesRemoved`로 JSON summary에 집계합니다.

## Upsert 정책

URL canonicalization 결과를 중복 key로 사용합니다.

- 제거: `utm_*`, `fbclid`, `gclid`, `dclid`, `gbraid`, `wbraid`, `mc_cid`, `mc_eid`, hash 등 tracking 값
- 같은 URL 없음 + 같은 source/title fingerprint 없음: `create`
- 같은 URL 또는 같은 source/title fingerprint의 기존 Evidence Item이 `Draft`: `update`
- 같은 URL 또는 같은 source/title fingerprint의 기존 Evidence Item이 `Published`: `skip` — Published를 Draft로 다운그레이드하지 않습니다.
- 같은 URL 또는 같은 source/title fingerprint의 기존 Evidence Item이 `Archived`: `skip`
- 같은 실행 내 중복 URL/fingerprint: 첫 항목만 계획하고 나머지는 `skip` 또는 사전 dedupe

## Trend 매칭

`Name`, `Summary`, `Keywords`, `Categories`, `Promotion Types`, AI insight/opportunity hints를 후보 term으로 만들고, 수집 item의 title/description/source/source hints와 겹치는 term에 점수를 부여합니다. 점수가 가장 높은 Published Trend Topic에 Evidence relation을 연결합니다. 완전 무매칭이면 최신 Published Week의 첫 Trend를 fallback으로 사용하되 dry-run JSON에 `matchScore: 0`으로 드러납니다.

## GitHub Actions

`.github/workflows/daily-trend-update.yml`

- schedule: `0 22 * * *` (매일 07:00 KST)
- 단계: `ensure:weekly-rollover` → `collect:signals` → `curate:trends` → `sync:notion` → test/build → `public/data` commit → Pages 배포
- `ensure:weekly-rollover`: 최신 Published 주차의 종료일 다음날부터 7일 단위로, KST 기준 전일까지 완전히 종료된 주차가 있으면 새 Week를 만들고 이전 주차의 Published Trend/Idea 템플릿을 복제합니다.
- `workflow_dispatch` inputs: `collect_limit`, `dry_run`
- Notion secrets: `NOTION_API_KEY`, `NOTION_HUB_PAGE_ID`, `NOTION_WEEKS_DATABASE_ID`, `NOTION_TRENDS_DATABASE_ID`, `NOTION_EVIDENCE_DATABASE_ID`, `NOTION_IDEAS_DATABASE_ID`
- `collect-trend-signals.yml`, `sync-notion-data.yml`은 수동 진단/복구용 workflow로 유지합니다.
