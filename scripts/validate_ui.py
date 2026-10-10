#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
class P(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.stack=[];self.tab=[];self.view=[];self.chat_path=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);self.stack.append((tag,a.get('class','')))
        if 'id' in a:self.ids.append(a['id'])
        if 'data-tab' in a:self.tab.append(a['data-tab'])
        if 'data-view' in a:self.view.append(a['data-view'])
        if a.get('id')=='chatWindow':self.chat_path=list(self.stack)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:self.stack=self.stack[:i];break
p=P();p.feed((ROOT/'index.html').read_text())
assert len(p.ids)==len(set(p.ids)), 'duplicate ids'
assert p.tab==p.view, (p.tab,p.view)
classes=' '.join(c for _,c in p.chat_path)
assert 'main-pane' in classes and 'side-pane' not in classes, classes
for req in ['chatWindow','chatForm','sourceList','leaderboard','raceCanvas','terminal','experienceView','projectsView','researchView']:
    assert req in p.ids, req
css=(ROOT/'terminal-v2.css').read_text()
assert '.workspace{' in css and '@media(max-width:980px)' in css and '@media(max-width:640px)' in css
for px in re.findall(r'font-size:(\d+)px',css):
    assert int(px)>=9, f'text below 9px: {px}'
champ=json.loads((ROOT/'neat-champions-v5.json').read_text())
v=champ['validation'];assert v['total_grass_s']==0 and v['total_wall_hits']==0 and v['total_collisions']==0 and v['force_field_assists']==0,v
assert champ['input_count']==20 and len(champ['drivers'])>=9
print('UI_STRUCTURE_OK')
print('tabs',len(p.tab),'min_font_px',min(map(int,re.findall(r'font-size:(\d+)px',css))))
print('race_validation',v)
