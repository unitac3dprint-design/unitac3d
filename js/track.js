import { db, doc, onSnapshot } from './fb.js?v=20261003v';
import { $, h, reveal, toast, LOGO_SVG } from './core.js?v=20261003v';
import { CARRIERS, cleanTrack } from './carriers.js?v=20261003v';
import { FLASH_FN_URL } from './config.js?v=20261003v';
import { latest, fmtWhen, titleOf, detailOf, toneOf } from './shipstatus.js?v=20261003v';
document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
reveal();
const I = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>'
};
const qs = new URLSearchParams(location.search);
const n = cleanTrack(qs.get('n')), c0 = CARRIERS[qs.get('c')] ? qs.get('c') : 'flash';
const copy = (silent) => navigator.clipboard && navigator.clipboard.writeText(n).then(() => { if (!silent) toast('คัดลอกเลขพัสดุแล้ว'); }, () => {});
function render(s) {
  const c = (s && CARRIERS[s.carrier]) ? s.carrier : c0, car = CARRIERS[c];
  $('tCard').hidden = false; $('tNum').textContent = n; $('tCarrier').textContent = car.name + ' · เลขพัสดุ';
  $('tJob').textContent = (s && s.title) || '';
  const ev = ((s && s.events) || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const last = latest(ev), st = last ? toneOf(last) : null;
  $('tTitle').textContent = st === 'delivered' ? 'พัสดุส่งถึงแล้ว' : st === 'out' ? 'พัสดุของคุณใกล้ถึงแล้ว' : st === 'issue' ? 'การจัดส่งมีปัญหา' : 'พัสดุของคุณกำลังเดินทาง';
  const now = $('tNow'); now.textContent = ''; now.className = 'trk__now' + (st === 'delivered' ? ' is-ok' : st === 'issue' ? ' is-bad' : (!last || st === 'sent') ? ' is-wait' : '');
  const ic = h('span', 'trk__nowic'); ic.innerHTML = st === 'delivered' ? I.check : st === 'issue' ? I.alert : (!last || st === 'sent') ? I.box : I.truck;
  const t = h('div');
  if (last && st !== 'sent') {
    t.append(h('b', null, titleOf(last)));
    const det = detailOf(last);
    t.append(h('span', null, 'อัปเดตล่าสุด ' + fmtWhen(last.at) + (det ? ' · ' + det : '')));
  } else {
    t.append(h('b', null, 'ตรวจสอบและจัดส่งโดย UNITAC เรียบร้อย'), h('span', null, 'กดปุ่มด้านล่างเพื่อดูสถานะล่าสุดที่ ' + car.name));
  }
  if (s && s.eta && st !== 'delivered') t.append(h('span', null, ' · คาดว่าถึง ' + new Date(s.eta).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })));
  now.append(ic, t);
  const L = $('tList'); L.textContent = '';
  ev.forEach((e, i) => {
    const et = toneOf(e), tone = i === 0 ? (et === 'delivered' ? 'ok' : et === 'issue' ? 'bad' : et === 'sent' ? 'done' : 'now') : 'done';
    const li = h('li', 'tli' + (tone === 'now' ? ' tli--now' : tone === 'bad' ? ' tli--bad' : ''));
    const d = h('span', 'tli__dot'); d.innerHTML = tone === 'now' ? I.truck : tone === 'bad' ? I.alert : I.check;
    const tt = h('div', 'tli__t'); tt.append(h('b', null, titleOf(e)), h('span', null, fmtWhen(e.at)));
    const det = detailOf(e); if (det) tt.append(h('em', null, det));
    li.append(d, tt); L.appendChild(li);
  });
  if (st !== 'delivered') {
    const li = h('li', 'tli tli--wait'), d = h('span', 'tli__dot'), tt = h('div', 'tli__t');
    tt.append(h('b', null, 'ถึงมือคุณ'), h('span', null, s && s.eta ? 'ประมาณ ' + new Date(s.eta).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'รออัปเดต'));
    li.append(d, tt); L.prepend(li);
  }
  const off = $('tOfficial');
  if (car.url) { off.hidden = false; off.href = car.url(n); off.innerHTML = ''; off.append('ดูรายละเอียดที่ ' + car.name + ' '); off.insertAdjacentHTML('beforeend', I.ext); }
  $('tFoot').hidden = false;
  $('tFoot').textContent = (s && s.updatedAt ? 'ร้านอัปเดตสถานะล่าสุด ' + fmtWhen(s.updatedAt) + ' · ' : '') + 'กดปุ่มแล้วระบบคัดลอกเลขพัสดุไว้ให้ ถ้าหน้าขนส่งไม่เติมเลขเอง กดวางได้เลย';
}
if (n) {
  document.title = 'ติดตามพัสดุ ' + n + ' · UNITAC'; $('tIn').value = n;
  render(null);
  onSnapshot(doc(db, 'shipments', n), (s) => render(s.exists() ? s.data() : null), () => {});
  /* live: ask the Flash connection to refresh this parcel; the new status arrives through the snapshot above */
  if (FLASH_FN_URL && c0 === 'flash') {
    const live = () => fetch(FLASH_FN_URL + '?n=' + encodeURIComponent(n)).catch(() => {});
    live(); setInterval(() => { if (!document.hidden) live(); }, 5 * 60 * 1000);
  }
  $('tCopy').addEventListener('click', () => copy(false));
  $('tOfficial').addEventListener('click', () => copy(true));
}
$('tForm').addEventListener('submit', (e) => { e.preventDefault(); const v = cleanTrack($('tIn').value); if (v) location.search = '?n=' + v + '&c=' + c0; });
