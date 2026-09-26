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

  /* ---------- Server data loaded in the background (never blocks rendering) */
  var remote = {
    backups: { data: null, at: 0, loading: false, ttl: 60000 },
    activity: { data: null, at: 0, loading: false, ttl: 30000, err: false, stamp: '' }
  };
  function fetchRemote(key, url, stamp) {
    var r = remote[key];
    if (r.loading) return;
    r.loading = true;
    J.api.get(url).then(function (data) {
      r.data = data; r.err = false;
    }, function () {
      r.err = true;
    }).then(function () {
      r.loading = false; r.at = Date.now();
      if (stamp !== undefined) r.stamp = stamp;
      if (J.app.route() === 'dashboard') J.app.rerenderView();
    });
  }
  function stale(key, stamp) {
    var r = remote[key];
    return !r.loading && (!r.at || Date.now() - r.at > r.ttl || (stamp !== undefined && stamp !== r.stamp));
  }
  /** Cheap fingerprint of the candidate data: changes whenever a candidate is added, changed or removed. */
  function dataStamp() {
    var max = '';
    S.all().forEach(function (c) { if (c.updatedAt && c.updatedAt > max) max = c.updatedAt; });
    return S.count() + '|' + max;
  }

  function backupBanner() {
    if (!J.auth.can('backup.manage')) return '';
    if (stale('backups')) fetchRemote('backups', '/api/backups');
    var b = remote.backups.data;
    if (!b) return '';
    var last = b.lastSuccess && b.lastSuccess.finished_at ? new Date(b.lastSuccess.finished_at) : null;
    var hours = last ? (Date.now() - last.getTime()) / 36e5 : null;
    var failed = b.lastStatus === 'failed';
    if (!failed && last && hours <= 36) return '';
    var msg = failed ? t('The last database backup failed.') : last ? t('The last successful backup is from {0}.', U.fmtDateTime(last)) : t('No successful database backup exists yet.');
    var sub = failed ? (last ? t('Last successful backup: {0}.', U.fmtDateTime(last)) : t('No successful database backup exists yet.')) : t('Backups should run at least once a day. Please check the backup settings.');
    return '<div class="banner ' + (failed ? 'red' : 'amber') + '">' + icon(failed ? 'alert' : 'database') + '<div class="grow"><b>' + esc(msg) + '</b> ' + esc(sub) + '</div>' +
      '<button class="btn sm dark" data-action="dash-backup">' + icon('settings', 'sm') + esc(t('Open backup settings')) + '</button></div>';
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
    var rows = L.targets(list);
    var canEdit = J.auth.can('settings.write');
    var proj = S.settings().activeProject;
    var edit = canEdit ? '<button class="btn xs ghost" data-action="go" data-route="settings" data-params=\'{"section":"targets"}\' data-tip="' + esc(t('Change the targets in Settings')) + '">' + icon('edit', 'sm') + esc(t('Edit')) + '</button>' : '';
    var head = '<div class="card-head"><h3>' + icon('target', 'sm') + esc(t('Recruitment Target')) + '</h3>' + edit + '</div>';
    function rate(l, v, tip) {
      return '<div class="rate" data-tip="' + esc(tip) + '"><div class="rl">' + esc(l) + '</div><div class="rv">' + v + '%</div>' + ui.progress(v, ui.pctClass(v)) + '</div>';
    }
    var rates = '<div class="rates">' +
      rate(t('Readiness rate'), tg.readinessRate, t('Administratively ready or started ÷ candidates')) +
      rate(t('Document completion'), tg.docRate, t('Received/verified ÷ required documents')) +
      rate(t('Contract completion'), tg.contractRate, t('Signed contracts ÷ candidates')) + '</div>';
    if (!rows.length) {
      return '<div class="card">' + head + '<div class="card-body">' +
        ui.empty('target', t('No recruitment targets configured'), esc(t('Define how many drivers are needed per project or station to track progress here.')),
          canEdit ? '<button class="btn" data-action="go" data-route="settings" data-params=\'{"section":"targets"}\'>' + icon('settings', 'sm') + esc(t('Set up targets')) + '</button>' : '') +
        rates + '</div></div>';
    }
    var req = tg.required || 1;
    var wStarted = Math.min(100, (tg.started / req) * 100);
    var wReady = Math.min(100 - wStarted, (Math.max(0, tg.adminReady - tg.started) / req) * 100);
    var stat = function (label, v, color) { return '<div class="s" style="padding:6px 8px;min-width:0"><span>' + esc(label) + '</span><b' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</b></div>'; };
    var table = '<div class="section-title mt-16">' + esc(t('Targets by project / station')) + '</div>' + rows.map(function (r) {
      return '<div style="padding:8px 0;border-top:1px solid var(--border)">' +
        '<div class="row between" style="align-items:baseline"><div class="nowrap" style="overflow:hidden;text-overflow:ellipsis;min-width:0"><span class="strong">' + esc(r.project) + '</span> <span class="muted small">· ' + esc(r.station || t('All stations')) + '</span></div>' +
        '<span class="small strong" style="flex:none">' + r.progressPct + '%</span></div>' +
        '<div class="small muted" style="margin:2px 0 6px">' + esc(t('Required {0} · Admin. ready {1} · Started {2} · Remaining {3}', r.required, r.adminReady, r.started, r.remaining)) + '</div>' +
        ui.progress(r.progressPct, ui.pctClass(r.progressPct)) + '</div>';
    }).join('');
    return '<div class="card">' + head + '<div class="card-body">' +
      '<div class="target-top"><div><div class="small muted">' + esc(t('Administratively ready (incl. started)')) + '</div><div class="target-big">' + tg.adminReady + ' <small>/ ' + tg.required + '</small></div></div>' +
      '<div style="text-align:end"><div class="small muted">' + esc(t('Target progress')) + '</div><div style="font-size:22px;font-weight:650">' + tg.progressPct + '%</div></div></div>' +
      '<div class="stack-bar" role="img" aria-label="' + esc(t('{0} administratively ready (incl. {1} started) of {2} required', tg.adminReady, tg.started, tg.required)) + '">' +
      '<span style="width:' + wStarted + '%;background:var(--ink)" data-tip="' + esc(t('Started: {0}', tg.started)) + '"></span>' +
      '<span style="width:' + wReady + '%;background:var(--green)" data-tip="' + esc(t('Ready, not yet started: {0}', Math.max(0, tg.adminReady - tg.started))) + '"></span></div>' +
      '<div class="legend"><span><i style="background:var(--ink)"></i>' + esc(t('Started {0}', tg.started)) + '</span><span><i style="background:var(--green)"></i>' + esc(t('Ready, not yet started: {0}', Math.max(0, tg.adminReady - tg.started))) + '</span></div>' +
      '<div class="target-stats" style="grid-template-columns:repeat(auto-fit,minmax(68px,1fr));gap:6px">' + stat(t('Required'), tg.required) + stat(t('Candidates'), tg.candidates) +
      stat(t('Admin. ready'), tg.adminReady, 'var(--green)') + stat(t('Started'), tg.started) + stat(t('Remaining'), tg.remaining, tg.remaining ? 'var(--red)' : 'var(--green)') + '</div>' +
      table + rates +
      (tg.position ? '<div class="small muted mt-12">' + (proj !== 'all'
        ? t('Counting position "{0}" in project {1}. Coverage: {2} of {3} needed candidates in pipeline.', esc(tg.position), esc(proj), tg.candidates, tg.required)
        : t('Counting position "{0}" across all projects. Coverage: {1} of {2} needed candidates in pipeline.', esc(tg.position), tg.candidates, tg.required)) + '</div>' : '') +
      '</div></div>';
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

  /* i18n: t('Phone') t('WhatsApp') t('Email') t('Meeting') t('Other') */
  var FU_TYPES = { phone: ['Phone', 'phone'], whatsapp: ['WhatsApp', 'message'], email: ['Email', 'mail'], meeting: ['Meeting', 'meeting'], other: ['Other', 'activity'] };

  function followCard(list) {
    var canWrite = J.auth.can('candidate.write');
    var today = U.todayISO(), in7 = U.addDays(today, 7);
    var overdue = [], due = [], upcoming = [];
    list.forEach(function (c) {
      if (!c.followUpDate) return;
      var f = L.info(c).followUp;
      if (f === 'overdue') overdue.push(c);
      else if (f === 'today') due.push(c);
      else if (f === 'upcoming' && c.followUpDate <= in7) upcoming.push(c);
    });
    function byWhen(a, b) { return (a.followUpDate + ' ' + (a.followUpTime || '99:99')).localeCompare(b.followUpDate + ' ' + (b.followUpTime || '99:99')); }
    overdue.sort(byWhen); due.sort(byWhen); upcoming.sort(byWhen);
    function row(c, kind) {
      var d = U.daysUntil(c.followUpDate);
      var ty = FU_TYPES[c.followUpType] || null;
      var when = kind === 'overdue' ? ui.badge(Math.abs(d) === 1 ? t('{0} day overdue', Math.abs(d)) : t('{0} days overdue', Math.abs(d)), 'red', 'alert')
        : kind === 'today' ? ui.badge(c.followUpTime ? t('Today {0}', c.followUpTime) : t('Today'), 'amber', 'clock')
          : ui.badge((d === 1 ? t('Tomorrow') : U.weekday(c.followUpDate) + ' ' + U.fmtDate(c.followUpDate).slice(0, 6)) + (c.followUpTime ? ' ' + c.followUpTime : ''), 'blue', 'calendar');
      var meta = [];
      if (ty) meta.push(icon(ty[1], 'sm') + ' ' + esc(t(ty[0])));
      if (kind === 'overdue' && (c.followUpDate || c.followUpTime)) meta.push(esc(U.fmtDate(c.followUpDate) + (c.followUpTime ? ' ' + c.followUpTime : '')));
      return '<div class="list-item clickable" data-action="open-candidate" data-id="' + esc(c.id) + '"><div class="avatar sm">' + esc(U.initials(c)) + '</div>' +
        '<div class="grow"><div class="title">' + esc(U.fullName(c)) + '</div><div class="desc">' + esc(c.followUpNote || t('No note')) + '</div>' +
        (meta.length ? '<div class="meta">' + meta.join(' · ') + '</div>' : '') + '</div>' + when +
        (canWrite ? '<button class="icon-btn" data-action="follow-up" data-id="' + esc(c.id) + '" data-stop aria-label="' + esc(t('Update follow-up')) + '" data-tip="' + esc(t('Reschedule or mark done')) + '">' + icon('edit', 'sm') + '</button>' : '') + '</div>';
    }
    var MAX = 8;
    function group(title, items, kind, emptyText, first) {
      var more = items.length - MAX;
      return '<div class="section-title" style="padding:12px 18px 0' + (first ? '' : ';border-top:1px solid var(--border)') + '">' + esc(title) + ' · ' + items.length + '</div>' +
        (items.length ? items.slice(0, MAX).map(function (c) { return row(c, kind); }).join('') : '<div class="small muted" style="padding:6px 18px 12px">' + esc(emptyText) + '</div>') +
        (more > 0 ? '<div style="padding:6px 18px 10px"><button class="btn xs ghost" data-action="go" data-route="candidates" data-params=\'' + esc(JSON.stringify({ followUp: kind === 'upcoming' ? 'any' : kind })) + '\'>' + esc(t('+{0} more', more)) + ' ' + icon('arrowRight', 'sm') + '</button></div>' : '');
    }
    return '<div class="card"><div class="card-head"><h3>' + icon('bell', 'sm') + esc(t('Follow-ups')) + '</h3>' +
      (canWrite ? '<button class="btn xs" data-action="follow-up">' + icon('plus', 'sm') + esc(t('Add follow-up')) + '</button>' : '') + '</div>' +
      '<div class="card-body flush" style="max-height:520px;overflow:auto">' +
      group(t('Overdue'), overdue, 'overdue', t('No overdue follow-ups.'), true) +
      group(t('Today'), due, 'today', t('No follow-ups due today.')) +
      group(t('Upcoming (next 7 days)'), upcoming, 'upcoming', t('No follow-ups in the next 7 days.')) +
      '</div></div>';
  }

  /** "5 min ago", "Today 14:30", "Yesterday 14:30", "Monday 09:10", "12.09.2026, 09:10" */
  function relTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return t('Just now');
    if (mins < 60) return t('{0} min ago', mins);
    var days = -U.daysUntil(U.toISODate(d));
    var hm = U.fmtTime(d);
    if (days === 0) return t('Today {0}', hm);
    if (days === 1) return t('Yesterday {0}', hm);
    if (days > 1 && days < 7) return U.weekday(U.toISODate(d)) + ' ' + hm;
    return U.fmtDateTime(d);
  }

  function activityCard() {
    var stamp = dataStamp();
    if (stale('activity', stamp)) fetchRemote('activity', '/api/activity/recent?limit=12', stamp);
    var r = remote.activity;
    var body;
    if (!r.data) {
      body = r.err && !r.loading ? '<div class="small muted" style="padding:14px 18px">' + esc(t('Recent activity could not be loaded.')) + '</div>'
        : '<div class="small muted" style="padding:14px 18px">' + esc(t('Loading recent activity…')) + '</div>';
    } else if (!r.data.length) {
      body = ui.empty('activity', t('No activity yet'), esc(t('Calls, notes and changes to candidates will appear here.')));
    } else {
      body = r.data.map(function (a) {
        var ty = C.ACTIVITY_TYPES.filter(function (x) { return x.key === a.type; })[0];
        var exists = !!S.get(a.candidateId);
        var name = esc(a.candidate || a.candidateId);
        return '<div class="list-item' + (exists ? ' clickable" data-action="open-candidate" data-id="' + esc(a.candidateId) + '"' : '"') + '>' +
          '<div class="avatar sm">' + icon(ty ? ty.icon : 'activity', 'sm') + '</div>' +
          '<div class="grow"><div class="title">' + name + '</div><div class="desc" style="overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + esc(a.text) + '</div>' +
          '<div class="meta">' + (a.by ? icon('user', 'sm') + ' ' + esc(a.by) + ' · ' : '') + '<span title="' + esc(U.fmtDateTime(a.date)) + '">' + esc(relTime(a.date)) + '</span></div></div></div>';
      }).join('');
    }
    return '<div class="card"><div class="card-head"><h3>' + icon('activity', 'sm') + esc(t('Recent Activity')) + '</h3><span class="hint">' + esc(t('Latest changes by all users')) + '</span></div>' +
      '<div class="card-body flush" style="max-height:520px;overflow:auto">' + body + '</div></div>';
  }

  J.views.dashboard = {
    render: function () {
      var s = S.settings();
      var list = L.scoped();
      var k = L.kpis(list);
      var canWrite = J.auth.can('candidate.write');
      var proj = s.activeProject !== 'all' ? s.activeProject : s.defaultProject;
      var head = '<div class="page-head"><div><div class="eyebrow">' + t('Recruiting Overview') + ' · ' + (/dhl/i.test(proj) ? t('{0} Project', '<span class="dhl-pill" style="height:17px;font-size:10px">' + esc(proj) + '</span>') : esc(proj || t('All projects'))) + '</div>' +
        '<h1>' + U.greeting() + '</h1><div class="sub">' + U.longDate() + ' · ' + (list.length === 1 ? t('{0} active candidate', list.length) : t('{0} active candidates', list.length)) + '</div></div>' +
        '<div class="actions"><button class="btn" data-action="print-dashboard">' + icon('printer', 'sm') + t('Print overview') + '</button>' +
        (canWrite ? '<button class="btn primary" data-action="add-candidate">' + icon('plus') + t('Add Candidate') + '</button>' : '') + '</div></div>';

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

      var qa = [];
      if (canWrite) qa.push(['add-candidate', 'plus', t('Add Candidate')], ['follow-up', 'bell', t('Add Follow-up')]);
      qa.push(['go-missing', 'file', t('View Missing Documents')], ['go-starting', 'calendar', t('View Starting Soon')]);
      if (J.auth.can('export')) qa.push(['export-candidates-quick', 'download', t('Export Candidates')]);
      if (J.auth.can('backup.manage')) qa.push(['dash-backup', 'database', t('Backup Database')]);
      var quick = '<div class="quick mt-16">' + qa.map(function (q) { return '<button data-action="' + q[0] + '"><span class="qi">' + icon(q[1]) + '</span>' + esc(q[2]) + '</button>'; }).join('') + '</div>';

      return backupBanner() + head + kpis + quick +
        '<div class="grid two mt-16">' + attentionCard(list) + targetCard(list) + '</div>' +
        '<div class="mt-16">' + upcomingCard(list) + '</div>' +
        '<div class="grid halves mt-16">' + followCard(list) + activityCard() + '</div>';
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
  A['dash-backup'] = function () { J.app.go('settings', { section: 'backup' }); };
})();
