/* UNITAC v3 — phone shell for the public pages: floating bottom dock + language button in the header */
(function () {
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (page === '' || page === 'index.html') page = 'index';
  var I = function (p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var ITEMS = [
    ['./', 'index', 'คิว', I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>')],
    ['portfolio.html', 'portfolio.html', 'ผลงาน', I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>')],
    ['member.html#book', '#book', 'จองคิว', I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/>')],
    ['warranty.html', 'warranty.html', 'ประกัน', I('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>')],
    ['member.html', 'member.html', 'ฉัน', I('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>')]
  ];
  function dock() {
    if (document.querySelector('.dock')) return;
    var nav = document.createElement('nav'); nav.className = 'dock'; nav.setAttribute('aria-label', 'เมนูหลัก');
    ITEMS.forEach(function (it) {
      var a = document.createElement('a'); a.href = it[0];
      if (it[1] === '#book') { a.className = 'dock__book'; a.innerHTML = '<span class="dock__ic">' + it[3] + '</span><span>' + it[2] + '</span>'; }
      else { a.innerHTML = it[3] + '<span>' + it[2] + '</span>'; if (it[1] === page) a.setAttribute('aria-current', 'page'); }
      nav.appendChild(a);
    });
    document.body.appendChild(nav); document.body.classList.add('has-dock');
  }
  /* language + install live behind one globe button on phones */
  var CODE = { th: 'TH', en: 'EN', zh: '中文' };
  function langBtn() {
    if (document.querySelector('.langbtn')) return true;
    var bar = document.querySelector('.langbar'), host = document.querySelector('.top__end') || document.querySelector('.mast__right');
    if (!bar || !host) return false;
    var L = 'th'; try { L = localStorage.getItem('unitac-lang') || 'th'; } catch (e) {}
    var b = document.createElement('button'); b.type = 'button'; b.className = 'langbtn'; b.setAttribute('data-noi18n', '');
    b.setAttribute('aria-label', 'Language / ภาษา / 语言'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>') + (CODE[L] || 'TH');
    b.addEventListener('click', function () { var open = document.documentElement.classList.toggle('lang-open'); b.setAttribute('aria-expanded', String(open)); });
    if (host.classList.contains('top__end')) { b.style.marginLeft = 'auto'; host.parentNode.insertBefore(b, host); }   /* top__end is re-rendered by the page: sit beside it */
    else host.insertBefore(b, host.firstChild);
    return true;
  }
  function start() {
    dock();
    var n = 0, iv = setInterval(function () { if (langBtn() || ++n > 60) clearInterval(iv); }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
