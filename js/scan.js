/* Camera QR scanner: native BarcodeDetector when available, jsQR otherwise */
let jsqrLoading = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve();
  if (!jsqrLoading) jsqrLoading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = new URL('../vendor/jsQR.js', import.meta.url).href;
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  return jsqrLoading;
}

export function scanQR() {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.setAttribute('aria-label', 'สแกน QR');
    dlg.innerHTML = `<div class="dlg" style="max-width:440px;margin:0 auto">
      <div class="dlg__head"><h2>สแกน QR บัตรสมาชิก</h2><button type="button" class="iconbtn" data-x aria-label="ปิด"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="width:18px;height:18px"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <div class="dlg__body">
        <div style="position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:1">
          <video playsinline muted style="width:100%;height:100%;object-fit:cover;display:block"></video>
          <div style="position:absolute;inset:18%;border:2px solid #FF7A3C;border-radius:14px;box-shadow:0 0 0 999px rgba(0,0,0,.35)"></div>
        </div>
        <p class="hint" data-msg>หันกล้องไปที่ QR ด้านหลังบัตรสมาชิก</p>
      </div></div>`;
    document.body.appendChild(dlg);
    const video = dlg.querySelector('video'), msg = dlg.querySelector('[data-msg]');
    let stream = null, stop = false, detector = null;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    function finish(val) {
      stop = true; if (stream) stream.getTracks().forEach(t => t.stop());
      dlg.close(); dlg.remove(); resolve(val);
    }
    dlg.querySelector('[data-x]').addEventListener('click', () => finish(null));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    dlg.showModal();
    (async () => {
      try {
        if ('BarcodeDetector' in window) {
          try { const f = await window.BarcodeDetector.getSupportedFormats(); if (f.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) {}
        }
        if (!detector) await loadJsQR();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream; await video.play();
        const tick = async () => {
          if (stop) return;
          if (video.readyState >= 2) {
            try {
              if (detector) {
                const r = await detector.detect(video); if (r && r[0] && r[0].rawValue) return finish(r[0].rawValue);
              } else {
                const w = video.videoWidth, hgt = video.videoHeight; const s = Math.min(1, 640 / Math.max(w, hgt));
                canvas.width = Math.round(w * s); canvas.height = Math.round(hgt * s);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
                if (code && code.data) return finish(code.data);
              }
            } catch (_) {}
          }
          requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        msg.textContent = 'เปิดกล้องไม่ได้ อนุญาตให้ใช้กล้องในเบราว์เซอร์ หรือพิมพ์ค้นหาแทน';
        msg.style.color = '#EA7B72';
      }
    })();
  });
}

/* member QR payload: "UNITAC:M:<uid>" */
export function parseMemberQR(text) {
  const m = /^UNITAC:M:([A-Za-z0-9]{10,64})$/.exec((text || '').trim());
  return m ? m[1] : null;
}

/* ---------- parcel label scanner: finds the tracking number in the barcode / QR on a courier label ---------- */
let zxLoading = null;
function loadZX() {
  if (window.ZXing) return Promise.resolve();
  if (!zxLoading) zxLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = new URL('../vendor/zxing.min.js', import.meta.url).href; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return zxLoading;
}
const TRACK_RE = [/TH[0-9A-Z]{10,13}(?![0-9A-Z])/, /[A-Z]{2}\d{9}TH/, /KE[A-Z0-9]{8,16}/];
export function pickTracking(text) {
  const t = String(text || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
  for (const re of TRACK_RE) { const m = t.replace(/ /g, '').match(re) || t.match(re); if (m) return m[0]; }
  return null;
}
export function carrierOf(n) { return /^[A-Z]{2}\d{9}TH$/.test(n) ? 'thp' : /^KE/.test(n) ? 'kex' : 'flash'; }
let zxReader = null;
function zxDecode(canvas) {
  const Z = window.ZXing; if (!Z) return null;
  if (!zxReader) { zxReader = new Z.MultiFormatReader(); const hints = new Map(); hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.QR_CODE]); hints.set(Z.DecodeHintType.TRY_HARDER, true); zxReader.setHints(hints); }
  try { const src = new Z.HTMLCanvasElementLuminanceSource(canvas); const r = zxReader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(src))); return r && r.getText(); } catch (_) { return null; } finally { try { zxReader.reset(); } catch (_) {} }
}
async function detectAll(detector, source, canvas, ctx) {
  const found = [];
  if (detector) { try { (await detector.detect(source)).forEach(r => r.rawValue && found.push(r.rawValue)); } catch (_) {} }
  if (!detector || !found.some(pickTracking)) {
    const w = source.videoWidth || source.naturalWidth || source.width, hgt = source.videoHeight || source.naturalHeight || source.height;
    const s = Math.min(1, 1280 / Math.max(w, hgt)); canvas.width = Math.round(w * s); canvas.height = Math.round(hgt * s);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const v = zxDecode(canvas); if (v) found.push(v);
    if (!pickTracking(v) && window.jsQR) { const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const q = window.jsQR(img.data, img.width, img.height); if (q && q.data) found.push(q.data); }
  }
  for (const f of found) { const n = pickTracking(f); if (n) return n; }
  return null;
}
export function scanTracking() {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.setAttribute('aria-label', 'สแกนเลขพัสดุ');
    dlg.innerHTML = `<div class="dlg" style="max-width:520px;margin:0 auto">
      <div class="dlg__head"><h2>สแกนบาร์โค้ดใบปะหน้า</h2><button type="button" class="iconbtn" data-x aria-label="ปิด"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="width:18px;height:18px"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <div class="dlg__body">
        <div style="position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:4/3">
          <video playsinline muted style="width:100%;height:100%;object-fit:cover;display:block"></video>
          <div style="position:absolute;left:8%;right:8%;top:30%;bottom:30%;border:2px solid #FF7A3C;border-radius:10px;box-shadow:0 0 0 999px rgba(0,0,0,.35)"></div>
          <div data-line style="position:absolute;left:10%;right:10%;top:50%;height:2px;background:#FF7A3C;opacity:.8;box-shadow:0 0 12px #FF7A3C"></div>
        </div>
        <p class="hint" data-msg>หันกล้องไปที่บาร์โค้ดที่มีเลข TH… ใต้เส้น หรือ QR บนใบปะหน้า ถือให้นิ่งและใกล้พอให้เส้นคมชัด</p>
        <label class="btn btn--ghost btn--sm" style="cursor:pointer;justify-self:start">ถ่ายรูปใบปะหน้าแทน<input type="file" accept="image/*" capture="environment" data-photo style="position:absolute;opacity:0;width:1px;height:1px"></label>
      </div></div>`;
    document.body.appendChild(dlg);
    const video = dlg.querySelector('video'), msg = dlg.querySelector('[data-msg]');
    let stream = null, stop = false, detector = null, last = 0;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    function finish(val) { stop = true; if (stream) stream.getTracks().forEach(t => t.stop()); dlg.close(); dlg.remove(); resolve(val); }
    dlg.querySelector('[data-x]').addEventListener('click', () => finish(null));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    dlg.querySelector('[data-photo]').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      msg.textContent = 'กำลังอ่านรูป…';
      try {
        const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
        await loadZX(); await loadJsQR().catch(() => {});
        const n = await detectAll(detector, im, canvas, ctx);
        if (n) return finish(n);
        msg.textContent = 'ยังหาเลขพัสดุในรูปไม่เจอ ถ่ายให้บาร์โค้ดเต็มเฟรมและคมชัดขึ้น แล้วลองใหม่';
      } catch (_) { msg.textContent = 'อ่านรูปนี้ไม่ได้'; }
    });
    dlg.showModal();
    (async () => {
      try {
        if ('BarcodeDetector' in window) {
          try { const f = await window.BarcodeDetector.getSupportedFormats(); const want = ['code_128', 'code_39', 'qr_code'].filter(x => f.includes(x)); if (want.length) detector = new window.BarcodeDetector({ formats: want }); } catch (_) {}
        }
        loadZX().catch(() => {}); loadJsQR().catch(() => {});
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        video.srcObject = stream; await video.play();
        const tick = async (t) => {
          if (stop) return;
          if (video.readyState >= 2 && t - last > 180) { last = t; const n = await detectAll(detector, video, canvas, ctx); if (n) { if (navigator.vibrate) navigator.vibrate(60); return finish(n); } }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch (_) { msg.textContent = 'เปิดกล้องไม่ได้ อนุญาตให้ใช้กล้อง หรือกด "ถ่ายรูปใบปะหน้าแทน"'; }
    })();
  });
}
