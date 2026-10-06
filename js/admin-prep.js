import { auth, db, OWNER, onAuthStateChanged, doc, collection, getDoc, getDocs, setDoc, onSnapshot } from './fb.js?v=20261004r';
import { $, h, toast } from './core.js?v=20261004r';

/* "เตรียมงาน": what the owner has to get ready today, tomorrow and the day after, from the live queue */
let Q = null, names = {}, done = {}, mats = [], started = false;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fDay = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'short' });
const fShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });
const LABEL = ['วันนี้', 'พรุ่งนี้', 'มะรืนนี้'];

onAuthStateChanged(auth, (u) => { if (u && u.uid === OWNER && !started) { started = true; boot(); } });
async function boot() {
  try { const s = await getDocs(collection(db, 'members')); s.docs.forEach(d => { names[d.id] = d.data().nickname || 'สมาชิก'; }); } catch (_) {}
  try { const s = await getDocs(collection(db, 'materials')); mats = s.docs.map(d => d.data()); } catch (_) {}
  try { const s = await getDoc(doc(db, 'admin', 'prep')); done = s.exists() ? s.data().done || {} : {}; } catch (_) {}
  onSnapshot(doc(db, 'public', 'queue'), (s) => { Q = s.exists() ? s.data() : null; render(); }, () => {});
  setInterval(render, 10 * 60 * 1000);   /* roll over at midnight */
}
function closedOn(ds) {
  if (!Q) return false;
  if ((Q.closedDays || []).includes(parse(ds).getDay())) return true;
  return (Q.items || []).some(it => it.kind === 'off' && it.start <= ds && it.end >= ds);
}
const machine = (id) => (Q.machines || []).find(m => m.id === id) || { name: id, type: 'print' };
const COLORS = ['#FF7A3C', '#CBC4B8', '#74C49B', '#E3A853', '#7FB2E5'];
function colorOf(m) { if (m.type === 'design') return '#B3A3E0'; const i = (Q.machines || []).filter(x => x.type !== 'design').findIndex(x => x.id === m.id); return COLORS[i % COLORS.length] || '#CBC4B8'; }
async function toggle(key, on) {
  if (on) done[key] = true; else delete done[key];
  try { await setDoc(doc(db, 'admin', 'prep'), { done }); } catch (_) { toast('บันทึกไม่สำเร็จ'); }
  render();
}
function task(it, kind, ds) {
  const m = machine(it.machine), key = it.id + ':' + kind + ':' + ds, isDone = !!done[key];
  const el = h('label', 'ptask' + (isDone ? ' is-done' : '')); el.style.setProperty('--c', colorOf(m));
  const cb = h('input'); cb.type = 'checkbox'; cb.checked = isDone; cb.addEventListener('change', () => toggle(key, cb.checked));
  const t = h('div');
  const what = { start: m.type === 'design' ? 'เริ่มเขียนแบบ' : 'เริ่มพิมพ์', due: m.type === 'design' ? 'ส่งแบบให้ลูกค้า' : 'ครบกำหนดเสร็จ', run: m.type === 'design' ? 'เขียนแบบต่อ' : 'พิมพ์ต่อ' }[kind];
  const todo = { start: (m.type === 'design' ? 'เปิดไฟล์และข้อมูลจากลูกค้า' : 'เช็กไฟล์ เตรียมเส้น ทำความสะอาดฐานพิมพ์') + (it.start === it.end ? ' · เสร็จในวันเดียว เตรียมแพ็กด้วย' : ''), due: 'ตรวจงาน · แพ็ก · แจ้งลูกค้า / ส่งพัสดุ', run: 'เช็กความคืบหน้าและเส้นที่เหลือ' }[kind];
  t.append(h('b', null, it.title || 'งาน'), h('small', null, what + ' · ' + m.name + (it.uid && names[it.uid] ? ' · ' + names[it.uid] : '') + ' · ' + fShort.format(parse(it.start)) + ' – ' + fShort.format(parse(it.end))));
  t.appendChild(h('em', null, todo));
  if (it.note) t.appendChild(h('small', null, it.note));
  el.append(cb, t); return el;
}
function group(title, list) { const g = h('div', 'pgrp'); g.appendChild(h('span', null, title + ' · ' + list.length)); list.forEach(x => g.appendChild(x)); return g; }
function render() {
  if (!Q) { $('prepDays').innerHTML = '<p class="muted">ยังไม่มีข้อมูลตารางคิว</p>'; return; }
  const today = new Date(), d0 = iso(today), jobs = (Q.items || []).filter(it => it.kind === 'job' && it.status !== 'done');
  /* overdue: should have finished already */
  const late = jobs.filter(it => it.end < d0);
  const L = $('prepLate'); L.textContent = '';
  if (late.length) { const box = h('div', 'plate'); box.appendChild(h('h3', null, 'เลยกำหนดแล้ว ' + late.length + ' งาน (ยังไม่ได้กดเสร็จในตารางคิว)')); late.forEach(it => box.appendChild(task(it, 'due', it.end))); L.appendChild(box); }
  const D = $('prepDays'); D.textContent = '';
  const sums = [];
  for (let i = 0; i < 3; i++) {
    const ds = iso(addD(today, i)), box = h('section', 'pday' + (i === 0 ? ' is-today' : ''));
    const hd = h('div', 'pday__h'); hd.append(h('b', null, LABEL[i]), h('span', null, fDay.format(parse(ds)))); box.appendChild(hd);
    const starts = jobs.filter(it => it.start === ds), dueOnly = jobs.filter(it => it.end === ds && it.start !== ds), runs = jobs.filter(it => it.start < ds && it.end > ds);
    if (closedOn(ds)) box.appendChild(h('div', 'pday__closed', 'ร้านหยุด · ไม่มีงานต้องเตรียม'));
    if (starts.length) box.appendChild(group('เริ่มงาน', starts.map(it => task(it, 'start', ds))));
    if (dueOnly.length) box.appendChild(group('ครบกำหนด / ส่งมอบ', dueOnly.map(it => task(it, 'due', ds))));
    if (runs.length) box.appendChild(group('ทำต่อเนื่อง', runs.map(it => task(it, 'run', ds))));
    if (!starts.length && !dueOnly.length && !runs.length && !closedOn(ds)) box.appendChild(h('p', 'pday__empty', 'ไม่มีงานในวันนี้'));
    const n = starts.length + dueOnly.length, left = [...starts.map(it => it.id + ':start:' + ds), ...dueOnly.map(it => it.id + ':due:' + ds)].filter(k => !done[k]).length;
    sums.push([LABEL[i], n, left]);
    D.appendChild(box);
  }
  const S = $('prepSum'); S.textContent = '';
  const st = (t, v, s, main) => { const d = h('div', 'mstat' + (main ? ' mstat--main' : '')); d.append(h('span', null, t), h('b', null, v)); if (s) d.appendChild(h('small', null, s)); return d; };
  sums.forEach(([t, n, left], i) => S.appendChild(st(t, n + ' งาน', n ? (left ? 'เหลือต้องเตรียม ' + left : 'เตรียมครบแล้ว ✓') : 'ว่าง', i === 0)));
  if (late.length) S.appendChild(st('เลยกำหนด', late.length + ' งาน', 'ดูด้านบน'));
  const badge = sums[0][2] + late.length, tab = $('tPrep');
  let b = tab.querySelector('.tbadge'); if (!badge) { if (b) b.remove(); } else { if (!b) { b = h('span', 'tbadge'); tab.appendChild(b); } b.textContent = String(badge); }
}
