import { db, doc, getDoc, setDoc } from './fb.js?v=20261003w';
import { $, h, toast } from './core.js?v=20261003w';
import { CARRIERS, cleanTrack, trackPage } from './carriers.js?v=20261003w';
import { FLASH_FN_URL } from './config.js?v=20261003w';
import { SENT_TITLE, parsePaste, titleOf, detailOf, toneOf, fmtWhen } from './shipstatus.js?v=20261003w';

/* parcel status mirrors Flash: paste the history from the Flash tracking page, it replaces the old list */
let num = '', carrier = 'flash', data = null, base = null;
function render() {
  const L = $('shList'); L.textContent = '';
  const ev = (data.events || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!ev.length) L.appendChild(h('li', null, 'ยังไม่มีสถานะ'));
  ev.forEach((e, i) => {
    const t = toneOf(e), li = h('li', i === 0 ? (t === 'delivered' ? 'is-ok' : t === 'issue' ? 'is-bad' : '') : ''), d = h('div');
    d.append(h('b', null, titleOf(e)), h('span', null, fmtWhen(e.at))); const det = detailOf(e); if (det) d.appendChild(h('em', null, det));
    li.appendChild(d); L.appendChild(li);
  });
}
async function open() {
  num = cleanTrack($('oTrack').value); carrier = $('oCarrier').value;
  if (!num) return toast('ใส่เลขพัสดุก่อน');
  let s = null; try { s = await getDoc(doc(db, 'shipments', num)); } catch (_) {}
  data = s && s.exists() ? s.data() : { events: [{ s: 'sent', title: SENT_TITLE, detail: '', at: new Date(Date.now() - 120000).toISOString() }], eta: new Date(Date.now() + 3 * 864e5).toISOString() };
  data.carrier = carrier; data.number = num; data.title = $('oTitle').value.trim() || data.title || '';
  base = (data.events || []).find(e => e.s === 'sent' || (e.title || '') === SENT_TITLE) || { s: 'sent', title: SENT_TITLE, detail: '', at: new Date(Date.now() - 120000).toISOString() };
  $('shNum').textContent = CARRIERS[carrier].name + ' · ' + num;
  const car = CARRIERS[carrier]; const go = $('shGo');
  go.hidden = !car.url; if (car.url) { go.href = car.url(num); go.textContent = 'เปิดหน้า ' + car.name + ' ↗'; }
  $('shOpen').href = trackPage(num, carrier);
  $('shPaste').value = ''; $('shParsed').textContent = ''; $('shErr').hidden = true;
  $('shEta').value = data.eta ? String(data.eta).slice(0, 10) : '';
  render(); $('shDlg').showModal();
  $('shAuto').hidden = !(FLASH_FN_URL && carrier === 'flash');
}
$('shAuto').addEventListener('click', async () => {
  const b = $('shAuto'); b.disabled = true; b.textContent = 'กำลังดึงจาก Flash…';
  try {
    const r = await fetch(FLASH_FN_URL + '?n=' + encodeURIComponent(num)).then(x => x.json());
    if (r.ok) { const s = await getDoc(doc(db, 'shipments', num)); if (s.exists()) { data = s.data(); render(); } toast(r.cached ? 'สถานะล่าสุดแล้ว (ดึงไปเมื่อไม่ถึง 5 นาทีก่อน)' : 'ดึงสถานะจาก Flash แล้ว ' + (r.count || 0) + ' รายการ', 4000); }
    else toast('ดึงไม่สำเร็จ: ' + (r.reason || 'ไม่ทราบสาเหตุ') + (r.reason === 'unknown parcel' ? ' (กดบันทึกเลขพัสดุในออเดอร์ก่อน)' : ''), 6000);
  } catch (_) { toast('เชื่อมต่อระบบดึงสถานะไม่ได้', 5000); }
  b.disabled = false; b.textContent = 'ดึงสถานะจาก Flash อัตโนมัติ';
});
$('oShipEdit').addEventListener('click', open);
$('shGo').addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(num).catch(() => {}); });
function parse() {
  const ev = parsePaste($('shPaste').value);
  if (!$('shPaste').value.trim()) { $('shParsed').textContent = ''; return; }
  if (!ev.length) { $('shParsed').textContent = 'ยังอ่านไม่ออก ตรวจว่าคัดลอกมาตั้งแต่บรรทัดวันที่ (เช่น 2026-10-03)'; $('shParsed').style.color = 'var(--warn)'; return; }
  data.events = [base].concat(ev);
  $('shParsed').style.color = 'var(--ok)'; $('shParsed').textContent = 'อ่านได้ ' + ev.length + ' สถานะ ล่าสุด: ' + ev[0].title + ' · ' + fmtWhen(ev[0].at) + ' ตรวจด้านขวาแล้วกดบันทึก';
  if (ev.some(e => e.s === 'delivered')) $('shEta').value = '';
  render();
}
$('shPaste').addEventListener('input', parse);
$('shPaste').addEventListener('paste', () => setTimeout(parse, 0));
$('shSave').addEventListener('click', async () => {
  const eta = $('shEta').value ? new Date($('shEta').value + 'T12:00:00').toISOString() : null;
  const out = { number: num, carrier, title: data.title || '', events: data.events || [], eta, source: 'flash-paste', updatedAt: new Date().toISOString() };
  $('shSave').disabled = true;
  try { await setDoc(doc(db, 'shipments', num), out); data = out; toast('บันทึกสถานะแล้ว ลูกค้าเห็นทันที'); $('shDlg').close(); }
  catch (x) { $('shErr').textContent = 'บันทึกไม่สำเร็จ ตรวจว่าอัปเดตกฎความปลอดภัยแล้ว'; $('shErr').hidden = false; }
  $('shSave').disabled = false;
});
