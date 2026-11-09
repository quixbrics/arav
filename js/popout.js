// Pop-out output: a second window that mirrors the output canvas, so it can be
// shown full screen on a projector or external monitor while you keep editing
// in the main window. Each live frame is copied into the pop-out right after it
// is drawn (the WebGL canvas keeps its drawing buffer), so the two never drift.
// In Chrome/Edge the window opens on your other screen if there is one
// (Window Management API, asks permission once).
let win = null, ctx = null, onChange = null, popTarget = null;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>ARAV Output</title>
<style>
html,body{margin:0;height:100%;background:#000;overflow:hidden}
canvas{position:fixed;inset:0;width:100%;height:100%;object-fit:contain;display:block}
body.idle{cursor:none}
#hint{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:9px 14px;border-radius:8px;background:rgba(10,11,14,.82);border:1px solid rgba(255,255,255,.12);color:#d9dce1;font:500 12px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.04em;white-space:nowrap;transition:opacity .4s;pointer-events:none}
#hint b{color:#ff7a3d;font-weight:600}
body.idle #hint{opacity:0}
</style></head><body>
<canvas id="c" width="16" height="9"></canvas>
<div id="hint"><b>ARAV OUTPUT</b> · double-click or <b>F</b>: full screen · <b>Space</b>: play / pause · <b>Esc</b>: leave full screen</div>
</body></html>`;

async function otherScreen() {
  // returns {left, top, width, height} of a screen other than the current one, or null
  if (!('getScreenDetails' in window)) return null;
  try {
    const d = await window.getScreenDetails();
    const other = d.screens.find(s => s !== d.currentScreen);
    return other ? { left: other.availLeft, top: other.availTop, width: other.availWidth, height: other.availHeight, screen: other } : null;
  } catch (e) { return null; }
}

function wire(w) {
  const doc = w.document;
  doc.open(); doc.write(PAGE); doc.close();
  ctx = doc.getElementById('c').getContext('2d', { alpha: false });
  const goFull = () => {
    if (doc.fullscreenElement) return doc.exitFullscreen();
    const el = doc.documentElement;
    // fullscreen on the screen the window is on (Chrome can be told which one)
    (popTarget ? el.requestFullscreen({ screen: popTarget.screen }) : el.requestFullscreen()).catch(() => el.requestFullscreen().catch(() => {}));
  };
  doc.addEventListener('dblclick', goFull);
  let idleT;
  const wake = () => { doc.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => doc.body.classList.add('idle'), 2500); };
  doc.addEventListener('mousemove', wake); wake();
  doc.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); goFull(); }
    else if (e.code === 'Space') { e.preventDefault(); document.getElementById('bPlay')?.click(); }
  });
  w.addEventListener('pagehide', () => { if (w === win) { win = null; ctx = null; onChange && onChange(false); } });
}

export async function togglePopout() {
  if (win && !win.closed) { win.close(); win = null; ctx = null; onChange && onChange(false); return; }
  // open synchronously first (popup blockers need the click), then move it if there's a second screen
  const view = document.getElementById('view'), ar = (view.width || 16) / (view.height || 9);
  const h = 540, w0 = Math.round(h * ar);
  const w = window.open('', 'arav-output', `popup,width=${w0},height=${h}`);
  if (!w) { onChange && onChange(false, 'blocked'); return; }
  win = w; popTarget = null; wire(w); onChange && onChange(true);
  const t = await otherScreen();
  if (t && win === w && !w.closed) {
    try { w.moveTo(t.left + 40, t.top + 40); w.resizeTo(Math.min(t.width - 80, 1280), Math.min(t.height - 80, Math.round(1280 / ar))); } catch (e) {}
    popTarget = t;   // full screen now goes to that screen
  }
}

// copy the frame that was just drawn into the pop-out
export function popoutFrame(view) {
  if (!win) return;
  if (win.closed) { win = null; ctx = null; onChange && onChange(false); return; }
  const c = ctx.canvas;
  if (c.width !== view.width || c.height !== view.height) { c.width = view.width; c.height = view.height; }
  ctx.drawImage(view, 0, 0);
}
export const popoutOpen = () => !!(win && !win.closed);
export function onPopoutChange(fn) { onChange = fn; }
window.addEventListener('pagehide', () => { if (win && !win.closed) win.close(); });
