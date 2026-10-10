/* UNITAC — "install the app" for everyone (no membership needed).
   Android / desktop Chrome & Edge: the browser's own install prompt.
   iPhone / iPad: Safari can't be prompted, so a short how-to sheet is shown.
   In-app browsers (LINE, Facebook, Instagram): ask to open in Safari / Chrome first. */
(function () {
  if (window.__unitacInstall) return; window.__unitacInstall = 1;
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  if (standalone) { document.documentElement.classList.add('is-app'); return; }
  var ua = navigator.userAgent || '';
  var IOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var INAPP = /Line\/|FBAN|FBAV|FB_IAB|Instagram|TikTok/i.test(ua);
  var lang = 'th'; try { lang = localStorage.getItem('unitac-lang') || 'th'; } catch (e) {}
  var T = {
    th: { btn: 'ติดตั้งแอป', title: 'ติดตั้งแอป UNITAC', sub: 'เปิดเร็ว เต็มจอ มีไอคอนบนหน้าจอ ไม่ต้องเป็นสมาชิกก็ติดตั้งได้',
      ios: ['เปิดหน้านี้ใน <b>Safari</b>', 'กดปุ่ม <b>แชร์</b> {share} ที่แถบด้านล่าง (iPad อยู่มุมขวาบน)', 'เลื่อนลงแล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b>', 'กด <b>เพิ่ม</b> แล้วเปิดแอปจากไอคอน UNITAC'],
      inapp: 'แอปนี้เปิดผ่านเบราว์เซอร์ในแอปแชท ซึ่งติดตั้งไม่ได้ กดเมนู <b>⋯</b> แล้วเลือก <b>เปิดในเบราว์เซอร์</b> ({br}) แล้วกดติดตั้งอีกครั้ง',
      other: 'เปิดเมนูของเบราว์เซอร์ (⋮ หรือ ⋯) แล้วเลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b> บนคอมกดไอคอน ⊕ ในช่องที่อยู่เว็บได้เลย',
      ok: 'เข้าใจแล้ว', done: 'ติดตั้งแล้ว เปิดจากไอคอน UNITAC ได้เลย', banner: 'ติดตั้งแอป UNITAC ไว้บนหน้าจอ', later: 'ไว้ทีหลัง', install: 'ติดตั้ง' },
    en: { btn: 'Install app', title: 'Install the UNITAC app', sub: 'Opens fast, full screen, with an icon on your home screen – no membership needed',
      ios: ['Open this page in <b>Safari</b>', 'Tap <b>Share</b> {share} in the bottom bar (top right on iPad)', 'Scroll down and choose <b>Add to Home Screen</b>', 'Tap <b>Add</b>, then open the app from the UNITAC icon'],
      inapp: 'You are in a chat app\'s built-in browser, which can\'t install apps. Tap <b>⋯</b> and choose <b>Open in browser</b> ({br}), then tap Install again',
      other: 'Open the browser menu (⋮ or ⋯) and choose <b>Install app</b> or <b>Add to Home screen</b>. On a computer, click the ⊕ icon in the address bar',
      ok: 'Got it', done: 'Installed – open it from the UNITAC icon', banner: 'Install the UNITAC app on your home screen', later: 'Later', install: 'Install' },
    zh: { btn: '安装应用', title: '安装 UNITAC 应用', sub: '打开更快、全屏显示、主屏幕有图标——无需会员即可安装',
      ios: ['在 <b>Safari</b> 中打开此页面', '点击底部的 <b>分享</b> {share}（iPad 在右上角）', '向下滑动并选择 <b>添加到主屏幕</b>', '点击 <b>添加</b>，然后从 UNITAC 图标打开'],
      inapp: '您正在聊天应用的内置浏览器中，无法安装。请点击 <b>⋯</b> 并选择 <b>在浏览器中打开</b>（{br}），然后再次点击安装',
      other: '打开浏览器菜单（⋮ 或 ⋯），选择 <b>安装应用</b> 或 <b>添加到主屏幕</b>。电脑上可点击地址栏中的 ⊕ 图标',
      ok: '知道了', done: '已安装——从 UNITAC 图标打开即可', banner: '将 UNITAC 应用安装到主屏幕', later: '以后再说', install: '安装' }
  }[lang] || null;
  if (!T) return;
  var SHARE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;color:#FF7A3C"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v9h14v-9"/></svg>';
  var ICON = '<svg viewBox="4.3 21.5 85.5 36.5" width="26"><path fill="#FF7A3C" d="M4.85 24.9Q4.85 22.05 7.7 22.05H10.5L12.4 24.9L16.6 22.05H26Q27.3 22.05 27.3 23.3V24.54L12.14 41.96Q11.1 43.16 11.1 44.56V45.25Q11.1 46.85 12.7 46.85H25.54L47.12 22.05H84.2L89.3 27.7V28.4Q89.3 30.1 86.9 30.1H72.56L48.73 57.5H40.02Q36.23 57.5 38.73 54.63L60.06 30.1H52.46L28.63 57.5H7.65Q4.85 57.5 4.85 54.7Z"/></svg>';
  var deferred = null, btns = [];
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', function () { deferred = null; btns.forEach(function (b) { b.hidden = true; }); var bn = document.getElementById('instBanner'); if (bn) bn.remove(); toast(T.done); });

  var css = document.createElement('style');
  css.textContent =
    '.instbtn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--accent,#FF7A3C);background:rgba(255,122,60,.10);color:var(--accent,#FF7A3C);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}' +
    '.instbtn:hover{background:rgba(255,122,60,.18)}.instbtn svg{width:15px;height:15px}' +
    '.langbar{gap:8px;align-items:center}' +
    '#instDlg{border:0;padding:0;background:transparent;max-width:min(420px,calc(100vw - 24px));width:100%;color:var(--ink,#F2EDE5)}' +
    '#instDlg::backdrop{background:rgba(12,10,8,.65);backdrop-filter:blur(3px)}' +
    '#instDlg .ib{background:var(--surface,#1D1B18);border:1px solid var(--rule,#2F2B26);border-radius:18px;padding:20px;display:grid;gap:14px;box-shadow:0 12px 32px -8px rgba(0,0,0,.7)}' +
    '#instDlg .ih{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center}' +
    '#instDlg .ic{width:48px;height:48px;border-radius:12px;background:#141311;display:grid;place-items:center;box-shadow:0 0 0 1px #3C3731}' +
    '#instDlg h2{font-size:17px;margin:0;line-height:1.35}#instDlg p{margin:0;font-size:13.5px;color:var(--ink-2,#CBC4B8);line-height:1.6}' +
    '#instDlg ol{margin:0;padding:0;list-style:none;display:grid;gap:9px;counter-reset:s}' +
    '#instDlg li{display:grid;grid-template-columns:24px 1fr;gap:10px;font-size:14px;line-height:1.55;counter-increment:s}' +
    '#instDlg li::before{content:counter(s);width:24px;height:24px;border-radius:50%;background:var(--accent,#FF7A3C);color:#1A0E07;font-weight:700;font-size:12.5px;display:grid;place-items:center}' +
    '#instDlg li svg{display:inline-block;vertical-align:-3px;margin:0 2px}' +
    '#instDlg .ok{min-height:44px;border-radius:999px;border:0;background:var(--accent,#FF7A3C);color:#1A0E07;font:inherit;font-weight:600;cursor:pointer}' +
    '#instBanner{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:55;display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;background:var(--surface,#1D1B18);border:1px solid var(--rule-strong,#3C3731);box-shadow:0 12px 32px -8px rgba(0,0,0,.7);font-size:13.5px;color:var(--ink,#F2EDE5);max-width:520px;margin:0 auto}' +
    '#instBanner .ic{width:38px;height:38px;border-radius:10px;background:#141311;display:grid;place-items:center;box-shadow:0 0 0 1px #3C3731}' +
    '#instBanner button{font:inherit;font-size:13px;font-weight:600;border-radius:999px;min-height:34px;padding:0 12px;cursor:pointer}' +
    '#instBanner .x{background:none;border:0;color:var(--muted,#948D80)}#instBanner .go{background:var(--accent,#FF7A3C);border:0;color:#1A0E07}' +
    '@media (min-width:900px){#instBanner{display:none}}';
  document.head.appendChild(css);

  function toast(m) { var t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 3500); }
  function sheet() {
    var d = document.getElementById('instDlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'instDlg'; d.setAttribute('data-noi18n', ''); document.body.appendChild(d); d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); }
    var body;
    if (INAPP) body = '<p>' + T.inapp.replace('{br}', IOS ? 'Safari' : 'Chrome') + '</p>';
    else if (IOS) body = '<ol>' + T.ios.map(function (s) { return '<li><span>' + s.replace('{share}', SHARE) + '</span></li>'; }).join('') + '</ol>';
    else body = '<p>' + T.other + '</p>';
    d.innerHTML = '<div class="ib"><div class="ih"><span class="ic">' + ICON + '</span><div><h2>' + T.title + '</h2><p>' + T.sub + '</p></div></div>' + body + '<button type="button" class="ok">' + T.ok + '</button></div>';
    d.querySelector('.ok').addEventListener('click', function () { d.close(); });
    d.showModal();
  }
  function install() {
    if (deferred && !INAPP) {
      deferred.prompt();
      deferred.userChoice.then(function (r) { if (r && r.outcome === 'accepted') toast(T.done); }).catch(function () {});
      deferred = null; return;
    }
    sheet();
  }
  window.UInstall = { open: install };
  function makeBtn() {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'instbtn'; b.setAttribute('data-noi18n', '');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>' + T.btn;
    b.addEventListener('click', install); btns.push(b); return b;
  }
  /* button beside the language switcher (it is created after load on the queue page) */
  var tries = 0, iv = setInterval(function () {
    var bar = document.querySelector('.langbar');
    if (bar && !bar.querySelector('.instbtn')) { bar.insertBefore(makeBtn(), bar.firstChild); clearInterval(iv); }
    if (++tries > 60) clearInterval(iv);
  }, 150);
  document.querySelectorAll('[data-install]').forEach(function (el) { el.hidden = false; el.addEventListener('click', install); });
  /* one gentle banner on phones, once a week at most */
  var KEY = 'unitac-inst-later', last = 0; try { last = +localStorage.getItem(KEY) || 0; } catch (e) {}
  if (/Mobi|Android|iPhone|iPad/i.test(ua) && Date.now() - last > 7 * 864e5) setTimeout(function () {
    if (document.getElementById('instBanner')) return;
    var bn = document.createElement('div'); bn.id = 'instBanner'; bn.setAttribute('data-noi18n', ''); bn.setAttribute('role', 'region'); bn.setAttribute('aria-label', T.btn);
    bn.innerHTML = '<span class="ic">' + ICON + '</span><span>' + T.banner + '</span><button type="button" class="x">' + T.later + '</button><button type="button" class="go">' + T.install + '</button>';
    bn.querySelector('.x').addEventListener('click', function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} bn.remove(); });
    bn.querySelector('.go').addEventListener('click', function () { bn.remove(); install(); });
    document.body.appendChild(bn);
  }, 2500);
})();
