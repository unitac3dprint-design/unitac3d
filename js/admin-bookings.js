/* ---------- หลังร้าน: การจองคิวพิมพ์ ----------
   อ่าน/ตอบคำขอจองของสมาชิก · ตั้งค่า · เผยแพร่ public/booking (ตั้งค่า + เส้นที่มีแบบไม่มีราคา + จำนวนงานต่อวัน)
   เตือนในหลังร้านเมื่อมีคำขอค้างเกินเวลาที่ตั้งไว้ (ค่าเริ่มต้น 24 ชม.) */
import { auth, db, OWNER, authMsg, onAuthStateChanged, doc, collection, getDoc, getDocs, setDoc, updateDoc, onSnapshot, serverTimestamp } from './fb.js?v=20261004w';
import { $, h, toast, toDate, intf } from './core.js?v=20261004w';
import { BOOK_DEFAULT, matList } from './booking.js?v=20261010i';
import { pushState, enablePush, disablePush, syncPush } from './push.js?v=20261010h';

let list = [], cfg = { ...BOOK_DEFAULT }, queue = null, started = false, filter = 'pending', cur = null, mode = '';
const pD = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const iD = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fDay = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
const fFull = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fAt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmt = (s) => s ? fDay.format(pD(s)) : '-';
const today = () => iD(new Date());
const ageH = (b) => (Date.now() - (toDate(b.createdAt) || Date.now())) / 36e5;
const LBL = { pending: ['รอตอบ', 'pill--warn'], proposed: ['รอลูกค้าตอบ', 'pill--accent'], confirmed: ['ยืนยันแล้ว', 'pill--ok'], declined: ['ไม่รับ', 'pill--stop'], cancelled: ['ยกเลิก', ''], done: ['เสร็จแล้ว', 'pill--ok'] };

onAuthStateChanged(auth, (u) => { if (u && u.uid === OWNER && !started) { started = true; start(); syncPush(OWNER, 'owner'); } });
addEventListener('unitac-push', (e) => { const d = e.detail || {}; if (d.title) toast(d.title + (d.body ? ' · ' + d.body : ''), 6000); });
async function start() {
  if (location.hash === '#bk') setTimeout(() => { const t = $('tBk'); if (t) t.click(); }, 300);
  try { const s = await getDoc(doc(db, 'public', 'booking')); if (s.exists() && s.data().cfg) cfg = { ...BOOK_DEFAULT, ...s.data().cfg }; } catch (_) {}
  onSnapshot(doc(db, 'public', 'queue'), (s) => { queue = s.exists() ? s.data() : null; }, () => {});
  let first = true;
  onSnapshot(collection(db, 'bookings'), (s) => {
    list = s.docs.map(d => ({ id: d.id, ...d.data() }));
    render(); alertCheck();
    publish(first ? 'load' : 'change'); first = false;
  }, (x) => { $('bkaList').textContent = ''; $('bkaList').appendChild(h('p', 'muted', 'โหลดการจองไม่สำเร็จ: ' + authMsg(x.code) + ' (อัปเดต Firestore rules เป็น v11 แล้วหรือยัง?)')); });
  setInterval(alertCheck, 5 * 60000);
}

/* ---------- publish what customers may see (no prices) ---------- */
let pubT = 0, lastPub = '';
export function publish(why) { clearTimeout(pubT); pubT = setTimeout(() => doPublish(why), why === 'load' ? 0 : 600); }
async function doPublish() {
  let mats = [];
  try { const s = await getDocs(collection(db, 'materials')); mats = s.docs.map(d => d.data()); } catch (_) {}
  const spools = (m) => m.spools != null ? (+m.spools || 0) : (+m.sealed || 0) + (+m.open || 0);
  const groups = new Map();
  mats.filter(m => m.active !== false && spools(m) > 0).forEach(m => {
    const type = (m.type || '').trim() || 'อื่น ๆ', brand = (m.brand || '').trim(), k = type.toUpperCase() + '|' + brand.toUpperCase();
    if (!groups.has(k)) groups.set(k, { type, brand, colors: [] });
    const g = groups.get(k), name = (m.color || '').trim() || 'ไม่ระบุสี';
    if (!g.colors.some(c => c.name === name)) g.colors.push({ name: name.slice(0, 30), hex: /^#[0-9a-f]{6}$/i.test(m.hex || '') ? m.hex : '' });
  });
  const days = {}, t = today();
  list.filter(b => b.status === 'confirmed' && b.date >= t).forEach(b => { days[b.date] = (days[b.date] || 0) + 1; });
  const data = { cfg: { open: !!cfg.open, perDay: cfg.perDay, maxPending: cfg.maxPending, minDays: cfg.minDays, maxDays: cfg.maxDays, alertHours: cfg.alertHours, blocked: (cfg.blocked || []).filter(d => d >= t).slice(0, 60) },
    mats: [...groups.values()].sort((a, b) => a.type.localeCompare(b.type) || a.brand.localeCompare(b.brand)).slice(0, 40), days };
  const sig = JSON.stringify(data); if (sig === lastPub) return; lastPub = sig;
  try { await setDoc(doc(db, 'public', 'booking'), { ...data, updatedAt: serverTimestamp() }); } catch (_) {}
}
addEventListener('unitac-stock-changed', () => publish('stock'));

/* ---------- overdue alert (no reply within cfg.alertHours) ---------- */
function alertCheck() {
  const pend = list.filter(b => b.status === 'pending'), late = pend.filter(b => ageH(b) >= cfg.alertHours);
  const tab = $('tBk'); let bd = tab && tab.querySelector('.tbadge');
  if (tab) { if (!pend.length) { if (bd) bd.remove(); } else { if (!bd) { bd = h('span', 'tbadge'); tab.appendChild(bd); } bd.textContent = String(pend.length); bd.classList.toggle('tbadge--late', late.length > 0); } }
  const A = $('bkAlert');
  if (late.length) {
    A.hidden = false; A.textContent = '';
    const b = h('button', 'bkalert__btn'); b.type = 'button';
    b.append(h('i'), h('b', null, late.length + ' คำขอจอง'), ' ยังไม่ได้ตอบเกิน ' + cfg.alertHours + ' ชม. ลูกค้ารออยู่', h('span', null, 'ดูเลย →'));
    b.addEventListener('click', () => { filter = 'pending'; $('tBk').click(); render(); });
    A.appendChild(b);
  } else A.hidden = true;
  const base = document.title.replace(/^\(\d+\) /, ''); document.title = pend.length ? '(' + pend.length + ') ' + base : base;
  if (late.length && 'Notification' in window && Notification.permission === 'granted') {
    const key = 'unitac-bk-notified', ids = late.map(b => b.id).sort().join(',');
    let last = ''; try { last = localStorage.getItem(key) || ''; } catch (_) {}
    if (ids !== last) { try { localStorage.setItem(key, ids); new Notification('UNITAC หลังร้าน', { body: late.length + ' คำขอจองยังไม่ได้ตอบเกิน ' + cfg.alertHours + ' ชม.', icon: 'icons/icon-192.png', tag: 'unitac-bk' }); } catch (_) {} }
  }
}

/* ---------- list ---------- */
const used = (ds, except) => list.filter(b => b.status === 'confirmed' && b.date === ds && b.id !== except).length;
function closedWhy(ds) {
  const q = queue || {}, d = pD(ds);
  if ((q.closedDays || []).includes(d.getDay())) return 'วันหยุดประจำ';
  const off = (q.items || []).find(it => it.kind === 'off' && it.start <= ds && it.end >= ds); if (off) return 'ร้านหยุด' + (off.title ? ' (' + off.title + ')' : '');
  if ((cfg.blocked || []).includes(ds)) return 'ปิดรับจองวันนี้';
  return '';
}
function render() {
  const P = $('bkaList'); if (!P) return;
  const t = today();
  const groups = {
    pending: list.filter(b => b.status === 'pending').sort((a, b) => (toDate(a.createdAt) || 0) - (toDate(b.createdAt) || 0)),
    proposed: list.filter(b => b.status === 'proposed').sort((a, b) => (a.proposedDate || '').localeCompare(b.proposedDate || '')),
    confirmed: list.filter(b => b.status === 'confirmed' && b.date >= t).sort((a, b) => a.date.localeCompare(b.date)),
    history: list.filter(b => ['declined', 'cancelled', 'done'].includes(b.status) || (b.status === 'confirmed' && b.date < t)).sort((a, b) => (toDate(b.updatedAt) || 0) - (toDate(a.updatedAt) || 0)).slice(0, 60)
  };
  const F = $('bkaFil'); F.textContent = '';
  [['pending', 'รอตอบ'], ['proposed', 'รอลูกค้าตอบ'], ['confirmed', 'ยืนยันแล้ว'], ['history', 'ประวัติ']].forEach(([k, n]) => {
    const b = h('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(filter === k)); b.append(n, h('b', null, String(groups[k].length)));
    b.addEventListener('click', () => { filter = k; render(); }); F.appendChild(b);
  });
  renderWeek();
  P.textContent = '';
  const arr = groups[filter];
  if (!arr.length) P.appendChild(h('p', 'empty', { pending: 'ไม่มีคำขอรอตอบ', proposed: 'ไม่มีรายการรอลูกค้าตอบ', confirmed: 'ยังไม่มีคิวที่ยืนยัน', history: 'ยังไม่มีประวัติ' }[filter]));
  arr.forEach(b => P.appendChild(card(b)));
}
function renderWeek() {
  const W = $('bkaWeek'); W.textContent = ''; const t = new Date(); t.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i), ds = iD(d), c = used(ds), why = closedWhy(ds);
    const pend = list.filter(b => (b.status === 'pending' && b.date === ds) || (b.status === 'proposed' && b.proposedDate === ds)).length;
    const e = h('div', 'bkw' + (why ? ' is-off' : c >= cfg.perDay ? ' is-full' : ''));
    e.append(h('span', null, fDay.format(d)), h('b', null, why ? 'ปิด' : c + '/' + cfg.perDay));
    if (pend) e.appendChild(h('em', null, '+' + pend + ' รอ'));
    e.title = why || (c + ' งานยืนยันแล้ว');
    W.appendChild(e);
  }
}
function card(b) {
  const el = h('div', 'bka' + (b.status === 'pending' && ageH(b) >= cfg.alertHours ? ' bka--late' : b.status === 'pending' ? ' bka--new' : ''));
  const hd = h('div', 'bka__h'), [lab, cls] = LBL[b.status] || [b.status, ''];
  const tt = h('div'); tt.append(h('b', null, b.title || 'งานพิมพ์'), h('span', 'muted small', ' · ' + (b.nickname || 'สมาชิก') + ' ' + (b.memberNo || '')));
  const right = h('div', 'bka__r');
  if (b.status === 'pending') { const a = ageH(b); right.appendChild(h('span', 'pill ' + (a >= cfg.alertHours ? 'pill--stop' : 'pill--warn'), a < 1 ? 'ใหม่' : 'รอ ' + Math.floor(a) + ' ชม.')); }
  else right.appendChild(h('span', 'pill ' + cls, lab));
  hd.append(tt, right); el.appendChild(hd);
  const why = closedWhy(b.date), u = used(b.date, b.id);
  const dline = h('p', 'bka__m');
  dline.append('ขอวันที่ ', h('b', null, fFull.format(pD(b.date))), ' · ' + (why ? '⚠ ' + why : 'วันนั้นยืนยันแล้ว ' + u + '/' + cfg.perDay + (u >= cfg.perDay ? ' (เต็ม)' : '')));
  if (b.status === 'proposed') dline.append(' → เสนอ ', h('b', null, fmt(b.proposedDate)));
  if (b.status === 'confirmed' && b.doneDate) dline.append(' · เสร็จ ', h('b', null, fmt(b.doneDate)));
  el.appendChild(dline);
  const mat = h('p', 'bka__m');
  const ml = matList(b);
  if (ml.length) ml.forEach((x, i) => { const sw = h('i', 'bka__sw'); if (x.hex) sw.style.background = x.hex; mat.append(i ? ', ' : '', sw, [x.type, x.brand, x.color].filter(Boolean).join(' · ')); });
  else mat.append('ให้ร้านแนะนำวัสดุ');
  mat.append(' · ' + (b.qty || 1) + ' ชิ้น');
  el.appendChild(mat);
  const L = h('div', 'bka__links');
  (b.links || []).forEach((l, i) => { const a = h('a', 'linkbtn', (i ? 'ไฟล์ ' + (i + 1) + ' ' : 'เปิดไฟล์ ') + '↗'); a.href = l; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = l; L.appendChild(a); });
  if (L.children.length) el.appendChild(L);
  if (b.note) el.appendChild(h('p', 'bka__note', '“' + b.note + '”'));
  if (b.shopMsg) { const m = h('p', 'bka__m'); m.append(h('b', null, 'ข้อความถึงลูกค้า: '), b.shopMsg); el.appendChild(m); }
  el.appendChild(h('p', 'bka__m muted', 'ส่งคำขอ ' + (toDate(b.createdAt) ? fAt.format(toDate(b.createdAt)) : '-') + (b.queueItemId ? ' · อยู่ในตารางคิวแล้ว' : '')));
  const acts = h('div', 'bka__acts');
  const B = (t, c, fn) => { const x = h('button', 'btn btn--sm ' + c, t); x.type = 'button'; x.addEventListener('click', fn); acts.appendChild(x); };
  if (b.status === 'pending' || b.status === 'proposed') {
    B('ไม่รับ', 'btn--ghost bka__no', () => openAct(b, 'decline'));
    B('เสนอวันใหม่', 'btn--ghost', () => openAct(b, 'propose'));
    B('ยืนยันคิว', 'btn--primary', () => openAct(b, 'confirm'));
  } else if (b.status === 'confirmed' && b.date >= today()) {
    B('ยกเลิกคิว', 'btn--ghost bka__no', () => openAct(b, 'cancel'));
    if (!b.queueItemId) B('เพิ่มลงตารางคิว', 'btn--ghost', () => openAct(b, 'queue'));
    B('แก้วัน / ข้อความ', 'btn--ghost', () => openAct(b, 'confirm'));
  }
  if (acts.children.length) el.appendChild(acts);
  return el;
}

/* ---------- respond dialog ---------- */
function machines() { return ((queue && queue.machines) || []).filter(m => m.type !== 'design'); }
function openAct(b, m) {
  cur = b; mode = m;
  const T = { confirm: 'ยืนยันคิว', propose: 'เสนอวันใหม่', decline: 'ไม่รับงานนี้', cancel: 'ยกเลิกคิวที่ยืนยันแล้ว', queue: 'เพิ่มลงตารางคิว' }[m];
  $('bkaT').textContent = T + ' · ' + (b.title || 'งานพิมพ์');
  $('bkaDateF').hidden = !(m === 'confirm' || m === 'propose');
  $('bkaDateL').textContent = m === 'propose' ? 'วันที่เสนอให้ลูกค้า' : 'วันเริ่มพิมพ์';
  $('bkaDate').value = m === 'propose' ? (b.proposedDate || '') : b.date;
  $('bkaDoneF').hidden = !(m === 'confirm' || m === 'queue');
  $('bkaDone').value = b.doneDate || b.date;
  $('bkaMsgF').hidden = m === 'queue';
  $('bkaMsgL').textContent = m === 'decline' || m === 'cancel' ? 'เหตุผล (ลูกค้าเห็น)' : 'ข้อความถึงลูกค้า (ไม่บังคับ)';
  $('bkaMsg').value = m === 'confirm' ? (b.shopMsg || '') : '';
  const canQ = (m === 'confirm' && !b.queueItemId) || m === 'queue';
  $('bkaQF').hidden = !canQ; $('bkaQ').checked = true;
  const S = $('bkaMach'); S.textContent = ''; machines().forEach(x => { const o = h('option', null, x.name || x.id); o.value = x.id; S.appendChild(o); });
  $('bkaQName').value = b.title || '';
  $('bkaQOpts').hidden = !canQ;
  $('bkaOk').textContent = T; $('bkaOk').className = 'btn ' + (m === 'decline' || m === 'cancel' ? 'btn--danger' : 'btn--primary');
  $('bkaErr').hidden = true; dayNote();
  $('bkaDlg').showModal();
}
function dayNote() {
  const ds = $('bkaDate').value, N = $('bkaDayNote');
  if ($('bkaDateF').hidden || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) { N.textContent = ''; return; }
  const why = closedWhy(ds), u = used(ds, cur && cur.id);
  N.textContent = why ? '⚠ ' + why : 'วันนั้นยืนยันแล้ว ' + u + '/' + cfg.perDay + ' งาน' + (u >= cfg.perDay ? ' (เต็มแล้ว ยืนยันเพิ่มได้ถ้าร้านรับไหว)' : '');
  N.className = 'hint' + (why || u >= cfg.perDay ? ' err' : '');
}
$('bkaDate').addEventListener('input', dayNote);
$('bkaQ').addEventListener('change', () => { $('bkaQOpts').hidden = !$('bkaQ').checked; });
document.querySelectorAll('#bkaDlg [data-close]').forEach(b => b.addEventListener('click', () => $('bkaDlg').close()));
$('bkaOk').addEventListener('click', async () => {
  const b = cur; if (!b) return;
  const err = (t) => { $('bkaErr').textContent = t; $('bkaErr').hidden = false; };
  const ds = $('bkaDate').value, done = $('bkaDone').value, msg = $('bkaMsg').value.trim().slice(0, 300);
  const okD = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  let upd = {};
  if (mode === 'confirm') {
    if (!okD(ds)) return err('เลือกวันเริ่มพิมพ์');
    if (!okD(done) || done < ds) return err('วันเสร็จต้องเป็นวันเดียวกันหรือหลังวันเริ่ม');
    upd = { status: 'confirmed', date: ds, doneDate: done, shopMsg: msg };
  } else if (mode === 'propose') {
    if (!okD(ds)) return err('เลือกวันที่จะเสนอ');
    if (ds === b.date) return err('วันที่เสนอต้องต่างจากวันที่ลูกค้าขอ');
    upd = { status: 'proposed', proposedDate: ds, shopMsg: msg };
  } else if (mode === 'decline' || mode === 'cancel') {
    if (!msg) return err('ใส่เหตุผลสั้น ๆ ให้ลูกค้าทราบ');
    upd = { status: mode === 'decline' ? 'declined' : 'cancelled', shopMsg: msg };
  } else if (mode === 'queue') {
    if (!okD(done) || done < b.date) return err('วันเสร็จต้องเป็นวันเดียวกันหรือหลังวันเริ่ม');
    upd = { doneDate: done };
  }
  $('bkaOk').disabled = true;
  try {
    const wantQ = !$('bkaQF').hidden && $('bkaQ').checked;
    if (wantQ) {
      const qid = await addToQueue(b, upd.date || b.date, upd.doneDate || done, $('bkaMach').value, $('bkaQName').value.trim() || b.title || 'งานพิมพ์');
      if (qid) upd.queueItemId = qid;
    }
    if ((mode === 'decline' || mode === 'cancel') && b.queueItemId) await removeFromQueue(b.queueItemId);
    if (mode === 'decline' || mode === 'cancel') upd.queueItemId = '';
    await updateDoc(doc(db, 'bookings', b.id), { ...upd, updatedAt: serverTimestamp(), answeredAt: serverTimestamp() });
    $('bkaDlg').close();
    toast({ confirm: 'ยืนยันคิวแล้ว' + (upd.queueItemId ? ' · เพิ่มลงตารางคิวแล้ว' : ''), propose: 'ส่งวันที่เสนอให้ลูกค้าแล้ว', decline: 'แจ้งไม่รับงานแล้ว', cancel: 'ยกเลิกคิวแล้ว', queue: 'เพิ่มลงตารางคิวแล้ว' }[mode], 4000);
  } catch (x) { err(authMsg(x.code)); }
  $('bkaOk').disabled = false;
});
async function addToQueue(b, start, end, machine, title) {
  const s = await getDoc(doc(db, 'public', 'queue')); if (!s.exists()) throw { code: 'queue-missing' };
  const q = s.data(), id = 'bk' + Date.now().toString(36);
  q.items = q.items || [];
  const it = { id, kind: 'job', title: title.slice(0, 60), start, end, machine: machine || (machines()[0] && machines()[0].id) || 'h2d', status: 'queued', note: '' };
  if (typeof b.uid === 'string' && /^[A-Za-z0-9]{10,64}$/.test(b.uid)) it.uid = b.uid;
  q.items.push(it); q.rev = (q.rev || 0) + 1; q.updated = new Date().toISOString();
  await setDoc(doc(db, 'public', 'queue'), q); return id;
}
async function removeFromQueue(qid) {
  try { const s = await getDoc(doc(db, 'public', 'queue')); if (!s.exists()) return; const q = s.data(); const n = (q.items || []).length; q.items = (q.items || []).filter(it => it.id !== qid); if (q.items.length !== n) { q.rev = (q.rev || 0) + 1; q.updated = new Date().toISOString(); await setDoc(doc(db, 'public', 'queue'), q); } } catch (_) {}
}

/* ---------- settings ---------- */
function fillCfg() {
  $('bksOpen').checked = !!cfg.open; $('bksPer').value = cfg.perDay; $('bksPend').value = cfg.maxPending;
  $('bksMin').value = cfg.minDays; $('bksMax').value = cfg.maxDays; $('bksAlert').value = cfg.alertHours;
  $('bksBlocked').value = (cfg.blocked || []).filter(d => d >= today()).join(', ');
  pushUi();
}
$('bkaCfgBtn').addEventListener('click', () => { fillCfg(); $('bksErr').hidden = true; $('bksDlg').showModal(); });
document.querySelectorAll('#bksDlg [data-close]').forEach(b => b.addEventListener('click', () => $('bksDlg').close()));
async function pushUi() {
  const st = await pushState();
  $('bksPushSt').textContent = { on: 'เปิดอยู่ในเครื่องนี้ ✓ คำขอจองใหม่และคำขอค้างจะเด้งเข้าเครื่องนี้', off: 'ยังไม่ได้เปิดในเครื่องนี้', denied: 'เบราว์เซอร์บล็อกการแจ้งเตือนไว้ เปิดได้ที่รูปกุญแจหน้าลิงก์ → การแจ้งเตือน', 'ios-install': 'iPhone/iPad: ติดตั้งหลังร้านเป็นแอปบนหน้าจอโฮมก่อน', unsupported: 'เบราว์เซอร์นี้ไม่รองรับ ลองใช้ Chrome' }[st];
  $('bksNotif').hidden = st !== 'off'; $('bksOff').hidden = st !== 'on'; $('bksTest').hidden = st !== 'on';
}
$('bksNotif').addEventListener('click', async () => {
  try { await enablePush(OWNER, 'owner'); toast('เปิดแจ้งเตือนในเครื่องนี้แล้ว'); } catch (x) { toast(String(x && x.message) === 'denied' ? 'เบราว์เซอร์บล็อกการแจ้งเตือน' : 'เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่', 4500); }
  pushUi();
});
$('bksOff').addEventListener('click', async () => { await disablePush(); toast('ปิดแจ้งเตือนในเครื่องนี้แล้ว'); pushUi(); });
$('bksTest').addEventListener('click', async () => {
  try { await setDoc(doc(collection(db, 'broadcasts')), { to: 'owner', title: 'ทดสอบแจ้งเตือน UNITAC ✓', body: 'ถ้าเห็นข้อความนี้ แจ้งเตือนหลังร้านใช้งานได้แล้ว', link: 'admin.html#bk', createdAt: serverTimestamp() }); toast('ส่งแล้ว ควรเด้งภายในไม่กี่วินาที', 4500); }
  catch (x) { toast(authMsg(x.code), 5000); }
});
/* ---------- announcement to members ---------- */
$('bcBtn').addEventListener('click', async () => {
  $('bcErr').hidden = true; $('bcDlg').showModal(); $('bcCount').textContent = 'กำลังนับเครื่องที่เปิดรับแจ้งเตือน…';
  try { const s = await getDocs(collection(db, 'pushTokens')); const mem = s.docs.filter(d => d.data().role === 'member'); const people = new Set(mem.map(d => d.data().uid)).size;
    $('bcCount').textContent = 'สมาชิกที่เปิดแจ้งเตือนไว้ ' + people + ' คน (' + mem.length + ' เครื่อง)'; }
  catch (x) { $('bcCount').textContent = 'นับไม่ได้: ' + authMsg(x.code); }
});
document.querySelectorAll('#bcDlg [data-close]').forEach(b => b.addEventListener('click', () => $('bcDlg').close()));
$('bcSend').addEventListener('click', async () => {
  const title = $('bcTitle').value.trim(), body = $('bcBody').value.trim();
  if (!title) { $('bcErr').textContent = 'ใส่หัวข้อ'; $('bcErr').hidden = false; return; }
  if (!confirm('ส่งประกาศ "' + title + '" ถึงสมาชิกทุกคนที่เปิดแจ้งเตือน?')) return;
  $('bcSend').disabled = true;
  try { await setDoc(doc(collection(db, 'broadcasts')), { to: 'members', title: title.slice(0, 60), body: body.slice(0, 180), link: $('bcLink').value, createdAt: serverTimestamp() });
    $('bcDlg').close(); $('bcTitle').value = ''; $('bcBody').value = ''; toast('ส่งประกาศแล้ว', 4000); }
  catch (x) { $('bcErr').textContent = authMsg(x.code); $('bcErr').hidden = false; }
  $('bcSend').disabled = false;
});
$('bksSave').addEventListener('click', async () => {
  const n = (id, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+$(id).value || 0)));
  const blocked = $('bksBlocked').value.split(/[\s,]+/).map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
  const next = { open: $('bksOpen').checked, perDay: n('bksPer', 1, 50), maxPending: n('bksPend', 1, 10), minDays: n('bksMin', 0, 30), maxDays: n('bksMax', 1, 120), alertHours: n('bksAlert', 1, 168), blocked };
  if (next.maxDays <= next.minDays) { $('bksErr').textContent = 'จองล่วงหน้าสูงสุดต้องมากกว่าขั้นต่ำ'; $('bksErr').hidden = false; return; }
  cfg = { ...cfg, ...next }; lastPub = '';
  await doPublish(); $('bksDlg').close(); render(); alertCheck(); toast('บันทึกการตั้งค่าการจองแล้ว');
});
