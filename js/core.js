/* UNITAC — shared rules of the membership system (ranks, points, coupon, formatting) */

export const RANKS = [
  { key: 'Bronze',   min: 0,    disc: 5,  c: '#D0946A', base: '#241A13', hatch: 'rgba(208,148,106,.10)', ink: '#F2EDE5', sub: '#B9AB9B' },
  { key: 'Silver',   min: 300,  disc: 10, c: '#D3D7DC', base: '#1C1D1F', hatch: 'rgba(211,215,220,.09)', ink: '#F2EDE5', sub: '#AFB2B6' },
  { key: 'Gold',     min: 1000, disc: 15, c: '#E9C46A', base: '#221C0F', hatch: 'rgba(233,196,106,.10)', ink: '#F2EDE5', sub: '#B9AD8E' },
  { key: 'Platinum', min: 2500, disc: 20, c: '#B4D3D8', base: '#15201F', hatch: 'rgba(180,211,216,.09)', ink: '#F2EDE5', sub: '#9FB1B3' },
  { key: 'Diamond',  min: 6000, disc: 25, c: '#A9D6F5', base: '#111A23', hatch: 'rgba(169,214,245,.10)', ink: '#F2EDE5', sub: '#9AAEBE' },
  { key: 'Rhodium',  min: null, disc: 30, c: '#141311', base: '#E7E8EA', hatch: 'rgba(20,19,17,.07)',   ink: '#141311', sub: '#4A473F', partner: true }
];
export const POINT_BAHT = 10;          /* ค่าพิมพ์ทุก 10 บาท = 1 แต้ม */
export const COUPON_DAYS = 30;
export const COUPON_CAP = 500;         /* ส่วนคูปองลดสูงสุด 500 บาท */
export const WARRANTY_DEFAULT = 30;

export function rankOf(m) {
  if (m && m.rhodium) return RANKS[5];
  const p = (m && +m.points) || 0;
  let r = RANKS[0];
  for (const x of RANKS) if (x.min != null && p >= x.min) r = x;
  return r;
}
export function nextRank(m) {
  if (m && m.rhodium) return null;
  const p = (m && +m.points) || 0;
  return RANKS.find(x => x.min != null && x.min > p) || null;
}
export function pointsFor(printPaid) { return Math.max(0, Math.floor((+printPaid || 0) / POINT_BAHT)); }

/* FNV-1a 32 bit — deterministic, so the welcome coupon is fixed the moment the account exists */
export function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function couponPct(uid) {
  const r = hash32('unitac-welcome:' + uid) % 100;
  return r < 65 ? 5 : r < 93 ? 10 : 15;
}
export function memberNo(uid) {
  return 'UT-' + hash32('unitac-member:' + uid).toString(36).toUpperCase().padStart(7, '0').slice(-7);
}
export function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v); return isNaN(d) ? null : d;
}
export function couponInfo(m, uid, now = new Date()) {
  const pct = couponPct(uid);
  const created = toDate(m && m.createdAt);
  const expires = created ? new Date(created.getTime() + COUPON_DAYS * 864e5) : null;
  const used = !!(m && m.welcomeUsed);
  const expired = !!(expires && now > expires);
  const verified = !!(m && m.verified);
  const blocked = !!(m && (m.deviceDup || m.couponBlocked));
  return { pct, expires, used, expired, verified, blocked, usable: !used && !expired && verified && !blocked, open: !used && !expired && !blocked };
}

/* formatting */
export const th = (o) => new Intl.DateTimeFormat('th-TH', o);
export const fDate = th({ day: 'numeric', month: 'short', year: 'numeric' });
export const fDM = th({ day: 'numeric', month: 'short' });
export const fMonthYear = th({ month: 'short', year: 'numeric' });
export function money(n) { return (+n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function intf(n) { return (+n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
export function daysLeft(exp, now = new Date()) { return exp ? Math.ceil((exp - now) / 864e5) : 0; }

/* warranty codes: UT-XXXX-XX without look-alike characters */
const WC = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function warrantyCode() {
  const a = new Uint32Array(6); crypto.getRandomValues(a);
  const c = [...a].map(x => WC[x % WC.length]).join('');
  return 'UT-' + c.slice(0, 4) + '-' + c.slice(4);
}

/* small DOM helpers */
export const $ = (id) => document.getElementById(id);
export function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
let toastT;
export function toast(msg, ms = 2800) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', 'toast'); t.id = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
export function reveal() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  document.documentElement.classList.add('js');
  requestAnimationFrame(() => document.querySelectorAll('.rv').forEach(e => e.classList.add('in')));
}

/* QR (vendor/qrcode.js must be loaded first) */
export function qrSvg(text) {
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(); let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" role="img" aria-label="QR"><path d="${d}" fill="#141311"/></svg>`;
}

/* iPhone photos (.heic / .heif): Safari draws them natively; other browsers get them converted to JPEG first */
let heicLoading = null;
export function isHeic(f) { return /image\/hei[cf]/i.test((f && f.type) || '') || /\.(heic|heif)$/i.test((f && f.name) || ''); }
function canDraw(file) {
  return new Promise((res) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i.naturalWidth > 0); }; i.onerror = () => { URL.revokeObjectURL(u); res(false); }; i.src = u; });
}
export async function normalizeImage(file) {
  if (!isHeic(file)) return file;
  if (await canDraw(file)) return file;
  if (!window.heic2any) {
    if (!heicLoading) heicLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = new URL('../vendor/heic2any.min.js', import.meta.url).href; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    await heicLoading;
  }
  const out = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' });
}

/* avatar: square crop + resize to a small JPEG data URL */
export async function toAvatar(file, size = 256) {
  file = await normalizeImage(file);
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = rej;
    r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
      const m = Math.min(im.naturalWidth, im.naturalHeight); g.fillStyle = '#1D1B18'; g.fillRect(0, 0, size, size);
      g.drawImage(im, (im.naturalWidth - m) / 2, (im.naturalHeight - m) / 2, m, m, 0, 0, size, size);
      res(c.toDataURL('image/jpeg', 0.85)); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}
export function avatarEl(m, size = 44) {
  const a = h('span', 'av'); a.style.setProperty('--s', size + 'px');
  if (m && m.avatar) { const i = h('img'); i.src = m.avatar; i.alt = ''; a.appendChild(i); }
  else a.textContent = ((m && (m.nickname || m.email)) || '?').trim().charAt(0).toUpperCase();
  return a;
}

export const MARK_PATH = 'M4.85 24.9Q4.85 22.05 7.7 22.05H10.5L12.4 24.9L16.6 22.05H26Q27.3 22.05 27.3 23.3V24.54L12.14 41.96Q11.1 43.16 11.1 44.56V45.25Q11.1 46.85 12.7 46.85H25.54L47.12 22.05H84.2L89.3 27.7V28.4Q89.3 30.1 86.9 30.1H72.56L48.73 57.5H40.02Q36.23 57.5 38.73 54.63L60.06 30.1H52.46L28.63 57.5H7.65Q4.85 57.5 4.85 54.7Z';
export const LOGO_SVG = '<svg viewBox="4.25 5.75 86.1 52.35" role="img" aria-label="UNITAC"><path fill="currentColor" d="'+MARK_PATH+'"/><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="miter" stroke-miterlimit="8"><path d="M6.7 6.6V13.3Q6.7 14.85 8.25 14.85H19.25V6.6"/><path d="M21.8 15.75V8.9Q21.8 7.45 23.25 7.45H26.8V14.85H32.5Q34.45 14.85 34.45 12.9V6.6"/><path d="M36 7.45H38.8V14.85H41.4"/><path d="M41.7 10.2V7.45H54.4V10.2M48.1 7.45V14.85M45.7 14.85H50.5"/><path d="M57.2 15.75V7.45H65.5L68.7 11V15.75M67.3 14.85H69M68.3 11.2L64 14.85H57.2"/><path d="M83.85 10V7.45H71.15V10.5L75.8 14.85H83.7V12"/></g><g transform="translate(87.95 8.55)" fill="none" stroke="currentColor"><circle r="1.55" stroke-width=".42"/><path d="M-.55 .85V-.85H.15Q.65 -.85 .65 -.35Q.65 .15 .15 .15H-.55M.1 .15L.65 .85" stroke-width=".36"/></g></svg>';

/* rank card element: tilt + light, rank material, embossed marks, progress edge */
export function rankProgress(m) {
  const r = rankOf(m), nx = nextRank(m);
  if (r.partner || !nx) return 1;
  return Math.max(0.02, Math.min(1, (((m && +m.points) || 0) - r.min) / (nx.min - r.min)));
}
export function rankCard(m, uid, opts = {}) {
  const r = rankOf(m);
  const wrap = h('div', 'rcard rcard--' + r.key);
  wrap.style.cssText = `--rb:${r.base};--rc:${r.c};--rh:${r.hatch};--rink:${r.ink};--rsub:${r.sub}`;
  const no = memberNo(uid), p = rankProgress(m);
  wrap.innerHTML = `<div class="rcard__tilt"><div class="rcard__in">
    <div class="rcard__face rcard__front">
      <span class="rcard__mat" aria-hidden="true"></span><span class="rcard__holo" aria-hidden="true"></span>
      <div class="rcard__top"><svg viewBox="4.3 21.5 85.5 36.5" aria-hidden="true"><path fill="currentColor" d="${MARK_PATH}"/></svg><span class="rcard__tag">${r.partner ? 'PARTNER' : 'MEMBER'}</span></div>
      <div class="rcard__rank">${r.key.toUpperCase()}</div>
      <div class="rcard__bot"><div class="rcard__who"><span class="rcard__nick"></span><span class="rcard__no">${no}</span></div>
        <div class="rcard__disc"><small>ส่วนลด</small><b>${r.disc}%</b></div></div>
      <span class="rcard__edge" aria-hidden="true"><i style="width:${(p * 100).toFixed(1)}%"></i></span>
      <span class="rcard__glare" aria-hidden="true"></span><span class="rcard__glint" aria-hidden="true"></span>
    </div>
    <div class="rcard__face rcard__back">
      <span class="rcard__mat" aria-hidden="true"></span>
      <div class="rcard__qr">${opts.qr === false ? '' : qrSvg('UNITAC:M:' + uid)}</div>
      <div class="rcard__btxt"><b>แสดง QR นี้ที่ร้าน</b><span>สแกนแล้วระบบใส่ส่วนลด ${r.disc}% ให้ในใบเสนอราคา</span><i>${no}</i></div>
      <span class="rcard__glare" aria-hidden="true"></span>
    </div></div></div>`;
  wrap.querySelector('.rcard__nick').textContent = (m && m.nickname) || 'สมาชิก';
  return wrap;
}

/* card motion:
   - mouse / finger hover tilts the card (up to ±24°) and moves the light
   - swipe sideways to spin the card and see the back
   - the phone's motion sensor tilts every card on the page */
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function setTilt(card, rx, ry) {
  const fl = card.classList.contains('is-flipped') ? -1 : 1;
  card.style.setProperty('--rx', rx.toFixed(2) + 'deg');
  card.style.setProperty('--ry', ry.toFixed(2) + 'deg');
  card.style.setProperty('--gx', clampN(50 + ry * 2.2 * fl, 0, 100).toFixed(1) + '%');
  card.style.setProperty('--gy', clampN(30 - rx * 2.2, 0, 100).toFixed(1) + '%');
  card.style.setProperty('--tilt', clampN(Math.hypot(rx, ry) / 22, 0, 1).toFixed(3));
}
export function attachTilt(card, host) {
  host = host || card;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let raf = 0, ev = null, down = null, dragging = false, lastX = 0, lastT = 0, vel = 0;
  const isFlipped = () => card.classList.contains('is-flipped');
  function hover() {
    raf = 0; if (!ev || dragging) return;
    const b = card.getBoundingClientRect();
    const x = clampN((ev.clientX - b.left) / b.width, 0, 1), y = clampN((ev.clientY - b.top) / b.height, 0, 1);
    setTilt(card, (0.5 - y) * 36, (x - 0.5) * 48 * (isFlipped() ? -1 : 1));
  }
  function reset() {
    ev = null; card.classList.remove('is-tilting', 'is-pointer');
    ['--rx', '--ry', '--tilt'].forEach(k => card.style.removeProperty(k));
    card.style.setProperty('--gx', '50%'); card.style.setProperty('--gy', '25%');
  }
  host.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, base: isFlipped() ? 180 : 0 }; dragging = false; lastX = e.clientX; lastT = performance.now(); vel = 0;
    card.classList.add('is-pointer');
    if (e.pointerType !== 'mouse') { ev = e; card.classList.add('is-tilting'); if (!raf) raf = requestAnimationFrame(hover); }
    requestGyro();
  });
  host.addEventListener('pointermove', (e) => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!dragging && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) { dragging = true; card.classList.add('is-dragging'); host._dragged = true; ['--rx', '--ry'].forEach(k => card.style.removeProperty(k)); }
      if (dragging) {
        const now = performance.now(); vel = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
        card.style.setProperty('--flip', (down.base + clampN(dx * 0.9, -200, 200)).toFixed(1) + 'deg');
        card.style.setProperty('--tilt', clampN(Math.abs(dx) / 160, 0, 1).toFixed(3));
        card.style.setProperty('--gx', clampN(50 - dx * 0.4, 0, 100).toFixed(1) + '%');
        return;
      }
    }
    if (e.pointerType === 'mouse' || down) { ev = e; card.classList.add('is-tilting', 'is-pointer'); if (!raf) raf = requestAnimationFrame(hover); }
  });
  function end(e) {
    if (dragging) {
      const dx = e.clientX - down.x, turn = Math.abs(dx * 0.9) > 70 || Math.abs(vel) > 0.6;
      card.classList.remove('is-dragging'); card.style.removeProperty('--flip');
      if (turn) { card.classList.toggle('is-flipped'); card.dispatchEvent(new CustomEvent('cardflip', { bubbles: true, detail: isFlipped() })); }
      setTimeout(() => { host._dragged = false; }, 50);
    }
    down = null; dragging = false;
    if (!e || e.pointerType !== 'mouse') reset();
  }
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
  host.addEventListener('pointerleave', (e) => { if (down && dragging) end(e); else if (e.pointerType === 'mouse') { down = null; reset(); } });
  startGyro();
}

/* phone motion sensor → every card on the page */
let gyroOn = false, gyroAsked = false, g0 = null, gs = { rx: 0, ry: 0 }, graf = 0, glast = null;
function onOrient(e) {
  if (e.beta == null || e.gamma == null) return;
  if (!g0) g0 = { b: e.beta, g: e.gamma };
  g0.b += (e.beta - g0.b) * 0.015; g0.g += (e.gamma - g0.g) * 0.015;   /* slowly follow how the phone is held */
  glast = { rx: clampN(-(e.beta - g0.b) * 0.9, -18, 18), ry: clampN((e.gamma - g0.g) * 1.1, -25, 25) };
  if (!graf) graf = requestAnimationFrame(gyroFrame);
}
function gyroFrame() {
  graf = 0; if (!glast) return;
  gs.rx += (glast.rx - gs.rx) * 0.25; gs.ry += (glast.ry - gs.ry) * 0.25;
  document.querySelectorAll('.rcard').forEach(c => {
    if (c.classList.contains('is-pointer') || c.classList.contains('is-dragging')) return;
    c.classList.add('is-gyro'); setTilt(c, gs.rx, gs.ry * (c.classList.contains('is-flipped') ? -1 : 1));
  });
  if (Math.abs(glast.rx - gs.rx) + Math.abs(glast.ry - gs.ry) > 0.05) graf = requestAnimationFrame(gyroFrame);
}
export function startGyro() {
  if (gyroOn || !('DeviceOrientationEvent' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') return;   /* iOS: wait for a tap */
  gyroOn = true; window.addEventListener('deviceorientation', onOrient);
}
export function requestGyro() {
  if (gyroOn || gyroAsked || !('DeviceOrientationEvent' in window)) return;
  if (typeof DeviceOrientationEvent.requestPermission !== 'function') return startGyro();
  gyroAsked = true;
  DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') { gyroOn = true; window.addEventListener('deviceorientation', onOrient); } }).catch(() => {});
}

/* one id per browser, used to stop the same phone from collecting welcome coupons again and again */
export function deviceId() {
  let id = null;
  try { id = localStorage.getItem('unitac-device'); } catch (_) {}
  if (!id) { const m = document.cookie.match(/(?:^|; )unitac_device=([A-Za-z0-9]+)/); if (m) id = m[1]; }
  if (!id) { const a = new Uint32Array(3); crypto.getRandomValues(a); id = [...a].map(x => x.toString(36)).join(''); }
  try { localStorage.setItem('unitac-device', id); } catch (_) {}
  try { document.cookie = 'unitac_device=' + id + ';max-age=63072000;path=/;SameSite=Lax'; } catch (_) {}
  return id;
}

/* soft orange light that follows the mouse, on the back-most layer (same feel as the queue page) */
export function mouseGlow() {
  if (window.__unitacGlow || !matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.__unitacGlow = true;
  const g = document.createElement('div'); g.className = 'mglow'; g.setAttribute('aria-hidden', 'true');
  document.body.prepend(g);
  let tx = innerWidth / 2, ty = innerHeight / 3, x = tx, y = ty, raf = 0;
  const step = () => {
    x += (tx - x) * 0.12; y += (ty - y) * 0.12;
    g.style.setProperty('--mx', x.toFixed(1) + 'px'); g.style.setProperty('--my', y.toFixed(1) + 'px');
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(step) : 0;
  };
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; tx = e.clientX; ty = e.clientY; g.classList.add('is-on'); if (!raf) raf = requestAnimationFrame(step); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => g.classList.remove('is-on'));
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mouseGlow); else mouseGlow();
}

/* filament selling price: entered per spool. Older records stored "per gram"; a value above 20 ฿/g can only be a spool price */
export function sellPerSpoolOf(m) {
  if (!m) return 0;
  if (+m.sellPerSpool > 0) return +m.sellPerSpool;
  const g = +m.sellPerGram || 0, w = +m.spoolWeight || 1000;
  return g > 20 ? g : g * w;
}
export function sellPerGramOf(m) { const w = +(m && m.spoolWeight) || 1000; return sellPerSpoolOf(m) / w; }

/* site cursor: white box, turns orange and rotates 45° over anything clickable */
if (typeof document !== 'undefined') (function(){
  if(window.__unitacCursor||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  window.__unitacCursor=true;
  var CSS='html.has-cc,html.has-cc *{cursor:none!important}'+
    'html.has-cc input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]),html.has-cc textarea,html.has-cc [contenteditable=true]{cursor:text!important}'+
    '.ucur{position:fixed;left:0;top:0;width:24px;height:24px;margin:-12px 0 0 -12px;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .15s}'+
    '.ucur.on{opacity:1}.ucur.is-text{opacity:0}'+
    '.ucur svg{display:block;width:24px;height:24px;overflow:visible;transform:rotate(0deg);transition:transform .38s cubic-bezier(.34,1.56,.64,1)}'+
    '.ucur .o{stroke:#141311;stroke-width:3.6}.ucur .i{stroke:#F2EDE5;stroke-width:1.7;transition:stroke .2s}'+
    '.ucur.hot svg{transform:rotate(45deg)}.ucur.hot .i{stroke:#FF7A3C}'+
    '.ucur.down svg{transform:rotate(45deg) scale(.82)}'+
    '@media (prefers-reduced-motion: reduce){.ucur svg{transition:none}}';
  var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  var G='<rect x="8.5" y="8.5" width="7" height="7" rx=".6"/><path d="M8.5 8.5 4.5 4.5M15.5 8.5l4-4M8.5 15.5l-4 4M15.5 15.5l4 4"/>';
  var c=document.createElement('div');c.className='ucur';c.setAttribute('aria-hidden','true');
  c.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round"><g class="o">'+G+'</g><g class="i">'+G+'</g></svg>';
  function mount(){(document.body||document.documentElement).appendChild(c);document.documentElement.classList.add('has-cc');}
  if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount);
  var HOT='a,button,label,select,summary,[role=button],[role=tab],.day,.chip,.ditem,.pw,.ptile,.rcard-btn,.crow,.wit,.coupon,input[type=checkbox],input[type=radio],input[type=file],input[type=range],input[type=color],input[type=submit]';
  var TEXT='input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not([type=submit]),textarea,[contenteditable=true]';
  addEventListener('pointermove',function(e){
    if(e.pointerType!=='mouse')return;
    var dl=document.querySelectorAll('dialog[open]'),top=dl.length?dl[dl.length-1]:document.body;
    if(c.parentNode!==top)top.appendChild(c);
    c.style.transform='translate3d('+e.clientX+'px,'+e.clientY+'px,0)';
    var t=e.target&&e.target.closest?e.target:null;
    c.classList.add('on');
    c.classList.toggle('is-text',!!(t&&t.closest(TEXT)));
    var hot=t&&t.closest(HOT);c.classList.toggle('hot',!!(hot&&!hot.disabled&&!hot.closest('[disabled]')));
  },{passive:true});
  addEventListener('pointerdown',function(e){if(e.pointerType==='mouse')c.classList.add('down');},{passive:true});
  addEventListener('pointerup',function(){c.classList.remove('down');},{passive:true});
  document.documentElement.addEventListener('mouseleave',function(){c.classList.remove('on');});
})();
