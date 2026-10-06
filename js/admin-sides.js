import { auth, db, OWNER, authMsg, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, writeBatch, deleteDoc } from './fb.js?v=20261004o';
import { $, h, toast, normalizeImage } from './core.js?v=20261004o';
/* back office: picture or clip for the left / right side of the customer pages */
const CHUNK = 900000, MAX_VIDEO = 6 * 1024 * 1024, KEY = { L: 'left', R: 'right' };
let cfg = {}, started = false;
onAuthStateChanged(auth, (u) => { if (u && u.uid === OWNER && !started) { started = true; load(); } });
async function load() {
  try { const s = await getDoc(doc(db, 'site', 'sides')); cfg = s.exists() ? s.data() : {}; } catch (_) { cfg = {}; }
  ['L', 'R'].forEach(render);
}
async function blob(side, m) {
  const parts = await Promise.all(Array.from({ length: m.chunks }, (_, i) => getDoc(doc(db, 'sideChunks', side + '-' + m.ver + '-' + i)).then(d => d.exists() ? d.data().d : '')));
  const bin = atob(parts.join('')), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: m.mime });
}
async function render(S) {
  const side = KEY[S], m = cfg[side], pv = $('sdPv' + S); pv.textContent = '';
  $('sdDel' + S).hidden = !m; $('sdBlend' + S).checked = m ? !!m.blend : true; $('sdMotion' + S).checked = m ? !!m.motion : false; $('sdFade' + S).checked = m ? m.fade !== false : true; $('sdPos' + S).value = (m && m.pos) || 'upper'; $('sdSize' + S).value = String(Math.round(((m && m.scale) || 1) * 100)); $('sdSizeOut' + S).textContent = $('sdSize' + S).value + '%'; pv.style.setProperty('--py', { top: '0%', center: '50%', bottom: '100%' }[(m && m.pos)] || '35%');
  if (!m || m.src) { pv.appendChild(h('span', 'muted small', m && m.src ? 'ไฟล์เดิมจาก GitHub ยกเลิกแล้ว อัปคลิปใหม่' : 'ยังไม่มี')); return; }
  try {
    const url = URL.createObjectURL(await blob(side, m));
    let el; if (m.type === 'video') { el = h('video'); el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true; el.src = url; el.play().catch(() => {}); }
    else { el = h('img'); el.alt = ''; el.src = url; }
    if (m.blend) el.style.mixBlendMode = 'lighten'; pv.style.background = m.blend ? '#141311' : '#000';
    const z = h('div', 'z'); z.style.transform = 'scale(' + (m.scale || 1) + ')'; z.appendChild(el); pv.appendChild(z);
  } catch (_) { pv.appendChild(h('span', 'muted small', 'โหลดตัวอย่างไม่สำเร็จ')); }
}
const msg = (S, t) => { $('sdMsg' + S).textContent = t; };
async function save(S, type, mime, b64, size) {
  const side = KEY[S], ver = Date.now().toString(36), parts = [];
  for (let i = 0; i < b64.length; i += CHUNK) parts.push(b64.slice(i, i + CHUNK));
  for (let i = 0; i < parts.length; i++) { msg(S, 'กำลังอัปโหลด ' + Math.round((i + 1) / parts.length * 100) + '%'); await setDoc(doc(db, 'sideChunks', side + '-' + ver + '-' + i), { d: parts[i] }); }
  const old = cfg[side];
  const m = { type, mime, chunks: parts.length, ver, size, blend: $('sdBlend' + S).checked, motion: $('sdMotion' + S).checked, fade: $('sdFade' + S).checked, pos: $('sdPos' + S).value, scale: +$('sdSize' + S).value / 100, updatedAt: new Date().toISOString() };
  await setDoc(doc(db, 'site', 'sides'), { ...cfg, [side]: m });
  cfg[side] = m;
  if (old && old.chunks) { const b = writeBatch(db); for (let i = 0; i < old.chunks; i++) b.delete(doc(db, 'sideChunks', side + '-' + old.ver + '-' + i)); try { await b.commit(); } catch (_) {} }
  msg(S, 'อัปเดตแล้ว ลูกค้าจะเห็นเมื่อเปิดหน้าใหม่'); toast('อัปเดตภาพฝั่ง' + (S === 'L' ? 'ซ้าย' : 'ขวา') + 'แล้ว'); render(S);
}
['L', 'R'].forEach(S => {
  $('sdImg' + S).addEventListener('change', async () => {
    const f = $('sdImg' + S).files && $('sdImg' + S).files[0]; $('sdImg' + S).value = ''; if (!f) return;
    msg(S, 'กำลังเตรียมรูป…');
    try {
      const file = await normalizeImage(f);
      const im = await new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
      const s = Math.min(1, 1800 / im.naturalHeight, 1400 / im.naturalWidth), c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const type = c.toDataURL('image/webp', .5).startsWith('data:image/webp') ? 'image/webp' : 'image/png';
      let q = .9, d = c.toDataURL(type, q); while (d.length > 2.5e6 && q > .5) { q -= .08; d = c.toDataURL(type, q); }
      await save(S, 'image', type, d.split(',')[1], d.length);
    } catch (x) { msg(S, 'ใช้รูปนี้ไม่ได้ ' + (x && x.code ? authMsg(x.code) : '')); }
  });
  $('sdVid' + S).addEventListener('change', async () => {
    const f = $('sdVid' + S).files && $('sdVid' + S).files[0]; $('sdVid' + S).value = ''; if (!f) return;
    if (f.size > MAX_VIDEO) return msg(S, 'คลิปใหญ่ ' + (f.size / 1048576).toFixed(1) + ' MB เกิน 6 MB ส่งไฟล์ให้ผู้ดูแลบีบอัดก่อน (ความคมเท่าเดิม)');
    /* make sure this browser can actually play it (e.g. .mov in HEVC may not play in Chrome) */
    const ok = await new Promise(res => { const v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.onloadedmetadata = () => res(v.videoWidth > 0); v.onerror = () => res(false); v.src = URL.createObjectURL(f); setTimeout(() => res(false), 8000); });
    if (!ok) return msg(S, 'เบราว์เซอร์นี้เล่นไฟล์นี้ไม่ได้ ถ้าเป็น .mov จาก iPhone ให้แปลงเป็น MP4 (H.264) ก่อน หรือส่งไฟล์มาให้ผู้ดูแลแปลงให้');
    msg(S, 'กำลังอัปโหลดคลิป…');
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
      const mime = /quicktime|\.mov$/i.test(f.type + f.name) ? 'video/mp4' : (f.type || 'video/mp4');
      await save(S, 'video', mime, b64, f.size);
    } catch (x) { msg(S, 'อัปโหลดไม่สำเร็จ ' + (x && x.code ? authMsg(x.code) : '')); }
  });
  $('sdSize' + S).addEventListener('input', () => { $('sdSizeOut' + S).textContent = $('sdSize' + S).value + '%'; const z = $('sdPv' + S).querySelector('.z'); if (z) z.style.transform = 'scale(' + ($('sdSize' + S).value / 100) + ')'; });
  ['sdBlend', 'sdMotion', 'sdFade', 'sdPos', 'sdSize'].forEach(id => $(id + S).addEventListener('change', async () => {
    const side = KEY[S]; if (!cfg[side]) return;
    cfg[side] = { ...cfg[side], blend: $('sdBlend' + S).checked, motion: $('sdMotion' + S).checked, fade: $('sdFade' + S).checked, pos: $('sdPos' + S).value, scale: +$('sdSize' + S).value / 100 };
    try { await setDoc(doc(db, 'site', 'sides'), cfg); render(S); toast('บันทึกแล้ว'); } catch (x) { toast(authMsg(x.code)); }
  }));
  $('sdDel' + S).addEventListener('click', async () => {
    const side = KEY[S], old = cfg[side]; if (!old || !confirm('เอาภาพฝั่ง' + (S === 'L' ? 'ซ้าย' : 'ขวา') + 'ออก?')) return;
    try {
      const next = { ...cfg }; delete next[side]; await setDoc(doc(db, 'site', 'sides'), next); cfg = next;
      if (old.chunks) { const b = writeBatch(db); for (let i = 0; i < old.chunks; i++) b.delete(doc(db, 'sideChunks', side + '-' + old.ver + '-' + i)); await b.commit(); }
      msg(S, ''); toast('เอาออกแล้ว'); render(S);
    } catch (x) { toast(authMsg(x.code)); }
  });
});
