/* UNITAC — tiny service worker: always uses the network (so updates show at once), offline page only when there is no connection */
const OFFLINE = '<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ออฟไลน์</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#141311;color:#F2EDE5;font-family:sans-serif;text-align:center"><div><h1 style="font-size:22px">ยังไม่มีอินเทอร์เน็ต</h1><p style="color:#948D80">เชื่อมต่อแล้วกดลองใหม่</p><button onclick="location.reload()" style="margin-top:12px;padding:12px 22px;border-radius:999px;border:0;background:#FF7A3C;color:#1A0E07;font-weight:600">ลองใหม่</button></div></body></html>';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
