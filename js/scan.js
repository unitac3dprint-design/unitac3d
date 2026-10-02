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
