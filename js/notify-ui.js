/* ---------- หน้าสมาชิก: เปิด/ปิดแจ้งเตือน + เลือกเรื่องที่อยากรับ ---------- */
import { db, doc, updateDoc, authMsg } from './fb.js?v=20261004w';
import { $, h, toast } from './core.js?v=20261004w';
import { pushState, enablePush, disablePush, syncPush, IOS } from './push.js?v=20261010h';

const TOPICS = [
  ['queue', 'งานและคิว', 'ยืนยันคิว เริ่มพิมพ์ พิมพ์เสร็จ เลื่อนวัน'],
  ['ship', 'การจัดส่ง', 'ส่งของแล้ว พร้อมเลขพัสดุ'],
  ['points', 'แต้มและแรงค์', 'ได้แต้มจากงาน ขึ้นแรงค์ใหม่'],
  ['warranty', 'ประกัน', 'เตือนก่อนประกันหมด 7 วัน'],
  ['news', 'ข่าวสารจากร้าน', 'วันหยุด โปรโมชัน (นาน ๆ ครั้ง)']
];
let ctx = null;
export function mountNotify(c) {
  ctx = c;   /* { user(), member() } */
  /* signing out on a shared phone: stop this account's notifications on this device first */
  addEventListener('unitac-push', (e) => { const d = e.detail || {}; if (d.title) toast(d.title + (d.body ? ' · ' + d.body : ''), 5000); });
}
export function syncNotify() { const u = ctx && ctx.user(); if (u) syncPush(u.uid, 'member'); }

const T = (x) => (window.UI18N && window.UI18N.t) ? window.UI18N.t(x) : x;
async function turnOn() {
  const u = ctx.user(); if (!u) return;
  try { await enablePush(u.uid, 'member'); toast('เปิดแจ้งเตือนในเครื่องนี้แล้ว'); }
  catch (x) {
    const m = String(x && x.message || x);
    toast(m === 'denied' ? 'เบราว์เซอร์บล็อกการแจ้งเตือนไว้ เปิดได้ที่การตั้งค่าของเบราว์เซอร์' : m === 'dismissed' ? 'ยังไม่ได้อนุญาตการแจ้งเตือน' : m === 'unsupported' ? 'เครื่องหรือเบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน' : 'เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง', 5000);
  }
  renderNotify(); renderNotifyBar();
}

/* ---------- card on the profile page ---------- */
export async function renderNotify() {
  const box = $('nfBox'); if (!box || !ctx || !ctx.member()) return;
  const st = await pushState(), m = ctx.member(), pref = m.notify || {};
  box.textContent = '';
  const top = h('div', 'nf__top'), txt = h('div');
  const label = { on: 'เปิดอยู่ในเครื่องนี้', off: 'ยังไม่ได้เปิดในเครื่องนี้', denied: 'เบราว์เซอร์บล็อกการแจ้งเตือนไว้', 'ios-install': 'iPhone ต้องติดตั้งแอปก่อน', unsupported: 'เครื่องหรือเบราว์เซอร์นี้ยังไม่รองรับ' }[st];
  txt.append(h('b', null, label), h('p', 'hint', {
    on: 'ร้านอัปเดตงานของคุณเมื่อไร แจ้งเตือนจะเด้งทันที แม้ปิดแอปอยู่',
    off: 'เปิดแล้วจะได้รับแจ้งเตือนเมื่อร้านยืนยันคิว เริ่มพิมพ์ งานเสร็จ และส่งของ',
    denied: 'กดรูปกุญแจหน้าลิงก์เว็บ → การแจ้งเตือน → อนุญาต แล้วกลับมาหน้านี้',
    'ios-install': 'เปิดเว็บใน Safari → ปุ่มแชร์ → เพิ่มไปยังหน้าจอโฮม แล้วเปิดจากไอคอน UNITAC (iOS 16.4 ขึ้นไป)',
    unsupported: 'ลองเปิดด้วย Chrome หรือ Safari เวอร์ชันล่าสุด และติดตั้งเป็นแอป'
  }[st]));
  const dot = h('i', 'nf__dot nf__dot--' + (st === 'on' ? 'on' : st === 'off' ? 'off' : 'bad'));
  top.append(dot, txt); box.appendChild(top);
  const acts = h('div', 'nf__acts');
  if (st === 'off') { const b = h('button', 'btn btn--primary btn--sm', 'เปิดแจ้งเตือน'); b.type = 'button'; b.addEventListener('click', turnOn); acts.appendChild(b); }
  if (st === 'on') { const b = h('button', 'btn btn--ghost btn--sm', 'ปิดในเครื่องนี้'); b.type = 'button'; b.addEventListener('click', async () => { await disablePush(); toast('ปิดแจ้งเตือนในเครื่องนี้แล้ว'); renderNotify(); renderNotifyBar(); }); acts.appendChild(b); }
  if (st === 'ios-install' && window.UInstall) { const b = h('button', 'btn btn--primary btn--sm', 'วิธีติดตั้งแอป'); b.type = 'button'; b.addEventListener('click', () => window.UInstall.open()); acts.appendChild(b); }
  if (acts.children.length) box.appendChild(acts);
  const L = h('div', 'nf__topics');
  L.appendChild(h('p', 'lab', 'เรื่องที่อยากรับแจ้งเตือน (ใช้กับทุกเครื่องของคุณ)'));
  TOPICS.forEach(([k, name, sub]) => {
    const row = h('label', 'nf__t'), cb = h('input'); cb.type = 'checkbox'; cb.checked = pref[k] !== false;
    const t = h('span'); t.append(h('b', null, name), h('small', null, sub));
    row.append(t, cb);
    cb.addEventListener('change', async () => {
      const u = ctx.user(), next = { ...(ctx.member().notify || {}), [k]: cb.checked };
      try { await updateDoc(doc(db, 'members', u.uid), { notify: next }); ctx.member().notify = next; }
      catch (x) { cb.checked = !cb.checked; toast(authMsg(x.code)); }
    });
    L.appendChild(row);
  });
  box.appendChild(L);
}

/* ---------- small prompt on the member home (until turned on or dismissed) ---------- */
export async function renderNotifyBar() {
  const bar = $('nfBar'); if (!bar || !ctx || !ctx.member()) return;
  const st = await pushState();
  let hide = false; try { hide = Date.now() - (+localStorage.getItem('unitac-nf-later') || 0) < 14 * 864e5; } catch (_) {}
  if (hide || !['off', 'ios-install'].includes(st)) { bar.hidden = true; return; }
  bar.hidden = false; bar.textContent = '';
  const t = h('div'); t.append(h('b', null, st === 'ios-install' ? 'ติดตั้งแอปเพื่อรับแจ้งเตือน' : 'รับแจ้งเตือนสถานะงาน'), h('small', null, 'รู้ทันทีเมื่อร้านยืนยันคิว งานเสร็จ หรือส่งของ'));
  const later = h('button', 'linkbtn linkbtn--muted', 'ไว้ทีหลัง'); later.type = 'button';
  later.addEventListener('click', () => { try { localStorage.setItem('unitac-nf-later', String(Date.now())); } catch (_) {} bar.hidden = true; });
  const go = h('button', 'btn btn--primary btn--sm', st === 'ios-install' ? 'วิธีติดตั้ง' : 'เปิดแจ้งเตือน'); go.type = 'button';
  go.addEventListener('click', () => { if (st === 'ios-install') { if (window.UInstall) window.UInstall.open(); } else turnOn(); });
  bar.append(h('span', 'nf__bell', '🔔'), t, later, go);
}
export { turnOn as turnOnNotify };
