import {
  auth, db, OWNER, authMsg, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, reload,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, where, serverTimestamp
} from './fb.js?v=20261003w';
import {
  RANKS, rankOf, nextRank, couponInfo, memberNo, toDate, fDate, fDM, fMonthYear, money, intf, daysLeft,
  COUPON_CAP, $, h, toast, reveal, toAvatar, avatarEl, rankCard, attachTilt, requestGyro, deviceId, qrSvg, LOGO_SVG
} from './core.js?v=20261003w';

document.querySelectorAll('[data-logo]').forEach(e => { e.innerHTML = LOGO_SVG; });
document.querySelector('[data-nav="member"]').setAttribute('aria-current', 'page');

const V = { loading: $('vLoading'), auth: $('vAuth'), owner: $('vOwner'), home: $('vHome'), profile: $('vProfile') };
let user = null, member = null, orders = [], unsubM = null, queueShop = null, flipped = false, showAllOrders = false;

let curView = null;
function show(name) {
  if (curView === name) return;
  const first = curView === null || curView === 'loading';
  curView = name;
  Object.entries(V).forEach(([k, el]) => { el.hidden = k !== name; el.classList.remove('view-in'); });
  const el = V[name]; void el.offsetWidth; el.classList.add('view-in');
  if (!first) window.scrollTo(0, 0);
}
function route() {
  if (!user) return show('auth');
  if (user.uid === OWNER) { location.replace('admin.html'); return show('owner'); }
  if (!member) return show('loading');
  if (location.hash === '#profile') { renderProfile(); show('profile'); }
  else { renderHome(); show('home'); reveal(); }
}
window.addEventListener('hashchange', route);

/* ---------- password eye ---------- */
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:18px;height:18px"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
document.querySelectorAll('.pweye').forEach(b => {
  b.innerHTML = EYE;
  b.addEventListener('click', () => {
    const i = b.previousElementSibling; const showIt = i.type === 'password';
    i.type = showIt ? 'text' : 'password';
    b.setAttribute('aria-label', showIt ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
  });
});

/* ---------- tabs ---------- */
function setTab(up) {
  $('tabIn').setAttribute('aria-selected', String(!up)); $('tabUp').setAttribute('aria-selected', String(up));
  $('fIn').hidden = up; $('fUp').hidden = !up;
}
$('tabIn').addEventListener('click', () => setTab(false));
$('tabUp').addEventListener('click', () => setTab(true));

function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = label; }
function err(el, msg) { el.textContent = msg; el.hidden = !msg; }

/* ---------- sign in ---------- */
$('fIn').addEventListener('submit', async (e) => {
  e.preventDefault();
  const em = $('inEmail').value.trim(), pw = $('inPass').value, b = $('inOk');
  if (!em || !pw) return err($('inErr'), 'กรอกอีเมลและรหัสผ่าน');
  err($('inErr'), ''); busy(b, true, 'กำลังเข้าสู่ระบบ…');
  try { await signInWithEmailAndPassword(auth, em, pw); }
  catch (x) { err($('inErr'), authMsg(x.code)); }
  busy(b, false, 'เข้าสู่ระบบ');
});
$('forgotBtn').addEventListener('click', async () => {
  const em = $('inEmail').value.trim();
  if (!em) { err($('inErr'), 'กรอกอีเมลก่อน แล้วกดลืมรหัสผ่านอีกครั้ง'); $('inEmail').focus(); return; }
  try { await sendPasswordResetEmail(auth, em); err($('inErr'), ''); toast('ถ้าอีเมลนี้มีบัญชี ระบบส่งลิงก์ตั้งรหัสใหม่ไปแล้ว', 5000); }
  catch (x) { err($('inErr'), authMsg(x.code)); }
});

/* ---------- sign up ---------- */
let creating = false;
$('fUp').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nick = $('upNick').value.trim(), em = $('upEmail').value.trim(), pw = $('upPass').value, b = $('upOk');
  if (!nick) return err($('upErr'), 'ตั้งชื่อเล่นก่อน');
  if (!em) return err($('upErr'), 'กรอกอีเมล');
  if (pw.length < 8 || !/\d/.test(pw)) return err($('upErr'), 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีตัวเลขอย่างน้อย 1 ตัว');
  if (!$('upConsent').checked) return err($('upErr'), 'กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร');
  err($('upErr'), ''); busy(b, true, 'กำลังสมัคร…'); creating = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, em, pw);
    const sent = await sendVerify(cred.user);
    await createMember(cred.user, nick);
    toast(sent === true ? 'สมัครเรียบร้อย ส่งอีเมลยืนยันไปที่ ' + em + ' แล้ว' : 'สมัครเรียบร้อย แต่ส่งอีเมลยืนยันไม่สำเร็จ กด "ส่งลิงก์อีกครั้ง" ในหน้าสมาชิก', 6000);
  } catch (x) { err($('upErr'), authMsg(x.code)); }
  creating = false; busy(b, false, 'สมัครและรับบัตร Bronze');
  if (auth.currentUser) watchMember(auth.currentUser);
});
function createMember(u, nick) {
  const dev = deviceId();
  let firstUid = null; try { firstUid = localStorage.getItem('unitac-device-uid'); } catch (_) {}
  const dup = !!(firstUid && firstUid !== u.uid);
  if (!firstUid) { try { localStorage.setItem('unitac-device-uid', u.uid); } catch (_) {} }
  return setDoc(doc(db, 'members', u.uid), {
    deviceId: dev, deviceDup: dup,
    nickname: (nick || (u.email || '').split('@')[0] || 'สมาชิก').slice(0, 20),
    email: u.email || '', fullName: '', phone: '', avatar: '', addresses: [],
    points: 0, rhodium: false, welcomeUsed: false, verified: false, deleteRequested: false,
    createdAt: serverTimestamp(), consentAt: serverTimestamp()
  });
}

/* ---------- session ---------- */
onAuthStateChanged(auth, (u) => {
  user = u; member = null; orders = [];
  if (unsubM) { unsubM(); unsubM = null; }
  renderTopEnd();
  if (!u || u.uid === OWNER) return route();
  try { const c = localStorage.getItem('unitac-member-cache:' + u.uid); if (c) { const o = JSON.parse(c); member = o.m; orders = o.o || []; } } catch (_) {}
  if (member) route(); else show('loading');
  if (!creating) watchMember(u);
});
function watchMember(u) {
  if (unsubM) unsubM();
  unsubM = onSnapshot(doc(db, 'members', u.uid), async (snap) => {
    if (!snap.exists()) {
      if (creating) return;
      try { await createMember(u, ''); } catch (x) { toast(authMsg(x.code)); }
      return;
    }
    member = snap.data();
    saveCache();
    if (u.emailVerified && !member.verified) {
      try { await u.getIdToken(true); await updateDoc(doc(db, 'members', u.uid), { verified: true }); } catch (_) {}
    }
    route();
    checkRankUp();
  }, () => { toast('โหลดข้อมูลสมาชิกไม่สำเร็จ'); });
  loadOrders(u);
  loadShop();
}
async function loadOrders(u) {
  try {
    const qs = await getDocs(query(collection(db, 'orders'), where('uid', '==', u.uid)));
    orders = qs.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (toDate(b.deliveredAt) || 0) - (toDate(a.deliveredAt) || 0));
  } catch (_) { orders = []; }
  saveCache();
  if (member && !V.home.hidden) { renderWarranties(); renderOrders(); }
}
function saveCache() {
  if (!user || !member) return;
  try { localStorage.setItem('unitac-member-cache:' + user.uid, JSON.stringify({ m: member, o: orders.slice(0, 20) })); } catch (_) {}
}
/* live queue: shop contacts for booking + this member's jobs */
let queueDoc = null, unsubQ = null, qTimer = 0;
function loadShop() {
  if (unsubQ) return;
  unsubQ = onSnapshot(doc(db, 'public', 'queue'), (s) => {
    queueDoc = s.exists() ? s.data() : null; queueShop = queueDoc ? queueDoc.shop : null;
    if (member && !V.home.hidden) { renderBook(); renderMyJobs(); }
  }, () => {});
  clearInterval(qTimer); qTimer = setInterval(() => { if (member && !V.home.hidden) renderMyJobs(); }, 30000);
}
const pD = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const iD = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function qClosed(q, ds) { return (q.closedDays || []).includes(pD(ds).getDay()) || (q.items || []).some(it => it.kind === 'off' && it.start <= ds && it.end >= ds); }
function qProgress(q, it) {
  if (it.status === 'done') return 1; if (it.status !== 'printing') return 0;
  const days = []; let d = pD(it.start); for (let n = 0; n < 400 && iD(d) <= it.end; n++, d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) if (!qClosed(q, iD(d))) days.push(iD(d));
  if (!days.length) return 0; const now = Date.now();
  return days.reduce((s, ds) => s + Math.max(0, Math.min(1, (now - pD(ds).getTime()) / 864e5)), 0) / days.length;
}
const fWD = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
function renderMyJobs() {
  const sec = $('qSec'), L = $('qList'); if (!sec) return;
  const q = queueDoc; const mine = q && user ? (q.items || []).filter(it => it.kind === 'job' && it.uid === user.uid && it.status !== 'done') : [];
  sec.hidden = !mine.length; L.textContent = ''; $('qCount').textContent = mine.length ? mine.length + ' งาน' : '';
  mine.sort((a, b) => (a.status === 'printing' ? -1 : 1) - (b.status === 'printing' ? -1 : 1) || a.start.localeCompare(b.start)).forEach(it => {
    const mach = (q.machines || []).find(m => m.id === it.machine), design = mach && mach.type === 'design', p = qProgress(q, it);
    const card = h('div', 'qi'), hd = h('div', 'qi__h');
    const st = it.status === 'printing' ? (design ? 'กำลังเขียนแบบ' : 'กำลังพิมพ์') : 'รอคิว';
    hd.append(h('b', null, it.title || 'งานพิมพ์'), h('span', 'pill ' + (it.status === 'printing' ? 'pill--accent' : ''), st));
    card.appendChild(hd);
    if (it.status === 'printing') {
      const pr = h('div', 'qi__p'), bar = h('div', 'bar'), f = h('span', 'liq'); f.style.width = Math.max(2, p * 100).toFixed(1) + '%'; f.style.background = 'var(--accent)'; bar.appendChild(f);
      pr.append(bar, h('span', null, (p * 100).toFixed(0) + '%')); card.appendChild(pr);
    }
    const when = it.status === 'printing' ? 'คาดว่าเสร็จ ' + fWD.format(pD(it.end)) : 'เริ่มประมาณ ' + fWD.format(pD(it.start)) + ' · เสร็จราว ' + fWD.format(pD(it.end));
    card.appendChild(h('span', 'qi__m', when + (mach ? ' · ' + mach.name : '')));
    L.appendChild(card);
  });
}
function renderTopEnd() {
  const t = $('topEnd'); t.textContent = '';
  if (user && user.uid !== OWNER) {
    const a = h('a'); a.href = '#profile'; a.setAttribute('aria-label', 'ข้อมูลของฉัน'); a.style.borderRadius = '50%';
    a.appendChild(avatarEl(member, 36)); t.appendChild(a);
  }
}
document.querySelectorAll('[data-signout]').forEach(b => b.addEventListener('click', async () => {
  try { if (user) localStorage.removeItem('unitac-member-cache:' + user.uid); } catch (_) {}
  await signOut(auth); location.hash = ''; toast('ออกจากระบบแล้ว');
}));

/* ---------- home ---------- */
function renderHome() {
  const m = member, uid = user.uid, r = rankOf(m);
  renderTopEnd();
  const ha = $('helloAv'); ha.textContent = ''; ha.appendChild(avatarEl(m, 52));
  $('helloName').textContent = 'สวัสดี ' + (m.nickname || 'สมาชิก');
  const since = toDate(m.createdAt);
  $('helloSince').textContent = (since ? 'สมาชิกตั้งแต่ ' + fMonthYear.format(since) + ' · ' : '') + memberNo(uid);
  $('verifyBar').hidden = !!user.emailVerified || !!m.verified; $('verifyEmail').textContent = user.email || ''; $('verifyHelp').hidden = !!user.emailVerified; renderVerifyStatus();
  $('delBar').hidden = !m.deleteRequested;

  const cb = $('cardBtn'), key = [r.key, m.nickname, m.points, uid].join('|');
  let card = cb.querySelector('.rcard');
  if (!card || cb.dataset.key !== key) {
    cb.textContent = ''; card = rankCard(m, uid); cb.dataset.key = key;
    if (flipped) card.classList.add('is-flipped'); cb.appendChild(card); attachTilt(card);
  }
  if (!glinted && !matchMedia('(prefers-reduced-motion: reduce)').matches) { glinted = true; requestAnimationFrame(() => card.classList.add('is-glint')); }
  $('flipHint').textContent = flipped ? 'ปัดหรือแตะเพื่อพลิกกลับ' : 'แตะหรือปัดเพื่อพลิก · กดค้างเพื่อยื่นที่ร้าน';

  renderCoupon();

  $('pts').textContent = intf(m.points || 0);
  const nx = nextRank(m), bar = $('ptsBar');
  if (r.partner) { bar.style.width = '100%'; bar.style.background = 'var(--accent)'; $('ptsNext').innerHTML = '<b>Partner</b> · ส่วนลดสูงสุด 30% สำหรับพาร์ทเนอร์ของร้าน'; }
  else if (!nx) { bar.style.width = '100%'; bar.style.background = r.c; $('ptsNext').textContent = 'คุณอยู่แรงค์สูงสุดแล้ว · ลด ' + r.disc + '%'; }
  else {
    const pct = Math.max(2, Math.min(100, ((m.points || 0) - r.min) / (nx.min - r.min) * 100));
    bar.style.width = pct.toFixed(1) + '%'; bar.style.background = r.c;
    const p = $('ptsNext'); p.textContent = '';
    p.append('อีก ', Object.assign(h('b', 'num', intf(nx.min - (m.points || 0)))), ' แต้ม ถึง ');
    const rb = h('b', null, nx.key); rb.style.color = nx.key === 'Rhodium' ? 'var(--ink)' : nx.c; p.append(rb, ' · ลด ' + nx.disc + '%');
  }
  renderLadder(r);
  renderWarranties();
  renderOrders();
  renderBook();
  renderMyJobs();
}
let glinted = false, pressT = 0, pressXY = null, pressFired = false;
$('cardBtn').addEventListener('cardflip', (e) => {
  flipped = !!e.detail;
  $('flipHint').textContent = flipped ? 'ปัดหรือแตะเพื่อพลิกกลับ' : 'แตะหรือปัดเพื่อพลิก · กดค้างเพื่อยื่นที่ร้าน';
});
document.addEventListener('click', () => requestGyro(), { once: true });
$('cardBtn').addEventListener('click', () => {
  if (pressFired) { pressFired = false; return; }
  const rc = $('cardBtn').querySelector('.rcard'); if (rc && rc._dragged) return;
  flipped = !flipped; const c = $('cardBtn').querySelector('.rcard'); if (c) c.classList.toggle('is-flipped', flipped);
  $('flipHint').textContent = flipped ? 'ปัดหรือแตะเพื่อพลิกกลับ' : 'แตะหรือปัดเพื่อพลิก · กดค้างเพื่อยื่นที่ร้าน';
});
/* long press → counter mode */
$('cardBtn').addEventListener('pointerdown', (e) => {
  pressFired = false; pressXY = [e.clientX, e.clientY]; clearTimeout(pressT);
  pressT = setTimeout(() => { pressFired = true; if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {} openShowcase(); }, 550);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('cardBtn').addEventListener(t, () => clearTimeout(pressT)));
$('cardBtn').addEventListener('pointermove', (e) => { if (pressXY && Math.hypot(e.clientX - pressXY[0], e.clientY - pressXY[1]) > 10) clearTimeout(pressT); });
$('cardBtn').addEventListener('contextmenu', (e) => e.preventDefault());
$('showBtn').addEventListener('click', openShowcase);
function openShowcase() {
  if (!member || !user) return;
  const r = rankOf(member);
  $('showDlg').style.setProperty('--sc', r.key === 'Rhodium' ? '#FF7A3C' : r.c);
  $('showQr').innerHTML = qrSvg('UNITAC:M:' + user.uid);
  $('showRank').textContent = r.key.toUpperCase() + ' · ลด ' + r.disc + '%';
  $('showWho').textContent = member.nickname || 'สมาชิก';
  $('showNo').textContent = memberNo(user.uid);
  $('showDlg').showModal();
}
$('showIn').addEventListener('click', () => $('showDlg').close());
function renderLadder(r) {
  const box = $('ladder'); box.textContent = '';
  RANKS.filter(x => !x.partner || r.partner).forEach(x => {
    const d = h('div', x.key === r.key ? 'is-me' : '');
    const i = h('i'); i.style.setProperty('--c', x.key === 'Rhodium' ? '#E7E8EA' : x.c);
    d.append(i, h('span', null, x.key), h('span', 'need', x.min === 0 ? 'สมัคร' : x.partner ? 'partner' : intf(x.min) + ' แต้ม'), h('span', 'num', x.disc + '%'));
    box.appendChild(d);
  });
  box.appendChild(h('p', 'ladder__note', 'แต้มและส่วนลดใช้กับค่าพิมพ์เท่านั้น ไม่รวมค่าเขียนแบบและค่าจัดส่ง แต้มสะสมตลอดชีพ แรงค์ไม่ลด'));
}
$('ladderBtn').addEventListener('click', () => {
  const box = $('ladder'), open = box.hidden; box.hidden = !open;
  $('ladderBtn').textContent = open ? 'ซ่อนสิทธิ์ทุกแรงค์' : 'ดูสิทธิ์ทุกแรงค์';
  $('ladderBtn').setAttribute('aria-expanded', String(open));
});

/* ---------- welcome coupon ---------- */
const COUPON_COLOR = { 5: '#D0946A', 10: '#D3D7DC', 15: '#E9C46A' };
function renderCoupon() {
  const box = $('couponBox'), c = couponInfo(member, user.uid);
  box.textContent = '';
  if (c.blocked && !c.used) {
    box.hidden = false;
    const n = h('p', 'coupon-note', 'บัญชีนี้ไม่ได้รับคูปองต้อนรับ เพราะเครื่องนี้เคยสมัครสมาชิกและรับคูปองไปแล้ว คูปองต้อนรับให้เครื่องละหนึ่งครั้ง');
    box.appendChild(n); return;
  }
  if (!c.open) { box.hidden = true; return; }
  box.hidden = false;
  const key = 'unitac-coupon-seen:' + user.uid;
  let seen = false; try { seen = !!localStorage.getItem(key); } catch (_) {}
  const el = h('button', 'coupon' + (seen ? ' is-open' : ' coupon--closed')); el.type = 'button';
  el.style.setProperty('--cc', COUPON_COLOR[c.pct]);
  const pc = h('span', 'coupon__pct'); pc.appendChild(h('span', 'coupon__water')); pc.appendChild(h('b', null, seen ? '+' + c.pct + '%' : '?'));
  const t = h('span', 'coupon__t');
  if (seen) {
    t.append(h('b', null, 'คูปองต้อนรับ +' + c.pct + '%'),
      h('span', null, 'ใช้กับค่าพิมพ์งานแรก บวกเพิ่มจาก Bronze ลดส่วนนี้ได้สูงสุด ' + intf(COUPON_CAP) + ' บาท'),
      h('span', null, c.expires ? 'ใช้ได้ถึง ' + fDate.format(c.expires) + ' · เหลือ ' + daysLeft(c.expires) + ' วัน' : ''));
    if (!c.verified) t.appendChild(Object.assign(h('span', null, 'ยืนยันอีเมลก่อนจึงจะใช้ได้'), { style: 'color:var(--warn)' }));
    el.setAttribute('aria-label', 'คูปองต้อนรับ ' + c.pct + '%');
  } else {
    t.append(h('b', null, 'คูปองต้อนรับของคุณ'), h('span', null, 'แตะเพื่อเปิดดูว่าได้ส่วนลดเพิ่มเท่าไหร่สำหรับงานแรก'));
    el.setAttribute('aria-label', 'แตะเพื่อเปิดคูปองต้อนรับ');
    el.addEventListener('click', () => {
      try { localStorage.setItem(key, '1'); } catch (_) {}
      el.classList.remove('coupon--closed'); void el.offsetWidth; el.classList.add('is-open');
      setTimeout(() => { pc.querySelector('b').textContent = '+' + c.pct + '%'; }, 700);
      setTimeout(renderCoupon, 1700);
    }, { once: true });
  }
  el.append(pc, t); box.appendChild(el);
}

/* ---------- warranties & orders ---------- */
function renderWarranties() {
  const now = new Date();
  const ws = orders.filter(o => o.warrantyCode && toDate(o.expiresAt));
  const act = ws.filter(o => toDate(o.expiresAt) >= now).sort((a, b) => toDate(a.expiresAt) - toDate(b.expiresAt));
  const exp = ws.filter(o => toDate(o.expiresAt) < now);
  $('wCount').textContent = act.length ? act.length + ' ชิ้น' : '';
  const L = $('wList'); L.textContent = '';
  if (!act.length) L.appendChild(h('p', 'empty', ws.length ? 'ไม่มีประกันที่ยังคุ้มครอง' : 'งานที่มีประกันจะขึ้นที่นี่'));
  act.forEach(o => {
    const e = toDate(o.expiresAt), left = daysLeft(e, now), tot = o.warrantyDays || 30, soon = left <= 7;
    const it = h('div', 'wi'), hd = h('div', 'wi__h');
    const sp = h('span', null, 'เหลือ ' + left + ' วัน'); sp.style.color = soon ? 'var(--accent)' : 'var(--ok)';
    hd.append(h('b', null, o.title || 'งานพิมพ์'), sp);
    const bar = h('div', 'bar bar--thin'), fill = h('span'); fill.style.width = Math.max(3, Math.min(100, left / tot * 100)) + '%'; fill.style.setProperty('--c', soon ? 'var(--accent)' : 'var(--ok)'); bar.appendChild(fill);
    const meta = h('a', 'wi__m', o.warrantyCode + ' · ประกัน ' + tot + ' วัน · หมด ' + fDate.format(e)); meta.href = 'warranty.html?c=' + encodeURIComponent(o.warrantyCode);
    it.append(hd, bar, meta); L.appendChild(it);
  });
  const xb = $('wExpBtn'), X = $('wExp'); X.textContent = '';
  xb.hidden = !exp.length; xb.textContent = (X.hidden ? 'ดูที่หมดอายุ (' : 'ซ่อนที่หมดอายุ (') + exp.length + ')';
  exp.forEach(o => { const d = h('div', 'wi wi--exp'), hd = h('div', 'wi__h'); hd.append(h('span', null, o.title || 'งานพิมพ์'), h('span', null, 'หมด ' + fDM.format(toDate(o.expiresAt)))); d.appendChild(hd); X.appendChild(d); });
}
$('wExpBtn').addEventListener('click', () => { const X = $('wExp'); X.hidden = !X.hidden; $('wExpBtn').setAttribute('aria-expanded', String(!X.hidden)); renderWarranties(); });

function renderOrders() {
  const L = $('oList'); L.textContent = '';
  $('oCount').textContent = orders.length ? orders.length + ' งาน' : '';
  if (!orders.length) { L.appendChild(h('p', 'empty', 'งานแรกของคุณจะขึ้นที่นี่')); $('oAllBtn').hidden = true; return; }
  const list = showAllOrders ? orders : orders.slice(0, 3);
  list.forEach(o => {
    const row = h('div', 'row'), hd = h('div', 'row__h'), adj = o.kind === 'adjust';
    hd.append(h('span', 'row__t', adj ? 'ปรับแต้มโดยร้าน: ' + (o.title || '') : (o.title || 'งานพิมพ์')), h('span', adj ? 'pill' : 'pill pill--ok', adj ? 'ปรับแต้ม' : 'ส่งมอบแล้ว'));
    const d = toDate(o.deliveredAt);
    const meta = [d ? fDate.format(d) : '', o.points ? (o.points > 0 ? '+' : '') + intf(o.points) + ' แต้ม' : '', o.warrantyCode ? 'ประกัน ' + o.warrantyDays + ' วัน' : ''].filter(Boolean).join(' · ');
    row.append(hd, h('span', 'row__m', meta));
    if (o.shipTrack) { const t = h('a', 'linkbtn', '📦 ติดตามพัสดุ ' + o.shipTrack); t.href = 'track.html?n=' + encodeURIComponent(o.shipTrack) + '&c=' + encodeURIComponent(o.shipCarrier || 'flash'); row.appendChild(t); }
    L.appendChild(row);
  });
  $('oAllBtn').hidden = orders.length <= 3;
  $('oAllBtn').textContent = showAllOrders ? 'แสดงน้อยลง' : 'ดูทั้งหมด (' + orders.length + ')';
}
$('oAllBtn').addEventListener('click', () => { showAllOrders = !showAllOrders; $('oAllBtn').setAttribute('aria-expanded', String(showAllOrders)); renderOrders(); });

/* ---------- booking via Messenger ---------- */
function msgrUrl(u) {
  try { const x = new URL(u), host = x.hostname.replace(/^www\.|^m\.|^web\./, ''); let id = '';
    if (host === 'm.me') return x.origin + x.pathname;
    if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(host)) return '';
    if (/^\/profile\.php/.test(x.pathname)) id = x.searchParams.get('id') || '';
    else { const seg = x.pathname.split('/').filter(Boolean); if (seg[0] === 'people' && seg.length > 2) id = seg[2]; else if (seg[0] && !/^(pages|groups|share|sharer|watch)$/.test(seg[0])) id = seg[0]; }
    return id ? 'https://m.me/' + encodeURIComponent(id) : '';
  } catch (_) { return ''; }
}
function bookMsg() { return 'สวัสดี สนใจจองคิวงาน (สมาชิก ' + rankOf(member).key + ' · ' + memberNo(user.uid) + ')'; }
function renderBook() {
  const b = $('bookBtn'); if (!member) return;
  const fb = (queueShop && queueShop.fb || []).find(f => f.kind === 'page' && f.url) || (queueShop && queueShop.fb || []).find(f => f.url);
  const m = fb ? msgrUrl(fb.url) : '';
  b.href = m ? m + '?text=' + encodeURIComponent(bookMsg()) : (fb ? fb.url : './');
}
$('bookBtn').addEventListener('click', () => {
  if (!member) return; const t = bookMsg();
  const done = () => toast('คัดลอกข้อความจองคิวแล้ว ถ้าแชทยังว่าง วางได้เลย', 4500);
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => {});
});

/* ---------- verify email ---------- */
/* send the verification e-mail: try with a link back to this page, fall back to Firebase's default page */
async function sendVerify(u) {
  let res;
  try { await sendEmailVerification(u, { url: location.origin + location.pathname, handleCodeInApp: false }); res = true; }
  catch (x1) {
    if (x1 && x1.code === 'auth/too-many-requests') res = x1;
    else { try { await sendEmailVerification(u); res = true; } catch (x2) { console.warn('verify email failed', x1 && x1.code, x2 && x2.code); res = x2; } }
  }
  try { sessionStorage.setItem('unitac-verify-last', JSON.stringify({ ok: res === true, code: res === true ? '' : ((res && res.code) || 'unknown'), at: Date.now(), to: u.email })); } catch (_) {}
  renderVerifyStatus();
  return res;
}
function renderVerifyStatus() {
  const el = $('verifyStatus'); if (!el) return;
  let r = null; try { r = JSON.parse(sessionStorage.getItem('unitac-verify-last') || 'null'); } catch (_) {}
  if (!r) { el.hidden = true; return; }
  const t = new Date(r.at), hm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  el.hidden = false; el.className = 'verify-status ' + (r.ok ? 'is-ok' : 'is-bad');
  el.textContent = r.ok ? 'ระบบส่งอีเมลยืนยันไปที่ ' + r.to + ' แล้วเมื่อ ' + hm + ' น.'
    : 'ส่งอีเมลไม่สำเร็จเมื่อ ' + hm + ' น. (รหัส ' + r.code + ') แคปข้อความนี้ส่งให้ร้านได้';
}
let resendAt = 0;
$('resendBtn').addEventListener('click', async () => {
  const wait = Math.ceil((resendAt - Date.now()) / 1000);
  if (wait > 0) return toast('รออีก ' + wait + ' วินาที แล้วค่อยกดส่งใหม่');
  const b = $('resendBtn'); b.disabled = true;
  const r = await sendVerify(user);
  b.disabled = false;
  if (r === true) { resendAt = Date.now() + 60000; showSent(); toast('ส่งลิงก์ยืนยันไปที่ ' + user.email + ' แล้ว', 5000); }
  else toast((r && r.code === 'auth/too-many-requests') ? 'ส่งถี่เกินไป รอสักครู่แล้วลองใหม่' : 'ส่งอีเมลไม่สำเร็จ (' + ((r && r.code) || 'unknown') + ')', 6000);
});
function showSent() { $('verifyHelp').hidden = false; }
$('verifiedBtn').addEventListener('click', async () => {
  try {
    await reload(user);
    if (!auth.currentUser.emailVerified) return toast('ยังไม่พบการยืนยัน กดลิงก์ในอีเมลก่อน แล้วลองใหม่', 4500);
    await auth.currentUser.getIdToken(true);
    await updateDoc(doc(db, 'members', user.uid), { verified: true });
    user = auth.currentUser; toast('ยืนยันอีเมลเรียบร้อย'); route();
  } catch (x) { toast(authMsg(x.code)); }
});

/* ---------- rank up moment ---------- */
function checkRankUp() {
  if (!member || !user) return;
  const r = rankOf(member), key = 'unitac-rank:' + user.uid;
  let prev = null; try { prev = localStorage.getItem(key); localStorage.setItem(key, r.key); } catch (_) {}
  const idx = (k) => RANKS.findIndex(x => x.key === k);
  if (prev && idx(r.key) > idx(prev)) {
    $('upRank').textContent = r.key; $('upDisc').textContent = 'ส่วนลดค่าพิมพ์ของคุณตอนนี้ ' + r.disc + '%';
    const c = $('upCard'); c.textContent = ''; c.appendChild(rankCard(member, user.uid, { qr: false }));
    $('forge').style.setProperty('--fc', r.key === 'Rhodium' ? '#E7E8EA' : r.c);
    attachTilt(c.querySelector('.rcard'), c);
    $('upDlg').showModal();
  }
}

/* ---------- profile ---------- */
function renderProfile() {
  const m = member;
  const pa = $('pAv'); pa.textContent = ''; pa.appendChild(avatarEl(m, 104));
  $('pAvDel').hidden = !m.avatar;
  $('pNick').value = m.nickname || ''; $('pName').value = m.fullName || ''; $('pPhone').value = m.phone || '';
  $('pEmail').textContent = user.email || '';
  const v = $('pVer'); v.className = 'pill ' + (user.emailVerified ? 'pill--ok' : 'pill--warn'); v.textContent = user.emailVerified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน';
  renderAddresses();
}
const mref = () => doc(db, 'members', user.uid);
$('pFile').addEventListener('change', async () => {
  const f = $('pFile').files && $('pFile').files[0]; $('pFile').value = ''; if (!f) return;
  try { const d = await toAvatar(f); await updateDoc(mref(), { avatar: d }); toast('เปลี่ยนรูปโปรไฟล์แล้ว'); }
  catch (x) { toast(x && x.code ? authMsg(x.code) : 'อ่านรูปนี้ไม่ได้ ลองไฟล์ JPG หรือ PNG'); }
});
$('pAvDel').addEventListener('click', async () => { try { await updateDoc(mref(), { avatar: '' }); toast('ลบรูปแล้ว'); } catch (x) { toast(authMsg(x.code)); } });
$('pForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nick = $('pNick').value.trim(), name = $('pName').value.trim(), phone = $('pPhone').value.trim();
  if (!nick) return err($('pErr'), 'ชื่อเล่นเว้นว่างไม่ได้');
  if (phone && !/^[0-9+\-\s()]{8,20}$/.test(phone)) return err($('pErr'), 'รูปแบบเบอร์โทรไม่ถูกต้อง');
  err($('pErr'), ''); const b = $('pSave'); busy(b, true, 'กำลังบันทึก…');
  try { await updateDoc(mref(), { nickname: nick.slice(0, 20), fullName: name.slice(0, 80), phone: phone.slice(0, 20) }); toast('บันทึกแล้ว'); }
  catch (x) { err($('pErr'), authMsg(x.code)); }
  busy(b, false, 'บันทึก');
});
$('pPw').addEventListener('click', async () => {
  try { await sendPasswordResetEmail(auth, user.email); toast('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว', 4500); } catch (x) { toast(authMsg(x.code)); }
});

/* addresses */
let editAddr = null;
function renderAddresses() {
  const L = $('aList'), list = member.addresses || []; L.textContent = '';
  $('aCount').textContent = list.length ? list.length + ' ที่อยู่' : '';
  if (!list.length) L.appendChild(h('p', 'empty', 'ยังไม่มีที่อยู่จัดส่ง'));
  list.forEach(a => {
    const c = h('div', 'ad' + (a.main ? ' is-main' : '')), hd = h('div', 'ad__h'), t = h('b', null, a.label || 'ที่อยู่');
    if (a.main) t.appendChild(h('span', 'pill pill--accent', 'ที่อยู่หลัก'));
    const eb = h('button', 'linkbtn', 'แก้ไข'); eb.type = 'button'; eb.addEventListener('click', () => openAddr(a));
    hd.append(t, eb);
    c.append(hd, h('p', null, [a.name, a.phone].filter(Boolean).join(' · ') + '\n' + (a.addr || '')));
    L.appendChild(c);
  });
  $('aAdd').hidden = list.length >= 10;
}
function openAddr(a) {
  editAddr = a ? a.id : null;
  $('addrTitle').textContent = a ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่';
  $('adLabel').value = a ? a.label || '' : ''; $('adName').value = a ? a.name || '' : (member.fullName || '');
  $('adPhone').value = a ? a.phone || '' : (member.phone || ''); $('adAddr').value = a ? a.addr || '' : '';
  $('adMain').checked = a ? !!a.main : !(member.addresses || []).length;
  $('adDel').hidden = !a; err($('adErr'), '');
  $('addrDlg').showModal();
}
$('aAdd').addEventListener('click', () => openAddr(null));
$('addrForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const a = { id: editAddr || Date.now().toString(36), label: $('adLabel').value.trim().slice(0, 20), name: $('adName').value.trim().slice(0, 80),
    phone: $('adPhone').value.trim().slice(0, 20), addr: $('adAddr').value.trim().slice(0, 300), main: $('adMain').checked };
  if (!a.name || !a.addr) return err($('adErr'), 'กรอกชื่อผู้รับและที่อยู่');
  let list = (member.addresses || []).filter(x => x.id !== a.id);
  if (a.main) list = list.map(x => ({ ...x, main: false }));
  list.push(a);
  if (!list.some(x => x.main)) list[0].main = true;
  try { await updateDoc(mref(), { addresses: list }); $('addrDlg').close(); toast('บันทึกที่อยู่แล้ว'); } catch (x) { err($('adErr'), authMsg(x.code)); }
});
$('adDel').addEventListener('click', async () => {
  let list = (member.addresses || []).filter(x => x.id !== editAddr);
  if (list.length && !list.some(x => x.main)) list[0] = { ...list[0], main: true };
  try { await updateDoc(mref(), { addresses: list }); $('addrDlg').close(); toast('ลบที่อยู่แล้ว'); } catch (x) { toast(authMsg(x.code)); }
});

/* delete request */
$('delReq').addEventListener('click', () => $('delDlg').showModal());
$('delOk').addEventListener('click', async () => {
  try { await updateDoc(mref(), { deleteRequested: true }); $('delDlg').close(); toast('ส่งคำขอลบบัญชีแล้ว', 4000); location.hash = ''; }
  catch (x) { toast(authMsg(x.code)); }
});

document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
