#!/usr/bin/env python3
"""Renders App Store screenshots (1320x2868, iPhone 6.9") to branding/screenshots/.
The phone UI is the app's real stylesheet and toolbar markup, drawn over a made-up desktop,
so no real screen content appears. Needs Google Chrome. Usage: python3 branding/screenshots.py"""
import os, subprocess, tempfile, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'branding/screenshots')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
CSS = open(os.path.join(ROOT, 'public/style.css')).read()

TOOLBAR = lambda on='': '''<div id="toolbar">{}<button class="danger">Close</button></div>'''.format(''.join(
    f'<button class="{"on" if k in on else ""}">{k}</button>' for k in
    ['⌨', 'Aa', 'Pad', ZOOM[0], 'Esc', 'Tab', 'Ctrl', 'Opt', '⌘', '←', '↑', '↓', '→']))
ZOOM = ['1×']

DESKTOP = '''
<div class="desk">
  <div class="menubar"><b>Terminal</b><span>Shell</span><span>Edit</span><span>View</span><span>Window</span><i>Thu 9:41</i></div>
  <div class="win term"><div class="bar"><u></u><u></u><u></u><em>projects — zsh</em></div><pre>
<s>~/projects</s> $ git status
On branch main
Your branch is up to date.
nothing to commit, working tree clean

<s>~/projects</s> $ npm start
server listening on :8080
<s>~/projects</s> $ <span class="cur"></span></pre></div>
  <div class="win notes"><div class="bar"><u></u><u></u><u></u><em>Notes</em></div><div class="body"><h3>Launch checklist</h3><p>☑ Icon and name</p><p>☑ TestFlight build</p><p>☐ Screenshots</p><p>☐ Submit for review</p></div></div>
  <div class="dock">''' + ''.join(f'<b style="background:{c}"></b>' for c in
    ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#eab308', '#14b8a6']) + '''</div>
</div>'''

def phone(inner, caption, sub):
    return f'''<!doctype html><meta charset="utf-8"><style>
{CSS}
html,body{{width:1320px;height:2868px;margin:0;overflow:hidden;background:radial-gradient(120% 80% at 50% 0%,#1e3a5f 0%,#0f172a 60%)}}
.cap{{position:absolute;top:300px;left:0;right:0;text-align:center;color:#fff}}
.cap h1{{font:800 112px/1.05 -apple-system,system-ui,sans-serif;margin:0 80px;letter-spacing:-2px}}
.cap p{{font:500 48px/1.3 -apple-system,system-ui,sans-serif;margin:30px 120px 0;color:#9fb4d0}}
.phone{{position:absolute;left:133px;top:780px;width:390px;height:600px;transform:scale(2.7);transform-origin:0 0;border-radius:44px;overflow:hidden;background:#000;box-shadow:0 0 0 5px #243552,0 40px 120px rgba(0,0,0,.6)}}
#app{{position:absolute;inset:0;background:#0f172a}}
#toolbar{{padding-bottom:22px}}
.fit{{position:absolute;left:0;right:0;top:50%;height:244px;margin-top:-122px;overflow:hidden}}
.card{{margin-top:30px!important}}
.desk{{position:absolute;left:0;top:0;width:1440px;height:900px;transform-origin:0 0;
  background:linear-gradient(135deg,#312e81,#1d4ed8 55%,#0ea5e9);font:15px -apple-system,system-ui,sans-serif;color:#fff;overflow:hidden}}
.desk .menubar{{height:30px;background:rgba(0,0,0,.35);display:flex;gap:26px;align-items:center;padding:0 20px;font-size:15px}}
.desk .menubar i{{margin-left:auto;font-style:normal}}
.desk .win{{position:absolute;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45)}}
.desk .bar{{height:38px;background:#2b2d33;display:flex;align-items:center;gap:8px;padding:0 14px;position:relative}}
.desk .bar u{{width:14px;height:14px;border-radius:50%;background:#ef4444}}.desk .bar u+u{{background:#eab308}}.desk .bar u+u+u{{background:#22c55e}}
.desk .bar em{{position:absolute;left:0;right:0;text-align:center;font-style:normal;color:#aaa;font-size:14px}}
.term{{left:110px;top:110px;width:820px;height:520px;background:#12141a}}
.term pre{{margin:0;padding:22px;font:24px/1.5 ui-monospace,Menlo,monospace;color:#d1d5db}}
.term s{{color:#22c55e;text-decoration:none}}
.cur{{display:inline-block;width:13px;height:26px;background:#d1d5db;vertical-align:middle}}
.notes{{left:820px;top:260px;width:460px;height:400px;background:#fef9c3;color:#422006}}
.notes .bar{{background:#fde68a}}.notes .bar em{{color:#92400e}}.notes .body{{padding:22px;font-size:24px}}
.notes h3{{margin:0 0 14px;font-size:30px}}.notes p{{margin:8px 0}}
.dock{{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:16px;padding:12px 18px;background:rgba(255,255,255,.25);border-radius:26px}}
.dock b{{width:64px;height:64px;border-radius:16px}}
</style>
<div class="cap"><h1>{html.escape(caption)}</h1><p>{html.escape(sub)}</p></div>
<div class="phone"><div id="app">{inner}</div></div>'''

def desk(style):
    return DESKTOP.replace('<div class="desk">', '<div class="desk" style="' + style + '">', 1)

def fit(desk_style=''):
    return '<div class="fit">' + desk(desk_style) + '</div>'

BASE = 'transform:scale(0.2708);'
slides = {}

ZOOM[0] = '1×'
slides['1-connect'] = phone(f'<div id="screen">{fit(BASE)}</div>{TOOLBAR()}',
    'Your Mac, in your pocket', 'See and control your Mac from anywhere.')

ZOOM[0] = '2×'
slides['2-zoom'] = phone(f'<div id="screen"><div class="fit" style="top:0;height:100%;margin:0">{desk("transform:translate(-45px,-55px) scale(0.55);")}</div></div>{TOOLBAR()}',
    'Pinch to zoom', 'Two fingers to zoom and pan. Up to 5×.')

ZOOM[0] = '1×'
slides['3-text'] = phone(f'''<div id="screen">{fit(BASE)}</div>
<form id="textbar"><input value="git commit -m 'Ship it'" readonly><button class="primary" type="button">Send</button><button type="button">Send ↵</button></form>{TOOLBAR("Aa")}''',
    'Type or paste text', 'Send whole commands straight to your Mac.')

slides['4-pad'] = phone(f'<div id="screen">{fit(BASE)}<div id="pointer" style="left:140px;top:222px"></div></div>{TOOLBAR("Pad")}',
    'Trackpad control', 'Move, tap, right-click, drag and scroll.')

slides['5-private'] = phone('''<form id="connect" class="card"><h1>Connect to your Mac</h1>
<label>Mac username</label><input type="text"><label>Mac password</label><input type="password">
<label class="check"><input type="checkbox" checked> Keep me connected on this iPhone</label><p class="error"></p>
<button class="primary" type="button">Connect</button></form>''',
    'Private by design', 'Reachable only over your own Tailscale network.')

os.makedirs(OUT, exist_ok=True)
for name, page in slides.items():
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, 'a.html'); open(src, 'w').write(page)
        dst = os.path.join(OUT, f'{name}.png')
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--screenshot={dst}',
                        '--window-size=1320,2868', '--force-device-scale-factor=1', 'file://' + src],
                       check=True, capture_output=True)
        print('wrote', os.path.relpath(dst, ROOT))
