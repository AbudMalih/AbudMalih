/* Onboarding overview: checklist matrix across candidates. */
(function () {
  'use strict';
  var J = window.J, U = J.util, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
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
      var avg = groups.active.length ? Math.round(groups.active.reduce(function (t, c) { return t + L.info(c).onboarding.pct; }, 0) / groups.active.length) : 0;

      var head = '<div class="page-head"><div><h1>Onboarding</h1><div class="sub">Track every onboarding step until the first working day. Tick a box to complete a step – changes save automatically.</div></div>' +
        '<div class="actions"><button class="btn" data-action="go" data-route="settings" data-params=\'{"section":"onboarding"}\'>' + icon('settings', 'sm') + 'Customise steps</button></div></div>';

      var kp = '<div class="grid thirds mb-16">' +
        '<div class="card kpi" style="cursor:default"><div class="label">In onboarding</div><div class="value">' + groups.active.length + '</div><div class="ctx">Average progress ' + avg + '%</div></div>' +
        '<div class="card kpi" style="cursor:default"><div class="label">Starting ≤ 7 days, incomplete</div><div class="value" style="color:var(--red)">' + groups.active.filter(function (c) { var d = L.info(c).daysToStart; return d !== null && d >= 0 && d <= 7; }).length + '</div><div class="ctx">Prioritise these candidates</div></div>' +
        '<div class="card kpi accent-green" style="cursor:default"><div class="label">Onboarding complete</div><div class="value">' + groups.complete.length + '</div><div class="ctx">All ' + steps.length + ' steps done</div></div></div>';

      var tb = '<div class="toolbar"><div class="seg-tabs">' + [['active', 'In onboarding'], ['complete', 'Complete'], ['all', 'All active candidates']].map(function (t) {
        return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-action="ob-tab" data-t="' + t[0] + '">' + t[1] + '<span class="n">' + groups[t[0]].length + '</span></button>';
      }).join('') + '</div><div class="search-input">' + icon('search') + '<input type="search" id="ob-q" placeholder="Search…" value="' + esc(q) + '" data-input="ob-q" aria-label="Search"></div></div>';

      var table = list.length ? '<div class="table-wrap" data-keep-scroll="ob"><table class="data compact matrix"><thead><tr><th class="sticky-col">Candidate</th><th>Start</th><th>Progress</th>' +
        steps.map(function (st) { return '<th class="rot center" title="' + esc(st.label) + '">' + esc(st.label) + (st.auto ? '<br><span class="auto-tag">auto</span>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        list.map(function (c) {
          var i = L.info(c);
          return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '" data-tab="onboarding"><td class="name-cell sticky-col">' + esc(U.fullName(c)) + '<div class="sub">' + esc(c.station || 'Station pending') + ' · ' + ui.stageBadge(c.stage).replace('badge outline', 'badge outline" style="height:18px;font-size:10.5px') + '</div></td>' +
            '<td>' + (c.startDate ? U.fmtDate(c.startDate) + '<div>' + ui.daysPill(i.daysToStart) + '</div>' : '<span class="muted">Pending</span>') + '</td>' +
            '<td>' + ui.miniProgress(i.onboarding.done, i.onboarding.total, i.onboarding.next ? 'Next: ' + i.onboarding.next : 'Complete') + '</td>' +
            i.onboarding.steps.map(function (st) {
              return '<td class="center"><button class="ob-check ' + (st.done ? 'on' : '') + (st.auto ? ' auto' : '') + '" ' +
                (st.auto ? 'data-action="noop" data-tip="Automatic – ' + (st.auto === 'documents' ? 'from document checklist' : 'from contract status') + '"' : 'data-action="toggle-onboarding" data-id="' + esc(c.id) + '" data-step="' + st.key + '" data-tip="' + esc(st.label) + (st.done && st.date ? ' – done ' + U.fmtDate(st.date) : '') + '"') +
                ' aria-label="' + esc(st.label) + ': ' + (st.done ? 'done' : 'open') + '">' + (st.done ? icon('check') : '') + '</button></td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        (pages > 1 ? '<div class="pager"><span>' + total + ' candidates · page ' + (page + 1) + ' of ' + pages + '</span><div class="row"><button class="btn sm" data-action="ob-page" data-d="-1"' + (page === 0 ? ' disabled' : '') + '>Previous</button><button class="btn sm" data-action="ob-page" data-d="1"' + (page >= pages - 1 ? ' disabled' : '') + '>Next</button></div></div>' : '')
        : ui.empty('onboarding', tab === 'complete' ? 'No completed onboardings yet' : 'Nobody in onboarding', 'Candidates appear here once they reach the Contract stage, are starting within 60 days, or have onboarding steps ticked.');

      return head + kp + '<div class="card">' + tb + table + '</div>';
    }
  };
  A['ob-page'] = function (el) { page += +el.getAttribute('data-d'); J.app.rerenderView(); };
  A['ob-tab'] = function (el) { page = 0; tab = el.getAttribute('data-t'); J.app.rerenderView(); };
  var deb = U.debounce(function () { J.app.rerenderView(); }, 140);
  A['ob-q'] = function (el) { q = el.value; page = 0; deb(); };
})();
