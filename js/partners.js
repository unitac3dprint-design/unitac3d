import { db, doc, getDoc, collection, getDocs, query, where } from './fb.js';
import { $, h, reveal, LOGO_SVG } from './core.js';
import { PCATS } from './pcats.js';
document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
document.querySelector('[data-nav="partners"]').setAttribute('aria-current', 'page');
reveal();
const GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
let all = [], sel = 'all';
function tabs() {
  const T = $('tabs'); T.textContent = '';
  [{ key: 'all', name: 'ทั้งหมด' }].concat(PCATS.filter(c => all.some(p => p.cat === c.key))).forEach(c => {
    const b = h('button', null, c.name); b.type = 'button'; b.setAttribute('aria-pressed', String(c.key === sel));
    b.addEventListener('click', () => { sel = c.key; tabs(); render(); }); T.appendChild(b);
  });
}
function render() {
  const S = $('secs'); S.textContent = '';
  const cats = PCATS.filter(c => (sel === 'all' || sel === c.key) && all.some(p => p.cat === c.key));
  if (!cats.length) { S.appendChild(h('p', 'pempty', 'ยังไม่มีพาร์ทเนอร์')); return; }
  cats.forEach(c => {
    const sec = h('section', 'psec'), hd = h('div', 'psec__h');
    hd.append(h('span', 'psec__n', '0' + (PCATS.indexOf(c) + 1)), h('h2', null, c.name), h('span', 'psec__en', c.en));
    const g = h('div', 'pgrid');
    all.filter(p => p.cat === c.key).forEach(p => {
      const a = h('a', 'ptile' + (p.tone === 'dark' ? ' ptile--dark' : ''));
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', p.name + ' (เปิดในแท็บใหม่)');
      const im = h('img'); im.src = p.logo; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      const go = h('span', 'ptile__go'); go.innerHTML = GO;
      a.append(im, go, h('span', 'ptile__nm', p.name)); g.appendChild(a);
    });
    sec.append(hd, g); S.appendChild(sec);
  });
}
(async () => {
  try {
    const qs = await getDocs(query(collection(db, 'partners'), where('visible', '==', true)));
    all = qs.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.logo && /^https?:\/\//.test(p.url || ''))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (_) { all = []; }
  tabs(); render();
  try {
    const q = await getDoc(doc(db, 'public', 'queue'));
    const fb = q.exists() && (q.data().shop.fb || []).find(f => f.kind === 'page' && f.url);
    if (fb) { const l = $('ctaLink'); l.href = fb.url; l.target = '_blank'; l.rel = 'noopener'; }
  } catch (_) {}
})();
