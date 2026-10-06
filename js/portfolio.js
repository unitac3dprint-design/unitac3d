import { db, doc, getDoc, collection, getDocs, query, where } from './fb.js?v=20261004u';
import { $, h, reveal, LOGO_SVG } from './core.js?v=20261004u';
import { loadHero } from './heromedia.js?v=20261004u';
import { PFCATS } from './pfcats.js?v=20261004u';
document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
const nv = document.querySelector('[data-nav="works"]'); if (nv) nv.setAttribute('aria-current', 'page');
reveal();
let all = [], sel = 'all', shown = [], idx = 0;
const catName = (k) => (PFCATS.find(c => c.key === k) || PFCATS[PFCATS.length - 1]).name;
function tabs() {
  const T = $('pfTabs'); T.textContent = '';
  [{ key: 'all', name: 'ทั้งหมด' }].concat(PFCATS).forEach(c => {
    const n = c.key === 'all' ? all.length : all.filter(p => p.cat === c.key).length; if (!n && c.key !== 'all') return;
    const b = h('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(sel === c.key)); b.append(c.name, h('b', null, String(n)));
    b.addEventListener('click', () => { if (sel === c.key) return; sel = c.key; tabs(); grid(true); }); T.appendChild(b);
  });
}
let io = null, cols = [];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
const nCols = () => innerWidth <= 600 ? 2 : innerWidth <= 980 ? 2 : 3;
function grid(animate) {
  const G = $('pfGrid');
  const build = () => {
    G.textContent = ''; G.classList.remove('is-swap');
    shown = all.filter(p => sel === 'all' || p.cat === sel);
    if (!shown.length) { G.appendChild(h('p', 'pempty', 'ยังไม่มีผลงานในหมวดนี้')); cols = []; return; }
    if (io) io.disconnect();
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    /* masonry: each picture goes to the shortest column */
    const n = nCols(); cols = []; const hts = [];
    for (let c = 0; c < n; c++) { const col = h('div', 'pcol'); col.dataset.speed = [0, -0.07, 0.05][c] || 0; G.appendChild(col); cols.push(col); hts.push(0); }
    shown.forEach((p, i) => {
      const b = h('button', 'pw'); b.type = 'button'; b.setAttribute('aria-label', 'ดูรูปขนาดใหญ่' + (p.title ? ' ' + p.title : ''));
      b.style.setProperty('--d', (i % 6) * 80 + 'ms');
      const inr = h('span', 'pw__in'), im = h('img'); im.src = p.thumb; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      if (p.w && p.h) { im.width = p.w; im.height = p.h; }
      inr.append(im, h('span', 'pw__glare')); b.append(inr);
      b.addEventListener('click', () => open(i, im));
      if (fine && !reduce) tilt(b);
      const k = hts.indexOf(Math.min(...hts)); cols[k].appendChild(b); hts[k] += (p.h && p.w) ? p.h / p.w : 1;
      io.observe(b);
    });
    para();
  };
  if (animate && !reduce) { G.classList.add('is-swap'); setTimeout(build, 230); } else build();
}
/* tilt + light on each picture */
function tilt(b) {
  let raf = 0, ev = null;
  const go = () => { raf = 0; if (!ev) return; const r = b.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    b.style.setProperty('--ry', ((x - .5) * 12).toFixed(2) + 'deg'); b.style.setProperty('--rx', ((.5 - y) * 10).toFixed(2) + 'deg');
    b.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); b.style.setProperty('--gy', (y * 100).toFixed(1) + '%'); };
  b.addEventListener('pointermove', (e) => { ev = e; b.classList.add('is-tilt'); if (!raf) raf = requestAnimationFrame(go); });
  b.addEventListener('pointerleave', () => { ev = null; b.classList.remove('is-tilt'); b.style.removeProperty('--rx'); b.style.removeProperty('--ry'); });
}
/* parallax: columns drift at slightly different speeds while scrolling */
let praf = 0;
function para() {
  if (reduce || !cols.length) return;
  if (praf) return; praf = requestAnimationFrame(() => {
    praf = 0; const G = $('pfGrid'), top = G.getBoundingClientRect().top;
    const d = Math.max(-400, Math.min(1400, -top + innerHeight * .3));
    cols.forEach(c => { c.style.transform = 'translate3d(0,' + (d * (+c.dataset.speed || 0)).toFixed(1) + 'px,0)'; });
  });
}
addEventListener('scroll', para, { passive: true });
let rsT = 0; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { if (cols.length !== nCols()) grid(false); else para(); }, 200); });
/* hero background: the image or clip chosen in the admin; nothing when none is set */
async function showcase() {
  const S = $('pfShow'); S.textContent = '';
  let m = null; try { m = await loadHero(); } catch (_) {}
  if (!m) { S.hidden = true; return; }
  S.hidden = false;
  if (m.type === 'image') { const im = h('img'); im.src = m.src; im.alt = ''; im.decoding = 'async'; S.appendChild(im); requestAnimationFrame(() => im.classList.add('on')); }
  else { const v = h('video'); v.src = m.src; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; S.appendChild(v); v.addEventListener('canplay', () => v.classList.add('on'), { once: true }); v.play().catch(() => {}); }
}
function countUp(el, to) {
  if (reduce) { el.textContent = String(to); return; }
  const t0 = performance.now(), dur = 1100;
  const step = (t) => { const p = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3))); el.textContent = String(v); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const full = {};
function strip() {
  const S = $('lbStrip'); if (!S.children.length || S.dataset.sel !== sel) {
    S.textContent = ''; S.dataset.sel = sel;
    shown.forEach((p, i) => { const b = h('button'); b.type = 'button'; b.setAttribute('aria-label', 'รูปที่ ' + (i + 1)); const im = h('img'); im.src = p.thumb; im.alt = ''; im.loading = 'lazy'; b.appendChild(im); b.addEventListener('click', () => open(i)); S.appendChild(b); });
  }
  [...S.children].forEach((b, i) => b.classList.toggle('on', i === idx));
  const on = S.children[idx]; if (on) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
}
async function open(i, fromImg) {
  idx = (i + shown.length) % shown.length; const p = shown[idx];
  $('lbT').textContent = p.title || ''; $('lbT').className = 'sr'; $('lbC').hidden = true; $('lbD').textContent = p.desc || ''; $('lbD').hidden = !p.desc;
  const img = $('lbImg'); img.src = full[p.id] || p.thumb;
  const first = !$('lb').open;
  if (first) $('lb').showModal();
  strip();
  if (first && fromImg && !reduce && img.animate) {
    const a = fromImg.getBoundingClientRect(), b = img.getBoundingClientRect();
    if (b.width && b.height) img.animate([{ transform: `translate(${a.left - b.left}px,${a.top - b.top}px) scale(${a.width / b.width},${a.height / b.height})`, transformOrigin: '0 0', opacity: .6 }, { transform: 'none', transformOrigin: '0 0', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
  } else if (!first && img.animate && !reduce) img.animate([{ opacity: .3, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
  try {
    if (!full[p.id]) { const s = await getDoc(doc(db, 'portfolioFull', p.id)); full[p.id] = s.exists() ? s.data().img : p.thumb; }
    if (shown[idx] === p) img.src = full[p.id];
  } catch (_) {}
  const nx = shown[(idx + 1) % shown.length]; if (nx && !full[nx.id]) getDoc(doc(db, 'portfolioFull', nx.id)).then(s => { if (s.exists()) full[nx.id] = s.data().img; }).catch(() => {});
}
$('lbX').addEventListener('click', () => $('lb').close());
$('lbPrev').addEventListener('click', () => open(idx - 1));
$('lbNext').addEventListener('click', () => open(idx + 1));
$('lb').addEventListener('click', (e) => { if (e.target === $('lb') || e.target.classList.contains('lb__in')) $('lb').close(); });
addEventListener('keydown', (e) => { if (!$('lb').open) return; if (e.key === 'ArrowLeft') open(idx - 1); if (e.key === 'ArrowRight') open(idx + 1); });
let sx = null; $('lb').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
$('lb').addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) open(idx + (dx < 0 ? 1 : -1)); });
(async () => {
  try {
    const qs = await getDocs(query(collection(db, 'portfolio'), where('visible', '==', true)));
    all = qs.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.thumb).sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (_) { all = []; }
  const st = $('pfStats'); st.textContent = '';
  if (all.length) { const n1 = h('b', null, '0'), n2 = h('b', null, '0'); st.append(n1, ' ชิ้นงาน · ', n2, ' หมวด'); countUp(n1, all.length); countUp(n2, new Set(all.map(p => p.cat)).size); }
  tabs(); grid(false); showcase();
})();
