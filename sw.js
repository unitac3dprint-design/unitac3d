/* UNITAC — service worker
   1) always uses the network (so updates show at once); offline page only when there is no connection
   2) receives push notifications from Firebase Cloud Messaging and opens the right page when tapped */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
try {
  firebase.initializeApp({
    apiKey: 'AIzaSyDBK59GWOsP_vaneuypqPjHIK-44Lqj6-4', authDomain: 'unitac3d.firebaseapp.com', projectId: 'unitac3d',
    storageBucket: 'unitac3d.firebasestorage.app', messagingSenderId: '347511261968', appId: '1:347511261968:web:bcd8b5a0bb4f278c4ef395'
  });
  firebase.messaging();   /* shows notifications sent with a "notification" payload while the app is closed */
} catch (_) {}

const OFFLINE = '<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ออฟไลน์</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#141311;color:#F2EDE5;font-family:sans-serif;text-align:center"><div><h1 style="font-size:22px">ยังไม่มีอินเทอร์เน็ต</h1><p style="color:#948D80">เชื่อมต่อแล้วกดลองใหม่</p><button onclick="location.reload()" style="margin-top:12px;padding:12px 22px;border-radius:999px;border:0;background:#FF7A3C;color:#1A0E07;font-weight:600">ลองใหม่</button></div></body></html>';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
/* tap on a notification: focus an open UNITAC window or open the link */
self.addEventListener('notificationclick', (e) => {
  const d = (e.notification && e.notification.data) || {};
  const fcm = d.FCM_MSG || {};
  const link = (fcm.fcmOptions && fcm.fcmOptions.link) || (fcm.data && fcm.data.link) || d.link || './';
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.split('#')[0] === link.split('#')[0] && 'focus' in c) { c.navigate(link).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(link);
  }));
});
