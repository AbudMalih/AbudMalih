/* Onboarding overview: checklist matrix across candidates. */
(function () {
  'use strict';
  var J = window.J, U = J.util, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon, t = J.t;
  var tab = 'active';
  var q = '';
  var page = 0, SIZE = 100;

  function inScope(c, i) {
    var d = i.daysToStart;
    return ['contract', 'ready', 'started'].indexOf(c.stage) !== -1 || i.onboarding.state === 'in_progress' || (d !== null && d <= 60);
  }

  J.views.onboarding = {
    render: function () {
      var s = S.settings();
      var all = L.scoped();
      var groups = { active: [], complete: [], all: all };
      all.forEach(function (c) {
        var i = L.info(c);
        if (i.onboarding.complete) groups.complete.push(c);
        else if (inScope(c, i)) groups.active.push(c);
      });
      var list = groups[tab].filter(function (c) { return !q || L.matches(c, q); })
        .sort(function (a, b) { return (a.startDate || '9999').localeCompare(b.startDate || '9999'); });
      var pages = Math.max(1, Math.ceil(list.length / SIZE));
      if (page >= pages) page = pages - 1;
      var total = list.length;
      list = list.slice(page * SIZE, page * SIZE + SIZE);
      var steps = s.onboardingSteps;
      var avg = groups.active.length ? Math.round(groups.active.reduce(function (sum, c) { return sum + L.info(c).onboarding.pct; }, 0) / groups.active.length) : 0;

      var head = '<div class="page-head"><div><h1>' + esc(t('Onboarding')) + '</h1><div class="sub">' + esc(t('Track every onboarding step until the first working day. Tick a box to complete a step – changes save automatically.')) + '</div></div>' +
        '<div class="actions"><button class="btn" data-action="go" data-route="settings" data-params=\'{"section":"onboarding"}\'>' + icon('settings', 'sm') + esc(t('Customise steps')) + '</button></div></div>';

      var kp = '<div class="grid thirds mb-16">' +
        '<div class="card kpi" style="cursor:default"><div class="label">' + esc(t('In onboarding')) + '</div><div class="value">' + groups.active.length + '</div><div class="ctx">' + esc(t('Average progress {0}%', avg)) + '</div></div>' +
        '<div class="card kpi" style="cursor:default"><div class="label">' + esc(t('Starting ≤ 7 days, incomplete')) + '</div><div class="value" style="color:var(--red)">' + groups.active.filter(function (c) { var d = L.info(c).daysToStart; return d !== null && d >= 0 && d <= 7; }).length + '</div><div class="ctx">' + esc(t('Prioritise these candidates')) + '</div></div>' +
        '<div class="card kpi accent-green" style="cursor:default"><div class="label">' + esc(t('Onboarding complete')) + '</div><div class="value">' + groups.complete.length + '</div><div class="ctx">' + esc(t('All {0} steps done', steps.length)) + '</div></div></div>';

      /* i18n: t('In onboarding') t('Complete') t('All active candidates') */
      var tb = '<div class="toolbar"><div class="seg-tabs">' + [['active', 'In onboarding'], ['complete', 'Complete'], ['all', 'All active candidates']].map(function (x) {
        return '<button class="' + (tab === x[0] ? 'on' : '') + '" data-action="ob-tab" data-t="' + x[0] + '">' + esc(t(x[1])) + '<span class="n">' + groups[x[0]].length + '</span></button>';
      }).join('') + '</div><div class="search-input">' + icon('search') + '<input type="search" id="ob-q" placeholder="' + esc(t('Search…')) + '" value="' + esc(q) + '" data-input="ob-q" aria-label="' + esc(t('Search')) + '"></div></div>';

      var table = list.length ? '<div class="table-wrap" data-keep-scroll="ob"><table class="data compact matrix"><thead><tr><th class="sticky-col">' + esc(t('Candidate')) + '</th><th>' + esc(t('Start')) + '</th><th>' + esc(t('Progress')) + '</th>' +
        steps.map(function (st) { return '<th class="rot center" title="' + esc(t(st.label)) + '">' + esc(t(st.label)) + (st.auto ? '<br><span class="auto-tag">' + esc(t('auto')) + '</span>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        list.map(function (c) {
          var i = L.info(c);
          return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '" data-tab="onboarding"><td class="name-cell sticky-col">' + esc(U.fullName(c)) + '<div class="sub">' + (c.station ? esc(c.station) : esc(t('Station pending'))) + ' · ' + ui.stageBadge(c.stage).replace('badge outline', 'badge outline" style="height:18px;font-size:10.5px') + '</div></td>' +
            '<td>' + (c.startDate ? U.fmtDate(c.startDate) + '<div>' + ui.daysPill(i.daysToStart) + '</div>' : '<span class="muted">' + esc(t('Pending')) + '</span>') + '</td>' +
            '<td>' + ui.miniProgress(i.onboarding.done, i.onboarding.total, i.onboarding.next ? t('Next: {0}', t(i.onboarding.next)) : t('Complete')) + '</td>' +
            i.onboarding.steps.map(function (st) {
              return '<td class="center"><button class="ob-check ' + (st.done ? 'on' : '') + (st.auto ? ' auto' : '') + '" ' +
                (st.auto ? 'data-action="noop" data-tip="' + esc(st.auto === 'documents' ? t('Automatic – from document checklist') : t('Automatic – from contract status')) + '"' : 'data-action="toggle-onboarding" data-id="' + esc(c.id) + '" data-step="' + st.key + '" data-tip="' + esc(st.done && st.date ? t('{0} – done {1}', t(st.label), U.fmtDate(st.date)) : t(st.label)) + '"') +
                ' aria-label="' + esc(st.done ? t('{0}: done', t(st.label)) : t('{0}: open', t(st.label))) + '">' + (st.done ? icon('check') : '') + '</button></td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        (pages > 1 ? '<div class="pager"><span>' + esc(t('{0} candidates · page {1} of {2}', total, page + 1, pages)) + '</span><div class="row"><button class="btn sm" data-action="ob-page" data-d="-1"' + (page === 0 ? ' disabled' : '') + '>' + esc(t('Previous')) + '</button><button class="btn sm" data-action="ob-page" data-d="1"' + (page >= pages - 1 ? ' disabled' : '') + '>' + esc(t('Next')) + '</button></div></div>' : '')
        : ui.empty('onboarding', tab === 'complete' ? t('No completed onboardings yet') : t('Nobody in onboarding'), esc(t('Candidates appear here once they reach the Contract stage, are starting within 60 days, or have onboarding steps ticked.')));

      return head + kp + '<div class="card">' + tb + table + '</div>';
    }
  };
  A['ob-page'] = function (el) { page += +el.getAttribute('data-d'); J.app.rerenderView(); };
  A['ob-tab'] = function (el) { page = 0; tab = el.getAttribute('data-t'); J.app.rerenderView(); };
  var deb = U.debounce(function () { J.app.rerenderView(); }, 140);
  A['ob-q'] = function (el) { q = el.value; page = 0; deb(); };
})();
