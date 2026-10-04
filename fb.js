/* UNITAC — Firebase connection shared by every page */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, reload
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDBK59GWOsP_vaneuypqPjHIK-44Lqj6-4",
  authDomain: "unitac3d.firebaseapp.com",
  projectId: "unitac3d",
  storageBucket: "unitac3d.firebasestorage.app",
  messagingSenderId: "347511261968",
  appId: "1:347511261968:web:bcd8b5a0bb4f278c4ef395"
};

export const OWNER = 'NquORa1WjHM6YGNO7a6GkyaY8RU2';
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);   /* the queue page may have started Firebase already */
export const auth = getAuth(app);
auth.languageCode = 'th';
export const db = getFirestore(app);

export {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, reload,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch, serverTimestamp, increment
};

export function authMsg(code) {
  switch (code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found':
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    case 'auth/invalid-email': return 'รูปแบบอีเมลไม่ถูกต้อง';
    case 'auth/email-already-in-use': return 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบ หรือกดลืมรหัสผ่าน';
    case 'auth/weak-password': case 'auth/password-does-not-meet-requirements':
      return 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีตัวเลขอย่างน้อย 1 ตัว';
    case 'auth/too-many-requests': return 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่';
    case 'auth/network-request-failed': return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้';
    case 'auth/requires-recent-login': return 'เพื่อความปลอดภัย ออกจากระบบแล้วเข้าใหม่อีกครั้งก่อน';
    case 'permission-denied': return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้';
    default: return 'ทำรายการไม่สำเร็จ ลองอีกครั้ง';
  }
}

/* signed in as the shop owner: the "สมาชิก" tab becomes "หลังร้าน" on every page */
function swapNav(own) {
  const onAdmin = /admin\.html$/.test(location.pathname);
  /* older pages appended their own "หลังร้าน" link: keep only the swapped tab */
  document.querySelectorAll('.nav a[href="admin.html"]:not([data-nav])').forEach(a => a.remove());
  document.querySelectorAll('[data-nav="member"]').forEach(a => {
    a.textContent = own ? 'หลังร้าน' : 'สมาชิก';
    a.href = own ? 'admin.html' : 'member.html';
    if (own) { if (onAdmin) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  });
}
onAuthStateChanged(auth, (u) => swapNav(!!u && u.uid === OWNER));
