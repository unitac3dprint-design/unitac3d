import { db, doc, getDoc, collection, getDocs, query, where } from './fb.js';
import { $, h, reveal, LOGO_SVG, MARK_PATH } from './core.js';
import { PCATS } from './pcats.js';
document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
document.querySelectorAll('[data-mark]').forEach(e => { e.innerHTML = '<svg viewBox="4.3 21.5 85.5 36.5"><path fill="currentColor" d="' + MARK_PATH + '"/></svg>'; });
document.querySelector('[data-nav="partners"]').setAttribute('aria-current', 'page');
reveal();
const GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
let all = [];
const has = (k) => all.some(p => p.cat === k);
function stats() {
  const el = $('stats'); el.textContent = '';
  const parts = PCATS.filter(c => has(c.key)).map(c => [all.filter(p => p.cat === c.key).length, c.name]);
  parts.forEach(([n, name], i) => { if (i) el.append(' · '); const s = h('span'); s.style.whiteSpace = 'nowrap'; s.append(h('b', null, String(n)), ' ' + name); el.appendChild(s); });
}
export function partnerTile(p) {
  const a = h('a', 'ptile' + (p.tone === 'dark' ? ' ptile--dark' : ''));
  a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', p.name + ' (เปิดในแท็บใหม่)');
  a.style.setProperty('--s', String(p.scale || 1));
  const st = h('span', 'ptile__stage'), im = h('img'); im.src = p.logo; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; st.appendChild(im);
  const go = h('span', 'ptile__go'); go.innerHTML = 'เยี่ยมชม ' + GO;
  a.append(st, h('span', 'ptile__nm', p.name), go);
  return a;
}
function render() {
  const S = $('secs'); S.textContent = '';
  const cats = PCATS.filter(c => has(c.key));
  if (!cats.length) { S.appendChild(h('p', 'pempty', 'ยังไม่มีพาร์ทเนอร์')); return; }
  cats.forEach(c => {
    const items = all.filter(p => p.cat === c.key);
    const row = h('section', 'prow'), hd = h('div', 'prow__h'), t = h('div', 'prow__t');
    t.append(h('h2', null, c.name), h('span', 'prow__en', c.en + ' · ' + items.length));
    hd.append(h('span', 'prow__n', '0' + (PCATS.indexOf(c) + 1)), t);
    const g = h('div', 'prow__logos');
    items.forEach(p => g.appendChild(partnerTile(p)));
    row.append(hd, g); S.appendChild(row);
  });
}
(async () => {
  try {
    const qs = await getDocs(query(collection(db, 'partners'), where('visible', '==', true)));
    all = qs.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.logo && /^https?:\/\//.test(p.url || ''))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (_) { all = []; }
  stats(); render();
  try {
    const q = await getDoc(doc(db, 'public', 'queue'));
    const fb = q.exists() && (q.data().shop.fb || []).find(f => f.kind === 'page' && f.url);
    if (fb) { const l = $('ctaLink'); l.href = fb.url; l.target = '_blank'; l.rel = 'noopener'; }
  } catch (_) {}
})();
