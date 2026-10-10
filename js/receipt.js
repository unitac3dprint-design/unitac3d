/* ---------- ใบเสร็จกระดาษม้วน 58 มม. (Deli ES423 · 203 dpi · พิมพ์ได้กว้าง 48 มม. = 384 จุด) ----------
   อ่านข้อมูลจาก "กระดาษ" ใบเสนอราคาที่แสดงอยู่ (เครื่องคิดเลข หรือหน้าดูบิลในหลังร้าน) แล้วจัดใหม่เป็นแบบขาวดำแถวเดียว
   - พิมพ์: ต่อ USB เข้าคอม เลือกเครื่อง Deli ในหน้าต่างพิมพ์
   - บันทึกรูป: ได้รูปกว้าง 384 จุดพอดีหัวพิมพ์ เอาไปพิมพ์ผ่านแอปบลูทูธในมือถือได้ */
import { LOGO_SVG, toast } from './core.js?v=20261004w';

const FONT = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap';
const CSS = `
.rc{--k:#000;width:384px;font-size:21px;box-sizing:border-box;padding:0 2px 1.2em;background:#fff;color:#000;
  font-family:'IBM Plex Sans Thai',Tahoma,sans-serif;line-height:1.35;-webkit-font-smoothing:none}
.rc *{box-sizing:border-box;margin:0;padding:0}
.rc .c{text-align:center}
.rc .logo{display:flex;justify-content:center;padding-top:.3em}
.rc .logo svg{width:46%;height:auto;color:#000}
.rc .logo svg > path{fill:#000}.rc .logo svg g{stroke:#000}
.rc h1{font-size:1.25em;font-weight:700;margin-top:.45em;letter-spacing:.02em}
.rc .en{font-family:'IBM Plex Mono',monospace;font-size:.72em;letter-spacing:.2em;font-weight:600}
.rc .date{font-family:'IBM Plex Mono',monospace;font-size:.85em;margin-top:.15em;font-weight:500}
.rc hr{border:0;border-top:2px dashed #000;margin:.55em 0}
.rc hr.solid{border-top-style:solid}
.rc .job{font-size:1.1em;font-weight:700;overflow-wrap:anywhere}
.rc .mem{font-size:.85em;font-weight:500}
.rc .ln{display:flex;justify-content:space-between;align-items:baseline;gap:.5em;padding:.18em 0}
.rc .ln b{font-weight:600;font-size:.95em}
.rc .ln span.v{font-family:'IBM Plex Mono',monospace;font-weight:600;white-space:nowrap;font-size:.95em}
.rc .sub{font-size:.76em;font-weight:500;margin:-.2em 0 .1em;overflow-wrap:anywhere}
.rc .tot{display:flex;justify-content:space-between;align-items:center;gap:.4em;padding:.15em 0}
.rc .tot b{font-size:1em;font-weight:700}
.rc .tot span{font-family:'IBM Plex Mono',monospace;font-size:1.75em;font-weight:600;white-space:nowrap}
.rc .small{font-size:.78em;font-weight:500}
.rc .qr{margin:.35em auto .2em;display:block}
.rc .qr svg{display:block;width:100%;height:auto;shape-rendering:crispEdges}
.rc .qr svg path{fill:#000}
.rc .pay .qr{width:74%}
.rc .war .qr{width:52%}
.rc .k{font-family:'IBM Plex Mono',monospace;font-size:.78em;font-weight:600;letter-spacing:.14em}
.rc .amt{font-family:'IBM Plex Mono',monospace;font-size:1.35em;font-weight:600}
.rc .cut{display:flex;align-items:center;gap:.4em;margin:.9em 0 .5em;font-size:.72em;font-weight:600}
.rc .cut::before,.rc .cut::after{content:'';flex:1;border-top:2px dashed #000}
.rc .code{font-family:'IBM Plex Mono',monospace;font-size:1.45em;font-weight:600;letter-spacing:.06em}
.rc .grid{display:flex;justify-content:space-between;gap:.3em;margin:.3em 0;font-size:.82em}
.rc .grid div{flex:1;text-align:center;border:2px solid #000;border-radius:6px;padding:.15em .1em}
.rc .grid span{display:block;font-size:.85em;font-weight:500}
.rc .grid b{display:block;font-weight:700;white-space:nowrap}
.rc .det{margin-top:.35em}.rc .ln .k2{font-size:.88em;font-weight:500}.rc .det .ln{padding:.05em 0}.rc .ln.wrap .v{white-space:normal;text-align:right}\n.rc .sec{font-size:.78em;font-weight:700;letter-spacing:.06em;margin-bottom:.1em}\n.rc.war .qr{width:56%}\n.rc .foot{font-family:'IBM Plex Mono',monospace;font-size:.7em;letter-spacing:.2em;font-weight:600;margin-top:1em}
`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const vis = (e) => e && !e.hidden && !e.closest('[hidden]');
const txt = (root, sel) => { const e = root.querySelector(sel); return vis(e) ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };

/* paper element → plain data */
function readPaper(P) {
  const lines = [...P.querySelectorAll('.items > li')].filter(vis).map(li => ({
    t: txt(li, '.item__t b'), s: txt(li, '.item__t > span'), v: (li.querySelector('.item__v')?.textContent || '').replace(/[฿\s]/g, ''), stop: li.classList.contains('item--stop')
  }));
  const pay = P.querySelector('.paper__pay'), war = P.querySelector('.stub');
  const qr = (box) => box ? box.innerHTML : '';
  return {
    date: txt(P, '.paper__title .date'), job: txt(P, '.paper__cust h4'), mem: txt(P, '.paper__mem'), lines,
    note: txt(P, '.paper__note'), total: txt(P, '.total .v span'), pp: txt(P, '.total .pp'),
    pay: vis(pay) ? { qr: qr(pay.querySelector('.pay__qrin')), amt: txt(pay, '.pay__amt span'), who: txt(pay, '.pay__who') } : null,
    war: vis(war) ? {
      qr: qr(war.querySelector('.stub__qr > div')), code: txt(war, '.stub__code'), job: txt(war, '.stub__job'), url: txt(war, '.stub__url'),
      grid: [...war.querySelectorAll('.stub__grid > div')].map(d => [txt(d, ':scope > span'), txt(d, 'b')])
    } : null
  };
}

const nf = (n, d = 2) => (+n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const hmText = (h) => { const t = Math.round((+h || 0) * 60); return (t >= 60 ? Math.floor(t / 60) + ' ชม. ' : '') + (t % 60) + ' นาที'; };
const head = (d, title, en) => '<div class="logo">' + LOGO_SVG + '</div><div class="c"><h1>' + title + '</h1><p class="en">' + en + '</p>' + (d.date ? '<p class="date">' + esc(d.date) + '</p>' : '') + '</div><hr>';
const kv = (k, v, cls) => '<div class="ln' + (cls ? ' ' + cls : '') + '"><span class="k2">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>';

/* sheet 1 — the bill: every line, job details, sub-totals; no payment QR */
function billHtml(d, x) {
  let o = '<div class="rc">' + head(d, 'ใบเสร็จ / บิล', 'RECEIPT');
  o += '<p class="job">' + esc(d.job || 'งานพิมพ์ 3 มิติ') + '</p>' + (d.mem ? '<p class="mem">' + esc(d.mem) + '</p>' : '');
  if (x && (x.material || x.qty || x.weight || x.hours)) {
    o += '<div class="det">';
    if (x.material) o += kv('วัสดุ', x.material, 'wrap');
    if (x.qty) o += kv('จำนวน', x.qty + ' ชิ้น');
    if (x.weight) o += kv('น้ำหนักเส้นรวม', nf(x.weight, x.weight % 1 ? 1 : 0) + ' g');
    if (x.hours) o += kv('เวลาพิมพ์รวม', hmText(x.hours));
    o += '</div>';
  }
  o += '<hr><p class="sec">รายการ</p>';
  d.lines.forEach(l => {
    o += '<div class="ln"><b>' + esc(l.t) + '</b><span class="v">' + esc(l.v) + '</span></div>';
    if (l.s) o += '<p class="sub">' + esc(l.s) + '</p>';
  });
  if (d.note) o += '<p class="small" style="margin-top:.3em">' + esc(d.note) + '</p>';
  o += '<hr>';
  if (x && x.disc > 0 && d.lines.filter(l => !l.stop).length > 1) { o += kv('รวมค่าพิมพ์ก่อนส่วนลด', nf(x.sub)); o += kv('ส่วนลดรวม', '-' + nf(x.disc)); }
  if (x && x.design > 0) o += kv('ค่าเขียนแบบ', nf(x.design));
  if (x && x.ship > 0) o += kv('ค่าจัดส่ง', nf(x.ship));
  o += '<hr class="solid"><div class="tot"><b>ยอดรวมสุทธิ</b><span>' + esc(d.total) + '</span></div>';
  o += '<p class="small" style="text-align:right">บาท' + (d.pp ? ' · ' + esc(d.pp) : '') + '</p>';
  o += '<p class="c foot">UNITAC AUTHORIZED SERVICE</p><p class="c small">ขอบคุณที่ใช้บริการครับ</p>';
  return o + warPart(d) + '</div>';
}
/* warranty card, attached under the bill on the same strip */
function warPart(d) {
  const w = d.war; if (!w) return '';
  let o = '<div class="cut">✂ ใบรับประกัน</div><div class="war c"><p class="k">WARRANTY CARD · ใบรับประกัน</p><p class="code">' + esc(w.code) + '</p>';
  o += '<div class="grid">' + w.grid.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>';
  o += '<div class="qr">' + w.qr + '</div><p class="small" style="font-weight:600">สแกนเช็กสถานะประกัน</p>';
  if (w.url) o += '<p class="small" style="overflow-wrap:anywhere">' + esc(w.url) + '</p>';
  return o + '</div>';
}
/* (unused) sheet 2 — the warranty card on its own */
function warHtml(d) {
  const w = d.war; if (!w) return '';
  let o = '<div class="rc war">' + head(d, 'ใบรับประกัน', 'WARRANTY CARD');
  o += '<div class="c"><p class="code">' + esc(w.code) + '</p>';
  if (w.job) o += '<p class="job" style="font-size:1em">' + esc(w.job) + '</p>';
  if (d.mem) o += '<p class="mem">' + esc(d.mem) + '</p>';
  o += '<div class="grid">' + w.grid.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>';
  o += '<div class="qr">' + w.qr + '</div><p class="small" style="font-weight:600">สแกนเช็กสถานะประกัน</p>';
  if (w.url) o += '<p class="small" style="overflow-wrap:anywhere">' + esc(w.url) + '</p>';
  o += '<p class="foot">UNITAC AUTHORIZED SERVICE</p></div>';
  return o + '</div>';
}

/* ---------- preview dialog: sheet 1 bill, sheet 2 warranty — each printed on its own ---------- */
let dlg = null, sheets = {}, fname = 'receipt';
const ICO_P = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>';
function ensureDlg() {
  if (dlg) return dlg;
  const st = document.createElement('style');
  st.textContent = CSS + `
#rcDlg{max-width:min(470px,calc(100vw - 16px))}
#rcDlg .rcwrap{overflow:auto;background:var(--sunk,#27241F);padding:16px;display:flex;flex-direction:column;align-items:center;gap:22px;min-height:0;flex:1 1 auto;overscroll-behavior:contain}
#rcDlg .rcsheet{display:flex;flex-direction:column;align-items:center;gap:10px}
#rcDlg .rcsheet[hidden]{display:none}
#rcDlg .rclab{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;flex-wrap:wrap}
#rcDlg .rclab b{font-size:14px;color:var(--ink,#eee)}
#rcDlg .rclab .acts{display:flex;gap:6px}
#rcDlg .rcpaper{box-shadow:0 6px 24px rgba(0,0,0,.35);background:#fff;padding:14px 0}
#rcDlg .rcbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 16px;border-top:1px solid var(--rule,#333)}
#rcDlg .rcbar p{flex:1 1 0;min-width:200px;font-size:12.5px;color:var(--muted,#999);line-height:1.5}
@media (max-width:440px){#rcDlg .rcpaper{zoom:.8}}`;
  document.head.appendChild(st);
  const fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = FONT; document.head.appendChild(fl);
  dlg = document.createElement('dialog'); dlg.id = 'rcDlg';
  const sheet = (k, t) => `<section class="rcsheet" data-sheet="${k}"><div class="rclab"><b>${t}</b><div class="acts">
      <button type="button" class="btn btn--ghost btn--sm" data-img="${k}">บันทึกรูป</button>
      <button type="button" class="btn btn--primary btn--sm" data-print="${k}">${ICO_P} พิมพ์</button></div></div>
    <div class="rcpaper" data-paper="${k}"></div></section>`;
  dlg.innerHTML = `<div class="dlg">
  <div class="dlg__head"><h2>พิมพ์ใบเสร็จ 58 มม.</h2><button type="button" class="iconbtn" data-rc-close aria-label="ปิด"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
  <div class="rcwrap">${sheet('bill', 'บิล + ใบรับประกัน')}${sheet('war', '')}</div>
  <div class="rcbar"><p>คอม (USB): กดพิมพ์ แล้วเลือก Deli ES423 · มือถือ (บลูทูธ): กดบันทึกรูป แล้วพิมพ์ผ่านแอปของเครื่อง</p>
    <button type="button" class="btn btn--ghost" data-rc-close>ปิด</button></div></div>`;
  document.body.appendChild(dlg);
  dlg.querySelectorAll('[data-rc-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  dlg.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => printNow(b.dataset.print)));
  dlg.querySelectorAll('[data-img]').forEach(b => b.addEventListener('click', () => saveImg(b.dataset.img, b)));
  return dlg;
}

/* extra = { material, qty, weight (total g), hours (total), sub, disc, design, ship } */
export function openReceipt(paper, name, extra) {
  if (!paper) return;
  const d = readPaper(paper);
  if (!d.total || d.total === '0.00') { note('ยังไม่มียอดให้พิมพ์'); return; }
  sheets = { bill: billHtml(d, extra || null), war: '' };
  ensureDlg(); fname = name || d.job || 'receipt';
  ['bill', 'war'].forEach(k => { dlg.querySelector('[data-paper="' + k + '"]').innerHTML = sheets[k]; dlg.querySelector('[data-sheet="' + k + '"]').hidden = !sheets[k]; });
  dlg.showModal(); dlg.querySelector('.rcwrap').scrollTop = 0;
}
function note(m) { try { toast(m); } catch (_) {} }

function printNow(k) {
  const html = sheets[k]; if (!html) return;
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const w = f.contentWindow, doc = w.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc((k === 'war' ? 'Warranty_' : 'Bill_') + fname)}</title><link rel="stylesheet" href="${FONT}"><style>${CSS}
html,body{margin:0;padding:0;background:#fff}
.rc{width:48mm;font-size:2.65mm;padding:0 0 6mm;margin:0 5mm}
.rc hr{border-top-width:.3mm}
.rc .grid div{border-width:.3mm;border-radius:1mm}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>${html}</body></html>`);
  doc.close();
  const go = () => {
    const hmm = Math.ceil(doc.querySelector('.rc').getBoundingClientRect().height * 25.4 / 96) + 4;
    const pg = doc.createElement('style'); pg.textContent = `@page{size:58mm ${hmm}mm;margin:0}`; doc.head.appendChild(pg);
    setTimeout(() => { w.focus(); w.print(); setTimeout(() => f.remove(), 1500); }, 60);
  };
  const ready = () => (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 150));
  if (doc.readyState === 'complete') ready(); else f.onload = ready;
}

function loadH2C() {
  if (window.html2canvas) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function saveImg(k, b) {
  const cur = sheets[k]; if (!cur) return; b.disabled = true;
  /* render off-screen at exactly 384 px wide = one dot per pixel on a 58 mm / 203 dpi head */
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff';
  box.innerHTML = cur; document.body.appendChild(box);
  try {
    await loadH2C(); if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const c = await window.html2canvas(box.firstElementChild, { scale: 1, backgroundColor: '#ffffff', logging: false });
    /* hard black/white so the thermal head doesn't dither grey edges */
    const g = c.getContext('2d'), im = g.getImageData(0, 0, c.width, c.height), px = im.data;
    for (let i = 0; i < px.length; i += 4) { const v = (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) < 150 ? 0 : 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
    g.putImageData(im, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const name = (k === 'war' ? 'Warranty58_' : 'Bill58_') + String(fname).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 50) + '.png';
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) { try { await navigator.share({ files: [file], title: name }); } catch (_) {} }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  } catch (_) { note('บันทึกรูปไม่สำเร็จ ต้องต่ออินเทอร์เน็ตเพื่อโหลดตัวช่วย'); }
  box.remove(); b.disabled = false;
}
