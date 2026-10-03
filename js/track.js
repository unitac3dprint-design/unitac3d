import { $, reveal, toast, LOGO_SVG } from './core.js?v=20261003h';
import { CARRIERS, track17, cleanTrack } from './carriers.js?v=20261003h';
document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
reveal();
const qs = new URLSearchParams(location.search);
const n = cleanTrack(qs.get('n')), c = CARRIERS[qs.get('c')] ? qs.get('c') : 'flash';
function copy(silent) { if (navigator.clipboard) navigator.clipboard.writeText(n).then(() => { if (!silent) toast('คัดลอกเลขพัสดุแล้ว'); }, () => {}); }
if (n) {
  const car = CARRIERS[c];
  $('tCard').hidden = false; $('tNum').textContent = n; $('tCarrier').textContent = car.name; $('tTitle').textContent = 'พัสดุของคุณกำลังเดินทาง';
  document.title = 'ติดตามพัสดุ ' + n + ' · UNITAC';
  const off = $('tOfficial');
  if (car.url) { off.href = car.url(n); off.textContent = 'เปิดหน้าติดตามของ ' + car.name; } else off.hidden = true;
  $('t17').href = track17(n);
  [off, $('t17')].forEach(a => a.addEventListener('click', () => copy(true)));
  $('tCopy').addEventListener('click', () => copy(false));
  $('tIn').value = n;
  /* live status inside the page (17TRACK widget); the buttons above always work as a fallback */
  const s = document.createElement('script'); s.src = 'https://www.17track.net/externalcall.js'; s.async = true;
  s.onload = () => {
    try { window.YQV5.trackSingle({ YQ_ContainerId: 'YQContainer', YQ_Height: 560, YQ_Fc: '0', YQ_Lang: 'th', YQ_Num: n }); $('tLiveNote').hidden = true; }
    catch (_) { $('tLiveNote').textContent = 'กดปุ่มด้านล่างเพื่อดูสถานะล่าสุด'; }
  };
  s.onerror = () => { $('tLiveNote').textContent = 'กดปุ่มด้านล่างเพื่อดูสถานะล่าสุด'; };
  document.body.appendChild(s);
} else { $('tTitle').textContent = 'ติดตามพัสดุ'; }
$('tForm').addEventListener('submit', (e) => { e.preventDefault(); const v = cleanTrack($('tIn').value); if (v) location.search = '?n=' + v + '&c=' + c; });
