/* หลังร้าน on phones (v3): floating dock, the "เพิ่มเติม" hub and a back bar for the pages inside it.
   It only drives the existing tab buttons, so every section keeps working exactly as on the computer. */
(function () {
  var MORE = ['war', 'tag', 'stk', 'pf', 'prt', 'sd'];
  var NAME = { war: 'ประกัน', tag: 'เลขพัสดุ', stk: 'สต็อกเส้น', pf: 'ผลงาน', prt: 'พาร์ทเนอร์', sd: 'สองข้าง' };
  var $ = function (id) { return document.getElementById(id); };
  var tab = function (k) { return document.querySelector('.adm__tabs [data-tab="' + k + '"]'); };
  function go(k) { var t = tab(k); if (t) { t.click(); window.scrollTo(0, 0); } }
  function current() { var t = document.querySelector('.adm__tabs [aria-selected="true"]'); return t ? t.dataset.tab : 'cust'; }
  function sync() {
    var k = current(), dk = MORE.indexOf(k) >= 0 ? 'more' : k;
    document.querySelectorAll('.adock [data-go]').forEach(function (b) { if (b.dataset.go === dk) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var inMore = MORE.indexOf(k) >= 0; $('aBack').hidden = !inMore; if (inMore) $('aBackT').textContent = NAME[k] || '';
    /* badges: copy the side-menu counters */
    var more = 0;
    document.querySelectorAll('[data-badge-of]').forEach(function (el) {
      var k2 = el.getAttribute('data-badge-of'), t = tab(k2), b = t && t.querySelector('.tbadge'), v = b ? b.textContent.trim() : '';
      if (k2 === 'more') return;
      if (el.classList.contains('adock__b')) { el.hidden = !v; el.textContent = v; }
      else el.textContent = v ? 'รอจัดการ ' + v : '';
      if (MORE.indexOf(k2) >= 0 && v) more += +v || 0;
    });
    var mb = document.querySelector('.adock__b[data-badge-of="more"]'); if (mb) { mb.hidden = !more; mb.textContent = more ? String(more) : ''; }
  }
  function start() {
    var tabs = document.querySelector('.adm__tabs'); if (!tabs || !document.querySelector('.adock')) return;
    document.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
    $('aBackBtn').addEventListener('click', function () { go('more'); });
    var ACT = {
      bc: function () { var b = $('bcBtn'); if (b) b.click(); },
      bkcfg: function () { var b = $('bkaCfgBtn'); if (b) b.click(); },
      backup: function () { var b = $('bkBtn'); if (b) b.click(); },
      restore: function () { var f = $('rsFile'); if (f) f.click(); },
      install: function () { var b = $('installBtn'); if (b && !b.hidden) b.click(); else if (window.UInstall) window.UInstall.open(); else alertMsg(); },
      signout: function () { var b = document.querySelector('.adm__acts [data-signout]'); if (b) b.click(); }
    };
    function alertMsg() { var t = document.getElementById('toast'); if (t) { t.textContent = 'เปิดเมนูของเบราว์เซอร์ แล้วเลือก "ติดตั้งแอป" หรือ "เพิ่มไปยังหน้าจอหลัก"'; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 4500); } }
    document.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', function () { var f = ACT[b.dataset.act]; if (f) f(); }); });
    /* app shortcuts / notification links: admin/#ord, #bk, #tag, #cust … open that section */
    function fromHash() { var k = (location.hash || '').slice(1); if (k && tab(k)) go(k); }
    setTimeout(fromHash, 350); addEventListener('hashchange', fromHash);
    new MutationObserver(sync).observe(tabs, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-selected'] });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
