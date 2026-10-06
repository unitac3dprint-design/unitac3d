import { auth, db, OWNER, authMsg, onAuthStateChanged, doc, getDoc, setDoc, writeBatch, deleteDoc, serverTimestamp } from './fb.js?v=20261004o';
import { $, h, toast, normalizeImage } from './core.js?v=20261004o';
import { loadHero } from './heromedia.js?v=20261004o';
const CHUNK = 900000, MAX_VIDEO = 8 * 1024 * 1024;
let cur = null, started = false;
onAuthStateChanged(auth, (u) => { if (u && u.uid === OWNER && !started) { started = true; refresh(); } });
async function refresh() {
  try { const s = await getDoc(doc(db, 'site', 'hero')); cur = s.exists() ? s.data() : null; } catch (_) { cur = null; }
  const pv = $('hsPv'); pv.textContent = '';
  $('hsDel').hidden = !cur;
  if (!cur) { pv.appendChild(h('span', 'muted small', 'ยังไม่มีพื้นหลัง')); return; }
  try {
    const m = await loadHero();
    if (m && m.type === 'image') { const i = h('img'); i.src = m.src; i.alt = ''; pv.appendChild(i); }
    else if (m && m.type === 'video') { const v = h('video'); v.src = m.src; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; pv.appendChild(v); v.play().catch(() => {}); }
  } catch (_) { pv.appendChild(h('span', 'muted small', 'โหลดตัวอย่างไม่สำเร็จ')); }
}
async function clearChunks(n) { if (!n) return; const b = writeBatch(db); for (let i = 0; i < n; i++) b.delete(doc(db, 'heroChunks', String(i))); await b.commit(); }
const msg = (t) => { $('hsMsg').textContent = t; };
$('hsImg').addEventListener('change', async () => {
  const f = $('hsImg').files && $('hsImg').files[0]; $('hsImg').value = ''; if (!f) return;
  msg('กำลังเตรียมรูปความละเอียดสูง…');
  try {
    const file = await normalizeImage(f);
    const im = await new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const s = Math.min(1, 2400 / im.naturalWidth); const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const type = c.toDataURL('image/webp', .5).startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    let q = .9, d = c.toDataURL(type, q); while (d.length > 900000 && q > .5) { q -= .06; d = c.toDataURL(type, q); }
    if (d.length > 900000) throw new Error('รูปใหญ่เกินไป ลองรูปที่เล็กลง');
    const old = cur && cur.type === 'video' ? cur.chunks : 0;
    await setDoc(doc(db, 'site', 'hero'), { type: 'image', data: d, w: c.width, h: c.height, updatedAt: serverTimestamp() });
    await clearChunks(old); msg('ใช้รูปนี้เป็นพื้นหลังแล้ว (' + c.width + '×' + c.height + ')'); toast('อัปเดตพื้นหลังหน้าผลงานแล้ว'); refresh();
  } catch (x) { msg(x.message || authMsg(x.code)); }
});
$('hsVid').addEventListener('change', async () => {
  const f = $('hsVid').files && $('hsVid').files[0]; $('hsVid').value = ''; if (!f) return;
  if (f.size > MAX_VIDEO) return msg('คลิปใหญ่ ' + (f.size / 1048576).toFixed(1) + ' MB เกิน 8 MB ลองตัดให้สั้นลงหรือลดความละเอียดเป็น 1080p');
  msg('กำลังอัปโหลดคลิป…');
  try {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
    const parts = []; for (let i = 0; i < b64.length; i += CHUNK) parts.push(b64.slice(i, i + CHUNK));
    for (let i = 0; i < parts.length; i++) { msg('กำลังอัปโหลดคลิป ' + Math.round((i + 1) / parts.length * 100) + '%'); await setDoc(doc(db, 'heroChunks', String(i)), { d: parts[i] }); }
    const old = cur && cur.type === 'video' ? cur.chunks : 0;
    await setDoc(doc(db, 'site', 'hero'), { type: 'video', mime: f.type || 'video/mp4', chunks: parts.length, size: f.size, updatedAt: serverTimestamp() });
    if (old > parts.length) { const b = writeBatch(db); for (let i = parts.length; i < old; i++) b.delete(doc(db, 'heroChunks', String(i))); await b.commit(); }
    msg('ใช้คลิปนี้เป็นพื้นหลังแล้ว'); toast('อัปเดตพื้นหลังหน้าผลงานแล้ว'); refresh();
  } catch (x) { msg('อัปโหลดไม่สำเร็จ ' + (x.code ? authMsg(x.code) : '')); }
});
$('hsDel').addEventListener('click', async () => {
  if (!confirm('เอาพื้นหลังส่วนหัวหน้าผลงานออก?')) return;
  try { const old = cur && cur.type === 'video' ? cur.chunks : 0; await deleteDoc(doc(db, 'site', 'hero')); await clearChunks(old); msg(''); toast('เอาพื้นหลังออกแล้ว'); refresh(); }
  catch (x) { toast(authMsg(x.code)); }
});
