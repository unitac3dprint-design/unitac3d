import { db, doc, getDoc, collection, getDocs, query, where } from './fb.js?v=20261003o';
import { $, h, reveal, LOGO_SVG } from './core.js?v=20261003o';
import { PFCATS } from './pfcats.js?v=20261003o';
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
    b.addEventListener('click', () => { sel = c.key; tabs(); grid(); }); T.appendChild(b);
  });
}
let io = null;
function grid() {
  const G = $('pfGrid'); G.textContent = '';
  shown = all.filter(p => sel === 'all' || p.cat === sel);
  if (!shown.length) { G.appendChild(h('p', 'pempty', 'ยังไม่มีผลงานในหมวดนี้')); return; }
  if (io) io.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  shown.forEach((p, i) => {
    const b = h('button', 'pw'); b.type = 'button'; b.setAttribute('aria-label', 'ดูรูปขนาดใหญ่' + (p.title ? ' ' + p.title : ''));
    b.style.setProperty('--d', (i % 6) * 70 + 'ms');
    const im = h('img'); im.src = p.thumb; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; if (p.w && p.h) { im.width = p.w; im.height = p.h; }
    b.append(im); b.addEventListener('click', () => open(i)); G.appendChild(b); io.observe(b);
  });
}
const full = {};
async function open(i) {
  idx = (i + shown.length) % shown.length; const p = shown[idx];
  $('lbT').textContent = p.title || ''; $('lbT').className = 'sr'; $('lbC').hidden = true; $('lbD').textContent = p.desc || ''; $('lbD').hidden = !p.desc;
  const img = $('lbImg'); img.src = p.thumb;
  if (!$('lb').open) $('lb').showModal();
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
  $('pfStats').textContent = all.length ? all.length + ' ชิ้นงาน · ' + new Set(all.map(p => p.cat)).size + ' หมวด' : '';
  tabs(); grid();
})();
