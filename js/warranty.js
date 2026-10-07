import { db, doc, getDoc } from './fb.js?v=20261004w';
import { toDate, fDate, daysLeft, $, h, reveal, LOGO_SVG } from './core.js?v=20261004w';
document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
document.querySelector('[data-nav="warranty"]').setAttribute('aria-current', 'page');
reveal();
const OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>';
const NO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
async function check(code) {
  code = (code || '').trim().toUpperCase().replace(/\s+/g, '');
  const out = $('wr'); out.textContent = '';
  if (!code) return;
  if (!/^UT-[0-9A-Z]{4}-[0-9A-Z]{2}$/.test(code)) { out.appendChild(h('p', 'empty', 'รูปแบบรหัสไม่ถูกต้อง รหัสประกันหน้าตาแบบ UT-XXXX-XX')); return; }
  out.appendChild(h('p', 'empty', 'กำลังตรวจสอบ…'));
  let snap; try { snap = await getDoc(doc(db, 'warranties', code)); } catch (_) { out.textContent = ''; out.appendChild(h('p', 'empty', 'ตรวจสอบไม่สำเร็จ ลองใหม่อีกครั้ง')); return; }
  out.textContent = '';
  if (!snap.exists()) { out.appendChild(h('p', 'empty', 'ไม่พบรหัสประกัน ' + code + ' ตรวจตัวอักษรอีกครั้ง หรือทักร้าน')); return; }
  const w = snap.data(), exp = toDate(w.expiresAt), dl = toDate(w.deliveredAt), left = daysLeft(exp), ok = left > 0;
  const card = h('div', 'card wres ' + (ok ? 'wres--ok' : 'wres--no'));
  const st = h('div', 'wres__status'), dot = h('span', 'wres__dot'); dot.innerHTML = ok ? OK : NO;
  const tx = h('div'); tx.append(h('b', null, ok ? 'อยู่ในประกัน' : 'หมดประกันแล้ว'), h('span', 'muted small', ok ? 'เหลืออีก ' + left + ' วัน' : 'หมดเมื่อ ' + (exp ? fDate.format(exp) : '-')));
  st.append(dot, tx);
  const bar = h('div', 'bar'), f = h('span'); f.style.width = (ok ? Math.max(3, Math.min(100, left / (w.days || 30) * 100)) : 0) + '%'; f.style.setProperty('--c', ok ? (left <= 7 ? 'var(--accent)' : 'var(--ok)') : 'var(--stop)'); bar.appendChild(f);
  const d = h('dl');
  [['ชิ้นงาน', w.title || 'งานพิมพ์ 3 มิติ'], ['รหัสประกัน', code], ['วันส่งมอบ', dl ? fDate.format(dl) : '-'], ['เริ่มประกัน', (toDate(w.startAt) || dl) ? fDate.format(toDate(w.startAt) || dl) : '-'], ['หมดประกัน', exp ? fDate.format(exp) : '-'], ['ระยะประกัน', (w.days || '-') + ' วัน'], ['ประวัติเคลม', (w.claims || []).length + ' ครั้ง']]
    .forEach(([k, v]) => d.append(h('dt', null, k), h('dd', null, v)));
  card.append(st, bar, d); out.appendChild(card);
}
$('wf').addEventListener('submit', (e) => { e.preventDefault(); const c = $('wc').value; history.replaceState(null, '', '?c=' + encodeURIComponent(c.trim().toUpperCase())); check(c); });
const q = new URLSearchParams(location.search).get('c');
if (q) { $('wc').value = q.toUpperCase(); check(q); }
