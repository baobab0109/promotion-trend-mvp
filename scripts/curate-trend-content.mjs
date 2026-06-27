import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'config', 'notion-data-sources.json');
const NOTION_VERSION = '2022-06-28';
const STATUS = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const MODE_ORDER = ['stable', 'aggressive'];

function parseArgs(argv = process.argv.slice(2)) {
  return {
    dryRun: argv.includes('--dry-run'),
    json: argv.includes('--json'),
    minMatchScore: Number(argv.find((arg) => arg.startsWith('--min-match-score='))?.split('=')[1] || 0)
  };
}

async function loadDotEnv() {
  const candidates = [
    path.join(ROOT, '.env'),
    path.join(process.env.HOME || '', '.hermes', '.env'),
    path.join(process.env.LOCALAPPDATA || '', 'hermes', '.env')
  ];
  for (const file of candidates) {
    try {
      const text = await fs.readFile(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    } catch {
      // local convenience only
    }
  }
}

async function loadConfig() {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  return {
    weeks: process.env.NOTION_WEEKS_DATABASE_ID || config.databases.weeks,
    trends: process.env.NOTION_TRENDS_DATABASE_ID || config.databases.trends,
    evidence: process.env.NOTION_EVIDENCE_DATABASE_ID || config.databases.evidence,
    ideas: process.env.NOTION_IDEAS_DATABASE_ID || config.databases.ideas
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notion(pathname, { method = 'GET', body, retries = 3 } = {}) {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error('NOTION_API_KEY is required');
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`https://api.notion.com/v1${pathname}`, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(`${method} ${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(800 * attempt);
    }
  }
  throw lastError;
}

async function queryDatabase(databaseId, body = {}) {
  const results = [];
  let startCursor;
  do {
    const data = await notion(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: { page_size: 100, ...body, ...(startCursor ? { start_cursor: startCursor } : {}) }
    });
    results.push(...data.results);
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);
  return results;
}

function prop(page, name) { return page.properties?.[name]; }
function title(page, name = 'Name') { return prop(page, name)?.title?.map((item) => item.plain_text).join('')?.trim() || ''; }
function richText(page, name) { return prop(page, name)?.rich_text?.map((item) => item.plain_text).join('')?.trim() || ''; }
function select(page, name) { return prop(page, name)?.select?.name || ''; }
function multiSelect(page, name) { return prop(page, name)?.multi_select?.map((item) => item.name).filter(Boolean) || []; }
function dateStart(page, name) { return prop(page, name)?.date?.start || ''; }
function url(page, name) { return prop(page, name)?.url || ''; }
function relationIds(page, name) { return prop(page, name)?.relation?.map((item) => item.id) || []; }

function richTextProp(value) { return { rich_text: [{ text: { content: String(value || '').slice(0, 1900) } }] }; }
function titleProp(value) { return { title: [{ text: { content: String(value || '').slice(0, 1900) } }] }; }
function selectProp(value) { return { select: { name: value } }; }
function relationProp(id) { return { relation: id ? [{ id }] : [] }; }
function multiSelectProp(values = []) { return { multi_select: values.filter(Boolean).map((name) => ({ name })) }; }
function numberProp(value) { return { number: value }; }

function normalize(value = '') {
  return String(value).toLowerCase().replace(/[^0-9a-z가-힣]+/giu, ' ').replace(/\s+/g, ' ').trim();
}

function hasAny(text, patterns = []) {
  const haystack = normalize(text);
  return patterns.some((pattern) => haystack.includes(normalize(pattern)));
}

function isSampleEvidence(evidence) {
  return hasAny(`${evidence.title} ${evidence.source}`, ['Sample', '샘플', 'Competitor Sample', 'Sample News', 'Sample Social', 'Sample Search Trend']);
}

function exclusionReason(evidence) {
  const text = `${evidence.title} ${evidence.source} ${evidence.summary}`;
  if (evidence.type === 'SNS' && !isHighSignalSocialEvidence(text)) return '공개 SNS/UGC 근거이나 쇼핑·혜택·라이브·후기 맥락이 충분히 구체적이지 않음';
  if (evidence.type === '검색' && !isHighSignalSearchEvidence(text)) return '검색 근거이나 커머스사·혜택 메커니즘·프로모션 실행 맥락이 모두 확인되지 않음';
  if (hasAny(text, ['탈세', '과세', '세무', '세금', '전쟁 선포'])) return '규제/세무 이슈 중심으로 프로모션 실행 근거가 아님';
  if (hasAny(text, ['협찬', '광고', '체험단', '파트너스', '제공받아'])) return '광고/협찬/체험단 가능성이 있어 직접 Published 근거로 사용하지 않음';
  if (hasAny(text, ['금호타이어', '타이어프로', '불스원', '유류'])) return '온스타일 핵심 카테고리와 거리가 큰 자동차/유류 이벤트';
  if (hasAny(text, ['신세계면세점', '면세점', '여름 여행', '휴가철 맞아 여름 여행'])) return '면세/여행 캠페인 성격이 강해 직접 적용성이 낮음';
  if (hasAny(text, ['경방 타임스퀘어', '오프라인', '스윔웨어 할인 행사'])) return '오프라인몰 행사 성격이 강함';
  if (hasAny(text, ['센녹', '애정템', '입소문'])) return '브랜드 PR/셀럽 기사 성격이 강하고 혜택 구조가 약함';
  if (hasAny(text, ['인수 마친', '추격 시작', '기업', '인수'])) return '기업/경쟁구도 기사로 프로모션 실행 신호가 아님';
  if (evidence.source === 'W컨셉 이벤트' && !hasAny(text, ['하이라이트', '기획전', '쿠폰', '혜택'])) return '일반 홈 snapshot으로 혜택 구조가 약함';
  if (evidence.source === '컬리 기획전' && hasAny(text, ['TOP300'])) return '랭킹 큐레이션 성격은 있으나 이번 혜택/CRM 근거로 약함';
  if (evidence.source === '롯데홈쇼핑 이벤트' && titleOnlyLooksGeneric(evidence.title)) return '일반 이벤트 snapshot으로 구체 혜택 구조가 부족함';
  return '';
}

function titleOnlyLooksGeneric(value = '') {
  const text = normalize(value);
  return ['롯데홈쇼핑', '홈앤쇼핑', 'w컨셉 w concept', 'top300 마켓컬리'].includes(text);
}

function isHighSignalSearchEvidence(text) {
  return hasAny(text, [
    'CJ온스타일', '온스타일', 'GS샵', 'GS SHOP', '현대홈쇼핑', '현대Hmall', 'Hmall', '롯데홈쇼핑', 'NS홈쇼핑', '홈앤쇼핑',
    '쿠팡', '로켓와우', '네이버쇼핑', '네이버플러스', '11번가', 'G마켓', '옥션', 'SSG', '쓱닷컴', '롯데온', '카카오쇼핑', '톡딜',
    '올리브영', '무신사', 'W컨셉', '29CM', '지그재그', '에이블리', '컬리', '오늘의집', '알리익스프레스', '브랜드몰'
  ]) && hasAny(text, [
    '혜택', '쿠폰', '쿠폰팩', '할인', '적립', '포인트', '캐시백', '페이백', '리워드', '무료배송', '무료반품',
    '사은품', '증정', '굿즈', '특가', '타임딜', '핫딜', '선착순', '한정수량', '멤버십', '회원전용', '전용혜택', '선공개'
  ]) && hasAny(text, [
    '프로모션', '이벤트', '기획전', '행사', '페스타', '세일', '할인전', '브랜드위크', '브랜드데이', '쇼핑라이브',
    '라이브커머스', '출석', '미션', '룰렛', '스탬프', '챌린지', '리뷰', '후기', '알림신청', '찜', '장바구니',
    '개인화', 'AI추천', '추천딜', '큐레이션', '랭킹', '베스트', '드롭', '래플', '런칭'
  ]);
}

function isHighSignalSocialEvidence(text) {
  return hasAny(text, ['유튜브', '쇼츠', '블로그', 'sns', '인증샷', '후기', '언박싱', '하울', '댓글', '챌린지', '리뷰'])
    && hasAny(text, ['쇼핑', '커머스', '쇼핑라이브', '라이브커머스', '쿠폰', '혜택', '특가', '타임딜', '한정판', '굿즈', '구매', '할인', '기획전']);
}

function classifyEvidence(evidence, trendMap) {
  const text = `${evidence.title} ${evidence.source} ${evidence.summary}`;
  const reason = exclusionReason(evidence);
  if (reason) return { action: 'archive', reason };

  const byTrendId = (trendId, summary) => ({ action: 'publish', trend: trendMap.get(trendId), summary });
  if (hasAny(text, ['쇼킹딜', '톡딜', '쇼핑라이브', '쎈딜', '반값창고', '라이브', '타임딜', '라이브특가', '숏폼커머스', '쇼츠'])) {
    return byTrendId('live-instant', summaryFor('live-instant', evidence));
  }
  if (hasAny(text, ['hmall', 'ssg', '혜택 쌓기', '카탈로그 연동 베네핏', '이벤트 쿠폰', '출석', '퀴즈', '래플', '쿠폰팩', '쿠폰추천', '검색 관심'])) {
    return byTrendId('routine-benefit', summaryFor('routine-benefit', evidence));
  }
  if (hasAny(text, ['로켓와우', '홈앤쇼핑', '현대이지웰', '복지몰', '멤버십', '클럽', '무료 반품'])) {
    return byTrendId('membership-preview', summaryFor('membership-preview', evidence));
  }
  if (hasAny(text, ['roka', '협업', '브랜드 하이라이트', 'w컨셉 신규 브랜드', '굿즈', '한정', '한정판굿즈', '브랜드위크'])) {
    return byTrendId('limited-goods', summaryFor('limited-goods', evidence));
  }
  if (hasAny(text, ['ai', '빅데이터', '어워즈', '큐레이션', '알리익스프레스'])) {
    return byTrendId('ai-curation', summaryFor('ai-curation', evidence));
  }
  if (hasAny(text, ['리뷰', 'ugc', '인증샷', '챌린지', '후기', '언박싱', '하울', '유튜브', '블로그', '댓글', 'sns'])) {
    return byTrendId('ugc-review', summaryFor('ugc-review', evidence));
  }
  return { action: 'archive', reason: '자동 큐레이션 기준상 high-signal 키워드가 부족함' };
}

function summaryFor(trendId, evidence) {
  const source = evidence.source || '외부 신호';
  const map = {
    'live-instant': `${source} 사례. 뉴스·경쟁사·공개 SNS에서 시간 제한, 라이브/현장감, 단독 딜 신호가 반복되어 즉시 구매를 유도하는 프로모션 근거.`,
    'routine-benefit': `${source} 사례. 경쟁사와 공개 콘텐츠에서 쿠폰·적립·참여형 미션을 혜택 허브/고객 루틴으로 묶는 CRM 운영 근거.`,
    'membership-preview': `${source} 사례. 멤버십/클럽/폐쇄형 채널에서 접근권·편의·추가혜택을 묶어 효용을 제시하는 근거.`,
    'limited-goods': `${source} 사례. 공개 UGC/뉴스 신호에서 할인율보다 콜라보·브랜드 스토리·한정성을 구매 명분으로 만드는 근거.`,
    'ai-curation': `${source} 사례. 데이터·랭킹·베스트 상품을 큐레이션 메시지로 전환해 탐색 피로를 줄이는 근거.`,
    'ugc-review': `${source} 사례. 공개 SNS/블로그/영상 신호를 통해 구매 후 리뷰·인증 참여를 다음 혜택과 연결하는 보조 CRM 근거.`
  };
  return map[trendId] || evidence.summary;
}

function clusterKey(evidence, classification) {
  const text = normalize(`${evidence.title} ${evidence.source}`);
  if (text.includes('레노버') && text.includes('쇼핑라이브')) return 'lenovo-shoppinglive';
  if (text.includes('카카오') && (text.includes('톡딜') || text.includes('쎈딜'))) return `kakao-deal:${text.includes('쎈딜') ? 'sendil' : 'talkdeal'}`;
  return `${classification.trend?.trendId || 'unknown'}:${normalize(evidence.source)}:${normalize(evidence.title).slice(0, 48)}`;
}

const trendContent = {
  'routine-benefit': {
    summary: '혜택을 쿠폰함에만 두지 않고 고객 루틴·앱 방문·미션·혜택 허브로 묶는 흐름. Hmall/SSG/무신사/카카오 베네핏과 경쟁사 신호에서 쿠폰·적립·참여형 혜택의 상시화가 관찰됨.',
    consumer: '고객은 단발 할인보다 “내가 받을 수 있는 혜택이 어디에 있고, 오늘 무엇을 하면 더 받는지”를 쉽게 확인하려는 니즈가 커지고 있다.',
    opportunity: '온스타일은 혜택 탭을 개인화 루틴 허브로 재정의하고, 출석·찜·라이브 알림·리뷰 같은 행동을 소액 리워드와 연결해 재방문을 만든다.',
    caution: '미션형 리워드는 체리피커 유입과 비용 누수가 생길 수 있어 월 한도, 구매 연계 조건, 등급별 차등 지급이 필요하다.',
    scores: { momentum: 82, onstyleFit: 84, risk: 35 }
  },
  'limited-goods': {
    summary: '무신사 ROKA 협업, W컨셉 신규 브랜드 하이라이트처럼 할인율보다 콜라보·브랜드 스토리·한정성을 구매 명분으로 만드는 흐름.',
    consumer: '가격 혜택만으로는 차별화가 어려워지면서 고객은 “여기서만 살 수 있는 이유”와 브랜드 맥락을 함께 기대한다.',
    opportunity: '온스타일 단독 드롭, 브랜드 위크, 라이브 전용 사은품을 묶어 패션/뷰티 카테고리에서 가격 외 구매 명분을 강화한다.',
    caution: '한정 수량·사은품 지급 조건·품절 고지가 불명확하면 CS/불만 리스크가 커진다.',
    scores: { momentum: 70, onstyleFit: 78, risk: 50 }
  },
  'ugc-review': {
    summary: '공개 블로그·영상·SNS성 신호를 보강 수집해 라이브딜/한정 굿즈 구매 후 인증·리뷰 참여를 후속 혜택으로 연결하는 흐름이 관찰됨.',
    consumer: '구매 전에는 타인의 사용 경험과 인증 콘텐츠를 참고하고, 구매 후에는 보상 조건이 명확할 때 리뷰/UGC 참여가 늘어난다.',
    opportunity: '라이브 구매자 또는 한정 굿즈 수령 고객에게 리뷰·인증샷 미션을 부여해 다음 구매 쿠폰/적립으로 연결하고, 공개 UGC 신호를 다음 프로모션 기획의 보조 근거로 활용한다.',
    caution: '허위 리뷰, 과도한 보상성 콘텐츠, 개인정보 노출을 막기 위한 가이드와 검수 기준이 필요하다.',
    scores: { momentum: 45, onstyleFit: 65, risk: 40 }
  },
  'membership-preview': {
    summary: '쿠팡 로켓와우, 홈앤쇼핑 클럽, 현대이지웰 복지몰처럼 멤버십/클럽/폐쇄형 채널에서 배송·반품·추가혜택·접근권을 묶어 효용을 제시하는 흐름.',
    consumer: '회원은 단순 쿠폰팩보다 “먼저 보고, 더 받고, 놓치지 않는” 접근권과 편의 혜택을 멤버십 가치로 인식한다.',
    opportunity: '온스타일은 VIP/멤버십 고객에게 방송 전 선공개, 단독 구성, 라이브 전용 사은품, 추가 적립을 묶은 선공개 프로그램을 테스트한다.',
    caution: '회원 전용 혜택을 과도하게 닫으면 비회원 소외감이 생길 수 있으므로 선공개 후 전체 공개 구조가 안전하다.',
    scores: { momentum: 76, onstyleFit: 82, risk: 45 }
  },
  'ai-curation': {
    summary: '알리익스프레스 빅데이터 어워즈처럼 데이터·랭킹·베스트 상품을 큐레이션 메시지로 전환해 할인전의 탐색 피로를 줄이는 흐름.',
    consumer: '고객은 많은 상품을 직접 비교하기보다 검증된 랭킹/취향 기반 추천을 통해 빠르게 선택하려는 경향이 있다.',
    opportunity: '온스타일은 카테고리별 베스트, 재구매 주기, 최근 관심 상품을 결합해 “데이터로 고른 오늘의 딜” 형태의 큐레이션을 제공한다.',
    caution: 'AI 표현을 과장하기보다 추천 기준을 설명 가능한 언어로 제시해야 신뢰 리스크를 줄일 수 있다.',
    scores: { momentum: 62, onstyleFit: 76, risk: 42 }
  },
  'live-instant': {
    summary: '쇼킹딜·톡딜·쇼핑라이브·반값창고와 공개 SNS 신호에서 시간 제한, 방송 현장감, 단독 딜을 결합한 즉시 구매형 프로모션 관심이 강하게 포착됨.',
    consumer: '고객은 “지금 사면 더 받는다”는 명확한 이유가 있을 때 라이브/딜 페이지에서 빠르게 전환한다.',
    opportunity: '온스타일은 방송 전 알림 신청, 방송 중 전용 쿠폰/사은품, 방송 후 미구매자 리마인드 쿠폰으로 라이브 전후 CRM 퍼널을 설계한다.',
    caution: '상시 타임딜화는 할인 피로와 마진 훼손을 만들 수 있어 단독 구성·콘텐츠·세그먼트별 혜택을 함께 설계해야 한다.',
    scores: { momentum: 88, onstyleFit: 88, risk: 55 }
  }
};

const ideaTemplates = {
  'live-instant': {
    stable: {
      title: '방송 켜면 열리는 라이브 전용 혜택', concept: '방송 전 알림, 방송 중 쿠폰, 방송 후 리마인드까지 이어지는 기본형 라이브 혜택', target: '라이브 알림 신청자, 장바구니 보유 고객, 최근 카테고리 탐색 고객', category: 'Live Commerce', benefit: '방송 중 전용 쿠폰, 구매 사은품, 방송 종료 후 제한 리마인드', message: '방송 시간에 들어오면 지금만 받을 수 있는 혜택을 바로 확인하세요.', expectedEffect: '알림 신청률, 방송 진입률, 방송 중 구매 전환 상승', risk: '쿠폰 조건이 복잡하면 이탈 가능', buzz: '중간', difficulty: '중간', channels: ['라이브', '앱푸시', '기획전'], teams: ['라이브커머스', 'CRM', 'MD', 'CS'], copy: { banner: '라이브 중에만 열리는 전용 혜택', push: '곧 시작해요. 방송 중 쿠폰을 놓치지 마세요.', live: '지금 입장 고객에게만 방송 쿠폰이 열렸어요.' }, checklist: ['알림 신청 CTA 명확화', '방송 중 쿠폰 노출 위치 고정', '종료 후 2~6시간 리마인드 설정', '사은품 재고 실시간 확인']
    },
    aggressive: {
      title: '30분 라이브 쇼크딜', concept: '방송 시작 후 30분 동안만 강한 할인과 사은품을 여는 타임락 프로모션', target: '가격 민감 고객, 라이브 재방문 고객, 알림 반응 고객', category: 'Live Commerce', benefit: '타임딜 할인, 선착순 사은품, 방송 전용 추가 쿠폰', message: '지금 30분 안에 들어오면 오늘 가장 큰 혜택을 받을 수 있습니다.', expectedEffect: '초반 동시접속, 실시간 구매, 댓글 참여 증가', risk: '과도한 할인 피로, 재고 부족 시 불만', buzz: '높음', difficulty: '높음', channels: ['라이브', 'SNS', '앱'], teams: ['라이브커머스', 'MD', 'CRM', '운영', 'CS'], copy: { banner: '딱 30분, 라이브 쇼크딜 오픈', push: '지금 들어오면 선착순 혜택이 열려요.', live: '남은 30분, 방송 전용 가격으로 구매하세요.' }, checklist: ['선착순 수량 사전 확정', '품절 대체 혜택 준비', '라이브 타이머 노출', 'CS 예상 문의 문구 준비']
    }
  },
  'routine-benefit': {
    stable: {
      title: '매일 쌓이는 나의 혜택 루틴', concept: '출석, 찜, 리뷰, 장바구니 같은 가벼운 행동을 혜택 탭에서 매일 이어가게 설계', target: '앱 재방문 고객, 혜택 탭 방문자, 미구매 탐색 고객', category: 'Personal Benefit Routine', benefit: '출석 포인트, 찜 쿠폰, 리뷰 적립, 미션 완료 보상', message: '오늘 할 수 있는 혜택만 모아두었습니다.', expectedEffect: 'DAU, 혜택 탭 체류, 찜/리뷰 행동 증가', risk: '미션이 많으면 피로감 발생', buzz: '중간', difficulty: '중간', channels: ['앱홈', '푸시', '기획전'], teams: ['CRM', '프로덕트', '데이터', '리워드 운영'], copy: { banner: '오늘 받을 수 있는 혜택만 보기', push: '오늘 미션이 열렸어요. 혜택을 쌓아보세요.', live: '지금 혜택 탭에서 오늘의 미션을 확인하세요.' }, checklist: ['하루 2~3개 미션으로 제한', '완료 보상 즉시 지급', '미션 난이도 구분', '혜택 만료일 명확히 표기']
    },
    aggressive: {
      title: '나만 열리는 7일 혜택 챌린지', concept: '고객 행동에 따라 개인별 미션팩을 주고 7일 연속 달성 시 큰 보상을 제공', target: '최근 30일 내 방문 빈도 높은 고객, 장바구니 이탈 고객, 멤버십 관심 고객', category: 'Personal Benefit Routine', benefit: '개인별 쿠폰팩, 연속 달성 보너스, 카테고리별 추가 적립', message: '내 쇼핑 패턴에 맞춘 7일 혜택이 열렸습니다.', expectedEffect: '연속 방문, 장바구니 회수, 카테고리 재탐색 증가', risk: '개인화 기준이 불명확하면 불공정 인식 가능', buzz: '높음', difficulty: '높음', channels: ['앱', 'SNS', '라이브'], teams: ['CRM', '데이터', '프로덕트', '법무검토'], copy: { banner: '나만의 7일 혜택 챌린지', push: '오늘 미션 완료하면 보너스 혜택이 이어져요.', live: '내 혜택 챌린지에서 다음 보상을 확인하세요.' }, checklist: ['개인화 사유 짧게 표시', '미션 실패 시 재참여 기회 제공', '보상 단계 시각화', '과도한 개인정보 표현 금지']
    }
  },
  'membership-preview': {
    stable: {
      title: '멤버 먼저 보는 선공개 딜', concept: '멤버십 고객에게 인기 상품을 24시간 먼저 공개하고 추가 적립을 제공', target: '멤버십 가입자, 가입 직전 고객, 고관여 카테고리 고객', category: 'Membership', benefit: '선공개, 멤버 전용 쿠폰, 추가 적립', message: '멤버라면 하루 먼저 보고 먼저 살 수 있습니다.', expectedEffect: '멤버십 유지율, 가입 전환, 초기 판매 속도 상승', risk: '비회원 소외감, 혜택 중복 관리 필요', buzz: '중간', difficulty: '중간', channels: ['앱홈', '푸시', '멤버십관'], teams: ['멤버십', 'CRM', 'MD', '프로덕트', 'CS'], copy: { banner: '멤버에게 먼저 열리는 혜택', push: '멤버 전용 선공개가 시작됐어요.', live: '지금 멤버만 구매 가능한 구성이 열렸습니다.' }, checklist: ['비회원에게 가입 CTA 제공', '선공개 종료 시간 명확화', '멤버 전용 가격/적립 분리 표기', '재고 배분 확인']
    },
    aggressive: {
      title: '멤버십 프라이빗 드롭', concept: '멤버에게만 접근 가능한 단독 구성, 한정 수량, 대기열을 결합한 드롭형 행사', target: '충성 고객, 프리미엄 구매 고객, 멤버십 업그레이드 후보', category: 'Membership Drop', benefit: '단독 구성, 우선 구매권, 추가 적립, 한정 사은품', message: '멤버에게만 열리는 프라이빗 구매 기회입니다.', expectedEffect: '멤버십 가입 급증, 고가 상품 전환, 커뮤니티 화제성 증가', risk: '접속 지연, 수량 부족, 비회원 반발', buzz: '높음', difficulty: '높음', channels: ['앱', '푸시', '라이브'], teams: ['멤버십', 'MD', '개발', 'CRM', 'CS'], copy: { banner: '멤버십 프라이빗 드롭 오픈', push: '지금 멤버 전용 드롭에 입장하세요.', live: '남은 수량은 멤버 전용으로만 판매됩니다.' }, checklist: ['대기열/접속 안정성 점검', '구매 제한 수량 설정', '비회원 전환 경로 제공', '품절 안내 문구 사전 준비']
    }
  },
  'limited-goods': {
    stable: {
      title: '브랜드 위크 한정 굿즈', concept: '브랜드 위크 기간 구매 고객에게 한정 굿즈를 증정하는 안정형 프로모션', target: '브랜드 팬, 최근 해당 브랜드 조회 고객, 선물 구매 고객', category: 'Limited Goods', benefit: '구매 금액별 굿즈, 브랜드 단독 쿠폰, 기간 한정 구성', message: '이번 브랜드 위크에서만 받을 수 있는 굿즈를 준비했습니다.', expectedEffect: '객단가 상승, 브랜드 페이지 방문, 반복 구매 증가', risk: '굿즈 매력도가 낮으면 반응 약함', buzz: '중간', difficulty: '중간', channels: ['앱기획전', '브랜드관', '푸시'], teams: ['브랜드MD', '디자인', 'CRM', '물류', 'CS'], copy: { banner: '브랜드 위크 한정 굿즈 증정', push: '좋아한 브랜드의 한정 굿즈가 열렸어요.', live: '지금 구매하면 브랜드 굿즈를 함께 받을 수 있어요.' }, checklist: ['굿즈 이미지 선명하게 노출', '증정 기준 단순화', '조기 소진 안내 필수', '브랜드 페이지 동선 연결']
    },
    aggressive: {
      title: '넘버링 한정 드롭', concept: '수량과 번호가 보이는 한정 굿즈를 드롭 방식으로 판매하거나 증정', target: '팬덤 고객, 컬렉터, SNS 인증 성향 고객', category: 'Limited Drop', benefit: '넘버링 굿즈, 선착순 구매권, 드롭 알림, 인증 이벤트', message: '정해진 수량만 열립니다. 내 번호가 있는 굿즈를 잡아보세요.', expectedEffect: '알림 신청, 빠른 품절, SNS 공유 증가', risk: '되팔이, 품절 불만, 운영 복잡도', buzz: '높음', difficulty: '높음', channels: ['앱', 'SNS', '라이브'], teams: ['브랜드MD', '운영', '개발', 'CRM', 'CS', '법무'], copy: { banner: '단 한 번 열리는 넘버링 드롭', push: '한정 수량 드롭이 곧 시작됩니다.', live: '지금 남은 번호의 굿즈를 확인하세요.' }, checklist: ['1인 구매 제한 설정', '리셀 방지 문구 포함', '재고/번호 매칭 검수', '인증 이벤트 운영 기준 마련']
    }
  },
  'ai-curation': {
    stable: {
      title: '이유가 보이는 추천딜', concept: 'AI라는 표현을 전면에 내세우기보다 고객 행동과 가격 근거를 짧게 보여주는 추천 큐레이션', target: '탐색 피로 고객, 장바구니 보유 고객, 가격 비교 고객', category: 'Recommendation', benefit: '관심 카테고리 추천, 가격/혜택 근거 표시, 쿠폰 적용가 안내', message: '왜 추천됐는지 보고, 필요한 딜만 빠르게 고르세요.', expectedEffect: '추천 클릭률, 장바구니 전환, 쿠폰 사용률 상승', risk: '추천 이유가 부정확하면 신뢰 하락', buzz: '중간', difficulty: '중간', channels: ['앱홈', '검색결과', '기획전'], teams: ['데이터', 'CRM', '프로덕트', 'MD', 'UX'], copy: { banner: '나에게 맞는 이유 있는 추천딜', push: '최근 본 상품 기준으로 혜택 좋은 딜을 골랐어요.', live: '이 상품은 최근 관심 카테고리와 혜택 조건을 기준으로 추천됐어요.' }, checklist: ['추천 사유 1줄 표시', '과한 AI 표현 금지', '쿠폰 적용가 명확화', '추천 제외/관심 없음 옵션 제공']
    },
    aggressive: {
      title: '내 장바구니 혜택 재계산', concept: '장바구니와 최근 탐색 상품을 기준으로 지금 받을 수 있는 최적 혜택 조합을 제안', target: '장바구니 이탈 고객, 쿠폰 미사용 고객, 고가 상품 고민 고객', category: 'Smart Deal Curation', benefit: '쿠폰 조합 추천, 대체 상품 제안, 혜택 만료 알림', message: '담아둔 상품의 혜택을 다시 계산했습니다.', expectedEffect: '장바구니 회수, 쿠폰 적용률, 구매 전환 상승', risk: '가격 비교 표현이 과하면 민원 가능', buzz: '높음', difficulty: '높음', channels: ['앱', 'SNS', '콘텐츠'], teams: ['데이터', '프로덕트', 'CRM', '결제', '법무/정책'], copy: { banner: '장바구니 혜택 다시 계산하기', push: '담아둔 상품에 적용 가능한 혜택이 생겼어요.', live: '지금 적용하면 결제 금액을 더 낮출 수 있어요.' }, checklist: ['할인 근거와 계산식 단순 표시', '민감한 추론 표현 배제', '만료 쿠폰 자동 제외', '가격 변동 안내 문구 검수']
    }
  },
  'ugc-review': {
    stable: {
      title: '구매 후 리뷰 미션', concept: '라이브나 한정 구매 후 리뷰, 사진 인증을 유도하는 보조형 리워드', target: '라이브 구매자, 한정 굿즈 수령자, 리뷰 작성 가능 고객', category: 'UGC Mission', benefit: '리뷰 적립금, 사진 리뷰 추가 보상, 다음 구매 쿠폰', message: '구매 후기를 남기면 다음 혜택이 이어집니다.', expectedEffect: '리뷰 수 증가, 상품 신뢰 보강, 재구매 유도', risk: '보상 목적의 저품질 리뷰 증가', buzz: '낮음~중간', difficulty: '낮음', channels: ['마이페이지', '푸시', '구매완료 페이지'], teams: ['CRM', '리뷰운영', 'CS', 'MD', '정책'], copy: { banner: '리뷰 남기고 다음 혜택 받기', push: '구매하신 상품 리뷰를 남기면 혜택을 드려요.', live: '라이브 구매 후 리뷰 미션에 참여해보세요.' }, checklist: ['리뷰 품질 기준 안내', '사진 리뷰 보상 분리', '허위 리뷰 방지 문구 포함', '보상 지급 일정 명확화']
    },
    aggressive: {
      title: '실시간 인증 릴레이', concept: '라이브 구매자와 한정 드롭 참여자가 인증을 올리면 릴레이 화면과 혜택으로 연결', target: '라이브 참여자, 굿즈 구매자, SNS 공유 성향 고객', category: 'UGC Live Activation', benefit: '인증 리워드, 베스트 인증 추가 쿠폰, 다음 드롭 우선 알림', message: '구매 인증을 남기면 다음 혜택과 우선 알림을 받을 수 있습니다.', expectedEffect: '실시간 댓글, SNS 확산, 다음 행사 알림 신청 증가', risk: '개인정보 노출, 부적절 콘텐츠 관리 필요', buzz: '높음', difficulty: '높음', channels: ['SNS', '앱', '브랜드관'], teams: ['라이브커머스', 'CRM', '커뮤니티운영', 'CS', '법무/개인정보'], copy: { banner: '구매 인증 릴레이 참여하기', push: '인증 남기고 다음 드롭 알림을 먼저 받아보세요.', live: '지금 인증하면 베스트 인증 혜택에 참여할 수 있어요.' }, checklist: ['개인정보 마스킹 안내', '이미지 검수 프로세스 준비', '부적절 콘텐츠 신고 기능 확인', '외부 공유 동의 분리']
    }
  }
};

function ideaProperties(template, trendPageId, mode) {
  return {
    Name: titleProp(template.title),
    Trend: relationProp(trendPageId),
    Mode: selectProp(mode),
    Status: selectProp(STATUS.PUBLISHED),
    Concept: richTextProp(template.concept),
    Target: richTextProp(template.target),
    Category: richTextProp(template.category),
    Benefit: richTextProp(template.benefit),
    Message: richTextProp(template.message),
    Channels: multiSelectProp(template.channels),
    'Expected Effect': richTextProp(template.expectedEffect),
    Risk: richTextProp(template.risk),
    Buzz: selectProp(template.buzz),
    Difficulty: selectProp(template.difficulty),
    'Banner Copy': richTextProp(template.copy.banner),
    'Push Copy': richTextProp(template.copy.push),
    'Live Copy': richTextProp(template.copy.live),
    Checklist: richTextProp(template.checklist.join('\n')),
    Teams: multiSelectProp(template.teams)
  };
}

async function patchPage(pageId, properties, dryRun) {
  if (dryRun) return;
  await notion(`/pages/${pageId}`, { method: 'PATCH', body: { properties } });
  await sleep(350);
}

async function main() {
  const args = parseArgs();
  await loadDotEnv();
  const db = await loadConfig();

  const weeks = (await queryDatabase(db.weeks, {
    filter: { property: 'Status', select: { equals: STATUS.PUBLISHED } },
    sorts: [{ property: 'Start Date', direction: 'descending' }]
  })).filter((page) => select(page, 'Status') === STATUS.PUBLISHED);
  if (!weeks.length) throw new Error('No Published weeks found in Notion');
  const selectedWeek = weeks[0];

  const trendPages = (await queryDatabase(db.trends, {
    filter: { property: 'Status', select: { equals: STATUS.PUBLISHED } },
    sorts: [{ property: 'Sort Order', direction: 'ascending' }]
  })).filter((page) => relationIds(page, 'Week').includes(selectedWeek.id));
  const trendMap = new Map(trendPages.map((page) => [richText(page, 'Trend ID'), { page, pageId: page.id, trendId: richText(page, 'Trend ID'), name: title(page) }]));
  const trendByPageId = new Map(Array.from(trendMap.values()).map((trend) => [trend.pageId, trend]));

  const evidencePages = (await queryDatabase(db.evidence, {
    filter: { or: [
      { property: 'Status', select: { equals: STATUS.DRAFT } },
      { property: 'Status', select: { equals: STATUS.PUBLISHED } },
      { property: 'Status', select: { equals: STATUS.ARCHIVED } }
    ] },
    sorts: [{ property: 'Evidence Date', direction: 'descending' }]
  })).filter((page) => relationIds(page, 'Trend').some((id) => trendByPageId.has(id)));

  const ideaPages = (await queryDatabase(db.ideas, {
    filter: { or: [
      { property: 'Status', select: { equals: STATUS.DRAFT } },
      { property: 'Status', select: { equals: STATUS.PUBLISHED } }
    ] }
  })).filter((page) => relationIds(page, 'Trend').some((id) => trendByPageId.has(id)));

  const ideaByTrendMode = new Map();
  for (const page of ideaPages) {
    const trendId = relationIds(page, 'Trend').map((id) => trendByPageId.get(id)?.trendId).find(Boolean);
    const mode = select(page, 'Mode');
    if (trendId && MODE_ORDER.includes(mode)) ideaByTrendMode.set(`${trendId}:${mode}`, page);
  }

  const plans = [];
  const seenClusters = new Set();
  const publishedClusterSeen = new Set();

  for (const page of evidencePages) {
    const evidence = {
      page,
      pageId: page.id,
      title: title(page),
      source: richText(page, 'Source'),
      summary: richText(page, 'Summary'),
      status: select(page, 'Status'),
      type: select(page, 'Type'),
      date: dateStart(page, 'Evidence Date'),
      url: url(page, 'URL')
    };

    if (evidence.status === STATUS.ARCHIVED) continue;
    if (isSampleEvidence(evidence)) {
      plans.push({ pageId: page.id, action: 'archive', reason: 'initial sample evidence replaced by current crawler evidence', title: evidence.title });
      continue;
    }

    const classification = classifyEvidence(evidence, trendMap);
    if (classification.action === 'archive') {
      if (evidence.status !== STATUS.ARCHIVED) plans.push({ pageId: page.id, action: 'archive', reason: classification.reason, title: evidence.title });
      continue;
    }
    if (!classification.trend) {
      plans.push({ pageId: page.id, action: 'archive', reason: 'matched trend is not Published in latest week', title: evidence.title });
      continue;
    }

    const key = clusterKey(evidence, classification);
    if (publishedClusterSeen.has(key) || (evidence.status !== STATUS.PUBLISHED && seenClusters.has(key))) {
      plans.push({ pageId: page.id, action: 'archive', reason: `duplicate signal cluster: ${key}`, title: evidence.title });
      continue;
    }
    seenClusters.add(key);
    if (evidence.status === STATUS.PUBLISHED) publishedClusterSeen.add(key);

    plans.push({
      pageId: page.id,
      action: 'publish',
      title: evidence.title,
      source: evidence.source,
      trendId: classification.trend.trendId,
      trendPageId: classification.trend.pageId,
      summary: classification.summary
    });
  }

  for (const plan of plans) {
    if (plan.action === 'archive') {
      await patchPage(plan.pageId, {
        Status: selectProp(STATUS.ARCHIVED),
        Summary: richTextProp(`Archived by automated trend curation: ${plan.reason}`)
      }, args.dryRun);
    } else if (plan.action === 'publish') {
      await patchPage(plan.pageId, {
        Status: selectProp(STATUS.PUBLISHED),
        Trend: relationProp(plan.trendPageId),
        Summary: richTextProp(plan.summary)
      }, args.dryRun);
    }
  }

  const trendUpdatePlans = [];
  for (const [trendId, content] of Object.entries(trendContent)) {
    const trend = trendMap.get(trendId);
    if (!trend) continue;
    trendUpdatePlans.push({ trendId, pageId: trend.pageId });
    await patchPage(trend.pageId, {
      Summary: richTextProp(content.summary),
      'AI Consumer Insight': richTextProp(content.consumer),
      'AI Opportunity': richTextProp(content.opportunity),
      'AI Caution': richTextProp(content.caution),
      Momentum: numberProp(content.scores.momentum),
      'OnStyle Fit': numberProp(content.scores.onstyleFit),
      Risk: numberProp(content.scores.risk)
    }, args.dryRun);
  }

  const ideaUpdatePlans = [];
  for (const [trendId, modes] of Object.entries(ideaTemplates)) {
    const trend = trendMap.get(trendId);
    if (!trend) continue;
    for (const mode of MODE_ORDER) {
      const page = ideaByTrendMode.get(`${trendId}:${mode}`);
      if (!page) {
        ideaUpdatePlans.push({ trendId, mode, action: 'missing' });
        continue;
      }
      ideaUpdatePlans.push({ trendId, mode, action: 'update', pageId: page.id, title: modes[mode].title });
      await patchPage(page.id, ideaProperties(modes[mode], trend.pageId, mode), args.dryRun);
    }
  }

  const summary = {
    dryRun: args.dryRun,
    weekId: richText(selectedWeek, 'Week ID'),
    evidence: {
      planned: plans.length,
      publish: plans.filter((plan) => plan.action === 'publish').length,
      archive: plans.filter((plan) => plan.action === 'archive').length
    },
    trendsUpdated: trendUpdatePlans.length,
    ideasUpdated: ideaUpdatePlans.filter((plan) => plan.action === 'update').length,
    missingIdeas: ideaUpdatePlans.filter((plan) => plan.action === 'missing')
  };

  if (args.json) {
    console.log(JSON.stringify({ ...summary, plans: plans.slice(0, 60), ideaPlans: ideaUpdatePlans }, null, 2));
  } else {
    console.log(`Curated week ${summary.weekId}: publish=${summary.evidence.publish}, archive=${summary.evidence.archive}, trends=${summary.trendsUpdated}, ideas=${summary.ideasUpdated}`);
  }

  if (summary.missingIdeas.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
