import os
import json
import urllib.request
import urllib.error
import time
import re
import subprocess
from pathlib import Path

ROOT = Path(r'D:/OneDrive - CJWorld/CJ/1.Project/promotion-trend-mvp')
# Parent: 프로모션 관련 PMO 과제 리스트 정리
PARENT_PAGE_ID = '31e09436-3524-8029-bd9d-e22ee4c1bf96'
CONFIG_PATH = ROOT / 'config/notion-data-sources.json'
EXISTING_CONFIG = json.loads(CONFIG_PATH.read_text(encoding='utf-8')) if CONFIG_PATH.exists() else {}
KEYNAME = 'NOTION' + '_API_KEY'

for p in [Path.home() / '.hermes/.env', Path.home() / 'AppData/Local/hermes/.env']:
    if p.exists():
        for line in p.read_text(encoding='utf-8', errors='ignore').splitlines():
            if '=' in line:
                k, v = line.split('=', 1)
                if k == KEYNAME and not os.environ.get(KEYNAME):
                    os.environ[KEYNAME] = v.strip().strip('"')

KEY = os.environ.get(KEYNAME)
if not KEY:
    raise SystemExit('NOTION_API_KEY is missing')

HEADERS = {
    'Authorization': f'Bearer {KEY}',
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
}


def api(path, method='GET', body=None):
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request('https://api.notion.com/v1' + path, data=data, method=method, headers=HEADERS)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode('utf-8')
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode('utf-8', errors='ignore')
            if e.code == 429 and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise RuntimeError(f'{method} {path} -> {e.code}: {raw}')


def rich(text):
    return [{'type': 'text', 'text': {'content': str(text)}}]


def title_prop(text):
    return {'title': rich(text)[:1]}


def rt_prop(text):
    return {'rich_text': rich(str(text)[:1900]) if text is not None else []}


def select_prop(name):
    return {'select': {'name': name}} if name else {'select': None}


def ms_prop(items):
    return {'multi_select': [{'name': str(x)} for x in (items or [])]}


def num_prop(n):
    return {'number': n}


def url_prop(u):
    return {'url': u if u and u != '#' else None}


def date_prop(d):
    return {'date': {'start': d}} if d else {'date': None}


def relation_prop(page_id):
    return {'relation': [{'id': page_id}]} if page_id else {'relation': []}


def page_title(item):
    props = item.get('properties') or {}
    for v in props.values():
        if isinstance(v, dict) and v.get('type') == 'title':
            return ''.join(t.get('plain_text', '') for t in v.get('title', []))
    return ''.join(t.get('plain_text', '') for t in item.get('title', []))


def search_exact(query, object_type=None):
    res = api('/search', 'POST', {'query': query, 'page_size': 25}).get('results', [])
    return [x for x in res if page_title(x) == query and (object_type is None or x.get('object') == object_type)]


hub_title = 'Promotion Trend AI Planner Data Hub'
if EXISTING_CONFIG.get('hub_page_id'):
    hub = api('/pages/' + EXISTING_CONFIG['hub_page_id'])
else:
    existing = search_exact(hub_title, 'page')
    if existing:
        hub = existing[0]
    else:
        hub = api('/pages', 'POST', {
            'parent': {'page_id': PARENT_PAGE_ID},
            'properties': {'title': title_prop(hub_title)},
            'children': [
                {
                    'object': 'block',
                    'type': 'paragraph',
                    'paragraph': {
                        'rich_text': rich('프로모션 트렌드 AI Planner의 웹 배포용 Notion CMS/데이터 허브입니다. GitHub Actions가 이 DB들을 읽어 정적 JSON으로 변환하고 GitHub Pages 웹에 반영합니다.')
                    },
                },
                {
                    'object': 'block',
                    'type': 'callout',
                    'callout': {
                        'icon': {'type': 'emoji', 'emoji': '🔐'},
                        'rich_text': rich('Notion API 토큰은 웹에 노출하지 않고 GitHub Secrets에서만 사용합니다. 웹은 생성된 JSON만 읽습니다.'),
                    },
                },
            ],
        })
print('HUB', hub['id'], hub.get('url'))


def create_db(title, properties, config_key=None):
    configured_id = (EXISTING_CONFIG.get('databases') or {}).get(config_key or '')
    if configured_id:
        db = api('/databases/' + configured_id)
        print('DB_CONFIG', title, db['id'])
        return db
    ex = search_exact(title, 'database')
    if ex:
        print('DB_EXISTS', title, ex[0]['id'])
        return ex[0]
    db = api('/databases', 'POST', {
        'parent': {'page_id': hub['id']},
        'title': rich(title),
        'properties': properties,
    })
    print('DB_CREATED', title, db['id'])
    time.sleep(0.4)
    return db


status_opts = [
    {'name': 'Draft', 'color': 'gray'},
    {'name': 'Published', 'color': 'green'},
    {'name': 'Archived', 'color': 'red'},
]
week_db = create_db('[PTAI] Weeks', {
    'Name': {'title': {}},
    'Week ID': {'rich_text': {}},
    'Label': {'rich_text': {}},
    'Status': {'select': {'options': status_opts}},
    'Start Date': {'date': {}},
    'End Date': {'date': {}},
    'Notes': {'rich_text': {}},
}, 'weeks')
trend_db = create_db('[PTAI] Trend Topics', {
    'Name': {'title': {}},
    'Trend ID': {'rich_text': {}},
    'Week': {'relation': {'database_id': week_db['id'], 'single_property': {}}},
    'Status': {'select': {'options': status_opts}},
    'Summary': {'rich_text': {}},
    'Keywords': {'multi_select': {}},
    'Channels': {'multi_select': {'options': [{'name': x, 'color': 'blue'} for x in ['SNS', '검색', '기사', '경쟁사']]}},
    'Categories': {'multi_select': {}},
    'Promotion Types': {'multi_select': {}},
    'Mode Bias': {'select': {'options': [{'name': 'stable', 'color': 'blue'}, {'name': 'aggressive', 'color': 'orange'}]}},
    'Momentum': {'number': {'format': 'number'}},
    'OnStyle Fit': {'number': {'format': 'number'}},
    'Risk': {'number': {'format': 'number'}},
    'Sort Order': {'number': {'format': 'number'}},
}, 'trends')
evidence_db = create_db('[PTAI] Evidence Items', {
    'Name': {'title': {}},
    'Trend': {'relation': {'database_id': trend_db['id'], 'single_property': {}}},
    'Type': {'select': {'options': [{'name': '기사', 'color': 'green'}, {'name': '검색', 'color': 'blue'}, {'name': 'SNS', 'color': 'purple'}, {'name': '경쟁사', 'color': 'orange'}]}},
    'Source': {'rich_text': {}},
    'Evidence Date': {'date': {}},
    'URL': {'url': {}},
    'Summary': {'rich_text': {}},
    'Status': {'select': {'options': status_opts}},
}, 'evidence')
idea_db = create_db('[PTAI] Promotion Ideas', {
    'Name': {'title': {}},
    'Trend': {'relation': {'database_id': trend_db['id'], 'single_property': {}}},
    'Mode': {'select': {'options': [{'name': 'stable', 'color': 'blue'}, {'name': 'aggressive', 'color': 'orange'}]}},
    'Status': {'select': {'options': status_opts}},
    'Concept': {'rich_text': {}},
    'Target': {'rich_text': {}},
    'Category': {'rich_text': {}},
    'Benefit': {'rich_text': {}},
    'Message': {'rich_text': {}},
    'Channels': {'multi_select': {}},
    'Expected Effect': {'rich_text': {}},
    'Risk': {'rich_text': {}},
    'Buzz': {'select': {}},
    'Difficulty': {'select': {}},
    'Banner Copy': {'rich_text': {}},
    'Push Copy': {'rich_text': {}},
    'Live Copy': {'rich_text': {}},
    'Checklist': {'rich_text': {}},
    'Teams': {'multi_select': {}},
}, 'ideas')

# Extract current sample data from backed-up prototype and seed it once.
backups = sorted((ROOT / 'backup').glob('index_*_before_react_migration.html'))
trends = []
if backups:
    html = backups[-1].read_text(encoding='utf-8')
    match = re.search(r'const trendData = ([\s\S]*?);\n\n    const filterOptions', html)
    if match:
        js = f"const trendData = {match.group(1)}; console.log(JSON.stringify(trendData));"
        cp = subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=str(ROOT), timeout=30)
        if cp.returncode == 0:
            trends = json.loads(cp.stdout)
print('SAMPLE_TRENDS', len(trends))


def query_db(dbid, filter_body=None):
    body = {'page_size': 100}
    if filter_body:
        body['filter'] = filter_body
    return api(f'/databases/{dbid}/query', 'POST', body).get('results', [])


week_id = '2026-W25'
week_pages = query_db(week_db['id'], {'property': 'Week ID', 'rich_text': {'equals': week_id}})
if week_pages:
    week_page = week_pages[0]
    print('WEEK_EXISTS', week_page['id'])
else:
    week_page = api('/pages', 'POST', {'parent': {'database_id': week_db['id']}, 'properties': {
        'Name': title_prop('2026-W25 · 2026.06.17 - 2026.06.23'),
        'Week ID': rt_prop(week_id),
        'Label': rt_prop('2026.06.17 - 2026.06.23'),
        'Status': select_prop('Published'),
        'Start Date': date_prop('2026-06-17'),
        'End Date': date_prop('2026-06-23'),
        'Notes': rt_prop('Phase 1 MVP 기준 샘플 데이터. 실제 수집 데이터로 교체 가능.'),
    }})
    print('WEEK_CREATED', week_page['id'])
    time.sleep(0.35)

existing_trends = {}
for p in query_db(trend_db['id']):
    vals = p.get('properties', {}).get('Trend ID', {}).get('rich_text', [])
    if vals:
        existing_trends[vals[0].get('plain_text', '')] = p

created_trends = created_evidence = created_ideas = 0
for idx, t in enumerate(trends, start=1):
    tp = existing_trends.get(t['id'])
    is_new = False
    if not tp:
        tp = api('/pages', 'POST', {'parent': {'database_id': trend_db['id']}, 'properties': {
            'Name': title_prop(t['name']),
            'Trend ID': rt_prop(t['id']),
            'Week': relation_prop(week_page['id']),
            'Status': select_prop('Published'),
            'Summary': rt_prop(t['summary']),
            'Keywords': ms_prop(t.get('keywords')),
            'Channels': ms_prop(t.get('channels')),
            'Categories': ms_prop(t.get('categories')),
            'Promotion Types': ms_prop(t.get('promotionTypes')),
            'Mode Bias': select_prop(t.get('modeBias')),
            'Momentum': num_prop(t['scores']['momentum']),
            'OnStyle Fit': num_prop(t['scores']['onstyleFit']),
            'Risk': num_prop(t['scores']['risk']),
            'Sort Order': num_prop(idx),
        }})
        is_new = True
        created_trends += 1
        time.sleep(0.35)
    if is_new:
        for e in t.get('evidence', []):
            api('/pages', 'POST', {'parent': {'database_id': evidence_db['id']}, 'properties': {
                'Name': title_prop(e['title']),
                'Trend': relation_prop(tp['id']),
                'Type': select_prop(e['type']),
                'Source': rt_prop(e.get('source', '')),
                'Evidence Date': date_prop(e.get('date')),
                'URL': url_prop(e.get('url')),
                'Summary': rt_prop(e.get('summary', '')),
                'Status': select_prop('Published'),
            }})
            created_evidence += 1
            time.sleep(0.35)
        for mode in ['stable', 'aggressive']:
            idea = t['ideas'][mode]
            api('/pages', 'POST', {'parent': {'database_id': idea_db['id']}, 'properties': {
                'Name': title_prop(idea['title']),
                'Trend': relation_prop(tp['id']),
                'Mode': select_prop(mode),
                'Status': select_prop('Published'),
                'Concept': rt_prop(idea.get('concept', '')),
                'Target': rt_prop(idea.get('target', '')),
                'Category': rt_prop(idea.get('category', '')),
                'Benefit': rt_prop(idea.get('benefit', '')),
                'Message': rt_prop(idea.get('message', '')),
                'Channels': ms_prop(idea.get('channels')),
                'Expected Effect': rt_prop(idea.get('expectedEffect', '')),
                'Risk': rt_prop(idea.get('risk', '')),
                'Buzz': select_prop(idea.get('buzz', '')),
                'Difficulty': select_prop(idea.get('difficulty', '')),
                'Banner Copy': rt_prop(idea.get('copy', {}).get('banner', '')),
                'Push Copy': rt_prop(idea.get('copy', {}).get('push', '')),
                'Live Copy': rt_prop(idea.get('copy', {}).get('live', '')),
                'Checklist': rt_prop('\n'.join(idea.get('checklist', []))),
                'Teams': ms_prop(idea.get('teams')),
            }})
            created_ideas += 1
            time.sleep(0.35)

summary = {
    'hub_page_id': hub['id'],
    'hub_url': hub.get('url'),
    'parent_page_id': PARENT_PAGE_ID,
    'databases': {
        'weeks': week_db['id'],
        'trends': trend_db['id'],
        'evidence': evidence_db['id'],
        'ideas': idea_db['id'],
    },
    'seeded': {
        'trends_created': created_trends,
        'evidence_created': created_evidence,
        'ideas_created': created_ideas,
    },
}
print('SUMMARY_JSON')
print(json.dumps(summary, ensure_ascii=False, indent=2))
config_dir = ROOT / 'config'
config_dir.mkdir(exist_ok=True)
(config_dir / 'notion-data-sources.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
