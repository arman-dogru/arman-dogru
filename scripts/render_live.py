#!/usr/bin/env python3
from __future__ import annotations
import collections, datetime as dt, html, json, os, pathlib, urllib.request

USER = "arman-dogru"
OUT = pathlib.Path("assets/live.svg")

def get(url: str):
    headers = {"Accept":"application/vnd.github+json","User-Agent":"arman-dogru-profile-telemetry"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

profile = get(f"https://api.github.com/users/{USER}")
repos = get(f"https://api.github.com/users/{USER}/repos?per_page=100&type=owner&sort=pushed")
now = dt.datetime.now(dt.timezone.utc)
cutoff = now - dt.timedelta(days=90)
active = 0
languages = collections.Counter()
latest = None
for repo in repos:
    pushed = repo.get("pushed_at")
    if pushed:
        when = dt.datetime.fromisoformat(pushed.replace("Z", "+00:00"))
        if when >= cutoff:
            active += 1
    if not repo.get("fork"):
        lang = repo.get("language")
        if lang:
            languages[lang] += 1
        if latest is None:
            latest = repo
latest_name = (latest or {}).get("name", "—")
latest_date = ((latest or {}).get("pushed_at") or "—")[:10]
top_langs = " · ".join(k for k,_ in languages.most_common(3)) or "—"
public_repos = profile.get("public_repos", len(repos))
followers = profile.get("followers", "—")

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="190" viewBox="0 0 1200 190" role="img" aria-label="Live GitHub profile telemetry">
<defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#06111d"/><stop offset="1" stop-color="#090515"/></linearGradient><style>.m{{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}}.v{{fill:#47ffdf;font-size:26px;font-weight:700}}.k{{fill:#70859f;font-size:11px;letter-spacing:2px}}.s{{fill:#b286ff;font-size:14px}}</style></defs>
<rect width="1200" height="190" rx="18" fill="url(#g)" stroke="#47ffdf" stroke-opacity=".18"/>
<text class="m" x="34" y="35" fill="#dce9f8" font-size="14" letter-spacing="3">PROFILE TELEMETRY // AUTO-SYNCED BY GITHUB ACTIONS</text>
<circle cx="18" cy="30" r="4" fill="#47ffdf"/>
<g class="m"><text class="k" x="34" y="82">PUBLIC REPOS</text><text class="v" x="34" y="117">{public_repos}</text>
<text class="k" x="220" y="82">ACTIVE / 90D</text><text class="v" x="220" y="117">{active}</text>
<text class="k" x="405" y="82">FOLLOWERS</text><text class="v" x="405" y="117">{followers}</text>
<text class="k" x="590" y="82">PRIMARY LANGUAGES</text><text class="s" x="590" y="113">{html.escape(top_langs)}</text>
<text class="k" x="34" y="158">LATEST ORIGINAL REPO PUSH</text><text class="s" x="265" y="158">{html.escape(latest_name)}  //  {latest_date}</text></g>
</svg>'''
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(svg, encoding="utf-8")
