/* parcel status: shared by the public tracking page and the admin editor.
   Today the shop fills it in (buttons or pasted text); later a Flash Express connection can write the same document. */
export const SHIP = {
  sent:      { name: 'แพ็กและส่งจาก UNITAC',        tone: 'done' },
  picked:    { name: 'ขนส่งรับพัสดุแล้ว',           tone: 'done' },
  hub:       { name: 'ถึงศูนย์คัดแยก',              tone: 'done' },
  transit:   { name: 'กำลังขนส่งไปสาขาปลายทาง',     tone: 'done' },
  dest:      { name: 'ถึงสาขาปลายทาง',              tone: 'done' },
  out:       { name: 'พนักงานกำลังนำส่งถึงคุณ',      tone: 'now' },
  delivered: { name: 'ส่งถึงแล้ว',                  tone: 'ok' },
  issue:     { name: 'การจัดส่งมีปัญหา ร้านกำลังตรวจสอบ', tone: 'bad' },
  note:      { name: 'อัปเดตจากขนส่ง',              tone: 'done' }
};
export const ORDER = ['sent', 'picked', 'hub', 'transit', 'dest', 'out', 'delivered'];
const KEYS = [
  [/ลงชื่อ|เซ็นรับ|สำเร็จ|ส่งถึง|delivered|signed/i, 'delivered'],
  [/กำลังนำส่ง|นำจ่าย|out for delivery|delivering/i, 'out'],
  [/ปลายทาง|สาขา.*รับเข้า|arrived at.*(branch|dc)|destination/i, 'dest'],
  [/คัดแยก|sorting|hub|ศูนย์/i, 'hub'],
  [/ระหว่างทาง|ขนส่ง|in transit|linked to vehicle|ขึ้นรถ/i, 'transit'],
  [/รับพัสดุ|เข้ารับ|pick ?up|picked|รับเข้าระบบ/i, 'picked'],
  [/ตีกลับ|ไม่สำเร็จ|ล้มเหลว|ติดต่อไม่ได้|failed|return|problem/i, 'issue']
];
const pad = (n) => String(n).padStart(2, '0');
/* "2026-10-03 10:42", "03/10/2026 10:42", "03-10-2569 10:42:11", "10:42" … at the start or anywhere in the line */
function findWhen(line, base) {
  let m = line.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T,]+(\d{1,2})[:.](\d{2})(?::\d{2})?/);
  if (m) { let y = +m[1]; if (y > 2400) y -= 543; return [new Date(y, +m[2] - 1, +m[3], +m[4], +m[5]), m[0]]; }
  m = line.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})[ T,]+(\d{1,2})[:.](\d{2})(?::\d{2})?/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; if (y > 2400) y -= 543; return [new Date(y, +m[2] - 1, +m[1], +m[4], +m[5]), m[0]]; }
  m = line.match(/\b(\d{1,2})[:.](\d{2})(?::\d{2})?\b/);
  if (m) { const d = new Date(base); d.setHours(+m[1], +m[2], 0, 0); return [d, m[0]]; }
  return [null, ''];
}
export function parsePaste(text, base = new Date()) {
  const out = [];
  String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(line => {
    const [when, raw] = findWhen(line, base);
    const rest = line.replace(raw, '').replace(/^[\s·|,–-]+|[\s·|,–-]+$/g, '').replace(/\s{2,}/g, ' ');
    if (!rest) return;
    const k = KEYS.find(([re]) => re.test(rest));
    out.push({ s: k ? k[1] : 'note', text: rest.slice(0, 140), place: '', at: (when || new Date()).toISOString() });
  });
  return out;
}
export function latest(ev) { return (ev || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null; }
export function fmtWhen(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
