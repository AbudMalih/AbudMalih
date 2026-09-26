/* Audit log (admins): append-only record of every change, sign-in, backup and settings change.
   Data is loaded page by page from the server (GET /api/audit); nothing here can be edited. */
(function () {
  'use strict';
  var J = window.J, U = J.util, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon, t = J.t;

  var LIMIT = 50;
  var EMPTY = { q: '', action: '', actor: '', from: '', to: '' };
  var f = U.clone(EMPTY);
  var offset = 0;
  var st = { data: null, loading: false, key: '', seq: 0 };

  /* i18n: t('Candidates') t('Follow-ups') t('Files') t('Users') t('Sign-ins') t('Settings') t('Backups') t('Import') */
  var GROUPS = [
    { key: 'candidate.', label: 'Candidates' }, { key: 'followup.', label: 'Follow-ups' }, { key: 'attachment.', label: 'Files' },
    { key: 'user.', label: 'Users' }, { key: 'auth.', label: 'Sign-ins' }, { key: 'settings.', label: 'Settings' },
    { key: 'backup.', label: 'Backups' }, { key: 'import.', label: 'Import' }
  ];

  /* i18n: t('Candidate created') t('Candidate edited') t('Pipeline stage changed') t('Candidate archived') t('Candidate restored') t('Candidate deleted permanently') t('Note added') t('Note deleted') t('Timeline entry deleted') t('Follow-up scheduled') t('Follow-up completed') t('File uploaded') t('File downloaded') t('File deleted') t('User created') t('User updated') t('User deactivated') t('User reactivated') t('Password reset') t('Password changed') t('Sessions signed out') t('Signed in') t('Signed out') t('Failed sign-in') t('Settings changed') t('List entry added') t('List entry changed') t('List entry removed') t('Document requirements changed') t('Onboarding checklist changed') t('Recruitment targets changed') t('Backup created') t('Backup restored') t('Backup uploaded') t('Backup downloaded') t('Backup deleted') t('Offline data imported') t('System initialised') */
  var ACTIONS = {
    'candidate.created': 'Candidate created', 'candidate.updated': 'Candidate edited', 'candidate.stage_changed': 'Pipeline stage changed',
    'candidate.archived': 'Candidate archived', 'candidate.restored': 'Candidate restored', 'candidate.deleted': 'Candidate deleted permanently',
    'candidate.note_added': 'Note added', 'candidate.note_deleted': 'Note deleted', 'candidate.activity_deleted': 'Timeline entry deleted',
    'followup.created': 'Follow-up scheduled', 'followup.completed': 'Follow-up completed',
    'attachment.uploaded': 'File uploaded', 'attachment.downloaded': 'File downloaded', 'attachment.deleted': 'File deleted',
    'user.created': 'User created', 'user.updated': 'User updated', 'user.deactivated': 'User deactivated', 'user.reactivated': 'User reactivated',
    'user.password_reset': 'Password reset', 'user.password_changed': 'Password changed', 'user.sessions_revoked': 'Sessions signed out',
    'auth.login': 'Signed in', 'auth.logout': 'Signed out', 'auth.login_failed': 'Failed sign-in',
    'settings.changed': 'Settings changed', 'settings.list_added': 'List entry added', 'settings.list_changed': 'List entry changed',
    'settings.list_removed': 'List entry removed', 'settings.documents_changed': 'Document requirements changed',
    'settings.onboarding_changed': 'Onboarding checklist changed', 'settings.targets_changed': 'Recruitment targets changed',
    'backup.created': 'Backup created', 'backup.restored': 'Backup restored', 'backup.uploaded': 'Backup uploaded',
    'backup.downloaded': 'Backup downloaded', 'backup.deleted': 'Backup deleted', 'import.legacy': 'Offline data imported',
    'system.initialized': 'System initialised'
  };
  function actionLabel(a) { return ACTIONS[a] ? t(ACTIONS[a]) : a; }
  function actionBadge(a) {
    var cls = /(deleted|login_failed|deactivated)$/.test(a) || a === 'backup.restored' ? 'red'
      : /^auth\./.test(a) ? '' : /^(backup|settings|user|import|system)\./.test(a) ? 'amber' : 'blue';
    return ui.badge(actionLabel(a), cls);
  }

  /* i18n: t('First Name') t('Family Name') t('Phone') t('Email') t('Date of Birth') t('Address') t('City') t('Nationality') t('Language') t('Project') t('Station') t('Position') t('Source') t('Recruiter') t('Employment Type') t('Planned Start Date') t('Tax Class') t('Salary Reference') t('Salary Basis') t('Minimum Salary Expectation') t('Maximum Salary Expectation') t('Hours per Week') t('Availability') t('Application Date') t('Interview Date') t('Interview Status') t('Pipeline Stage') t('Next Action') t('Notes') t('Last Contact') t('Ready Since') t('Started On') t('Archived') t('Archive Reason') t('Archive Date') t('Archive Note') t('Follow-up Date') t('Follow-up Note') t('Follow-up') t('Note') t('Timeline entry') t('Name') t('Active') t('Full Name') t('Username') t('Role') t('Company Name') t('Default Project') t('Default Station') t('Default Position') t('Target Position') t('Standard Salary Reference') t('Standard Salary Basis') t('Expiry Warning (days)') t('Contract Warning (days)') t('Candidate ID prefix') t('Targets') */
  var FIELDS = {
    firstName: 'First Name', lastName: 'Family Name', phone: 'Phone', email: 'Email', dob: 'Date of Birth', address: 'Address', city: 'City',
    nationality: 'Nationality', language: 'Language', project: 'Project', station: 'Station', position: 'Position', source: 'Source',
    recruiter: 'Recruiter', employmentType: 'Employment Type', startDate: 'Planned Start Date', taxClass: 'Tax Class',
    salaryReference: 'Salary Reference', salaryBasis: 'Salary Basis', salaryExpectationMin: 'Minimum Salary Expectation',
    salaryExpectationMax: 'Maximum Salary Expectation', hoursPerWeek: 'Hours per Week', availability: 'Availability',
    applicationDate: 'Application Date', interviewDate: 'Interview Date', interviewStatus: 'Interview Status', stage: 'Pipeline Stage',
    nextAction: 'Next Action', notes: 'Notes', lastContact: 'Last Contact', readySince: 'Ready Since', startedOn: 'Started On',
    archived: 'Archived', archiveReason: 'Archive Reason', archiveDate: 'Archive Date', archiveNote: 'Archive Note',
    followUpDate: 'Follow-up Date', followUpNote: 'Follow-up Note', followUp: 'Follow-up', note: 'Note', activity: 'Timeline entry',
    name: 'Name', active: 'Active', fullName: 'Full Name', full_name: 'Full Name', username: 'Username', role: 'Role',
    companyName: 'Company Name', defaultProject: 'Default Project', defaultStation: 'Default Station', defaultPosition: 'Default Position',
    targetPosition: 'Target Position', standardSalaryReference: 'Standard Salary Reference', standardSalaryBasis: 'Standard Salary Basis',
    expiryWarningDays: 'Expiry Warning (days)', contractWarningDays: 'Contract Warning (days)', idPrefix: 'Candidate ID prefix', targets: 'Targets'
  };
  /* i18n: t('Status') t('Issue Date') t('Expiry Date') t('Note') */
  var DOC_FIELDS = { status: 'Status', issueDate: 'Issue Date', expiryDate: 'Expiry Date', note: 'Note' };
  /* i18n: t('Contract Status') t('Contract Type') t('Contract Salary') t('Contract Hours') t('Contract Start') t('Contract End') t('Contract Signed On') t('Contract Note') */
  var CONTRACT_FIELDS = { status: 'Contract Status', type: 'Contract Type', salary: 'Contract Salary', hours: 'Contract Hours', startDate: 'Contract Start', endDate: 'Contract End', signedDate: 'Contract Signed On', note: 'Contract Note' };
  var TRANSLATED_VALUES = { employmentType: 1, taxClass: 1, interviewStatus: 1, archiveReason: 1, source: 1, 'contract.type': 1 };

  function onboardingLabel(key) {
    var list = (S.settings().allOnboardingSteps || S.settings().onboardingSteps || []);
    var st = list.filter(function (x) { return x.key === key; })[0];
    return st ? t(st.label) : key;
  }
  function docLabel(key) {
    var all = S.settings().allDocuments || [];
    var d = all.filter(function (x) { return x.key === key; })[0];
    return d ? t(d.label) : L.docLabel(key);
  }

  /** Human label for a field path, plus a formatter for its values. */
  function describe(path) {
    var p = String(path || '').split('.');
    if (p[0] === 'documents' && p.length === 3) {
      return { label: t('{0} – {1}', docLabel(p[1]), t(DOC_FIELDS[p[2]] || p[2])), fmt: p[2] === 'status' ? function (v) { return t(L.docStatus(v).label); } : null };
    }
    if (p[0] === 'contract' && p.length === 2) {
      return { label: t(CONTRACT_FIELDS[p[1]] || p[1]), fmt: p[1] === 'status' ? function (v) { return t(L.contractStatus(v).label); } : p[1] === 'type' ? function (v) { return t(v); } : null };
    }
    if (p[0] === 'onboarding' && p.length === 3) {
      if (p[2] === 'done') return { label: onboardingLabel(p[1]), fmt: function (v) { return v === true || v === 'true' ? t('Done') : t('Open'); } };
      return { label: t('{0} – {1}', onboardingLabel(p[1]), t('Date')), fmt: null };
    }
    if (path === 'stage') return { label: t(FIELDS.stage), fmt: function (v) { return t(L.stage(v).label); } };
    if (path === 'availability') return { label: t(FIELDS.availability), fmt: function (v) { return t(L.availability(v).label); } };
    if (TRANSLATED_VALUES[path]) return { label: t(FIELDS[path] || path), fmt: function (v) { return t(v); } };
    if (FIELDS[path]) return { label: t(FIELDS[path]), fmt: null };
    return { label: path, fmt: null }; // e.g. document type / onboarding step keys in settings changes
  }

  function fmtValue(v, fmt) {
    if (v === null || v === undefined || v === '') return '—';
    if (fmt && typeof v !== 'object') return fmt(v);
    if (typeof v === 'boolean') return v ? t('Yes') : t('No');
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return U.fmtDate(v);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return U.fmtDateTime(v);
    return String(v);
  }

  function changesHtml(changes) {
    if (!changes || !changes.length) return '<span class="muted">—</span>';
    var shown = changes.slice(0, 12);
    return shown.map(function (ch) {
      var d = describe(ch.field || ch.path);
      var from = fmtValue(ch.from, d.fmt), to = fmtValue(ch.to, d.fmt);
      return '<div class="audit-change"><b>' + esc(d.label) + ':</b> <span class="from">' + esc(from) + '</span><span class="arrow">' + (J.i18n.isRTL() ? '←' : '→') + '</span><span class="to">' + esc(to) + '</span></div>';
    }).join('') + (changes.length > shown.length ? '<div class="small muted">' + esc(t('+ {0} more', changes.length - shown.length)) + '</div>' : '');
  }

  function query() {
    var p = { limit: LIMIT, offset: offset };
    Object.keys(f).forEach(function (k) { if (f[k]) p[k] = f[k]; });
    return Object.keys(p).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(p[k]); }).join('&');
  }

  function load(force) {
    var q = query();
    if (!force && (st.key === q && (st.data || st.loading))) return;
    st.key = q; st.loading = true;
    var seq = ++st.seq;
    J.api.get('/api/audit?' + q).then(function (data) {
      if (seq !== st.seq) return;
      st.data = data; st.loading = false;
      if (J.app.route() === 'audit') J.app.rerenderView();
    }, function (err) {
      if (seq !== st.seq) return;
      st.loading = false;
      if (!st.data) st.data = { items: [], total: 0, actors: [], failed: true };
      ui.toast(J.api.message(err), 'error');
      if (J.app.route() === 'audit') J.app.rerenderView();
    });
  }

  function filters(actors) {
    return '<div class="toolbar">' +
      '<div class="search-input">' + icon('search') + '<input type="search" id="audit-q" placeholder="' + esc(t('Search summary, user or candidate ID…')) + '" value="' + esc(f.q) + '" data-input="audit-q" aria-label="' + esc(t('Search audit log')) + '"></div>' +
      '<select class="sm" data-change="audit-filter" data-k="action" aria-label="' + esc(t('Action type')) + '">' + ui.options(GROUPS, f.action, { blank: 'All actions' }) + '</select>' +
      '<select class="sm" data-change="audit-filter" data-k="actor" aria-label="' + esc(t('User')) + '">' + ui.options(actors.map(function (a) { return { key: a.id, label: a.full_name }; }), f.actor, { blank: 'All users', raw: true }) + '</select>' +
      '<label class="row small muted" style="gap:6px">' + esc(t('From')) + '<input type="date" class="sm" value="' + esc(f.from) + '" data-change="audit-filter" data-k="from"></label>' +
      '<label class="row small muted" style="gap:6px">' + esc(t('To')) + '<input type="date" class="sm" value="' + esc(f.to) + '" data-change="audit-filter" data-k="to"></label>' +
      (Object.keys(f).some(function (k) { return f[k]; }) ? '<button class="btn sm ghost" data-action="audit-clear">' + icon('x', 'sm') + esc(t('Clear Filters')) + '</button>' : '') +
      '<div style="flex:1"></div>' +
      '<button class="icon-btn bordered" data-action="audit-reload" aria-label="' + esc(t('Refresh')) + '" data-tip="' + esc(t('Refresh')) + '">' + icon('restore', 'sm') + '</button></div>';
  }

  J.views.audit = {
    onEnter: function () { if (st.data) load(true); },
    render: function () {
      load(false);
      var d = st.data;
      var head = '<div class="page-head"><div><h1>' + esc(t('Audit Log')) + '</h1><div class="sub">' +
        esc(t('Every change to candidates, users, settings and backups, and every sign-in, is recorded here with user and time. The log is append-only and cannot be edited or deleted.')) + '</div></div></div>';
      var body;
      if (!d) {
        body = '<div class="empty"><p>' + esc(t('Loading…')) + '</p></div>';
      } else if (!d.items.length) {
        body = ui.empty('shield', t('No entries found'), esc(d.failed ? t('The audit log could not be loaded.') : t('Try adjusting your search or filters.')));
      } else {
        body = '<div class="table-wrap" data-keep-scroll="audit"' + (st.loading ? ' style="opacity:.6"' : '') + '><table class="data static"><thead><tr><th>' + esc(t('Date / time')) + '</th><th>' + esc(t('User')) + '</th><th>' + esc(t('Action')) + '</th><th>' + esc(t('Candidate')) + '</th><th>' + esc(t('Summary')) + '</th><th>' + esc(t('Changes')) + '</th></tr></thead><tbody>' +
          d.items.map(function (x) {
            var cand = x.candidate_id ? (S.get(x.candidate_id)
              ? '<a href="#" class="mono" data-action="open-candidate" data-id="' + esc(x.candidate_id) + '">' + esc(x.candidate_id) + '</a>'
              : '<span class="mono">' + esc(x.candidate_id) + '</span>') : '<span class="muted">—</span>';
            var role = x.actor_role && x.actor_role !== 'system' ? ' <span class="role-pill ' + esc(x.actor_role) + '">' + esc(J.auth.roleLabel(x.actor_role)) + '</span>' : '';
            return '<tr><td class="nowrap">' + esc(U.fmtDateTime(x.occurred_at)) + '</td>' +
              '<td class="nowrap">' + esc(x.actor_name === 'System' ? t('System') : x.actor_name) + role + '</td>' +
              '<td class="nowrap">' + actionBadge(x.action) + '</td><td class="nowrap">' + cand + '</td>' +
              '<td style="white-space:normal;min-width:180px;max-width:320px">' + ui.val(x.summary) + '</td>' +
              '<td style="white-space:normal;min-width:240px;max-width:460px">' + changesHtml(x.changes) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
        var from = d.total ? offset + 1 : 0, to = Math.min(d.total, offset + d.items.length);
        body += '<div class="pager"><span>' + t('Showing {0} of {1}', '<b>' + from + '–' + to + '</b>', '<b>' + d.total + '</b>') + '</span><div class="row">' +
          '<button class="btn sm" data-action="audit-page" data-d="-1"' + (offset === 0 || st.loading ? ' disabled' : '') + '>' + esc(t('Previous')) + '</button>' +
          '<span>' + esc(t('Page {0} of {1}', Math.floor(offset / LIMIT) + 1, Math.max(1, Math.ceil(d.total / LIMIT)))) + '</span>' +
          '<button class="btn sm" data-action="audit-page" data-d="1"' + (offset + LIMIT >= d.total || st.loading ? ' disabled' : '') + '>' + esc(t('Next')) + '</button></div></div>';
      }
      return head + '<div class="card">' + filters((d && d.actors) || []) + body + '</div>';
    }
  };

  function reload() { offset = 0; load(true); J.app.rerenderView(); }
  var searchDeb = U.debounce(reload, 350);
  A['audit-q'] = function (el) { f.q = el.value.trim(); searchDeb(); };
  A['audit-filter'] = function (el) { f[el.getAttribute('data-k')] = el.value; reload(); };
  A['audit-clear'] = function () { f = U.clone(EMPTY); reload(); };
  A['audit-reload'] = function () { load(true); J.app.rerenderView(); };
  A['audit-page'] = function (el) {
    offset = Math.max(0, offset + (+el.getAttribute('data-d')) * LIMIT);
    load(true); J.app.rerenderView();
    var w = document.querySelector('[data-keep-scroll="audit"]'); if (w) w.scrollTop = 0;
  };
})();
