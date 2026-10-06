import { auth, db, OWNER, authMsg, onAuthStateChanged, doc, collection, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from './fb.js?v=20261004r';
import { $, h, toast, normalizeImage, isHeic } from './core.js?v=20261004r';
import { PFCATS } from './pfcats.js?v=20261004r';

/* portfolio: small thumbnail doc for the grid + full image doc loaded only when opened */
let items = [], cur = null, loaded = false;
PFCATS.forEach(c => { const o = h('option', null, c.name); o.value = c.key; $('pfCat').appendChild(o); });
onAuthStateChanged(auth, (u) => { if (u && u.uid === OWNER && !loaded) { loaded = true; load(); } });
async function load() {
  try { const s = await getDocs(collection(db, 'portfolio')); items = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch (x) { toast(authMsg(x.code)); }
  render();
}
const sorted = () => items.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
const catName = (k) => (PFCATS.find(c => c.key === k) || PFCATS[PFCATS.length - 1]).name;
const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
const DN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
function render() {
  const L = $('pfList'); L.textContent = '';
  const list = sorted();
  if (!list.length) { L.appendChild(h('p', 'empty', 'ยังไม่มีผลงาน กด + เพิ่มรูปผลงาน เลือกหลายรูปพร้อมกันได้')); return; }
  list.forEach((p, i) => {
    const c = h('article', 'pfc' + (p.visible ? '' : ' is-off'));
    const im = h('img', 'pfc__img'); im.src = p.thumb; im.alt = ''; im.loading = 'lazy'; im.addEventListener('click', () => edit(p));
    const bd = h('div', 'pfc__b'); bd.append(h('b', null, p.title || catName(p.cat)), h('span', null, catName(p.cat) + (p.visible ? '' : ' · ซ่อนอยู่')));
    const a = h('div', 'pfc__a');
    const l = h('button'); l.type = 'button'; l.innerHTML = UP; l.setAttribute('aria-label', 'เลื่อนไปก่อน'); l.disabled = i === 0; l.addEventListener('click', () => move(p, -1));
    const r = h('button'); r.type = 'button'; r.innerHTML = DN; r.setAttribute('aria-label', 'เลื่อนไปหลัง'); r.disabled = i === list.length - 1; r.addEventListener('click', () => move(p, 1));
    const e = h('button', 'grow', 'แก้ไข'); e.type = 'button'; e.addEventListener('click', () => edit(p));
    a.append(l, e, r); c.append(im, bd, a); L.appendChild(c);
  });
}
async function move(p, dir) {
  const list = sorted(), i = list.findIndex(x => x.id === p.id), o = list[i + dir]; if (!o) return;
  list.forEach((x, k) => { x.order = k; }); const t = p.order; p.order = o.order; o.order = t;
  try { const b = writeBatch(db); list.forEach(x => b.update(doc(db, 'portfolio', x.id), { order: x.order })); await b.commit(); render(); } catch (x) { toast(authMsg(x.code)); load(); }
}

/* image processing: thumbnail ~600px and full ~1800px, WebP when the browser supports it */
function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = rej; im.src = u; }); }
function draw(im, max, q, limit) {
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
  const g = c.getContext('2d');
  const type = c.toDataURL('image/webp', 0.5).startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  if (type === 'image/jpeg') { g.fillStyle = '#141311'; g.fillRect(0, 0, c.width, c.height); }   /* WebP keeps transparent backgrounds */
  g.drawImage(im, 0, 0, c.width, c.height);
  let d = c.toDataURL(type, q);
  while (d.length > limit && q > 0.4) { q -= 0.08; d = c.toDataURL(type, q); }
  if (d.length > limit) { c.width = Math.round(c.width * 0.75); c.height = Math.round(c.height * 0.75); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); d = c.toDataURL(type, q); }
  return { d, w: c.width, h: c.height };
}
$('pfFiles').addEventListener('change', async () => {
  const files = [...($('pfFiles').files || [])]; $('pfFiles').value = ''; if (!files.length) return;
  let n = 0, base = items.length;
  for (const f of files) {
    $('pfProg').textContent = 'กำลังเพิ่มรูป ' + (n + 1) + ' จาก ' + files.length + '…';
    try {
      if (isHeic(f)) $('pfProg').textContent = 'กำลังแปลงรูป iPhone (HEIC) ' + (n + 1) + ' จาก ' + files.length + '…';
      const im = await loadImg(await normalizeImage(f)), th = draw(im, 640, 0.8, 140000), full = draw(im, 1800, 0.86, 900000);
      const ref = doc(collection(db, 'portfolio'));
      const data = { title: '', cat: 'other', desc: '', thumb: th.d, w: th.w, h: th.h, order: base + n, visible: true, createdAt: serverTimestamp() };
      await setDoc(doc(db, 'portfolioFull', ref.id), { img: full.d });
      await setDoc(ref, data); items.push({ id: ref.id, ...data, createdAt: new Date() }); n++; render();
    } catch (x) { toast('เพิ่มรูป ' + f.name + ' ไม่สำเร็จ ' + (x && x.code ? authMsg(x.code) : ''), 5000); }
  }
  $('pfProg').textContent = n ? 'เพิ่มแล้ว ' + n + ' รูป ขึ้นหน้าผลงานทันที (หมวด อื่นๆ) กดที่รูปเพื่อเลือกหมวดหรือซ่อนได้' : '';
});

/* edit */
function edit(p) {
  cur = p; $('pfPrev').src = p.thumb; $('pfTitle').value = p.title || ''; $('pfCat').value = p.cat || 'other'; $('pfDesc').value = p.desc || ''; $('pfVis').checked = !!p.visible; $('pfErr').hidden = true;
  $('pfDlg').showModal();
}
$('pfForm').addEventListener('submit', async (e) => {
  e.preventDefault(); if (!cur) return;
  const data = { title: $('pfTitle').value.trim().slice(0, 80), cat: $('pfCat').value, desc: $('pfDesc').value.trim().slice(0, 300), visible: $('pfVis').checked };
  try { await updateDoc(doc(db, 'portfolio', cur.id), data); Object.assign(cur, data); $('pfDlg').close(); render(); toast('บันทึกแล้ว'); }
  catch (x) { $('pfErr').textContent = authMsg(x.code); $('pfErr').hidden = false; }
});
$('pfDel').addEventListener('click', async () => {
  if (!cur || !confirm('ลบรูป "' + (cur.title || '') + '" ออกจากผลงาน?')) return;
  try { const b = writeBatch(db); b.delete(doc(db, 'portfolio', cur.id)); b.delete(doc(db, 'portfolioFull', cur.id)); await b.commit(); items = items.filter(x => x.id !== cur.id); $('pfDlg').close(); render(); toast('ลบแล้ว'); }
  catch (x) { toast(authMsg(x.code)); }
});
