/* Settings (NAS edition): shared company settings, personal preferences, own account,
   user administration, selection lists, recruitment targets, document requirements,
   onboarding checklist, server backups, import of offline backups, data & privacy.
   Every change goes to the central server; the server enforces all permissions again. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon, t = J.t;
  var scrollTo = '';

  // Data loaded on demand (admin sections) and unsaved drafts.
  var users = null, usersLoading = false, usersError = '';
  var backups = null, backupsLoading = false, backupsError = '', backupBusy = false;
  var targetsDraft = null, targetsDirty = false;
  var queue = Promise.resolve();

  /* i18n: t('Projects') t('Stations / Locations') t('Positions') t('Recruitment Sources')
     t('Candidates can be assigned to a project. Use the project selector in the top bar to focus on one project.') t('New project name')
     t('Stations available when assigning candidates (e.g. Hannover, Kassel, Haiger, Bremen).') t('New station, e.g. Göttingen')
     t('Job positions available for candidates.') t('New position')
     t('Where candidates come from – used for source analytics.') t('New source') */
  var LISTS = {
    projects: { title: 'Projects', help: 'Candidates can be assigned to a project. Use the project selector in the top bar to focus on one project.', placeholder: 'New project name' },
    stations: { title: 'Stations / Locations', help: 'Stations available when assigning candidates (e.g. Hannover, Kassel, Haiger, Bremen).', placeholder: 'New station, e.g. Göttingen' },
    positions: { title: 'Positions', help: 'Job positions available for candidates.', placeholder: 'New position' },
    sources: { title: 'Recruitment Sources', help: 'Where candidates come from – used for source analytics.', placeholder: 'New source' }
  };

  /* i18n: t('Admin') t('Recruiter') t('Viewer')
     t('Full access including users, shared settings, backups, import and permanent deletion.')
     t('Can add and edit candidates, documents, contracts, onboarding and follow-ups, and export lists.')
     t('Read-only access to dashboard, candidates and reports. Cannot change or export data.') */
  var ROLES = [
    { key: 'admin', label: 'Admin', desc: 'Full access including users, shared settings, backups, import and permanent deletion.' },
    { key: 'recruiter', label: 'Recruiter', desc: 'Can add and edit candidates, documents, contracts, onboarding and follow-ups, and export lists.' },
    { key: 'viewer', label: 'Viewer', desc: 'Read-only access to dashboard, candidates and reports. Cannot change or export data.' }
  ];

  /* i18n: t('Automatic') t('Manual') t('Before restore') t('Before update') t('Uploaded') */
  var KINDS = { auto: 'Automatic', manual: 'Manual', 'pre-restore': 'Before restore', 'pre-update': 'Before update', uploaded: 'Uploaded' };

  /* ------------------------------------------------------------ helpers */
  function can(p) { return J.auth.can(p); }
  function fail(err) { ui.toast(J.api.message(err), 'error'); }
  function onPage() { return !!document.getElementById('settings-root'); }
  function rerender() { if (onPage()) J.app.rerenderView(); }
  function accept(resp, msg) { S.acceptSettings(resp); J.app.refresh(); if (msg) ui.toast(msg); }
  function fmtSize(b) {
    if (b === null || b === undefined) return '—';
    return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  }
  function dt(iso) { return iso ? esc(U.fmtDateTime(iso)) : '<span class="muted">—</span>'; }
  function readOnlyNote() {
    return '<p class="small muted mt-8">' + icon('lock', 'sm') + ' ' + esc(t('Only administrators can change these settings.')) + '</p>';
  }

  function section(id, title, sub, body, head) {
    return '<div class="card mb-16" id="set-' + id + '"><div class="card-head"><div><h3>' + esc(title) + '</h3>' +
      (sub ? '<div class="small muted" style="margin-top:3px">' + esc(sub) + '</div>' : '') + '</div>' + (head || '') + '</div>' +
      '<div class="card-body">' + body + '</div></div>';
  }

  /* ------------------------------------------------------------ 1. General */
  function field(label, control, help) {
    return '<div class="field"><label>' + esc(label) + '</label>' + control + (help ? '<div class="help">' + esc(help) + '</div>' : '') + '</div>';
  }
  function generalSection(s) {
    var nextId = (s.idPrefix || 'JRB') + '-' + U.pad(s.nextNumber || 1, 4);
    if (!can('settings.write')) {
      /* i18n: t('net') t('gross') */
      return '<dl class="dl" style="grid-template-columns:260px 1fr">' +
        '<dt>' + esc(t('Company name')) + '</dt><dd>' + ui.val(s.companyName) + '</dd>' +
        '<dt>' + esc(t('Default project (current project)')) + '</dt><dd>' + ui.val(s.defaultProject, 'None') + '</dd>' +
        '<dt>' + esc(t('Default station for new candidates')) + '</dt><dd>' + ui.val(s.defaultStation, 'None (choose per candidate)') + '</dd>' +
        '<dt>' + esc(t('Default position')) + '</dt><dd>' + ui.val(s.defaultPosition, 'None') + '</dd>' +
        '<dt>' + esc(t('Target counts position')) + '</dt><dd>' + ui.val(s.targetPosition, 'All positions') + '</dd>' +
        '<dt>' + esc(t('Standard salary reference (€ / month)')) + '</dt><dd>' + esc(s.standardSalaryReference) + ' € ' + esc(t(s.standardSalaryBasis || 'net')) + '</dd>' +
        '<dt>' + esc(t('Warn about document expiry (days ahead)')) + '</dt><dd>' + esc(s.expiryWarningDays) + '</dd>' +
        '<dt>' + esc(t('Warn unsigned contract (days before start)')) + '</dt><dd>' + esc(s.contractWarningDays) + '</dd>' +
        '<dt>' + esc(t('Candidate ID prefix')) + '</dt><dd>' + esc(s.idPrefix) + ' <span class="small muted">· ' + esc(t('Next ID: {0}', nextId)) + '</span></dd></dl>' + readOnlyNote();
    }
    /* i18n: t('All positions') t('None') t('None (choose per candidate)') t('net') t('gross') */
    return '<div class="fgrid">' +
      field(t('Company name'), '<input type="text" value="' + esc(s.companyName) + '" data-change="set-setting" data-k="companyName">') +
      field(t('Default project (current project)'), '<select data-change="set-setting" data-k="defaultProject">' + ui.options(s.projects, s.defaultProject, { blank: 'None' }) + '</select>') +
      field(t('Default station for new candidates'), '<select data-change="set-setting" data-k="defaultStation">' + ui.options(s.stations, s.defaultStation, { blank: 'None (choose per candidate)' }) + '</select>') +
      field(t('Default position'), '<select data-change="set-setting" data-k="defaultPosition">' + ui.options(s.positions, s.defaultPosition, { blank: 'None' }) + '</select>') +
      field(t('Target counts position'), '<select data-change="set-setting" data-k="targetPosition">' + ui.options(s.positions, s.targetPosition, { blank: 'All positions' }) + '</select>', t('Only candidates with this position count toward the driver targets.')) +
      field(t('Standard salary reference (€ / month)'), '<div class="inline-pair"><input type="number" min="0" step="10" value="' + esc(s.standardSalaryReference) + '" data-change="set-setting" data-k="standardSalaryReference" data-type="num">' +
        '<select style="width:92px" data-change="set-setting" data-k="standardSalaryBasis">' + ui.options([{ key: 'net', label: 'net' }, { key: 'gross', label: 'gross' }], s.standardSalaryBasis) + '</select></div>') +
      field(t('Warn about document expiry (days ahead)'), '<input type="number" min="1" max="365" value="' + esc(s.expiryWarningDays) + '" data-change="set-setting" data-k="expiryWarningDays" data-type="int">') +
      field(t('Warn unsigned contract (days before start)'), '<input type="number" min="1" max="90" value="' + esc(s.contractWarningDays) + '" data-change="set-setting" data-k="contractWarningDays" data-type="int">') +
      field(t('Candidate ID prefix'), '<input type="text" maxlength="6" value="' + esc(s.idPrefix) + '" data-change="set-setting" data-k="idPrefix">', t('Applies to new candidates only. Next ID: {0}', nextId)) +
      '</div>';
  }

  /* ------------------------------------------------------------ 2./3. Preferences & account */
  function prefsSection(s) {
    var langs = J.i18n.LANGS.map(function (l) { return { key: l.key, label: l.label }; });
    return '<div class="fgrid">' + field(t('Language'), '<select data-change="set-language" aria-label="' + esc(t('Language')) + '">' + ui.options(langs, s.language || J.i18n.lang, { raw: true }) + '</select>',
      t('Default: Deutsch. Arabic uses a right-to-left layout.')) + '</div>' +
      '<p class="small muted mt-8">' + esc(t('Personal preferences are saved to your user account and apply on every computer you sign in to.')) + '</p>';
  }
  function accountSection() {
    var u = J.auth.user || {};
    return '<dl class="dl" style="grid-template-columns:220px 1fr">' +
      '<dt>' + esc(t('Full name')) + '</dt><dd>' + ui.val(u.fullName) + '</dd>' +
      '<dt>' + esc(t('Username')) + '</dt><dd class="mono">' + esc(u.username) + '</dd>' +
      '<dt>' + esc(t('Email')) + '</dt><dd>' + ui.val(u.email) + '</dd>' +
      '<dt>' + esc(t('Role')) + '</dt><dd><span class="role-pill ' + esc(u.role) + '">' + esc(J.auth.roleLabel()) + '</span></dd></dl>' +
      '<div class="row mt-16"><button class="btn" data-action="settings-password">' + icon('lock', 'sm') + esc(t('Change password')) + '</button></div>';
  }

  /* ------------------------------------------------------------ 4. Users */
  function usersSection() {
    if (usersError) return '<div class="banner red">' + icon('alert') + '<div class="grow">' + esc(usersError) + '</div></div>';
    if (!users) return '<p class="small muted">' + esc(t('Loading…')) + '</p>';
    var me = J.auth.user ? J.auth.user.id : '';
    var rows = users.map(function (u) {
      return '<tr><td class="name-cell">' + esc(u.fullName) + (u.id === me ? ' <span class="small muted">(' + esc(t('you')) + ')</span>' : '') + '</td>' +
        '<td class="mono">' + esc(u.username) + '</td><td>' + ui.val(u.email) + '</td>' +
        '<td><span class="role-pill ' + esc(u.role) + '">' + esc(J.auth.roleLabel(u.role)) + '</span></td>' +
        '<td>' + (u.active ? ui.badge(t('Active'), 'green') : ui.badge(t('Deactivated'), 'red')) +
        (u.active && u.mustChangePassword ? ' ' + ui.badge(t('Must change password'), 'amber') : '') + '</td>' +
        '<td>' + esc(U.fmtDate(u.createdAt)) + '</td>' +
        '<td>' + (u.lastLoginAt ? esc(U.fmtDateTime(u.lastLoginAt)) : '<span class="muted">' + esc(t('Never')) + '</span>') + '</td>' +
        '<td class="center">' + esc(u.activeSessions || 0) + '</td>' +
        '<td class="actions-cell"><button class="icon-btn" data-action="settings-user-menu" data-id="' + esc(u.id) + '" aria-label="' + esc(t('Actions')) + '">' + icon('more', 'sm') + '</button></td></tr>';
    }).join('');
    return '<div class="table-wrap" style="max-height:none;min-height:0"><table class="data compact static"><thead><tr>' +
      '<th>' + esc(t('Full Name')) + '</th><th>' + esc(t('Username')) + '</th><th>' + esc(t('Email')) + '</th><th>' + esc(t('Role')) + '</th><th>' + esc(t('Status')) + '</th>' +
      '<th>' + esc(t('Created')) + '</th><th>' + esc(t('Last Login')) + '</th><th class="center">' + esc(t('Active sessions')) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small muted mt-8">' + esc(t('Active users with the role Admin or Recruiter appear in the recruiter selection of candidates. Deactivated users cannot sign in; their history is kept.')) + '</p>';
  }

  /* ------------------------------------------------------------ 5. Selection lists */
  function listSection(type) {
    var s = S.settings(), items = (s.lists && s.lists[type]) || [], edit = can('settings.write');
    var rows = items.map(function (it, k) {
      var usage = it.used === 1 ? t('{0} candidate', 1) : t('{0} candidates', it.used || 0);
      var name = edit ? '<input type="text" value="' + esc(it.name) + '" data-change="list-rename" data-list="' + type + '" data-id="' + esc(it.id) + '" aria-label="' + esc(t('Rename')) + '">'
        : '<span style="padding:0 6px">' + esc(it.name) + '</span>';
      var tools = edit ? '<button class="btn xs" data-action="list-toggle" data-list="' + type + '" data-id="' + esc(it.id) + '">' + esc(it.active ? t('Deactivate') : t('Activate')) + '</button>' +
        '<button class="icon-btn" data-action="list-move" data-list="' + type + '" data-id="' + esc(it.id) + '" data-d="-1" aria-label="' + esc(t('Move up')) + '"' + (k === 0 ? ' disabled' : '') + '>' + icon('arrowUp', 'sm') + '</button>' +
        '<button class="icon-btn" data-action="list-move" data-list="' + type + '" data-id="' + esc(it.id) + '" data-d="1" aria-label="' + esc(t('Move down')) + '"' + (k === items.length - 1 ? ' disabled' : '') + '>' + icon('arrowDown', 'sm') + '</button>' +
        '<button class="icon-btn" data-action="list-delete" data-list="' + type + '" data-id="' + esc(it.id) + '" aria-label="' + esc(t('Delete')) + '" data-tip="' + esc(t('Delete (only possible if no candidate uses it)')) + '">' + icon('trash', 'sm') + '</button>' : '';
      return '<div class="el-row"' + (it.active ? '' : ' style="background:var(--surface-2)"') + '><div class="grow">' + name + '</div>' +
        (it.active ? '' : ui.badge(t('Inactive'), 'amber')) +
        '<span class="small muted nowrap">' + esc(usage) + '</span>' + tools + '</div>';
    }).join('');
    return '<div class="editable-list">' + (rows || '<div class="el-row"><span class="small muted">' + esc(t('No entries yet.')) + '</span></div>') + '</div>' +
      (edit ? '<div class="add-row"><input type="text" id="add-' + type + '" placeholder="' + esc(t(LISTS[type].placeholder)) + '" data-enter="list-add" data-list="' + type + '">' +
        '<button class="btn" data-action="list-add" data-list="' + type + '">' + icon('plus', 'sm') + esc(t('Add')) + '</button></div>' +
        '<p class="small muted mt-8">' + esc(t('Inactive entries are hidden from selection lists; candidates already assigned keep their value.')) + '</p>' : readOnlyNote());
  }

  /* ------------------------------------------------------------ 6. Targets */
  function targetRows() {
    if (!targetsDirty) targetsDraft = (S.settings().targets || []).map(function (x) { return { project: x.project, station: x.station || '', required: x.required }; });
    return targetsDraft;
  }
  function targetsSection(s) {
    var rows = targetRows(), edit = can('settings.write');
    var body;
    if (!edit) {
      body = rows.length ? '<table class="data compact static"><thead><tr><th>' + esc(t('Project')) + '</th><th>' + esc(t('Station')) + '</th><th class="center">' + esc(t('Required drivers')) + '</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + esc(r.project) + '</td><td>' + (r.station ? esc(r.station) : esc(t('All stations'))) + '</td><td class="center">' + esc(r.required) + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<p class="small muted">' + esc(t('No targets defined.')) + '</p>';
      return body + readOnlyNote();
    }
    body = '<table class="data compact static"><thead><tr><th>' + esc(t('Project')) + '</th><th>' + esc(t('Station')) + '</th><th style="width:150px">' + esc(t('Required drivers')) + '</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r, i) {
        return '<tr><td><select data-change="target-field" data-i="' + i + '" data-f="project" aria-label="' + esc(t('Project')) + '">' + ui.options(s.projects, r.project) + '</select></td>' +
          '<td><select data-change="target-field" data-i="' + i + '" data-f="station" aria-label="' + esc(t('Station')) + '">' + ui.options(s.stations, r.station, { blank: 'All stations' }) + '</select></td>' +
          '<td><input type="number" min="0" max="10000" value="' + esc(r.required) + '" data-change="target-field" data-i="' + i + '" data-f="required" aria-label="' + esc(t('Required drivers')) + '"></td>' +
          '<td class="actions-cell"><button class="icon-btn" data-action="target-remove" data-i="' + i + '" aria-label="' + esc(t('Remove')) + '">' + icon('trash', 'sm') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted small">' + esc(t('No targets defined.')) + '</td></tr>') + '</tbody></table>' +
      '<div class="row wrap mt-8"><button class="btn" data-action="target-add">' + icon('plus', 'sm') + esc(t('Add target')) + '</button><span style="flex:1"></span>' +
      (targetsDirty ? '<span class="small muted">' + esc(t('Unsaved changes')) + '</span><button class="btn ghost" data-action="target-discard">' + esc(t('Discard')) + '</button>' : '') +
      '<button class="btn primary" data-action="target-save"' + (targetsDirty ? '' : ' disabled') + '>' + icon('check', 'sm') + esc(t('Save targets')) + '</button></div>';
    return body + '<p class="small muted mt-8">' + esc(t('A project-wide target (All stations) counts for the whole project; station targets show progress per station.')) + '</p>';
  }

  /* ------------------------------------------------------------ 7. Documents */
  function activeDocs() { return (S.settings().allDocuments || []).filter(function (d) { return d.active !== false; }); }
  function docsSection() {
    var docs = activeDocs(), edit = can('settings.write');
    var dis = edit ? '' : ' disabled';
    var rows = docs.map(function (d, k) {
      return '<div class="el-row"><div class="grow">' + (edit ? '<input type="text" value="' + esc(d.label) + '" data-change="doc-def-label" data-i="' + k + '" aria-label="' + esc(t('Document name')) + '">' : '<span style="padding:0 6px">' + esc(t(d.label)) + '</span>') + '</div>' +
        '<label class="check-inline small" data-tip="' + esc(t('New candidates start with this document as Missing. Otherwise Not Required.')) + '"><input type="checkbox" ' + (d.required ? 'checked' : '') + dis + ' data-change="doc-def-toggle" data-i="' + k + '" data-f="required"> ' + esc(t('Required by default')) + '</label>' +
        '<label class="check-inline small" data-tip="' + esc(t('Track issue and expiry dates')) + '"><input type="checkbox" ' + (d.expiry ? 'checked' : '') + dis + ' data-change="doc-def-toggle" data-i="' + k + '" data-f="expiry"> ' + esc(t('Expiry dates')) + '</label>' +
        (d.builtin ? '<span class="icon-btn" style="cursor:default" data-tip="' + esc(t('Built-in document')) + '">' + icon('lock', 'sm') + '</span>'
          : edit ? '<button class="icon-btn" data-action="doc-def-remove" data-i="' + k + '" aria-label="' + esc(t('Remove')) + '">' + icon('trash', 'sm') + '</button>' : '<span class="icon-btn" style="cursor:default"></span>') + '</div>';
    }).join('');
    return '<div class="editable-list">' + rows + '</div>' +
      (edit ? '<div class="add-row"><input type="text" id="add-doc" placeholder="' + esc(t('Add custom document, e.g. Fahrerkarte')) + '" data-enter="doc-def-add"><button class="btn" data-action="doc-def-add">' + icon('plus', 'sm') + esc(t('Add')) + '</button></div>' : '') +
      '<p class="small muted mt-8">' + esc(t('Residence and work permits depend on the candidate and can always be set to "Not Required" on the candidate\'s Documents tab. "Required by default" only affects newly created candidates.')) + '</p>' +
      (edit ? '' : readOnlyNote());
  }

  /* ------------------------------------------------------------ 8. Onboarding */
  function activeSteps() { return (S.settings().allOnboardingSteps || []).filter(function (x) { return x.active !== false; }); }
  function onboardingSection() {
    var steps = activeSteps(), edit = can('settings.write');
    var rows = steps.map(function (st, k) {
      var auto = st.auto ? '<span class="auto-tag" data-tip="' + esc(st.auto === 'documents' ? t('Completed automatically from document checklist') : t('Completed automatically from contract status')) + '">' + esc(t('Auto')) + '</span>' : '';
      if (!edit) return '<div class="el-row"><span class="muted small" style="width:18px">' + (k + 1) + '.</span><div class="grow"><span style="padding:0 6px">' + esc(t(st.label)) + '</span></div>' + auto + '</div>';
      return '<div class="el-row"><span class="muted small" style="width:18px">' + (k + 1) + '.</span><div class="grow"><input type="text" value="' + esc(st.label) + '" data-change="ob-def-label" data-i="' + k + '" aria-label="' + esc(t('Step name')) + '"></div>' + auto +
        '<button class="icon-btn" data-action="ob-def-move" data-i="' + k + '" data-d="-1" aria-label="' + esc(t('Move up')) + '"' + (k === 0 ? ' disabled' : '') + '>' + icon('arrowUp', 'sm') + '</button>' +
        '<button class="icon-btn" data-action="ob-def-move" data-i="' + k + '" data-d="1" aria-label="' + esc(t('Move down')) + '"' + (k === steps.length - 1 ? ' disabled' : '') + '>' + icon('arrowDown', 'sm') + '</button>' +
        (st.auto ? '<span class="icon-btn" style="cursor:default"></span>' : '<button class="icon-btn" data-action="ob-def-remove" data-i="' + k + '" aria-label="' + esc(t('Remove')) + '">' + icon('trash', 'sm') + '</button>') + '</div>';
    }).join('');
    return '<div class="editable-list">' + rows + '</div>' +
      (edit ? '<div class="add-row"><input type="text" id="add-ob" placeholder="' + esc(t('Add onboarding step, e.g. Fuel card issued')) + '" data-enter="ob-def-add"><button class="btn" data-action="ob-def-add">' + icon('plus', 'sm') + esc(t('Add step')) + '</button></div>' +
        '<div class="row mt-8"><button class="btn xs ghost" data-action="ob-def-reset">' + icon('restore', 'sm') + esc(t('Reset to default steps')) + '</button></div>' : readOnlyNote());
  }

  /* ------------------------------------------------------------ 9. Backups */
  function backupStatus(b) {
    var ok = b.lastStatus !== 'failed' && !!b.lastSuccess;
    var c = b.config || {};
    /* i18n: t('Success') t('Failed') */
    return '<div class="backup-status" style="align-items:flex-start;' + (ok ? 'border-color:var(--green-bd);background:var(--green-bg)' : 'border-color:var(--amber-bd);background:var(--amber-bg)') + '">' + icon('database', 'lg') +
      '<dl class="dl" style="flex:1;grid-template-columns:220px 1fr">' +
      '<dt>' + esc(t('Last successful backup')) + '</dt><dd>' + (b.lastSuccess ? esc(U.fmtDateTime(b.lastSuccess.finished_at)) + '<div class="small muted mono">' + esc(b.lastSuccess.file_name) + '</div>' : esc(t('Never'))) + '</dd>' +
      '<dt>' + esc(t('Backup status')) + '</dt><dd>' + (b.lastStatus ? (b.lastStatus === 'failed' ? ui.badge(t('Failed'), 'red', 'xCircle') : ui.badge(t('Success'), 'green', 'checkCircle')) : '<span class="muted">—</span>') +
      (b.lastStatus === 'failed' && b.lastMessage ? '<div class="small" style="color:var(--red);margin-top:4px">' + esc(b.lastMessage) + '</div>' : '') + '</dd>' +
      '<dt>' + esc(t('Next scheduled backup')) + '</dt><dd>' + (c.enabled && b.nextScheduled ? dt(b.nextScheduled) : esc(t('Automatic backups are disabled'))) + '</dd>' +
      '<dt>' + esc(t('Automatic backups')) + '</dt><dd>' + (c.enabled ? ui.badge(t('Enabled'), 'green') + ' <span class="small muted">' + esc(t('daily at {0} ({1})', c.time, c.timezone)) + '</span>' : ui.badge(t('Disabled'), 'amber')) + '</dd>' +
      '<dt>' + esc(t('Storage location')) + '</dt><dd class="mono">' + esc(c.location) + '</dd>' +
      '<dt>' + esc(t('Retention')) + '</dt><dd>' + esc(t('{0} daily, {1} weekly, {2} monthly', c.keepDaily, c.keepWeekly, c.keepMonthly)) + '</dd></dl></div>';
  }
  function backupFiles(b) {
    if (!b.files.length) return '<p class="small muted">' + esc(t('No backup files yet.')) + '</p>';
    return '<div class="table-wrap" style="max-height:360px;min-height:0"><table class="data compact static"><thead><tr><th>' + esc(t('Date / time')) + '</th><th>' + esc(t('Type')) + '</th><th>' + esc(t('Size')) + '</th><th>' + esc(t('File')) + '</th><th></th></tr></thead><tbody>' +
      b.files.map(function (f) {
        var n = esc(f.name);
        return '<tr><td>' + dt(f.createdAt) + '</td><td>' + ui.badge(t(KINDS[f.kind] || f.kind), f.kind === 'auto' ? 'blue' : '') + '</td><td>' + esc(fmtSize(f.size)) + '</td><td class="mono small">' + n + '</td>' +
          '<td class="actions-cell nowrap"><a class="icon-btn" href="/api/backups/' + encodeURIComponent(f.name) + '/download" download data-tip="' + esc(t('Download')) + '" aria-label="' + esc(t('Download')) + '">' + icon('download', 'sm') + '</a>' +
          '<button class="btn xs" data-action="backup-restore" data-name="' + n + '">' + icon('restore', 'sm') + esc(t('Restore')) + '</button>' +
          '<button class="icon-btn" data-action="backup-delete" data-name="' + n + '" aria-label="' + esc(t('Delete')) + '">' + icon('trash', 'sm') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function backupHistory(b) {
    var h = (b.history || []).slice(0, 10);
    if (!h.length) return '';
    return '<div class="section-title" style="margin-top:22px">' + esc(t('Backup history')) + '</div><div class="editable-list">' + h.map(function (x) {
      return '<div class="el-row small"><span class="nowrap">' + dt(x.finished_at || x.started_at) + '</span>' +
        (x.status === 'success' ? ui.badge(t('Success'), 'green') : ui.badge(t('Failed'), 'red')) + ui.badge(t(KINDS[x.kind] || x.kind), '') +
        '<div class="grow"><span class="mono">' + esc(x.file_name) + '</span>' + (x.status !== 'success' && x.message ? '<div style="color:var(--red)">' + esc(x.message) + '</div>' : '') + '</div>' +
        '<span class="muted nowrap">' + esc(x.created_by || '') + (x.size_bytes ? ' · ' + esc(fmtSize(Number(x.size_bytes))) : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function backupSection() {
    if (backupsError) return '<div class="banner red">' + icon('alert') + '<div class="grow">' + esc(backupsError) + '</div></div>';
    if (!backups) return '<p class="small muted">' + esc(t('Loading…')) + '</p>';
    var busy = backupBusy || !!backups.busy;
    return backupStatus(backups) +
      '<div class="row wrap mt-16"><button class="btn dark" data-action="backup-create"' + (busy ? ' disabled' : '') + '>' + icon('database', 'sm') + esc(busy ? t('Backup running…') : t('Create backup now')) + '</button>' +
      '<label class="btn file-btn">' + icon('upload', 'sm') + esc(t('Upload backup file')) + '<input type="file" accept=".gz,.tar.gz,application/gzip" data-change="backup-upload" aria-label="' + esc(t('Upload backup file')) + '"></label>' +
      '<button class="btn ghost" data-action="backup-reload">' + icon('restore', 'sm') + esc(t('Refresh')) + '</button></div>' +
      '<div class="section-title" style="margin-top:22px">' + esc(t('Backup files')) + '</div>' + backupFiles(backups) + backupHistory(backups) +
      '<div class="banner blue mt-16">' + icon('info') + '<div class="grow">' + esc(t('Backups contain the complete database and all uploaded files and are stored in the backup folder on the NAS. Copy them regularly to a second location outside the NAS as well (e.g. UGREEN backup app, USB drive or a second NAS) – a backup on the same device does not protect against device failure.')) + '</div></div>';
  }

  /* ------------------------------------------------------------ 10. Legacy import */
  function importSection() {
    return '<p class="small muted-2">' + esc(t('Import a JSON backup created with the previous offline (single-browser) version.')) + ' ' +
      esc(t('You will see a preview first. Duplicates are detected by name and phone number and skipped by default – nothing existing is overwritten.')) + '</p>' +
      '<label class="btn mt-8 file-btn">' + icon('upload', 'sm') + esc(t('Choose offline backup (.json)…')) + '<input type="file" accept=".json,application/json" data-change="legacy-file" aria-label="' + esc(t('Choose backup file')) + '"></label>';
  }

  /* ------------------------------------------------------------ 11. Data & privacy */
  function dataSection() {
    var archived = S.all().filter(function (c) { return c.archived; }).length;
    return '<dl class="dl" style="grid-template-columns:220px 1fr">' +
      '<dt>' + esc(t('Storage')) + '</dt><dd>' + esc(t('Central PostgreSQL database on the JARBOU NAS')) + '</dd>' +
      '<dt>' + esc(t('Candidates stored')) + '</dt><dd>' + esc(t('{0} ({1} archived)', S.count(), archived)) + '</dd>' +
      '<dt>' + esc(t('Application version')) + '</dt><dd>' + esc(t('JARBOU Recruiting Command Center v{0} NAS', J.auth.version || C.APP_VERSION)) + '</dd>' +
      '<dt>' + esc(t('Network')) + '</dt><dd>' + esc(t('Data is exchanged only with the JARBOU server on the NAS. No external services are used.')) + '</dd></dl>' +
      '<div class="banner blue mt-16">' + icon('shield') + '<div class="grow">' + t('This application contains personal data of candidates and employees. {0} Keep backup files in a secure, access-restricted location and delete data that is no longer needed (GDPR / DSGVO).', '<b>' + esc(t('Internal use only.')) + '</b>') + '</div></div>' +
      (can('export') ? '<div class="section-title mt-16">' + esc(t('Export')) + '</div><p class="small muted-2">' + esc(t('Export all candidates (including archive) for Excel or other tools.')) + '</p>' +
        '<div class="row wrap mt-8"><button class="btn" data-action="export-all" data-fmt="csv">' + icon('download', 'sm') + 'CSV</button><button class="btn" data-action="export-all" data-fmt="xlsx">' + icon('excel', 'sm') + esc(t('Excel (.xlsx)')) + '</button><button class="btn" data-action="export-all" data-fmt="json">' + icon('database', 'sm') + 'JSON</button></div>' : '');
  }

  /* ------------------------------------------------------------ view */
  function loadUsers() {
    if (usersLoading) return;
    usersLoading = true;
    J.api.get('/api/users').then(function (list) { users = list; usersError = ''; }, function (err) { usersError = J.api.message(err); })
      .then(function () { usersLoading = false; rerender(); });
  }
  function loadBackups() {
    if (backupsLoading) return;
    backupsLoading = true;
    J.api.get('/api/backups').then(function (b) { backups = b; backupsError = ''; }, function (err) { backupsError = J.api.message(err); })
      .then(function () { backupsLoading = false; rerender(); });
  }

  J.views.settings = {
    onEnter: function (p) {
      scrollTo = p && p.section ? p.section : '';
      users = null; usersError = ''; backups = null; backupsError = '';
      targetsDirty = false;
    },
    mount: function (root) {
      if (scrollTo) {
        // Users/backups load asynchronously and change the page height – re-apply the jump a few times.
        var target = scrollTo;
        scrollTo = '';
        [30, 700, 1600].forEach(function (ms) {
          setTimeout(function () { var el = document.getElementById('set-' + target); if (el) el.scrollIntoView({ block: 'start' }); }, ms);
        });
      }
      root.querySelectorAll('[data-enter]').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); A[inp.getAttribute('data-enter')](inp); } });
      });
      if (can('users.manage') && !users && !usersError) loadUsers();
      if (can('backup.manage') && !backups && !backupsError) loadBackups();
    },
    render: function () {
      var s = S.settings();
      /* i18n: t('General') t('My preferences') t('My account') t('Users') t('Projects') t('Stations') t('Positions') t('Recruitment Sources')
         t('Recruitment Targets') t('Document Requirements') t('Onboarding Checklist') t('Backups') t('Import offline backup') t('Data & Privacy') */
      var nav = [['general', 'General', 1], ['prefs', 'My preferences', 1], ['account', 'My account', 1], ['users', 'Users', can('users.manage')],
        ['projects', 'Projects', 1], ['stations', 'Stations', 1], ['positions', 'Positions', 1], ['sources', 'Recruitment Sources', 1],
        ['targets', 'Recruitment Targets', 1], ['documents', 'Document Requirements', 1], ['onboarding', 'Onboarding Checklist', 1],
        ['backup', 'Backups', can('backup.manage')], ['import', 'Import offline backup', can('import')], ['data', 'Data & Privacy', 1]]
        .filter(function (n) { return n[2]; });
      var usersHead = '<button class="btn primary sm" data-action="settings-user-create">' + icon('plus', 'sm') + esc(t('Create user')) + '</button>';

      return '<div class="page-head" id="settings-root"><div><h1>' + esc(t('Settings')) + '</h1><div class="sub">' + esc(can('settings.write') ? t('Configure the recruiting system. Shared settings apply to all users and are saved immediately.') : t('Your personal preferences and account. Shared settings can only be changed by administrators.')) + '</div></div></div>' +
        '<div class="settings-layout"><nav class="settings-nav">' + nav.map(function (n) { return '<a href="#" data-action="settings-jump" data-s="' + n[0] + '">' + esc(t(n[1])) + '</a>'; }).join('') + '</nav><div>' +
        section('general', t('General'), t('Company, target and defaults'), generalSection(s)) +
        section('prefs', t('My preferences'), t('Only affects your own account'), prefsSection(s)) +
        section('account', t('My account'), '', accountSection()) +
        (can('users.manage') ? section('users', t('Users'), t('Who can sign in and what they are allowed to do'), usersSection(), usersHead) : '') +
        Object.keys(LISTS).map(function (k) { return section(k, t(LISTS[k].title), t(LISTS[k].help), listSection(k)); }).join('') +
        section('targets', t('Recruitment Targets'), t('Required drivers per project and station'), targetsSection(s)) +
        section('documents', t('Document Requirements'), t('Documents tracked for every candidate'), docsSection()) +
        section('onboarding', t('Onboarding Checklist'), t('Steps shown on every candidate\'s onboarding checklist'), onboardingSection()) +
        (can('backup.manage') ? section('backup', t('Backups'), t('Automatic and manual backups of the central database on the NAS'), backupSection()) : '') +
        (can('import') ? section('import', t('Import offline backup'), t('Move data from the previous single-browser version'), importSection()) : '') +
        section('data', t('Data & Privacy'), '', dataSection()) +
        '</div></div>';
    }
  };

  A['settings-jump'] = function (el) { var target = document.getElementById('set-' + el.getAttribute('data-s')); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  A['settings-password'] = function () { J.auth.passwordDialog(false); };

  /* ------------------------------------------------------------ General (shared scalar settings) */
  A['set-setting'] = function (el) {
    if (!can('settings.write')) return;
    var k = el.getAttribute('data-k'), type = el.getAttribute('data-type');
    var v = el.value;
    if (type === 'int' || type === 'num') {
      var n = U.num(v);
      if (n === null || n < 0) { el.classList.add('invalid'); ui.toast(t('Please enter a valid number.'), 'error'); return; }
      v = type === 'int' ? Math.round(n) : n;
    }
    if (k === 'companyName' && !String(v).trim()) { el.classList.add('invalid'); ui.toast(t('Company name cannot be empty.'), 'error'); return; }
    if (k === 'idPrefix') v = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'JRB';
    if (typeof v === 'string') v = v.trim();
    var body = {}; body[k] = v;
    J.api.put('/api/settings', body).then(function (r) { accept(r, t('Settings saved.')); }, function (err) { fail(err); J.app.rerenderView(); });
  };

  /* ------------------------------------------------------------ Users */
  function findUser(id) { return (users || []).filter(function (u) { return u.id === id; })[0]; }
  function afterUserChange(msg) {
    if (msg) ui.toast(msg);
    users = null;
    loadUsers();
    S.reloadSettings().then(function () { J.app.refresh(); }).catch(function () {});
  }

  function roleField(selected) {
    var r = ROLES.filter(function (x) { return x.key === selected; })[0] || ROLES[1];
    return '<div class="field span-3"><label for="uf-role">' + esc(t('Role')) + '</label><select id="uf-role">' + ui.options(ROLES, selected) + '</select>' +
      '<div class="help" id="uf-role-help">' + esc(t(r.desc)) + '</div></div>';
  }
  function bindRoleHelp(m) {
    m.q('#uf-role').addEventListener('change', function (e) {
      var r = ROLES.filter(function (x) { return x.key === e.target.value; })[0];
      m.q('#uf-role-help').textContent = r ? t(r.desc) : '';
    });
  }

  /** Create (u = undefined) or edit a user. */
  function userDialog(u) {
    var isNew = !u;
    u = u || { fullName: '', username: '', email: '', role: 'recruiter' };
    var m = ui.modal({
      title: isNew ? t('Create user') : t('Edit user'),
      subtitle: isNew ? '' : esc(u.username),
      body: '<form id="uf-form" class="fgrid two" novalidate autocomplete="off">' +
        '<div class="field"><label for="uf-name">' + esc(t('Full name')) + '</label><input id="uf-name" type="text" maxlength="120" value="' + esc(u.fullName) + '" autofocus></div>' +
        '<div class="field"><label for="uf-user">' + esc(t('Username')) + '</label><input id="uf-user" type="text" maxlength="60" autocomplete="off" value="' + esc(u.username) + '"></div>' +
        '<div class="field span-3"><label for="uf-email">' + esc(t('Email')) + '</label><input id="uf-email" type="email" maxlength="200" value="' + esc(u.email) + '"></div>' +
        roleField(u.role) +
        (isNew ? '<div class="field span-3"><label for="uf-pw">' + esc(t('Initial password')) + '</label><div class="inline-pair"><input id="uf-pw" type="password" autocomplete="new-password">' +
          '<button type="button" class="btn" id="uf-pw-toggle">' + esc(t('Show')) + '</button></div>' +
          '<div class="help">' + esc(t('At least 10 characters with letters and numbers. The user must change it at first sign-in.')) + '</div></div>' : '') +
        '<div class="field span-3"><div class="err" id="uf-err"></div></div><button type="submit" hidden></button></form>',
      foot: '<button class="btn" data-close>' + esc(t('Cancel')) + '</button><button class="btn primary" id="uf-save">' + esc(isNew ? t('Create user') : t('Save')) + '</button>'
    });
    bindRoleHelp(m);
    if (isNew) {
      m.q('#uf-pw-toggle').addEventListener('click', function (e) {
        var inp = m.q('#uf-pw'), show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        e.target.textContent = show ? t('Hide') : t('Show');
      });
    }
    var submit = function (e) {
      if (e) e.preventDefault();
      var body = { fullName: m.q('#uf-name').value.trim(), username: m.q('#uf-user').value.trim(), email: m.q('#uf-email').value.trim(), role: m.q('#uf-role').value };
      var err = m.q('#uf-err');
      if (!body.fullName || !body.username) { err.textContent = t('Please enter full name and username.'); return; }
      if (isNew) body.password = m.q('#uf-pw').value;
      var req = isNew ? J.api.post('/api/users', body) : J.api.patch('/api/users/' + encodeURIComponent(u.id), body);
      m.q('#uf-save').disabled = true;
      req.then(function () {
        m.close();
        if (!isNew && J.auth.user && u.id === J.auth.user.id) { J.auth.user.fullName = body.fullName; J.auth.user.email = body.email; J.auth.user.username = body.username; }
        afterUserChange(isNew ? t('User "{0}" created. They must change the password at first sign-in.', body.username) : t('User "{0}" updated.', body.username));
      }, function (e2) { m.q('#uf-save').disabled = false; err.textContent = J.api.message(e2); ui.toast(J.api.message(e2), 'error'); });
    };
    m.q('#uf-form').addEventListener('submit', submit);
    m.q('#uf-save').addEventListener('click', submit);
  }

  function setActive(u, active) {
    var msg = active ? esc(t('{0} will be able to sign in again.', u.fullName))
      : esc(t('{0} will be signed out immediately and can no longer sign in. Their history and assigned candidates are kept. You can reactivate the account at any time.', u.fullName));
    ui.confirm({ title: active ? t('Reactivate user "{0}"?', u.username) : t('Deactivate user "{0}"?', u.username), message: msg, ok: active ? t('Reactivate') : t('Deactivate'), danger: !active }).then(function (ok) {
      if (!ok) return;
      J.api.patch('/api/users/' + encodeURIComponent(u.id), { active: active }).then(function () {
        afterUserChange(active ? t('User "{0}" reactivated.', u.username) : t('User "{0}" deactivated and signed out.', u.username));
      }, fail);
    });
  }

  function showTempPassword(u, pw) {
    var m = ui.modal({
      title: t('Temporary password'),
      subtitle: esc(u.fullName + ' (' + u.username + ')'),
      sticky: true,
      body: '<p class="small muted-2">' + esc(t('This password is shown only once. Pass it on to the user in a secure way.')) + '</p>' +
        '<div class="row mt-12"><input type="text" id="tp-value" class="mono" readonly value="' + esc(pw) + '" style="flex:1;font-size:15px">' +
        '<button class="btn" id="tp-copy">' + icon('copy', 'sm') + esc(t('Copy')) + '</button></div>' +
        '<div class="banner amber mt-16" style="margin-bottom:0">' + icon('alert') + '<div class="grow">' + esc(t('The user must change this password at the next sign-in.')) + '</div></div>',
      foot: '<button class="btn primary" data-close>' + esc(t('Done')) + '</button>'
    });
    m.q('#tp-copy').addEventListener('click', function () {
      U.copy(pw).then(function (ok) { ui.toast(ok ? t('Copied to clipboard.') : t('Could not copy – please select and copy manually.'), ok ? 'success' : 'warn'); });
    });
    m.q('#tp-value').addEventListener('focus', function (e) { e.target.select(); });
  }

  function resetPassword(u) {
    var m = ui.modal({
      title: t('Reset password'),
      subtitle: esc(u.fullName + ' (' + u.username + ')'),
      body: '<div class="field"><label for="rp-pw">' + esc(t('New password (optional)')) + '</label><input id="rp-pw" type="text" autocomplete="off">' +
        '<div class="help">' + esc(t('Leave empty to generate a secure temporary password. The user must change it at the next sign-in; all their sessions are ended.')) + '</div><div class="err" id="rp-err"></div></div>',
      foot: '<button class="btn" data-close>' + esc(t('Cancel')) + '</button><button class="btn primary" id="rp-ok">' + esc(t('Reset password')) + '</button>'
    });
    m.q('#rp-ok').addEventListener('click', function () {
      var pw = m.q('#rp-pw').value;
      m.q('#rp-ok').disabled = true;
      J.api.post('/api/users/' + encodeURIComponent(u.id) + '/reset-password', pw ? { password: pw } : {}).then(function (r) {
        m.close();
        afterUserChange(t('Password for "{0}" reset.', u.username));
        if (r && r.temporaryPassword) showTempPassword(u, r.temporaryPassword);
      }, function (err) { m.q('#rp-ok').disabled = false; m.q('#rp-err').textContent = J.api.message(err); ui.toast(J.api.message(err), 'error'); });
    });
  }

  function revokeSessions(u) {
    ui.confirm({ title: t('Sign out "{0}" everywhere?', u.username), message: esc(t('All active sessions of this user are ended. The user can sign in again with their password.')), ok: t('Revoke sessions') }).then(function (ok) {
      if (!ok) return;
      J.api.post('/api/users/' + encodeURIComponent(u.id) + '/revoke-sessions', {}).then(function () { afterUserChange(t('Sessions of "{0}" revoked.', u.username)); }, fail);
    });
  }

  A['settings-user-create'] = function () { userDialog(); };
  A['settings-user-menu'] = function (el) {
    var u = findUser(el.getAttribute('data-id'));
    if (!u) return;
    var self = J.auth.user && J.auth.user.id === u.id;
    var items = [
      { label: t('Edit'), icon: 'edit', onClick: function () { userDialog(u); } },
      { label: t('Reset password'), icon: 'lock', onClick: function () { resetPassword(u); } },
      { label: t('Revoke sessions'), icon: 'x', onClick: function () { revokeSessions(u); } }
    ];
    if (!self) items.push({ sep: true }, u.active ? { label: t('Deactivate'), icon: 'xCircle', danger: true, onClick: function () { setActive(u, false); } }
      : { label: t('Reactivate'), icon: 'checkCircle', onClick: function () { setActive(u, true); } });
    ui.menu(el, items);
  };

  /* ------------------------------------------------------------ Lists */
  function listUrl(el) { return '/api/settings/lists/' + el.getAttribute('data-list') + '/' + encodeURIComponent(el.getAttribute('data-id')); }
  function listItem(el) {
    var items = (S.settings().lists || {})[el.getAttribute('data-list')] || [];
    return items.filter(function (x) { return String(x.id) === el.getAttribute('data-id'); })[0];
  }
  A['list-add'] = function (el) {
    var key = el.getAttribute('data-list');
    var inp = document.getElementById('add-' + key), v = inp.value.trim();
    if (!v) { inp.classList.add('invalid'); inp.focus(); return; }
    J.api.post('/api/settings/lists/' + key, { name: v }).then(function (r) {
      accept(r, t('"{0}" added to {1}.', v, t(LISTS[key].title)));
      var n = document.getElementById('add-' + key); if (n) n.focus();
    }, fail);
  };
  A['list-rename'] = function (el) {
    var it = listItem(el), v = el.value.trim();
    if (!it) return;
    if (!v || v === it.name) { el.value = it.name; return; }
    J.api.patch(listUrl(el), { name: v }).then(function (r) {
      accept(r, it.used ? t('Renamed to "{0}" – {1} candidate(s) updated.', v, it.used) : t('Renamed to "{0}".', v));
      S.sync(true).catch(function () {});
    }, function (err) { fail(err); el.value = it.name; });
  };
  A['list-toggle'] = function (el) {
    var it = listItem(el);
    if (!it) return;
    J.api.patch(listUrl(el), { active: !it.active }).then(function (r) {
      accept(r, it.active ? t('"{0}" deactivated – hidden from selection lists.', it.name) : t('"{0}" activated.', it.name));
    }, fail);
  };
  A['list-move'] = function (el) {
    J.api.patch(listUrl(el), { move: +el.getAttribute('data-d') }).then(function (r) { accept(r); }, fail);
  };
  A['list-delete'] = function (el) {
    var it = listItem(el);
    if (!it) return;
    ui.confirm({ title: t('Delete "{0}"?', it.name), message: esc(t('The entry is removed permanently. This is only possible if no candidate uses it.')), ok: t('Delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      J.api.del(listUrl(el)).then(function (r) { accept(r, t('"{0}" deleted.', it.name)); }, function (err) {
        if (err.status === 409) ui.toast(t('"{0}" is still used by candidates and cannot be deleted. Deactivate it instead – it disappears from selection lists and candidates keep their value.', it.name), 'warn');
        else fail(err);
      });
    });
  };

  /* ------------------------------------------------------------ Targets */
  function touchTargets() { targetRows(); targetsDirty = true; }
  A['target-field'] = function (el) {
    touchTargets();
    var r = targetsDraft[+el.getAttribute('data-i')], f = el.getAttribute('data-f');
    if (!r) return;
    r[f] = f === 'required' ? U.num(el.value) : el.value;
    J.app.rerenderView();
  };
  A['target-add'] = function () {
    var s = S.settings();
    touchTargets();
    targetsDraft.push({ project: s.activeProject && s.activeProject !== 'all' ? s.activeProject : (s.defaultProject || s.projects[0] || ''), station: '', required: 0 });
    J.app.rerenderView();
  };
  A['target-remove'] = function (el) { touchTargets(); targetsDraft.splice(+el.getAttribute('data-i'), 1); J.app.rerenderView(); };
  A['target-discard'] = function () { targetsDirty = false; J.app.rerenderView(); };
  A['target-save'] = function () {
    var rows = targetsDraft || [];
    var bad = rows.filter(function (r) { return !r.project || r.required === null || r.required === undefined || isNaN(r.required) || r.required < 0; });
    if (bad.length) { ui.toast(t('Please choose a project and enter a valid number of required drivers for every target.'), 'error'); return; }
    var body = rows.map(function (r) { return { project: r.project, station: r.station || '', required: Math.round(r.required) }; });
    J.api.put('/api/settings/targets', body).then(function (r) { targetsDirty = false; accept(r, t('Recruitment targets saved.')); }, fail);
  };

  /* ------------------------------------------------------------ Documents & onboarding (saved as a whole, in order) */
  function saveAll(url, build, mutate, msg) {
    queue = queue.then(function () {
      var arr = build();
      if (mutate(arr) === false) return null;
      return J.api.put(url, arr).then(function (r) { accept(r, msg); }, function (err) { fail(err); J.app.rerenderView(); });
    });
    return queue;
  }
  function docsPayload() { return activeDocs().map(function (d) { return { key: d.key, label: d.label, required: !!d.required, expiry: !!d.expiry }; }); }
  function saveDocs(mutate, msg) { return saveAll('/api/settings/documents', docsPayload, mutate, msg); }

  A['doc-def-label'] = function (el) {
    var i = +el.getAttribute('data-i'), v = el.value.trim();
    if (!v) { el.value = activeDocs()[i].label; return; }
    saveDocs(function (arr) { arr[i].label = v; }, t('Document renamed.'));
  };
  A['doc-def-toggle'] = function (el) {
    var i = +el.getAttribute('data-i'), f = el.getAttribute('data-f'), on = el.checked;
    saveDocs(function (arr) { arr[i][f] = on; }, t('Document requirement updated.'));
  };
  A['doc-def-add'] = function () {
    var inp = document.getElementById('add-doc'), v = inp.value.trim();
    if (!v) { inp.classList.add('invalid'); inp.focus(); return; }
    saveDocs(function (arr) { arr.push({ label: v, required: true, expiry: false }); }, t('Document "{0}" added. Existing candidates show it as Missing – set Not Required where applicable.', v));
  };
  A['doc-def-remove'] = function (el) {
    var i = +el.getAttribute('data-i'), d = activeDocs()[i];
    if (!d || d.builtin) return;
    ui.confirm({ title: t('Remove document "{0}"?', t(d.label)), message: esc(t('It will no longer be tracked or count towards completion. Stored statuses are kept in the database.')), ok: t('Remove'), danger: true }).then(function (ok) {
      if (!ok) return;
      saveDocs(function (arr) { arr.splice(i, 1); }, t('Document removed.'));
    });
  };

  function stepsPayload() { return activeSteps().map(function (x) { return { key: x.key, label: x.label }; }); }
  function saveSteps(mutate, msg) { return saveAll('/api/settings/onboarding', stepsPayload, mutate, msg); }

  A['ob-def-label'] = function (el) {
    var i = +el.getAttribute('data-i'), v = el.value.trim();
    if (!v) { el.value = activeSteps()[i].label; return; }
    saveSteps(function (arr) { arr[i].label = v; }, t('Step renamed.'));
  };
  A['ob-def-move'] = function (el) {
    var i = +el.getAttribute('data-i'), d = +el.getAttribute('data-d');
    saveSteps(function (arr) {
      if (i + d < 0 || i + d >= arr.length) return false;
      var tmp = arr[i]; arr[i] = arr[i + d]; arr[i + d] = tmp;
    });
  };
  A['ob-def-remove'] = function (el) {
    var i = +el.getAttribute('data-i'), st = activeSteps()[i];
    if (!st || st.auto) return;
    ui.confirm({ title: t('Remove step "{0}"?', t(st.label)), message: esc(t('The step is removed from all onboarding checklists. Existing ticks are kept in the database and reappear if you re-add the default steps.')), ok: t('Remove'), danger: true }).then(function (ok) {
      if (!ok) return;
      saveSteps(function (arr) { arr.splice(i, 1); }, t('Onboarding step removed.'));
    });
  };
  A['ob-def-add'] = function () {
    var inp = document.getElementById('add-ob'), v = inp.value.trim();
    if (!v) { inp.classList.add('invalid'); inp.focus(); return; }
    saveSteps(function (arr) { arr.push({ label: v }); }, t('Step "{0}" added.', v));
  };
  A['ob-def-reset'] = function () {
    ui.confirm({ title: t('Reset onboarding steps?'), message: esc(t('Custom steps will be removed and the default steps restored.')), ok: t('Reset') }).then(function (ok) {
      if (!ok) return;
      saveSteps(function (arr) {
        arr.length = 0;
        C.DEFAULT_ONBOARDING.forEach(function (x) { arr.push({ key: x.key, label: x.label }); });
      }, t('Onboarding steps reset.'));
    });
  };

  /* ------------------------------------------------------------ Backups */
  A['backup-reload'] = function () { backups = null; loadBackups(); };
  A['backup-create'] = function () {
    if (backupBusy) return;
    backupBusy = true;
    rerender();
    J.io.serverBackup().then(function () { backupBusy = false; loadBackups(); });
  };
  A['backup-upload'] = function (el) {
    var f = el.files && el.files[0];
    el.value = '';
    if (!f) return;
    var fd = new FormData();
    fd.append('file', f);
    ui.toast(t('Uploading backup file…'), 'info');
    J.api.request('POST', '/api/backups/upload', fd).then(function (r) {
      ui.toast(t('Backup file uploaded: {0}', r.name));
      loadBackups();
    }, fail);
  };
  A['backup-delete'] = function (el) {
    var name = el.getAttribute('data-name');
    ui.confirm({ title: t('Delete backup file?'), message: esc(t('The file {0} is deleted permanently from the NAS.', name)), ok: t('Delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      J.api.del('/api/backups/' + encodeURIComponent(name)).then(function () { ui.toast(t('Backup file deleted.')); loadBackups(); }, fail);
    });
  };
  A['backup-restore'] = function (el) {
    var name = el.getAttribute('data-name');
    J.api.get('/api/backups/' + encodeURIComponent(name) + '/manifest').then(function (man) { restoreDialog(name, man || {}); }, fail);
  };

  function restoreDialog(name, man) {
    var counts = man.counts || {};
    var m = ui.modal({
      title: t('Restore backup'),
      subtitle: '<span class="mono">' + esc(name) + '</span>',
      body: '<div class="banner red">' + icon('alert') + '<div class="grow"><b>' + esc(t('WARNING: Restoring this backup will replace the current recruitment database.')) + '</b></div></div>' +
        '<dl class="dl"><dt>' + esc(t('Backup created')) + '</dt><dd>' + dt(man.createdAt) + '</dd>' +
        '<dt>' + esc(t('Application version')) + '</dt><dd>' + ui.val(man.appVersion) + '</dd>' +
        '<dt>' + esc(t('Candidates')) + '</dt><dd>' + ui.val(counts.candidates) + '</dd>' +
        '<dt>' + esc(t('Users')) + '</dt><dd>' + ui.val(counts.users) + '</dd>' +
        '<dt>' + esc(t('Attachments')) + '</dt><dd>' + ui.val(counts.attachments) + '</dd></dl>' +
        '<p class="small muted-2 mt-12">' + esc(t('A safety backup of the current data is created automatically first. After the restore ALL users – including you – are signed out and must sign in again.')) + '</p>' +
        '<div class="field mt-16"><label for="rs-type">' + t('Type {0} to confirm', '<b>RESTORE</b>') + '</label><input type="text" id="rs-type" autocomplete="off"></div>',
      foot: '<button class="btn" data-close>' + esc(t('Cancel')) + '</button><button class="btn danger" id="rs-ok" disabled>' + icon('restore', 'sm') + esc(t('Restore backup')) + '</button>'
    });
    m.q('#rs-type').addEventListener('input', function (e) { m.q('#rs-ok').disabled = e.target.value.trim() !== 'RESTORE'; });
    m.q('#rs-ok').addEventListener('click', function () {
      var btn = m.q('#rs-ok');
      btn.disabled = true;
      btn.textContent = t('Restoring… please wait');
      J.api.post('/api/backups/' + encodeURIComponent(name) + '/restore', { confirm: 'RESTORE' }, { noRedirect: true }).then(function () {
        m.close();
        ui.modal({
          title: t('Backup restored'), sticky: true,
          body: '<p>' + esc(t('The database was restored successfully. All users have been signed out. Please sign in again.')) + '</p>',
          foot: '<a class="btn primary" href="login.html">' + esc(t('Sign in again')) + '</a>'
        });
        setTimeout(function () { location.href = 'login.html'; }, 4000);
      }, function (err) { btn.disabled = false; btn.textContent = t('Restore backup'); fail(err); });
    });
  }

  /* ------------------------------------------------------------ Legacy import */
  A['legacy-file'] = function (el) {
    var f = el.files && el.files[0];
    el.value = '';
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { ui.toast(t('Could not read the file – it is not valid JSON.'), 'error'); return; }
      J.api.post('/api/import/legacy/preview', data).then(function (p) { previewDialog(f.name, p); }, fail);
    };
    reader.onerror = function () { ui.toast(t('Could not read the file.'), 'error'); };
    reader.readAsText(f);
  };

  /* i18n: t('same name') t('same phone number') */
  function previewRow(r) {
    var status = r.duplicateOf
      ? ui.badge(t('Duplicate of {0}', r.duplicateName + ' (' + r.duplicateOf + ')'), 'amber') + (r.reason ? ' <span class="small muted">' + esc(t(r.reason)) + '</span>' : '')
      : ui.badge(t('New'), 'green') + (r.newIdNeeded ? ' <span class="small muted">' + esc(t('new ID will be assigned')) + '</span>' : '');
    return '<tr><td class="mono">' + ui.val(r.legacyId) + '</td><td class="name-cell">' + esc(r.name) + (r.archived ? ' ' + ui.badge(t('Archived'), '') : '') + '</td>' +
      '<td>' + (r.startDate ? esc(U.fmtDate(r.startDate)) : '<span class="muted">—</span>') + '</td><td>' + status + '</td></tr>';
  }
  function createdLists(p) {
    var cl = p.createLists || {};
    /* i18n: t('Projects') t('Stations') t('Positions') t('Recruitment Sources') t('Documents') t('Onboarding steps') */
    var parts = [['Projects', cl.projects], ['Stations', cl.stations], ['Positions', cl.positions], ['Recruitment Sources', cl.sources],
      ['Documents', (p.newDocuments || []).map(function (d) { return d.label; })], ['Onboarding steps', (p.newOnboardingSteps || []).map(function (s) { return s.label; })]]
      .filter(function (x) { return x[1] && x[1].length; });
    if (!parts.length) return '<p class="small muted">' + esc(t('No new list entries are needed.')) + '</p>';
    return '<dl class="dl">' + parts.map(function (x) { return '<dt>' + esc(t(x[0])) + '</dt><dd>' + esc(x[1].join(', ')) + '</dd>'; }).join('') + '</dl>';
  }
  function previewDialog(fileName, p) {
    var rows = p.rows || [];
    var m = ui.modal({
      title: t('Import offline backup'),
      subtitle: esc(fileName),
      wide: true,
      body: '<dl class="dl"><dt>' + esc(t('Candidates in file')) + '</dt><dd>' + esc(p.total) + '</dd>' +
        '<dt>' + esc(t('Possible duplicates')) + '</dt><dd>' + esc(p.duplicates) + '</dd>' +
        '<dt>' + esc(t('Archived')) + '</dt><dd>' + esc(p.archived) + '</dd>' +
        '<dt>' + esc(t('Exported on')) + '</dt><dd>' + dt(p.exportedAt) + '</dd></dl>' +
        '<div class="table-wrap mt-16" style="max-height:300px;min-height:0"><table class="data compact static"><thead><tr><th>' + esc(t('Legacy ID')) + '</th><th>' + esc(t('Name')) + '</th><th>' + esc(t('Start date')) + '</th><th>' + esc(t('Status')) + '</th></tr></thead><tbody>' +
        rows.map(previewRow).join('') + '</tbody></table></div>' +
        '<div class="section-title mt-16">' + esc(t('Will be created')) + '</div>' + createdLists(p) +
        '<label class="check-inline mt-16"><input type="checkbox" id="imp-dups"> ' + esc(t('Also import duplicates')) + '</label>' +
        '<p class="small muted mt-8">' + esc(t('Duplicates are skipped by default. Nothing existing is overwritten – imported candidates are always added as new records.')) + '</p>',
      foot: '<button class="btn" data-close>' + esc(t('Cancel')) + '</button><button class="btn primary" id="imp-ok">' + icon('upload', 'sm') + esc(t('Import candidates')) + '</button>'
    });
    m.q('#imp-ok').addEventListener('click', function () {
      var btn = m.q('#imp-ok');
      btn.disabled = true;
      J.api.post('/api/import/legacy/commit', { token: p.token, includeDuplicates: m.q('#imp-dups').checked }).then(function (r) {
        m.close();
        importDone(r);
      }, function (err) { btn.disabled = false; fail(err); });
    });
  }
  function importDone(r) {
    ui.toast(t('Import finished: {0} imported, {1} skipped.', r.imported || 0, r.skipped || 0));
    ui.modal({
      title: t('Import finished'),
      body: '<dl class="dl"><dt>' + esc(t('Imported')) + '</dt><dd>' + esc(r.imported || 0) + '</dd><dt>' + esc(t('Skipped')) + '</dt><dd>' + esc(r.skipped || 0) + '</dd></dl>',
      foot: '<button class="btn primary" data-close>' + esc(t('OK')) + '</button>'
    });
    Promise.all([S.sync(true), S.reloadSettings()]).then(function () { J.app.refresh(); }, fail);
  }
})();
