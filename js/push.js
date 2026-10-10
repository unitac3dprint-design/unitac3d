/* UNITAC — push notifications in the browser / installed app (Firebase Cloud Messaging)
   enablePush(uid, role)  asks permission, gets this device's token, saves pushTokens/{token}
   syncPush(uid, role)    on every visit: refresh the saved token if permission is already granted
   disablePush()          forget this device */
import { getApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js';
import { db, doc, setDoc, deleteDoc, serverTimestamp } from './fb.js?v=20261004w';

export const VAPID = 'BKg8rcWRlsEfr9HgXJFx2BwQsVenrPophq-mUVeGMOeOCqTddby5FwH8L365OOmmaQe3UnA0vuVdod6bLSBFU1Q';
const KEY = 'unitac-push-token';
const ua = navigator.userAgent || '';
export const IOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
export const STANDALONE = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const lang = () => { try { return localStorage.getItem('unitac-lang') || 'th'; } catch (_) { return 'th'; } };
let supported = null, msg = null;

export async function pushSupported() {
  if (supported !== null) return supported;
  try { supported = ('serviceWorker' in navigator) && ('Notification' in window) && await isSupported(); } catch (_) { supported = false; }
  return supported;
}
/* 'on' | 'off' | 'denied' | 'ios-install' (iPhone in Safari tab: install first) | 'unsupported' */
export async function pushState() {
  if (IOS && !STANDALONE) return 'ios-install';
  if (!(await pushSupported())) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  let t = ''; try { t = localStorage.getItem(KEY) || ''; } catch (_) {}
  return Notification.permission === 'granted' && t ? 'on' : 'off';
}
async function reg() { return navigator.serviceWorker.register('sw.js'); }
async function token() {
  msg = msg || getMessaging(getApp());
  return getToken(msg, { vapidKey: VAPID, serviceWorkerRegistration: await reg() });
}
async function save(t, uid, role) {
  let old = ''; try { old = localStorage.getItem(KEY) || ''; } catch (_) {}
  if (old && old !== t) { try { await deleteDoc(doc(db, 'pushTokens', old)); } catch (_) {} }
  await setDoc(doc(db, 'pushTokens', t), { uid, role, lang: ['th', 'en', 'zh'].includes(lang()) ? lang() : 'th', ua: ua.slice(0, 160), standalone: STANDALONE, updatedAt: serverTimestamp() });
  try { localStorage.setItem(KEY, t); localStorage.setItem(KEY + ':uid', uid); } catch (_) {}
}
export async function enablePush(uid, role = 'member') {
  if (!(await pushSupported())) throw new Error('unsupported');
  const p = await Notification.requestPermission();
  if (p !== 'granted') throw new Error(p === 'denied' ? 'denied' : 'dismissed');
  const t = await token(); if (!t) throw new Error('no-token');
  await save(t, uid, role); listen(); return t;
}
export async function syncPush(uid, role = 'member') {
  try {
    if (!uid || !(await pushSupported()) || Notification.permission !== 'granted') return;
    let saved = '', savedUid = ''; try { saved = localStorage.getItem(KEY) || ''; savedUid = localStorage.getItem(KEY + ':uid') || ''; } catch (_) {}
    if (!saved) return;                       /* never turned on in this browser */
    const t = await token(); if (!t) return;
    if (t !== saved || savedUid !== uid || Date.now() - (+localStorage.getItem(KEY + ':at') || 0) > 7 * 864e5) { await save(t, uid, role); try { localStorage.setItem(KEY + ':at', String(Date.now())); } catch (_) {} }
    listen();
  } catch (_) {}
}
export async function disablePush() {
  let t = ''; try { t = localStorage.getItem(KEY) || ''; } catch (_) {}
  try { if (t) await deleteDoc(doc(db, 'pushTokens', t)); } catch (_) {}
  try { msg = msg || getMessaging(getApp()); await deleteToken(msg); } catch (_) {}
  try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + ':uid'); } catch (_) {}
}
/* when signing out on a shared device, stop sending this person's notifications here */
export async function forgetDevice() { return disablePush(); }

/* app open in the foreground: FCM hands the message to the page instead of showing it, so show it ourselves */
let listening = false;
function listen() {
  if (listening) return; listening = true;
  try {
    msg = msg || getMessaging(getApp());
    onMessage(msg, async (p) => {
      const n = p.notification || {}, link = (p.fcmOptions && p.fcmOptions.link) || (p.data && p.data.link) || '';
      try { const r = await reg(); await r.showNotification(n.title || 'UNITAC', { body: n.body || '', icon: 'icons/icon-192.png', tag: (p.data && p.data.tag) || undefined, data: { link } }); }
      catch (_) {}
      window.dispatchEvent(new CustomEvent('unitac-push', { detail: { title: n.title, body: n.body, link } }));
    });
  } catch (_) {}
}
