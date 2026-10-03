import { auth, db, OWNER, authMsg, onAuthStateChanged, doc, collection, getDoc, getDocs, setDoc, writeBatch, serverTimestamp } from './fb.js?v=20261003k';
import { $, h, toast, toDate, daysLeft, intf } from './core.js?v=20261003k';

/* ---------- what needs attention: strip + tab badges ---------- */
const COLS = ['members', 'orders', 'warranties', 'partners', 'materials', 'portfolio', 'portfolioFull', 'admin'];
let started = false;
onAuthStateChanged(auth, (u) => { if (u && u.uid === OWNER && !started) { started = true; refresh(); } });
const seenKey = 'unitac-admin-seen-members';
function badge(tabId, n) {
  const t = $(tabId); if (!t) return; let b = t.querySelector('.tbadge');
  if (!n) { if (b) b.remove(); return; }
  if (!b) { b = h('span', 'tbadge'); t.appendChild(b); } b.textContent = n > 99 ? '99+' : String(n);
}
export async function refresh() {
  let members = [], war = [], mats = [], meta = null;
  try {
    const [ms, ws, mt, me] = await Promise.all([getDocs(collection(db, 'members')), getDocs(collection(db, 'warranties')), getDocs(collection(db, 'materials')), getDoc(doc(db, 'admin', 'meta'))]);
    members = ms.docs.map(d => d.data()); war = ws.docs.map(d => d.data()); mats = mt.docs.map(d => d.data()); meta = me.exists() ? me.data() : null;
  } catch (_) { return; }
  let seen = 0; try { seen = +localStorage.getItem(seenKey) || 0; } catch (_) {}
  if (!seen) { seen = Date.now(); try { localStorage.setItem(seenKey, String(seen)); } catch (_) {} }
  const fresh = members.filter(m => (toDate(m.createdAt) || 0) > seen).length;
  const del = members.filter(m => m.deleteRequested).length;
  const soon = war.filter(w => { const l = daysLeft(toDate(w.expiresAt)); return l > 0 && l <= 7; }).length;
  const low = mats.filter(m => m.active !== false && ((+m.sealed || 0) + (+m.open || 0)) <= (+m.low || 0) && (+m.low || 0) > 0).length;
  const last = meta && toDate(meta.lastBackupAt), age = last ? Math.floor((Date.now() - last) / 864e5) : null;
  badge('tCust', fresh + del); badge('tWar', soon); badge('tStk', low);
  const T = $('todo'); T.textContent = '';
  const add = (n, text, tab, color) => { if (!n && n !== -1) return; const b = h('button'); b.type = 'button'; const i = h('i'); if (color) i.style.setProperty('--c', color); b.append(i, n > 0 ? h('b', null, intf(n)) : '', ' ' + text); if (tab) b.addEventListener('click', () => $(tab).click()); else b.addEventListener('click', backup); T.appendChild(b); };
  add(fresh, 'สมาชิกใหม่ตั้งแต่เข้ามาครั้งก่อน', 'tCust', 'var(--ok)');
  add(del, 'คำขอลบบัญชี', 'tCust', 'var(--stop)');
  add(soon, 'ประกันใกล้หมดใน 7 วัน', 'tWar');
  add(low, 'เส้นใกล้หมด', 'tStk', 'var(--warn)');
  if (age === null || age >= 30) add(-1, age === null ? 'ยังไม่เคยสำรองข้อมูล กดเพื่อสำรองตอนนี้' : 'ไม่ได้สำรองข้อมูลมา ' + age + ' วัน กดเพื่อสำรอง', null, 'var(--stop)');
  T.hidden = !T.children.length;
}
$('tCust').addEventListener('click', () => { try { localStorage.setItem(seenKey, String(Date.now())); } catch (_) {} setTimeout(refresh, 400); });

/* ---------- backup: every collection into one JSON file ---------- */
function enc(v) {
  if (v && typeof v.toDate === 'function') return { __ts: v.toDate().toISOString() };
  if (v && typeof v === 'object' && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number') return { __ts: new Date(v.seconds * 1000).toISOString() };
  if (v instanceof Date) return { __ts: v.toISOString() };
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = enc(v[k]); return o; }
  return v;
}
function dec(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.__ts === 'string') return new Date(v.__ts);
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = dec(v[k]); return o; }
  return v;
}
async function backup() {
  const btn = $('bkBtn'); btn.disabled = true; btn.textContent = 'กำลังสำรอง…';
  try {
    const out = { app: 'unitac', version: 1, exportedAt: new Date().toISOString(), data: {} };
    const q = await getDoc(doc(db, 'public', 'queue')); if (q.exists()) out.data['public'] = { queue: enc(q.data()) };
    for (const c of COLS) { const s = await getDocs(collection(db, c)); out.data[c] = {}; s.docs.forEach(d => { out.data[c][d.id] = enc(d.data()); }); }
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'unitac-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    await setDoc(doc(db, 'admin', 'meta'), { lastBackupAt: serverTimestamp() }, { merge: true });
    const n = Object.values(out.data).reduce((s, c) => s + Object.keys(c).length, 0);
    toast('สำรองข้อมูลแล้ว ' + intf(n) + ' รายการ เก็บไฟล์ไว้ใน Google Drive หรือคอมได้เลย', 6000); refresh();
  } catch (x) { toast(authMsg(x.code), 5000); }
  btn.disabled = false; btn.textContent = 'สำรองข้อมูล';
}
$('bkBtn').addEventListener('click', backup);

/* ---------- restore: write every document back (existing ones with the same id are replaced) ---------- */
$('rsFile').addEventListener('change', async () => {
  const f = $('rsFile').files && $('rsFile').files[0]; $('rsFile').value = ''; if (!f) return;
  let j; try { j = JSON.parse(await f.text()); } catch (_) { return toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ UNITAC'); }
  if (!j || j.app !== 'unitac' || !j.data) return toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ UNITAC');
  const list = [];
  for (const c in j.data) for (const id in j.data[c]) list.push([c, id, dec(j.data[c][id])]);
  const when = new Date(j.exportedAt).toLocaleString('th-TH');
  if (!confirm('กู้คืนข้อมูล ' + list.length + ' รายการ จากไฟล์สำรองวันที่ ' + when + '?\n\nข้อมูลที่มีรหัสเดียวกันจะถูกแทนที่ด้วยของในไฟล์ ข้อมูลที่ไม่มีในไฟล์จะไม่ถูกลบ')) return;
  try {
    for (let i = 0; i < list.length; i += 300) {
      const b = writeBatch(db);
      list.slice(i, i + 300).forEach(([c, id, data]) => b.set(doc(db, c, id), data));
      await b.commit();
    }
    toast('กู้คืนเรียบร้อย ' + list.length + ' รายการ กำลังโหลดหน้าใหม่', 4000); setTimeout(() => location.reload(), 1500);
  } catch (x) { toast('กู้คืนไม่สำเร็จ: ' + authMsg(x.code), 6000); }
});

/* ---------- install as an app (home-screen icon) ---------- */
let deferred = null;
const ua = navigator.userAgent, standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Messenger|MicroMessenger/i.test(ua);
if (!standalone) $('installBtn').hidden = false;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
$('installBtn').addEventListener('click', async () => {
  if (deferred) { deferred.prompt(); const r = await deferred.userChoice; deferred = null; if (r.outcome === 'accepted') $('installBtn').hidden = true; return; }
  const box = $('instDlg') || (() => {
    const d = document.createElement('dialog'); d.id = 'instDlg';
    d.innerHTML = '<div class="dlg"><div class="dlg__head"><h2>ติดตั้งหลังร้านเป็นแอป</h2></div><div class="dlg__body" id="instBody"></div><div class="dlg__foot"><span class="sp"></span><button type="button" class="btn btn--primary" id="instOk">เข้าใจแล้ว</button></div></div>';
    document.body.appendChild(d); d.querySelector('#instOk').addEventListener('click', () => d.close()); return d;
  })();
  const steps = inApp ? ['ตอนนี้เปิดอยู่ในแอป Facebook / Messenger / LINE ซึ่งติดตั้งไม่ได้', 'กดเมนู ⋯ มุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์" (Chrome หรือ Safari)', 'เข้าหลังร้านอีกครั้ง แล้วกดปุ่ม "ติดตั้งเป็นแอป"']
    : isIOS ? ['ต้องเปิดใน Safari (Chrome บน iPhone ติดตั้งไม่ได้)', 'กดปุ่มแชร์ ⬆︎ ด้านล่างจอ', 'เลื่อนหาแล้วเลือก "เพิ่มไปยังหน้าจอโฮม" แล้วกด "เพิ่ม"']
    : ['กดเมนู ⋮ มุมขวาบนของ Chrome', 'เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"', 'กด "ติดตั้ง" ไอคอน UNITAC จะขึ้นบนหน้าจอ'];
  const b = box.querySelector('#instBody'); b.textContent = '';
  const ol = document.createElement('ol'); ol.style.cssText = 'margin:0;padding-left:1.3em;display:grid;gap:10px;line-height:1.6';
  steps.forEach(s => { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); });
  b.appendChild(ol);
  if (inApp) { const c = h('button', 'btn btn--ghost btn--sm', 'คัดลอกลิงก์หลังร้าน'); c.type = 'button'; c.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(location.href).then(() => toast('คัดลอกลิงก์แล้ว')); }); b.appendChild(c); }
  box.showModal();
});
addEventListener('appinstalled', () => { $('installBtn').hidden = true; toast('ติดตั้งแล้ว เปิดหลังร้านจากไอคอนบนหน้าจอได้เลย'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
