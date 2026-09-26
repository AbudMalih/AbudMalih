/* Candidate database: search, filters, sorting, column chooser, pagination. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var t = J.t;
  function tv(v) { return v ? t(v) : v; }

  var EMPTY = { q: '', overall: '', stage: '', project: '', start: '', startFrom: '', startTo: '', employmentType: '', position: '', station: '', docs: '', contract: '', onboarding: '', recruiter: '', source: '', followUp: '' };
  var f = U.clone(EMPTY);
  var sort = { key: 'newest', dir: 1 };
  var page = 0;
  var showFilters = false;

  /* i18n: t('Today') t('Next 7 days') t('This week') t('This month') t('Next month') t('Next 30 days') t('Start date passed') t('No start date') t('Custom range…') */
  var START_PRESETS = [
    { key: 'today', label: 'Today' }, { key: 'next7', label: 'Next 7 days' }, { key: 'this_week', label: 'This week' },
    { key: 'this_month', label: 'This month' }, { key: 'next_month', label: 'Next month' }, { key: 'next30', label: 'Next 30 days' },
    { key: 'passed', label: 'Start date passed' }, { key: 'none', label: 'No start date' }, { key: 'custom', label: 'Custom range…' }
  ];
  /* i18n: t('Name (A–Z)') t('Newest candidate') t('Oldest candidate') t('Start date (soonest)') t('Status (pipeline stage)') t('Document completion (lowest)') t('Last updated') */
  var SORTS = [
    { key: 'name', label: 'Name (A–Z)' }, { key: 'newest', label: 'Newest candidate' }, { key: 'oldest', label: 'Oldest candidate' },
    { key: 'startDate', label: 'Start date (soonest)' }, { key: 'stage', label: 'Status (pipeline stage)' },
    { key: 'documents', label: 'Document completion (lowest)' }, { key: 'updated', label: 'Last updated' }
  ];
  /* i18n: t('Status') t('Stage') t('Project') t('Start') t('Type') t('Position') t('Station') t('Documents') t('Contract') t('Onboarding') t('Recruiter') t('Source') t('Follow-up') */
  var FILTER_LABELS = { overall: 'Status', stage: 'Stage', project: 'Project', start: 'Start', employmentType: 'Type', position: 'Position', station: 'Station', docs: 'Documents', contract: 'Contract', onboarding: 'Onboarding', recruiter: 'Recruiter', source: 'Source', followUp: 'Follow-up' };

  /** Date bounds of the start-date filter, computed once per filtering run (not per candidate). */
  function startRange() {
    var today = U.todayISO();
    switch (f.start) {
      case 'none': return { none: true };
      case 'passed': return { to: U.addDays(today, -1) };
      case 'today': return { from: today, to: today };
      case 'next7': return { from: today, to: U.addDays(today, 7) };
      case 'next30': return { from: today, to: U.addDays(today, 30) };
      case 'this_week': var sw = U.startOfWeek(today); return { from: sw, to: U.addDays(sw, 6) };
      case 'this_month': return { from: U.startOfMonth(today), to: U.endOfMonth(today) };
      case 'next_month': var nm = U.addDays(U.endOfMonth(today), 1); return { from: nm, to: U.endOfMonth(nm) };
      case 'custom': return { from: f.startFrom, to: f.startTo };
    }
    return null;
  }

  /* Cache of the last filtered + sorted list. Re-used while neither the filters, the sort order nor any
     candidate changed (paging, column changes and re-renders then cost nothing, even with 5,000 candidates). */
  var cache = { key: '', list: null, total: 0, settings: null };
  function dataKey(list) {
    var max = '';
    for (var n = 0; n < list.length; n++) { var u = list[n].updatedAt; if (u && u > max) max = u; }
    return list.length + '|' + max;
  }

  function filtered() {
    var list = L.scoped();
    var key = JSON.stringify(f) + '|' + sort.key + '|' + sort.dir + '|' + U.todayISO() + '|' + S.settings().activeProject + '|' + J.i18n.lang + '|' + dataKey(list);
    if (cache.key === key && cache.list && cache.settings === S.settings()) return cache.list;
    var sr = f.start ? startRange() : null;
    var toks = f.q ? U.normalize(f.q).split(/\s+/).filter(Boolean) : null;
    var out = list.filter(function (c) {
      if (toks && toks.length) {
        var hay = L.haystack(c);
        for (var k = 0; k < toks.length; k++) if (hay.indexOf(toks[k]) === -1) return false;
      }
      if (f.project && c.project !== f.project) return false;
      if (f.stage && c.stage !== f.stage) return false;
      if (f.employmentType && c.employmentType !== f.employmentType) return false;
      if (f.position && c.position !== f.position) return false;
      if (f.station && (f.station === '__none' ? c.station : c.station !== f.station)) return false;
      if (f.recruiter && (f.recruiter === '__none' ? c.recruiter : c.recruiter !== f.recruiter)) return false;
      if (f.source && c.source !== f.source) return false;
      if (sr) {
        var d = c.startDate;
        if (sr.none ? !!d : (!d || (sr.from && d < sr.from) || (sr.to && d > sr.to))) return false;
      }
      var i = L.info(c);
      if (f.overall && i.overall !== f.overall) return false;
      if (f.docs) {
        var out2 = i.docs.outstanding.filter(function (k) { return k !== 'contract'; }).length + i.docs.expired.length;
        if (f.docs === 'missing' && !out2) return false;
        if (f.docs === 'complete' && out2) return false;
        if (f.docs === 'expiring' && !i.docs.expiring.length && !i.docs.expired.length) return false;
        if (f.docs.indexOf('doc:') === 0) { var e = c.documents[f.docs.slice(4)]; if (!e || (e.status !== 'missing' && e.status !== 'requested')) return false; }
      }
      if (f.contract) {
        if (f.contract === 'pending' && (i.contract.signed || i.overall === 'started' || (L.stageIndex(c.stage) < L.stageIndex('interested') && c.contract.status === 'not_started'))) return false;
        if (f.contract === 'unsigned' && i.contract.signed) return false;
        if (f.contract.indexOf('st:') === 0 && c.contract.status !== f.contract.slice(3)) return false;
      }
      if (f.onboarding) {
        var inOb = i.onboarding.state === 'in_progress' || ((c.stage === 'ready' || c.stage === 'started' || c.stage === 'contract') && !i.onboarding.complete);
        if (f.onboarding === 'in_progress' && !inOb) return false;
        if (f.onboarding === 'not_started' && i.onboarding.state !== 'not_started') return false;
        if (f.onboarding === 'complete' && !i.onboarding.complete) return false;
      }
      if (f.followUp && i.followUp !== f.followUp && !(f.followUp === 'any' && i.followUp)) return false;
      return true;
    });
    out = sortList(out);
    cache = { key: key, list: out, total: list.length, settings: S.settings() };
    return out;
  }

  function sortList(list) {
    var k = sort.key, dir = sort.dir;
    var val = {
      name: function (c) { return (c.lastName + ' ' + c.firstName).toLowerCase(); },
      id: function (c) { return c.id; },
      newest: function (c) { return c.createdAt || ''; },
      oldest: function (c) { return c.createdAt || '9999'; },
      updated: function (c) { return c.updatedAt || ''; },
      createdBy: function (c) { return (c.createdBy || '~').toLowerCase(); },
      startDate: function (c) { return c.startDate || '9999'; },
      stage: function (c) { return L.stageIndex(c.stage); },
      documents: function (c) { return L.info(c).docs.pct; },
      onboarding: function (c) { return L.info(c).onboarding.pct; },
      contract: function (c) { return C.CONTRACT_STATUSES.map(function (x) { return x.key; }).indexOf(c.contract.status); },
      overall: function (c) { return { ready: 0, not_ready: 1, started: 2, archived: 3 }[L.info(c).overall] * 1000 + L.info(c).outstanding; },
      salary: function (c) { var v = L.salaryValue(c); return v == null ? Infinity : v; },
      lastContact: function (c) { return c.lastContact || ''; },
      followUp: function (c) { return c.followUpDate || '9999'; },
      position: function (c) { return (c.position || '~').toLowerCase(); },
      station: function (c) { return (c.station || '~').toLowerCase(); },
      project: function (c) { return (c.project || '~').toLowerCase(); },
      employmentType: function (c) { return c.employmentType || '~'; },
      recruiter: function (c) { return (c.recruiter || '~').toLowerCase(); },
      source: function (c) { return (c.source || '~').toLowerCase(); }
    }[k] || function (c) { return c.id; };
    var defaultDesc = k === 'newest' || k === 'lastContact' || k === 'updated';
    var d = defaultDesc ? -dir : dir;
    return list.map(function (c) { return [val(c), c]; }).sort(function (a, b) {
      if (a[0] < b[0]) return -d;
      if (a[0] > b[0]) return d;
      return a[1].id < b[1].id ? -1 : 1;
    }).map(function (x) { return x[1]; });
  }

  function cell(key, c, i) {
    switch (key) {
      case 'id': return '<td class="mono">' + esc(c.id) + '</td>';
      case 'name': return '<td class="name-cell sticky-col">' + esc(U.fullName(c)) + '<div class="sub">' + (c.phone ? esc(c.phone) : c.email ? esc(c.email) : t('Contact pending')) + '</div></td>';
      case 'position': return '<td>' + ui.val(c.position) + '</td>';
      case 'station': return '<td>' + ui.val(c.station, 'Pending') + '</td>';
      case 'project': return '<td>' + ui.projectPill(c.project) + '</td>';
      case 'employmentType': return '<td>' + ui.val(tv(c.employmentType)) + '</td>';
      case 'salary': return '<td>' + (L.salaryText(c) ? '<span data-tip="' + esc(t('Expectation · reference {0}', c.salaryReference != null ? U.fmtMoney(c.salaryReference) + ' ' + c.salaryBasis : '—')) + '">' + esc(L.salaryText(c)) + '</span>' : '<span class="muted">—</span>') + '</td>';
      case 'startDate': return '<td>' + (c.startDate ? U.fmtDate(c.startDate) + ' <span class="muted small">' + (i.daysToStart >= 0 ? '(' + U.relDays(i.daysToStart) + ')' : '') + '</span>' : '<span class="muted">' + t('Pending') + '</span>') + '</td>';
      case 'documents': return '<td>' + ui.miniProgress(i.docs.complete, i.docs.total, i.docs.outstanding.length ? t('Outstanding: {0}', i.docs.outstanding.map(L.shortDocLabel).join(', ')) : t('All documents complete')) + '</td>';
      case 'contract': return '<td>' + ui.contractBadge(c.contract.status) + '</td>';
      case 'onboarding': return '<td>' + ui.miniProgress(i.onboarding.done, i.onboarding.total) + '</td>';
      case 'stage': return '<td>' + ui.stageBadge(c.stage) + '</td>';
      case 'overall': return '<td>' + ui.overallBadge(i, true) + '</td>';
      case 'lastContact': return '<td>' + (c.lastContact ? U.fmtDate(c.lastContact) : '<span class="muted">—</span>') + '</td>';
      case 'followUp': return '<td>' + (c.followUpDate ? U.fmtDate(c.followUpDate) + (i.followUp === 'overdue' ? ' ' + ui.badge(t('Overdue'), 'red') : '') : '<span class="muted">—</span>') + '</td>';
      case 'phone': return '<td>' + ui.val(c.phone, 'Pending') + '</td>';
      case 'source': return '<td>' + ui.val(tv(c.source)) + '</td>';
      case 'recruiter': return '<td>' + ui.val(c.recruiter, 'Unassigned') + '</td>';
      case 'updatedAt': return '<td>' + (c.updatedAt ? esc(U.fmtDateTime(c.updatedAt)) + (c.updatedBy ? '<div class="small muted">' + esc(t('by {0}', c.updatedBy)) + '</div>' : '') : '<span class="muted">—</span>') + '</td>';
      case 'createdBy': return '<td>' + ui.val(c.createdBy) + (c.createdAt ? '<div class="small muted">' + esc(U.fmtDate(U.toISODate(new Date(c.createdAt)))) + '</div>' : '') + '</td>';
      case 'actions': return '<td class="actions-cell"><button class="icon-btn" data-action="row-menu" data-id="' + esc(c.id) + '" data-stop aria-label="' + esc(t('Actions for {0}', U.fullName(c))) + '">' + icon('more') + '</button></td>';
    }
    return '<td></td>';
  }

  function chips() {
    var s = S.settings();
    var out = [];
    Object.keys(FILTER_LABELS).forEach(function (k) {
      if (!f[k]) return;
      var v = f[k];
      if (k === 'overall') v = C.OVERALL[v] ? t(C.OVERALL[v].label) : v;
      if (k === 'stage') v = t(L.stage(v).label);
      if (k === 'start') v = f.start === 'custom' ? (f.startFrom ? U.fmtDate(f.startFrom) : '…') + ' – ' + (f.startTo ? U.fmtDate(f.startTo) : '…') : t((START_PRESETS.filter(function (p) { return p.key === f.start; })[0] || {}).label);
      if (k === 'employmentType' || k === 'source') v = t(v);
      if (k === 'docs') v = v === 'missing' ? t('Missing / outstanding') : v === 'complete' ? t('Complete') : v === 'expiring' ? t('Expiring / expired') : t('{0} outstanding', L.shortDocLabel(v.slice(4)));
      if (k === 'contract') v = v === 'pending' ? t('Pending') : v === 'unsigned' ? t('Not signed') : t(L.contractStatus(v.slice(3)).label);
      if (k === 'onboarding') v = { in_progress: t('In progress'), not_started: t('Not started'), complete: t('Complete') }[v];
      if ((k === 'recruiter' || k === 'station') && v === '__none') v = k === 'recruiter' ? t('Unassigned') : t('Not assigned');
      if (k === 'followUp') v = { overdue: t('Overdue'), today: t('Due today'), any: t('Any scheduled') }[v];
      out.push('<button class="chip" data-action="cand-clear-filter" data-k="' + k + '">' + esc(t(FILTER_LABELS[k])) + ': <b>' + esc(v) + '</b>' + icon('x', 'sm') + '</button>');
    });
    void s;
    return out;
  }

  function filtersPanel() {
    var s = S.settings();
    function sel(k, label, opts) { return '<label>' + esc(label) + '<select class="sm" data-change="cand-filter" data-k="' + k + '">' + opts + '</select></label>'; }
    return '<div class="filters-panel">' +
      sel('overall', t('Overall status'), ui.options([{ key: 'ready', label: 'Ready to Start' }, { key: 'not_ready', label: 'Not Ready' }, { key: 'started', label: 'Started' }], f.overall, { blank: 'Any' })) +
      sel('stage', t('Recruitment status'), ui.options(C.STAGES, f.stage, { blank: 'Any stage' })) +
      sel('project', t('Project'), ui.options(s.projects, f.project, { blank: 'Any' })) +
      sel('start', t('Start date'), ui.options(START_PRESETS, f.start, { blank: 'Any' })) +
      (f.start === 'custom' ? '<label>' + t('From') + '<input type="date" class="sm" value="' + esc(f.startFrom) + '" data-change="cand-filter" data-k="startFrom"></label><label>' + t('To') + '<input type="date" class="sm" value="' + esc(f.startTo) + '" data-change="cand-filter" data-k="startTo"></label>' : '') +
      sel('employmentType', t('Employment type'), ui.options(C.EMPLOYMENT_TYPES, f.employmentType, { blank: 'Any', tr: true })) +
      sel('position', t('Position'), ui.options(s.positions, f.position, { blank: 'Any' })) +
      sel('station', t('Location / Station'), ui.options([{ key: '__none', label: 'Not assigned' }].concat(s.stations), f.station, { blank: 'Any' })) +
      sel('docs', t('Documents'), ui.options([{ key: 'missing', label: t('Missing / outstanding') }, { key: 'complete', label: t('Complete') }, { key: 'expiring', label: t('Expiring / expired') }]
        .concat(s.documents.map(function (d) { return { key: 'doc:' + d.key, label: t('{0} outstanding', L.shortOf(d)) }; })), f.docs, { blank: 'Any', raw: true })) +
      /* i18n: t('Pending (in process)') t('Not signed (all)') */
      sel('contract', t('Contract status'), ui.options([{ key: 'pending', label: 'Pending (in process)' }, { key: 'unsigned', label: 'Not signed (all)' }].concat(C.CONTRACT_STATUSES.map(function (x) { return { key: 'st:' + x.key, label: x.label }; })), f.contract, { blank: 'Any' })) +
      sel('onboarding', t('Onboarding status'), ui.options([{ key: 'not_started', label: 'Not started' }, { key: 'in_progress', label: 'In progress' }, { key: 'complete', label: 'Complete' }], f.onboarding, { blank: 'Any' })) +
      sel('recruiter', t('Recruiter'), ui.options([{ key: '__none', label: 'Unassigned' }].concat(s.recruiters), f.recruiter, { blank: 'Any' })) +
      sel('source', t('Source'), ui.options(s.sources, f.source, { blank: 'Any', tr: true })) +
      sel('followUp', t('Follow-up'), ui.options([{ key: 'overdue', label: 'Overdue' }, { key: 'today', label: 'Due today' }, { key: 'any', label: 'Any scheduled' }], f.followUp, { blank: 'Any' })) +
      '</div>';
  }

  J.views.candidates = {
    filtered: filtered,
    onEnter: function (p) {
      if (p && Object.keys(p).length) {
        f = U.clone(EMPTY);
        Object.keys(p).forEach(function (k) { if (k in f) f[k] = p[k]; });
        page = 0;
        showFilters = Object.keys(p).some(function (k) { return k !== 'q' && k in f; });
      }
    },
    render: function () {
      var s = S.settings();
      var cols = C.TABLE_COLUMNS.filter(function (c) { return c.locked || s.tableColumns.indexOf(c.key) !== -1; });
      var list = filtered();
      var total = cache.total;
      var size = s.pageSize || 50;
      var pages = Math.max(1, Math.ceil(list.length / size));
      if (page >= pages) page = pages - 1;
      var slice = list.slice(page * size, page * size + size);
      var ch = chips();
      var activeCount = ch.length;

      var head = '<div class="page-head"><div><h1>' + t('Candidates') + '</h1><div class="sub">' + (s.activeProject !== 'all' ? t('All active candidates in project {0}. Click a row to open the profile.', esc(s.activeProject)) : t('All active candidates. Click a row to open the profile.')) + '</div></div>' +
        '<div class="actions">' + (J.auth.can('export') ? '<button class="btn" data-action="cand-export">' + icon('download', 'sm') + t('Export') + '</button>' : '') +
        (J.auth.can('candidate.write') ? '<button class="btn primary" data-action="add-candidate">' + icon('plus') + t('Add Candidate') + '</button>' : '') + '</div></div>';

      var toolbar = '<div class="toolbar">' +
        '<div class="search-input">' + icon('search') + '<input type="search" id="cand-q" placeholder="' + esc(t('Search name, ID, phone, project, station, recruiter, notes…')) + '" value="' + esc(f.q) + '" data-input="cand-search" aria-label="' + esc(t('Search candidates')) + '">' +
        (f.q ? '<button class="icon-btn clear" style="width:26px;height:26px" data-action="cand-clear-filter" data-k="q" aria-label="' + esc(t('Clear search')) + '">' + icon('x', 'sm') + '</button>' : '') + '</div>' +
        '<button class="btn ' + (showFilters ? 'dark' : '') + '" data-action="cand-toggle-filters">' + icon('filter', 'sm') + t('Filters') + (activeCount ? ' · ' + activeCount : '') + '</button>' +
        '<label class="row small muted" style="gap:6px">' + t('Sort') + '<select class="sm" data-change="cand-sort" aria-label="' + esc(t('Sort by')) + '">' + ui.options(SORTS, SORTS.some(function (x) { return x.key === sort.key; }) ? sort.key : '', { blank: 'Custom (column)' }) + '</select></label>' +
        '<button class="icon-btn bordered" data-action="cand-sort-dir" aria-label="' + esc(t('Reverse sort order')) + '" data-tip="' + esc(t('Reverse order')) + '">' + icon(sort.dir === 1 ? 'arrowDown' : 'arrowUp', 'sm') + '</button>' +
        '<div style="flex:1"></div>' +
        '<button class="btn" data-action="cand-columns">' + icon('columns', 'sm') + t('Columns') + '</button></div>';

      var chipBar = activeCount ? '<div class="chips">' + ch.join('') + '<button class="btn xs ghost" data-action="cand-clear-all">' + t('Clear Filters') + '</button></div>' : '';

      var table;
      if (!list.length) {
        table = total ? ui.empty('search', t('No candidates match'), t('Try adjusting your search or filters.'), '<button class="btn" data-action="cand-clear-all">' + t('Clear Filters') + '</button>')
          : ui.empty('users', t('No candidates yet'), t('Add your first candidate to start tracking recruitment.'), '<button class="btn primary" data-action="add-candidate">' + icon('plus') + t('Add Candidate') + '</button>');
      } else {
        table = '<div class="table-wrap" data-keep-scroll="cand"><table class="data"><thead><tr>' + cols.map(function (c) {
          var sortable = !!c.sort;
          var ind = sort.key === c.sort ? (sort.dir === 1 ? '▲' : '▼') : '';
          return '<th class="' + (sortable ? 'sortable ' : '') + (c.key === 'name' ? 'sticky-col' : '') + '"' + (sortable ? ' data-action="cand-sort-col" data-k="' + c.sort + '" aria-sort="' + (ind ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none') + '"' : '') + '>' + (c.key === 'actions' ? '<span class="sr-only">' + t('Actions') + '</span>' : esc(t(c.label))) + ' <span class="sort-ind">' + ind + '</span></th>';
        }).join('') + '</tr></thead><tbody>' +
          slice.map(function (c) {
            var i = L.info(c);
            return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '">' + cols.map(function (col) { return cell(col.key, c, i); }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="pager"><span>' + t('Showing {0} of {1}', '<b>' + (page * size + 1) + '–' + Math.min(list.length, page * size + size) + '</b>', '<b>' + list.length + '</b>') + (list.length !== total ? ' ' + t('(filtered from {0})', total) : '') + '</span>' +
          '<div class="row"><select class="sm" data-change="cand-pagesize" aria-label="' + esc(t('Rows per page')) + '">' + ui.options([25, 50, 100, 250].map(function (n) { return { key: n, label: t('{0} / page', n) }; }), size, { raw: true }) + '</select>' +
          '<button class="btn sm" data-action="cand-page" data-d="-1"' + (page === 0 ? ' disabled' : '') + '>' + t('Previous') + '</button><span>' + t('Page {0} of {1}', page + 1, pages) + '</span>' +
          '<button class="btn sm" data-action="cand-page" data-d="1"' + (page >= pages - 1 ? ' disabled' : '') + '>' + t('Next') + '</button></div></div>';
      }
      return head + '<div class="card">' + toolbar + (showFilters ? filtersPanel() : '') + chipBar + table + '</div>';
    }
  };

  var rerender = function () { J.app.rerenderView(); };
  var searchDeb = U.debounce(rerender, 140);
  A['cand-search'] = function (el) { f.q = el.value; page = 0; searchDeb(); };
  A['cand-filter'] = function (el) {
    var k = el.getAttribute('data-k');
    f[k] = el.value; page = 0;
    if (k === 'start' && el.value !== 'custom') { f.startFrom = ''; f.startTo = ''; }
    rerender();
  };
  A['cand-clear-filter'] = function (el) {
    var k = el.getAttribute('data-k');
    f[k] = '';
    if (k === 'start') { f.startFrom = ''; f.startTo = ''; }
    page = 0; rerender();
  };
  A['cand-clear-all'] = function () { f = U.clone(EMPTY); page = 0; rerender(); };
  A['cand-toggle-filters'] = function () { showFilters = !showFilters; rerender(); };
  A['cand-sort'] = function (el) { if (el.value) { sort.key = el.value; sort.dir = 1; page = 0; rerender(); } };
  A['cand-sort-dir'] = function () { sort.dir = -sort.dir; rerender(); };
  A['cand-sort-col'] = function (el) {
    var k = el.getAttribute('data-k');
    if (sort.key === k) sort.dir = -sort.dir; else { sort.key = k; sort.dir = 1; }
    rerender();
  };
  A['cand-page'] = function (el) { page += +el.getAttribute('data-d'); rerender(); var w = document.querySelector('[data-keep-scroll="cand"]'); if (w) w.scrollTop = 0; };
  A['cand-pagesize'] = function (el) { S.settings().pageSize = +el.value; S.saveSettings(); page = 0; rerender(); };
  A['cand-columns'] = function (el) {
    var s = S.settings();
    var items = [{ header: t('Visible columns') }];
    C.TABLE_COLUMNS.forEach(function (col) {
      if (col.locked) return;
      items.push({
        label: t(col.label), checked: s.tableColumns.indexOf(col.key) !== -1, keepOpen: true,
        onClick: function (btn) {
          var idx = s.tableColumns.indexOf(col.key);
          if (idx === -1) s.tableColumns.push(col.key); else s.tableColumns.splice(idx, 1);
          s.tableColumns = C.TABLE_COLUMNS.map(function (x) { return x.key; }).filter(function (k) { return s.tableColumns.indexOf(k) !== -1; });
          S.saveSettings();
          btn.querySelector('.check') ? btn.querySelector('.check').remove() : btn.insertAdjacentHTML('beforeend', '<span class="check">' + icon('check', 'sm') + '</span>');
          rerender();
        }
      });
    });
    items.push({ sep: true });
    items.push({ label: t('Reset to default'), icon: 'restore', onClick: function () { s.tableColumns = C.defaultSettings().tableColumns; S.saveSettings(); rerender(); } });
    ui.menu(el, items);
  };
  A['cand-export'] = function (el) { J.io.exportMenu(el, filtered(), 'filtered'); };
})();
