#!/usr/bin/env python3
"""Renders the Google Play feature graphic (1024x500) to branding/play-feature-graphic.png. Needs Google Chrome."""
import base64, os, subprocess, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
icon = base64.b64encode(open(os.path.join(ROOT, 'public/icon-512.png'), 'rb').read()).decode()
html = f'''<!doctype html><meta charset="utf-8"><style>
html,body{{margin:0;width:1024px;height:500px;overflow:hidden;background:radial-gradient(120% 140% at 20% 20%,#1e3a5f,#0f172a 65%);font-family:-apple-system,system-ui,sans-serif;color:#fff}}
.wrap{{display:flex;align-items:center;height:500px;padding:0 70px;gap:56px}}
img{{width:260px;height:260px;border-radius:58px;box-shadow:0 20px 60px rgba(0,0,0,.5)}}
h1{{font-size:76px;line-height:1.02;margin:0 0 18px;font-weight:800;letter-spacing:-2px}}
p{{font-size:32px;line-height:1.3;margin:0;color:#9fb4d0;font-weight:500}}
</style><div class="wrap"><img src="data:image/png;base64,{icon}"><div><h1>Control<br>Your PC</h1><p>Remote control that<br>keeps you signed in.</p></div></div>'''
with tempfile.TemporaryDirectory() as d:
    src = os.path.join(d, 'a.html'); open(src, 'w').write(html)
    out = os.path.join(ROOT, 'branding/play-feature-graphic.png')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--screenshot={out}',
                    '--window-size=1024,500', '--force-device-scale-factor=1', 'file://' + src], check=True, capture_output=True)
print('wrote branding/play-feature-graphic.png')
