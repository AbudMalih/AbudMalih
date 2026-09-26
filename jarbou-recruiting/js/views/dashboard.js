/* Dashboard: KPIs, target, attention required, upcoming starts, follow-ups. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var st = { prio: 'all', showAll: false, upcoming: 'next7', group: 'candidate' };

  function kpi(label, ic, value, ctx, go, accent, tip) {
    return '<button class="card kpi ' + (accent || '') + '" data-action="go" data-route="candidates" data-params=\'' + esc(JSON.stringify(go)) + '\'' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' +
      '<div class="label"><span>' + esc(label) + '</span>' + icon(ic, 'sm') + '</div><div class="value">' + value + '</div><div class="ctx">' + (ctx || '&nbsp;') + '</div></button>';
  }

  function backupBanner() {
    var s = S.settings();
    var last = S.meta('lastBackup');
    var days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 864e5) : null;
    if (S.count() === 0) return '';
    if (last && days < (s.backupReminderDays || 7)) return '';
    return '<div class="banner amber">' + icon('database') + '<div class="grow"><b>' + (last ? 'Last backup was ' + days + ' days ago.' : 'No backup has been made yet.') + '</b> This application stores data only in this browser. Create a backup file regularly and keep it in a safe place.</div>' +
      '<button class="btn sm dark" data-action="backup-now">' + icon('download', 'sm') + 'Backup now</button></div>';
  }

  function attentionCard(list) {
    var items = L.attention(list);
    if (st.group === 'candidate') {
      var seen = {};
      var grouped = [];
      items.forEach(function (x) {
        if (seen[x.c.id]) { seen[x.c.id].more.push(x.w); return; }
        var g = { c: x.c, w: x.w, days: x.days, more: [] };
        seen[x.c.id] = g; grouped.push(g);
      });
      items = grouped;
    }
    var counts = { all: items.length, high: 0, medium: 0, low: 0 };
    items.forEach(function (x) { counts[x.w.priority]++; });
    var shown = st.prio === 'all' ? items : items.filter(function (x) { return x.w.priority === st.prio; });
    var limit = st.showAll ? shown.length : 8;
    var body = shown.length ? shown.slice(0, limit).map(function (x) {
      var c = x.c;
      return '<div class="attn-item ' + x.w.priority + '"><span class="bar"></span>' +
        '<div class="who"><div class="nowrap" style="overflow:hidden;text-overflow:ellipsis">' + esc(U.fullName(c)) + '</div><div class="muted">' + esc(c.id) + (c.station ? ' · ' + esc(c.station) : '') + '</div></div>' +
        '<div class="problem">' + icon(x.w.priority === 'high' ? 'alert' : x.w.priority === 'medium' ? 'clock' : 'info', 'sm') + '<span title="' + esc(x.w.problem) + '">' + esc(x.w.problem) + '</span>' +
          (x.more && x.more.length ? '<span class="badge outline" style="flex:none" data-tip="' + esc(x.more.map(function (w) { return w.problem; }).join(' · ')) + '">+' + x.more.length + ' more</span>' : '') + '</div>' +
        '<div class="when">' + (c.startDate ? 'Starts ' + U.fmtDate(c.startDate) : '<span class="muted">No start date</span>') + '</div>' +
        '<div class="prio-col">' + ui.prioBadge(x.w.priority) + '</div>' +
        '<div class="act"><button class="btn xs" data-action="open-candidate" data-id="' + esc(c.id) + '" data-tab="' + (x.w.code.indexOf('doc') === 0 || x.w.code.indexOf('exp') === 0 || x.w.code === 'licence_unverified' ? 'documents' : x.w.code === 'contract' ? 'contract' : x.w.code === 'onboarding' ? 'onboarding' : 'overview') + '">Open ' + icon('arrowRight', 'sm') + '</button></div></div>';
    }).join('') : ui.empty('checkCircle', 'Nothing requires attention', 'All active candidates are on track.');
    return '<div class="card"><div class="card-head"><h3>' + icon('alert', 'sm') + 'Attention Required</h3>' +
      '<div class="row wrap" style="gap:6px"><div class="seg-tabs" role="group" aria-label="Grouping"><button class="' + (st.group === 'candidate' ? 'on' : '') + '" data-action="dash-group" data-g="candidate" data-tip="One line per candidate (most urgent issue first)">By candidate</button><button class="' + (st.group === 'issue' ? 'on' : '') + '" data-action="dash-group" data-g="issue" data-tip="Every open issue on its own line">By issue</button></div>' +
      '<div class="seg-tabs">' + [['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']].map(function (t) {
        return '<button class="' + (st.prio === t[0] ? 'on' : '') + '" data-action="dash-prio" data-p="' + t[0] + '">' + t[1] + '<span class="n">' + counts[t[0]] + '</span></button>';
      }).join('') + '</div></div></div>' +
      '<div class="card-body flush">' + body + '</div>' +
      (shown.length > 8 ? '<div class="card-foot"><span>' + shown.length + ' items</span><button class="btn xs ghost" data-action="dash-showall">' + (st.showAll ? 'Show less' : 'Show all ' + shown.length) + '</button></div>' : '') +
      '</div>';
  }

  function targetCard(list) {
    var t = L.target(list);
    var req = t.required || 1;
    var wReady = Math.min(100, (t.ready / req) * 100), wStarted = Math.min(100 - wReady, (t.started / req) * 100);
    var wPipe = Math.min(100 - wReady - wStarted, (t.pipeline / req) * 100);
    return '<div class="card"><div class="card-head"><h3>' + icon('target', 'sm') + 'Driver Recruitment Target</h3><button class="btn xs ghost" data-action="go" data-route="settings" data-params=\'{"section":"general"}\' data-tip="Change the target in Settings">' + icon('edit', 'sm') + 'Edit</button></div>' +
      '<div class="card-body">' +
      '<div class="target-top"><div><div class="small muted">Secured drivers (ready + started)</div><div class="target-big">' + t.secured + ' <small>/ ' + t.required + '</small></div></div>' +
      '<div style="text-align:right"><div class="small muted">Target progress</div><div style="font-size:22px;font-weight:650">' + t.progressPct + '%</div></div></div>' +
      '<div class="stack-bar" role="img" aria-label="' + t.ready + ' ready, ' + t.started + ' started, ' + t.pipeline + ' in pipeline of ' + t.required + ' required">' +
      '<span style="width:' + wStarted + '%;background:var(--ink)" data-tip="Started: ' + t.started + '"></span>' +
      '<span style="width:' + wReady + '%;background:var(--green)" data-tip="Ready to start: ' + t.ready + '"></span>' +
      '<span style="width:' + wPipe + '%;background:repeating-linear-gradient(135deg,#c9c6bf 0 4px,#dedbd4 4px 8px)" data-tip="In pipeline (not yet ready): ' + t.pipeline + '"></span></div>' +
      '<div class="legend"><span><i style="background:var(--ink)"></i>Started ' + t.started + '</span><span><i style="background:var(--green)"></i>Ready ' + t.ready + '</span><span><i style="background:#cfccc5"></i>In pipeline ' + t.pipeline + '</span></div>' +
      '<div class="target-stats"><div class="s"><span>Required</span><b>' + t.required + '</b></div><div class="s"><span>Candidates</span><b>' + t.candidates + '</b></div>' +
      '<div class="s"><span>Ready</span><b style="color:var(--green)">' + t.secured + '</b></div><div class="s"><span>Remaining</span><b style="color:' + (t.remaining ? 'var(--red)' : 'var(--green)') + '">' + t.remaining + '</b></div></div>' +
      '<div class="rates">' +
      rate('Readiness rate', t.readinessRate, 'Ready or started ÷ candidates') +
      rate('Document completion', t.docRate, 'Received/verified ÷ required documents') +
      rate('Contract completion', t.contractRate, 'Signed contracts ÷ candidates') + '</div>' +
      (t.position ? '<div class="small muted mt-12">Counting position "' + esc(t.position) + '"' + (S.settings().activeProject !== 'all' ? ' in project ' + esc(S.settings().activeProject) : ' across all projects') + '. Coverage: ' + t.candidates + ' of ' + t.required + ' needed candidates in pipeline.</div>' : '') +
      '</div></div>';
    function rate(l, v, tip) {
      return '<div class="rate" data-tip="' + esc(tip) + '"><div class="rl">' + l + '</div><div class="rv">' + v + '%</div>' + ui.progress(v, ui.pctClass(v)) + '</div>';
    }
  }

  function upcomingCard(list) {
    var groups = {
      today: list.filter(function (c) { return L.info(c).daysToStart === 0 && c.stage !== 'started'; }),
      next7: list.filter(function (c) { var d = L.info(c).daysToStart; return d !== null && d >= 0 && d <= 7; }),
      next30: list.filter(function (c) { var d = L.info(c).daysToStart; return d !== null && d >= 0 && d <= 30; })
    };
    var rows = groups[st.upcoming].slice().sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
    return '<div class="card"><div class="card-head"><h3>' + icon('calendar', 'sm') + 'Upcoming Starts</h3>' +
      '<div class="seg-tabs">' + [['today', 'Today'], ['next7', '7 days'], ['next30', '30 days']].map(function (t) {
        return '<button class="' + (st.upcoming === t[0] ? 'on' : '') + '" data-action="dash-upcoming" data-t="' + t[0] + '">' + t[1] + '<span class="n">' + groups[t[0]].length + '</span></button>';
      }).join('') + '</div></div>' +
      (rows.length ? '<div class="table-wrap" style="max-height:360px;min-height:0"><table class="data compact"><thead><tr><th>Candidate</th><th>Start</th><th>Days</th><th class="hide-sm">Type</th><th>Readiness</th><th class="hide-sm">Documents</th></tr></thead><tbody>' +
        rows.map(function (c) {
          var i = L.info(c);
          return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '"><td class="name-cell">' + esc(U.fullName(c)) + '<div class="sub">' + esc(c.position || '') + (c.station ? ' · ' + esc(c.station) : '') + '</div></td>' +
            '<td>' + U.fmtDate(c.startDate) + '</td><td>' + ui.daysPill(i.daysToStart) + '</td><td class="hide-sm">' + ui.val(c.employmentType) + '</td><td>' + ui.overallBadge(i, true) + '</td><td class="hide-sm">' + ui.miniProgress(i.docs.complete, i.docs.total) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : ui.empty('calendar', 'No starts ' + (st.upcoming === 'today' ? 'today' : 'in this period'), 'Candidates with a planned start date will appear here.')) +
      '<div class="card-foot"><span></span><button class="btn xs ghost" data-action="go" data-route="starting">View Starting Soon ' + icon('arrowRight', 'sm') + '</button></div></div>';
  }

  function followCard(list) {
    var overdue = list.filter(function (c) { return L.info(c).followUp === 'overdue'; }).sort(function (a, b) { return a.followUpDate.localeCompare(b.followUpDate); });
    var today = list.filter(function (c) { return L.info(c).followUp === 'today'; });
    function row(c, kind) {
      var d = U.daysUntil(c.followUpDate);
      return '<div class="list-item clickable" data-action="open-candidate" data-id="' + esc(c.id) + '"><div class="avatar sm">' + esc(U.initials(c)) + '</div><div class="grow"><div class="title">' + esc(U.fullName(c)) + '</div><div class="desc">' + esc(c.followUpNote || 'No note') + '</div></div>' +
        (kind === 'overdue' ? ui.badge(Math.abs(d) + 'd overdue', 'red', 'alert') : ui.badge('Today', 'amber', 'clock')) +
        '<button class="icon-btn" data-action="follow-up" data-id="' + esc(c.id) + '" data-stop aria-label="Update follow-up" data-tip="Reschedule or mark done">' + icon('edit', 'sm') + '</button></div>';
    }
    return '<div class="card"><div class="card-head"><h3>' + icon('bell', 'sm') + 'Follow-ups</h3><button class="btn xs" data-action="follow-up">' + icon('plus', 'sm') + 'Add follow-up</button></div>' +
      '<div class="card-body flush">' +
      '<div class="section-title" style="padding:12px 18px 0">Overdue follow-ups · ' + overdue.length + '</div>' +
      (overdue.length ? overdue.map(function (c) { return row(c, 'overdue'); }).join('') : '<div class="small muted" style="padding:6px 18px 12px">No overdue follow-ups.</div>') +
      '<div class="section-title" style="padding:12px 18px 0;border-top:1px solid var(--border)">Follow-ups today · ' + today.length + '</div>' +
      (today.length ? today.map(function (c) { return row(c, 'today'); }).join('') : '<div class="small muted" style="padding:6px 18px 14px">No follow-ups due today.</div>') +
      '</div></div>';
  }

  J.views.dashboard = {
    render: function () {
      var s = S.settings();
      var list = L.scoped();
      var k = L.kpis(list);
      var proj = s.activeProject !== 'all' ? s.activeProject : s.defaultProject;
      var head = '<div class="page-head"><div><div class="eyebrow">Recruiting Overview · ' + (/dhl/i.test(proj) ? '<span class="dhl-pill" style="height:17px;font-size:10px">' + esc(proj) + '</span> Project' : esc(proj || 'All projects')) + '</div>' +
        '<h1>' + U.greeting() + '</h1><div class="sub">' + U.longDate() + ' · ' + list.length + ' active candidate' + (list.length === 1 ? '' : 's') + '</div></div>' +
        '<div class="actions"><button class="btn" data-action="print-dashboard">' + icon('printer', 'sm') + 'Print overview</button><button class="btn primary" data-action="add-candidate">' + icon('plus') + 'Add Candidate</button></div></div>';

      var kpis = '<div class="grid kpis">' +
        kpi('Total Candidates', 'users', k.total, k.newThisWeek ? '<span class="up">+' + k.newThisWeek + '</span> added this week' : 'Active, not archived', {}) +
        kpi('Ready to Start', 'checkCircle', k.ready, k.readyThisWeek ? '<span class="up">+' + k.readyThisWeek + '</span> this week' : (k.started ? k.started + ' already started' : 'Available + admin complete'), { overall: 'ready' }, 'accent-green', 'Candidate available AND all administrative requirements complete') +
        kpi('In Recruitment', 'kanban', k.inRecruitment, k.inInterview ? k.inInterview + ' in interview stage' : 'Not yet ready', { overall: 'not_ready' }) +
        kpi('Documents Missing', 'file', k.docsMissing, k.docsOutstandingTotal ? '<span class="bad">' + k.docsOutstandingTotal + '</span> documents outstanding' : 'All documents complete', { docs: 'missing' }, k.docsMissing ? 'accent-red' : '') +
        kpi('Contract Pending', 'contract', k.contractPending, k.contractSent ? k.contractSent + ' sent, awaiting signature' : k.signed + ' signed in total', { contract: 'pending' }, k.contractPending ? 'accent-amber' : '') +
        kpi('Onboarding', 'onboarding', k.onboarding, k.onboarding ? 'Avg. ' + k.onboardingAvg + '% complete' : 'No active onboarding', { onboarding: 'in_progress' }) +
        kpi('Starting This Month', 'calendar', k.startMonth, k.startMonthNotReady ? '<span class="warn">' + k.startMonthNotReady + '</span> not ready yet' : U.monthName(U.todayISO()), { start: 'this_month' }) +
        kpi('Starting Next 7 Days', 'clock', k.start7, k.start7Action ? '<span class="bad">' + k.start7Action + '</span> need action' : 'All on track', { start: 'next7' }, k.start7Action ? 'accent-red' : '') +
        '</div>';

      var quick = '<div class="quick mt-16">' +
        [['add-candidate', 'plus', 'Add Candidate'], ['follow-up', 'bell', 'Add Follow-up'], ['go-missing', 'file', 'View Missing Documents'], ['go-starting', 'calendar', 'View Starting Soon'], ['export-candidates-quick', 'download', 'Export Candidates'], ['backup-now', 'database', 'Backup Database']]
          .map(function (q) { return '<button data-action="' + q[0] + '"><span class="qi">' + icon(q[1]) + '</span>' + q[2] + '</button>'; }).join('') + '</div>';

      return backupBanner() + head + kpis + quick +
        '<div class="grid two mt-16">' + attentionCard(list) + targetCard(list) + '</div>' +
        '<div class="grid two mt-16">' + upcomingCard(list) + followCard(list) + '</div>';
    }
  };

  A['dash-prio'] = function (el) { st.prio = el.getAttribute('data-p'); st.showAll = false; J.app.rerenderView(); };
  A['dash-group'] = function (el) { st.group = el.getAttribute('data-g'); st.showAll = false; J.app.rerenderView(); };
  A['dash-showall'] = function () { st.showAll = !st.showAll; J.app.rerenderView(); };
  A['dash-upcoming'] = function (el) { st.upcoming = el.getAttribute('data-t'); J.app.rerenderView(); };
  A['go-missing'] = function () { J.app.go('documents', { only: 'missing' }); };
  A['go-starting'] = function () { J.app.go('starting'); };
  A['export-candidates-quick'] = function (el) { J.io.exportMenu(el, L.scoped(), 'all-active'); };
  A['print-dashboard'] = function () { J.print.overview(); };
})();
