import {
  auth, db, OWNER, authMsg, onAuthStateChanged, signInWithEmailAndPassword,
  doc, collection, getDocs, writeBatch, serverTimestamp, increment
} from './fb.js';
import { rankOf, couponInfo, memberNo, pointsFor, warrantyCode, qrSvg, fDate, money, intf, $, h, toast, WARRANTY_DEFAULT } from './core.js';
import { scanQR, parseMemberQR } from './scan.js';

const U = window.UMEM;
let members = [], sel = null, isOwner = false, lastSaved = null;
const recalc = () => window.__unitac && window.__unitac.recalc && window.__unitac.recalc();

function av(m, s = 40) {
  const a = h('span', 'mav'); a.style.setProperty('--s', s + 'px');
  if (m && m.avatar) { const i = h('img'); i.src = m.avatar; i.alt = ''; a.appendChild(i); }
  else a.textContent = ((m && (m.nickname || m.email)) || '?').charAt(0).toUpperCase();
  return a;
}

/* ---------- owner session ---------- */
onAuthStateChanged(auth, async (u) => {
  isOwner = !!u && u.uid === OWNER;
  $('memLogin').hidden = isOwner; $('memPick').hidden = !!sel; $('saveOrderBtn').hidden = !isOwner;
  $('memSearch').disabled = !isOwner;
  $('memSearch').placeholder = isOwner ? 'ชื่อเล่น ชื่อจริง เบอร์ อีเมล หรือเลขสมาชิก' : 'เข้าสู่ระบบเจ้าของร้านก่อนจึงค้นหาได้';
  if (!isOwner) { clearSel(); return; }
  await loadMembers();
  const q = new URLSearchParams(location.search).get('m');
  if (q) pick(q);
});
async function loadMembers() {
  try { const s = await getDocs(collection(db, 'members')); members = s.docs.map(d => ({ uid: d.id, ...d.data(), no: memberNo(d.id) })); }
  catch (x) { toast(authMsg(x.code)); }
}
$('memLoginBtn').addEventListener('click', () => { $('lgErr').hidden = true; $('loginDlg').showModal(); setTimeout(() => $('lgEmail').focus(), 30); });
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const b = $('lgOk'); b.disabled = true;
  try { await signInWithEmailAndPassword(auth, $('lgEmail').value.trim(), $('lgPass').value); $('loginDlg').close(); toast('เข้าสู่ระบบแล้ว'); }
  catch (x) { $('lgErr').textContent = authMsg(x.code); $('lgErr').hidden = false; }
  b.disabled = false;
});

/* ---------- search ---------- */
function norm(v) { return (v || '').toLowerCase().replace(/[\s-]/g, ''); }
function created(m) { const v = m.createdAt; return v ? (typeof v === 'string' ? Date.parse(v) : (v.seconds ? v.seconds * 1000 : 0)) : 0; }
function showResults() {
  const q = norm($('memSearch').value), L = $('memRes'); L.textContent = '';
  if (!isOwner) return;
  let hits;
  if (!q) { hits = members.slice().sort((a, b) => created(b) - created(a)).slice(0, 5); if (hits.length) L.appendChild(h('li', 'hint', 'สมาชิกล่าสุด')); }
  else hits = members.filter(m => [m.nickname, m.fullName, m.email, m.phone, m.no].some(v => norm(v).includes(q))).slice(0, 8);
  if (!hits.length) { L.appendChild(h('li', 'hint', q ? 'ไม่พบสมาชิกชื่อนี้ ถ้าเป็นลูกค้าทั่วไป พิมพ์ชื่อในช่อง "ชื่องาน / ลูกค้า" ได้เลย' : 'ยังไม่มีสมาชิก')); return; }
  hits.forEach(m => {
    const li = h('li'), b = h('button'); b.type = 'button';
    const t = h('span'); t.append(h('b', null, (m.nickname || 'สมาชิก') + (m.fullName ? ' · ' + m.fullName : '')), h('small', null, [m.no, m.phone].filter(Boolean).join(' · ')));
    const r = rankOf(m), rk = h('span', 'rk', r.key + ' ' + r.disc + '%'); rk.style.color = r.key === 'Rhodium' ? 'var(--ink)' : r.c;
    b.append(av(m), t, rk); b.addEventListener('click', () => pick(m.uid)); li.appendChild(b); L.appendChild(li);
  });
}
$('memSearch').addEventListener('input', showResults);
$('memSearch').addEventListener('focus', showResults);
$('memScan').addEventListener('click', async () => {
  const t = await scanQR(); if (!t) return;
  const uid = parseMemberQR(t); if (!uid) return toast('QR นี้ไม่ใช่บัตรสมาชิก UNITAC');
  pick(uid);
});

/* ---------- select ---------- */
function pick(uid) {
  const m = members.find(x => x.uid === uid); if (!m) return toast('ไม่พบสมาชิกคนนี้');
  sel = m; const r = rankOf(m), c = couponInfo(m, uid);
  U.sel = uid; U.rankPct = r.disc; U.rankKey = r.key; U.couponPct = c.pct; U.useCoupon = c.usable;
  $('memPick').hidden = true; $('memSel').hidden = false; $('memRes').textContent = ''; $('memSearch').value = '';
  const jn = document.getElementById('jobName'); if (jn && !jn.value.trim()) { jn.value = 'งานพิมพ์ - คุณ' + (m.nickname || m.fullName || ''); jn.dispatchEvent(new Event('input', { bubbles: true })); }
  const a = $('msAv'); a.textContent = ''; a.appendChild(av(m, 44));
  $('msName').textContent = (m.nickname || 'สมาชิก') + (m.fullName ? ' · ' + m.fullName : '');
  $('msMeta').textContent = [m.no, m.phone].filter(Boolean).join(' · ');
  $('msRank').textContent = r.key + ' ' + r.disc + '%';
  const ck = $('msCoupon'); ck.checked = c.usable; ck.disabled = !c.usable;
  $('msCouponPct').textContent = '+' + c.pct + '%';
  $('msCouponNote').textContent = c.used ? 'ใช้ไปแล้ว' : c.expired ? 'หมดอายุแล้ว' : !c.verified ? 'ลูกค้ายังไม่ได้ยืนยันอีเมล จึงยังใช้ไม่ได้' : 'งานแรกเท่านั้น ส่วนคูปองลดสูงสุด 500 บาท · ใช้ได้ถึง ' + (c.expires ? fDate.format(c.expires) : '-');
  $('msCouponRow').hidden = c.used;
  dupCheck(m, c);
  const sa = $('msAddr'); sa.textContent = '';
  const o0 = h('option', null, 'รับเองที่ร้าน / ไม่ระบุ'); o0.value = ''; sa.appendChild(o0);
  (m.addresses || []).forEach(ad => { const o = h('option', null, (ad.label || 'ที่อยู่') + ' · ' + (ad.addr || '').slice(0, 40)); o.value = ad.id; if (ad.main) o.selected = true; sa.appendChild(o); });
  $('discountFieldLabel').textContent = 'ส่วนลดพิเศษเพิ่ม';
  const dv = document.getElementById('discountValue'); if (dv && Number(dv.value) > 0) toast('มีส่วนลดพิเศษค้างอยู่ในหัวข้อ 02 ตรวจอีกครั้งก่อนออกใบเสนอราคา', 4500);
  hideWarranty(); recalc();
}
function dupCheck(m, c) {
  const w = $('msWarn'); w.hidden = true; if (!c.open) return;
  const ph = norm(m.phone), addrs = (m.addresses || []).map(a => norm(a.addr)).filter(x => x.length > 10);
  const other = members.find(x => x.uid !== m.uid && x.welcomeUsed && ((ph && norm(x.phone) === ph) || (x.addresses || []).some(a => addrs.includes(norm(a.addr)))));
  if (other) { w.textContent = 'เบอร์หรือที่อยู่นี้เคยใช้คูปองต้อนรับแล้ว กับสมาชิก ' + (other.nickname || '') + ' (' + other.no + ') หนึ่งเบอร์หรือหนึ่งที่อยู่ใช้คูปองได้ครั้งเดียว'; w.hidden = false; $('msCoupon').checked = false; U.useCoupon = false; }
}
$('msCoupon').addEventListener('change', () => { U.useCoupon = $('msCoupon').checked; recalc(); });
function clearSel() {
  sel = null; U.sel = null; U.useCoupon = false; $('memSel').hidden = true; $('memPick').hidden = false;
  $('discountFieldLabel').textContent = 'ส่วนลด'; recalc();
}
$('msClear').addEventListener('click', () => { clearSel(); hideWarranty(); $('memSearch').focus(); });
const nj = document.getElementById('newJobBtn'); if (nj) nj.addEventListener('click', () => { clearSel(); hideWarranty(); });

/* quote paper member line */
window.__memRender = (r) => {
  const p = $('paperMem');
  if (!sel) { p.hidden = true; return; }
  p.hidden = false; p.textContent = 'สมาชิก ' + rankOf(sel).key + ' · ' + sel.no + (r.points > 0 ? ' · รับ +' + intf(r.points) + ' แต้ม' : '');
};
recalc();

/* ---------- save order ---------- */
function hideWarranty() { $('paperWar').hidden = true; lastSaved = null; }
$('saveOrderBtn').addEventListener('click', () => {
  const r = window.__unitac.last(); if (!r || !(r.grandTotal > 0)) return toast('ยังไม่มียอดให้บันทึก');
  if (sel && U.useCoupon && sel.welcomeUsed) { U.useCoupon = false; $('msCoupon').checked = false; recalc(); return toast('คูปองต้อนรับของลูกค้าคนนี้ใช้ไปแล้ว ตัดออกจากใบเสนอราคาแล้ว ตรวจยอดอีกครั้ง', 5000); }
  if (lastSaved && lastSaved.total === r.grandTotal) return toast('บันทึกงานนี้ไปแล้ว กด เริ่มงานใหม่ ก่อนบันทึกงานถัดไป', 4500);
  $('odTitleIn').value = (document.getElementById('jobName').value || '').trim() || 'งานพิมพ์ 3 มิติ';
  $('odDays').value = String(WARRANTY_DEFAULT);
  const sum = $('odSum'); sum.textContent = '';
  const rows = [['ลูกค้า', sel ? (sel.nickname || 'สมาชิก') + ' · ' + sel.no : 'ลูกค้าทั่วไป'], ['ค่าพิมพ์หลังหักส่วนลด', money(r.printPaid) + ' ฿'], ['ยอดรวมสุทธิ', money(r.grandTotal) + ' ฿']];
  if (sel) rows.push(['แต้มที่ได้', '+' + intf(pointsFor(r.printPaid))]);
  if (sel && r.couponDisc > 0) rows.push(['คูปองต้อนรับ', 'ใช้ (+' + r.couponPct + '%) แล้วปิด']);
  rows.forEach(([k, v]) => sum.append(h('dt', null, k), h('dd', null, v)));
  $('odErr').hidden = true; $('orderDlg').showModal();
});
$('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = window.__unitac.last(), b = $('odOk'); if (!r) return;
  const title = $('odTitleIn').value.trim().slice(0, 80) || 'งานพิมพ์ 3 มิติ', days = Number($('odDays').value) || 0;
  const pts = sel ? pointsFor(r.printPaid) : 0, code = days ? warrantyCode() : '';
  const now = new Date(), exp = days ? new Date(now.getTime() + days * 864e5) : null;
  const ad = sel ? (sel.addresses || []).find(a => a.id === $('msAddr').value) || null : null;
  b.disabled = true;
  try {
    const batch = writeBatch(db), oref = doc(collection(db, 'orders'));
    batch.set(oref, {
      kind: 'sale', uid: sel ? sel.uid : null, memberNo: sel ? sel.no : '', nickname: sel ? (sel.nickname || '') : '',
      title, rank: sel ? rankOf(sel).key : '', memberPct: r.memberPct || 0, couponPct: r.couponDisc > 0 ? r.couponPct : 0,
      printSubtotal: +r.printSubtotal.toFixed(2), discountTotal: +r.discountTotal.toFixed(2), printPaid: +r.printPaid.toFixed(2),
      designFee: +r.designFee.toFixed(2), shippingFee: +r.shippingFee.toFixed(2), total: +r.grandTotal.toFixed(2),
      points: pts, warrantyDays: days, warrantyCode: code, expiresAt: exp,
      shipTo: ad ? { label: ad.label || '', name: ad.name || '', phone: ad.phone || '', addr: ad.addr || '' } : null,
      deliveredAt: serverTimestamp()
    });
    if (code) batch.set(doc(db, 'warranties', code), { title, days, deliveredAt: serverTimestamp(), expiresAt: exp, claims: [] });
    if (sel) {
      const upd = { points: increment(pts) };
      if (r.couponDisc > 0) upd.welcomeUsed = true;
      batch.update(doc(db, 'members', sel.uid), upd);
    }
    await batch.commit();
    $('orderDlg').close();
    if (sel) { sel.points = (sel.points || 0) + pts; if (r.couponDisc > 0) { sel.welcomeUsed = true; $('msCoupon').disabled = true; $('msCouponNote').textContent = 'ใช้กับออเดอร์นี้แล้ว'; } }
    lastSaved = { total: r.grandTotal };
    if (code) {
      $('pwQr').innerHTML = qrSvg(new URL('warranty.html?c=' + code, location.href).href);
      $('pwDays').textContent = days; $('pwUntil').textContent = fDate.format(exp); $('pwCode').textContent = code;
      $('pwUrl').textContent = new URL('warranty.html', location.href).host + new URL('warranty.html', location.href).pathname;
      $('paperWar').hidden = false;
    }
    toast('บันทึกออเดอร์แล้ว' + (pts ? ' · +' + intf(pts) + ' แต้ม' : '') + (code ? ' · รหัสประกัน ' + code : ''), 5000);
  } catch (x) { $('odErr').textContent = authMsg(x.code); $('odErr').hidden = false; }
  b.disabled = false;
});

document.querySelectorAll('dialog.cd [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
