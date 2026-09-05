from bs4 import BeautifulSoup

html = open('bis_html_dump.html', encoding='utf-8').read()
soup = BeautifulSoup(html, 'html.parser')

amendments = []
sec1 = soup.select_one('#Section1 table tbody')
if sec1:
    for tr in sec1.select('tr'):
        tds = tr.select('td')
        if len(tds) >= 3:
            amendments.append({
                'number': tds[1].get_text(strip=True),
                'year': tds[2].get_text(strip=True)
            })

print("AMENDMENTS:", amendments)

refs = []
sec8 = soup.select('#Section8 .sidebar__event')
for event in sec8:
    a_tag = event.select_one('a')
    p_tags = event.select('p')
    if a_tag:
        is_num = a_tag.get_text(strip=True)
        title = p_tags[-1].get_text(strip=True) if p_tags else ""
        refs.append({'is_num': is_num, 'title': title})

print(f"REFS: Found {len(refs)}")
for r in refs[:3]:
    print(r)
