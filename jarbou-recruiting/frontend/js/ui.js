/* UI primitives: actions (event delegation), toasts, modals, confirms,
   dropdown menus, tooltips and reusable badge/progress renderers. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config;
  var ui = (J.ui = {});
  var A = (J.actions = {});
  var esc = U.esc, icon = U.icon, t = J.t;

  /* ------------------------------------------------------------ Event delegation */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var name = el.getAttribute('data-action');
    if (!A[name]) { console.warn('Unknown action', name); return; }
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    if (el.hasAttribute('data-stop')) e.stopPropagation();
    A[name](el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-change]');
    if (!el) return;
    var name = el.getAttribute('data-change');
    if (A[name]) A[name](el, e);
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-input]');
    if (!el) return;
    var name = el.getAttribute('data-input');
    if (A[name]) A[name](el, e);
  });

  /* ------------------------------------------------------------ Toasts */
  ui.toast = function (msg, type) {
    type = type || 'success';
    var root = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = icon(type === 'error' ? 'xCircle' : type === 'warn' ? 'alert' : type === 'info' ? 'info' : 'checkCircle') + '<span>' + esc(msg) + '</span>';
    root.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 250); }, type === 'error' || type === 'warn' ? 5200 : 3000);
  };

  /* ------------------------------------------------------------ Modals */
  var modalStack = [];
  ui.modal = function (opts) {
    var root = document.getElementById('modal-root');
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML =
      '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
      '<div class="modal-head"><div><h3>' + esc(opts.title) + '</h3>' + (opts.subtitle ? '<p>' + opts.subtitle + '</p>' : '') + '</div>' +
      '<button class="icon-btn" data-close aria-label="' + esc(t('Close')) + '">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.foot !== false ? '<div class="modal-foot">' + (opts.foot || '<button class="btn" data-close>' + esc(t('Close')) + '</button>') + '</div>' : '') +
      '</div>';
    root.appendChild(wrap);
    var m = {
      el: wrap,
      close: function () {
        wrap.remove();
        modalStack = modalStack.filter(function (x) { return x !== m; });
        if (opts.onClose) opts.onClose();
      },
      q: function (sel) { return wrap.querySelector(sel); },
      qa: function (sel) { return Array.prototype.slice.call(wrap.querySelectorAll(sel)); }
    };
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap && !opts.sticky) m.close(); });
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) m.close(); });
    modalStack.push(m);
    setTimeout(function () {
      var f = wrap.querySelector('[autofocus], .modal-body input:not([type=hidden]), .modal-body select, .modal-body textarea, .modal-foot .btn.primary, .modal-foot .btn.danger');
      if (f) f.focus();
    }, 30);
    return m;
  };

  ui.confirm = function (opts) {
    return new Promise(function (resolve) {
      var typed = opts.typeToConfirm;
      var m = ui.modal({
        title: opts.title || t('Please confirm'),
        body: '<p style="line-height:1.55">' + opts.message + '</p>' +
          (typed ? '<div class="field mt-16"><label>' + t('Type {0} to confirm', '<b>' + esc(typed) + '</b>') + '</label><input type="text" id="confirm-type" autocomplete="off"></div>' : ''),
        foot: '<button class="btn" data-close>' + esc(t('Cancel')) + '</button><button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" id="confirm-ok"' + (typed ? ' disabled' : '') + '>' + esc(opts.ok || t('Confirm')) + '</button>',
        onClose: function () { if (!done) resolve(false); }
      });
      var done = false;
      if (typed) {
        m.q('#confirm-type').addEventListener('input', function (e) { m.q('#confirm-ok').disabled = e.target.value.trim() !== typed; });
      }
      m.q('#confirm-ok').addEventListener('click', function () { done = true; m.close(); resolve(true); });
    });
  };

  /* ------------------------------------------------------------ Dropdown menu */
  var openMenu = null;
  ui.closeMenu = function () { if (openMenu) { openMenu.remove(); openMenu = null; } };
  /** items: [{label, icon, onClick, danger, checked, sep, header}] */
  ui.menu = function (anchor, items) {
    ui.closeMenu();
    var el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = items.map(function (it, i) {
      if (it.sep) return '<div class="sep"></div>';
      if (it.header) return '<div class="mh">' + esc(it.header) + '</div>';
      return '<button role="menuitem" data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' + (it.icon ? icon(it.icon, 'sm') : '') + '<span>' + esc(it.label) + '</span>' + (it.checked ? '<span class="check">' + icon('check', 'sm') + '</span>' : '') + '</button>';
    }).join('');
    document.body.appendChild(el);
    var r = anchor.getBoundingClientRect();
    var mw = el.offsetWidth, mh = el.offsetHeight;
    var left = Math.min(r.right - mw, window.innerWidth - mw - 8);
    if (left < 8) left = Math.min(r.left, window.innerWidth - mw - 8);
    var top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    el.style.left = Math.max(8, left) + 'px';
    el.style.top = top + 'px';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (!b) return;
      e.stopPropagation();
      var it = items[+b.getAttribute('data-i')];
      if (!it.keepOpen) ui.closeMenu();
      if (it.onClick) it.onClick(b);
    });
    openMenu = el;
    var first = el.querySelector('button');
    if (first) first.focus();
    return el;
  };
  document.addEventListener('mousedown', function (e) {
    if (openMenu && !openMenu.contains(e.target)) ui.closeMenu();
  });
  window.addEventListener('resize', ui.closeMenu);
  document.addEventListener('scroll', function () { ui.closeMenu(); }, true);

  /* ------------------------------------------------------------ Tooltips */
  var tipEl = null;
  document.addEventListener('mouseover', function (e) {
    var t = e.target.closest('[data-tip]');
    if (!t) { if (tipEl) { tipEl.remove(); tipEl = null; } return; }
    if (tipEl && tipEl._for === t) return;
    if (tipEl) tipEl.remove();
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    tipEl.textContent = t.getAttribute('data-tip');
    tipEl._for = t;
    document.body.appendChild(tipEl);
    var r = t.getBoundingClientRect();
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    var top = r.top - h - 6;
    if (top < 8) top = r.bottom + 6;
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
  });
  document.addEventListener('mousedown', function () { if (tipEl) { tipEl.remove(); tipEl = null; } });

  /* ------------------------------------------------------------ Keyboard */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (openMenu) { ui.closeMenu(); return; }
      if (modalStack.length) { modalStack[modalStack.length - 1].close(); return; }
      if (J.profile && J.profile.isOpen()) { J.profile.close(); return; }
    }
  });
  ui.hasModal = function () { return modalStack.length > 0; };

  /* ------------------------------------------------------------ Renderers */
  ui.badge = function (text, cls, ic) {
    return '<span class="badge ' + (cls || '') + '">' + (ic ? icon(ic) : '') + esc(text) + '</span>';
  };
  ui.stageBadge = function (key) {
    var st = J.logic.stage(key);
    return '<span class="badge outline"><span style="width:7px;height:7px;border-radius:50%;background:' + st.color + ';display:inline-block"></span>' + esc(t(st.label)) + '</span>';
  };
  ui.overallBadge = function (info, withCount) {
    var o = C.OVERALL[info.overall];
    var txt = t(o.label);
    if (info.overall === 'not_ready' && withCount) txt += ' · ' + info.outstanding;
    return ui.badge(txt, o.badge, o.icon);
  };
  ui.docBadge = function (status) {
    var s = J.logic.docStatus(status);
    return ui.badge(t(s.label), s.badge, s.icon);
  };
  ui.contractBadge = function (status) {
    var s = J.logic.contractStatus(status);
    return ui.badge(t(s.label), s.badge, s.icon);
  };
  ui.availBadge = function (key) {
    var a = J.logic.availability(key);
    return ui.badge(t(a.short), a.badge, key === 'ready' ? 'check' : key === 'not_available' ? 'x' : key ? 'clock' : 'minus');
  };
  ui.prioBadge = function (p) {
    /* i18n: t('High priority') t('Medium') t('Low') */
    var map = { high: ['High priority', 'red', 'alert'], medium: ['Medium', 'amber', 'clock'], low: ['Low', 'blue', 'info'] };
    var m = map[p] || map.low;
    return '<span class="badge prio ' + m[1] + '">' + icon(m[2]) + esc(t(m[0])) + '</span>';
  };
  ui.progress = function (pct, cls) {
    return '<div class="progress ' + (cls || '') + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></div>';
  };
  ui.pctClass = function (pct) { return pct >= 100 ? 'green' : pct >= 60 ? 'blue' : pct >= 30 ? 'amber' : 'red'; };
  ui.miniProgress = function (done, total, tipText) {
    var pct = U.pct(done, total);
    return '<div class="mini-progress"' + (tipText ? ' data-tip="' + esc(tipText) + '"' : '') + '>' + ui.progress(pct, ui.pctClass(pct)) + '<span class="txt">' + done + '/' + total + '</span></div>';
  };
  ui.daysPill = function (d) {
    if (d === null || d === undefined) return '<span class="muted">—</span>';
    var cls = d === 0 ? 'today' : d < 0 ? 'past' : d <= 7 ? 'soon' : '';
    var txt = d === 0 ? t('Today') : d < 0 ? t('{0}d ago', Math.abs(d)) : d === 1 ? t('{0} day', d) : t('{0} days', d);
    return '<span class="days-pill ' + cls + '">' + esc(txt) + '</span>';
  };
  ui.projectPill = function (p) {
    if (!p) return '<span class="muted">—</span>';
    if (/dhl/i.test(p)) return '<span class="dhl-pill">' + esc(p) + '</span>';
    return '<span class="proj-pill">' + esc(p) + '</span>';
  };
  ui.empty = function (ic, title, text, extra) {
    return '<div class="empty"><div class="ico">' + icon(ic, 'lg') + '</div><h4>' + esc(title) + '</h4>' + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div>';
  };
  ui.val = function (v, fallback) {
    return v === null || v === undefined || v === '' ? '<span class="muted">' + esc(fallback ? t(fallback) : '—') + '</span>' : esc(v);
  };
  /** Build <option>s. Labels of {key,label} objects and the blank label are translated;
      plain string lists are translated only with opts.tr (fixed vocabularies, not user data). */
  ui.options = function (list, selected, opts) {
    opts = opts || {};
    var html = opts.blank !== undefined ? '<option value="">' + esc(t(opts.blank)) + '</option>' : '';
    var seen = false;
    list.forEach(function (o) {
      var v = typeof o === 'object' ? o.key : o;
      var l = typeof o === 'object' ? (opts.raw ? o.label : t(o.label)) : (opts.tr ? t(o) : o);
      if (String(v) === String(selected)) seen = true;
      html += '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(l) + '</option>';
    });
    if (selected && !seen && opts.keepUnknown !== false) html += '<option value="' + esc(selected) + '" selected>' + esc(opts.tr ? t(selected) : selected) + '</option>';
    return html;
  };
})();
