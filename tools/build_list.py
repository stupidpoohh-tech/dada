#!/usr/bin/env python3
"""services.json으로 list.html·sitemap.xml을 만든다.

마을은 JS로 그려지므로 크롤러와 스크린리더에게는 빈 페이지다 (본문 74자, 항목
이름이 하나도 없다). 검색으로 이 사이트에 닿을 길이 없고, 링크드인 대체를
노리는 사이트에서 그건 치명적이다. 그래서 같은 데이터를 **HTML에 그대로 박은**
정적 페이지를 하나 둔다. 마을은 경험, /list는 정보로 역할이 갈린다.

빌드 과정이 없는 사이트라 이 스크립트는 손으로 돌린다.
`services.json`을 고쳤으면 함께 돌리고, 안 돌리면 `npm test`가 어긋남을 잡는다.

    python3 tools/build_list.py
"""
import html
import itertools
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((ROOT / 'services.json').read_text(encoding='utf-8'))

SITE = data['site']['url'].rstrip('/')
TYPE_LABEL = {'app': '앱', 'doc': '문서', 'video': '영상', 'external': '외부'}
STATUS_LABEL = {'beta': '베타', 'demo': 'demo', 'soon': '준비 중'}

e = html.escape


def href(item):
    """책은 지도 위 팝업으로 열리므로 첫 화면의 해시를 가리킨다."""
    if item.get('open') == 'book':
        return '/#' + item['book']['hash']
    return item.get('url') or item.get('route') or '/'


def short_date(s):
    """데이터는 정렬되게 `2026-05`로 두고, 보이는 곳에서만 짧게 쓴다."""
    return s[2:].replace('-', '.')


def month_label(s):
    return f'{s[:4]}년 {int(s[5:7])}월'


def is_live(item):
    """갈 곳이 있는가. **없으면 링크로 만들지 않는다.**

    href()는 갈 곳이 없을 때 `/`를 내는데, 그러면 「준비 중」인 것을 눌렀을 때
    마을로 튕겨 나간다 — 없는 곳을 가리키는 링크를 두지 않는다는 규칙(app.js와
    같다)이 여기에도 걸린다. 구역 목록과 「만든 순서」 둘 다 이것을 본다.
    """
    return bool(item.get('url') or item.get('route') or item.get('open') == 'book')


def item_html(item):
    ext = item['type'] in ('app', 'external', 'video')   # 영상도 남의 집이라 새 탭
    attrs = ' target="_blank" rel="noopener"' if ext else ''
    live = is_live(item)
    badges = [f'<span class="badge">{e(TYPE_LABEL.get(item["type"], item["type"]))}</span>']
    if item.get('status') in STATUS_LABEL:
        badges.append(f'<span class="badge {item["status"]}">{e(STATUS_LABEL[item["status"]])}</span>')
    if item.get('date'):
        badges.append(f'<time class="doc-date" datetime="{e(item["date"])}">'
                      f'{e(short_date(item["date"]))}</time>')
    # 설명에 줄바꿈을 넣으면 그대로 줄이 나뉜다 (지금 쓰는 항목은 없다).
    # **없을 수도 있다** — 이름만 있고 아직 한 줄을 못 받은 「준비 중」이 그렇다.
    # 예전에는 키가 있다고 믿고 읽다가 그런 항목이 들어온 날 이 도구가 죽었다.
    desc = '<br>'.join(e(line) for line in item.get('description', '').split('\n'))
    title = (f'<a href="{e(href(item))}"{attrs}>{e(item["icon"])} {e(item["name"])}</a>'
             if live else f'{e(item["icon"])} {e(item["name"])}')
    # 설명이 빈 항목은 빈 문단을 남기지 않는다 — 아직 한 줄을 못 받은 것뿐이다
    body = f'\n        <p>{desc}</p>' if desc else ''
    return f'''      <article class="doc-item">
        <h3>{title}
          {' '.join(badges)}</h3>{body}
      </article>'''


sections = []
for d in data['districts']:
    items = [i for i in data['items'] if i['district'] == d['id']]
    if not items:
        continue
    sections.append(
        f'''    <section class="doc-group" aria-labelledby="g-{d['id']}">
      <h2 id="g-{d['id']}">{e(d['icon'])} {e(d['name'])} <span class="doc-count">{len(items)}</span></h2>
{chr(10).join(item_html(i) for i in items)}
    </section>''')

# 목록 모달은 최근 만든 것부터 늘어놓는다. 같은 순서를 크롤러·스크린리더에게도 준다.
# 구역별 묶음은 이 페이지에만 남는다 — 마을 지도가 구역을 보여주는 곳이라 모달에는 두지 않는다.
# 설명은 위 구역별 목록에 이미 있으므로 여기서는 이름과 시기만 둔다.
dated = sorted((i for i in data['items'] if i.get('date')),
               key=lambda i: i['date'], reverse=True)
blocks = []
for month, group in itertools.groupby(dated, key=lambda i: i['date']):
    # 구역 목록과 같은 규칙이다 — 주소가 없으면 링크로 만들지 않는다.
    # 여기를 빼먹어서 「준비 중」인 것이 `href="/"`로 새 탭에 마을을 여는
    # 죽은 링크가 됐었다. 살아 있는지는 item_html과 똑같이 판정한다
    lis = '\n'.join(
        ('        <li><a href="{}"{}>{} {}</a></li>'.format(
            e(href(i)),
            ' target="_blank" rel="noopener"' if i['type'] in ('app', 'external', 'video') else '',
            e(i['icon']), e(i['name']))
         if is_live(i) else
         '        <li>{} {} <span class="badge soon">{}</span></li>'.format(
             e(i['icon']), e(i['name']), e(STATUS_LABEL['soon'])))
        for i in group)
    blocks.append(f'      <h3 class="doc-sub">{e(month_label(month))}</h3>\n'
                  f'      <ul class="doc-list">\n{lis}\n      </ul>')
timeline = '\n'.join(blocks)
# 목록은 최근 것부터지만 이 문장은 「언제부터 언제까지」라 시간 순서를 지킨다
span = (f'{month_label(dated[-1]["date"])}부터 {month_label(dated[0]["date"])}까지'
        if dated else '')

p = data['profile']
career = '\n'.join(
    f'        <li><strong>{e(c["role"])}</strong> — {e(c["org"])} · {e(c["period"])}</li>'
    for c in p.get('career', []))
edu = '\n'.join(
    f'        <li><strong>{e(x["org"])}</strong> — {e(x["detail"])} · {e(x["period"])}</li>'
    for x in p.get('education', []))

total = len(data['items'])
desc = (f'{p["name"]}이 만든 작업물 {total}가지를 한 목록으로. '
        + ' · '.join(i['name'] for i in data['items'][:5]) + ' 등.')

page = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>작업물 전체 목록 — DADA TOWN</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{SITE}/list.html">
<meta property="og:type" content="website">
<meta property="og:title" content="작업물 전체 목록 — DADA TOWN">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{SITE}/list.html">
<meta property="og:image" content="{SITE}/assets/og/home.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="900">
<meta property="og:site_name" content="DADA TOWN">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏘️</text></svg>">
<link rel="stylesheet" href="styles.css">
<!-- 방문 통계. 켜지는 곳은 ga.js의 HOSTS뿐이다 (localhost에서는 아무것도 하지 않는다) -->
<script src="/ga.js" defer></script>
</head>
<body>

<header class="topbar">
  <div class="brand">
    <h1 class="wordmark"><a href="/">DADA TOWN</a></h1>
    <p class="tagline">{e(data['site']['tagline'])}</p>
  </div>
</header>

<main class="doc">
  <p class="doc-back"><a href="/">← 마을 지도로 돌아가기</a></p>

  <p class="doc-lead">{e(p['name'])}이 만든 것들의 전체 목록입니다. 모두 {total}가지, {e(span)}.
    지도에서 건물을 눌러 둘러볼 수도 있습니다.</p>

{chr(10).join(sections)}

    <section class="doc-group" aria-labelledby="g-time">
      <h2 id="g-time">🧱 만든 순서</h2>
{timeline}
    </section>

    <section class="doc-group" aria-labelledby="g-profile">
      <h2 id="g-profile">🙋 나 — 약력</h2>
      <article class="doc-item">
        <h3>{e(p['name'])}</h3>
        <p>{e(p['tagline'])}</p>
      </article>
      <h3 class="doc-sub">경력</h3>
      <ul class="doc-list">
{career}
      </ul>
      <h3 class="doc-sub">학력</h3>
      <ul class="doc-list">
{edu}
      </ul>
      <p class="doc-contact"><a href="mailto:{e(p['email'])}">{e(p['email'])}</a></p>
    </section>
</main>

<footer class="site-footer">
  <p class="foot-name">{e(p['tagline'])}</p>
  <p class="foot-contact"><a href="mailto:{e(p['email'])}">{e(p['email'])}</a></p>
</footer>

</body>
</html>
'''

(ROOT / 'list.html').write_text(page, encoding='utf-8')

# 사이트 안에 따로 서 있는 페이지(내부 경로를 가진 항목)도 색인에 넣는다.
# 게임 안내서처럼 그 자체가 읽을거리인 페이지는 검색으로 닿을 값이 있다.
inner = sorted({i['url'] for i in data['items']
                if str(i.get('url', '')).startswith('/')})
extra = '\n'.join(
    f'  <url><loc>{SITE}{u}</loc><priority>0.7</priority></url>' for u in inner)

sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{SITE}/</loc><priority>1.0</priority></url>
  <url><loc>{SITE}/list.html</loc><priority>0.8</priority></url>
{extra}
</urlset>
'''
(ROOT / 'sitemap.xml').write_text(sitemap, encoding='utf-8')

(ROOT / 'robots.txt').write_text(
    f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n', encoding='utf-8')

print(f'list.html · sitemap.xml · robots.txt 생성 — 항목 {total}개')
