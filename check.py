import re
html = open('bis_html_dump.html', encoding='utf-8').read()
m = re.search(r'id="Section1"', html, re.IGNORECASE)
if m:
    print(html[m.start()-200:m.end()+1500])
else:
    print('Not found')
