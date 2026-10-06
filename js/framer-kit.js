import { db, collection, getDocs, query, where } from './fb.js?v=20261004u';
import { PCATS } from './pcats.js?v=20261004u';
import { PFCATS } from './pfcats.js?v=20261004u';
const $ = (id) => document.getElementById(id);
const BASE = new URL('./', location.href).href;          /* e.g. https://unitac3dprint-design.github.io/unitac3d/ */
const COLORS = [['Ground', '#141311'], ['Surface', '#1D1B18'], ['Sunk', '#27241F'], ['Ink', '#F2EDE5'], ['Ink 2', '#CBC4B8'], ['Muted', '#948D80'], ['Rule', '#2F2B26'], ['Rule strong', '#3C3731'], ['Accent', '#FF7A3C'], ['Accent soft', '#3A2216'], ['OK', '#74C49B'], ['Warn', '#E3A853'], ['Stop', '#EA7B72'], ['Design lane', '#B3A3E0']];
$('sw').innerHTML = COLORS.map(([n, c]) => `<div style="display:flex;flex-direction:column;gap:6px;width:120px"><div style="height:64px;border-radius:12px;background:${c};border:1px solid #3C3731"></div><span style="font-size:12.5px">${n}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:#948D80">${c}</span></div>`).join('');
const esc = (s) => String(s || '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const ext = (d) => (d.match(/^data:image\/(\w+)/) || [, 'png'])[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
let partners = [], works = [], full = {};
(async () => {
  try { const s = await getDocs(query(collection(db, 'partners'), where('visible', '==', true))); partners = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)); } catch (_) {}
  try { const s = await getDocs(query(collection(db, 'portfolio'), where('visible', '==', true))); works = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)); } catch (_) {}
  /* partner rows: flat flex layout */
  const R = $('pRows'); R.innerHTML = '';
  PCATS.forEach((c, i) => {
    const items = partners.filter(p => p.cat === c.key);
    const logos = items.length ? items.map(p => `<a href="${esc(p.url)}" style="display:flex;flex-direction:column;align-items:center;gap:14px;width:200px;text-decoration:none;color:#F2EDE5">
      <div style="display:flex;align-items:flex-end;justify-content:center;width:200px;height:200px"><img src="${p.logo}" alt="${esc(p.name)}" style="max-width:${Math.round(82 * (p.scale || 1))}%;max-height:${Math.round(82 * (p.scale || 1))}%;object-fit:contain;filter:drop-shadow(0 14px 18px rgba(0,0,0,.55))"></div>
      <span style="font-family:'Anuphan',sans-serif;font-size:16px;font-weight:600;text-align:center">${esc(p.name)}</span><span style="font-size:12px;color:#948D80">เยี่ยมชม ↗</span></a>`).join('')
      : `<div style="display:flex;align-items:center;justify-content:center;width:200px;height:150px;border-radius:18px;border:1px dashed #3C3731;color:#948D80;font-family:'Anuphan',sans-serif;font-weight:600">เร็วๆ นี้</div>`;
    R.insertAdjacentHTML('beforeend', `<div style="display:flex;align-items:center;gap:32px;padding:44px 24px;border-bottom:1px solid #2F2B26">
      <div style="display:flex;align-items:baseline;gap:18px;width:300px;flex:none"><span style="font-family:'IBM Plex Mono',monospace;font-size:52px;font-weight:500;line-height:1;color:#3C3731">0${i + 1}</span>
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-family:'Anuphan',sans-serif;font-size:24px;font-weight:600">${c.name}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.16em;color:#948D80">${c.en} · ${items.length}</span></div></div>
      <div style="display:flex;flex-wrap:wrap;gap:20px 28px">${logos}</div></div>`);
  });
  const st = PCATS.filter(c => partners.some(p => p.cat === c.key)).map(c => partners.filter(p => p.cat === c.key).length + ' ' + c.name).join(' · ');
  if (st) $('heroStats').textContent = st;
  /* works: 3 flat columns */
  const G = $('wGrid'); G.innerHTML = '';
  const cols = [0, 1, 2].map(() => { const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;gap:18px;flex:1;min-width:0'; G.appendChild(d); return d; });
  const hts = [0, 0, 0];
  works.forEach(p => { const k = hts.indexOf(Math.min(...hts)); cols[k].insertAdjacentHTML('beforeend', `<img src="${p.thumb}" alt="${esc(p.title)}" style="display:block;width:100%;height:auto;filter:drop-shadow(0 16px 22px rgba(0,0,0,.5))">`); hts[k] += (p.h && p.w) ? p.h / p.w : 1; });
  if (!works.length) G.innerHTML = '<p style="color:#948D80">ยังไม่มีผลงาน</p>';
  $('msg').textContent = 'โหลดแล้ว: พาร์ทเนอร์ ' + partners.length + ' ร้าน · ผลงาน ' + works.length + ' รูป';
})();
/* CSV for Framer CMS. Image columns point to files you upload to GitHub under framer/cms/ */
function csv(rows) { return '\ufeff' + rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n'); }
function save(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const catP = (k) => (PCATS.find(c => c.key === k) || {}).name || 'อื่นๆ', catW = (k) => (PFCATS.find(c => c.key === k) || {}).name || 'อื่นๆ';
$('csvP').addEventListener('click', () => {
  const rows = [['Title', 'Slug', 'Category', 'Link', 'Logo', 'Order']];
  partners.forEach((p, i) => rows.push([p.name, p.id, catP(p.cat), p.url, BASE + 'framer/cms/partners/' + p.id + '.' + ext(p.logo), i + 1]));
  save('unitac-partners.csv', csv(rows), 'text/csv;charset=utf-8');
});
$('csvW').addEventListener('click', async () => {
  const rows = [['Title', 'Slug', 'Category', 'Description', 'Image', 'Order']];
  works.forEach((p, i) => rows.push([p.title || ('ผลงาน ' + (i + 1)), p.id, catW(p.cat), p.desc || '', BASE + 'framer/cms/works/' + p.id + '.jpg', i + 1]));
  save('unitac-works.csv', csv(rows), 'text/csv;charset=utf-8');
});
$('zipImg').addEventListener('click', async () => {
  if (!window.JSZip) return alert('โหลดตัวช่วยสร้าง zip ไม่สำเร็จ ลองรีเฟรชหน้า');
  $('msg').textContent = 'กำลังเตรียมรูปความละเอียดเต็ม…';
  const z = new JSZip();
  partners.forEach(p => z.file('framer/cms/partners/' + p.id + '.' + ext(p.logo), p.logo.split(',')[1], { base64: true }));
  const { doc, getDoc } = await import('./fb.js?v=20261004u');
  for (const p of works) {
    let img = p.thumb; try { const s = await getDoc(doc(db, 'portfolioFull', p.id)); if (s.exists()) img = s.data().img; } catch (_) {}
    /* Framer CMS reads JPG reliably: re-encode */
    const jpg = await new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d'); g.fillStyle = '#141311'; g.fillRect(0, 0, c.width, c.height); g.drawImage(i, 0, 0); res(c.toDataURL('image/jpeg', .92)); }; i.src = img; });
    z.file('framer/cms/works/' + p.id + '.jpg', jpg.split(',')[1], { base64: true });
  }
  const blob = await z.generateAsync({ type: 'blob' }); save('unitac-framer-cms-images.zip', blob, 'application/zip');
  $('msg').textContent = 'ได้ไฟล์ zip แล้ว: แตกไฟล์แล้วอัปโหลดโฟลเดอร์ framer ขึ้น GitHub ก่อนนำเข้า CSV ใน Framer';
});
