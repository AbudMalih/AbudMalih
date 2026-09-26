/* Dashboard: KPIs, target, attention required, upcoming starts, follow-ups. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var t = J.t;
  function tv(v) { return v ? t(v) : v; }
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
    return '<div class="banner amber">' + icon('database') + '<div class="grow"><b>' + (last ? t('Last backup was {0} days ago.', days) : t('No backup has been made yet.')) + '</b> ' + t('This application stores data only in this browser. Create a backup file regularly and keep it in a safe place.') + '</div>' +
      '<button class="btn sm dark" data-action="backup-now">' + icon('download', 'sm') + t('Backup now') + '</button></div>';
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
          (x.more && x.more.length ? '<span class="badge outline" style="flex:none" data-tip="' + esc(x.more.map(function (w) { return w.problem; }).join(' · ')) + '">' + t('+{0} more', x.more.length) + '</span>' : '') + '</div>' +
        '<div class="when">' + (c.startDate ? t('Starts {0}', U.fmtDate(c.startDate)) : '<span class="muted">' + t('No start date') + '</span>') + '</div>' +
        '<div class="prio-col">' + ui.prioBadge(x.w.priority) + '</div>' +
        '<div class="act"><button class="btn xs" data-action="open-candidate" data-id="' + esc(c.id) + '" data-tab="' + (x.w.code.indexOf('doc') === 0 || x.w.code.indexOf('exp') === 0 || x.w.code === 'licence_unverified' ? 'documents' : x.w.code === 'contract' ? 'contract' : x.w.code === 'onboarding' ? 'onboarding' : 'overview') + '">' + t('Open') + ' ' + icon('arrowRight', 'sm') + '</button></div></div>';
    }).join('') : ui.empty('checkCircle', t('Nothing requires attention'), t('All active candidates are on track.'));
    return '<div class="card"><div class="card-head"><h3>' + icon('alert', 'sm') + t('Attention Required') + '</h3>' +
      '<div class="row wrap" style="gap:6px"><div class="seg-tabs" role="group" aria-label="' + esc(t('Grouping')) + '"><button class="' + (st.group === 'candidate' ? 'on' : '') + '" data-action="dash-group" data-g="candidate" data-tip="' + esc(t('One line per candidate (most urgent issue first)')) + '">' + t('By candidate') + '</button><button class="' + (st.group === 'issue' ? 'on' : '') + '" data-action="dash-group" data-g="issue" data-tip="' + esc(t('Every open issue on its own line')) + '">' + t('By issue') + '</button></div>' +
      '<div class="seg-tabs">' + [['all', t('All')], ['high', t('High')], ['medium', t('Medium')], ['low', t('Low')]].map(function (tb) {
        return '<button class="' + (st.prio === tb[0] ? 'on' : '') + '" data-action="dash-prio" data-p="' + tb[0] + '">' + esc(tb[1]) + '<span class="n">' + counts[tb[0]] + '</span></button>';
      }).join('') + '</div></div></div>' +
      '<div class="card-body flush">' + body + '</div>' +
      (shown.length > 8 ? '<div class="card-foot"><span>' + t('{0} items', shown.length) + '</span><button class="btn xs ghost" data-action="dash-showall">' + (st.showAll ? t('Show less') : t('Show all {0}', shown.length)) + '</button></div>' : '') +
      '</div>';
  }

  function targetCard(list) {
    var tg = L.target(list);
    var req = tg.required || 1;
    var wReady = Math.min(100, (tg.ready / req) * 100), wStarted = Math.min(100 - wReady, (tg.started / req) * 100);
    var wPipe = Math.min(100 - wReady - wStarted, (tg.pipeline / req) * 100);
    var proj = S.settings().activeProject;
    return '<div class="card"><div class="card-head"><h3>' + icon('target', 'sm') + t('Driver Recruitment Target') + '</h3><button class="btn xs ghost" data-action="go" data-route="settings" data-params=\'{"section":"general"}\' data-tip="' + esc(t('Change the target in Settings')) + '">' + icon('edit', 'sm') + t('Edit') + '</button></div>' +
      '<div class="card-body">' +
      '<div class="target-top"><div><div class="small muted">' + t('Secured drivers (ready + started)') + '</div><div class="target-big">' + tg.secured + ' <small>/ ' + tg.required + '</small></div></div>' +
      '<div style="text-align:right"><div class="small muted">' + t('Target progress') + '</div><div style="font-size:22px;font-weight:650">' + tg.progressPct + '%</div></div></div>' +
      '<div class="stack-bar" role="img" aria-label="' + esc(t('{0} ready, {1} started, {2} in pipeline of {3} required', tg.ready, tg.started, tg.pipeline, tg.required)) + '">' +
      '<span style="width:' + wStarted + '%;background:var(--ink)" data-tip="' + esc(t('Started: {0}', tg.started)) + '"></span>' +
      '<span style="width:' + wReady + '%;background:var(--green)" data-tip="' + esc(t('Ready to start: {0}', tg.ready)) + '"></span>' +
      '<span style="width:' + wPipe + '%;background:repeating-linear-gradient(135deg,#c9c6bf 0 4px,#dedbd4 4px 8px)" data-tip="' + esc(t('In pipeline (not yet ready): {0}', tg.pipeline)) + '"></span></div>' +
      '<div class="legend"><span><i style="background:var(--ink)"></i>' + t('Started {0}', tg.started) + '</span><span><i style="background:var(--green)"></i>' + t('Ready {0}', tg.ready) + '</span><span><i style="background:#cfccc5"></i>' + t('In pipeline {0}', tg.pipeline) + '</span></div>' +
      '<div class="target-stats"><div class="s"><span>' + t('Required') + '</span><b>' + tg.required + '</b></div><div class="s"><span>' + t('Candidates') + '</span><b>' + tg.candidates + '</b></div>' +
      '<div class="s"><span>' + t('Ready') + '</span><b style="color:var(--green)">' + tg.secured + '</b></div><div class="s"><span>' + t('Remaining') + '</span><b style="color:' + (tg.remaining ? 'var(--red)' : 'var(--green)') + '">' + tg.remaining + '</b></div></div>' +
      '<div class="rates">' +
      rate(t('Readiness rate'), tg.readinessRate, t('Ready or started ÷ candidates')) +
      rate(t('Document completion'), tg.docRate, t('Received/verified ÷ required documents')) +
      rate(t('Contract completion'), tg.contractRate, t('Signed contracts ÷ candidates')) + '</div>' +
      (tg.position ? '<div class="small muted mt-12">' + (proj !== 'all'
        ? t('Counting position "{0}" in project {1}. Coverage: {2} of {3} needed candidates in pipeline.', esc(tg.position), esc(proj), tg.candidates, tg.required)
        : t('Counting position "{0}" across all projects. Coverage: {1} of {2} needed candidates in pipeline.', esc(tg.position), tg.candidates, tg.required)) + '</div>' : '') +
      '</div></div>';
    function rate(l, v, tip) {
      return '<div class="rate" data-tip="' + esc(tip) + '"><div class="rl">' + esc(l) + '</div><div class="rv">' + v + '%</div>' + ui.progress(v, ui.pctClass(v)) + '</div>';
    }
  }

  function upcomingCard(list) {
    var groups = {
      today: list.filter(function (c) { return L.info(c).daysToStart === 0 && c.stage !== 'started'; }),
      next7: list.filter(function (c) { var d = L.info(c).daysToStart; return d !== null && d >= 0 && d <= 7; }),
      next30: list.filter(function (c) { var d = L.info(c).daysToStart; return d !== null && d >= 0 && d <= 30; })
    };
    var rows = groups[st.upcoming].slice().sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
    return '<div class="card"><div class="card-head"><h3>' + icon('calendar', 'sm') + t('Upcoming Starts') + '</h3>' +
      '<div class="seg-tabs">' + [['today', t('Today')], ['next7', t('7 days')], ['next30', t('30 days')]].map(function (tb) {
        return '<button class="' + (st.upcoming === tb[0] ? 'on' : '') + '" data-action="dash-upcoming" data-t="' + tb[0] + '">' + esc(tb[1]) + '<span class="n">' + groups[tb[0]].length + '</span></button>';
      }).join('') + '</div></div>' +
      (rows.length ? '<div class="table-wrap" style="max-height:360px;min-height:0"><table class="data compact"><thead><tr><th>' + t('Candidate') + '</th><th>' + t('Start') + '</th><th>' + t('Days') + '</th><th class="hide-sm">' + t('Type') + '</th><th>' + t('Readiness') + '</th><th class="hide-sm">' + t('Documents') + '</th></tr></thead><tbody>' +
        rows.map(function (c) {
          var i = L.info(c);
          return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '"><td class="name-cell">' + esc(U.fullName(c)) + '<div class="sub">' + esc(c.position || '') + (c.station ? ' · ' + esc(c.station) : '') + '</div></td>' +
            '<td>' + U.fmtDate(c.startDate) + '</td><td>' + ui.daysPill(i.daysToStart) + '</td><td class="hide-sm">' + ui.val(tv(c.employmentType)) + '</td><td>' + ui.overallBadge(i, true) + '</td><td class="hide-sm">' + ui.miniProgress(i.docs.complete, i.docs.total) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : ui.empty('calendar', st.upcoming === 'today' ? t('No starts today') : t('No starts in this period'), t('Candidates with a planned start date will appear here.'))) +
      '<div class="card-foot"><span></span><button class="btn xs ghost" data-action="go" data-route="starting">' + t('View Starting Soon') + ' ' + icon('arrowRight', 'sm') + '</button></div></div>';
  }

  function followCard(list) {
    var overdue = list.filter(function (c) { return L.info(c).followUp === 'overdue'; }).sort(function (a, b) { return a.followUpDate.localeCompare(b.followUpDate); });
    var today = list.filter(function (c) { return L.info(c).followUp === 'today'; });
    function row(c, kind) {
      var d = U.daysUntil(c.followUpDate);
      return '<div class="list-item clickable" data-action="open-candidate" data-id="' + esc(c.id) + '"><div class="avatar sm">' + esc(U.initials(c)) + '</div><div class="grow"><div class="title">' + esc(U.fullName(c)) + '</div><div class="desc">' + esc(c.followUpNote || t('No note')) + '</div></div>' +
        (kind === 'overdue' ? ui.badge(t('{0}d overdue', Math.abs(d)), 'red', 'alert') : ui.badge(t('Today'), 'amber', 'clock')) +
        '<button class="icon-btn" data-action="follow-up" data-id="' + esc(c.id) + '" data-stop aria-label="' + esc(t('Update follow-up')) + '" data-tip="' + esc(t('Reschedule or mark done')) + '">' + icon('edit', 'sm') + '</button></div>';
    }
    return '<div class="card"><div class="card-head"><h3>' + icon('bell', 'sm') + t('Follow-ups') + '</h3><button class="btn xs" data-action="follow-up">' + icon('plus', 'sm') + t('Add follow-up') + '</button></div>' +
      '<div class="card-body flush">' +
      '<div class="section-title" style="padding:12px 18px 0">' + t('Overdue follow-ups') + ' · ' + overdue.length + '</div>' +
      (overdue.length ? overdue.map(function (c) { return row(c, 'overdue'); }).join('') : '<div class="small muted" style="padding:6px 18px 12px">' + t('No overdue follow-ups.') + '</div>') +
      '<div class="section-title" style="padding:12px 18px 0;border-top:1px solid var(--border)">' + t('Follow-ups today') + ' · ' + today.length + '</div>' +
      (today.length ? today.map(function (c) { return row(c, 'today'); }).join('') : '<div class="small muted" style="padding:6px 18px 14px">' + t('No follow-ups due today.') + '</div>') +
      '</div></div>';
  }

  J.views.dashboard = {
    render: function () {
      var s = S.settings();
      var list = L.scoped();
      var k = L.kpis(list);
      var proj = s.activeProject !== 'all' ? s.activeProject : s.defaultProject;
      var head = '<div class="page-head"><div><div class="eyebrow">' + t('Recruiting Overview') + ' · ' + (/dhl/i.test(proj) ? t('{0} Project', '<span class="dhl-pill" style="height:17px;font-size:10px">' + esc(proj) + '</span>') : esc(proj || t('All projects'))) + '</div>' +
        '<h1>' + U.greeting() + '</h1><div class="sub">' + U.longDate() + ' · ' + (list.length === 1 ? t('{0} active candidate', list.length) : t('{0} active candidates', list.length)) + '</div></div>' +
        '<div class="actions"><button class="btn" data-action="print-dashboard">' + icon('printer', 'sm') + t('Print overview') + '</button><button class="btn primary" data-action="add-candidate">' + icon('plus') + t('Add Candidate') + '</button></div></div>';

      var kpis = '<div class="grid kpis">' +
        kpi(t('Total Candidates'), 'users', k.total, k.newThisWeek ? t('{0} added this week', '<span class="up">+' + k.newThisWeek + '</span>') : t('Active, not archived'), {}) +
        kpi(t('Ready to Start'), 'checkCircle', k.ready, k.readyThisWeek ? t('{0} this week', '<span class="up">+' + k.readyThisWeek + '</span>') : (k.started ? t('{0} already started', k.started) : t('Available + admin complete')), { overall: 'ready' }, 'accent-green', t('Candidate available AND all administrative requirements complete')) +
        kpi(t('In Recruitment'), 'kanban', k.inRecruitment, k.inInterview ? t('{0} in interview stage', k.inInterview) : t('Not yet ready'), { overall: 'not_ready' }) +
        kpi(t('Documents Missing'), 'file', k.docsMissing, k.docsOutstandingTotal ? t('{0} documents outstanding', '<span class="bad">' + k.docsOutstandingTotal + '</span>') : t('All documents complete'), { docs: 'missing' }, k.docsMissing ? 'accent-red' : '') +
        kpi(t('Contract Pending'), 'contract', k.contractPending, k.contractSent ? t('{0} sent, awaiting signature', k.contractSent) : t('{0} signed in total', k.signed), { contract: 'pending' }, k.contractPending ? 'accent-amber' : '') +
        kpi(t('Onboarding'), 'onboarding', k.onboarding, k.onboarding ? t('Avg. {0}% complete', k.onboardingAvg) : t('No active onboarding'), { onboarding: 'in_progress' }) +
        kpi(t('Starting This Month'), 'calendar', k.startMonth, k.startMonthNotReady ? t('{0} not ready yet', '<span class="warn">' + k.startMonthNotReady + '</span>') : U.monthName(U.todayISO()), { start: 'this_month' }) +
        kpi(t('Starting Next 7 Days'), 'clock', k.start7, k.start7Action ? t('{0} need action', '<span class="bad">' + k.start7Action + '</span>') : t('All on track'), { start: 'next7' }, k.start7Action ? 'accent-red' : '') +
        '</div>';

      var quick = '<div class="quick mt-16">' +
        [['add-candidate', 'plus', t('Add Candidate')], ['follow-up', 'bell', t('Add Follow-up')], ['go-missing', 'file', t('View Missing Documents')], ['go-starting', 'calendar', t('View Starting Soon')], ['export-candidates-quick', 'download', t('Export Candidates')], ['backup-now', 'database', t('Backup Database')]]
          .map(function (q) { return '<button data-action="' + q[0] + '"><span class="qi">' + icon(q[1]) + '</span>' + esc(q[2]) + '</button>'; }).join('') + '</div>';

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
