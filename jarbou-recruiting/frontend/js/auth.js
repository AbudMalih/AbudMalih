/* Signed-in user, permissions and UI gating.
   IMPORTANT: hiding controls here is only for a clean interface – every permission is
   enforced again by the server (401/403), so a manipulated browser cannot bypass it. */
(function () {
  'use strict';
  var J = window.J, U = J.util, t = J.t;
  var auth = (J.auth = { user: null });

  auth.init = function () {
    return J.api.get('/api/auth/me').then(function (r) {
      auth.user = r.user;
      auth.version = r.version;
      J.api.csrf = r.csrfToken;
      document.body.setAttribute('data-role', r.user.role);
      return r.user;
    });
  };
  auth.can = function (perm) { return !!auth.user && auth.user.permissions.indexOf(perm) !== -1; };
  auth.role = function () { return auth.user ? auth.user.role : ''; };
  auth.roleLabel = function (role) { return t({ admin: 'Admin', recruiter: 'Recruiter', viewer: 'Viewer' }[role || auth.role()] || role); };

  auth.logout = function () {
    return J.api.post('/api/auth/logout', {}, { noRedirect: true }).catch(function () {}).then(function () { location.href = 'login.html?signedout=1'; });
  };

  // Controls that change candidate data (need candidate.write)
  var WRITE = ['add-candidate', 'edit-candidate', 'archive-candidate', 'restore-candidate', 'follow-up', 'docs-request-all', 'contract-status',
    'contract-save', 'toggle-onboarding', 'add-activity', 'delete-activity', 'save-notes', 'add-note', 'delete-note', 'docs-cell',
    'upload-attachment', 'delete-attachment', 'complete-follow-up', 'add-follow-up'];
  var WRITE_CHANGE = ['set-availability', 'doc-status', 'doc-date', 'doc-note', 'pipe-move', 'attachment-file'];
  var EXPORT = ['cand-export', 'export-candidates-quick', 'archive-export', 'rep-export', 'export-all'];
  var ADMIN = ['delete-candidate'];

  /** Remove/disable controls the current role may not use (call after rendering). */
  auth.gate = function (root) {
    if (!root || !auth.user) return;
    var sel = [];
    if (!auth.can('candidate.write')) {
      WRITE.forEach(function (a) { sel.push('[data-action="' + a + '"]'); });
      WRITE_CHANGE.forEach(function (a) { sel.push('[data-change="' + a + '"]'); });
      root.querySelectorAll('.kcard[draggable]').forEach(function (el) { el.removeAttribute('draggable'); });
      root.querySelectorAll('#notes-main, #note-new, #act-text, #contract-form input, #contract-form select, #contract-form textarea').forEach(function (el) { el.disabled = true; });
    }
    if (!auth.can('export')) EXPORT.forEach(function (a) { sel.push('[data-action="' + a + '"]'); });
    if (!auth.can('candidate.delete')) ADMIN.forEach(function (a) { sel.push('[data-action="' + a + '"]'); });
    if (!sel.length) return;
    root.querySelectorAll(sel.join(',')).forEach(function (el) {
      if (/^(SELECT|INPUT|TEXTAREA)$/.test(el.tagName)) el.disabled = true;
      else el.style.display = 'none';
    });
  };

  /** Personal account dialog: change own password. `forced` = must change before continuing. */
  auth.passwordDialog = function (forced) {
    var m = J.ui.modal({
      title: forced ? t('Please change your password') : t('Change password'),
      subtitle: forced ? U.esc(t('For security reasons you must set a new personal password before you can continue.')) : '',
      sticky: !!forced,
      body: '<form id="pw-form" class="fgrid two" novalidate autocomplete="off">' +
        '<div class="field span-3"><label for="pw-cur">' + U.esc(t('Current password')) + '</label><input id="pw-cur" type="password" autocomplete="current-password" autofocus></div>' +
        '<div class="field"><label for="pw-new">' + U.esc(t('New password')) + '</label><input id="pw-new" type="password" autocomplete="new-password"></div>' +
        '<div class="field"><label for="pw-rep">' + U.esc(t('Repeat new password')) + '</label><input id="pw-rep" type="password" autocomplete="new-password"></div>' +
        '<div class="field span-3"><div class="help">' + U.esc(t('At least 10 characters with letters and numbers. Do not reuse passwords from other services.')) + '</div><div class="err" id="pw-err"></div></div>' +
        '<button type="submit" hidden></button></form>',
      foot: (forced ? '<button class="btn ghost" id="pw-logout" style="margin-inline-end:auto">' + U.esc(t('Sign out')) + '</button>' : '<button class="btn" data-close>' + U.esc(t('Cancel')) + '</button>') +
        '<button class="btn primary" id="pw-save">' + U.esc(t('Save new password')) + '</button>'
    });
    if (forced) {
      var x = m.el.querySelector('.modal-head [data-close]'); if (x) x.remove();
      m.q('#pw-logout').addEventListener('click', auth.logout);
    }
    var submit = function (e) {
      if (e) e.preventDefault();
      var cur = m.q('#pw-cur').value, nw = m.q('#pw-new').value, rep = m.q('#pw-rep').value;
      var err = m.q('#pw-err');
      if (nw !== rep) { err.textContent = t('The new passwords do not match.'); return; }
      J.api.post('/api/auth/password', { currentPassword: cur, newPassword: nw }).then(function () {
        m.close();
        J.ui.toast(t('Password changed.'));
        if (forced) location.reload();
      }, function (e2) { err.textContent = J.api.message(e2); });
    };
    m.q('#pw-form').addEventListener('submit', submit);
    m.q('#pw-save').addEventListener('click', submit);
  };
})();
