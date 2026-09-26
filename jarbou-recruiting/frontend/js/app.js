/* Application shell: routing, navigation, global search, data mutations. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon, t = J.t;
  var app = (J.app = {});
  J.views = J.views || {};

  /* i18n: t('Dashboard') t('Candidates') t('Recruitment Pipeline') t('Onboarding') t('Documents') t('Starting Soon') t('Reports') t('Archive') t('Settings') t('Audit Log') t('Overview') t('Recruiting') t('Management') */
  var ROUTES = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Overview' },
    { key: 'candidates', label: 'Candidates', icon: 'users', group: 'Recruiting' },
    { key: 'pipeline', label: 'Recruitment Pipeline', icon: 'kanban', group: 'Recruiting' },
    { key: 'onboarding', label: 'Onboarding', icon: 'onboarding', group: 'Recruiting' },
    { key: 'documents', label: 'Documents', icon: 'file', group: 'Recruiting' },
    { key: 'starting', label: 'Starting Soon', icon: 'calendar', group: 'Recruiting' },
    { key: 'reports', label: 'Reports', icon: 'chart', group: 'Management' },
    { key: 'archive', label: 'Archive', icon: 'archive', group: 'Management' },
    { key: 'settings', label: 'Settings', icon: 'settings', group: 'Management' },
    { key: 'audit', label: 'Audit Log', icon: 'shield', group: 'Management', perm: 'audit.read' }
  ];
  function allowed(r) { return !r.perm || J.auth.can(r.perm); }
  var current = 'dashboard';
  var lastNavSync = Date.now();
  var params = {};

  function parseHash() {
    var h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = h.split('?');
    var key = parts[0] || 'dashboard';
    var p = {};
    if (parts[1]) parts[1].split('&').forEach(function (kv) { var x = kv.split('='); p[decodeURIComponent(x[0])] = decodeURIComponent(x[1] || ''); });
    if (!ROUTES.some(function (r) { return r.key === key && allowed(r); })) key = 'dashboard';
    return { key: key, params: p };
  }

  app.route = function () { return current; };
  app.go = function (key, p) {
    var q = p ? '?' + Object.keys(p).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(p[k]); }).join('&') : '';
    var target = '#/' + key + q;
    if (location.hash === target) onRoute(); else location.hash = target;
  };

  function onRoute() {
    var r = parseHash();
    var changed = r.key !== current;
    current = r.key; params = r.params;
    var v = J.views[current];
    if (v && v.onEnter) v.onEnter(params);
    document.body.classList.remove('sb-open');
    var bd = document.querySelector('.sidebar-backdrop'); if (bd) bd.remove();
    renderView(changed);
    if (changed) window.scrollTo(0, 0);
    // Pick up colleagues' changes when navigating (cheap incremental sync).
    if (changed && Date.now() - lastNavSync > 5000) { lastNavSync = Date.now(); S.sync().catch(function () {}); }
  }

  function renderNav() {
    var list = L.scoped();
    var k = L.kpis(list);
    var archived = L.scoped(true).filter(function (c) { return c.archived; }).length;
    var counts = { candidates: list.length, starting: k.start7, documents: k.docsMissing, archive: archived, onboarding: k.onboarding };
    var alerts = { documents: k.docsMissing > 0 };
    var html = '', group = '';
    ROUTES.filter(allowed).forEach(function (r) {
      if (r.group !== group) { group = r.group; html += '<div class="nav-group-label">' + esc(t(group)) + '</div>'; }
      var n = counts[r.key];
      html += '<a href="#/' + r.key + '" class="' + (current === r.key ? 'active' : '') + '" title="' + esc(t(r.label)) + '"' + (current === r.key ? ' aria-current="page"' : '') + '>' + icon(r.icon) + '<span>' + esc(t(r.label)) + '</span>' +
        (n ? '<em class="count ' + (alerts[r.key] ? 'alert' : '') + '" style="font-style:normal">' + n + '</em>' : '') + '</a>';
    });
    document.getElementById('nav').innerHTML = html;
    var route = ROUTES.filter(function (r) { return r.key === current; })[0];
    var s = S.settings();
    document.getElementById('crumbs').innerHTML = esc(s.companyName) + ' <span style="margin:0 6px">/</span> <b>' + esc(t(route.label)) + '</b>';
    document.getElementById('foot-company').textContent = s.companyName;
    document.title = t(route.label) + ' · ' + s.companyName + ' Recruiting';
    var proj = s.activeProject && s.activeProject !== 'all' ? s.activeProject : s.defaultProject;
    document.getElementById('sidebar-project').innerHTML = (/dhl/i.test(proj || '') ? '<span class="dhl-dot" aria-hidden="true"></span>' : '') + '<span>' + esc(proj ? t('{0} Project', proj) : t('All projects')) + '</span>';
    var sel = document.getElementById('scope-select');
    sel.innerHTML = '<option value="all">' + esc(t('All projects')) + '</option>' + s.projects.map(function (p) { return '<option value="' + esc(p) + '"' + (s.activeProject === p ? ' selected' : '') + '>' + esc(t('Project: {0}', p)) + '</option>'; }).join('');
    sel.value = s.activeProject || 'all';
    var ls = document.getElementById('lang-select');
    ls.innerHTML = J.i18n.LANGS.map(function (l) { return '<option value="' + l.key + '"' + (l.key === J.i18n.lang ? ' selected' : '') + '>' + l.short + ' · ' + esc(l.label) + '</option>'; }).join('');
  }

  function renderView(fresh) {
    var el = document.getElementById('view');
    var v = J.views[current];
    // keep scroll of inner scroll areas across re-renders
    var keep = {};
    if (!fresh) el.querySelectorAll('[data-keep-scroll]').forEach(function (n) { keep[n.getAttribute('data-keep-scroll')] = [n.scrollTop, n.scrollLeft]; });
    var active = document.activeElement;
    var activeId = active && el.contains(active) ? active.id : null;
    var selStart = activeId && active.selectionStart != null ? active.selectionStart : null;
    renderNav();
    try {
      el.innerHTML = v.render(params);
      if (v.mount) v.mount(el, params);
      J.auth.gate(el);
    } catch (err) {
      console.error(err);
      el.innerHTML = '<div class="banner red">' + icon('alert') + '<div class="grow">' + esc(t('Something went wrong while displaying this page: {0}', err.message)) + '</div></div>';
    }
    Object.keys(keep).forEach(function (k) { var n = el.querySelector('[data-keep-scroll="' + k + '"]'); if (n) { n.scrollTop = keep[k][0]; n.scrollLeft = keep[k][1]; } });
    if (activeId) { var f = document.getElementById(activeId); if (f) { f.focus(); if (selStart != null && f.setSelectionRange) try { f.setSelectionRange(selStart, selStart); } catch (e) { /* ignore */ } } }
  }

  /** Re-render everything that depends on data. */
  app.refresh = function () {
    renderView(false);
    J.profile.refresh();
  };
  app.rerenderView = function () { renderView(false); };

  /* ------------------------------------------------------------ Mutations */
  /** Save a candidate to the central database.
      Resolves with the saved candidate. On failure the error is shown to the user and the returned
      promise stays pending, so follow-up steps (closing a dialog, "saved" messages) do not run. */
  app.save = function (c, msg) {
    L.beforeSave(c);
    return S.put(c).then(function (saved) {
      app.refresh();
      if (msg) ui.toast(msg, 'success');
      return saved;
    }, function (err) {
      app.refresh();
      if (err.status !== 409) ui.toast(J.api.message(err), 'error');
      return new Promise(function () {});
    });
  };
  app.create = function (c, msg) {
    L.beforeSave(c);
    return S.create(c).then(function (saved) {
      app.refresh();
      if (msg) ui.toast(msg, 'success');
      return saved;
    }, function (err) {
      ui.toast(J.api.message(err), 'error');
      return new Promise(function () {});
    });
  };

  app.warnIfNotReady = function (c) {
    var i = L.info(c);
    if (c.stage === 'ready' && i.overall !== 'ready') {
      ui.toast(t('Moved to Ready stage – note: {0} requirement(s) still outstanding. Overall status stays "Not Ready".', i.outstanding), 'warn');
    }
  };

  app.moveStage = function (id, stage) {
    var c = S.get(id);
    if (!c || c.stage === stage) return Promise.resolve();
    var prev = c.stage;
    c.stage = stage;
    L.log(c, 'system', t('Moved from {0} to {1}.', t(L.stage(prev).label), t(L.stage(stage).label)));
    return app.save(c, t('{0} moved to {1}.', U.fullName(c), t(L.stage(stage).label))).then(function () { app.warnIfNotReady(c); });
  };

  app.archive = function (id) {
    var c = S.get(id);
    var m = ui.modal({
      title: t('Archive candidate'),
      subtitle: esc(U.fullName(c)) + ' · ' + esc(c.id) + ' — ' + esc(t('archived candidates can be restored at any time.')),
      body: '<div class="fgrid two"><div class="field span-3"><label>' + esc(t('Archive reason')) + ' <span class="req">*</span></label><select id="arch-reason">' +
        ui.options(C.ARCHIVE_REASONS, c.stage === 'started' ? 'Started / Completed' : '', { blank: 'Select a reason…', tr: true }) + '</select></div>' +
        '<div class="field span-3"><label>' + esc(t('Note (optional)')) + '</label><textarea id="arch-note" rows="3" placeholder="' + esc(t('Additional context')) + '"></textarea></div></div>',
      foot: '<button class="btn" data-close>' + esc(t('Cancel')) + '</button><button class="btn dark" id="arch-ok">' + icon('archive', 'sm') + esc(t('Archive')) + '</button>'
    });
    m.q('#arch-ok').addEventListener('click', function () {
      var reason = m.q('#arch-reason').value;
      if (!reason) { m.q('#arch-reason').classList.add('invalid'); ui.toast(t('Please select an archive reason.'), 'error'); return; }
      c.archived = true; c.archiveReason = reason; c.archiveDate = U.todayISO(); c.archiveNote = m.q('#arch-note').value.trim();
      L.log(c, 'system', t('Archived – {0}', t(reason)) + (c.archiveNote ? ': ' + c.archiveNote : '') + '.');
      app.save(c, t('{0} archived.', U.fullName(c))).then(function () { m.close(); });
    });
  };

  app.restore = function (id) {
    var c = S.get(id);
    c.archived = false;
    L.log(c, 'system', t('Restored from archive (was: {0}).', t(c.archiveReason)));
    c.archiveReason = ''; c.archiveDate = ''; c.archiveNote = '';
    return app.save(c, t('{0} restored to active candidates.', U.fullName(c)));
  };

  app.deleteForever = function (id) {
    var c = S.get(id);
    ui.confirm({
      title: t('Delete permanently?'),
      message: t('This will permanently delete {0} ({1}) including all documents status, notes and activity history.', '<b>' + esc(U.fullName(c)) + '</b>', esc(c.id)) + '<br><br>' + esc(t('This cannot be undone – consider keeping the candidate in the Archive instead.')),
      ok: t('Delete permanently'), danger: true, typeToConfirm: 'DELETE'
    }).then(function (ok) {
      if (!ok) return;
      if (J.profile.currentId() === id) J.profile.close();
      S.remove(id).then(function () { app.refresh(); ui.toast(t('Candidate permanently deleted.'), 'success'); }, function (err) { ui.toast(J.api.message(err), 'error'); });
    });
  };

  /** Switch UI language (de / en / ar) and re-render everything. */
  app.setLanguage = function (lang) {
    J.i18n.set(lang);
    S.settings().language = J.i18n.lang;
    L.bump();
    return S.saveSettings().then(function () {
      app.refresh();
      ui.toast(t('Language changed to {0}.', J.i18n.info().label));
    });
  };
  A['set-language'] = function (el) { app.setLanguage(el.value); };

  /* ------------------------------------------------------------ Global actions */
  A['add-candidate'] = function () { J.form.open(); };
  A['edit-candidate'] = function (el) { J.form.open(el.getAttribute('data-id')); };
  A['archive-candidate'] = function (el) { app.archive(el.getAttribute('data-id')); };
  A['restore-candidate'] = function (el) { app.restore(el.getAttribute('data-id')); };
  A['delete-candidate'] = function (el) { app.deleteForever(el.getAttribute('data-id')); };
  A['follow-up'] = function (el) { J.form.followUp(el.getAttribute('data-id') || null); };
  A['go'] = function (el) {
    var p = el.getAttribute('data-params');
    app.go(el.getAttribute('data-route'), p ? JSON.parse(p) : null);
  };
  A['copy-text'] = function (el) {
    var txt = el.getAttribute('data-text');
    if (!txt) return;
    U.copy(txt).then(function (ok) { ui.toast(ok ? t('{0} copied to clipboard.', el.getAttribute('data-what')) : t('Could not copy – please copy manually: {0}', txt), ok ? 'success' : 'warn'); });
  };
  A['toggle-sidebar'] = function () {
    document.body.classList.toggle('sb-collapsed');
    try { localStorage.setItem('jarbou-sb-collapsed', document.body.classList.contains('sb-collapsed') ? '1' : '0'); } catch (e) { /* ignore */ }
  };
  A['open-mobile-nav'] = function () {
    document.body.classList.add('sb-open');
    var bd = document.createElement('div');
    bd.className = 'sidebar-backdrop';
    bd.addEventListener('click', function () { document.body.classList.remove('sb-open'); bd.remove(); });
    document.body.appendChild(bd);
  };
  A['row-menu'] = function (el) {
    var c = S.get(el.getAttribute('data-id'));
    var items = [
      { label: t('Open profile'), icon: 'user', onClick: function () { J.profile.open(c.id); } },
      { label: t('Print summary'), icon: 'printer', onClick: function () { J.print.candidate(c.id); } }
    ];
    if (!J.auth.can('candidate.write')) { ui.menu(el, items); return; }
    items.splice(1, 0, { label: t('Edit'), icon: 'edit', onClick: function () { J.form.open(c.id); } },
      { label: t('Add follow-up'), icon: 'bell', onClick: function () { J.form.followUp(c.id); } });
    items.push({ sep: true }, { header: t('Move to stage') });
    C.STAGES.forEach(function (st) { items.push({ label: t(st.label), checked: c.stage === st.key, onClick: function () { app.moveStage(c.id, st.key); } }); });
    items.push({ sep: true });
    if (c.archived) {
      items.push({ label: t('Restore'), icon: 'restore', onClick: function () { app.restore(c.id); } });
      if (J.auth.can('candidate.delete')) items.push({ label: t('Delete permanently…'), icon: 'trash', danger: true, onClick: function () { app.deleteForever(c.id); } });
    } else items.push({ label: t('Archive…'), icon: 'archive', onClick: function () { app.archive(c.id); } });
    ui.menu(el, items);
  };

  A['reload-page'] = function () { location.reload(); };
  A['sync-now'] = function () {
    Promise.all([S.sync(true), S.reloadSettings()]).then(function () { app.refresh(); ui.toast(t('Data refreshed from the server.'), 'info'); }, function (err) { ui.toast(J.api.message(err), 'error'); });
  };
  A['user-menu'] = function (el) {
    var u = J.auth.user;
    ui.menu(el, [
      { header: u.fullName + ' · ' + J.auth.roleLabel() },
      { label: t('Change password'), icon: 'lock', onClick: function () { J.auth.passwordDialog(false); } },
      { label: t('Settings'), icon: 'settings', onClick: function () { app.go('settings'); } },
      { sep: true },
      { label: t('Sign out'), icon: 'arrowRight', onClick: J.auth.logout }
    ]);
  };
  app.forcePasswordChange = function () {
    if (document.getElementById('pw-form')) return;
    J.auth.passwordDialog(true);
  };
  function renderUser() {
    var u = J.auth.user;
    var b = document.getElementById('user-btn');
    b.innerHTML = '<span class="avatar">' + esc((u.fullName || u.username).split(/\s+/).map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase()) + '</span>' +
      '<span class="un hide-sm">' + esc(u.fullName) + '</span><span class="role-pill ' + u.role + ' hide-sm">' + esc(J.auth.roleLabel()) + '</span>';
    document.getElementById('app-version').textContent = 'v' + (J.auth.version || '') + ' NAS';
  }

  /* ------------------------------------------------------------ Global search */
  function initSearch() {
    var input = document.getElementById('gs-input');
    var box = document.getElementById('gs-results');
    var results = [], active = 0;
    function draw() {
      var q = input.value.trim();
      if (!q) { box.hidden = true; return; }
      results = S.all().filter(function (c) { return L.matches(c, q); }).sort(function (a, b) { return (a.archived - b.archived) || U.fullName(a).localeCompare(U.fullName(b)); }).slice(0, 8);
      active = 0;
      box.hidden = false;
      box.innerHTML = results.length ? results.map(function (c, k) {
        var i = L.info(c);
        return '<div class="gs-item ' + (k === active ? 'active' : '') + '" data-k="' + k + '"><div class="avatar sm">' + esc(U.initials(c)) + '</div><div style="flex:1;min-width:0"><div class="strong">' + esc(U.fullName(c)) + '</div><div class="meta">' + esc(c.id) + ' · ' + esc(c.position || '—') + (c.station ? ' · ' + esc(c.station) : '') + (c.archived ? ' · ' + esc(t('Archived')) : '') + '</div></div>' + ui.overallBadge(i) + '</div>';
      }).join('') : '<div class="gs-empty">' + esc(t('No candidates match "{0}"', q)) + '</div>';
    }
    function pick(k) {
      var c = results[k];
      if (!c) return;
      input.value = ''; box.hidden = true; input.blur();
      J.profile.open(c.id);
    }
    input.addEventListener('input', draw);
    input.addEventListener('focus', draw);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { active = Math.min(results.length - 1, active + 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); e.preventDefault(); }
      else if (e.key === 'Enter') { pick(active); e.preventDefault(); return; }
      else if (e.key === 'Escape') { input.value = ''; box.hidden = true; input.blur(); e.stopPropagation(); return; }
      else return;
      box.querySelectorAll('.gs-item').forEach(function (n, k) { n.classList.toggle('active', k === active); });
    });
    box.addEventListener('mousedown', function (e) { var it = e.target.closest('.gs-item'); if (it) { e.preventDefault(); pick(+it.getAttribute('data-k')); } });
    input.addEventListener('blur', function () { setTimeout(function () { box.hidden = true; }, 120); });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); }
    });
  }

  /* ------------------------------------------------------------ Boot */
  function boot() {
    try { if (localStorage.getItem('jarbou-sb-collapsed') === '1') document.body.classList.add('sb-collapsed'); } catch (e) { /* ignore */ }
    J.i18n.applyStatic(document);
    document.getElementById('view').innerHTML = '<div class="empty"><p>' + esc(t('Loading…')) + '</p></div>';
    J.auth.init().then(function (user) {
      if (user.preferences && user.preferences.language) J.i18n.set(user.preferences.language);
      renderUser();
      if (user.mustChangePassword) {
        document.getElementById('view').innerHTML = '';
        J.auth.passwordDialog(true);
        return null;
      }
      return S.init().then(function () {
        J.i18n.set(S.settings().language);
        renderUser();
        document.getElementById('lang-select').addEventListener('change', function (e) { app.setLanguage(e.target.value); });
        document.getElementById('scope-select').addEventListener('change', function (e) {
          S.settings().activeProject = e.target.value;
          S.saveSettings().catch(function () {});
          app.refresh();
        });
        initSearch();
        window.addEventListener('hashchange', onRoute);
        current = null;
        onRoute();
        S.indicator();
        // re-render once per minute so date-based warnings stay current if left open overnight
        var lastDay = U.todayISO();
        setInterval(function () { if (U.todayISO() !== lastDay) { lastDay = U.todayISO(); app.refresh(); } }, 60000);
      });
    }).catch(function (err) {
      if (err && (err.status === 401 || err.code === 'password_change_required')) return; // redirected / dialog shown
      console.error(err);
      document.getElementById('view').innerHTML = '<div class="banner red">' + icon('alert') + '<div class="grow">' + esc(t('Unable to load data from the server: {0}', J.api.message(err))) + '</div><button class="btn sm" data-action="reload-page">' + esc(t('Try again')) + '</button></div>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
