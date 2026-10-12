import { auth, db, OWNER, authMsg, onAuthStateChanged, doc, collection, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from './fb.js?v=20261004w';
import { $, h, toast, normalizeImage, isHeic } from './core.js?v=20261004w';
import { PFCATS } from './pfcats.js?v=20261004w';

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
  if (!list.length) { L.appendChild(h('p', 'empty', 'ยังไม่มีผลงาน กด เลือกรูปจากเครื่อง หรือ ถ่ายรูป ด้านบน')); return; }
  list.forEach((p, i) => {
    const c = h('article', 'pfc' + (p.visible ? '' : ' is-off'));
    const im = h('img', 'pfc__img'); im.src = p.thumb; im.alt = ''; im.loading = 'lazy'; im.addEventListener('click', () => edit(p));
    const bd = h('div', 'pfc__b'); bd.append(h('b', null, p.title || catName(p.cat)), h('span', null, catName(p.cat) + (p.visible ? '' : ' · ซ่อนอยู่')));
    const a = h('div', 'pfc__a');
    const l = h('button'); l.type = 'button'; l.innerHTML = UP; l.setAttribute('aria-label', 'เลื่อนไปก่อน'); l.disabled = i === 0; l.addEventListener('click', () => move(p, -1));
    const r = h('button'); r.type = 'button'; r.innerHTML = DN; r.setAttribute('aria-label', 'เลื่อนไปหลัง'); r.disabled = i === list.length - 1; r.addEventListener('click', () => move(p, 1));
    const e = h('button', 'grow', 'แก้ไข'); e.type = 'button'; e.addEventListener('click', () => edit(p));
    const v = h('button', 'eye'); v.type = 'button'; v.setAttribute('aria-pressed', String(!!p.visible)); v.setAttribute('aria-label', p.visible ? 'ซ่อนจากหน้าผลงาน' : 'แสดงบนหน้าผลงาน');
    v.innerHTML = p.visible ? EYE : EYE_OFF; v.addEventListener('click', () => toggleVis(p));
    a.append(l, e, v, r); c.append(im, bd, a); L.appendChild(c);
  });
}
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
async function toggleVis(p) {
  try { await updateDoc(doc(db, 'portfolio', p.id), { visible: !p.visible }); p.visible = !p.visible; render(); toast(p.visible ? 'แสดงบนหน้าผลงานแล้ว' : 'ซ่อนจากหน้าผลงานแล้ว'); }
  catch (x) { toast(authMsg(x.code)); }
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
/* ---------- adding: pick (gallery or camera) → check in a sheet → upload with progress ---------- */
let staged = [], upCat = 'other', uploading = false;
const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
function stage(files) {
  files = [...(files || [])].filter(f => f && (/^image\//.test(f.type) || isHeic(f) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name || '')));
  if (!files.length) return;
  files.forEach(f => staged.push({ f, url: URL.createObjectURL(f), title: '', st: '' }));
  renderStage(); if (!$('pfUpDlg').open) $('pfUpDlg').showModal();
}
function renderCats() {
  const C = $('pfUpCats'); C.textContent = '';
  PFCATS.forEach(c => { const b = h('button', null, c.name); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(upCat === c.key));
    b.addEventListener('click', () => { upCat = c.key; renderCats(); }); C.appendChild(b); });
}
function renderStage() {
  const G = $('pfUpGrid'); G.textContent = '';
  const left = staged.filter(x => x.st !== 'ok').length;
  $('pfUpSub').textContent = staged.length + ' รูป' + (staged.some(x => x.st === 'ok') ? ' · ลงแล้ว ' + (staged.length - left) : '');
  staged.forEach((x, i) => {
    const it = h('div', 'pfup__i'), im = h('div', 'pfup__im'), img = h('img'); img.src = x.url; img.alt = ''; im.appendChild(img);
    if (!uploading && x.st !== 'ok') { const d = h('button', 'pfup__x'); d.type = 'button'; d.innerHTML = X; d.setAttribute('aria-label', 'เอารูปนี้ออก');
      d.addEventListener('click', () => { URL.revokeObjectURL(x.url); staged.splice(i, 1); if (!staged.length) $('pfUpDlg').close(); else renderStage(); }); im.appendChild(d); }
    if (x.st) im.appendChild(h('span', 'pfup__st' + (x.st === 'ok' ? ' is-ok' : x.st === 'bad' ? ' is-bad' : ''), x.st === 'ok' ? '✓ ลงแล้ว' : x.st === 'bad' ? 'ไม่สำเร็จ แตะลงใหม่' : x.st));
    const t = h('input'); t.type = 'text'; t.maxLength = 80; t.placeholder = 'ชื่องาน (ไม่บังคับ)'; t.value = x.title; t.disabled = uploading || x.st === 'ok';
    t.addEventListener('input', () => { x.title = t.value; });
    it.append(im, t); G.appendChild(it);
  });
  const go = $('pfUpGo');
  go.disabled = uploading || !left; go.textContent = uploading ? 'กำลังลงรูป…' : left ? 'ลงผลงาน ' + left + ' รูป' : 'เสร็จแล้ว';
  if (!uploading && !left && staged.length) { go.disabled = false; }
}
async function upload() {
  if (uploading) return;
  if (!staged.some(x => x.st !== 'ok')) { closeStage(); return; }
  uploading = true; $('pfUpErr').hidden = true; renderStage();
  const vis = $('pfUpVis').checked; let n = 0, base = items.length;
  for (const x of staged) {
    if (x.st === 'ok') continue;
    x.st = isHeic(x.f) ? 'กำลังแปลงรูป…' : 'กำลังย่อรูป…'; renderStage();
    try {
      const im = await loadImg(await normalizeImage(x.f)), th = draw(im, 640, 0.8, 140000), full = draw(im, 1800, 0.86, 900000);
      x.st = 'กำลังอัปโหลด…'; renderStage();
      const ref = doc(collection(db, 'portfolio'));
      const data = { title: (x.title || '').trim().slice(0, 80), cat: upCat, desc: '', thumb: th.d, w: th.w, h: th.h, order: base + n, visible: vis, createdAt: serverTimestamp() };
      await setDoc(doc(db, 'portfolioFull', ref.id), { img: full.d });
      await setDoc(ref, data); items.push({ id: ref.id, ...data, createdAt: new Date() }); n++; x.st = 'ok'; render();
    } catch (e) { x.st = 'bad'; }
    renderStage();
  }
  uploading = false; renderStage();
  const bad = staged.filter(x => x.st === 'bad').length;
  if (bad) { $('pfUpErr').textContent = 'ลงไม่สำเร็จ ' + bad + ' รูป กด "ลงผลงาน" อีกครั้งเพื่อลองใหม่ (รูปที่ลงแล้วไม่ซ้ำ)'; $('pfUpErr').hidden = false; staged.forEach(x => { if (x.st === 'bad') x.st = ''; }); renderStage(); }
  else { toast('ลงผลงานแล้ว ' + n + ' รูป' + (vis ? ' ขึ้นหน้าผลงานทันที' : ' (ซ่อนไว้)'), 4000); closeStage(); }
}
function closeStage() { if (uploading) return; staged.forEach(x => URL.revokeObjectURL(x.url)); staged = []; $('pfUpDlg').close(); }
renderCats();
$('pfFiles').addEventListener('change', () => { const f = $('pfFiles').files; stage(f); $('pfFiles').value = ''; });
$('pfCam').addEventListener('change', () => { const f = $('pfCam').files; stage(f); $('pfCam').value = ''; });
$('pfUpMore').addEventListener('change', () => { const f = $('pfUpMore').files; stage(f); $('pfUpMore').value = ''; });
$('pfUpGo').addEventListener('click', upload);
$('pfUpX').addEventListener('click', closeStage);
$('pfUpDlg').addEventListener('cancel', (e) => { if (uploading) e.preventDefault(); else { e.preventDefault(); closeStage(); } });
/* drop images onto the panel (computer) */
const pfPanel = document.querySelector('[data-panel="pf"]');
if (pfPanel) { pfPanel.addEventListener('dragover', (e) => { e.preventDefault(); }); pfPanel.addEventListener('drop', (e) => { e.preventDefault(); stage(e.dataTransfer && e.dataTransfer.files); }); }

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
