// A self-contained sample session: a made-up desktop with the same gestures as the real viewer
// (pinch to zoom, two-finger pan, trackpad pointer, text box). No Mac or network is involved.
export const DEMO_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;background:#0f172a;color:#e2e8f0;font:16px -apple-system,system-ui,sans-serif;overflow:hidden}
#app{position:fixed;inset:0;display:flex;flex-direction:column}
#banner{background:#1e293b;border-bottom:1px solid #334155;padding:8px 12px;font-size:13px;color:#94a3b8;text-align:center}
#screen{flex:1;min-height:0;background:#000;position:relative;overflow:hidden;touch-action:none}
#zoom{position:absolute;left:0;top:0;transform-origin:0 0}
.desk{position:absolute;left:0;top:0;width:1440px;height:900px;background:linear-gradient(135deg,#312e81,#1d4ed8 55%,#0ea5e9);color:#fff;overflow:hidden;font:15px -apple-system,system-ui,sans-serif}
.menubar{height:30px;background:rgba(0,0,0,.35);display:flex;gap:26px;align-items:center;padding:0 20px}.menubar i{margin-left:auto;font-style:normal}
.win{position:absolute;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.bar{height:38px;background:#2b2d33;display:flex;align-items:center;gap:8px;padding:0 14px;position:relative}
.bar u{width:14px;height:14px;border-radius:50%;background:#ef4444}.bar u+u{background:#eab308}.bar u+u+u{background:#22c55e}
.bar em{position:absolute;left:0;right:0;text-align:center;font-style:normal;color:#aaa;font-size:14px}
.term{left:110px;top:110px;width:820px;height:520px;background:#12141a}
.term pre{margin:0;padding:22px;font:24px/1.5 ui-monospace,Menlo,monospace;color:#d1d5db;white-space:pre-wrap;word-break:break-all}
.term s{color:#22c55e;text-decoration:none}
.cur{display:inline-block;width:13px;height:26px;background:#d1d5db;vertical-align:middle}
.notes{left:820px;top:260px;width:460px;height:400px;background:#fef9c3;color:#422006}.notes .bar{background:#fde68a}.notes .bar em{color:#92400e}
.notes .body{padding:22px;font-size:24px}.notes h3{margin:0 0 14px;font-size:30px}.notes p{margin:8px 0}
.dock{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:16px;padding:12px 18px;background:rgba(255,255,255,.25);border-radius:26px}.dock b{width:64px;height:64px;border-radius:16px}
#ptr{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:3;display:none}
#ptr::after{content:'';position:absolute;left:-9px;top:-9px;width:14px;height:14px;border-radius:50%;background:rgba(56,189,248,.35);border:2px solid #38bdf8;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
#ptr.click::after{background:#38bdf8;transform:scale(1.8);transition:transform .15s}
#textbar{display:none;gap:6px;padding:6px 8px;background:#1e293b;border-top:1px solid #334155}
#textbar input{flex:1;min-width:0;padding:10px 12px;font-size:16px;color:#e2e8f0;background:#0f172a;border:1px solid #334155;border-radius:8px}
button{font:inherit;color:#e2e8f0;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px}
#textbar .go{background:#38bdf8;color:#082f49;border-color:#38bdf8;font-weight:600}
#bar2{display:flex;gap:6px;padding:6px 8px 14px;background:#1e293b;border-top:1px solid #334155;overflow-x:auto}
#bar2 button{flex:none;min-width:44px;min-height:40px;padding:6px 10px}
#bar2 button.on{background:#38bdf8;color:#082f49;border-color:#38bdf8}
</style></head><body><div id="app">
<div id="banner">Demo: sample desktop, no Mac needed</div>
<div id="screen"><div id="zoom"><div class="desk">
<div class="menubar"><b>Terminal</b><span>Shell</span><span>Edit</span><span>View</span><span>Window</span><i>Thu 9:41</i></div>
<div class="win term"><div class="bar"><u></u><u></u><u></u><em>projects — zsh</em></div><pre id="out"><s>~/projects</s> $ git status
On branch main
nothing to commit, working tree clean

<s>~/projects</s> $ <span class="cur"></span></pre></div>
<div class="win notes"><div class="bar"><u></u><u></u><u></u><em>Notes</em></div><div class="body"><h3>Try it</h3><p>Pinch to zoom</p><p>Two fingers to pan</p><p>Tap Pad, then drag</p><p>Tap Aa and send text</p></div></div>
<div class="dock"><b style="background:#f97316"></b><b style="background:#22c55e"></b><b style="background:#3b82f6"></b><b style="background:#a855f7"></b><b style="background:#ef4444"></b><b style="background:#eab308"></b><b style="background:#14b8a6"></b></div>
</div></div><div id="ptr"></div></div>
<form id="textbar"><input id="txt" type="text" placeholder="Type or paste text to send to the Mac" autocomplete="off"><button class="go" type="submit">Send</button></form>
<div id="bar2"><button id="bText">Aa</button><button id="bPad">Pad</button><button id="bZoom">1×</button></div>
</div><script>
(function(){
var screen=document.getElementById('screen'),zoom=document.getElementById('zoom'),ptr=document.getElementById('ptr');
var s=1,tx=0,ty=0,base=1,pad=false,px=200,py=150,W=1440,H=900;
function fit(){var w=screen.clientWidth,h=screen.clientHeight;base=w/W;if(base*H>h)base=h/H;}
function clamp(){var w=screen.clientWidth,h=screen.clientHeight,cw=W*base*s,ch=H*base*s;
 tx=cw<=w?(w-cw)/2:Math.min(0,Math.max(w-cw,tx));ty=ch<=h?(h-ch)/2:Math.min(0,Math.max(h-ch,ty));}
function draw(){clamp();zoom.style.transform='translate('+tx+'px,'+ty+'px) scale('+(base*s)+')';
 document.getElementById('bZoom').textContent=s===1?'1×':s.toFixed(1)+'×';
 ptr.style.display=pad?'block':'none';ptr.style.transform='translate('+(tx+px*base*s)+'px,'+(ty+py*base*s)+'px)';}
function dist(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);}
function mid(t){var r=screen.getBoundingClientRect();return{x:(t[0].clientX+t[1].clientX)/2-r.left,y:(t[0].clientY+t[1].clientY)/2-r.top};}
var g=null,one=null;
screen.addEventListener('touchstart',function(e){e.preventDefault();
 if(e.touches.length>=2){one=null;g={d:dist(e.touches),s:s,m:mid(e.touches)};}
 else if(pad&&e.touches.length===1){one={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now(),moved:0};}
},{passive:false});
screen.addEventListener('touchmove',function(e){e.preventDefault();
 if(g&&e.touches.length>=2){var m=mid(e.touches),ns=Math.min(5,Math.max(1,g.s*dist(e.touches)/g.d));
  var cx=(g.m.x-tx)/(base*s),cy=(g.m.y-ty)/(base*s);s=ns;tx=m.x-cx*base*s;ty=m.y-cy*base*s;g.m=m;draw();}
 else if(one&&e.touches.length===1){var dx=e.touches[0].clientX-one.x,dy=e.touches[0].clientY-one.y;one.x=e.touches[0].clientX;one.y=e.touches[0].clientY;
  one.moved+=Math.hypot(dx,dy);px=Math.min(W,Math.max(0,px+dx*1.6/(base*s)));py=Math.min(H,Math.max(0,py+dy*1.6/(base*s)));draw();}
},{passive:false});
screen.addEventListener('touchend',function(e){e.preventDefault();
 if(one&&one.moved<8&&Date.now()-one.t<300){ptr.className='click';setTimeout(function(){ptr.className='';},180);}
 if(e.touches.length===0){g=null;one=null;}
},{passive:false});
document.getElementById('bZoom').onclick=function(){s=1;draw();};
document.getElementById('bPad').onclick=function(){pad=!pad;this.className=pad?'on':'';draw();};
var tb=document.getElementById('textbar'),bt=document.getElementById('bText');
bt.onclick=function(){var on=tb.style.display!=='flex';tb.style.display=on?'flex':'none';bt.className=on?'on':'';fit();draw();if(on)document.getElementById('txt').focus();};
tb.onsubmit=function(e){e.preventDefault();var i=document.getElementById('txt'),v=i.value;if(!v)return;i.value='';
 var out=document.getElementById('out'),cur=out.querySelector('.cur');
 out.insertBefore(document.createTextNode(v+'\\n'),cur);out.insertBefore(document.createTextNode('(sent to your Mac)\\n\\n'),cur);
 out.insertBefore(document.createTextNode(''),cur);};
window.addEventListener('resize',function(){fit();draw();});
fit();draw();
})();
</script></body></html>`;
