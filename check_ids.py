import re

with open('bis_home.html', 'r', encoding='utf-8') as f:
    content = f.read()

for m in re.finditer(r'stdCard\S*', content):
    s = max(0, m.start()-30)
    e = min(len(content), m.end()+30)
    print(content[s:e].strip())
    print('---')
