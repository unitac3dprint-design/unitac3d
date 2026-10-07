import {
  auth, db, OWNER, authMsg, onAuthStateChanged, signInWithEmailAndPassword,
  doc, collection, getDoc, getDocs, setDoc, writeBatch, serverTimestamp, increment
} from './fb.js?v=20261004w';
import { rankOf, couponInfo, memberNo, pointsFor, warrantyCode, qrSvg, fDate, money, intf, $, h, toast, WARRANTY_DEFAULT, sellPerGramOf } from './core.js?v=20261004w';
import { scanQR, parseMemberQR } from './scan.js?v=20261004w';

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
  $('memLogin').hidden = isOwner; $('memPick').hidden = !!sel; $('saveOrderBtn').hidden = !isOwner; $('queueBtn').hidden = !isOwner;
  $('memSearch').disabled = !isOwner;
  $('memSearch').placeholder = isOwner ? 'ชื่อเล่น ชื่อจริง เบอร์ อีเมล หรือเลขสมาชิก' : 'เข้าสู่ระบบเจ้าของร้านก่อนจึงค้นหาได้';
  if (!isOwner) { clearSel(); return; }
  await loadMembers();
  await loadMaterials();
  const q = new URLSearchParams(location.search).get('m');
  if (q) pick(q);
});
let webMats = [];
async function loadMaterials() {
  try {
    const s = await getDocs(collection(db, 'materials'));
    const seen = {};
    webMats = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.active !== false)
      .sort((a, b) => (a.type || '').localeCompare(b.type || '') || (a.brand || '').localeCompare(b.brand || '') || (a.color || '').localeCompare(b.color || ''))
      .map(m => {
        let code = [m.brand, m.type].filter(Boolean).join(' ') + (m.color ? ' · ' + m.color : '');
        if (seen[code]) code += ' (' + (++seen[code]) + ')'; else seen[code] = 1;
        const cpg = m.spoolWeight > 0 ? (+m.spoolCost || 0) / m.spoolWeight : 0;
        return { code, brand: m.brand || '', pricePerKg: +(sellPerGramOf(m) * 1000).toFixed(2), actualCostPerGram: cpg > 0 ? cpg : undefined, matId: m.id };
      });
    if (webMats.length && window.__unitacSetMaterials) window.__unitacSetMaterials(webMats, 'ราคาจากสต็อกเส้นในหลังร้าน ✓ (' + webMats.length + ' รายการ)');
  } catch (x) { toast(authMsg(x.code)); }
}
$('matSyncBtn').addEventListener('click', (e) => {
  if (!isOwner) return; e.stopImmediatePropagation(); e.preventDefault();
  loadMaterials().then(() => toast(webMats.length ? 'อัปเดตราคาจากสต็อกเส้นแล้ว' : 'ยังไม่มีเส้นในสต็อก เพิ่มได้ที่หลังร้าน → สต็อกเส้น', 4000));
}, true);
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
  const ck = $('msCoupon'); ck.checked = c.usable; ck.disabled = c.used || c.expired || !c.verified;
  $('msCouponPct').textContent = '+' + c.pct + '%';
  $('msCouponNote').textContent = c.used ? 'ใช้ไปแล้ว' : c.expired ? 'หมดอายุแล้ว' : c.blocked ? 'ระงับไว้ เพราะสมัครจากเครื่องที่เคยรับคูปองแล้ว' : !c.verified ? 'ลูกค้ายังไม่ได้ยืนยันอีเมล จึงยังใช้ไม่ได้' : 'งานแรกเท่านั้น ส่วนคูปองลดสูงสุด 500 บาท · ใช้ได้ถึง ' + (c.expires ? fDate.format(c.expires) : '-');
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
  const w = $('msWarn'); w.hidden = true; if (c.used || c.expired) return;
  if (m.deviceDup) { w.textContent = 'บัญชีนี้สมัครจากเครื่องที่เคยสมัครสมาชิกแล้ว ระบบจึงไม่ให้คูปองต้อนรับ ถ้าเป็นคนละคนจริง (เช่น คนในบ้านใช้เครื่องเดียวกัน) ติ๊กคูปองเองได้'; w.hidden = false; $('msCoupon').checked = false; $('msCoupon').disabled = false; U.useCoupon = false; return; }
  const ph = norm(m.phone), addrs = (m.addresses || []).map(a => norm(a.addr)).filter(x => x.length > 10), nm = norm(m.fullName);
  const other = members.find(x => x.uid !== m.uid && (
    (m.deviceId && x.deviceId === m.deviceId) ||
    (x.welcomeUsed && ((ph && norm(x.phone) === ph) || (nm.length > 4 && norm(x.fullName) === nm) || (x.addresses || []).some(a => addrs.includes(norm(a.addr)))))));
  if (other) { w.textContent = 'ชื่อ เบอร์ ที่อยู่ หรือเครื่องนี้ ซ้ำกับสมาชิก ' + (other.nickname || '') + ' (' + other.no + ') ที่เคยรับคูปองแล้ว หนึ่งคน หนึ่งเครื่อง หรือหนึ่งที่อยู่ ใช้คูปองได้ครั้งเดียว ถ้าเป็นคนละคนจริง ติ๊กคูปองเองได้'; w.hidden = false; $('msCoupon').checked = false; U.useCoupon = false; }
}
$('msCoupon').addEventListener('change', () => { U.useCoupon = $('msCoupon').checked; recalc(); });
function clearSel() {
  sel = null; U.sel = null; U.useCoupon = false; $('memSel').hidden = true; $('memPick').hidden = false;
  $('discountFieldLabel').textContent = 'ส่วนลด'; recalc();
}
$('msClear').addEventListener('click', () => { clearSel(); hideWarranty(); $('memSearch').focus(); });
const nj = document.getElementById('newJobBtn'); if (nj) nj.addEventListener('click', () => { clearSel(); hideWarranty(); queuedId = null; });

/* quote paper member line */
window.__memRender = (r) => {
  const p = $('paperMem');
  if (!sel) { p.hidden = true; return; }
  p.hidden = false; p.textContent = 'สมาชิก ' + rankOf(sel).key + ' · ' + sel.no + (r.points > 0 ? ' · รับ +' + intf(r.points) + ' แต้ม' : '');
};
recalc();

/* ---------- save order ---------- */
function hideWarranty() { $('paperWar').hidden = true; lastSaved = null; }

/* ---------- put the job straight into the queue ---------- */
let queuedId = null, qdoc = null;
const pad2 = (n) => String(n).padStart(2, '0');
const isoD = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const parseD = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function closedOn(q, ds) {
  if ((q.closedDays || []).includes(parseD(ds).getDay())) return true;
  return (q.items || []).some(it => it.kind === 'off' && it.start <= ds && it.end >= ds);
}
function busyOn(q, mid, ds) { return (q.items || []).some(it => it.kind === 'job' && it.status !== 'done' && it.machine === mid && it.start <= ds && it.end >= ds); }
function firstFree(q, mid) { let d = new Date(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate()); for (let i = 0; i < 400; i++) { const ds = isoD(d); if (!closedOn(q, ds) && !busyOn(q, mid, ds)) return ds; d = addD(d, 1); } return isoD(new Date()); }
function endFor(q, start, hours) {
  let need = Math.max(1, Math.ceil(hours / 24)), d = parseD(start), last = start, n = 0;
  while (need > 0 && n < 400) { const ds = isoD(d); if (!closedOn(q, ds)) { need--; last = ds; } d = addD(d, 1); n++; }
  return last;
}
const fD = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
function qdSummary() {
  const sum = $('qdSum'); sum.textContent = ''; if (!qdoc) return;
  const st = $('qdStart').value, hrs = +$('qdHours').value || 0; if (!st || !hrs) return;
  const en = endFor(qdoc, st, hrs);
  const clash = (() => { let d = parseD(st); while (isoD(d) <= en) { const ds = isoD(d); if (!closedOn(qdoc, ds) && busyOn(qdoc, $('qdMachine').value, ds)) return ds; d = addD(d, 1); } return null; })();
  [['ช่วงงาน', fD.format(parseD(st)) + ' – ' + fD.format(parseD(en))], ['ลูกค้า', sel ? (sel.nickname || 'สมาชิก') + ' · ' + sel.no : 'ลูกค้าทั่วไป']].forEach(([k, v]) => sum.append(h('dt', null, k), h('dd', null, v)));
  if (clash) sum.append(h('dt', null, 'เตือน'), Object.assign(h('dd', null, 'เครื่องนี้มีงานอยู่แล้ววันที่ ' + fD.format(parseD(clash))), { style: 'color:var(--warn)' }));
}
$('queueBtn').addEventListener('click', async () => {
  const r = window.__unitac.last(); if (!r) return;
  try { const s = await getDoc(doc(db, 'public', 'queue')); qdoc = s.exists() ? s.data() : null; } catch (x) { return toast(authMsg(x.code)); }
  if (!qdoc) return toast('ยังไม่มีตารางคิว');
  const ms = $('qdMachine'); ms.textContent = '';
  (qdoc.machines || []).forEach(m => { const o = h('option', null, m.name + (m.type === 'design' ? ' (เขียนแบบ)' : '')); o.value = m.id; ms.appendChild(o); });
  const printers = (qdoc.machines || []).filter(m => m.type !== 'design');
  const best = printers.map(m => [m.id, firstFree(qdoc, m.id)]).sort((a, b) => a[1].localeCompare(b[1]))[0];
  if (best) ms.value = best[0];
  $('qdName').value = (document.getElementById('jobName').value || '').trim() || 'งานพิมพ์ 3 มิติ';
  $('qdStart').value = best ? best[1] : isoD(new Date());
  $('qdHours').value = Math.max(0.5, Math.round((r.totalHours || 1) * 2) / 2);
  $('qdErr').hidden = true; qdSummary(); $('queueDlg').showModal();
});
$('qdMachine').addEventListener('change', () => { if (qdoc) $('qdStart').value = firstFree(qdoc, $('qdMachine').value); qdSummary(); });
['qdStart', 'qdHours'].forEach(id => $(id).addEventListener('input', qdSummary));
$('queueForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = (m) => { $('qdErr').textContent = m; $('qdErr').hidden = false; };
  const title = $('qdName').value.trim().slice(0, 60), st = $('qdStart').value, hrs = +$('qdHours').value || 0;
  if (!title) return err('ใส่ชื่องาน'); if (!st) return err('เลือกวันเริ่ม'); if (!(hrs > 0)) return err('ใส่เวลาพิมพ์');
  $('qdOk').disabled = true;
  try {
    const s = await getDoc(doc(db, 'public', 'queue')); const q = s.data();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const item = { id, kind: 'job', title, start: st, end: endFor(q, st, hrs), note: 'พิมพ์ประมาณ ' + hrs + ' ชม.', machine: $('qdMachine').value, status: 'queued' };
    if (sel) item.uid = sel.uid;
    q.items = (q.items || []).concat([item]); q.rev = (q.rev || 0) + 1; q.updated = new Date().toISOString();
    await setDoc(doc(db, 'public', 'queue'), q);
    queuedId = id; $('queueDlg').close();
    toast('ลงคิวแล้ว ' + fD.format(parseD(item.start)) + ' – ' + fD.format(parseD(item.end)) + ' · พอส่งมอบแล้วกด บันทึกเป็นออเดอร์ งานในตารางจะเปลี่ยนเป็นเสร็จเอง', 6000);
  } catch (x) { err(authMsg(x.code)); }
  $('qdOk').disabled = false;
});
async function markQueueDone(id) {
  const s = await getDoc(doc(db, 'public', 'queue')); if (!s.exists()) return;
  const q = s.data(); let hit = false;
  q.items = (q.items || []).map(it => { if (it.id === id) { hit = true; return { ...it, status: 'done' }; } return it; });
  if (!hit) return; q.rev = (q.rev || 0) + 1; q.updated = new Date().toISOString();
  await setDoc(doc(db, 'public', 'queue'), q);
}
$('saveOrderBtn').addEventListener('click', () => {
  const r = window.__unitac.last(); if (!r || !(r.grandTotal > 0)) return toast('ยังไม่มียอดให้บันทึก');
  if (sel && U.useCoupon && sel.welcomeUsed) { U.useCoupon = false; $('msCoupon').checked = false; recalc(); return toast('คูปองต้อนรับของลูกค้าคนนี้ใช้ไปแล้ว ตัดออกจากใบเสนอราคาแล้ว ตรวจยอดอีกครั้ง', 5000); }
  if (lastSaved && lastSaved.total === r.grandTotal) return toast('บันทึกงานนี้ไปแล้ว กด เริ่มงานใหม่ ก่อนบันทึกงานถัดไป', 4500);
  $('odTitleIn').value = (document.getElementById('jobName').value || '').trim() || 'งานพิมพ์ 3 มิติ';
  $('odDays').value = String(WARRANTY_DEFAULT);
  const td = new Date(); $('odStart').value = td.getFullYear() + '-' + String(td.getMonth() + 1).padStart(2, '0') + '-' + String(td.getDate()).padStart(2, '0'); $('odStartF').hidden = false;
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
  const now = new Date(), sv = $('odStart').value, sp = /^\d{4}-\d{2}-\d{2}$/.test(sv) ? sv.split('-').map(Number) : null;
  const wStart = sp ? new Date(sp[0], sp[1] - 1, sp[2], now.getHours(), now.getMinutes()) : now;
  const exp = days ? new Date(wStart.getTime() + days * 864e5) : null;
  const ad = sel ? (sel.addresses || []).find(a => a.id === $('msAddr').value) || null : null;
  b.disabled = true;
  try {
    const batch = writeBatch(db), oref = doc(collection(db, 'orders'));
    batch.set(oref, {
      kind: 'sale', uid: sel ? sel.uid : null, memberNo: sel ? sel.no : '', nickname: sel ? (sel.nickname || '') : '',
      title, rank: sel ? rankOf(sel).key : '', memberPct: r.memberPct || 0, couponPct: r.couponDisc > 0 ? r.couponPct : 0,
      material: r.matLabel || (r.m && r.m.code) || '', materials: (r.mats || []).map(x => ({ code: x.m && x.m.code, gramsPerPiece: +(+x.w || 0).toFixed(1) })), qty: r.qty || 1, weight: +((r.matWeight || 0) * (r.qty || 1)).toFixed(1), hours: +(r.totalHours || 0).toFixed(2),
      realCost: +(r.realCost || 0).toFixed(2), profit: +(r.realProfit || 0).toFixed(2), queueItemId: queuedId || '',
      printSubtotal: +r.printSubtotal.toFixed(2), discountTotal: +r.discountTotal.toFixed(2), printPaid: +r.printPaid.toFixed(2),
      designFee: +r.designFee.toFixed(2), shippingFee: +r.shippingFee.toFixed(2), total: +r.grandTotal.toFixed(2),
      points: pts, warrantyDays: days, warrantyCode: code, warrantyStart: days ? wStart : null, expiresAt: exp,
      shipTo: ad ? { label: ad.label || '', name: ad.name || '', phone: ad.phone || '', addr: ad.addr || '' } : null,
      deliveredAt: serverTimestamp()
    });
    if (code) batch.set(doc(db, 'warranties', code), { title, days, deliveredAt: serverTimestamp(), startAt: wStart, expiresAt: exp, claims: [] });
    if (sel) {
      const upd = { points: increment(pts) };
      if (r.couponDisc > 0) upd.welcomeUsed = true;
      batch.update(doc(db, 'members', sel.uid), upd);
    }
    await batch.commit();
    if (queuedId) { try { await markQueueDone(queuedId); } catch (_) {} queuedId = null; }
    $('orderDlg').close();
    if (sel) { sel.points = (sel.points || 0) + pts; if (r.couponDisc > 0) { sel.welcomeUsed = true; $('msCoupon').disabled = true; $('msCouponNote').textContent = 'ใช้กับออเดอร์นี้แล้ว'; } }
    lastSaved = { total: r.grandTotal };
    if (code) {
      $('pwDays').textContent = days; $('pwUntil').textContent = fDate.format(exp); $('pwCode').textContent = code;
      $('pwUrl').textContent = new URL('warranty.html', location.href).host + new URL('warranty.html', location.href).pathname;
      $('paperWar').hidden = false;
    }
    toast('บันทึกออเดอร์แล้ว' + (pts ? ' · +' + intf(pts) + ' แต้ม' : '') + (code ? ' · รหัสประกัน ' + code : ''), 5000);
  } catch (x) { $('odErr').textContent = authMsg(x.code); $('odErr').hidden = false; }
  b.disabled = false;
});

document.querySelectorAll('dialog.cd [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));


/* ---------- PromptPay on the quotation: the shop's receive-money QR + the grand total (EMVCo / Thai QR) ---------- */
const PAY_DEFAULT = { base: '00020101021129390016A000000677010111031500499920859921653037645802TH6304EF0D', name: 'นาย ณัฐเดชา สืบสาย', on: true };
let pay = { ...PAY_DEFAULT };
try { const s = JSON.parse(localStorage.getItem('unitac-pay') || 'null'); if (s && s.base) pay = { ...pay, ...s }; } catch (_) {}
function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); }
function tlv(s) { const o = []; let i = 0; while (i + 4 <= s.length) { const t = s.substr(i, 2), l = +s.substr(i + 2, 2); if (isNaN(l)) break; o.push([t, s.substr(i + 4, l)]); i += 4 + l; } return o; }
export function promptPay(base, amt) {
  const f = tlv(base).filter(([t]) => t !== '54' && t !== '63').map(([t, v]) => t === '01' ? ['01', amt > 0 ? '12' : '11'] : [t, v]);
  if (amt > 0) f.push(['54', amt.toFixed(2)]);
  f.sort((a, b) => +a[0] - +b[0]);
  const s = f.map(([t, v]) => t + String(v.length).padStart(2, '0') + v).join('') + '6304';
  return s + crc16(s);
}
function validBase(s) { if (!/^000201/.test(s) || s.length < 30) return false; return crc16(s.slice(0, -4)) === s.slice(-4).toUpperCase() && tlv(s).some(([t]) => t === '29' || t === '30'); }
function savePay() { try { localStorage.setItem('unitac-pay', JSON.stringify(pay)); } catch (_) {} if (isOwner) setDoc(doc(db, 'admin', 'pay'), pay).catch(() => {}); }
function payNote() { const acc = (tlv(pay.base).find(([t]) => t === '29' || t === '30') || [, ''])[1]; const id = (tlv(acc).find(([t]) => t !== '00') || [, ''])[1]; $('payIdNote').textContent = id ? 'ใช้ QR รับเงินเลขอ้างอิง ' + id.replace(/^(\d{3})\d+(\d{4})$/, '$1•••••$2') : 'ยังไม่ได้ตั้ง QR รับเงิน'; }
let lastAmt = -1;
function renderPay() {
  const amt = Math.round((parseFloat(String($('grandTotal').textContent).replace(/,/g, '')) || 0) * 100) / 100;
  const show = pay.on && amt > 0 && validBase(pay.base);
  $('paperPay').hidden = !show; if (!show) { lastAmt = -1; return; }
  $('payName').textContent = pay.name ? 'ชื่อบัญชี: ' + pay.name : '';
  if (amt === lastAmt) return; lastAmt = amt;
  $('payAmt').textContent = amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('payQr').innerHTML = qrSvg(promptPay(pay.base, amt));
}
new MutationObserver(renderPay).observe($('grandTotal'), { childList: true, characterData: true, subtree: true });
$('payOn').checked = pay.on; $('payNameIn').value = pay.name || ''; payNote(); renderPay();
$('payOn').addEventListener('change', () => { pay.on = $('payOn').checked; savePay(); lastAmt = -1; renderPay(); });
$('payNameIn').addEventListener('change', () => { pay.name = $('payNameIn').value.trim().slice(0, 60); savePay(); lastAmt = -1; renderPay(); });
$('payQrFile').addEventListener('change', async () => {
  const f = $('payQrFile').files && $('payQrFile').files[0]; $('payQrFile').value = ''; if (!f) return;
  try {
    if (!window.jsQR) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = new URL('../vendor/jsQR.js', import.meta.url).href; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
    const c = document.createElement('canvas'), sc = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight)); c.width = im.naturalWidth * sc; c.height = im.naturalHeight * sc;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
    const r = window.jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    if (!r || !validBase(r.data)) return toast('อ่าน QR พร้อมเพย์จากรูปนี้ไม่ได้ ลองแคปเฉพาะส่วน QR ให้ชัดขึ้น', 5000);
    pay.base = r.data; savePay(); payNote(); lastAmt = -1; renderPay(); toast('ตั้ง QR รับเงินใหม่แล้ว');
  } catch (_) { toast('อ่านรูปนี้ไม่ได้'); }
});
onAuthStateChanged(auth, async (u) => {
  if (!u || u.uid !== OWNER) return;
  try { const s = await getDoc(doc(db, 'admin', 'pay')); if (s.exists() && s.data().base) { pay = { ...pay, ...s.data() }; try { localStorage.setItem('unitac-pay', JSON.stringify(pay)); } catch (_) {} $('payOn').checked = pay.on; $('payNameIn').value = pay.name || ''; payNote(); lastAmt = -1; renderPay(); } } catch (_) {}
});

$('odDays').addEventListener('change', () => { $('odStartF').hidden = !(+$('odDays').value > 0); });
