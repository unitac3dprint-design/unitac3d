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
  return { pct, expires, used, expired, verified, usable: !used && !expired && verified, open: !used && !expired };
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

/* avatar: square crop + resize to a small JPEG data URL */
export function toAvatar(file, size = 256) {
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

/* rank card element */
export function rankCard(m, uid, opts = {}) {
  const r = rankOf(m);
  const wrap = h('div', 'rcard rcard--' + r.key);
  wrap.style.cssText = `--rb:${r.base};--rc:${r.c};--rh:${r.hatch};--rink:${r.ink};--rsub:${r.sub}`;
  const no = memberNo(uid);
  wrap.innerHTML = `<div class="rcard__in">
    <div class="rcard__face rcard__front">
      <div class="rcard__top"><svg viewBox="4.3 21.5 85.5 36.5" aria-hidden="true"><path fill="currentColor" d="${MARK_PATH}"/></svg><span class="rcard__tag">${r.partner ? 'PARTNER' : 'MEMBER'}</span></div>
      <div class="rcard__rank">${r.key.toUpperCase()}</div>
      <div class="rcard__bot"><div class="rcard__who"><span class="rcard__nick"></span><span class="rcard__no">${no}</span></div>
        <div class="rcard__disc"><small>ส่วนลด</small><b>${r.disc}%</b></div></div>
    </div>
    <div class="rcard__face rcard__back">
      <div class="rcard__qr">${opts.qr === false ? '' : qrSvg('UNITAC:M:' + uid)}</div>
      <div class="rcard__btxt"><b>แสดง QR นี้ที่ร้าน</b><span>สแกนแล้วระบบใส่ส่วนลด ${r.disc}% ให้ในใบเสนอราคา</span><i>${no}</i></div>
    </div></div>`;
  wrap.querySelector('.rcard__nick').textContent = (m && m.nickname) || 'สมาชิก';
  return wrap;
}
