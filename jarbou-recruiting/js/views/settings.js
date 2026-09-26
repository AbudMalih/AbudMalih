/* Settings: company/project config, lists, documents, onboarding, backup. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon, t = J.t;
  var scrollTo = '';

  /* i18n: t('Projects') t('Stations / Locations') t('Positions') t('Recruiters') t('Recruitment Sources')
     t('Candidates can be assigned to a project. Use the project selector in the top bar to focus on one project.') t('New project name')
     t('Stations available when assigning candidates (e.g. Hannover, Kassel, Haiger, Bremen).') t('New station, e.g. Göttingen')
     t('Job positions available for candidates.') t('New position') t('People responsible for candidates.') t('Recruiter name')
     t('Where candidates come from – used for source analytics.') t('New source') */
  var LISTS = {
    projects: { title: 'Projects', field: 'project', help: 'Candidates can be assigned to a project. Use the project selector in the top bar to focus on one project.', placeholder: 'New project name' },
    stations: { title: 'Stations / Locations', field: 'station', help: 'Stations available when assigning candidates (e.g. Hannover, Kassel, Haiger, Bremen).', placeholder: 'New station, e.g. Göttingen' },
    positions: { title: 'Positions', field: 'position', help: 'Job positions available for candidates.', placeholder: 'New position' },
    recruiters: { title: 'Recruiters', field: 'recruiter', help: 'People responsible for candidates.', placeholder: 'Recruiter name' },
    sources: { title: 'Recruitment Sources', field: 'source', help: 'Where candidates come from – used for source analytics.', placeholder: 'New source' }
  };

  function section(id, title, sub, body) {
    return '<div class="card mb-16" id="set-' + id + '"><div class="card-head"><div><h3>' + esc(title) + '</h3>' + (sub ? '<div class="small muted" style="margin-top:3px">' + esc(sub) + '</div>' : '') + '</div></div><div class="card-body">' + body + '</div></div>';
  }

  function editableList(key) {
    var s = S.settings(), cfg = LISTS[key], list = s[key] || [];
    var usage = {};
    S.all().forEach(function (c) { var v = c[cfg.field]; if (v) usage[v] = (usage[v] || 0) + 1; });
    return '<div class="editable-list">' + (list.length ? list.map(function (v, k) {
      return '<div class="el-row"><div class="grow"><input type="text" value="' + esc(v) + '" data-change="list-rename" data-list="' + key + '" data-i="' + k + '" aria-label="' + esc(t('Rename')) + '"></div>' +
        '<span class="small muted nowrap">' + esc(usage[v] === 1 ? t('{0} candidate', 1) : t('{0} candidates', usage[v] || 0)) + '</span>' +
        '<button class="icon-btn" data-action="list-move" data-list="' + key + '" data-i="' + k + '" data-d="-1" aria-label="' + esc(t('Move up')) + '"' + (k === 0 ? ' disabled' : '') + '>' + icon('arrowUp', 'sm') + '</button>' +
        '<button class="icon-btn" data-action="list-remove" data-list="' + key + '" data-i="' + k + '" aria-label="' + esc(t('Remove')) + '" data-tip="' + esc(t('Remove from list (existing candidates keep their value)')) + '">' + icon('trash', 'sm') + '</button></div>';
    }).join('') : '<div class="el-row"><span class="small muted">' + esc(t('No entries yet.')) + '</span></div>') + '</div>' +
      '<div class="add-row"><input type="text" id="add-' + key + '" placeholder="' + esc(t(cfg.placeholder)) + '" data-enter="list-add" data-list="' + key + '"><button class="btn" data-action="list-add" data-list="' + key + '">' + icon('plus', 'sm') + esc(t('Add')) + '</button></div>';
  }

  function backupSection() {
    var last = S.meta('lastBackup');
    var days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 864e5) : null;
    var s = S.settings();
    var stale = !last || days >= (s.backupReminderDays || 7);
    return '<div class="backup-status" style="' + (stale ? 'border-color:var(--amber-bd);background:var(--amber-bg)' : 'border-color:var(--green-bd);background:var(--green-bg)') + '">' + icon('database', 'lg') +
      '<div style="flex:1"><div class="strong">' + esc(last ? t('Last Backup: {0} ({1})', U.fmtDateTime(last), days === 0 ? t('today') : days === 1 ? t('{0} day ago', days) : t('{0} days ago', days)) : t('Last Backup: never')) + '</div>' +
      '<div class="small muted-2">' + esc(S.count() === 1 ? t('{0} candidate stored locally in this browser ({1}).', S.count(), S.mode() === 'indexeddb' ? 'IndexedDB' : S.mode()) : t('{0} candidates stored locally in this browser ({1}).', S.count(), S.mode() === 'indexeddb' ? 'IndexedDB' : S.mode())) + '</div></div>' +
      '<button class="btn dark" data-action="backup-now">' + icon('download', 'sm') + esc(t('Backup Data')) + '</button></div>' +
      '<div class="grid halves mt-16">' +
      '<div><div class="section-title">' + esc(t('Restore backup')) + '</div><p class="small muted-2">' + t('Import a previous JSON backup file. {0} A safety copy of the current data is downloaded first.', '<b>' + esc(t('This will replace the current local database.')) + '</b>') + '</p>' +
      '<label class="btn mt-8" style="position:relative">' + icon('upload', 'sm') + esc(t('Restore Backup…')) + '<input type="file" accept=".json,application/json" data-change="restore-file" style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="' + esc(t('Choose backup file')) + '"></label></div>' +
      '<div><div class="section-title">' + esc(t('Export')) + '</div><p class="small muted-2">' + esc(t('Export all candidates (including archive) for Excel or other tools.')) + '</p>' +
      '<div class="row wrap mt-8"><button class="btn" data-action="export-all" data-fmt="csv">' + icon('download', 'sm') + 'CSV</button><button class="btn" data-action="export-all" data-fmt="xlsx">' + icon('excel', 'sm') + esc(t('Excel (.xlsx)')) + '</button><button class="btn" data-action="export-all" data-fmt="json">' + icon('database', 'sm') + 'JSON</button></div></div>' +
      '</div>' +
      '<div class="fgrid mt-16"><div class="field"><label>' + esc(t('Backup reminder after (days)')) + '</label><input type="number" min="1" max="90" value="' + esc(s.backupReminderDays) + '" data-change="set-setting" data-k="backupReminderDays" data-type="int"></div></div>';
  }

  J.views.settings = {
    onEnter: function (p) { scrollTo = p && p.section ? p.section : ''; },
    mount: function (root) {
      if (scrollTo) {
        var el = root.querySelector('#set-' + scrollTo);
        if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); var inp = el.querySelector('input'); if (inp) inp.focus({ preventScroll: true }); }, 30);
        scrollTo = '';
      }
      root.querySelectorAll('[data-enter]').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); A[inp.getAttribute('data-enter')](inp); } });
      });
    },
    render: function () {
      var s = S.settings();
      /* i18n: t('General') t('Projects') t('Stations') t('Positions') t('Recruiters') t('Recruitment Sources') t('Document Requirements') t('Onboarding Checklist') t('Backup, Import & Export') t('Data & Privacy') */
      var nav = [['general', 'General'], ['projects', 'Projects'], ['stations', 'Stations'], ['positions', 'Positions'], ['recruiters', 'Recruiters'], ['sources', 'Recruitment Sources'], ['documents', 'Document Requirements'], ['onboarding', 'Onboarding Checklist'], ['backup', 'Backup, Import & Export'], ['data', 'Data & Privacy']];
      var langs = J.i18n.LANGS.map(function (l) { return { key: l.key, label: l.label }; });

      /* i18n: t('All positions') t('None') t('None (choose per candidate)') t('net') t('gross') */
      var general = '<div class="fgrid">' +
        '<div class="field"><label>' + esc(t('Language')) + '</label><select data-change="set-language" aria-label="' + esc(t('Language')) + '">' + ui.options(langs, s.language || J.i18n.lang, { raw: true }) + '</select><div class="help">' + esc(t('Default: Deutsch. Arabic uses a right-to-left layout.')) + '</div></div>' +
        '<div class="field"><label>' + esc(t('Company name')) + '</label><input type="text" value="' + esc(s.companyName) + '" data-change="set-setting" data-k="companyName"></div>' +
        '<div class="field"><label>' + esc(t('Required drivers (target)')) + '</label><input type="number" min="0" max="10000" value="' + esc(s.requiredDrivers) + '" data-change="set-setting" data-k="requiredDrivers" data-type="int"></div>' +
        '<div class="field"><label>' + esc(t('Target counts position')) + '</label><select data-change="set-setting" data-k="targetPosition">' + ui.options(s.positions, s.targetPosition, { blank: 'All positions' }) + '</select></div>' +
        '<div class="field"><label>' + esc(t('Default project (current project)')) + '</label><select data-change="set-setting" data-k="defaultProject">' + ui.options(s.projects, s.defaultProject, { blank: 'None' }) + '</select></div>' +
        '<div class="field"><label>' + esc(t('Default station for new candidates')) + '</label><select data-change="set-setting" data-k="defaultStation">' + ui.options(s.stations, s.defaultStation, { blank: 'None (choose per candidate)' }) + '</select></div>' +
        '<div class="field"><label>' + esc(t('Default position')) + '</label><select data-change="set-setting" data-k="defaultPosition">' + ui.options(s.positions, s.defaultPosition, { blank: 'None' }) + '</select></div>' +
        '<div class="field"><label>' + esc(t('Standard salary reference (€ / month)')) + '</label><div class="inline-pair"><input type="number" min="0" step="10" value="' + esc(s.standardSalaryReference) + '" data-change="set-setting" data-k="standardSalaryReference" data-type="num">' +
        '<select style="width:92px" data-change="set-setting" data-k="standardSalaryBasis">' + ui.options([{ key: 'net', label: 'net' }, { key: 'gross', label: 'gross' }], s.standardSalaryBasis) + '</select></div></div>' +
        '<div class="field"><label>' + esc(t('Warn about document expiry (days ahead)')) + '</label><input type="number" min="1" max="365" value="' + esc(s.expiryWarningDays) + '" data-change="set-setting" data-k="expiryWarningDays" data-type="int"></div>' +
        '<div class="field"><label>' + esc(t('Warn unsigned contract (days before start)')) + '</label><input type="number" min="1" max="90" value="' + esc(s.contractWarningDays) + '" data-change="set-setting" data-k="contractWarningDays" data-type="int"></div>' +
        '<div class="field"><label>' + esc(t('Candidate ID prefix')) + '</label><input type="text" maxlength="6" value="' + esc(s.idPrefix) + '" data-change="set-setting" data-k="idPrefix"><div class="help">' + esc(t('Applies to new candidates only. Next ID: {0}', (s.idPrefix || 'JRB') + '-' + U.pad(s.nextNumber, 4))) + '</div></div>' +
        '</div>';

      var docs = '<div class="editable-list">' + s.documents.map(function (d, k) {
        return '<div class="el-row"><div class="grow"><input type="text" value="' + esc(d.label) + '" data-change="doc-def-label" data-i="' + k + '" aria-label="' + esc(t('Document name')) + '"></div>' +
          '<label class="check-inline small" data-tip="' + esc(t('New candidates start with this document as Missing. Otherwise Not Required.')) + '"><input type="checkbox" ' + (d.required ? 'checked' : '') + ' data-change="doc-def-toggle" data-i="' + k + '" data-f="required"> ' + esc(t('Required by default')) + '</label>' +
          '<label class="check-inline small" data-tip="' + esc(t('Track issue and expiry dates')) + '"><input type="checkbox" ' + (d.expiry ? 'checked' : '') + ' data-change="doc-def-toggle" data-i="' + k + '" data-f="expiry"> ' + esc(t('Expiry dates')) + '</label>' +
          (d.builtin ? '<span class="icon-btn" style="cursor:default" data-tip="' + esc(t('Built-in document')) + '">' + icon('lock', 'sm') + '</span>' : '<button class="icon-btn" data-action="doc-def-remove" data-i="' + k + '" aria-label="' + esc(t('Remove')) + '">' + icon('trash', 'sm') + '</button>') + '</div>';
      }).join('') + '</div>' +
        '<div class="add-row"><input type="text" id="add-doc" placeholder="' + esc(t('Add custom document, e.g. Fahrerkarte')) + '" data-enter="doc-def-add"><button class="btn" data-action="doc-def-add">' + icon('plus', 'sm') + esc(t('Add')) + '</button></div>' +
        '<p class="small muted mt-8">' + esc(t('Residence and work permits depend on the candidate and can always be set to "Not Required" on the candidate\'s Documents tab. "Required by default" only affects newly created candidates.')) + '</p>';

      var ob = '<div class="editable-list">' + s.onboardingSteps.map(function (st, k) {
        return '<div class="el-row"><span class="muted small" style="width:18px">' + (k + 1) + '.</span><div class="grow"><input type="text" value="' + esc(st.label) + '" data-change="ob-def-label" data-i="' + k + '" aria-label="' + esc(t('Step name')) + '"></div>' +
          (st.auto ? '<span class="auto-tag" data-tip="' + esc(st.auto === 'documents' ? t('Completed automatically from document checklist') : t('Completed automatically from contract status')) + '">' + esc(t('Auto')) + '</span>' : '') +
          '<button class="icon-btn" data-action="ob-def-move" data-i="' + k + '" data-d="-1" aria-label="' + esc(t('Move up')) + '"' + (k === 0 ? ' disabled' : '') + '>' + icon('arrowUp', 'sm') + '</button>' +
          '<button class="icon-btn" data-action="ob-def-move" data-i="' + k + '" data-d="1" aria-label="' + esc(t('Move down')) + '"' + (k === s.onboardingSteps.length - 1 ? ' disabled' : '') + '>' + icon('arrowDown', 'sm') + '</button>' +
          '<button class="icon-btn" data-action="ob-def-remove" data-i="' + k + '" aria-label="' + esc(t('Remove')) + '">' + icon('trash', 'sm') + '</button></div>';
      }).join('') + '</div>' +
        '<div class="add-row"><input type="text" id="add-ob" placeholder="' + esc(t('Add onboarding step, e.g. Fuel card issued')) + '" data-enter="ob-def-add"><button class="btn" data-action="ob-def-add">' + icon('plus', 'sm') + esc(t('Add step')) + '</button></div>' +
        '<div class="row mt-8"><button class="btn xs ghost" data-action="ob-def-reset">' + icon('restore', 'sm') + esc(t('Reset to default steps')) + '</button></div>';

      var data = '<div class="dl" style="grid-template-columns:220px 1fr">' +
        '<dt>' + esc(t('Storage')) + '</dt><dd>' + esc(S.mode() === 'indexeddb' ? t('IndexedDB (browser database on this computer)') : S.mode() === 'localstorage' ? t('localStorage fallback') : t('Temporary memory – data is NOT saved')) + '</dd>' +
        '<dt>' + esc(t('Candidates stored')) + '</dt><dd>' + esc(t('{0} ({1} archived)', S.count(), S.all().filter(function (c) { return c.archived; }).length)) + '</dd>' +
        '<dt>' + esc(t('Database created')) + '</dt><dd>' + (S.meta('createdAt') ? U.fmtDateTime(S.meta('createdAt')) : '—') + '</dd>' +
        '<dt>' + esc(t('Application version')) + '</dt><dd>' + C.APP_VERSION + '</dd>' +
        '<dt>' + esc(t('Network')) + '</dt><dd>' + esc(t('No external connections. No candidate data is transmitted anywhere.')) + '</dd></dl>' +
        '<div class="banner blue mt-16">' + icon('shield') + '<div class="grow">' + t('This application contains personal data of candidates and employees. {0} Keep backup files in a secure, access-restricted location and delete data that is no longer needed (GDPR / DSGVO).', '<b>' + esc(t('Internal use only.')) + '</b>') + '</div></div>' +
        '<div class="section-title mt-16" style="color:var(--red)">' + esc(t('Danger zone')) + '</div><p class="small muted-2">' + esc(t('Erase all candidates and settings from this browser. Create a backup first.')) + '</p>' +
        '<button class="btn mt-8" style="color:var(--red);border-color:var(--red-bd)" data-action="reset-db">' + icon('trash', 'sm') + esc(t('Erase local database…')) + '</button>';

      return '<div class="page-head"><div><h1>' + esc(t('Settings')) + '</h1><div class="sub">' + esc(t('Configure the recruiting system. All changes are saved automatically.')) + '</div></div></div>' +
        '<div class="settings-layout"><nav class="settings-nav">' + nav.map(function (n) { return '<a href="#" data-action="settings-jump" data-s="' + n[0] + '">' + esc(t(n[1])) + '</a>'; }).join('') + '</nav><div>' +
        section('general', t('General'), t('Company, target and defaults'), general) +
        Object.keys(LISTS).map(function (k) { return section(k, t(LISTS[k].title), t(LISTS[k].help), editableList(k)); }).join('') +
        section('documents', t('Document Requirements'), t('Documents tracked for every candidate'), docs) +
        section('onboarding', t('Onboarding Checklist'), t('Steps shown on every candidate\'s onboarding checklist'), ob) +
        section('backup', t('Backup, Import & Export'), t('Protect your data – this application works fully offline'), backupSection()) +
        section('data', t('Data & Privacy'), '', data) +
        '</div></div>';
    }
  };

  function saveS(msg) { L.bump(); return S.saveSettings().then(function () { J.app.refresh(); if (msg) ui.toast(msg); }); }

  A['settings-jump'] = function (el) { var target = document.getElementById('set-' + el.getAttribute('data-s')); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  A['set-setting'] = function (el) {
    var s = S.settings(), k = el.getAttribute('data-k'), type = el.getAttribute('data-type');
    var v = el.value;
    if (type === 'int' || type === 'num') {
      var n = U.num(v);
      if (n === null || n < 0) { el.classList.add('invalid'); ui.toast(t('Please enter a valid number.'), 'error'); return; }
      v = type === 'int' ? Math.round(n) : n;
    }
    if (k === 'companyName' && !String(v).trim()) { el.classList.add('invalid'); ui.toast(t('Company name cannot be empty.'), 'error'); return; }
    if (k === 'idPrefix') { v = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'JRB'; }
    s[k] = v;
    saveS(t('Settings saved.'));
  };

  A['list-add'] = function (el) {
    var key = el.getAttribute('data-list');
    var inp = document.getElementById('add-' + key);
    var v = inp.value.trim();
    if (!v) { inp.classList.add('invalid'); inp.focus(); return; }
    var s = S.settings();
    if (s[key].some(function (x) { return x.toLowerCase() === v.toLowerCase(); })) { ui.toast(t('"{0}" already exists.', v), 'warn'); return; }
    s[key].push(v);
    saveS(t('"{0}" added to {1}.', v, t(LISTS[key].title))).then(function () { var n = document.getElementById('add-' + key); if (n) n.focus(); });
  };
  A['list-remove'] = function (el) {
    var key = el.getAttribute('data-list'), i = +el.getAttribute('data-i');
    var s = S.settings(), v = s[key][i];
    ui.confirm({ title: t('Remove "{0}"?', v), message: esc(t('It will be removed from the selection list. Candidates already assigned keep their value.')), ok: t('Remove'), danger: true }).then(function (ok) {
      if (!ok) return;
      s[key].splice(i, 1);
      if (key === 'projects' && s.activeProject === v) s.activeProject = 'all';
      saveS(t('"{0}" removed.', v));
    });
  };
  A['list-move'] = function (el) {
    var key = el.getAttribute('data-list'), i = +el.getAttribute('data-i'), d = +el.getAttribute('data-d');
    var arr = S.settings()[key];
    if (i + d < 0 || i + d >= arr.length) return;
    var tmp = arr[i]; arr[i] = arr[i + d]; arr[i + d] = tmp;
    saveS();
  };
  A['list-rename'] = function (el) {
    var key = el.getAttribute('data-list'), i = +el.getAttribute('data-i');
    var s = S.settings(), old = s[key][i], v = el.value.trim();
    if (!v) { el.value = old; return; }
    if (v === old) return;
    s[key][i] = v;
    var field = LISTS[key].field;
    var changed = S.all().filter(function (c) { return c[field] === old; });
    changed.forEach(function (c) { c[field] = v; c.updatedAt = new Date().toISOString(); });
    ['defaultProject', 'defaultStation', 'defaultPosition', 'targetPosition', 'activeProject'].forEach(function (k) { if (s[k] === old) s[k] = v; });
    S.putMany(changed).then(function () { saveS(changed.length ? t('Renamed to "{0}" – {1} candidate(s) updated.', v, changed.length) : t('Renamed to "{0}".', v)); });
  };

  A['doc-def-label'] = function (el) {
    var d = S.settings().documents[+el.getAttribute('data-i')];
    if (!el.value.trim()) { el.value = d.label; return; }
    d.label = el.value.trim(); delete d.short; saveS(t('Document renamed.'));
  };
  A['doc-def-toggle'] = function (el) {
    var d = S.settings().documents[+el.getAttribute('data-i')];
    d[el.getAttribute('data-f')] = el.checked; saveS(t('Document requirement updated.'));
  };
  A['doc-def-add'] = function () {
    var inp = document.getElementById('add-doc'), v = inp.value.trim();
    if (!v) { inp.classList.add('invalid'); inp.focus(); return; }
    S.settings().documents.push({ key: 'custom_' + U.uid(), label: v, required: true, expiry: false, builtin: false });
    saveS(t('Document "{0}" added. Existing candidates show it as Missing – set Not Required where applicable.', v));
  };
  A['doc-def-remove'] = function (el) {
    var s = S.settings(), i = +el.getAttribute('data-i'), d = s.documents[i];
    ui.confirm({ title: t('Remove document "{0}"?', t(d.label)), message: esc(t('It will no longer be tracked or count towards completion. Stored statuses are kept in the database.')), ok: t('Remove'), danger: true }).then(function (ok) {
      if (!ok) return;
      s.documents.splice(i, 1); saveS(t('Document removed.'));
    });
  };

  A['ob-def-label'] = function (el) {
    var st = S.settings().onboardingSteps[+el.getAttribute('data-i')];
    if (!el.value.trim()) { el.value = st.label; return; }
    st.label = el.value.trim(); saveS(t('Step renamed.'));
  };
  A['ob-def-move'] = function (el) {
    var arr = S.settings().onboardingSteps, i = +el.getAttribute('data-i'), d = +el.getAttribute('data-d');
    if (i + d < 0 || i + d >= arr.length) return;
    var tmp = arr[i]; arr[i] = arr[i + d]; arr[i + d] = tmp; saveS();
  };
  A['ob-def-remove'] = function (el) {
    var s = S.settings(), i = +el.getAttribute('data-i'), st = s.onboardingSteps[i];
    ui.confirm({ title: t('Remove step "{0}"?', t(st.label)), message: esc(t('The step is removed from all onboarding checklists. Existing ticks are kept in the database and reappear if you re-add the default steps.')), ok: t('Remove'), danger: true }).then(function (ok) {
      if (!ok) return;
      s.onboardingSteps.splice(i, 1); saveS(t('Onboarding step removed.'));
    });
  };
  A['ob-def-add'] = function () {
    var inp = document.getElementById('add-ob'), v = inp.value.trim();
    if (!v) { inp.classList.add('invalid'); inp.focus(); return; }
    S.settings().onboardingSteps.push({ key: 'step_' + U.uid(), label: v });
    saveS(t('Step "{0}" added.', v));
  };
  A['ob-def-reset'] = function () {
    ui.confirm({ title: t('Reset onboarding steps?'), message: esc(t('Custom steps will be removed and the default steps restored.')), ok: t('Reset') }).then(function (ok) {
      if (!ok) return;
      S.settings().onboardingSteps = U.clone(C.DEFAULT_ONBOARDING); saveS(t('Onboarding steps reset.'));
    });
  };

  A['reset-db'] = function () {
    ui.confirm({
      title: t('Erase the local database?'),
      message: esc(t('All {0} candidates, notes, activity history and settings will be permanently deleted from this browser. A backup file will be downloaded first so you can restore it if needed.', S.count())),
      ok: t('Erase everything'), danger: true, typeToConfirm: 'ERASE'
    }).then(function (ok) {
      if (!ok) return;
      J.io.backup(true);
      var settings = C.defaultSettings();
      S.replaceAll([], { settings: settings, createdAt: new Date().toISOString() }).then(function () {
        L.bump(); J.profile.close(); J.app.go('dashboard'); J.app.refresh();
        ui.toast(t('Local database erased. A backup of the previous data was downloaded.'), 'success');
      });
    });
  };
})();
