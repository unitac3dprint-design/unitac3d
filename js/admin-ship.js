import { db, doc, getDoc, setDoc } from './fb.js?v=20261003j';
import { $, h, toast } from './core.js?v=20261003j';
import { CARRIERS, cleanTrack, trackPage } from './carriers.js?v=20261003j';
import { SHIP, ORDER, parsePaste, fmtWhen } from './shipstatus.js?v=20261003j';

/* the shop updates parcel status by hand for now (buttons or pasted text);
   a future Flash Express connection writes the same shipments/{number} document */
let num = '', carrier = 'flash', data = null, pick = 'picked';
const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
['picked', 'hub', 'transit', 'dest', 'out', 'delivered', 'issue'].forEach(k => {
  const b = h('button', null, SHIP[k].name); b.type = 'button'; b.dataset.k = k;
  b.addEventListener('click', () => { pick = k; chips(); }); $('shChips').appendChild(b);
});
function chips() { $('shChips').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === pick))); }
function nextGuess() {
  const ev = (data.events || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const last = ev[0] ? ev[0].s : 'sent', i = ORDER.indexOf(last);
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : 'out';
}
function list() {
  const L = $('shList'); L.textContent = '';
  const ev = (data.events || []).map((e, i) => ({ e, i })).sort((a, b) => String(b.e.at).localeCompare(String(a.e.at)));
  if (!ev.length) L.appendChild(h('li', null, 'ยังไม่มีสถานะ'));
  ev.forEach(({ e, i }) => {
    const li = h('li', e._new ? 'is-new' : ''), t = h('div');
    t.append(h('b', null, e.s === 'note' ? e.text : SHIP[e.s].name), h('span', null, [fmtWhen(e.at), e.place, e.s !== 'note' && e.text && e.text !== SHIP[e.s].name ? e.text : ''].filter(Boolean).join(' · ')));
    const del = h('button'); del.type = 'button'; del.innerHTML = X; del.setAttribute('aria-label', 'ลบสถานะนี้');
    del.addEventListener('click', () => { data.events.splice(i, 1); list(); });
    li.append(t, del); L.appendChild(li);
  });
}
async function open() {
  num = cleanTrack($('oTrack').value); carrier = $('oCarrier').value;
  if (!num) return toast('ใส่เลขพัสดุก่อน');
  let s = null; try { s = await getDoc(doc(db, 'shipments', num)); } catch (_) {}
  data = s && s.exists() ? s.data() : { number: num, carrier, title: $('oTitle').value.trim(), events: [{ s: 'sent', text: SHIP.sent.name, place: '', at: new Date(Date.now() - 120000).toISOString() }], eta: new Date(Date.now() + 3 * 864e5).toISOString() };
  data.carrier = carrier; data.title = $('oTitle').value.trim() || data.title || '';
  $('shNum').textContent = CARRIERS[carrier].name + ' · ' + num;
  $('shOpen').href = trackPage(num, carrier);
  $('shPlace').value = ''; $('shAt').value = localNow(); $('shPaste').value = ''; $('shErr').hidden = true;
  $('shEta').value = data.eta ? String(data.eta).slice(0, 10) : '';
  pick = nextGuess(); chips(); list();
  $('shDlg').showModal();
}
$('oShipEdit').addEventListener('click', open);
$('shAdd').addEventListener('click', () => {
  const at = $('shAt').value ? new Date($('shAt').value) : new Date();
  data.events = (data.events || []).concat([{ s: pick, text: SHIP[pick].name, place: $('shPlace').value.trim().slice(0, 60), at: at.toISOString(), _new: true }]);
  $('shPlace').value = ''; pick = nextGuess(); chips(); list();
});
$('shParse').addEventListener('click', () => {
  const ev = parsePaste($('shPaste').value);
  if (!ev.length) return toast('ไม่พบข้อความที่แยกเป็นสถานะได้');
  const have = new Set((data.events || []).map(e => e.at + '|' + e.text));
  const add = ev.filter(e => !have.has(e.at + '|' + e.text)).map(e => ({ ...e, _new: true }));
  data.events = (data.events || []).concat(add); $('shPaste').value = ''; list();
  toast('เพิ่ม ' + add.length + ' สถานะจากข้อความที่วาง ตรวจแล้วกดบันทึก', 4000);
});
$('shSave').addEventListener('click', async () => {
  const clean = (data.events || []).map(({ _new, ...e }) => e);
  const eta = $('shEta').value ? new Date($('shEta').value + 'T12:00:00').toISOString() : null;
  const out = { number: num, carrier, title: data.title || '', events: clean, eta, source: 'manual', updatedAt: new Date().toISOString() };
  $('shSave').disabled = true;
  try { await setDoc(doc(db, 'shipments', num), out); data = out; list(); toast('บันทึกสถานะพัสดุแล้ว ลูกค้าเห็นทันที'); $('shDlg').close(); }
  catch (x) { $('shErr').textContent = 'บันทึกไม่สำเร็จ ตรวจว่าอัปเดตกฎความปลอดภัยแล้ว'; $('shErr').hidden = false; }
  $('shSave').disabled = false;
});
