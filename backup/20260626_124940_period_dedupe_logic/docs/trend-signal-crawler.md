# Trend Signal Crawler MVP

`collect:signals`는 외부 공개 신호를 수집해 Notion `[PTAI] Evidence Items` DB에 Draft 근거로 쌓는 1차 MVP입니다. 기존 Notion → 정적 JSON → GitHub Pages 반영 파이프라인은 그대로 두고, 사람이 검토할 후보 근거만 자동 생성합니다.

## 운영 흐름

```text
07:00 KST collect-trend-signals.yml
  ↓
뉴스 RSS + 홈쇼핑형/대형 이커머스 경쟁사 공개 프로모션 페이지 수집
  ↓
최신 Published Week의 Published Trend Topics 중 가장 적합한 Trend에 relation 연결
  ↓
Evidence Items DB에 Status=Draft로 URL 기준 upsert
  ↓
운영자가 Notion에서 검토 후 Published 선택
  ↓
08:00 KST sync-notion-data.yml이 Published 데이터만 정적 JSON으로 반영
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

경쟁사 페이지는 로그인, 우회, 세션 조작 없이 공개 HTML의 `title`/meta title/meta description만 읽습니다. 각 RSS feed의 `maxItems`는 2개, 경쟁사 page는 1개 신호로 제한해 초반 `--limit`이 특정 feed에 과도하게 쏠리지 않도록 했습니다. 개별 fetch 실패는 `sourceResults[].error`로 남기고 전체 실행은 계속합니다.

## Upsert 정책

URL canonicalization 결과를 중복 key로 사용합니다.

- 제거: `utm_*`, `fbclid`, `gclid`, `dclid`, `gbraid`, `wbraid`, `mc_cid`, `mc_eid`, hash 등 tracking 값
- 같은 URL 없음: `create`
- 같은 URL의 기존 Evidence Item이 `Draft`: `update`
- 같은 URL의 기존 Evidence Item이 `Published`: `skip` — Published를 Draft로 다운그레이드하지 않습니다.
- 같은 URL의 기존 Evidence Item이 `Archived`: `skip`
- 같은 실행 내 중복 URL: 첫 항목만 계획하고 나머지는 `skip`

## Trend 매칭

`Name`, `Summary`, `Keywords`, `Categories`, `Promotion Types`, AI insight/opportunity hints를 후보 term으로 만들고, 수집 item의 title/description/source/source hints와 겹치는 term에 점수를 부여합니다. 점수가 가장 높은 Published Trend Topic에 Evidence relation을 연결합니다. 완전 무매칭이면 최신 Published Week의 첫 Trend를 fallback으로 사용하되 dry-run JSON에 `matchScore: 0`으로 드러납니다.

## GitHub Actions

`.github/workflows/collect-trend-signals.yml`

- schedule: `0 22 * * *` (매일 07:00 KST)
- `workflow_dispatch` inputs: `dry_run`, `status`, `limit`
- Notion secrets: `NOTION_API_KEY`, `NOTION_WEEKS_DATABASE_ID`, `NOTION_TRENDS_DATABASE_ID`, `NOTION_EVIDENCE_DATABASE_ID`
- Pages deploy는 수행하지 않습니다. 정적 JSON 반영은 기존 `sync-notion-data.yml`이 담당합니다.
