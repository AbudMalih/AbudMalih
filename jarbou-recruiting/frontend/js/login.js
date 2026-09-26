/* Sign-in page. Credentials go only to this application's own server (same origin). */
(function () {
  'use strict';
  var J = window.J, t = J.t, I = J.i18n;
  var $ = function (id) { return document.getElementById(id); };

  function renderLangs() {
    $('login-langs').innerHTML = I.LANGS.map(function (l) {
      return '<button type="button" class="' + (l.key === I.lang ? 'on' : '') + '" data-lang="' + l.key + '">' + J.util.esc(l.short) + '</button>';
    }).join('');
    document.title = t('Sign in') + ' · JARBOU Recruiting Command Center';
  }
  $('login-langs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (!b) return;
    I.set(b.getAttribute('data-lang'));
    renderLangs();
  });

  var params = new URLSearchParams(location.search);
  function message(text) { var m = $('login-msg'); m.textContent = text; m.hidden = !text; }
  if (params.get('expired')) message(t('Your session has expired. Please sign in again.'));
  if (params.get('signedout')) { message(t('You have been signed out.')); $('login-msg').className = 'banner blue'; }

  $('pw-toggle').addEventListener('click', function () {
    var p = $('password');
    var show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    this.setAttribute('aria-label', show ? t('Hide password') : t('Show password'));
    this.classList.toggle('on', show);
    p.focus();
  });

  // Already signed in? Go straight to the application.
  fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { if (r.ok) location.replace('./'); }).catch(function () {});
  fetch('/api/health', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (h) { $('login-version').textContent = 'Recruiting Command Center v' + h.version + ' NAS'; }).catch(function () {});

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var user = $('username').value.trim(), pw = $('password').value;
    var err = $('login-err');
    err.textContent = '';
    if (!user || !pw) { err.textContent = t('Please enter username and password.'); return; }
    var btn = $('login-btn');
    btn.disabled = true;
    fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: user, password: pw, remember: $('remember').checked })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.ok) {
          var lang = d.user && d.user.preferences && d.user.preferences.language;
          if (lang) I.set(lang);
          location.replace('./');
          return;
        }
        $('password').value = '';
        err.textContent = r.status === 429 ? t('Too many failed sign-in attempts. Please wait 15 minutes and try again.')
          : r.status === 401 ? t('Username or password is incorrect.')
          : r.status === 503 ? t('Database temporarily unavailable. Please try again in a moment.') : t(d.message || 'Sign-in failed.');
        $('password').focus();
      });
    }).catch(function () {
      err.textContent = t('Connection to the server failed. Please check your network connection.');
    }).finally(function () { btn.disabled = false; });
  });

  I.applyStatic(document);
  renderLangs();
})();
