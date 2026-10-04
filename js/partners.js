import { db, collection, getDocs, query, where } from './fb.js?v=20261004g';
import { $, h, reveal, LOGO_SVG, MARK_PATH } from './core.js?v=20261004g';
import { PCATS } from './pcats.js?v=20261004g';
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
/* logo leans toward the mouse; its shadow falls the other way */
const fineTilt = matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
function tiltLogo(a, im) {
  let raf = 0, ev = null;
  const go = () => { raf = 0; if (!ev) return; const r = a.querySelector('.ptile__stage').getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
    a.style.setProperty('--ry', ((x - .5) * 28).toFixed(2) + 'deg'); a.style.setProperty('--rx', ((.5 - y) * 22).toFixed(2) + 'deg');
    a.style.setProperty('--sx', ((.5 - x) * 22).toFixed(1) + 'px'); a.style.setProperty('--sy', (14 + (.5 - y) * 12).toFixed(1) + 'px'); };
  a.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; ev = e; a.classList.add('is-tilt'); if (!raf) raf = requestAnimationFrame(go); });
  a.addEventListener('pointerleave', () => { ev = null; a.classList.remove('is-tilt'); ['--rx', '--ry', '--sx', '--sy'].forEach(k => a.style.removeProperty(k)); });
}
export function partnerTile(p) {
  const a = h('a', 'ptile' + (p.tone === 'dark' ? ' ptile--dark' : ''));
  a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', p.name + ' (เปิดในแท็บใหม่)');
  a.style.setProperty('--s', String(p.scale || 1));
  const st = h('span', 'ptile__stage'), im = h('img'); im.src = p.logo; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; st.appendChild(im);
  const go = h('span', 'ptile__go'); go.innerHTML = 'เยี่ยมชม ' + GO;
  a.append(st, h('span', 'ptile__nm', p.name), go);
  if (fineTilt) tiltLogo(a, im);
  return a;
}
function render() {
  const S = $('secs'); S.textContent = '';
  PCATS.forEach(c => {
    const items = all.filter(p => p.cat === c.key);
    const row = h('section', 'prow' + (items.length ? '' : ' prow--empty')), hd = h('div', 'prow__h'), t = h('div', 'prow__t');
    t.append(h('h2', null, c.name), h('span', 'prow__en', c.en + ' · ' + items.length));
    hd.append(h('span', 'prow__n', '0' + (PCATS.indexOf(c) + 1)), t);
    const g = h('div', 'prow__logos');
    if (items.length) items.forEach(p => g.appendChild(partnerTile(p)));
    else {
      const a = h('div', 'pinvite'); a.append(h('b', null, 'เร็วๆ นี้')); g.appendChild(a);
    }
    row.append(hd, g); S.appendChild(row);
  });
}
/* entry: logos glide in from the right one after another; scroll: rows drift (parallax) */
let mo = null, raf = 0;
function motion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.body.classList.add('prt-anim');
  const rows = [...document.querySelectorAll('.prow')];
  rows.forEach(r => [...r.querySelectorAll('.ptile,.pinvite')].forEach((t, i) => t.style.setProperty('--d', (140 + i * 110) + 'ms')));
  if (mo) mo.disconnect();
  mo = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); mo.unobserve(e.target); } }), { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  rows.forEach(r => mo.observe(r));
  const hero = document.querySelector('.prt__hero'), mark = document.querySelector('.prt__mark');
  const frame = () => {
    raf = 0;
    const vh = innerHeight, mid = vh / 2, wide = innerWidth > 760;
    rows.forEach(r => {
      const b = r.getBoundingClientRect(); if (b.bottom < -200 || b.top > vh + 200) return;
      const t = Math.max(-1, Math.min(1, (b.top + b.height / 2 - mid) / vh));
      r.style.setProperty('--px', (Math.max(0, t) * (wide ? 70 : 34)).toFixed(1) + 'px');
      r.style.setProperty('--py', (t * (wide ? -26 : -14)).toFixed(1) + 'px');
    });
    if (hero && mark) mark.style.setProperty('--hy', (Math.min(scrollY, hero.offsetHeight) * 0.3).toFixed(1) + 'px');
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); frame();
}

(async () => {
  try {
    const qs = await getDocs(query(collection(db, 'partners'), where('visible', '==', true)));
    all = qs.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.logo && /^https?:\/\//.test(p.url || ''))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (_) { all = []; }
  stats(); render(); motion();
})();
