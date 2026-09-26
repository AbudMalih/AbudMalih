/* Reports: date-range metrics, weekly intake, pipeline, source analytics. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var range = { preset: 'last90', from: '', to: '' };
  var PRESETS = [
    { key: 'this_month', label: 'This month' }, { key: 'last30', label: 'Last 30 days' }, { key: 'last90', label: 'Last 90 days' },
    { key: 'this_year', label: 'This year' }, { key: 'all', label: 'All time' }, { key: 'custom', label: 'Custom range' }
  ];
  var NEGATIVE = { 'Rejected': 1, 'Candidate Withdrew': 1, 'Not Suitable': 1, 'No Response': 1 };

  function resolve() {
    var t = U.todayISO();
    switch (range.preset) {
      case 'this_month': return { from: U.startOfMonth(t), to: U.endOfMonth(t) };
      case 'last30': return { from: U.addDays(t, -29), to: t };
      case 'last90': return { from: U.addDays(t, -89), to: t };
      case 'this_year': return { from: t.slice(0, 4) + '-01-01', to: t.slice(0, 4) + '-12-31' };
      case 'custom': return { from: range.from, to: range.to };
    }
    return { from: '', to: '' };
  }

  function addedDate(c) { return c.applicationDate || (c.createdAt || '').slice(0, 10); }
  function startedDate(c) { return c.stage === 'started' ? (c.startedOn || c.startDate) : ''; }

  L.report = function (r) {
    var all = L.scoped(true);
    var active = all.filter(function (c) { return !c.archived; });
    var m = { added: [], interviews: 0, interviewsDone: 0, ready: 0, started: 0, negative: 0, negByReason: {}, signed: 0, missingDocs: 0, docsOutstanding: 0 };
    all.forEach(function (c) {
      if (U.inRange(addedDate(c), r.from, r.to)) m.added.push(c);
      if (c.interviewDate && U.inRange(c.interviewDate, r.from, r.to) && c.interviewStatus !== 'Cancelled') { m.interviews++; if (c.interviewStatus === 'Completed') m.interviewsDone++; }
      if (c.readySince && U.inRange(c.readySince, r.from, r.to)) m.ready++;
      if (U.inRange(startedDate(c), r.from, r.to)) m.started++;
      if (c.archived && NEGATIVE[c.archiveReason] && U.inRange(c.archiveDate, r.from, r.to)) { m.negative++; m.negByReason[c.archiveReason] = (m.negByReason[c.archiveReason] || 0) + 1; }
      if (c.contract && c.contract.signedDate && U.inRange(c.contract.signedDate, r.from, r.to)) m.signed++;
    });
    var docCount = {};
    active.forEach(function (c) {
      var i = L.info(c);
      var out = i.docs.outstanding.filter(function (k) { return k !== 'contract'; });
      if (out.length) { m.missingDocs++; m.docsOutstanding += out.length; }
      out.forEach(function (k) { docCount[k] = (docCount[k] || 0) + 1; });
    });
    m.docCount = docCount;
    // Source performance (candidates added in range)
    var src = {};
    S.settings().sources.forEach(function (s) { src[s] = { candidates: 0, ready: 0, started: 0 }; });
    m.added.forEach(function (c) {
      var k = c.source || 'Unknown';
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
    return m;
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
      var label = monthly ? U.monthName(cur).slice(0, 3) + ' ' + cur.slice(2, 4) : U.fmtDate(cur).slice(0, 6);
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
    if (!b.length) return '<div class="small muted">No data in range.</div>';
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
        '<rect class="hit" x="' + (padL + cw * k) + '" y="' + padT + '" width="' + cw + '" height="' + (H - padT - padB) + '" data-tip="' + esc((data.monthly ? '' : 'Week of ') + x.label + ': ' + x.n + ' candidate' + (x.n === 1 ? '' : 's') + ' added') + '"/>';
    }).join('');
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Candidates added per ' + (data.monthly ? 'month' : 'week') + '">' + grid + '<line x1="' + padL + '" x2="' + W + '" y1="' + (H - padB) + '" y2="' + (H - padB) + '" stroke="var(--border-strong)"/>' + bars + '</svg></div>';
  }

  function hbars(rows, color) {
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r[1]; })));
    return rows.map(function (r) {
      return '<div class="hbar-row" data-tip="' + esc(r[0] + ': ' + r[1]) + '"><div class="lbl">' + esc(r[0]) + '</div><div class="track"><div class="fill" style="width:' + (r[1] / max * 100) + '%;' + (color ? 'background:' + color : '') + '"></div></div><div class="num">' + r[1] + '</div></div>';
    }).join('');
  }

  function sourceChart(src) {
    var keys = Object.keys(src).filter(function (k) { return src[k].candidates > 0; }).sort(function (a, b) { return src[b].candidates - src[a].candidates; });
    if (!keys.length) return '<div class="small muted">No candidates added in this period.</div>';
    var max = Math.max(1, Math.max.apply(null, keys.map(function (k) { return src[k].candidates; })));
    var series = [['candidates', 'Candidates', 'var(--series-1)'], ['ready', 'Ready', 'var(--series-3)'], ['started', 'Started', 'var(--series-2)']];
    return '<div class="legend" style="margin:0 0 8px">' + series.map(function (s) { return '<span><i style="background:' + s[2] + '"></i>' + s[1] + '</span>'; }).join('') + '</div>' +
      keys.map(function (k) {
        var x = src[k];
        return '<div class="gbar"><div class="lbl">' + esc(k) + '</div><div class="bars">' + series.map(function (s) {
          return '<div class="b" data-tip="' + esc(k + ' – ' + s[1] + ': ' + x[s[0]]) + '"><span class="f" style="width:' + (x[s[0]] / max * 100) + '%;background:' + s[2] + '"></span><em>' + x[s[0]] + '</em></div>';
        }).join('') + '</div></div>';
      }).join('') +
      '<table class="data compact static mt-16"><thead><tr><th>Source</th><th class="center">Candidates</th><th class="center">Ready</th><th class="center">Started</th><th class="center">Conversion</th></tr></thead><tbody>' +
      keys.map(function (k) { var x = src[k]; return '<tr><td>' + esc(k) + '</td><td class="center">' + x.candidates + '</td><td class="center">' + x.ready + '</td><td class="center">' + x.started + '</td><td class="center">' + U.pct(x.ready + x.started, x.candidates) + '%</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  J.views.reports = {
    resolve: resolve,
    render: function () {
      var r = resolve();
      var m = L.report(r);
      var label = range.preset === 'all' ? 'All time' : (r.from ? U.fmtDate(r.from) : '…') + ' – ' + (r.to ? U.fmtDate(r.to) : '…');
      var head = '<div class="page-head"><div><h1>Reports</h1><div class="sub">Recruitment performance for the selected period · ' + esc(label) + '</div></div>' +
        '<div class="actions"><select data-change="rep-preset" aria-label="Date range">' + ui.options(PRESETS, range.preset) + '</select>' +
        (range.preset === 'custom' ? '<input type="date" value="' + esc(range.from) + '" data-change="rep-date" data-k="from" aria-label="From"><input type="date" value="' + esc(range.to) + '" data-change="rep-date" data-k="to" aria-label="To">' : '') +
        '<button class="btn" data-action="rep-export">' + icon('download', 'sm') + 'Export CSV</button><button class="btn dark" data-action="rep-print">' + icon('printer', 'sm') + 'Print report</button></div></div>';

      function metric(l, v, ctx) { return '<div class="metric"><div class="ml">' + l + '</div><div class="mv">' + v + '</div><div class="mc">' + (ctx || '&nbsp;') + '</div></div>'; }
      var negTxt = Object.keys(m.negByReason).map(function (k) { return k + ' ' + m.negByReason[k]; }).join(' · ');
      var metrics = '<div class="card mb-16"><div class="metric-grid">' +
        metric('Candidates added', m.added.length, 'By application / creation date') +
        metric('Interviews', m.interviews, m.interviewsDone + ' completed') +
        metric('Became ready', m.ready, 'Ready to start in period') +
        metric('Started', m.started, 'Marked as started') +
        metric('Rejected / Withdrawn', m.negative, negTxt || 'No drop-outs in period') +
        metric('Missing documents', m.missingDocs, m.docsOutstanding + ' documents outstanding (current)') +
        metric('Contracts signed', m.signed, 'By signed date') +
        metric('Target progress', m.target.secured + ' / ' + m.target.required, m.target.remaining + ' drivers remaining (current)') +
        '</div></div>';

      var stageRows = C.STAGES.map(function (s) { return [s.label, m.stages[s.key] || 0]; });
      var docRows = S.settings().documents.filter(function (d) { return d.key !== 'contract'; }).map(function (d) { return [L.shortOf(d), m.docCount[d.key] || 0]; }).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });

      var progress = '<div class="card"><div class="card-head"><h3>' + icon('target', 'sm') + 'Recruitment progress</h3><span class="hint">Current snapshot</span></div><div class="card-body">' +
        '<div class="row between"><span class="small muted">Secured drivers vs. target</span><b>' + m.target.progressPct + '%</b></div><div class="mt-8">' + ui.progress(m.target.progressPct, 'lg brand') + '</div>' +
        '<div class="rates" style="border:0;padding-top:4px"><div class="rate"><div class="rl">Readiness rate</div><div class="rv">' + m.target.readinessRate + '%</div></div><div class="rate"><div class="rl">Document completion</div><div class="rv">' + m.target.docRate + '%</div></div><div class="rate"><div class="rl">Contract completion</div><div class="rv">' + m.target.contractRate + '%</div></div></div>' +
        '<div class="section-title mt-16">Active candidates by pipeline stage</div>' + hbars(stageRows) + '</div></div>';

      return head + metrics +
        '<div class="grid halves mb-16">' +
        '<div class="card"><div class="card-head"><h3>' + icon('chart', 'sm') + 'Candidates added per week</h3><span class="hint">Hover bars for details</span></div><div class="card-body">' + barChart(weekly(r, m.added)) + '</div></div>' +
        progress + '</div>' +
        '<div class="grid halves">' +
        '<div class="card"><div class="card-head"><h3>' + icon('users', 'sm') + 'Source performance</h3><span class="hint">Candidates added in period</span></div><div class="card-body">' + sourceChart(m.sources) + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>' + icon('file', 'sm') + 'Outstanding documents by type</h3><span class="hint">Current, active candidates</span></div><div class="card-body">' + (docRows.length ? hbars(docRows, 'var(--red)') : '<div class="small muted">No outstanding documents.</div>') + '</div></div>' +
        '</div>';
    }
  };

  A['rep-preset'] = function (el) { range.preset = el.value; if (el.value === 'custom' && !range.from) { range.from = U.addDays(U.todayISO(), -30); range.to = U.todayISO(); } J.app.rerenderView(); };
  A['rep-date'] = function (el) { range[el.getAttribute('data-k')] = el.value; J.app.rerenderView(); };
  A['rep-print'] = function () { J.print.report(resolve(), range.preset === 'all' ? 'All time' : null); };
  A['rep-export'] = function () {
    var r = resolve();
    var m = L.report(r);
    var rows = [['Metric', 'Value'], ['Period from', r.from ? U.fmtDate(r.from) : 'all'], ['Period to', r.to ? U.fmtDate(r.to) : 'all'],
      ['Candidates added', m.added.length], ['Interviews', m.interviews], ['Interviews completed', m.interviewsDone], ['Became ready', m.ready], ['Started', m.started],
      ['Rejected / Withdrawn', m.negative], ['Candidates with missing documents (current)', m.missingDocs], ['Contracts signed', m.signed],
      ['Required drivers', m.target.required], ['Secured drivers', m.target.secured], ['Remaining', m.target.remaining], [], ['Source', 'Candidates', 'Ready', 'Started']];
    Object.keys(m.sources).forEach(function (k) { var x = m.sources[k]; rows.push([k, x.candidates, x.ready, x.started]); });
    J.io.downloadCSV(rows, 'jarbou-report_' + U.fileStamp() + '.csv');
  };
})();
