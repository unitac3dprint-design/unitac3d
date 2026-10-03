import { auth, db, OWNER, authMsg, onAuthStateChanged, doc, collection, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from './fb.js?v=20261003j';
import { $, h, toast, money, intf } from './core.js?v=20261003j';

/* filament stock: counted in spools (no automatic deduction), with cost and selling price per material */
let mats = [], cur = null, loaded = false, typeFilter = 'all';
onAuthStateChanged(auth, (u) => { if (u && u.uid === OWNER && !loaded) { loaded = true; load(); } });

async function load() {
  try { const s = await getDocs(collection(db, 'materials')); mats = s.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (x) { toast(authMsg(x.code)); }
  render();
}
const cpg = (m) => (m.spoolWeight > 0 ? (+m.spoolCost || 0) / m.spoolWeight : 0);
const margin = (m) => { const c = cpg(m), s = +m.sellPerGram || 0; return s > 0 ? (s - c) / s * 100 : 0; };
const spools = (m) => (+m.sealed || 0) + (+m.open || 0);
const isLow = (m) => m.active !== false && spools(m) <= (+m.low || 0);
const label = (m) => [m.brand, m.type].filter(Boolean).join(' ') + (m.color ? ' · ' + m.color : '');
function stat(t, v, s, main) { const d = h('div', 'mstat' + (main ? ' mstat--main' : '')); d.append(h('span', null, t), h('b', null, v)); if (s) d.appendChild(h('small', null, s)); return d; }

function render() {
  const S = $('stkStats'); S.textContent = '';
  const act = mats.filter(m => m.active !== false), low = act.filter(isLow);
  const sealed = act.reduce((s, m) => s + (+m.sealed || 0), 0), open = act.reduce((s, m) => s + (+m.open || 0), 0);
  const value = act.reduce((s, m) => s + (+m.sealed || 0) * (+m.spoolCost || 0), 0);
  S.append(stat('ม้วนทั้งหมด', intf(sealed + open), 'ใหม่ ' + sealed + ' · เปิดใช้ ' + open, true), stat('รายการเส้น', intf(act.length), 'ยี่ห้อ ชนิด และสี'),
    stat('มูลค่าม้วนใหม่ในสต็อก', money(value) + ' ฿', 'คิดจากราคาทุน'), stat('ใกล้หมด', intf(low.length), low.length ? low.slice(0, 2).map(label).join(', ') + (low.length > 2 ? ' …' : '') : 'ยังไม่มีรายการที่ต้องสั่ง'));
  const types = [...new Set(mats.map(m => m.type || 'อื่นๆ'))].sort();
  const C = $('stkChips'); C.textContent = '';
  [['all', 'ทั้งหมด', mats.length], ['low', 'ใกล้หมด', low.length]].concat(types.map(t => [t, t, mats.filter(m => (m.type || 'อื่นๆ') === t).length])).forEach(([k, n, c]) => {
    const b = h('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(typeFilter === k)); b.append(n, h('b', null, String(c)));
    b.addEventListener('click', () => { typeFilter = k; render(); }); C.appendChild(b);
  });
  const q = ($('stkSearch').value || '').toLowerCase().trim();
  let list = mats.filter(m => typeFilter === 'all' || (typeFilter === 'low' ? isLow(m) : (m.type || 'อื่นๆ') === typeFilter));
  if (q) list = list.filter(m => [m.brand, m.type, m.color, m.note].some(v => (v || '').toLowerCase().includes(q)));
  list.sort((a, b) => (isLow(b) - isLow(a)) || (a.type || '').localeCompare(b.type || '') || (a.brand || '').localeCompare(b.brand || '') || (a.color || '').localeCompare(b.color || ''));
  const L = $('stkList'); L.textContent = '';
  if (!list.length) { L.appendChild(h('p', 'empty', mats.length ? 'ไม่พบเส้นตามที่กรอง' : 'ยังไม่มีเส้นในสต็อก กด + เพิ่มเส้น หรือนำเข้าราคาจากเครื่องคิดเลขเดิม')); return; }
  list.forEach(m => L.appendChild(card(m)));
}
function counter(m, key, title) {
  const d = h('div', 'cnt'), minus = h('button', null, '−'), plus = h('button', null, '+'), s = h('span');
  minus.type = plus.type = 'button'; minus.setAttribute('aria-label', 'ลด' + title); plus.setAttribute('aria-label', 'เพิ่ม' + title);
  s.append(h('b', null, String(+m[key] || 0)), title);
  minus.addEventListener('click', () => bump(m, { [key]: Math.max(0, (+m[key] || 0) - 1) }));
  plus.addEventListener('click', () => bump(m, { [key]: (+m[key] || 0) + 1 }));
  d.append(minus, s, plus); return d;
}
function card(m) {
  const c = h('article', 'spool' + (isLow(m) ? ' is-low' : '') + (m.active === false ? ' is-off' : ''));
  const hd = h('div', 'spool__h'), sw = h('span', 'spool__sw'); sw.style.setProperty('--sw', m.hex || '#2b2b2b');
  const t = h('div', 'spool__t'); t.append(h('b', null, [m.brand, m.type].filter(Boolean).join(' ') || 'ไม่ระบุ'), h('span', null, (m.color || 'ไม่ระบุสี') + ' · ม้วนละ ' + intf(m.spoolWeight || 0) + ' g'));
  const badges = h('span');
  if (isLow(m)) badges.appendChild(h('span', 'pill pill--stop', 'ใกล้หมด'));
  else if (m.active === false) badges.appendChild(h('span', 'pill', 'ซ่อนจากเครื่องคิดเลข'));
  hd.append(sw, t, badges);
  const p = h('div', 'spool__p');
  [['ทุน/g', cpg(m).toFixed(2)], ['ขาย/g', (+m.sellPerGram || 0).toFixed(2)], ['กำไรวัสดุ', margin(m).toFixed(0) + '%']].forEach(([k, v]) => { const d = h('div'); d.append(h('b', null, v), k); p.appendChild(d); });
  const s = h('div', 'spool__s'); s.append(counter(m, 'sealed', 'ม้วนใหม่'), counter(m, 'open', 'เปิดใช้'));
  const a = h('div', 'spool__acts');
  const op = h('button', 'btn btn--ghost btn--sm', 'เปิดม้วนใหม่'); op.type = 'button'; op.disabled = !(+m.sealed > 0);
  op.addEventListener('click', () => bump(m, { sealed: (+m.sealed || 0) - 1, open: (+m.open || 0) + 1 }, 'เปิดม้วนใหม่แล้ว'));
  const em = h('button', 'btn btn--ghost btn--sm', 'ม้วนหมด'); em.type = 'button'; em.disabled = !(+m.open > 0);
  em.addEventListener('click', () => bump(m, { open: (+m.open || 0) - 1 }, 'ตัดม้วนที่หมดออกแล้ว'));
  const ed = h('button', 'btn btn--ghost btn--sm', 'แก้ไข'); ed.type = 'button'; ed.addEventListener('click', () => openForm(m));
  a.append(op, em, ed);
  c.append(hd, p, s, a);
  if (m.note) c.appendChild(h('p', 'hint', m.note));
  return c;
}
async function bump(m, data, msg) {
  try { await updateDoc(doc(db, 'materials', m.id), data); Object.assign(m, data); render(); if (msg) toast(msg); }
  catch (x) { toast(authMsg(x.code)); }
}

/* add / edit */
function sellHint() {
  const w = +$('mWeight').value || 0, c = +$('mCost').value || 0, s = +$('mSell').value || 0;
  const cg = w > 0 ? c / w : 0;
  $('mSellHint').textContent = cg ? 'ทุน ' + cg.toFixed(2) + ' ฿/g' + (s ? ' · กำไรวัสดุ ' + ((s - cg) / s * 100).toFixed(0) + '%' : ' · เช่น ขาย 2 เท่าของทุน = ' + (cg * 2).toFixed(2) + ' ฿/g') : '';
}
['mWeight', 'mCost', 'mSell'].forEach(id => $(id).addEventListener('input', sellHint));
function openForm(m) {
  cur = m || null;
  $('mDlgT').textContent = m ? 'แก้ไขเส้น' : 'เพิ่มเส้น';
  $('mBrand').value = m ? m.brand || '' : ''; $('mType').value = m ? m.type || '' : ''; $('mColor').value = m ? m.color || '' : '';
  $('mHex').value = m && /^#[0-9a-f]{6}$/i.test(m.hex || '') ? m.hex : '#2b2b2b';
  $('mWeight').value = m ? m.spoolWeight || 1000 : 1000; $('mCost').value = m ? m.spoolCost || '' : ''; $('mSell').value = m ? m.sellPerGram || '' : '';
  $('mLow').value = m ? (m.low != null ? m.low : 1) : 1; $('mSealed').value = m ? m.sealed || 0 : 0; $('mOpen').value = m ? m.open || 0 : 0;
  $('mNote').value = m ? m.note || '' : ''; $('mActive').checked = m ? m.active !== false : true;
  $('mDel').hidden = !m; $('mErr').hidden = true; sellHint();
  $('mDlg').showModal();
}
$('stkAdd').addEventListener('click', () => openForm(null));
$('stkSearch').addEventListener('input', render);
$('mForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = (t) => { $('mErr').textContent = t; $('mErr').hidden = false; };
  const data = {
    brand: $('mBrand').value.trim().slice(0, 40), type: $('mType').value.trim().slice(0, 30), color: $('mColor').value.trim().slice(0, 30), hex: $('mHex').value,
    spoolWeight: Math.max(1, Math.round(+$('mWeight').value || 0)), spoolCost: Math.max(0, +$('mCost').value || 0), sellPerGram: Math.max(0, +$('mSell').value || 0),
    low: Math.max(0, Math.round(+$('mLow').value || 0)), sealed: Math.max(0, Math.round(+$('mSealed').value || 0)), open: Math.max(0, Math.round(+$('mOpen').value || 0)),
    note: $('mNote').value.trim().slice(0, 100), active: $('mActive').checked
  };
  if (!data.brand && !data.type) return err('ใส่ยี่ห้อหรือชนิดวัสดุอย่างน้อยหนึ่งอย่าง');
  if (!data.sellPerGram) return err('ใส่ราคาขายต่อกรัม เครื่องคิดเลขใช้ตัวเลขนี้คิดค่าวัสดุ');
  $('mSave').disabled = true;
  try {
    if (cur) { await updateDoc(doc(db, 'materials', cur.id), data); Object.assign(cur, data); }
    else { const ref = doc(collection(db, 'materials')); data.createdAt = serverTimestamp(); await setDoc(ref, data); mats.push({ id: ref.id, ...data }); }
    $('mDlg').close(); render(); toast('บันทึกเส้นแล้ว');
  } catch (x) { err(authMsg(x.code)); }
  $('mSave').disabled = false;
});
$('mDel').addEventListener('click', async () => {
  if (!cur || !confirm('ลบ ' + label(cur) + ' ออกจากสต็อก?')) return;
  try { await deleteDoc(doc(db, 'materials', cur.id)); mats = mats.filter(m => m.id !== cur.id); $('mDlg').close(); render(); toast('ลบแล้ว'); }
  catch (x) { toast(authMsg(x.code)); }
});

/* one-time import from the calculator's old price list (Google Sheet sync or built-in list) */
const BUILTIN = [
  ['POLY-PLA', 1000, 0.39], ['POLY-TPU-95A', 2200, 1.3866666666666667], ['3DD-PLA-CF', 1500, 0.64], ['KEX-PETG-M', 1600, 0.74], ['KEX-PETG-CF', 1700, 0.84],
  ['BBL-ASA', 1600, 0.777], ['BBL-ASA-CF', 2700, 1.85], ['BBL-PLA-T', 1600, 0.74], ['PPS-CF10', 5700, 4.78], ['BBL-PETG-HF', 1500, 0.65], ['BBL-PA6-GF', 3920, 3], ['BBL-PLA-CF', 2500, 1.455]
].map(([code, pricePerKg, actualCostPerGram]) => ({ code, pricePerKg, actualCostPerGram }));
const BRANDS = { BBL: 'Bambu Lab', POLY: 'Polymaker', KEX: 'Kexcelled', '3DD': '3DD', PPS: 'Polymaker' };
function guess(code) {
  const parts = code.split('-'), b = BRANDS[parts[0]] || parts[0];
  const type = (code.match(/(PLA|PETG|ASA|ABS|TPU|PA6|PPS|PC)(-?(CF|GF|HF|T|M|95A|CF10))?/i) || [code])[0].toUpperCase();
  return { brand: b, type };
}
$('stkImport').addEventListener('click', async () => {
  let list = BUILTIN, src = 'รายการที่ติดมากับเครื่องคิดเลข';
  try { const o = JSON.parse(localStorage.getItem('unitac-calc-v4') || '{}'); if (Array.isArray(o.materials) && o.materials.length) { list = o.materials; src = 'ราคาที่ซิงก์จาก Google Sheet ไว้ในเครื่องนี้'; } } catch (_) {}
  const have = new Set(mats.map(m => (m.importCode || '')));
  const todo = list.filter(m => m && m.code && !have.has(m.code));
  if (!todo.length) return toast('นำเข้าครบแล้ว ไม่มีรายการใหม่');
  if (!confirm('นำเข้า ' + todo.length + ' รายการจาก' + src + '?\nสีตั้งเป็น "ไม่ระบุ" และจำนวนม้วนเป็น 0 แก้ต่อได้ทีละรายการ')) return;
  try {
    const b = writeBatch(db), add = [];
    todo.forEach(m => {
      const g = guess(m.code), ref = doc(collection(db, 'materials'));
      const ac = +m.actualCostPerGram > 0 ? +m.actualCostPerGram : (+m.pricePerKg || 0) / 1000;
      const data = { brand: g.brand, type: g.type, color: '', hex: '#2b2b2b', spoolWeight: 1000, spoolCost: +(ac * 1000).toFixed(2), sellPerGram: +((+m.pricePerKg || 0) / 1000).toFixed(4),
        low: 0, sealed: 0, open: 0, note: 'นำเข้าจากรหัส ' + m.code, active: true, importCode: m.code };
      b.set(ref, data); add.push({ id: ref.id, ...data });
    });
    await b.commit(); mats = mats.concat(add); render(); toast('นำเข้าแล้ว ' + add.length + ' รายการ', 4000);
  } catch (x) { toast(authMsg(x.code)); }
});

/* CSV export (opens in Excel / Google Sheets) */
export function downloadCsv(name, rows) {
  const esc = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = '\ufeff' + rows.map(r => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$('stkCsv').addEventListener('click', () => {
  const rows = [['ยี่ห้อ', 'ชนิด', 'สี', 'น้ำหนักต่อม้วน (g)', 'ราคาทุนต่อม้วน', 'ทุน/g', 'ขาย/g', 'กำไรวัสดุ %', 'ม้วนใหม่', 'เปิดใช้', 'เตือนเมื่อเหลือ', 'หมายเหตุ']];
  mats.forEach(m => rows.push([m.brand, m.type, m.color, m.spoolWeight, m.spoolCost, cpg(m).toFixed(3), m.sellPerGram, margin(m).toFixed(1), m.sealed || 0, m.open || 0, m.low || 0, m.note]));
  downloadCsv('unitac-stock.csv', rows);
});
