/* Starting Soon: operational view of upcoming start dates. */
(function () {
  'use strict';
  var J = window.J, U = J.util, S = J.store, L = J.logic, ui = J.ui;
  var esc = U.esc, icon = U.icon, t = J.t;

  function section(title, sub, list, ic, emptyText) {
    var rows = list.slice().sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
    var incomplete = rows.filter(function (c) { var o = L.info(c).overall; return o === 'not_ready'; }).length;
    return '<div class="card mb-16"><div class="card-head"><h3>' + icon(ic, 'sm') + esc(title) + ' <span class="badge">' + rows.length + '</span>' + (incomplete ? ' <span class="badge red">' + icon('alert') + esc(t('{0} not ready', incomplete)) + '</span>' : '') + '</h3><span class="hint">' + esc(sub) + '</span></div>' +
      (rows.length ? '<div class="table-wrap" style="max-height:none;min-height:0"><table class="data"><thead><tr><th>' + esc(t('Candidate')) + '</th><th>' + esc(t('Start date')) + '</th><th>' + esc(t('Days')) + '</th><th class="hide-md">' + esc(t('Type')) + '</th><th class="hide-md">' + esc(t('Station')) + '</th><th>' + esc(t('Readiness')) + '</th><th class="hide-sm">' + esc(t('Documents')) + '</th><th class="hide-sm">' + esc(t('Contract')) + '</th><th class="hide-sm">' + esc(t('Onboarding')) + '</th><th>' + esc(t('Open issues')) + '</th></tr></thead><tbody>' +
        rows.map(function (c) {
          var i = L.info(c);
          var bad = i.overall === 'not_ready';
          return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '"' + (bad ? ' style="box-shadow:inset 3px 0 0 var(--red)"' : '') + '>' +
            '<td class="name-cell">' + esc(U.fullName(c)) + '<div class="sub">' + esc(c.id) + ' · ' + esc(c.position || '—') + '</div></td>' +
            '<td>' + U.fmtDate(c.startDate) + '<div class="small muted">' + U.weekday(c.startDate) + '</div></td>' +
            '<td>' + ui.daysPill(i.daysToStart) + '</td><td class="hide-md">' + (c.employmentType ? esc(t(c.employmentType)) : ui.val(c.employmentType)) + '</td><td class="hide-md">' + ui.val(c.station, 'Pending') + '</td>' +
            '<td>' + ui.overallBadge(i, true) + '</td><td class="hide-sm">' + ui.miniProgress(i.docs.complete, i.docs.total) + '</td>' +
            '<td class="hide-sm">' + ui.contractBadge(c.contract.status) + '</td><td class="hide-sm">' + ui.miniProgress(i.onboarding.done, i.onboarding.total) + '</td>' +
            '<td style="white-space:normal;min-width:220px;font-size:12px">' + (i.overall === 'ready' ? '<span style="color:var(--green)">' + icon('checkCircle', 'sm') + ' ' + esc(t('None – ready')) + '</span>' :
              (i.willing ? '' : '<div>' + icon('clock', 'sm') + ' ' + esc(t('Availability: {0}', t(L.availability(c.availability).short))) + '</div>') +
              i.admin.reasons.slice(0, 3).map(function (r) { return '<div style="color:var(--red)">' + icon('x', 'sm') + ' ' + esc(r) + '</div>'; }).join('') +
              (i.admin.reasons.length > 3 ? '<div class="muted">' + esc(t('+ {0} more', i.admin.reasons.length - 3)) + '</div>' : '')) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="card-body small muted">' + esc(emptyText) + '</div>') + '</div>';
  }

  J.views.starting = {
    render: function () {
      var today = U.todayISO();
      var list = L.scoped().filter(function (c) { return c.startDate; });
      var sw = U.startOfWeek(today), ew = U.addDays(sw, 6);
      var nw1 = U.addDays(sw, 7), nw2 = U.addDays(sw, 13);
      var ms = U.startOfMonth(today), me = U.endOfMonth(today);
      var notStarted = function (c) { return c.stage !== 'started'; };
      var passed = list.filter(function (c) { return c.startDate < today && notStarted(c); });
      var todayL = list.filter(function (c) { return c.startDate === today; });
      var week = list.filter(function (c) { return c.startDate > today && c.startDate <= ew; });
      var next = list.filter(function (c) { return c.startDate >= nw1 && c.startDate <= nw2; });
      var month = list.filter(function (c) { return c.startDate > today && c.startDate >= ms && c.startDate <= me && !(c.startDate <= ew) && !(c.startDate >= nw1 && c.startDate <= nw2); });
      var later = list.filter(function (c) { return c.startDate > me && c.startDate > nw2 && c.startDate <= U.addDays(today, 60); });

      return '<div class="page-head"><div><h1>' + esc(t('Starting Soon')) + '</h1><div class="sub">' + esc(t('Operational view of upcoming start dates. Rows marked red are close to their start date with open requirements.')) + '</div></div>' +
        '<div class="actions"><button class="btn" data-action="print-starting">' + icon('printer', 'sm') + esc(t('Print list')) + '</button></div></div>' +
        (passed.length ? section(t('Start date passed – status not updated'), t('Update stage to "Started" or change the start date'), passed, 'alert', '') : '') +
        section(t('Starting Today'), U.fmtDate(today), todayL, 'flag', t('No candidates starting today.')) +
        section(t('Starting This Week'), t('Until {0}', U.fmtDate(ew)), week, 'calendar', t('No candidates starting this week.')) +
        section(t('Starting Next Week'), U.fmtDate(nw1) + ' – ' + U.fmtDate(nw2), next, 'calendar', t('No candidates starting next week.')) +
        section(t('Starting This Month'), t('Rest of {0} (not listed above)', U.monthName(today)), month, 'calendar', t('No candidates starting this month.')) +
        (later.length ? section(t('Later (within 60 days)'), t('After {0}', U.fmtDate(me > nw2 ? me : nw2)), later, 'clock', '') : '');
    }
  };
  J.actions['print-starting'] = function () { J.print.starting(); };
})();
