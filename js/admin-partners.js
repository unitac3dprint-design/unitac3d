import { auth, db, OWNER, authMsg, onAuthStateChanged, doc, collection, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from './fb.js?v=20261004o';
import { $, h, toast, normalizeImage, isHeic } from './core.js?v=20261004o';
import { PCATS } from './pcats.js?v=20261004o';

let list = [], cur = null, logo = '', loaded = false;
const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
const DN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
PCATS.forEach(c => { const o = h('option', null, c.name); o.value = c.key; $('paCat').appendChild(o); });

onAuthStateChanged(auth, (u) => { if (u && u.uid === OWNER && !loaded) { loaded = true; load(); } });
document.getElementById('tPrt').addEventListener('click', () => { if (!loaded && auth.currentUser && auth.currentUser.uid === OWNER) { loaded = true; load(); } });

async function load() {
  try { const s = await getDocs(collection(db, 'partners')); list = s.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (x) { toast(authMsg(x.code)); }
  renderList();
}
const inCat = (k) => list.filter(p => p.cat === k).sort((a, b) => (a.order || 0) - (b.order || 0));
function renderList() {
  const L = $('paList'); L.textContent = '';
  if (!list.length) { L.appendChild(h('p', 'hint', 'ยังไม่มีพาร์ทเนอร์')); return; }
  PCATS.forEach(c => {
    const items = inCat(c.key); if (!items.length) return;
    const g = h('div', 'pa__g'); g.appendChild(h('span', null, c.name.toUpperCase()));
    items.forEach((p, i) => {
      const r = h('div', 'pa__row' + (cur && cur.id === p.id ? ' is-on' : ''));
      const pick = h('button', 'pa__pick'); pick.type = 'button'; pick.setAttribute('aria-label', 'แก้ไข ' + p.name);
      const th = h('span', 'pa__thumb' + (p.tone === 'dark' ? ' is-dark' : '')); if (p.logo) { const im = h('img'); im.src = p.logo; im.alt = ''; th.appendChild(im); }
      const nm = h('span', 'pa__nm', p.name || '(ไม่มีชื่อ)');
      pick.append(th, nm); pick.addEventListener('click', () => edit(p));
      const vis = h('span', 'pill ' + (p.visible ? 'pill--ok' : ''), p.visible ? 'แสดง' : 'ซ่อน');
      const mv = h('span', 'pa__mv');
      const up = h('button'); up.type = 'button'; up.innerHTML = UP; up.setAttribute('aria-label', 'เลื่อน ' + p.name + ' ขึ้น'); up.disabled = i === 0; up.addEventListener('click', () => move(p, -1));
      const dn = h('button'); dn.type = 'button'; dn.innerHTML = DN; dn.setAttribute('aria-label', 'เลื่อน ' + p.name + ' ลง'); dn.disabled = i === items.length - 1; dn.addEventListener('click', () => move(p, 1));
      mv.append(up, dn);
      r.append(pick, vis, mv); g.appendChild(r);
    });
    L.appendChild(g);
  });
}
async function move(p, dir) {
  const items = inCat(p.cat), i = items.findIndex(x => x.id === p.id), o = items[i + dir]; if (!o) return;
  items.forEach((x, k) => { x.order = k; });
  const a = p.order, bb = o.order; p.order = bb; o.order = a;
  try { const b = writeBatch(db); items.forEach(x => b.update(doc(db, 'partners', x.id), { order: x.order })); await b.commit(); renderList(); }
  catch (x) { toast(authMsg(x.code)); load(); }
}

function preview() {
  const pv = $('paPrev'); pv.textContent = ''; pv.className = 'ptile' + ($('paDark').checked ? ' ptile--dark' : '');
  pv.style.setProperty('--s', String(Number($('paScale').value) / 100));
  $('paScaleOut').textContent = $('paScale').value + '%';
  const st = h('span', 'ptile__stage');
  if (logo) { const im = h('img'); im.src = logo; im.alt = ''; st.appendChild(im); }
  else st.appendChild(h('span', 'pa__ph', 'กดเพื่ออัปโหลดโลโก้'));
  pv.append(st, h('span', 'ptile__nm', $('paName').value.trim() || 'ชื่อร้าน'));
}
function openForm(p) {
  cur = p; logo = p ? p.logo || '' : '';
  $('paTitle').textContent = p ? 'แก้ไขพาร์ทเนอร์' : 'เพิ่มพาร์ทเนอร์';
  $('paName').value = p ? p.name || '' : ''; $('paCat').value = p ? p.cat : PCATS[0].key; $('paUrl').value = p ? p.url || '' : '';
  $('paVis').checked = p ? !!p.visible : true; $('paDark').checked = p ? p.tone === 'dark' : false;
  $('paScale').value = String(Math.round(((p && p.scale) || 1) * 100));
  $('paDel').hidden = !p; $('paErr').hidden = true;
  $('paForm').hidden = false; $('paHint').hidden = true; preview(); renderList();
}
const edit = (p) => openForm(p);
$('paAdd').addEventListener('click', () => { openForm(null); $('paName').focus(); });
$('paCancel').addEventListener('click', () => { cur = null; $('paForm').hidden = true; $('paHint').hidden = false; renderList(); });
$('paDark').addEventListener('change', preview);
$('paScale').addEventListener('input', preview);
$('paName').addEventListener('input', preview);

/* logo: SVG kept as is (<= 150 KB); bitmaps scaled to fit 480x240 and stored as PNG to keep transparency */
function readLogo(file) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = rej;
    if (file.type === 'image/svg+xml') {
      if (file.size > 150000) return rej(new Error('ไฟล์ SVG ใหญ่เกิน 150 KB'));
      r.onload = () => res(r.result); r.readAsDataURL(file); return;
    }
    r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('อ่านรูปนี้ไม่ได้')); im.onload = () => {
      const s = Math.min(1, 480 / im.naturalWidth, 240 / im.naturalHeight);
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      let d = c.toDataURL('image/png'); if (d.length > 350000) d = c.toDataURL('image/webp', 0.9);
      res(d); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}
$('paFile').addEventListener('change', async () => {
  const f = $('paFile').files && $('paFile').files[0]; $('paFile').value = ''; if (!f) return;
  try { if (isHeic(f)) toast('กำลังแปลงรูป iPhone (HEIC)…'); logo = await readLogo(await normalizeImage(f)); preview(); } catch (e) { toast(e.message || 'อ่านรูปนี้ไม่ได้', 4000); }
});
function cleanUrl(u) {
  u = (u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') && /\./.test(x.hostname) ? x.href : ''; } catch (_) { return ''; }
}
$('paForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('paErr'), name = $('paName').value.trim(), url = cleanUrl($('paUrl').value), cat = $('paCat').value;
  const bad = (m) => { err.textContent = m; err.hidden = false; };
  if (!logo) return bad('อัปโหลดโลโก้ก่อน');
  if (!name) return bad('ใส่ชื่อร้าน');
  if (!url) return bad('ลิงก์ปลายทางไม่ถูกต้อง');
  err.hidden = true; const b = $('paSave'); b.disabled = true;
  const data = { name: name.slice(0, 60), cat, url, logo, tone: $('paDark').checked ? 'dark' : 'light', visible: $('paVis').checked, scale: Number($('paScale').value) / 100 };
  try {
    if (cur) {
      if (cur.cat !== cat) data.order = inCat(cat).length;
      await updateDoc(doc(db, 'partners', cur.id), data); Object.assign(cur, data);
    } else {
      const ref = doc(collection(db, 'partners'));
      data.order = inCat(cat).length; data.createdAt = serverTimestamp();
      await setDoc(ref, data); cur = { id: ref.id, ...data }; list.push(cur);
    }
    toast('บันทึกพาร์ทเนอร์แล้ว'); openForm(cur);
  } catch (x) { bad(authMsg(x.code)); }
  b.disabled = false;
});
$('paDel').addEventListener('click', async () => {
  if (!cur || !confirm('ลบ ' + (cur.name || 'พาร์ทเนอร์นี้') + ' ออกจากหน้าพาร์ทเนอร์?')) return;
  try { await deleteDoc(doc(db, 'partners', cur.id)); list = list.filter(p => p.id !== cur.id); cur = null; $('paForm').hidden = true; $('paHint').hidden = false; renderList(); toast('ลบแล้ว'); }
  catch (x) { toast(authMsg(x.code)); }
});
