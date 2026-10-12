/* PromptPay (EMVCo / Thai QR): add the amount to the shop's receive-money QR — same logic as the calculator */
function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); }
function tlv(s) { const o = []; let i = 0; while (i + 4 <= s.length) { const t = s.substr(i, 2), l = +s.substr(i + 2, 2); if (isNaN(l)) break; o.push([t, s.substr(i + 4, l)]); i += 4 + l; } return o; }
export function promptPay(base, amt) {
  const f = tlv(base).filter(([t]) => t !== '54' && t !== '63').map(([t, v]) => t === '01' ? ['01', amt > 0 ? '12' : '11'] : [t, v]);
  if (amt > 0) f.push(['54', amt.toFixed(2)]); f.sort((a, b) => +a[0] - +b[0]);
  const s = f.map(([t, v]) => t + String(v.length).padStart(2, '0') + v).join('') + '6304'; return s + crc16(s);
}
export const validBase = (s) => /^000201/.test(s || '') && s.length >= 30 && crc16(s.slice(0, -4)) === s.slice(-4).toUpperCase() && tlv(s).some(([t]) => t === '29' || t === '30');
export const isPaid = (o) => !!(o && o.pay && o.pay.s === 'paid');
