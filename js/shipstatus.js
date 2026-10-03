/* parcel status that mirrors Flash Express wording.
   The shop pastes the history copied from the Flash tracking page; later a Flash connection can write the same shape:
   { title: 'ระหว่างการขนส่ง', detail: 'รับพัสดุเข้าสาขา 2BNM_BDC-บ้านหมี่ · บ้านหมี่ · ลพบุรี', at: ISO, s: tone } */
export const SENT_TITLE = 'ตรวจสอบและจัดส่งโดย UNITAC เรียบร้อย';
const OLD_SENT = 'แพ็กและส่งจาก UNITAC';
const pad = (n) => String(n).padStart(2, '0');
export function tone(title) {
  const t = title || '';
  if (/เซ็นรับ|ลงชื่อรับ|นำส่งสำเร็จ|ส่งสำเร็จ|จัดส่งสำเร็จ|delivered|signed/i.test(t)) return 'delivered';
  if (/ตีกลับ|ส่งคืน|ไม่สำเร็จ|ล้มเหลว|มีปัญหา|ติดต่อไม่ได้|ระงับ|failed|return/i.test(t)) return 'issue';
  if (/กำลังนำส่ง|นำจ่าย|ออกนำส่ง|out for delivery|delivering/i.test(t)) return 'out';
  if (t === SENT_TITLE || t === OLD_SENT) return 'sent';
  return 'transit';
}
/* 【บ้านหมี่】 → บ้านหมี่, tidy commas */
export function tidy(s) {
  return String(s || '').replace(/[【\[]/g, ' ').replace(/[】\]]/g, ' ').replace(/\s*[,，]\s*/g, ' · ').replace(/\s{2,}/g, ' ').replace(/(\s·)+/g, ' ·').replace(/^[·\s]+|[·\s]+$/g, '').trim();
}
const NOISE = /^(พบข้อมูลพัสดุ|หลักฐานการเซ็นรับ|เข้าสู่ระบบ|กดปิด|กดเปิด|สายด่วน|ติดตามพัสดุ|ค้นหาพัสดุ|คัดลอก|ดาวน์โหลด|TH[A-Z0-9]{8,}$)/i;
const DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
/* Flash page copied as text: date line, time line, status title, detail line(s) … (newest first) */
export function parsePaste(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.replace(/\u00a0/g, ' ').trim()).filter(Boolean);
  const out = []; let cur = null, pendingDate = null;
  const start = (d) => { if (cur && cur.title) out.push(cur); cur = { at: d, title: '', detail: [] }; };
  for (const ln of lines) {
    let m = ln.match(DATE), d = null;
    if (m) { let y = +m[1]; if (y > 2400) y -= 543; d = new Date(y, +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)); }
    else if ((m = ln.match(DMY))) { let y = +m[3]; if (y < 100) y += 2000; if (y > 2400) y -= 543; d = new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)); }
    if (d) { pendingDate = m[4] == null ? d : null; start(d); continue; }
    if ((m = ln.match(TIME)) && cur && !cur.title) { cur.at = new Date(cur.at.getFullYear(), cur.at.getMonth(), cur.at.getDate(), +m[1], +m[2], +(m[3] || 0)); pendingDate = null; continue; }
    if (!cur || NOISE.test(ln)) continue;
    if (!cur.title) cur.title = ln.slice(0, 60); else cur.detail.push(ln);
  }
  if (cur && cur.title) out.push(cur);
  return out.map(e => ({ s: tone(e.title), title: e.title, detail: tidy(e.detail.join(' ')).slice(0, 220), at: e.at.toISOString() }));
}
export const titleOf = (e) => (e.title === OLD_SENT ? SENT_TITLE : e.title) || ({ sent: SENT_TITLE, picked: 'รับพัสดุแล้ว', hub: 'ระหว่างการขนส่ง', transit: 'ระหว่างการขนส่ง', dest: 'ระหว่างการขนส่ง', out: 'กำลังนำส่ง', delivered: 'เซ็นรับแล้ว', issue: 'การจัดส่งมีปัญหา' }[e.s] || e.text || 'อัปเดตสถานะ');
export const detailOf = (e) => e.detail != null ? e.detail : [e.place, e.text && e.text !== titleOf(e) ? e.text : ''].filter(Boolean).join(' · ');
export const toneOf = (e) => e.title ? tone(e.title) : (e.s === 'delivered' ? 'delivered' : e.s === 'issue' ? 'issue' : e.s === 'out' ? 'out' : e.s === 'sent' ? 'sent' : 'transit');
export function latest(ev) { return (ev || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null; }
export function fmtWhen(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
