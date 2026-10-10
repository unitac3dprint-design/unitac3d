/* ---------- จองคิวพิมพ์ (ฝั่งลูกค้า / สมาชิก) ----------
   public/booking  : ร้านเผยแพร่ ตั้งค่า + รายการเส้นที่มี (ไม่มีราคา) + จำนวนงานที่ยืนยันแล้วต่อวัน
   bookings/{id}   : คำขอจองของสมาชิก (เห็นเฉพาะของตัวเอง) */
import { db, doc, collection, setDoc, updateDoc, onSnapshot, query, where, serverTimestamp, authMsg } from './fb.js?v=20261004w';
import { $, h, toast, toDate, memberNo } from './core.js?v=20261004w';

export const BOOK_DEFAULT = { open: true, perDay: 3, maxPending: 3, minDays: 1, maxDays: 30, alertHours: 24 };
const STATUS = {
  pending: ['รอร้านยืนยัน', 'pill--warn'], proposed: ['ร้านเสนอวันใหม่', 'pill--accent'], confirmed: ['ยืนยันคิวแล้ว', 'pill--ok'],
  declined: ['ร้านปฏิเสธคำขอ', 'pill--stop'], cancelled: ['ยกเลิกแล้ว', ''], done: ['เสร็จแล้ว', 'pill--ok']
};
const pD = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const iD = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fDay = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fMon = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' });
const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const fmt = (s) => fDay.format(pD(s));
export function cleanLink(u) {
  u = String(u || '').trim(); if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); if (!/^https?:$/.test(x.protocol) || !/\./.test(x.hostname)) return ''; return x.href.slice(0, 500); } catch (_) { return ''; }
}

let ctx = null, pub = null, mine = [], queue = null, unsubB = null, unsubP = null;
let st = { step: 1, month: null, date: '', sel: [] };

export function mountBooking(c) {
  ctx = c;   /* { user(), member() } */
  if (!unsubP) unsubP = onSnapshot(doc(db, 'public', 'booking'), (s) => { pub = s.exists() ? s.data() : null; renderMine(); if ($('bkDlg').open) renderStep(); }, () => {});
}
export function setQueue(q) { queue = q; if ($('bkDlg') && $('bkDlg').open && st.step === 1) renderStep(); }
export function watchMine(uid) {
  if (unsubB) unsubB();
  unsubB = onSnapshot(query(collection(db, 'bookings'), where('uid', '==', uid)), (s) => {
    mine = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));
    renderMine();
  }, () => { mine = []; renderMine(); });
}
const cfg = () => Object.assign({}, BOOK_DEFAULT, (pub && pub.cfg) || {});
const active = () => mine.filter(b => b.status === 'pending' || b.status === 'proposed');

/* ---------- day state ---------- */
function closedDay(ds) {
  const q = queue || {}, d = pD(ds);
  if ((q.closedDays || []).includes(d.getDay())) return 'closed';
  if ((q.items || []).some(it => it.kind === 'off' && it.start <= ds && it.end >= ds)) return 'closed';
  if (((pub && pub.cfg && pub.cfg.blocked) || []).includes(ds)) return 'closed';
  return '';
}
function dayState(ds) {
  const c = cfg(), today = new Date(); today.setHours(0, 0, 0, 0);
  const min = iD(addD(today, c.minDays)), max = iD(addD(today, c.maxDays));
  if (ds < min || ds > max) return { s: 'out' };
  if (closedDay(ds)) return { s: 'closed' };
  const used = (pub && pub.days && +pub.days[ds]) || 0, left = Math.max(0, c.perDay - used);
  if (!left) return { s: 'full', left };
  return { s: left === 1 ? 'few' : 'free', left };
}

/* ---------- my bookings on the member home ---------- */
function renderMine() {
  const sec = $('bkSec'); if (!sec) return;
  const L = $('bkList'); L.textContent = '';
  const c = cfg(), act = active();
  $('bkOpen').disabled = false;
  $('bkOpenNote').textContent = !c.open ? 'ร้านปิดรับจองชั่วคราว ทักแชทร้านได้เลย' : act.length >= c.maxPending ? 'มีคำขอค้างครบ ' + c.maxPending + ' รายการแล้ว รอร้านตอบก่อนจองเพิ่ม' : '';
  $('bkOpenNote').hidden = !$('bkOpenNote').textContent;
  const show = mine.filter(b => !['cancelled', 'declined', 'done'].includes(b.status) || (Date.now() - (toDate(b.updatedAt) || toDate(b.createdAt) || 0)) < 14 * 864e5).slice(0, 8);
  sec.hidden = !show.length;
  $('bkCount').textContent = act.length ? act.length + ' รอตอบ' : '';
  show.forEach(b => L.appendChild(card(b)));
}
function card(b) {
  const el = h('div', 'bk' + (b.status === 'proposed' ? ' bk--hi' : '') + (['cancelled', 'declined'].includes(b.status) ? ' bk--dim' : ''));
  const hd = h('div', 'bk__h'), [lab, cls] = STATUS[b.status] || [b.status, ''];
  hd.append(h('b', null, b.title || 'งานพิมพ์'), h('span', 'pill ' + cls, lab)); el.appendChild(hd);
  const mat = matText(b) || 'ให้ร้านแนะนำวัสดุ';
  const meta = h('p', 'bk__m');
  if (b.status === 'proposed') meta.textContent = 'ขอ ' + fmt(b.date) + ' → ร้านเสนอ ' + fmt(b.proposedDate);
  else meta.textContent = (b.status === 'confirmed' ? 'เริ่มพิมพ์ ' : 'ขอวันที่ ') + fmt(b.date) + (b.doneDate && b.status === 'confirmed' ? ' · คาดว่าเสร็จ ' + fmt(b.doneDate) : '');
  el.appendChild(meta);
  el.appendChild(h('p', 'bk__m', (b.qty || 1) + ' ชิ้น · ' + mat));
  if (b.shopMsg) { const m = h('p', 'bk__msg'); m.append(h('b', null, 'ร้าน: '), b.shopMsg); el.appendChild(m); }
  const acts = h('div', 'bk__acts');
  if (b.status === 'pending') acts.appendChild(btn('ยกเลิกคำขอ', 'btn btn--ghost btn--sm', () => setStatus(b, { status: 'cancelled' }, 'ยกเลิกคำขอแล้ว')));
  if (b.status === 'proposed') {
    acts.appendChild(btn('ไม่สะดวก ยกเลิก', 'btn btn--ghost btn--sm', () => setStatus(b, { status: 'cancelled' }, 'ยกเลิกแล้ว จองวันอื่นได้เลย')));
    acts.appendChild(btn('รับวันใหม่', 'btn btn--primary btn--sm', () => setStatus(b, { status: 'confirmed', date: b.proposedDate }, 'ยืนยันวันใหม่แล้ว')));
  }
  if (acts.children.length) el.appendChild(acts);
  return el;
}
function btn(t, cls, fn) { const b = h('button', cls, t); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; await fn(); b.disabled = false; }); return b; }
async function setStatus(b, data, msg) {
  const T = (x) => (window.UI18N && window.UI18N.t) ? window.UI18N.t(x) : x;
  if (data.status === 'cancelled' && !confirm(T('ยกเลิกการจองนี้?') + '\n' + (b.title || ''))) return;
  try { await updateDoc(doc(db, 'bookings', b.id), { ...data, respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }); toast(msg); }
  catch (x) { toast(authMsg(x.code)); }
}

/* ---------- booking dialog (3 steps) ---------- */
export function openBooking() {
  const c = cfg();
  if (!c.open) return toast('ร้านปิดรับจองชั่วคราว ทักแชทร้านได้เลย', 4000);
  if (active().length >= c.maxPending) return toast('มีคำขอค้างครบ ' + c.maxPending + ' รายการแล้ว รอร้านตอบก่อนจองเพิ่ม', 4500);
  const t = new Date(); t.setHours(0, 0, 0, 0); const first = addD(t, c.minDays);
  st = { step: 1, month: new Date(first.getFullYear(), first.getMonth(), 1), date: '', sel: [] };
  ['bkTitle', 'bkQty', 'bkNote'].forEach(id => { $(id).value = id === 'bkQty' ? '1' : ''; });
  $('bkLinks').textContent = ''; addLinkRow('');
  $('bkErr').hidden = true;
  renderStep(); $('bkDlg').showModal();
}
function renderStep() {
  const s = st.step;
  document.querySelectorAll('#bkDlg [data-step]').forEach(e => { e.hidden = +e.dataset.step !== s; });
  document.querySelectorAll('#bkSteps i').forEach((e, i) => e.classList.toggle('on', i < s));
  $('bkStepN').textContent = s + '/3';
  $('bkBack').hidden = s === 1; $('bkNext').hidden = s === 3; $('bkSend').hidden = s !== 3;
  $('bkErr').hidden = true;
  if (s === 1) renderCal(); if (s === 2) renderMats(); if (s === 3) renderReview();
}
function renderCal() {
  const c = cfg(), m = st.month, G = $('bkCal'); G.textContent = '';
  $('bkMon').textContent = fMon.format(m);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const minM = new Date(addD(t, c.minDays).getFullYear(), addD(t, c.minDays).getMonth(), 1), maxD = addD(t, c.maxDays), maxM = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
  $('bkPrev').disabled = m <= minM; $('bkNextM').disabled = m >= maxM;
  WD.forEach(w => G.appendChild(h('span', 'bkc__w', w)));
  const lead = m.getDay(); for (let i = 0; i < lead; i++) G.appendChild(h('span', 'bkc__e'));
  const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const ds = iD(new Date(m.getFullYear(), m.getMonth(), d)), x = dayState(ds);
    const b = h('button', 'bkc__d is-' + x.s + (st.date === ds ? ' is-sel' : '')); b.type = 'button';
    const lab = { free: 'ว่าง ' + x.left, few: 'เหลือ 1', full: 'เต็ม', closed: 'หยุด', out: '' }[x.s];
    b.append(h('b', null, String(d)), h('small', null, lab));
    b.disabled = !['free', 'few'].includes(x.s);
    b.setAttribute('aria-label', fmt(ds) + (lab ? ', ' + lab : ''));
    b.addEventListener('click', () => { st.date = ds; renderCal(); });
    G.appendChild(b);
  }
  $('bkPick').textContent = st.date ? fmt(st.date) : 'ยังไม่ได้เลือกวัน';
}
function matGroups() {
  const out = []; ((pub && pub.mats) || []).forEach(g => { if (g && g.colors && g.colors.length) out.push(g); });
  return out;
}
const MAX_MATS = 5;
export function matList(b) { return (b && Array.isArray(b.materials) && b.materials.length) ? b.materials : (b && b.material ? [b.material] : []); }
export function matText(b) { const l = matList(b); return l.length ? l.map(m => [m.type, m.color].filter(Boolean).join(' · ')).join(', ') : ''; }
function picked() { const g = matGroups(); return st.sel.map(k => { const [gi, ci] = k.split(':').map(Number); const gr = g[gi], c = gr && gr.colors[ci]; return gr && c ? { type: (gr.type || '').slice(0, 40), brand: (gr.brand || '').slice(0, 40), color: (c.name || '').slice(0, 40), hex: /^#[0-9a-f]{6}$/i.test(c.hex || '') ? c.hex : '' } : null; }).filter(Boolean); }
function renderMats() {
  const W = $('bkMats'); W.textContent = '';
  const groups = matGroups();
  const none = h('button', 'bkm' + (!st.sel.length ? ' is-sel' : '')); none.type = 'button';
  none.append(h('b', null, 'ให้ร้านแนะนำ'), h('small', null, 'ไม่แน่ใจว่าใช้เส้นอะไรดี'));
  none.addEventListener('click', () => { st.sel = []; renderMats(); });
  W.appendChild(none);
  groups.forEach((g, gi) => {
    const box = h('div', 'bkg'), hd = h('div', 'bkg__h');
    hd.append(h('b', null, g.type || 'วัสดุ'));
    if (g.brand) hd.append(h('small', null, g.brand));
    box.appendChild(hd);
    const C = h('div', 'bkcolors');
    g.colors.forEach((c, ci) => {
      const k = gi + ':' + ci, on = st.sel.includes(k);
      const b = h('button', 'bksw' + (on ? ' is-sel' : '')); b.type = 'button'; b.setAttribute('aria-pressed', String(on));
      const i = h('i'); i.style.background = /^#[0-9a-f]{6}$/i.test(c.hex || '') ? c.hex : '#777';
      b.append(i, h('span', null, c.name || 'ไม่ระบุสี'));
      b.addEventListener('click', () => {
        if (on) st.sel = st.sel.filter(x => x !== k);
        else { if (st.sel.length >= MAX_MATS) return toast('เลือกได้สูงสุด ' + MAX_MATS + ' อย่าง'); st.sel = st.sel.concat(k); }
        renderMats();
      });
      C.appendChild(b);
    });
    box.appendChild(C); W.appendChild(box);
  });
  $('bkColorF').hidden = true;
  $('bkMatNote').textContent = st.sel.length ? 'เลือกแล้ว ' + st.sel.length + ' อย่าง (สูงสุด ' + MAX_MATS + ')' : 'แตะสีเพื่อเลือก เลือกได้หลายอย่าง';
  $('bkNoMats').hidden = groups.length > 0;
}
function addLinkRow(v) {
  const L = $('bkLinks'); if (L.children.length >= 3) return;
  const row = h('div', 'bkl'), inp = h('input', 'input'); inp.type = 'url'; inp.inputMode = 'url'; inp.placeholder = 'https://drive.google.com/…'; inp.value = v || ''; inp.maxLength = 500; inp.setAttribute('aria-label', 'ลิงก์ไฟล์งาน');
  row.appendChild(inp);
  if (L.children.length) { const x = h('button', 'iconbtn', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'ลบลิงก์นี้'); x.addEventListener('click', () => { row.remove(); $('bkAddLink').hidden = false; }); row.appendChild(x); }
  L.appendChild(row); $('bkAddLink').hidden = L.children.length >= 3;
}
function links() { return [...document.querySelectorAll('#bkLinks input')].map(i => cleanLink(i.value)).filter(Boolean); }
function linkHint() {
  const v = links(), raw = [...document.querySelectorAll('#bkLinks input')].map(i => i.value.trim()).filter(Boolean);
  const bad = raw.length !== v.length;
  const drive = v.some(u => /drive\.google\.com|docs\.google\.com/.test(u));
  $('bkLinkHint').textContent = bad ? 'มีลิงก์ที่ไม่ถูกต้อง ตรวจอีกครั้ง' : drive ? 'Google Drive: ตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์" ด้วย ร้านจะได้เปิดไฟล์ได้' : 'รองรับ Google Drive, OneDrive, Dropbox, Printables, Thingiverse, MakerWorld และลิงก์อื่น ๆ';
  $('bkLinkHint').className = 'hint' + (bad ? ' err' : '');
}
function readForm() {
  const ms = picked();
  return {
    title: $('bkTitle').value.trim().slice(0, 80), links: links().slice(0, 3), qty: Math.max(1, Math.min(999, Math.round(+$('bkQty').value || 0))),
    note: $('bkNote').value.trim().slice(0, 300),
    materials: ms, material: ms[0] || null
  };
}
function check(step) {
  const err = (m) => { $('bkErr').textContent = m; $('bkErr').hidden = false; return false; };
  if (step >= 1 && !st.date) return err('เลือกวันเริ่มพิมพ์ก่อน');
  if (step >= 1 && !['free', 'few'].includes(dayState(st.date).s)) return err('วันนี้รับงานไม่ได้แล้ว เลือกวันอื่น');
  if (step >= 2) {
    const f = readForm(), raw = [...document.querySelectorAll('#bkLinks input')].map(i => i.value.trim()).filter(Boolean);
    if (!f.title) return err('ใส่ชื่องาน');
    if (!f.links.length) return err('แนบลิงก์ไฟล์งานอย่างน้อย 1 ลิงก์');
    if (raw.length !== f.links.length) return err('มีลิงก์ที่ไม่ถูกต้อง ตรวจอีกครั้ง');
    if (!(+$('bkQty').value >= 1)) return err('ใส่จำนวนชิ้น');
  }
  return true;
}
function renderReview() {
  const f = readForm(), R = $('bkReview'); R.textContent = '';
  const m = ctx.member(), u = ctx.user();
  const row = (k, v) => { const d = h('div', 'kv'); d.append(h('span', null, k), h('b', null, v)); R.appendChild(d); };
  row('วันเริ่มพิมพ์', fmt(st.date)); row('ชื่องาน', f.title); row('จำนวน', f.qty + ' ชิ้น');
  row('วัสดุ', matText(f) || 'ให้ร้านแนะนำ');
  f.links.forEach((l, i) => row(i ? 'ไฟล์ ' + (i + 1) : 'ไฟล์', l.replace(/^https?:\/\//, '').slice(0, 48) + (l.length > 56 ? '…' : '')));
  if (f.note) row('หมายเหตุ', f.note);
  row('สมาชิก', (m.nickname || '') + ' · ' + memberNo(u.uid));
}
$('bkPrev') && $('bkPrev').addEventListener('click', () => { st.month = new Date(st.month.getFullYear(), st.month.getMonth() - 1, 1); renderCal(); });
$('bkNextM') && $('bkNextM').addEventListener('click', () => { st.month = new Date(st.month.getFullYear(), st.month.getMonth() + 1, 1); renderCal(); });
$('bkNext') && $('bkNext').addEventListener('click', () => { if (check(st.step)) { st.step++; renderStep(); } });
$('bkBack') && $('bkBack').addEventListener('click', () => { st.step = Math.max(1, st.step - 1); renderStep(); });
$('bkAddLink') && $('bkAddLink').addEventListener('click', () => { addLinkRow(''); const i = [...document.querySelectorAll('#bkLinks input')].pop(); if (i) i.focus(); });
$('bkLinks') && $('bkLinks').addEventListener('input', linkHint);
document.querySelectorAll('#bkDlg [data-close]').forEach(b => b.addEventListener('click', () => $('bkDlg').close()));
$('bkSend') && $('bkSend').addEventListener('click', async () => {
  if (!check(2)) return;
  const c = cfg(); if (active().length >= c.maxPending) { $('bkErr').textContent = 'มีคำขอค้างครบ ' + c.maxPending + ' รายการแล้ว'; $('bkErr').hidden = false; return; }
  const f = readForm(), u = ctx.user(), m = ctx.member(), b = $('bkSend');
  b.disabled = true;
  try {
    const ref = doc(collection(db, 'bookings'));
    await setDoc(ref, { uid: u.uid, memberNo: memberNo(u.uid), nickname: (m.nickname || '').slice(0, 20), date: st.date, ...f, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    $('bkDlg').close(); $('bkDone').showModal();
  } catch (x) { $('bkErr').textContent = authMsg(x.code); $('bkErr').hidden = false; }
  b.disabled = false;
});
$('bkOpen') && $('bkOpen').addEventListener('click', openBooking);
document.querySelectorAll('#bkDone [data-close]').forEach(b => b.addEventListener('click', () => $('bkDone').close()));
