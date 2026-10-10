#!/usr/bin/env python3
import html,json,re,sys
from datetime import datetime,timezone
from pathlib import Path

VERSION='neat-race-v1'; TRACK='kanata-loop-v1'

def field(body,name):
    m=re.search(rf'(?mi)^\s*{re.escape(name)}:\s*(.+?)\s*$',body or '')
    return m.group(1).strip() if m else None

def score_formula(ms,pos):
    return max(0,round(1_000_000-ms*10+(4-pos)*25_000))

def esc(s): return html.escape(str(s),quote=True)

def render(entries,updated):
    rows=[]
    if not entries:
        rows.append('<text class="m accent" x="38" y="151" font-size="18">NO VERIFIED FINISHES YET</text>')
        rows.append('<text class="m muted" x="38" y="180" font-size="13">Open the terminal → run “race” → finish 3 laps → submit your score through GitHub.</text>')
    else:
        y=137
        for i,e in enumerate(entries[:7],1):
            name=esc(e.get('display_name') or e['github'])[:24]
            rows.append(f'<text class="m rank" x="42" y="{y}">#{i}</text><text class="m name" x="105" y="{y}">{name}</text><text class="m score" x="760" y="{y}">{int(e["score"]):,}</text><text class="m time" x="1015" y="{y}">{int(e["elapsed_ms"])/1000:.3f}s</text>')
            y+=24
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="330" viewBox="0 0 1200 330" role="img" aria-label="NEAT Grand Prix leaderboard"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#11111b"/><stop offset="1" stop-color="#181825"/></linearGradient><pattern id="p" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#89dceb" stroke-opacity=".035"/></pattern><style>.m{{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}}.title{{fill:#cdd6f4;font-size:22px;font-weight:700}}.sub{{fill:#7f849c;font-size:12px}}.accent{{fill:#a6e3a1}}.muted{{fill:#7f849c}}.rank{{fill:#cba6f7;font-size:14px}}.name{{fill:#cdd6f4;font-size:14px;font-weight:700}}.score{{fill:#a6e3a1;font-size:14px;font-weight:700;text-anchor:end}}.time{{fill:#89dceb;font-size:13px;text-anchor:end}}</style></defs><rect width="1200" height="330" rx="18" fill="url(#g)"/><rect width="1200" height="330" rx="18" fill="url(#p)"/><rect x="1" y="1" width="1198" height="328" rx="17" fill="none" stroke="#45475a"/><text class="m title" x="38" y="52">NEAT GRAND PRIX // GLOBAL LEADERBOARD</text><text class="m sub" x="38" y="78">Three neuroevolved opponents. Best accepted score per GitHub account.</text><line x1="38" y1="105" x2="1162" y2="105" stroke="#45475a"/>{''.join(rows)}<text class="m muted" x="38" y="304" font-size="10">TRACK {TRACK} · GAME {VERSION} · UPDATED {esc(updated)}</text></svg>'''

def main(event_path):
    event=json.loads(Path(event_path).read_text())
    issue=event.get('issue') or {}; body=issue.get('body') or ''; title=issue.get('title') or ''
    if not title.startswith('[RACE SCORE]'): raise SystemExit('not a race score issue')
    version=field(body,'game_version'); track=field(body,'track'); score=int(field(body,'score') or -1); ms=int(field(body,'elapsed_ms') or -1); pos=int(field(body,'position') or -1); display=(field(body,'display_name') or '').strip()[:18]
    if version!=VERSION or track!=TRACK: raise SystemExit('unsupported game version or track')
    if not (20_000<=ms<=300_000 and 1<=pos<=4): raise SystemExit('implausible race result')
    expected=score_formula(ms,pos)
    if score!=expected: raise SystemExit(f'score mismatch: expected {expected}, got {score}')
    author=((issue.get('user') or {}).get('login') or '').strip()
    if not author: raise SystemExit('missing GitHub author')
    path=Path('leaderboard.json'); data=json.loads(path.read_text()) if path.exists() else {'version':VERSION,'track':TRACK,'entries':[]}
    entries=[e for e in data.get('entries',[]) if e.get('github','').lower()!=author.lower()]
    previous=[e for e in data.get('entries',[]) if e.get('github','').lower()==author.lower()]
    candidate={'github':author,'display_name':display or author,'score':score,'elapsed_ms':ms,'position':pos,'submitted':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'issue':issue.get('number')}
    if previous and int(previous[0].get('score',0))>score: candidate=previous[0]
    entries.append(candidate);entries.sort(key=lambda e:(-int(e.get('score',0)),int(e.get('elapsed_ms',10**9)),e.get('github','').lower()));entries=entries[:10]
    updated=datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z');data={'version':VERSION,'track':TRACK,'updated':updated,'entries':entries};path.write_text(json.dumps(data,indent=2)+'\n');Path('assets/race-leaderboard.svg').write_text(render(entries,updated))
    print(json.dumps({'github':author,'score':score,'accepted':True,'rank':next(i+1 for i,e in enumerate(entries) if e.get('github','').lower()==author.lower())}))
if __name__=='__main__': main(sys.argv[1])
