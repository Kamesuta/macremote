#!/usr/bin/env python3
"""Renders every app icon from one drawing. Needs Google Chrome (headless) and macOS sips.
Usage: python3 branding/build.py"""
import os, subprocess, tempfile, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
NAVY, SKY, SKY_DK, WHITE = '#0f172a', '#38bdf8', '#0ea5e9', '#ffffff'

CURSOR = 'M0 0 L0 80 L19 63 L32 96 L46 90 L33 58 L60 58 Z'   # classic arrow, 100-unit box

def art(scale=1.0, mono=False):
    """The monitor + pointer, centred on a 1024 canvas. scale<1 leaves room for adaptive-icon masks."""
    if mono:
        body = f'''
  <path fill="{WHITE}" fill-rule="evenodd" d="M230 196h564a54 54 0 0 1 54 54v312a54 54 0 0 1-54 54H230a54 54 0 0 1-54-54V250a54 54 0 0 1 54-54zm10 40a24 24 0 0 0-24 24v292a24 24 0 0 0 24 24h544a24 24 0 0 0 24-24V260a24 24 0 0 0-24-24z"/>
  <path fill="{WHITE}" d="M452 616h120v90H452z"/>
  <rect fill="{WHITE}" x="336" y="696" width="352" height="56" rx="28"/>
  <path transform="translate(500 292) scale(4.4)" fill="{WHITE}" stroke="none" d="{CURSOR}"/>'''
    else:
        body = f'''
  <rect x="176" y="196" width="672" height="420" rx="54" fill="#0b2540" stroke="url(#sky)" stroke-width="36"/>
  <rect x="212" y="232" width="600" height="348" rx="26" fill="url(#glow)"/>
  <path fill="url(#sky)" d="M452 616h120v90H452z"/>
  <rect x="336" y="696" width="352" height="56" rx="28" fill="url(#sky)"/>
  <path transform="translate(500 292) scale(4.4)" d="{CURSOR}" fill="{WHITE}" stroke="{NAVY}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>'''
    return f'<g transform="translate(512 512) scale({scale}) translate(-512 -474)">{body}</g>'

def svg(content, bg=None, size=1024):
    defs = f'''<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{SKY}"/><stop offset="1" stop-color="{SKY_DK}"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#14456f"/><stop offset="1" stop-color="#0b2540"/></radialGradient>
  <radialGradient id="bg" cx=".5" cy=".35" r=".9"><stop offset="0" stop-color="#1c2b4a"/><stop offset="1" stop-color="{NAVY}"/></radialGradient>
</defs>'''
    rect = f'<rect width="1024" height="1024" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024">{defs}{rect}{content}</svg>'

def render(svg_text, out, px, transparent=False):
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, 'a.svg'); open(src, 'w').write(svg_text)
        raw = os.path.join(d, 'raw.png')
        args = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--screenshot={raw}',
                '--window-size=1024,1024', '--force-device-scale-factor=1']
        if transparent: args.append('--default-background-color=00000000')
        subprocess.run(args + ['file://' + src], check=True, capture_output=True)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        if px == 1024: shutil.copy(raw, out)
        else: subprocess.run(['sips', '-z', str(px), str(px), raw, '--out', out], check=True, capture_output=True)
    print('wrote', os.path.relpath(out, ROOT))

full = svg(art(), bg='url(#bg)')
open(os.path.join(ROOT, 'branding/logo.svg'), 'w').write(full)          # the master
M, P = os.path.join(ROOT, 'mobile/assets'), os.path.join(ROOT, 'public')
render(full, f'{M}/icon.png', 1024)                                      # iOS/App Store: full-bleed, no alpha corners
render(full, f'{M}/favicon.png', 48)
render(svg(art(0.9)), f'{M}/splash-icon.png', 1024, transparent=True)    # shown on the #0f172a splash
render(svg(art(0.62)), f'{M}/android-icon-foreground.png', 1024, transparent=True)
render(svg(art(0.62, mono=True)), f'{M}/android-icon-monochrome.png', 1024, transparent=True)
render(svg('', bg='url(#bg)'), f'{M}/android-icon-background.png', 1024)
render(full, f'{P}/icon-512.png', 512)
render(full, f'{P}/icon-180.png', 180)
