/* ---------- ใบเสร็จกระดาษม้วน 58 มม. (Deli ES423 · 203 dpi · พิมพ์ได้กว้าง 48 มม. = 384 จุด) ----------
   อ่านข้อมูลจาก "กระดาษ" ใบเสนอราคาที่แสดงอยู่ (เครื่องคิดเลข หรือหน้าดูบิลในหลังร้าน) แล้วจัดใหม่เป็นแบบขาวดำแถวเดียว
   - พิมพ์: แปลงบิลเป็นรูปขาว-ดำล้วน 384 จุด (1 จุดต่อ 1 พิกเซล) แล้วสั่งพิมพ์รูปนั้น ตัวหนังสือจึงดำสนิท ไม่เป็นเม็ดเทา
     ต่อ USB เข้าคอม เลือกเครื่อง Deli ในหน้าต่างพิมพ์ · ปรับขยับขอบ/ความกว้าง/ความเข้มได้ในหน้าต่าง (จำไว้ในเครื่องนี้)
   - บันทึกรูป: ได้รูปกว้าง 384 จุดพอดีหัวพิมพ์ เอาไปพิมพ์ผ่านแอปบลูทูธในมือถือได้ */
import { LOGO_SVG, toast } from './core.js?v=20261004w';

const FONT = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap';
const CSS = `
.rc{--k:#000;width:384px;font-size:21px;box-sizing:border-box;padding:0 2px 1.2em;background:#fff;color:#000;
  font-family:'IBM Plex Sans Thai',Tahoma,sans-serif;font-weight:600;line-height:1.38;-webkit-font-smoothing:none}
.rc *{box-sizing:border-box;margin:0;padding:0;color:#000!important;opacity:1!important}
.rc .c{text-align:center}
.rc .logo{display:flex;justify-content:center;padding-top:.3em}
.rc .logo svg{width:54%;height:auto;color:#000}
.rc .logo svg > path{fill:#000}.rc .logo svg g{stroke:#000;stroke-width:2.4}
.rc h1{font-size:1.25em;font-weight:700;margin-top:.45em}
.rc .en{font-family:'IBM Plex Mono',monospace;font-size:.8em;letter-spacing:.16em;font-weight:700}
.rc .date{font-family:'IBM Plex Mono',monospace;font-size:.9em;margin-top:.15em;font-weight:700}
.rc hr{border:0;border-top:3px dashed #000;margin:.55em 0}
.rc hr.solid{border-top-style:solid}
.rc .job{font-size:1.1em;font-weight:700;overflow-wrap:anywhere}
.rc .mem{font-size:.9em;font-weight:600}
.rc .ln{display:flex;justify-content:space-between;align-items:baseline;gap:.5em;padding:.18em 0}
.rc .ln b{font-weight:700;font-size:.95em;min-width:0;overflow-wrap:anywhere}
.rc .ln span.v{font-family:'IBM Plex Mono',monospace;font-weight:700;white-space:nowrap;font-size:.95em}
.rc .sub{font-size:.85em;font-weight:600;margin:-.15em 0 .15em;overflow-wrap:anywhere}
.rc .tot{display:flex;justify-content:space-between;align-items:center;gap:.4em;padding:.15em 0}
.rc .tot b{font-size:1em;font-weight:700;white-space:nowrap}
.rc .tot span{font-family:'IBM Plex Mono',monospace;font-size:1.6em;font-weight:700;white-space:nowrap}
.rc .small{font-size:.85em;font-weight:600}
.rc .qr{margin:.35em auto .2em;display:block}
.rc .qr svg{display:block;width:100%;height:auto;shape-rendering:crispEdges}
.rc .qr svg path{fill:#000}
.rc .pay .qr{width:74%}
.rc .war .qr{width:58%}
.rc .k{font-family:'IBM Plex Mono',monospace;font-size:.8em;font-weight:700;letter-spacing:.08em}
.rc .k .th{font-family:'IBM Plex Sans Thai',Tahoma,sans-serif;letter-spacing:0}
.rc .amt{font-family:'IBM Plex Mono',monospace;font-size:1.35em;font-weight:700}
.rc .cut{display:flex;align-items:center;gap:.4em;margin:.9em 0 .5em;font-size:.8em;font-weight:700}
.rc .cut::before,.rc .cut::after{content:'';flex:1;border-top:3px dashed #000}
.rc .code{font-family:'IBM Plex Mono',monospace;font-size:1.4em;font-weight:700;letter-spacing:.04em;overflow-wrap:anywhere}
.rc .grid{display:flex;justify-content:space-between;gap:.3em;margin:.3em 0;font-size:.85em}
.rc .grid div{flex:1;text-align:center;border:3px solid #000;border-radius:6px;padding:.15em .1em}
.rc .grid span{display:block;font-size:.9em;font-weight:600}
.rc .grid b{display:block;font-weight:700;white-space:nowrap}
.rc .det{margin-top:.35em}.rc .ln .k2{font-size:.92em;font-weight:600;white-space:nowrap}.rc .det .ln{padding:.05em 0}.rc .ln.wrap .v{white-space:normal;text-align:right}
.rc .sec{font-size:.85em;font-weight:700}
.rc.war .qr{width:58%}
.rc .foot{font-family:'IBM Plex Mono',monospace;font-size:.78em;letter-spacing:.08em;font-weight:700;margin-top:1em}
`;const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
  let o = '<div class="cut">✂ ใบรับประกัน</div><div class="war c"><p class="k">WARRANTY CARD · <span class="th">ใบรับประกัน</span></p><p class="code">' + esc(w.code) + '</p>';
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
#rcDlg .rcset{display:flex;gap:10px;flex-wrap:wrap;padding:10px 16px 0;border-top:1px solid var(--rule,#333)}
#rcDlg .rcset label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#999);flex:1 1 120px}
#rcDlg .rcset select{font:inherit;font-size:14px;padding:6px 8px;border-radius:8px;border:1px solid var(--rule,#444);background:var(--sunk,#1d1b18);color:var(--ink,#eee)}
@media (max-width:440px){#rcDlg .rcpaper{zoom:.8}}`;
  document.head.appendChild(st);
  const fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = FONT; document.head.appendChild(fl);
  dlg = document.createElement('dialog'); dlg.id = 'rcDlg';
  const sheet = (k, t) => `<section class="rcsheet" data-sheet="${k}"><div class="rclab"><b>${t}</b><div class="acts">
      <button type="button" class="btn btn--ghost btn--sm" data-img="${k}">บันทึกรูป</button>
      <button type="button" class="btn btn--ghost btn--sm" data-direct="${k}" hidden title="ส่งเข้าเครื่องพิมพ์โดยตรง ไม่ผ่านไดรเวอร์ Windows">พิมพ์ตรง</button>
      <button type="button" class="btn btn--primary btn--sm" data-print="${k}">${ICO_P} พิมพ์</button></div></div>
    <div class="rcpaper" data-paper="${k}"></div></section>`;
  dlg.innerHTML = `<div class="dlg">
  <div class="dlg__head"><h2>พิมพ์ใบเสร็จ 58 มม.</h2><button type="button" class="iconbtn" data-rc-close aria-label="ปิด"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
  <div class="rcwrap">${sheet('bill', 'บิล + ใบรับประกัน')}${sheet('war', '')}</div>
  <div class="rcset">
    <label>ขยับจากขอบซ้าย<select data-set="off">${[0,1,2,3,4,5,6,7,8].map(v => `<option value="${v}">${v} มม.</option>`).join('')}</select></label>
    <label>ความกว้างพิมพ์<select data-set="w">${[48,47,46,45,44].map(v => `<option value="${v}">${v} มม.</option>`).join('')}</select></label>
    <label>ความเข้ม<select data-set="dark"><option value="150">ปกติ</option><option value="185">เข้ม</option><option value="215">เข้มมาก</option></select></label>
  </div>
  <div class="rcbar"><p>พิมพ์ตรง: ส่งเข้าเครื่องผ่านพอร์ต COM (บลูทูธ/USB-Serial) ไม่ผ่านไดรเวอร์ ครั้งแรกให้เลือกพอร์ตของ Deli · พิมพ์ปกติ: เลือก Deli ES423 · ขอบ (Margins) = ไม่มี · สเกล = ค่าเริ่มต้น 100% · ถ้าขวาโดนตัดให้ลดความกว้าง ถ้าเยื้องให้ปรับขยับขอบ · มือถือ (บลูทูธ): กดบันทึกรูป แล้วพิมพ์ผ่านแอปของเครื่อง</p>
    <button type="button" class="btn btn--ghost" data-rc-close>ปิด</button></div></div>`;
  document.body.appendChild(dlg);
  dlg.querySelectorAll('[data-rc-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  dlg.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => printNow(b.dataset.print, b)));
  const cur = getSet();
  dlg.querySelectorAll('[data-set]').forEach(sel => {
    sel.value = String(cur[sel.dataset.set]);
    sel.addEventListener('change', () => { const st = getSet(); st[sel.dataset.set] = +sel.value; saveSet(st); });
  });
  dlg.querySelectorAll('[data-direct]').forEach(b => { b.hidden = !('serial' in navigator); b.addEventListener('click', () => printDirect(b.dataset.direct, b)); });
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

/* per-computer print settings: offset from left edge, printable width (mm), darkness threshold */
const SET_KEY = 'unitac.rc58';
const DEF = { off: 0, w: 48, dark: 185 };
function getSet() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (_) { return Object.assign({}, DEF); } }
function saveSet(st) { try { localStorage.setItem(SET_KEY, JSON.stringify(st)); } catch (_) {} }

function loadH2C() {
  if (window.html2canvas) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function fontsReady() {
  if (!document.fonts) return;
  try { await Promise.all(['600 21px "IBM Plex Sans Thai"', '700 21px "IBM Plex Sans Thai"', '700 21px "IBM Plex Mono"'].map(f => document.fonts.load(f, 'กขA1'))); } catch (_) {}
  try { await document.fonts.ready; } catch (_) {}
}
/* render a sheet to a canvas exactly 384 px wide (= one dot per pixel on the 203 dpi head), pure black / white:
   drawn at 2x, scaled down smoothly, then cut at the darkness threshold so thin Thai strokes come out solid black */
async function raster(html) {
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;width:384px';
  box.innerHTML = html; document.body.appendChild(box);
  try {
    await loadH2C(); await fontsReady();
    const src = await window.html2canvas(box.firstElementChild, { scale: 2, backgroundColor: '#ffffff', logging: false });
    const W = 384, H = Math.max(1, Math.round(src.height * W / src.width));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, W, H);
    const cut = getSet().dark, im = g.getImageData(0, 0, W, H), px = im.data;
    for (let i = 0; i < px.length; i += 4) { const v = (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) < cut ? 0 : 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
    g.putImageData(im, 0, 0);
    return c;
  } finally { box.remove(); }
}

function printDoc(title, body, extraCss, heightMm) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const w = f.contentWindow, doc = w.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
html,body{margin:0;padding:0;background:#fff}
${extraCss || ''}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>${body}</body></html>`);
  doc.close();
  return new Promise((res) => {
    const go = () => {
      const hmm = heightMm || (Math.ceil(doc.body.firstElementChild.getBoundingClientRect().height * 25.4 / 96) + 4);
      const pg = doc.createElement('style'); pg.textContent = `@page{size:58mm ${hmm}mm;margin:0}`; doc.head.appendChild(pg);
      setTimeout(() => { w.focus(); w.print(); setTimeout(() => f.remove(), 1500); res(); }, 80);
    };
    const imgs = [...doc.images];
    Promise.all(imgs.map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })))
      .then(() => (doc.fonts && doc.fonts.ready ? doc.fonts.ready : 0)).then(() => setTimeout(go, 120));
  });
}

async function printNow(k, b) {
  const html = sheets[k]; if (!html) return;
  if (b) b.disabled = true;
  const st = getSet(), title = (k === 'war' ? 'Warranty_' : 'Bill_') + fname;
  try {
    const c = await raster(html);
    const hmm = Math.ceil(c.height * st.w / c.width) + 6;
    await printDoc(title, `<img src="${c.toDataURL('image/png')}" alt="">`,
      `img{display:block;width:${st.w}mm;height:auto;margin:0 0 0 ${st.off}mm;image-rendering:pixelated;image-rendering:crisp-edges}`, hmm);
  } catch (_) {
    /* no internet for the image helper: fall back to printing the text directly */
    await printDoc(title, html, `@import url('${FONT}');${CSS}
.rc{width:${st.w}mm;font-size:${(2.65 * st.w / 48).toFixed(2)}mm;padding:0 0 6mm;margin:0 0 0 ${st.off}mm}
.rc hr{border-top-width:.4mm}.rc .grid div{border-width:.4mm;border-radius:1mm}`);
  }
  if (b) b.disabled = false;
}

async function saveImg(k, b) {
  const cur = sheets[k]; if (!cur) return; b.disabled = true;
  try {
    const c = await raster(cur);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const name = (k === 'war' ? 'Warranty58_' : 'Bill58_') + String(fname).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 50) + '.png';
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) { try { await navigator.share({ files: [file], title: name }); } catch (_) {} }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  } catch (_) { note('บันทึกรูปไม่สำเร็จ ต้องต่ออินเทอร์เน็ตเพื่อโหลดตัวช่วย'); }
  b.disabled = false;
}

/* ---------- direct print: ESC/POS raster over Web Serial (Chrome / Edge on PC) ----------
   skips the Windows driver; sends the 384-dot black/white image in 24-row bands with a short pause after each,
   so the printer's buffer never overflows (overflow = garbage characters + sliced / repeated lines) */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function getPort(pick) {
  const ports = await navigator.serial.getPorts();
  if (ports.length && !pick) return ports[0];
  return navigator.serial.requestPort();
}
function escpos(c) {
  const W = c.width, H = c.height, bpr = W >> 3, px = c.getContext('2d').getImageData(0, 0, W, H).data, BAND = 24, out = [];
  out.push(Uint8Array.of(0x1B, 0x40));                       /* ESC @  reset */
  for (let y0 = 0; y0 < H; y0 += BAND) {
    const h = Math.min(BAND, H - y0), b = new Uint8Array(8 + bpr * h);
    b.set([0x1D, 0x76, 0x30, 0x00, bpr & 255, bpr >> 8, h & 255, h >> 8]);   /* GS v 0  raster band */
    for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
      if (px[((y0 + y) * W + x) * 4] < 128) b[8 + y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
    }
    out.push(b);
  }
  out.push(Uint8Array.of(0x1B, 0x64, 0x05));                 /* ESC d 5  feed to tear bar */
  return out;
}
async function printDirect(k, b) {
  const html = sheets[k]; if (!html) return;
  b.disabled = true; const t0 = b.textContent;
  let port = null;
  try {
    port = await getPort(false);
    try { await port.open({ baudRate: 115200, flowControl: 'none' }); }
    catch (e) { if (!/already open/i.test(e.message || '')) { port = await getPort(true); await port.open({ baudRate: 115200 }); } }
    b.textContent = 'กำลังเตรียม…';
    const c = await raster(html), parts = escpos(c), w = port.writable.getWriter();
    try {
      for (let i = 0; i < parts.length; i++) {
        await w.write(parts[i]); await sleep(i ? 45 : 60);
        if (i % 8 === 0) b.textContent = 'กำลังพิมพ์ ' + Math.round(i * 100 / parts.length) + '%';
      }
      await sleep(400);
    } finally { w.releaseLock(); }
    note('ส่งเข้าเครื่องพิมพ์แล้ว');
  } catch (e) {
    if (!(e && e.name === 'NotFoundError')) note('พิมพ์ตรงไม่สำเร็จ: ' + ((e && e.message) || e));
  } finally {
    try { if (port) await port.close(); } catch (_) {}
    b.textContent = t0; b.disabled = false;
  }
}
