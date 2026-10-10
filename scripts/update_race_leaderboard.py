#!/usr/bin/env python3
import base64,gzip,html,json,os,re,sys,unicodedata
from datetime import datetime,timezone
from pathlib import Path

VERSION='neat-race-v3'; TRACK='istanbul-park-v3'; RACERS=10
BLOCKLIST_ENV='PROFANITY_BLOCKLIST_GZ_B64'
RESERVED=('admin','administrator','moderator','github','system','official','leaderboard','racebot','raceleaderboard','armandogru','nokiabelllabs')
LEET=str.maketrans({'@':'a','4':'a','3':'e','1':'i','!':'i','|':'i','0':'o','5':'s','$':'s','7':'t','+':'t'})
CONFUSABLE=str.maketrans({'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','і':'i','ј':'j','ѕ':'s','Α':'a','Β':'b','Ε':'e','Ζ':'z','Η':'h','Ι':'i','Κ':'k','Μ':'m','Ν':'n','Ο':'o','Ρ':'p','Τ':'t','Χ':'x','Υ':'y','α':'a','β':'b','ε':'e','ι':'i','κ':'k','ο':'o','ρ':'p','τ':'t','χ':'x','υ':'y'})

def field(body,name):
    m=re.search(rf'(?mi)^\s*{re.escape(name)}:\s*(.+?)\s*$',body or '')
    return m.group(1).strip() if m else None

def score_formula(ms,pos): return max(0,round(1_500_000-ms*8+(RACERS-pos)*20_000))
def esc(s): return html.escape(str(s),quote=True)
def clean_text(value):
    s=unicodedata.normalize('NFKC',str(value or ''))
    s=''.join(ch for ch in s if unicodedata.category(ch) not in {'Cc','Cf'})
    return re.sub(r'\s+',' ',s).strip()
def skeleton(value):
    s=clean_text(value).lower().translate(CONFUSABLE).translate(LEET)
    s=''.join(ch for ch in unicodedata.normalize('NFKD',s) if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]','',s)

def load_private_blocklist():
    encoded=os.environ.get(BLOCKLIST_ENV,'').strip()
    if not encoded:
        raise RuntimeError(f'{BLOCKLIST_ENV} is not configured')
    try:
        raw=gzip.decompress(base64.b64decode(encoded,validate=True)).decode('utf-8')
    except Exception as exc:
        raise RuntimeError(f'{BLOCKLIST_ENV} is invalid') from exc
    blocked={skeleton(line) for line in raw.splitlines() if line.strip() and not line.lstrip().startswith('#')}
    blocked.discard('')
    if not blocked:
        raise RuntimeError(f'{BLOCKLIST_ENV} decoded to an empty blocklist')
    return blocked

def is_blocked_name(name,blocked):
    normalized=clean_text(name).lower().translate(CONFUSABLE)
    tokens=[skeleton(token) for token in re.split(r'[\s_.-]+',normalized) if token]
    full=skeleton(normalized)
    if full in blocked or any(token in blocked for token in tokens):
        return True
    for token in tokens:
        for term in blocked:
            if len(term)>=4 and len(token)<=len(term)+2 and (token.startswith(term) or token.endswith(term)):
                return True
    return False

def validate_display_name(value,blocked):
    name=clean_text(value)
    if not 2<=len(name)<=18: raise ValueError('display_name must be 2-18 characters')
    for ch in name:
        if ch in ' _.-': continue
        cat=unicodedata.category(ch)
        if not(cat.startswith('L') or cat.startswith('N')): raise ValueError('display_name contains unsupported characters')
    if not any(unicodedata.category(ch).startswith(('L','N')) for ch in name): raise ValueError('display_name must contain a letter or number')
    if re.search(r'(.)\1{4,}',name,re.I): raise ValueError('display_name has excessive repeated characters')
    sk=skeleton(name)
    if is_blocked_name(name,blocked): raise ValueError('display_name rejected by private content filter')
    if sk in RESERVED or any(sk.startswith(x) and len(sk)<=len(x)+3 for x in RESERVED): raise ValueError('display_name uses a reserved identity')
    if 'http' in sk or 'www' in sk or 'dotcom' in sk: raise ValueError('display_name may not contain links')
    return name

def validate_int(value,name,lo,hi):
    if value is None or not re.fullmatch(r'-?\d+',value): raise ValueError(f'{name} must be an integer')
    n=int(value)
    if not lo<=n<=hi: raise ValueError(f'{name} outside allowed range')
    return n

def render(entries,updated):
    rows=[]
    if not entries:
        rows+=['<text class="m accent" x="38" y="151" font-size="18">NO VERIFIED FINISHES YET</text>','<text class="m muted" x="38" y="180" font-size="13">Open the terminal → race Istanbul Park → finish 3 laps → submit through GitHub.</text>']
    else:
        y=137
        for i,e in enumerate(entries[:8],1):
            name=esc(e.get('display_name') or e['github'])[:30];rows.append(f'<text class="m rank" x="42" y="{y}">#{i}</text><text class="m name" x="105" y="{y}">{name}</text><text class="m score" x="760" y="{y}">{int(e["score"]):,}</text><text class="m time" x="1015" y="{y}">{int(e["elapsed_ms"])/1000:.3f}s</text>');y+=24
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="350" viewBox="0 0 1200 350" role="img" aria-label="NEAT Istanbul Grand Prix leaderboard"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#11111b"/><stop offset="1" stop-color="#181825"/></linearGradient><pattern id="p" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#89dceb" stroke-opacity=".035"/></pattern><style>.m{{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}}.title{{fill:#cdd6f4;font-size:22px;font-weight:700}}.sub{{fill:#7f849c;font-size:12px}}.accent{{fill:#a6e3a1}}.muted{{fill:#7f849c}}.rank{{fill:#cba6f7;font-size:14px}}.name{{fill:#cdd6f4;font-size:14px;font-weight:700}}.score{{fill:#a6e3a1;font-size:14px;font-weight:700;text-anchor:end}}.time{{fill:#89dceb;font-size:13px;text-anchor:end}}</style></defs><rect width="1200" height="350" rx="18" fill="url(#g)"/><rect width="1200" height="350" rx="18" fill="url(#p)"/><rect x="1" y="1" width="1198" height="348" rx="17" fill="none" stroke="#45475a"/><text class="m title" x="38" y="52">ISTANBUL PARK // NEAT GRAND PRIX</text><text class="m sub" x="38" y="78">10-car grid · 3 laps · best accepted score per GitHub account</text><line x1="38" y1="105" x2="1162" y2="105" stroke="#45475a"/>{''.join(rows)}<text class="m muted" x="38" y="326" font-size="10">TRACK {TRACK} · GAME {VERSION} · UPDATED {esc(updated)}</text></svg>'''

def main(event_path):
    blocked=load_private_blocklist()
    event=json.loads(Path(event_path).read_text());issue=event.get('issue') or {};body=issue.get('body') or '';title=clean_text(issue.get('title') or '')
    if len(body)>5000: raise ValueError('issue body too large')
    if not re.fullmatch(r'\[RACE SCORE\] \d{1,8}',title): raise ValueError('invalid race score title')
    if field(body,'game_version')!=VERSION or field(body,'track')!=TRACK: raise ValueError('unsupported game version or track')
    score=validate_int(field(body,'score'),'score',0,2_000_000);ms=validate_int(field(body,'elapsed_ms'),'elapsed_ms',20_000,600_000);pos=validate_int(field(body,'position'),'position',1,RACERS);display=validate_display_name(field(body,'display_name') or '',blocked)
    expected=score_formula(ms,pos)
    if score!=expected: raise ValueError(f'score mismatch: expected {expected}, got {score}')
    author=clean_text((issue.get('user') or {}).get('login') or '')
    if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?',author): raise ValueError('invalid GitHub author')
    path=Path('leaderboard.json');data=json.loads(path.read_text()) if path.exists() else {'version':VERSION,'track':TRACK,'entries':[]};safe=[]
    for e in data.get('entries',[]):
        try:e['display_name']=validate_display_name(e.get('display_name') or e.get('github') or '',blocked);safe.append(e)
        except ValueError:continue
    previous=[e for e in safe if e.get('github','').lower()==author.lower()];entries=[e for e in safe if e.get('github','').lower()!=author.lower()];candidate={'github':author,'display_name':display,'score':score,'elapsed_ms':ms,'position':pos,'submitted':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'issue':issue.get('number')}
    if previous and int(previous[0].get('score',0))>score:candidate=previous[0]
    entries.append(candidate);entries.sort(key=lambda e:(-int(e.get('score',0)),int(e.get('elapsed_ms',10**9)),e.get('github','').lower()));entries=entries[:20]
    updated=datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z');path.write_text(json.dumps({'version':VERSION,'track':TRACK,'updated':updated,'entries':entries},ensure_ascii=False,indent=2)+'\n');Path('assets/race-leaderboard.svg').write_text(render(entries,updated));rank=next(i+1 for i,e in enumerate(entries) if e.get('github','').lower()==author.lower());print(json.dumps({'github':author,'score':score,'accepted':True,'rank':rank}))
if __name__=='__main__':
    try:main(sys.argv[1])
    except Exception as exc:print(f'validation failed: {exc}',file=sys.stderr);raise SystemExit(2)
