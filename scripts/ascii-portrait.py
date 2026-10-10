"""Render the supplied portrait as colored, selectable SVG text."""
import argparse
from html import escape
from pathlib import Path
from PIL import Image, ImageEnhance

p=argparse.ArgumentParser()
p.add_argument('source');p.add_argument('output');args=p.parse_args()
image=Image.open(args.source).convert('RGB')
image=ImageEnhance.Contrast(image).enhance(1.18)
cols,rows=64,40
image=image.resize((cols,rows),Image.Resampling.LANCZOS)
ramp=' .,:;irsXA253hMHGS#9B&@'
lines=['<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" role="img" aria-labelledby="title"><title id="title">Arman Doğru — colored ASCII portrait</title><rect width="320" height="320" fill="#11111b"/><g font-family="Menlo,Consolas,monospace" font-size="8" font-weight="700">']
for y in range(rows):
    for x in range(cols):
        r,g,b=image.getpixel((x,y));lum=.2126*r+.7152*g+.0722*b
        char=ramp[min(len(ramp)-1,int((lum/255)**.72*(len(ramp)-1)))]
        # Brighter ink preserves the actual photograph's color on a terminal background.
        color=f'#{min(255,int(r*1.18+20)):02x}{min(255,int(g*1.18+20)):02x}{min(255,int(b*1.18+20)):02x}'
        lines.append(f'<text x="{x*5}" y="{y*8+7}" fill="{color}">{escape(char)}</text>')
lines.append('</g></svg>')
Path(args.output).write_text('\n'.join(lines))
