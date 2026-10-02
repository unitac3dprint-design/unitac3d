import {
  auth, db, OWNER, authMsg, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  doc, collection, getDoc, getDocs, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp, increment
} from './fb.js';
import { rankOf, couponInfo, memberNo, toDate, fDate, fDM, money, intf, daysLeft, $, h, toast, avatarEl, LOGO_SVG } from './core.js';
import { scanQR, parseMemberQR } from './scan.js';

document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
const nav = document.querySelector('.nav');
const back = h('a', null, 'หลังร้าน'); back.href = 'admin.html'; back.setAttribute('aria-current', 'page'); nav.appendChild(back);

let members = [], orders = [], cur = null;
const P = { loading: $('aLoading'), login: $('aLogin'), denied: $('aDenied'), app: $('aApp') };
function show(k) { Object.entries(P).forEach(([n, el]) => el.hidden = n !== k); }

onAuthStateChanged(auth, (u) => {
  if (!u) return show('login');
  if (u.uid !== OWNER) return show('denied');
  show('app'); loadAll();
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
  } catch (x) { toast(authMsg(x.code), 5000); }
  renderMembers(); renderOrders();
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
  $('cdRh').checked = !!m.rhodium;
  $('cdPtsN').value = ''; $('cdPtsWhy').value = '';
  const mo = orders.filter(o => o.uid === uid);
  $('cdOCount').textContent = mo.length ? mo.length + ' รายการ' : '';
  const ol = $('cdOrders'); ol.textContent = '';
  if (!mo.length) ol.appendChild(h('p', 'empty', 'ยังไม่มีออเดอร์'));
  mo.forEach(o => ol.appendChild(orderRow(o, false)));
  $('cdCalc').href = 'calc.html?m=' + encodeURIComponent(uid);
  $('cDlg').showModal();
}
$('cdRh').addEventListener('change', async () => {
  const on = $('cdRh').checked;
  try { await updateDoc(doc(db, 'members', cur.uid), { rhodium: on }); cur.rhodium = on; toast(on ? 'ตั้งเป็น Rhodium แล้ว' : 'ถอด Rhodium แล้ว'); renderMembers(); openMember(cur.uid); }
  catch (x) { $('cdRh').checked = !on; toast(authMsg(x.code)); }
});
$('cdPtsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const n = Math.trunc(Number($('cdPtsN').value)), why = $('cdPtsWhy').value.trim();
  if (!n) return toast('ใส่จำนวนแต้มที่ไม่ใช่ 0');
  if (!why) return toast('ใส่เหตุผลด้วย จะได้ย้อนดูได้');
  if ((cur.points || 0) + n < 0) return toast('แต้มติดลบไม่ได้');
  try {
    const b = writeBatch(db), oref = doc(collection(db, 'orders'));
    b.update(doc(db, 'members', cur.uid), { points: increment(n) });
    b.set(oref, { kind: 'adjust', uid: cur.uid, memberNo: cur.no, nickname: cur.nickname || '', title: why, points: n, deliveredAt: serverTimestamp() });
    await b.commit();
    cur.points = (cur.points || 0) + n; orders.unshift({ id: oref.id, kind: 'adjust', uid: cur.uid, title: why, points: n, deliveredAt: new Date() });
    toast((n > 0 ? '+' : '') + n + ' แต้ม บันทึกแล้ว'); renderMembers(); renderOrders(); openMember(cur.uid);
  } catch (x) { toast(authMsg(x.code)); }
});
$('cdDelBtn').addEventListener('click', async () => {
  if (!confirm('ลบข้อมูลสมาชิก ' + (cur.nickname || '') + ' ถาวร? ประวัติออเดอร์และประกันยังอยู่')) return;
  try { await deleteDoc(doc(db, 'members', cur.uid)); members = members.filter(m => m.uid !== cur.uid); $('cDlg').close(); renderMembers(); toast('ลบข้อมูลสมาชิกแล้ว อย่าลืมลบบัญชี login ใน Firebase console', 6000); }
  catch (x) { toast(authMsg(x.code)); }
});

/* ---------- orders ---------- */
function orderRow(o, withWho = true) {
  const row = h('div', 'row'), hd = h('div', 'row__h');
  const t = h('span', 'row__t', (o.kind === 'adjust' ? 'ปรับแต้ม: ' : '') + (o.title || 'งานพิมพ์'));
  const right = o.kind === 'adjust' ? h('span', 'pill', (o.points > 0 ? '+' : '') + intf(o.points) + ' แต้ม') : h('span', 'num small', money(o.total) + ' ฿');
  hd.append(t, right);
  const d = toDate(o.deliveredAt);
  const meta = [d ? fDate.format(d) : '', withWho && o.uid ? (o.nickname || '') + ' ' + (o.memberNo || '') : (withWho ? 'ลูกค้าทั่วไป' : ''),
    o.kind !== 'adjust' && o.points ? '+' + intf(o.points) + ' แต้ม' : ''].filter(Boolean).join(' · ');
  row.append(hd, h('span', 'row__m', meta));
  if (o.warrantyCode) {
    const w = h('button', 'linkbtn', 'ประกัน ' + o.warrantyCode); w.type = 'button';
    w.addEventListener('click', () => { if ($('cDlg').open) $('cDlg').close(); $('tWar').click(); $('wCode').value = o.warrantyCode; lookupWarranty(o.warrantyCode); });
    row.appendChild(w);
  }
  return row;
}
function renderOrders() {
  const L = $('oList'); L.textContent = '';
  const sales = orders.filter(o => o.kind !== 'adjust');
  const sum = sales.reduce((s, o) => s + (+o.total || 0), 0);
  $('oCount').textContent = 'ออเดอร์ ' + sales.length + ' รายการ · ยอดรวม ' + money(sum) + ' บาท';
  if (!orders.length) L.appendChild(h('p', 'empty', 'ออเดอร์ที่บันทึกจากเครื่องคิดเลขจะขึ้นที่นี่'));
  orders.slice(0, 100).forEach(o => L.appendChild(orderRow(o)));
}

/* ---------- warranty ---------- */
$('wForm').addEventListener('submit', (e) => { e.preventDefault(); lookupWarranty($('wCode').value); });
async function lookupWarranty(code) {
  code = (code || '').trim().toUpperCase(); const out = $('wOut'); out.textContent = '';
  if (!code) return;
  let snap; try { snap = await getDoc(doc(db, 'warranties', code)); } catch (x) { return toast(authMsg(x.code)); }
  if (!snap.exists()) { out.appendChild(h('p', 'empty', 'ไม่พบรหัสประกัน ' + code)); return; }
  const w = snap.data(), exp = toDate(w.expiresAt), left = daysLeft(exp), ok = left > 0;
  const card = h('div', 'card wcard');
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
    try { await updateDoc(doc(db, 'warranties', code), { claims }); toast('บันทึกการเคลมแล้ว'); lookupWarranty(code); } catch (x) { toast(authMsg(x.code)); }
  });
  const pub = h('a', 'small', 'เปิดหน้าเช็กประกันที่ลูกค้าเห็น'); pub.href = 'warranty.html?c=' + encodeURIComponent(code); pub.target = '_blank'; pub.rel = 'noopener';
  card.append(hd, info, cl, f, pub); out.appendChild(card);
}

document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
