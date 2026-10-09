/* ---------- ดูบิลย้อนหลังของแต่ละออเดอร์ (หน้าตาเหมือนใบเสนอราคาในเครื่องคิดเลข) ---------- */
import { db, doc, getDoc } from './fb.js?v=20261004w';
import { toDate, fDate, money, intf, qrSvg, $, h, toast, LOGO_SVG } from './core.js?v=20261004w';

const I = (p) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
const ICONS = {
  mat: I('<path d="M12 3 4 7.5v9L12 21l8-4.5v-9Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
  elec: I('<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>'),
  dep: I('<path d="M6 9V4h12v5M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><path d="M6 14h12v6H6z"/>'),
  hw: I('<path d="M14.7 6.3a4 4 0 0 0 5 5L13 18a2.1 2.1 0 0 1-3-3l6.7-6.7Z"/><path d="M20.5 3.5 17 7"/><path d="M4 20l3-3"/>'),
  op: I('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>'),
  disc: I('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>'),
  design: I('<path d="m4 20 4-1 11-11-3-3L5 16Z"/><path d="m13 6 3 3"/>'),
  ship: I('<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>')
};

/* PromptPay (EMVCo Thai QR) — same logic as the calculator */
const PAY_DEFAULT = { base: '00020101021129390016A000000677010111031500499920859921653037645802TH6304EF0D', name: 'นาย ณัฐเดชา สืบสาย', on: true };
function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); }
function tlv(s) { const o = []; let i = 0; while (i + 4 <= s.length) { const t = s.substr(i, 2), l = +s.substr(i + 2, 2); if (isNaN(l)) break; o.push([t, s.substr(i + 4, l)]); i += 4 + l; } return o; }
function promptPay(base, amt) {
  const f = tlv(base).filter(([t]) => t !== '54' && t !== '63').map(([t, v]) => t === '01' ? ['01', amt > 0 ? '12' : '11'] : [t, v]);
  if (amt > 0) f.push(['54', amt.toFixed(2)]); f.sort((a, b) => +a[0] - +b[0]);
  const s = f.map(([t, v]) => t + String(v.length).padStart(2, '0') + v).join('') + '6304'; return s + crc16(s);
}
const validBase = (s) => /^000201/.test(s || '') && s.length >= 30 && crc16(s.slice(0, -4)) === s.slice(-4).toUpperCase();
let pay = null;
async function loadPay() {
  if (pay) return pay;
  pay = { ...PAY_DEFAULT };
  try { const l = JSON.parse(localStorage.getItem('unitac-pay') || 'null'); if (l && l.base) pay = { ...pay, ...l }; } catch (_) {}
  try { const s = await getDoc(doc(db, 'admin', 'pay')); if (s.exists() && s.data().base) pay = { ...pay, ...s.data() }; } catch (_) {}
  return pay;
}

const fDay = new Intl.DateTimeFormat('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
const num = (n) => (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* old orders (saved before the bill snapshot existed) → rebuild a short bill from the summary fields */
function legacyLines(o) {
  const L = [], qty = o.qty || 1;
  const sub = [o.material, o.weight ? intf(o.weight) + ' g' : '', qty > 1 ? qty + ' ชิ้น' : '', o.hours ? (+o.hours).toFixed(1) + ' ชม.' : ''].filter(Boolean).join(' · ');
  const before = o.printSubtotal != null ? o.printSubtotal : (+o.printPaid || 0) + (+o.discountTotal || 0);
  L.push({ k: 'mat', t: 'ค่าพิมพ์งาน', s: sub || 'วัสดุ ไฟ ค่าเสื่อม ค่าดำเนินงาน', v: num(before) });
  if (+o.discountTotal > 0) {
    const why = [o.memberPct ? 'สมาชิก ' + o.memberPct + '%' : '', o.couponPct ? 'คูปอง ' + o.couponPct + '%' : ''].filter(Boolean).join(' + ');
    L.push({ k: 'disc', t: 'ส่วนลด', s: why || 'Discount', v: '-' + num(o.discountTotal), stop: true });
  }
  if (+o.designFee > 0) L.push({ k: 'design', t: 'ค่าเขียนแบบ', s: 'Design Fee', v: num(o.designFee) });
  if (+o.shippingFee > 0) L.push({ k: 'ship', t: 'ค่าจัดส่ง', s: 'Shipping Fee', v: num(o.shippingFee) });
  return L;
}

function itemEl(x) {
  const li = h('li', 'item' + (x.stop ? ' item--stop' : ''));
  const ic = h('span', 'item__ic'); ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = ICONS[x.k] || ICONS.mat;
  const t = h('span', 'item__t'); t.append(h('b', null, x.t || ''), h('span', null, x.s || ''));
  const v = h('span', 'item__v', String(x.v || '').replace(/\s+/g, '')); v.appendChild(h('small', null, '฿'));
  li.append(ic, t, v); return li;
}

let curOrder = null;
export async function openBill(o) {
  curOrder = o;
  const P = $('billPaper'), bill = o.bill || null, d = toDate(o.deliveredAt);
  $('bdBrand').innerHTML = LOGO_SVG;
  $('bdBrand').querySelector('svg')?.classList.add('paper__logosvg');
  $('bdDate').textContent = (bill && bill.date) || (d ? fDay.format(d) : '');
  $('bdJob').textContent = o.title || 'งานพิมพ์ 3 มิติ';
  const mem = (bill && bill.mem) || (o.uid ? 'สมาชิก ' + (o.nickname || '') + ' · ' + (o.memberNo || '') + (o.rank ? ' · ' + o.rank : '') : '');
  $('bdMem').textContent = mem; $('bdMem').hidden = !mem;
  const L = $('bdItems'); L.textContent = '';
  ((bill && bill.lines && bill.lines.length) ? bill.lines : legacyLines(o)).forEach(x => L.appendChild(itemEl(x)));
  $('bdNote').textContent = (bill && bill.note) || ''; $('bdNote').hidden = !(bill && bill.note);
  $('bdTotal').textContent = num(o.total);
  $('bdPPL').hidden = !(bill && bill.pp); $('bdPP').textContent = (bill && bill.pp) || '';
  $('bdOld').hidden = !!(bill && bill.lines);
  /* warranty stub */
  const W = $('bdWar');
  if (o.warrantyCode) {
    const start = toDate(o.warrantyStart) || d, exp = toDate(o.expiresAt);
    const url = new URL('warranty.html?c=' + o.warrantyCode, location.href);
    $('bwQr').innerHTML = qrSvg(url.href); $('bwCode').textContent = o.warrantyCode;
    $('bwStart').textContent = start ? fDate.format(start) : '-'; $('bwUntil').textContent = exp ? fDate.format(exp) : '-';
    $('bwDays').textContent = o.warrantyDays || 0; $('bwJob').textContent = o.title || '';
    $('bwUrl').textContent = url.host + url.pathname; W.hidden = false;
  } else W.hidden = true;
  /* PromptPay */
  $('bdPay').hidden = true;
  $('bDlg').showModal(); P.scrollIntoView?.({ block: 'start' });
  const p = await loadPay(); if (curOrder !== o) return;
  const amt = Math.round((+o.total || 0) * 100) / 100, show = p.on !== false && amt > 0 && validBase(p.base) && $('bdPayOn').checked;
  if (show) { $('bdPayQr').innerHTML = qrSvg(promptPay(p.base, amt)); $('bdPayAmt').textContent = num(amt); $('bdPayName').textContent = p.name ? 'ชื่อบัญชี: ' + p.name : ''; }
  $('bdPay').hidden = !show;
}

$('bdPayOn').addEventListener('change', () => { if (curOrder) openBill(curOrder); });
$('bDlg').querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $('bDlg').close()));
function loadH2C() {
  if (window.html2canvas) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
$('bdSave').addEventListener('click', async () => {
  const b = $('bdSave'); b.disabled = true;
  try {
    await loadH2C();
    const c = await window.html2canvas($('billPaper'), { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const d = toDate(curOrder.deliveredAt) || new Date(), ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const name = 'Bill_' + String(curOrder.title || 'order').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60) + '_' + ymd + '.png';
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) {
      try { await navigator.share({ files: [file], title: name }); } catch (_) {}
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); toast('บันทึกรูปบิลแล้ว');
    }
  } catch (_) { toast('บันทึกรูปไม่สำเร็จ ต้องต่ออินเทอร์เน็ตเพื่อโหลดตัวช่วย'); }
  b.disabled = false;
});
