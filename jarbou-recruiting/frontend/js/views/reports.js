/* Reports: date-range metrics, weekly intake, pipeline, source analytics. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon, t = J.t;
  var range = { preset: 'last90', from: '', to: '' };
  /* i18n: t('This month') t('Last 30 days') t('Last 90 days') t('This year') t('All time') t('Custom range') */
  var PRESETS = [
    { key: 'this_month', label: 'This month' }, { key: 'last30', label: 'Last 30 days' }, { key: 'last90', label: 'Last 90 days' },
    { key: 'this_year', label: 'This year' }, { key: 'all', label: 'All time' }, { key: 'custom', label: 'Custom range' }
  ];
  var NEGATIVE = { 'Rejected': 1, 'Candidate Withdrew': 1, 'Not Suitable': 1, 'No Response': 1 };

  function resolve() {
    var today = U.todayISO();
    switch (range.preset) {
      case 'this_month': return { from: U.startOfMonth(today), to: U.endOfMonth(today) };
      case 'last30': return { from: U.addDays(today, -29), to: today };
      case 'last90': return { from: U.addDays(today, -89), to: today };
      case 'this_year': return { from: today.slice(0, 4) + '-01-01', to: today.slice(0, 4) + '-12-31' };
      case 'custom': return { from: range.from, to: range.to };
    }
    return { from: '', to: '' };
  }

  /* Renamed source: older records may still carry "Recommendation". */
  var SOURCE_ALIAS = { Recommendation: 'Referral' };
  function addedDate(c) { return c.applicationDate || (c.createdAt || '').slice(0, 10); }
  function startedDate(c) { return c.stage === 'started' ? (c.startedOn || c.startDate) : ''; }

  L.report = function (r) {
    var all = L.scoped(true);
    var active = all.filter(function (c) { return !c.archived; });
    var m = { added: [], interviews: 0, interviewsDone: 0, ready: 0, started: 0, negative: 0, negByReason: {}, rejected: 0, withdrawn: 0, otherNegative: 0, signed: 0, missingDocs: 0, docsOutstanding: 0, adminReady: 0 };
    var byProject = {}, byStation = {};
    function bucket(map, key) { return map[key] = map[key] || { added: 0, active: 0, adminReady: 0, started: 0, missingDocs: 0, signed: 0 }; }
    all.forEach(function (c) {
      if (U.inRange(addedDate(c), r.from, r.to)) m.added.push(c);
      if (c.interviewDate && U.inRange(c.interviewDate, r.from, r.to) && c.interviewStatus !== 'Cancelled') { m.interviews++; if (c.interviewStatus === 'Completed') m.interviewsDone++; }
      if (c.readySince && U.inRange(c.readySince, r.from, r.to)) m.ready++;
      if (U.inRange(startedDate(c), r.from, r.to)) m.started++;
      if (c.archived && NEGATIVE[c.archiveReason] && U.inRange(c.archiveDate, r.from, r.to)) {
        m.negative++; m.negByReason[c.archiveReason] = (m.negByReason[c.archiveReason] || 0) + 1;
        if (c.archiveReason === 'Rejected') m.rejected++; else if (c.archiveReason === 'Candidate Withdrew') m.withdrawn++; else m.otherNegative++;
      }
      var signedIn = !!(c.contract && c.contract.signedDate && U.inRange(c.contract.signedDate, r.from, r.to));
      if (signedIn) m.signed++;
      var addedIn = U.inRange(addedDate(c), r.from, r.to);
      var p = bucket(byProject, c.project || ''), st = bucket(byStation, c.station || '');
      [p, st].forEach(function (b) {
        if (addedIn) b.added++;
        if (signedIn) b.signed++;
        if (c.archived) return;
        var i = L.info(c);
        b.active++;
        if (i.admin.ready || c.stage === 'started') b.adminReady++;
        if (c.stage === 'started') b.started++;
        if (i.docs.outstanding.some(function (k) { return k !== 'contract'; }) || i.docs.expired.length) b.missingDocs++;
      });
    });
    m.byProject = byProject;
    m.byStation = byStation;
    var docCount = {};
    active.forEach(function (c) {
      var i = L.info(c);
      var out = i.docs.outstanding.filter(function (k) { return k !== 'contract'; });
      if (out.length) { m.missingDocs++; m.docsOutstanding += out.length; }
      if (i.admin.ready || c.stage === 'started') m.adminReady++;
      out.forEach(function (k) { docCount[k] = (docCount[k] || 0) + 1; });
    });
    m.docCount = docCount;
    // Source performance (candidates added in range)
    var src = {};
    S.settings().sources.forEach(function (s) { src[s] = { candidates: 0, ready: 0, started: 0 }; });
    m.added.forEach(function (c) {
      var k = SOURCE_ALIAS[c.source] || c.source || 'Unknown';
      src[k] = src[k] || { candidates: 0, ready: 0, started: 0 };
      src[k].candidates++;
      var o = L.info(c).overall;
      if (o === 'ready') src[k].ready++;
      if (c.stage === 'started' || (c.archived && c.archiveReason === 'Started / Completed')) src[k].started++;
    });
    m.sources = src;
    var stages = {};
    C.STAGES.forEach(function (s) { stages[s.key] = 0; });
    active.forEach(function (c) { stages[c.stage] = (stages[c.stage] || 0) + 1; });
    m.stages = stages;
    m.active = active.length;
    m.target = L.target(active);
    m.targets = L.targets(active);
    m.projectRows = perfRows(byProject, 'project', m.targets);
    m.stationRows = perfRows(byStation, 'station', m.targets);
    return m;
  };

  /** Rows for the project / station performance tables, incl. configured targets (required / remaining). */
  function perfRows(map, kind, targets) {
    var s = S.settings();
    var names = (kind === 'project' ? s.projects : s.stations).slice();
    Object.keys(map).forEach(function (k) { if (names.indexOf(k) === -1) names.push(k); });
    return names.map(function (name) {
      var b = map[name] || { added: 0, active: 0, adminReady: 0, started: 0, missingDocs: 0, signed: 0 };
      var tg = targets.filter(function (x) { return kind === 'project' ? x.project === name && !x.station : x.station && x.station === name; });
      var row = Object.assign({ name: name }, b);
      if (tg.length) {
        row.required = tg.reduce(function (a, x) { return a + x.required; }, 0);
        row.remaining = tg.reduce(function (a, x) { return a + x.remaining; }, 0);
      }
      return row;
    }).filter(function (x) { return x.added || x.active || x.signed || x.required; })
      .sort(function (a, b) { return (a.name === '') - (b.name === '') || b.active - a.active || a.name.localeCompare(b.name); });
  };

  function weekly(r, added) {
    var from = r.from || added.reduce(function (min, c) { var d = addedDate(c); return d && d < min ? d : min; }, U.todayISO());
    var to = r.to && r.to < U.todayISO() ? r.to : U.todayISO();
    if (r.to && r.to > U.todayISO()) to = U.todayISO();
    var days = Math.max(1, (U.parseDate(to) - U.parseDate(from)) / 864e5);
    var monthly = days > 190;
    var buckets = [], map = {};
    var cur = monthly ? U.startOfMonth(from) : U.startOfWeek(from);
    var guard = 0;
    while (cur <= to && guard++ < 400) {
      var key = cur;
      var label = monthly ? U.monthShort(cur) : U.fmtDate(cur).slice(0, 6);
      buckets.push({ key: key, label: label, n: 0 });
      map[key] = buckets[buckets.length - 1];
      cur = monthly ? U.addDays(U.endOfMonth(cur), 1) : U.addDays(cur, 7);
    }
    added.forEach(function (c) {
      var d = addedDate(c); if (!d) return;
      var k = monthly ? U.startOfMonth(d) : U.startOfWeek(d);
      if (map[k]) map[k].n++;
    });
    return { buckets: buckets.slice(-26), monthly: monthly };
  }

  function barChart(data) {
    var b = data.buckets;
    if (!b.length) return '<div class="small muted">' + esc(t('No data in range.')) + '</div>';
    var W = 640, H = 200, padL = 28, padB = 26, padT = 14;
    var max = Math.max(1, Math.max.apply(null, b.map(function (x) { return x.n; })));
    var nice = max <= 4 ? max : Math.ceil(max / 4) * 4;
    var cw = (W - padL) / b.length;
    var bw = Math.max(4, Math.min(36, cw - 6));
    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var val = Math.round((nice / 4) * g);
      if (nice < 4 && g > nice) break;
      var y = padT + (H - padT - padB) * (1 - (nice < 4 ? g / nice : g / 4));
      grid += '<line class="gridline" x1="' + padL + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/><text class="axis-label" x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + (nice < 4 ? g : val) + '</text>';
    }
    var labelEvery = Math.ceil(b.length / 10);
    var bars = b.map(function (x, k) {
      var h = (H - padT - padB) * (x.n / nice);
      var cx = padL + cw * k + cw / 2;
      var y = H - padB - h;
      var r = Math.min(4, bw / 2, h);
      var path = h > 0 ? 'M' + (cx - bw / 2) + ',' + (H - padB) + ' V' + (y + r) + ' Q' + (cx - bw / 2) + ',' + y + ' ' + (cx - bw / 2 + r) + ',' + y + ' H' + (cx + bw / 2 - r) + ' Q' + (cx + bw / 2) + ',' + y + ' ' + (cx + bw / 2) + ',' + (y + r) + ' V' + (H - padB) + ' Z' : '';
      return (path ? '<path d="' + path + '" fill="var(--chart-bar)"/>' : '') +
        (x.n && b.length <= 16 ? '<text class="val-label" x="' + cx + '" y="' + (y - 4) + '" text-anchor="middle">' + x.n + '</text>' : '') +
        (k % labelEvery === 0 ? '<text class="axis-label" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(x.label) + '</text>' : '') +
        '<rect class="hit" x="' + (padL + cw * k) + '" y="' + padT + '" width="' + cw + '" height="' + (H - padT - padB) + '" data-tip="' + esc(data.monthly ? (x.n === 1 ? t('{0}: {1} candidate added', x.label, x.n) : t('{0}: {1} candidates added', x.label, x.n)) : (x.n === 1 ? t('Week of {0}: {1} candidate added', x.label, x.n) : t('Week of {0}: {1} candidates added', x.label, x.n))) + '"/>';
    }).join('');
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(data.monthly ? t('Candidates added per month') : t('Candidates added per week')) + '">' + grid + '<line x1="' + padL + '" x2="' + W + '" y1="' + (H - padB) + '" y2="' + (H - padB) + '" stroke="var(--border-strong)"/>' + bars + '</svg></div>';
  }

  function hbars(rows, color) {
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r[1]; })));
    return rows.map(function (r) {
      return '<div class="hbar-row" data-tip="' + esc(r[0] + ': ' + r[1]) + '"><div class="lbl">' + esc(r[0]) + '</div><div class="track"><div class="fill" style="width:' + (r[1] / max * 100) + '%;' + (color ? 'background:' + color : '') + '"></div></div><div class="num">' + r[1] + '</div></div>';
    }).join('');
  }

  function sourceChart(src) {
    var keys = Object.keys(src).filter(function (k) { return src[k].candidates > 0; }).sort(function (a, b) { return src[b].candidates - src[a].candidates; });
    if (!keys.length) return '<div class="small muted">' + esc(t('No candidates added in this period.')) + '</div>';
    var max = Math.max(1, Math.max.apply(null, keys.map(function (k) { return src[k].candidates; })));
    /* i18n: t('Candidates') t('Ready') t('Started') */
    var series = [['candidates', 'Candidates', 'var(--series-1)'], ['ready', 'Ready', 'var(--series-3)'], ['started', 'Started', 'var(--series-2)']];
    return '<div class="legend" style="margin:0 0 8px">' + series.map(function (s) { return '<span><i style="background:' + s[2] + '"></i>' + esc(t(s[1])) + '</span>'; }).join('') + '</div>' +
      keys.map(function (k) {
        var x = src[k];
        return '<div class="gbar"><div class="lbl">' + esc(t(k)) + '</div><div class="bars">' + series.map(function (s) {
          return '<div class="b" data-tip="' + esc(t(k) + ' – ' + t(s[1]) + ': ' + x[s[0]]) + '"><span class="f" style="width:' + (x[s[0]] / max * 100) + '%;background:' + s[2] + '"></span><em>' + x[s[0]] + '</em></div>';
        }).join('') + '</div></div>';
      }).join('') +
      '<table class="data compact static mt-16"><thead><tr><th>' + esc(t('Source')) + '</th><th class="center">' + esc(t('Candidates')) + '</th><th class="center">' + esc(t('Ready')) + '</th><th class="center">' + esc(t('Started')) + '</th><th class="center">' + esc(t('Conversion')) + '</th></tr></thead><tbody>' +
      keys.map(function (k) { var x = src[k]; return '<tr><td>' + esc(t(k)) + '</td><td class="center">' + x.candidates + '</td><td class="center">' + x.ready + '</td><td class="center">' + x.started + '</td><td class="center">' + U.pct(x.ready + x.started, x.candidates) + '%</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  function perfTable(rows, kind) {
    if (!rows.length) return '<div class="small muted">' + esc(t('No data in range.')) + '</div>';
    var hasTarget = rows.some(function (x) { return x.required != null; });
    var th = function (l, tip) { return '<th class="center"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + esc(l) + '</th>'; };
    return '<div class="table-wrap" style="max-height:none;min-height:0"><table class="data compact static"><thead><tr><th>' + esc(kind === 'project' ? t('Project') : t('Station')) + '</th>' +
      th(t('Added'), t('Candidates added in period')) + th(t('Active'), t('Active candidates (current)')) + th(t('Admin. ready'), t('Administratively ready or started (current)')) +
      th(t('Started'), t('Active candidates marked as started (current)')) + th(t('Missing docs'), t('Active candidates with outstanding documents (current)')) + th(t('Contracts signed'), t('By signed date in period')) +
      (hasTarget ? th(t('Required'), t('Configured recruitment target')) + th(t('Remaining'), t('Still needed to reach the target (target position only)')) : '') + '</tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><td class="strong">' + (x.name ? esc(x.name) : '<span class="muted">' + esc(kind === 'project' ? t('No project') : t('Not assigned')) + '</span>') + '</td>' +
          '<td class="center">' + x.added + '</td><td class="center">' + x.active + '</td><td class="center">' + x.adminReady + '</td><td class="center">' + x.started + '</td>' +
          '<td class="center"' + (x.missingDocs ? ' style="color:var(--red)"' : '') + '>' + x.missingDocs + '</td><td class="center">' + x.signed + '</td>' +
          (hasTarget ? '<td class="center">' + (x.required != null ? x.required : '<span class="muted">—</span>') + '</td><td class="center"' + (x.remaining ? ' style="color:var(--red);font-weight:600"' : '') + '>' + (x.remaining != null ? x.remaining : '<span class="muted">—</span>') + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  J.views.reports = {
    resolve: resolve,
    render: function () {
      var r = resolve();
      var m = L.report(r);
      var label = range.preset === 'all' ? t('All time') : (r.from ? U.fmtDate(r.from) : '…') + ' – ' + (r.to ? U.fmtDate(r.to) : '…');
      var head = '<div class="page-head"><div><h1>' + esc(t('Reports')) + '</h1><div class="sub">' + esc(t('Recruitment performance for the selected period · {0}', label)) + '</div></div>' +
        '<div class="actions"><select data-change="rep-preset" aria-label="' + esc(t('Date range')) + '">' + ui.options(PRESETS, range.preset) + '</select>' +
        (range.preset === 'custom' ? '<input type="date" value="' + esc(range.from) + '" data-change="rep-date" data-k="from" aria-label="' + esc(t('From')) + '"><input type="date" value="' + esc(range.to) + '" data-change="rep-date" data-k="to" aria-label="' + esc(t('To')) + '">' : '') +
        '<button class="btn" data-action="rep-export">' + icon('download', 'sm') + esc(t('Export CSV')) + '</button><button class="btn dark" data-action="rep-print">' + icon('printer', 'sm') + esc(t('Print report')) + '</button></div></div>';

      function metric(l, v, ctx) { return '<div class="metric"><div class="ml">' + esc(l) + '</div><div class="mv">' + v + '</div><div class="mc">' + (ctx ? esc(ctx) : '&nbsp;') + '</div></div>'; }
      /* i18n: t('Not Suitable') t('No Response') */
      var otherTxt = ['Not Suitable', 'No Response'].filter(function (k) { return m.negByReason[k]; }).map(function (k) { return t(k) + ' ' + m.negByReason[k]; }).join(' · ');
      var metrics = '<div class="card mb-16"><div class="metric-grid">' +
        metric(t('Candidates added'), m.added.length, t('By application / creation date')) +
        metric(t('Interviews'), m.interviews, t('{0} completed', m.interviewsDone)) +
        metric(t('Became ready'), m.ready, t('Ready to start in period')) +
        metric(t('Started'), m.started, t('Marked as started')) +
        metric(t('Rejected'), m.rejected, t('Archived as rejected in period')) +
        metric(t('Withdrawn'), m.withdrawn, t('Candidate withdrew in period')) +
        metric(t('Other drop-outs'), m.otherNegative, otherTxt || t('Not suitable / no response')) +
        metric(t('Contracts signed'), m.signed, t('By signed date')) +
        metric(t('Active candidates'), m.active, t('Current, not archived')) +
        metric(t('Administratively ready'), m.adminReady, t('Incl. started (current)')) +
        metric(t('Missing documents'), m.missingDocs, t('{0} documents outstanding (current)', m.docsOutstanding)) +
        metric(t('Target progress'), m.target.required ? m.target.secured + ' / ' + m.target.required : '—', m.target.required ? t('{0} drivers remaining (current)', m.target.remaining) : t('No targets configured')) +
        '</div></div>';

      var stageRows = C.STAGES.map(function (s) { return [t(s.label), m.stages[s.key] || 0]; });
      var docRows = S.settings().documents.filter(function (d) { return d.key !== 'contract'; }).map(function (d) { return [L.shortOf(d), m.docCount[d.key] || 0]; }).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });

      var progress = '<div class="card"><div class="card-head"><h3>' + icon('target', 'sm') + esc(t('Recruitment progress')) + '</h3><span class="hint">' + esc(t('Current snapshot')) + '</span></div><div class="card-body">' +
        '<div class="row between"><span class="small muted">' + esc(t('Secured drivers vs. target')) + '</span><b>' + m.target.progressPct + '%</b></div><div class="mt-8">' + ui.progress(m.target.progressPct, 'lg brand') + '</div>' +
        '<div class="rates" style="border:0;padding-top:4px"><div class="rate"><div class="rl">' + esc(t('Readiness rate')) + '</div><div class="rv">' + m.target.readinessRate + '%</div></div><div class="rate"><div class="rl">' + esc(t('Document completion')) + '</div><div class="rv">' + m.target.docRate + '%</div></div><div class="rate"><div class="rl">' + esc(t('Contract completion')) + '</div><div class="rv">' + m.target.contractRate + '%</div></div></div>' +
        '<div class="section-title mt-16">' + esc(t('Active candidates by pipeline stage')) + '</div>' + hbars(stageRows) + '</div></div>';

      return head + metrics +
        '<div class="grid halves mb-16">' +
        '<div class="card"><div class="card-head"><h3>' + icon('chart', 'sm') + esc(t('Candidates added per week')) + '</h3><span class="hint">' + esc(t('Hover bars for details')) + '</span></div><div class="card-body">' + barChart(weekly(r, m.added)) + '</div></div>' +
        progress + '</div>' +
        '<div class="card mb-16"><div class="card-head"><h3>' + icon('briefcase', 'sm') + esc(t('Project performance')) + '</h3><span class="hint">' + esc(t('Added / contracts: in period · other columns: current')) + '</span></div><div class="card-body flush">' + perfTable(m.projectRows, 'project') + '</div></div>' +
        '<div class="card mb-16"><div class="card-head"><h3>' + icon('pin', 'sm') + esc(t('Station performance')) + '</h3><span class="hint">' + esc(t('Added / contracts: in period · other columns: current')) + '</span></div><div class="card-body flush">' + perfTable(m.stationRows, 'station') + '</div></div>' +
        '<div class="grid halves">' +
        '<div class="card"><div class="card-head"><h3>' + icon('users', 'sm') + esc(t('Source performance')) + '</h3><span class="hint">' + esc(t('Candidates added in period')) + '</span></div><div class="card-body">' + sourceChart(m.sources) + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>' + icon('file', 'sm') + esc(t('Outstanding documents by type')) + '</h3><span class="hint">' + esc(t('Current, active candidates')) + '</span></div><div class="card-body">' + (docRows.length ? hbars(docRows, 'var(--red)') : '<div class="small muted">' + esc(t('No outstanding documents.')) + '</div>') + '</div></div>' +
        '</div>';
    }
  };

  A['rep-preset'] = function (el) { range.preset = el.value; if (el.value === 'custom' && !range.from) { range.from = U.addDays(U.todayISO(), -30); range.to = U.todayISO(); } J.app.rerenderView(); };
  A['rep-date'] = function (el) { range[el.getAttribute('data-k')] = el.value; J.app.rerenderView(); };
  A['rep-print'] = function () { J.print.report(resolve(), range.preset === 'all' ? t('All time') : null); };
  A['rep-export'] = function () {
    var r = resolve();
    var m = L.report(r);
    var rows = [[t('Metric'), t('Value')], [t('Period from'), r.from ? U.fmtDate(r.from) : t('all')], [t('Period to'), r.to ? U.fmtDate(r.to) : t('all')],
      [t('Candidates added'), m.added.length], [t('Interviews'), m.interviews], [t('Interviews completed'), m.interviewsDone], [t('Became ready'), m.ready], [t('Started'), m.started],
      [t('Rejected'), m.rejected], [t('Withdrawn'), m.withdrawn], [t('Other drop-outs'), m.otherNegative], [t('Candidates with missing documents (current)'), m.missingDocs], [t('Contracts signed'), m.signed],
      [t('Active candidates'), m.active], [t('Administratively ready'), m.adminReady],
      [t('Required drivers'), m.target.required], [t('Secured drivers'), m.target.secured], [t('Remaining'), m.target.remaining], [], [t('Source'), t('Candidates'), t('Ready'), t('Started')]];
    Object.keys(m.sources).forEach(function (k) { var x = m.sources[k]; rows.push([t(k), x.candidates, x.ready, x.started]); });
    function perf(title, list, noneLabel) {
      rows.push([], [title, t('Added'), t('Active'), t('Admin. ready'), t('Started'), t('Missing docs'), t('Contracts signed'), t('Required'), t('Remaining')]);
      list.forEach(function (x) { rows.push([x.name || noneLabel, x.added, x.active, x.adminReady, x.started, x.missingDocs, x.signed, x.required != null ? x.required : '', x.remaining != null ? x.remaining : '']); });
    }
    perf(t('Project'), m.projectRows, t('No project'));
    perf(t('Station'), m.stationRows, t('Not assigned'));
    J.io.downloadCSV(rows, 'jarbou-report_' + U.fileStamp() + '.csv');
  };
})();
