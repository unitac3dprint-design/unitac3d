/* UNITAC — picture or clip in the empty space left and right of the page (wide screens only).
   site/sides = { left: { type, mime, chunks, ver, blend, motion }, right: {…} }, data in sideChunks/{side}-{ver}-{i}.
   The file is kept in the browser cache after the first visit, so later pages do not download it again. */
import { db, doc, getDoc } from './fb.js?v=20261004j';

const CONTENT = 1180, MIN_SIDE = 150, CACHE = 'unitac-sides-v1';
let started = false;

function css() {
  if (document.getElementById('sideCss')) return;
  const s = document.createElement('style'); s.id = 'sideCss';
  s.textContent = `
.uside{position:fixed;top:0;bottom:0;z-index:-2;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;opacity:0;transition:opacity 1.2s ease}
.uside.on{opacity:1}
.uside.l{left:0}.uside.r{right:0}
.uside__cam{position:relative;width:100%;height:100%}
.uside.motion .uside__cam{animation:usidePush 10s ease-in-out infinite alternate}
.uside.motion .uside__m{animation:usideBreath 4.2s ease-in-out infinite}
.uside.r.motion .uside__m{animation-delay:-2.1s}
.uside__z{position:absolute;inset:0;transform:scale(var(--sc,1));transform-origin:50% var(--py,35%)}
.uside__m{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;object-position:50% var(--py,50%);transform-origin:50% 100%}
.uside.blend{mix-blend-mode:lighten}
.uside.fade .uside__m{-webkit-mask-image:linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent),linear-gradient(180deg,transparent,#000 12%,#000 85%,transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent),linear-gradient(180deg,transparent,#000 12%,#000 85%,transparent);mask-composite:intersect}
@keyframes usidePush{from{transform:scale(1)}to{transform:scale(1.05)}}
@keyframes usideBreath{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-5px) scaleY(1.008)}}
@media (prefers-reduced-motion: reduce){.uside .uside__cam,.uside .uside__m{animation:none!important}}`;
  document.head.appendChild(s);
}
async function blobFor(side, m) {
  const key = 'https://unitac.local/side/' + side + '/' + m.ver;
  let cache = null;
  try { cache = await caches.open(CACHE); const hit = await cache.match(key); if (hit) return await hit.blob(); } catch (_) { cache = null; }
  const parts = await Promise.all(Array.from({ length: m.chunks }, (_, i) => getDoc(doc(db, 'sideChunks', side + '-' + m.ver + '-' + i)).then(d => d.exists() ? d.data().d : '')));
  const bin = atob(parts.join('')), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: m.mime || (m.type === 'video' ? 'video/mp4' : 'image/webp') });
  if (cache) { try { await cache.put(key, new Response(blob, { headers: { 'Content-Type': blob.type } })); const ks = await cache.keys(); ks.forEach(k => { if (k.url.includes('/side/' + side + '/') && k.url !== key) cache.delete(k); }); } catch (_) {} }
  return blob;
}
function place(el) {
  const w = Math.max(0, (innerWidth - CONTENT) / 2 - 16);
  el.style.width = w + 'px'; el.hidden = w < MIN_SIDE;
}
export async function mountSides(opts = {}) {
  if (started) return; started = true;
  if (innerWidth - CONTENT < MIN_SIDE * 2 && !opts.force) {
    /* not wide enough now: try again if the window grows */
    const again = () => { if (innerWidth - CONTENT >= MIN_SIDE * 2) { removeEventListener('resize', again); started = false; mountSides(opts); } };
    addEventListener('resize', again); return;
  }
  let cfg = null; try { const s = await getDoc(doc(db, 'site', 'sides')); cfg = s.exists() ? s.data() : null; } catch (_) {}
  if (!cfg) return;
  css();
  for (const side of ['left', 'right']) {
    const m = cfg[side]; if (!m || !m.chunks) continue;
    try {
      const blob = await blobFor(side, m), url = URL.createObjectURL(blob);
      const box = document.createElement('div'); box.className = 'uside ' + (side === 'left' ? 'l' : 'r') + (m.blend ? ' blend' : '') + (m.motion ? ' motion' : '') + (m.fade !== false ? ' fade' : '');
      box.setAttribute('aria-hidden', 'true');
      const cam = document.createElement('div'); cam.className = 'uside__cam';
      let el;
      if (m.type === 'video') { el = document.createElement('video'); el.preload = 'auto'; el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true; el.setAttribute('playsinline', ''); el.src = url; el.play().catch(() => {}); }
      else { el = document.createElement('img'); el.alt = ''; el.decoding = 'async'; el.src = url; }
      el.className = 'uside__m';
      const z = document.createElement('div'); z.className = 'uside__z';
      z.style.setProperty('--py', { top: '0%', center: '50%', bottom: '100%' }[m.pos] || '35%'); el.style.setProperty('--py', { top: '0%', center: '50%', bottom: '100%' }[m.pos] || '35%');
      z.style.setProperty('--sc', String(m.scale || 1)); z.appendChild(el); cam.appendChild(z); box.appendChild(cam); document.body.prepend(box);
      place(box); addEventListener('resize', () => place(box), { passive: true });
      const show = () => box.classList.add('on');
      if (m.type === 'video') el.addEventListener('loadeddata', show, { once: true }); else el.addEventListener('load', show, { once: true });
      document.addEventListener('visibilitychange', () => { if (m.type === 'video') { if (document.hidden) el.pause(); else el.play().catch(() => {}); } });
    } catch (_) {}
  }
}
