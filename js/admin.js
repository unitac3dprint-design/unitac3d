import {
  auth, db, OWNER, authMsg, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp, increment
} from './fb.js?v=20261003t';
import { RANKS, rankOf, couponInfo, memberNo, toDate, fDate, fDM, money, intf, daysLeft, warrantyCode, $, h, toast, avatarEl, LOGO_SVG } from './core.js?v=20261003t';
import { CARRIERS, trackPage, cleanTrack } from './carriers.js?v=20261003t';
import { scanQR, parseMemberQR } from './scan.js?v=20261003t';

document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });

let members = [], orders = [], cur = null;
const P = { loading: $('aLoading'), login: $('aLogin'), denied: $('aDenied'), app: $('aApp') };
function show(k) { Object.entries(P).forEach(([n, el]) => el.hidden = n !== k); }

onAuthStateChanged(auth, (u) => {
  $('calcFab').hidden = true;
  if (!u) return show('login');
  if (u.uid !== OWNER) return show('denied');
  show('app'); $('calcFab').hidden = false; loadAll();
});
$('alForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = $('alOk'), er = $('alErr'); b.disabled = true; er.hidden = true;
  try { await signInWithEmailAndPassword(auth, $('alEmail').value.trim(), $('alPass').value); }
  catch (x) { er.textContent = authMsg(x.code); er.hidden = false; }
  b.disabled = false;
});
document.querySelectorAll('[data-signout]').forEach(b => b.addEventListener('click', () => signOut(auth)));

/* tabs */
document.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === t)));
  document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== t.dataset.tab);
}));

async function loadAll() {
  try {
    const [ms, os] = await Promise.all([getDocs(collection(db, 'members')), getDocs(collection(db, 'orders'))]);
    members = ms.docs.map(d => ({ uid: d.id, ...d.data(), no: memberNo(d.id) }));
    orders = os.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.deliveredAt) || 0) - (toDate(a.deliveredAt) || 0));
    await reloadWarranties();
  } catch (x) { toast(authMsg(x.code), 5000); }
  renderMembers(); renderOrders(); renderWarranties();
}

/* ---------- customers ---------- */
function rankBadge(m) {
  const r = rankOf(m), s = h('span', 'rk'), i = h('i'); i.style.setProperty('--c', r.key === 'Rhodium' ? '#E7E8EA' : r.c);
  s.append(i, r.key + ' · ' + r.disc + '%'); return s;
}
function matches(m, q) {
  if (!q) return true; q = q.toLowerCase().replace(/\s+/g, '');
  return [m.nickname, m.fullName, m.email, m.phone, m.no].some(v => (v || '').toLowerCase().replace(/[\s-]/g, '').includes(q.replace(/-/g, '')));
}
function renderMembers() {
  const q = $('cSearch').value.trim(), L = $('cList'); L.textContent = '';
  const list = members.filter(m => matches(m, q)).sort((a, b) => (b.deleteRequested - a.deleteRequested) || ((toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0)));
  $('cCount').textContent = 'สมาชิก ' + members.length + ' คน' + (q ? ' · พบ ' + list.length : '');
  if (!list.length) L.appendChild(h('p', 'empty', members.length ? 'ไม่พบสมาชิกที่ค้นหา' : 'ยังไม่มีสมาชิก'));
  list.slice(0, 200).forEach(m => {
    const b = h('button', 'crow'); b.type = 'button'; b.addEventListener('click', () => openMember(m.uid));
    const t = h('span', 'crow__t');
    t.append(h('b', null, (m.nickname || 'สมาชิก') + (m.fullName ? ' · ' + m.fullName : '')), h('span', null, [m.no, m.phone, m.email].filter(Boolean).join(' · ')));
    const r = h('span', 'crow__r'); r.appendChild(rankBadge(m));
    const fl = h('span', 'crow__flags');
    fl.appendChild(h('span', 'pill', intf(m.points || 0) + ' แต้ม'));
    if (m.deleteRequested) fl.appendChild(h('span', 'pill pill--stop', 'ขอลบบัญชี'));
    if (!m.verified) fl.appendChild(h('span', 'pill pill--warn', 'ยังไม่ยืนยันอีเมล'));
    if (m.deviceDup) fl.appendChild(h('span', 'pill pill--warn', 'เครื่องซ้ำ'));
    const c = couponInfo(m, m.uid); if (c.open) fl.appendChild(h('span', 'pill pill--accent', 'คูปอง +' + c.pct + '%'));
    r.appendChild(fl);
    b.append(avatarEl(m, 42), t, r); L.appendChild(b);
  });
}
$('cSearch').addEventListener('input', renderMembers);
$('cScan').addEventListener('click', async () => {
  const txt = await scanQR(); if (!txt) return;
  const uid = parseMemberQR(txt);
  if (!uid) return toast('QR นี้ไม่ใช่บัตรสมาชิก UNITAC');
  if (!members.find(m => m.uid === uid)) return toast('ไม่พบสมาชิกจาก QR นี้');
  openMember(uid);
});

function openMember(uid) {
  cur = members.find(m => m.uid === uid); if (!cur) return;
  const m = cur, r = rankOf(m), c = couponInfo(m, uid);
  const av = $('cdAv'); av.textContent = ''; av.appendChild(avatarEl(m, 52));
  $('cdName').textContent = (m.nickname || 'สมาชิก') + (m.fullName ? ' · ' + m.fullName : '');
  $('cdNo').textContent = m.no;
  $('cdDel').hidden = !m.deleteRequested; $('cdDelBtn').hidden = !m.deleteRequested;
  $('cdRank').textContent = r.key + ' · ' + r.disc + '%';
  $('cdPts').textContent = intf(m.points || 0);
  $('cdCoupon').textContent = c.used ? 'ใช้แล้ว' : c.expired ? 'หมดอายุ' : '+' + c.pct + '%' + (c.verified ? '' : ' (รอยืนยันอีเมล)');
  const info = $('cdInfo'); info.textContent = '';
  const created = toDate(m.createdAt);
  [['อีเมล', (m.email || '-') + (m.verified ? ' ✓' : '')], ['เบอร์', m.phone || '-'], ['สมัครเมื่อ', created ? fDate.format(created) : '-'],
   ['คูปองหมดอายุ', c.expires ? fDate.format(c.expires) : '-']].forEach(([k, v]) => { info.append(h('dt', null, k), h('dd', null, v)); });
  const ad = $('cdAddr'); ad.textContent = '';
  (m.addresses || []).forEach(a => ad.appendChild(h('div', 'addr', (a.label || 'ที่อยู่') + (a.main ? ' (หลัก)' : '') + '\n' + [a.name, a.phone].filter(Boolean).join(' · ') + '\n' + (a.addr || ''))));
  if (!(m.addresses || []).length) ad.appendChild(h('p', 'muted', 'ยังไม่มีที่อยู่'));
  fillRank(m);
  $('cdVer').hidden = !!m.verified;
  $('cdPtsN').value = ''; $('cdPtsWhy').value = ''; setMode(ptsMode);
  const mo = orders.filter(o => o.uid === uid);
  $('cdOCount').textContent = mo.length ? mo.length + ' รายการ' : '';
  const ol = $('cdOrders'); ol.textContent = '';
  if (!mo.length) ol.appendChild(h('p', 'empty', 'ยังไม่มีออเดอร์'));
  mo.forEach(o => ol.appendChild(orderRow(o, false)));
  $('cdCalc').href = 'calc.html?m=' + encodeURIComponent(uid);
  $('cDlg').showModal();
}
$('cdVerBtn').addEventListener('click', async () => {
  try { await updateDoc(doc(db, 'members', cur.uid), { verified: true }); cur.verified = true; toast('ยืนยันแทนลูกค้าแล้ว ลูกค้าใช้คูปองต้อนรับได้'); renderMembers(); openMember(cur.uid); }
  catch (x) { toast(authMsg(x.code)); }
});
/* ---------- rank & points ---------- */
function fillRank(m) {
  const r = rankOf(m), sel = $('cdRankSel'); sel.textContent = '';
  RANKS.forEach(x => { const o = h('option', null, x.key + ' · ลด ' + x.disc + '%' + (x.partner ? ' (partner)' : x.min ? ' · ' + intf(x.min) + ' แต้มขึ้นไป' : ' · เริ่มต้น')); o.value = x.key; sel.appendChild(o); });
  sel.value = r.key; $('cdNow').textContent = 'ตอนนี้ ' + r.key + ' · ' + intf(m.points || 0) + ' แต้ม'; rankNote();
}
function rankNote() {
  const m = cur; if (!m) return; const t = RANKS.find(x => x.key === $('cdRankSel').value), r = rankOf(m), p = m.points || 0;
  let s = '';
  if (t.key === r.key) s = 'แรงค์ปัจจุบัน';
  else if (t.partner) s = 'ตั้งเป็น Rhodium (partner) ส่วนลด 30% แต้มเดิมยังอยู่ ถ้าถอดออกภายหลัง ระบบคืนแรงค์ตามแต้มให้';
  else { const delta = t.min - p; s = (m.rhodium ? 'ถอดสถานะ Rhodium และ' : '') + 'ปรับแต้มเป็น ' + intf(t.min) + ' (' + (delta >= 0 ? '+' : '') + intf(delta) + ') เพื่อให้เป็น ' + t.key; }
  $('cdRankNote').textContent = s; $('cdRankOk').disabled = t.key === r.key;
}
$('cdRankSel').addEventListener('change', rankNote);
async function writePoints(newPts, why, extra) {
  const delta = newPts - (cur.points || 0), b = writeBatch(db), upd = Object.assign({}, extra || {});
  if (delta) upd.points = increment(delta);
  if (!Object.keys(upd).length) return toast('ไม่มีอะไรเปลี่ยน');
  b.update(doc(db, 'members', cur.uid), upd);
  let oref = null;
  if (delta) { oref = doc(collection(db, 'orders')); b.set(oref, { kind: 'adjust', uid: cur.uid, memberNo: cur.no, nickname: cur.nickname || '', title: why, points: delta, deliveredAt: serverTimestamp() }); }
  await b.commit();
  cur.points = newPts; if (extra && 'rhodium' in extra) cur.rhodium = extra.rhodium;
  if (oref) orders.unshift({ id: oref.id, kind: 'adjust', uid: cur.uid, memberNo: cur.no, nickname: cur.nickname || '', title: why, points: delta, deliveredAt: new Date() });
  return delta;
}
$('cdRankOk').addEventListener('click', async () => {
  const t = RANKS.find(x => x.key === $('cdRankSel').value); if (!cur || !t) return;
  try {
    if (t.partner) await writePoints(cur.points || 0, '', { rhodium: true });
    else await writePoints(t.min, ($('cdPtsWhy').value.trim() || 'ปรับแรงค์เป็น ' + t.key + ' โดยร้าน').slice(0, 80), cur.rhodium ? { rhodium: false } : null);
    toast('ตั้งแรงค์เป็น ' + t.key + ' แล้ว'); refreshAll();
  } catch (x) { toast(authMsg(x.code)); }
});
let ptsMode = 'add';
function setMode(m) {
  ptsMode = m; $('cdModeAdd').setAttribute('aria-selected', String(m === 'add')); $('cdModeSet').setAttribute('aria-selected', String(m === 'set'));
  $('cdPtsNL').textContent = m === 'add' ? 'จำนวน (ติดลบได้)' : 'แต้มรวมใหม่'; $('cdPtsN').min = m === 'set' ? '0' : '';
  $('cdPtsN').placeholder = m === 'set' && cur ? String(cur.points || 0) : '';
}
$('cdModeAdd').addEventListener('click', () => setMode('add'));
$('cdModeSet').addEventListener('click', () => setMode('set'));
$('cdPtsOk').addEventListener('click', async () => {
  const v = $('cdPtsN').value.trim(), why = $('cdPtsWhy').value.trim();
  if (v === '') return toast('ใส่จำนวนแต้ม');
  const n = Math.trunc(Number(v)), target = ptsMode === 'add' ? (cur.points || 0) + n : n;
  if (ptsMode === 'add' && !n) return toast('ใส่จำนวนแต้มที่ไม่ใช่ 0');
  if (target < 0) return toast('แต้มติดลบไม่ได้');
  if (!why) return toast('ใส่เหตุผลด้วย จะได้ย้อนดูได้');
  try { const d = await writePoints(target, why.slice(0, 80)); if (d !== undefined) { toast((d > 0 ? '+' : '') + intf(d) + ' แต้ม · รวม ' + intf(target) + ' แต้ม · ' + rankOf(cur).key); refreshAll(); } }
  catch (x) { toast(authMsg(x.code)); }
});
$('cdDelBtn').addEventListener('click', async () => {
  if (!confirm('ลบข้อมูลสมาชิก ' + (cur.nickname || '') + ' ถาวร? ประวัติออเดอร์และประกันยังอยู่')) return;
  try { await deleteDoc(doc(db, 'members', cur.uid)); members = members.filter(m => m.uid !== cur.uid); $('cDlg').close(); renderMembers(); toast('ลบข้อมูลสมาชิกแล้ว อย่าลืมลบบัญชี login ใน Firebase console', 6000); }
  catch (x) { toast(authMsg(x.code)); }
});

/* ---------- orders ---------- */
/* ---------- orders: edit / delete ---------- */
const ICO_E = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';
const ICO_D = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
function orderRow(o, withWho = true) {
  const row = h('div', 'orow'), body = h('div', 'row'), hd = h('div', 'row__h');
  body.style.padding = '0'; body.style.border = '0';
  const t = h('span', 'row__t', (o.kind === 'adjust' ? 'ปรับแต้ม: ' : '') + (o.title || 'งานพิมพ์'));
  const right = o.kind === 'adjust' ? h('span', 'pill', (o.points > 0 ? '+' : '') + intf(o.points) + ' แต้ม') : h('span', 'num small', money(o.total) + ' ฿');
  hd.append(t, right);
  const d = toDate(o.deliveredAt);
  const meta = [d ? fDate.format(d) : '', withWho && o.uid ? (o.nickname || '') + ' ' + (o.memberNo || '') : (withWho && o.kind !== 'adjust' ? 'ลูกค้าทั่วไป' : ''),
    o.kind !== 'adjust' && o.points ? '+' + intf(o.points) + ' แต้ม' : '', o.couponPct ? 'คูปอง +' + o.couponPct + '%' : '',
    o.kind !== 'adjust' ? (o.profit != null ? 'กำไร ' + money(o.profit) + ' ฿' : 'ยังไม่มีต้นทุน') : '', o.shipTrack ? '📦 ' + o.shipTrack : ''].filter(Boolean).join(' · ');
  body.append(hd, h('span', 'row__m', meta));
  if (o.warrantyCode) {
    const w = h('button', 'linkbtn', 'ประกัน ' + o.warrantyCode); w.type = 'button';
    w.addEventListener('click', () => { if ($('cDlg').open) $('cDlg').close(); openWarranty(o.warrantyCode); });
    body.appendChild(w);
  }
  const acts = h('div', 'orow__acts');
  const eb = h('button'); eb.type = 'button'; eb.innerHTML = ICO_E; eb.setAttribute('aria-label', 'แก้ไข ' + (o.title || 'ออเดอร์')); eb.addEventListener('click', () => editOrder(o));
  const db_ = h('button', 'del'); db_.type = 'button'; db_.innerHTML = ICO_D; db_.setAttribute('aria-label', 'ลบ ' + (o.title || 'ออเดอร์')); db_.addEventListener('click', () => askDelete(o));
  acts.append(eb, db_);
  row.append(body, acts);
  return row;
}
const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
let editing = null;
function calcTotal() {
  const t = (+$('oPrint').value || 0) + (+$('oDesign').value || 0) + (+$('oShip').value || 0); $('oTotal').textContent = money(t) + ' ฿';
  const cv = $('oCost').value.trim(); $('oProfit').textContent = cv === '' ? '-' : money(t - (+cv || 0)) + ' ฿ (' + (t > 0 ? ((t - (+cv || 0)) / t * 100).toFixed(0) : 0) + '%)';
  ptsNote(); return t;
}
function ptsNote() {
  const o = editing; if (!o) return;
  if (o.kind === 'adjust' || !o.uid) { $('oPtsNote').textContent = o.uid ? '' : 'ลูกค้าทั่วไป ไม่มีแต้ม'; return; }
  const np = Math.max(0, Math.floor((+$('oPrint').value || 0) / 10)), diff = np - (o.points || 0);
  $('oPtsNote').textContent = 'แต้มของออเดอร์นี้: ' + intf(o.points || 0) + ' → ' + intf(np) + (diff ? ' (ลูกค้าจะ' + (diff > 0 ? 'ได้เพิ่ม ' : 'ถูกหัก ') + intf(Math.abs(diff)) + ' แต้ม)' : '');
}
['oPrint', 'oDesign', 'oShip', 'oCost'].forEach(id => $(id).addEventListener('input', calcTotal));
function shipLink() {
  const n = cleanTrack($('oTrack').value), c = $('oCarrier').value, box = $('oLinkBox');
  box.hidden = !n; if (!n) return; const url = trackPage(n, c);
  $('oLink').textContent = url; $('oOpen').href = url;
}
function shipMsg() {
  const n = cleanTrack($('oTrack').value), c = $('oCarrier').value, o = editing;
  return 'ส่งของแล้วครับ 📦 ' + ((o && o.title) || '') + '\nขนส่ง ' + CARRIERS[c].name + ' เลขพัสดุ ' + n + '\nกดดูสถานะได้เลย ' + trackPage(n, c);
}
$('oTrack').addEventListener('input', shipLink); $('oCarrier').addEventListener('change', shipLink);
$('oCopyLink').addEventListener('click', () => navigator.clipboard.writeText(trackPage(cleanTrack($('oTrack').value), $('oCarrier').value)).then(() => toast('คัดลอกลิงก์แล้ว')));
$('oCopyMsg').addEventListener('click', () => navigator.clipboard.writeText(shipMsg()).then(() => toast('คัดลอกข้อความแล้ว วางในแชทลูกค้าได้เลย', 4000)));
function editOrder(o) {
  editing = o; const adj = o.kind === 'adjust';
  document.querySelectorAll('.oSaleOnly').forEach(e => e.hidden = adj); document.querySelectorAll('.oAdjOnly').forEach(e => e.hidden = !adj);
  $('oDlgT').textContent = adj ? 'แก้ไขการปรับแต้ม' : 'แก้ไขออเดอร์';
  $('oWho').textContent = o.uid ? 'ลูกค้า: ' + (o.nickname || '') + ' ' + (o.memberNo || '') : 'ลูกค้าทั่วไป';
  $('oTitle').value = o.title || ''; const d = toDate(o.deliveredAt) || new Date(); $('oDate').value = isoDay(d);
  $('oWar').value = String(o.warrantyDays || 0); if (!$('oWar').value) $('oWar').value = '0';
  $('oPrint').value = o.printPaid != null ? o.printPaid : ''; $('oDesign').value = o.designFee || 0; $('oShip').value = o.shippingFee || 0;
  $('oPts').value = o.points || 0; $('oErr').hidden = true;
  $('oCost').value = o.realCost != null ? o.realCost : '';
  $('oCarrier').value = o.shipCarrier || 'flash'; $('oTrack').value = o.shipTrack || ''; shipLink();
  if (!adj) calcTotal(); else $('oPtsNote').textContent = '';
  $('oDlg').showModal();
}
$('oForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const o = editing; if (!o) return;
  const err = (m) => { $('oErr').textContent = m; $('oErr').hidden = false; };
  const title = $('oTitle').value.trim().slice(0, 80); if (!title) return err('ใส่ชื่องาน');
  const dv = $('oDate').value; if (!/^\d{4}-\d{2}-\d{2}$/.test(dv)) return err('เลือกวันส่งมอบ');
  const [y, mo, da] = dv.split('-').map(Number), old = toDate(o.deliveredAt) || new Date();
  const dAt = new Date(y, mo - 1, da, old.getHours(), old.getMinutes());
  const b = writeBatch(db), oref = doc(db, 'orders', o.id), mem = o.uid && members.find(m => m.uid === o.uid);
  let upd, ptsDiff = 0;
  if (o.kind === 'adjust') {
    const np = Math.trunc(+$('oPts').value || 0); if (!np) return err('แต้มต้องไม่เป็น 0');
    ptsDiff = np - (o.points || 0); upd = { title, deliveredAt: dAt, points: np };
  } else {
    const pp = Math.max(0, +$('oPrint').value || 0), df = Math.max(0, +$('oDesign').value || 0), sf = Math.max(0, +$('oShip').value || 0);
    const np = o.uid ? Math.floor(pp / 10) : 0; ptsDiff = np - (o.points || 0);
    const days = +$('oWar').value || 0; let code = o.warrantyCode || '';
    const exp = days ? new Date(dAt.getTime() + days * 864e5) : null;
    if (days && !code) code = warrantyCode();
    if (days) b.set(doc(db, 'warranties', code), { title, days, deliveredAt: dAt, expiresAt: exp, claims: (warranties.find(w => w.id === code) || {}).claims || [] });
    else if (code) { b.delete(doc(db, 'warranties', code)); code = ''; }
    upd = { title, deliveredAt: dAt, printPaid: +pp.toFixed(2), designFee: +df.toFixed(2), shippingFee: +sf.toFixed(2), total: +(pp + df + sf).toFixed(2), points: np, warrantyDays: days, warrantyCode: code, expiresAt: exp };
    const tn = cleanTrack($('oTrack').value);
    upd.shipCarrier = $('oCarrier').value; upd.shipTrack = tn; if (tn && !o.shipTrack) upd.shippedAt = new Date();
    const cv = $('oCost').value.trim();
    if (cv !== '') { upd.realCost = +Math.max(0, +cv || 0).toFixed(2); upd.profit = +(upd.total - upd.realCost).toFixed(2); }
  }
  if (ptsDiff && mem) {
    if ((mem.points || 0) + ptsDiff < 0) return err('แต้มของลูกค้าจะติดลบ ตรวจตัวเลขอีกครั้ง');
    b.update(doc(db, 'members', o.uid), { points: increment(ptsDiff) });
  }
  b.update(oref, upd);
  $('oSave').disabled = true;
  try { await b.commit(); Object.assign(o, upd); if (mem) mem.points = (mem.points || 0) + ptsDiff;
    if (upd.shipTrack) { try { const ss = await getDoc(doc(db, 'shipments', upd.shipTrack)); if (!ss.exists()) await setDoc(doc(db, 'shipments', upd.shipTrack), { number: upd.shipTrack, carrier: upd.shipCarrier, title: upd.title, events: [{ s: 'sent', title: 'ตรวจสอบและจัดส่งโดย UNITAC เรียบร้อย', detail: '', at: new Date(Date.now() - 120000).toISOString() }], eta: new Date(Date.now() + 3 * 864e5).toISOString(), source: 'manual', updatedAt: new Date().toISOString() }); } catch (_) {} } $('oDlg').close(); toast('บันทึกการแก้ไขแล้ว' + (ptsDiff && mem ? ' · แต้ม ' + (ptsDiff > 0 ? '+' : '') + ptsDiff : '')); await reloadWarranties(); refreshAll(); }
  catch (x) { err(authMsg(x.code)); }
  $('oSave').disabled = false;
});
let deleting = null;
function askDelete(o) {
  deleting = o; const mem = o.uid && members.find(m => m.uid === o.uid);
  $('odWhat').textContent = 'ลบ "' + (o.title || 'ออเดอร์') + '"' + (o.kind !== 'adjust' ? ' ยอด ' + money(o.total) + ' บาท' : '') + ' ออกจากระบบถาวร';
  $('odPtsL').hidden = !(mem && o.points); $('odPtsT').textContent = (o.points > 0 ? 'หัก ' : 'คืน ') + intf(Math.abs(o.points || 0)) + ' แต้มจากลูกค้า ' + (o.nickname || '');
  $('odWarL').hidden = !o.warrantyCode; $('odWarT').textContent = 'ลบประกัน ' + (o.warrantyCode || '') + ' ด้วย';
  $('odCouL').hidden = !(mem && o.couponPct);
  $('odPts').checked = $('odWar').checked = $('odCou').checked = true; $('odErr').hidden = true;
  $('odDlg').showModal();
}
$('odOk').addEventListener('click', async () => {
  const o = deleting; if (!o) return; const mem = o.uid && members.find(m => m.uid === o.uid);
  const b = writeBatch(db); b.delete(doc(db, 'orders', o.id));
  const mu = {};
  if (mem && o.points && $('odPts').checked) { const take = Math.min(o.points, mem.points || 0); if (o.points > 0 ? take : o.points) mu.points = increment(o.points > 0 ? -take : -o.points); }
  if (mem && o.couponPct && $('odCou').checked) mu.welcomeUsed = false;
  if (Object.keys(mu).length) b.update(doc(db, 'members', o.uid), mu);
  if (o.warrantyCode && $('odWar').checked) b.delete(doc(db, 'warranties', o.warrantyCode));
  $('odOk').disabled = true;
  try {
    await b.commit(); orders = orders.filter(x => x.id !== o.id);
    if (mem && mu.points) mem.points = Math.max(0, (mem.points || 0) - (o.points > 0 ? Math.min(o.points, mem.points || 0) : o.points));
    if (mem && mu.welcomeUsed === false) mem.welcomeUsed = false;
    $('odDlg').close(); toast('ลบออเดอร์แล้ว'); await reloadWarranties(); refreshAll();
  } catch (x) { $('odErr').textContent = authMsg(x.code); $('odErr').hidden = false; }
  $('odOk').disabled = false;
});
function refreshAll() { renderOrders(); renderMembers(); renderWarranties(); if ($('cDlg').open && cur) openMember(cur.uid); }

/* ---------- monthly summary ---------- */
const fMon = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }), fMonS = new Intl.DateTimeFormat('th-TH', { month: 'short' });
let mY = new Date().getFullYear(), mM = new Date().getMonth();
const inMonth = (o, y, m) => { const d = toDate(o.deliveredAt); return d && d.getFullYear() === y && d.getMonth() === m; };
function stat(label, value, sub, main) { const s = h('div', 'mstat' + (main ? ' mstat--main' : '')); s.append(h('span', null, label), h('b', null, value)); if (sub) s.appendChild(h('small', null, sub)); return s; }
function renderOrders() {
  $('moTitle').textContent = fMon.format(new Date(mY, mM, 1));
  const mo = orders.filter(o => inMonth(o, mY, mM)), sales = mo.filter(o => o.kind !== 'adjust');
  const sum = (k) => sales.reduce((s, o) => s + (+o[k] || 0), 0);
  const total = sum('total'), print = sum('printPaid'), disc = sum('discountTotal'), pts = mo.reduce((s, o) => s + (+o.points || 0), 0);
  const memN = sales.filter(o => o.uid).length;
  const costed = sales.filter(o => o.realCost != null), cost = costed.reduce((s, o) => s + (+o.realCost || 0), 0), profit = costed.reduce((s, o) => s + (+o.profit || 0), 0);
  const S = $('moStats'); S.textContent = '';
  S.append(stat('ยอดขายรวม', money(total) + ' ฿', sales.length + ' ออเดอร์', true), stat('ค่าพิมพ์สุทธิ', money(print) + ' ฿', 'หลังหักส่วนลด'),
    stat('ส่วนลดที่ให้', money(disc) + ' ฿', 'สมาชิก + คูปอง + ส่วนลดพิเศษ'), stat('ค่าเขียนแบบ / ค่าส่ง', intf(sum('designFee')) + ' / ' + intf(sum('shippingFee')), 'บาท · ไม่นับเป็นแต้ม'),
    stat('แต้มที่แจก', intf(pts), 'รวมการปรับแต้ม'), stat('ลูกค้าสมาชิก', memN + ' / ' + sales.length, 'ออเดอร์ของสมาชิก'),
    stat('ต้นทุนจริง', money(cost) + ' ฿', costed.length < sales.length ? 'นับ ' + costed.length + ' จาก ' + sales.length + ' ออเดอร์ · ออเดอร์เก่าใส่ต้นทุนได้ที่ปุ่มแก้ไข' : 'วัสดุ ไฟ ค่าเสื่อม'),
    stat('กำไรสุทธิ', money(profit) + ' ฿', costed.length ? 'มาร์จิ้น ' + (profit / Math.max(1, costed.reduce((s, o) => s + (+o.total || 0), 0)) * 100).toFixed(0) + '%' : 'ออเดอร์ใหม่จะคิดให้อัตโนมัติ'));
  /* last 12 months */
  const C = $('moChart'); C.textContent = ''; const now = new Date(), months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push([d.getFullYear(), d.getMonth()]); }
  const vals = months.map(([y, m]) => orders.filter(o => o.kind !== 'adjust' && inMonth(o, y, m)).reduce((s, o) => s + (+o.total || 0), 0));
  const max = Math.max(1, ...vals);
  months.forEach(([y, m], i) => {
    const b = h('button', 'bar2' + (y === mY && m === mM ? ' is-on' : '')); b.type = 'button';
    b.setAttribute('aria-label', fMon.format(new Date(y, m, 1)) + ' ยอด ' + money(vals[i]) + ' บาท');
    const bar = h('i'); bar.style.height = Math.max(2, vals[i] / max * 130) + 'px';
    b.append(h('em', null, vals[i] ? (vals[i] >= 1000 ? (vals[i] / 1000).toFixed(1) + 'k' : intf(vals[i])) : ''), bar, h('span', null, fMonS.format(new Date(y, m, 1))));
    b.addEventListener('click', () => { mY = y; mM = m; renderOrders(); }); C.appendChild(b);
  });
  $('oHead').textContent = 'ออเดอร์ ' + fMon.format(new Date(mY, mM, 1));
  $('oCount').textContent = mo.length ? mo.length + ' รายการ' : '';
  const L = $('oList'); L.textContent = '';
  if (!mo.length) L.appendChild(h('p', 'empty', 'ไม่มีออเดอร์ในเดือนนี้'));
  mo.forEach(o => L.appendChild(orderRow(o)));
}
$('moPrev').addEventListener('click', () => { const d = new Date(mY, mM - 1, 1); mY = d.getFullYear(); mM = d.getMonth(); renderOrders(); });
$('moNext').addEventListener('click', () => { const d = new Date(mY, mM + 1, 1); mY = d.getFullYear(); mM = d.getMonth(); renderOrders(); });
$('moCsv').addEventListener('click', () => {
  const mo = orders.filter(o => inMonth(o, mY, mM));
  const rows = [['วันที่', 'ประเภท', 'ชื่องาน', 'ลูกค้า', 'เลขสมาชิก', 'วัสดุ', 'จำนวน', 'น้ำหนักรวม (g)', 'ชั่วโมงพิมพ์', 'ค่าพิมพ์ก่อนลด', 'ส่วนลดรวม', 'ค่าพิมพ์สุทธิ', 'ค่าเขียนแบบ', 'ค่าส่ง', 'ยอดรวม', 'ต้นทุนจริง', 'กำไร', 'แต้ม', 'รหัสประกัน']];
  mo.slice().reverse().forEach(o => { const d = toDate(o.deliveredAt);
    rows.push([d ? d.toISOString().slice(0, 10) : '', o.kind === 'adjust' ? 'ปรับแต้ม' : 'ขาย', o.title, o.uid ? o.nickname : 'ลูกค้าทั่วไป', o.memberNo || '', o.material || '', o.qty || '', o.weight || '', o.hours || '',
      o.printSubtotal || '', o.discountTotal || '', o.printPaid || '', o.designFee || '', o.shippingFee || '', o.total || '', o.realCost != null ? o.realCost : '', o.profit != null ? o.profit : '', o.points || 0, o.warrantyCode || '']); });
  const esc = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'unitac-orders-' + mY + '-' + String(mM + 1).padStart(2, '0') + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
});
$('moNow').addEventListener('click', () => { const d = new Date(); mY = d.getFullYear(); mM = d.getMonth(); renderOrders(); });

/* ---------- warranties: all at a glance ---------- */
let warranties = [], wFilter = 'all';
async function reloadWarranties() {
  try { const s = await getDocs(collection(db, 'warranties')); warranties = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch (_) {}
}
function wState(w) { const left = daysLeft(toDate(w.expiresAt)); return left <= 0 ? 'exp' : left <= 7 ? 'soon' : 'ok'; }
function renderWarranties() {
  const q = ($('wSearch').value || '').toLowerCase().trim(), now = new Date();
  const withOrder = warranties.map(w => ({ w, o: orders.find(o => o.warrantyCode === w.id) }));
  const counts = { all: withOrder.length, ok: 0, soon: 0, exp: 0 }; withOrder.forEach(x => counts[wState(x.w)]++);
  const C = $('wChips'); C.textContent = '';
  [['all', 'ทั้งหมด'], ['ok', 'คุ้มครองอยู่'], ['soon', 'ใกล้หมด (ไม่เกิน 7 วัน)'], ['exp', 'หมดแล้ว']].forEach(([k, n]) => {
    const b = h('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(wFilter === k)); b.append(n, h('b', null, String(counts[k] + (k === 'ok' ? counts.soon : 0))));
    b.addEventListener('click', () => { wFilter = k; renderWarranties(); }); C.appendChild(b);
  });
  let list = withOrder.filter(({ w }) => wFilter === 'all' || (wFilter === 'ok' ? wState(w) !== 'exp' : wState(w) === wFilter));
  if (q) list = list.filter(({ w, o }) => [w.id, w.title, o && o.nickname, o && o.memberNo].some(v => (v || '').toLowerCase().includes(q)));
  list.sort((a, b) => { const sa = wState(a.w) === 'exp', sb = wState(b.w) === 'exp'; if (sa !== sb) return sa ? 1 : -1; return (toDate(a.w.expiresAt) || 0) - (toDate(b.w.expiresAt) || 0); });
  const L = $('wList'); L.textContent = '';
  if (!list.length) { L.appendChild(h('p', 'empty', warranties.length ? 'ไม่พบประกันตามที่กรอง' : 'ยังไม่มีประกัน ออเดอร์ที่ตั้งระยะประกันจะขึ้นที่นี่')); return; }
  list.forEach(({ w, o }) => {
    const exp = toDate(w.expiresAt), left = daysLeft(exp, now), st = wState(w), tot = w.days || 30;
    const it = h('button', 'wit'); it.type = 'button'; it.addEventListener('click', () => openWarranty(w.id));
    const hd = h('div', 'wit__h'); hd.append(h('b', null, w.title || 'งานพิมพ์'), h('span', 'pill ' + (st === 'exp' ? 'pill--stop' : st === 'soon' ? 'pill--accent' : 'pill--ok'), st === 'exp' ? 'หมดแล้ว' : 'เหลือ ' + left + ' วัน'));
    const bar = h('div', 'bar bar--thin'), f = h('span'); f.style.width = (st === 'exp' ? 100 : Math.max(3, Math.min(100, left / tot * 100))) + '%'; f.style.setProperty('--c', st === 'exp' ? 'var(--rule-strong)' : st === 'soon' ? 'var(--accent)' : 'var(--ok)'); bar.appendChild(f);
    const who = o && o.uid ? (o.nickname || '') + ' ' + (o.memberNo || '') : 'ลูกค้าทั่วไป';
    it.append(hd, bar, h('span', 'wit__m', w.id + ' · ' + who), h('span', 'wit__m', 'ส่งมอบ ' + (toDate(w.deliveredAt) ? fDate.format(toDate(w.deliveredAt)) : '-') + ' · หมด ' + (exp ? fDate.format(exp) : '-') + ((w.claims || []).length ? ' · เคลม ' + w.claims.length + ' ครั้ง' : '')));
    L.appendChild(it);
  });
}
$('wSearch').addEventListener('input', renderWarranties);
function openWarranty(code) {
  if (!$('wDlg').open) $('wDlg').showModal(); lookupWarranty(code);
}
async function lookupWarranty(code) {
  code = (code || '').trim().toUpperCase(); const out = $('wOut'); out.textContent = '';
  if (!code) return;
  let snap; try { snap = await getDoc(doc(db, 'warranties', code)); } catch (x) { return toast(authMsg(x.code)); }
  if (!snap.exists()) { out.appendChild(h('p', 'empty', 'ไม่พบรหัสประกัน ' + code)); return; }
  const w = snap.data(), exp = toDate(w.expiresAt), left = daysLeft(exp), ok = left > 0;
  const card = h('div', 'wcard');
  const hd = h('div', 'sec__h'); hd.append(h('h2', null, w.title || 'งานพิมพ์'), h('span', 'pill ' + (ok ? 'pill--ok' : 'pill--stop'), ok ? 'คุ้มครองอยู่ · เหลือ ' + left + ' วัน' : 'หมดประกันแล้ว'));
  const o = orders.find(x => x.warrantyCode === code);
  const info = h('dl', 'cd__info');
  [['รหัส', code], ['ส่งมอบ', toDate(w.deliveredAt) ? fDate.format(toDate(w.deliveredAt)) : '-'], ['หมดประกัน', exp ? fDate.format(exp) : '-'], ['ระยะประกัน', (w.days || '-') + ' วัน'],
   ['ลูกค้า', o && o.uid ? (o.nickname || '') + ' ' + (o.memberNo || '') : 'ลูกค้าทั่วไป']].forEach(([k, v]) => info.append(h('dt', null, k), h('dd', null, v)));
  const cl = h('div', 'claims'); cl.appendChild(h('h3', null, 'ประวัติเคลม (' + (w.claims || []).length + ')'));
  (w.claims || []).forEach(c => { const d = h('div', 'claim', c.note); d.prepend(h('span', null, toDate(c.at) ? fDate.format(toDate(c.at)) : '')); cl.appendChild(d); });
  const f = h('form', 'cd__ptsform'); f.noValidate = true; f.style.gridTemplateColumns = 'minmax(0,1fr) auto';
  const fld = h('div', 'field'), lb = h('label', null, 'บันทึกการเคลม'), inp = h('input'); inp.type = 'text'; inp.id = 'claimNote'; inp.maxLength = 160; inp.placeholder = 'เช่น พิมพ์ใหม่ชิ้นที่แตก'; lb.htmlFor = 'claimNote';
  fld.append(lb, inp); const sb = h('button', 'btn btn--ghost', 'บันทึกเคลม'); sb.type = 'submit'; f.append(fld, sb);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const note = inp.value.trim(); if (!note) return;
    const claims = (w.claims || []).concat([{ note: note.slice(0, 160), at: new Date().toISOString() }]);
    try { await updateDoc(doc(db, 'warranties', code), { claims }); toast('บันทึกการเคลมแล้ว'); await reloadWarranties(); renderWarranties(); lookupWarranty(code); } catch (x) { toast(authMsg(x.code)); }
  });
  const pub = h('a', 'small', 'เปิดหน้าเช็กประกันที่ลูกค้าเห็น ↗'); pub.href = 'warranty.html?c=' + encodeURIComponent(code); pub.target = '_blank'; pub.rel = 'noopener';
  card.append(hd, info, cl, f, pub); out.appendChild(card);
}

document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
