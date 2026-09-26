/* Printable documents (browser print → "Save as PDF"). */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, A = J.actions;
  var esc = U.esc;
  var PR = (J.print = {});

  function header(title) {
    var s = S.settings();
    var proj = s.activeProject !== 'all' ? s.activeProject : s.defaultProject;
    return '<div class="p-head"><img src="assets/jarbou-logo.svg" alt="JARBOU Logistik GmbH"><div class="r"><b>' + esc(title) + '</b>' + esc(s.companyName) + ' · Recruiting Command Center<br>' + (proj ? esc(proj) + ' Project · ' : '') + 'Printed ' + U.fmtDateTime(new Date().toISOString()) + '</div></div>';
  }
  function footer() {
    return '<div class="p-foot"><span>' + esc(S.settings().companyName) + ' – INTERNAL USE ONLY – contains personal data (DSGVO)</span><span>Printed ' + U.fmtDateTime(new Date().toISOString()) + '</span></div>';
  }
  function kv(rows) {
    return '<table>' + rows.map(function (r) { return '<tr><td class="k">' + esc(r[0]) + '</td><td>' + (r[2] ? r[1] : esc(r[1] === '' || r[1] == null ? '—' : r[1])) + '</td></tr>'; }).join('') + '</table>';
  }

  function doPrint(html) {
    var root = document.getElementById('print-root');
    root.innerHTML = '<div class="p-doc">' + html + '</div>';
    document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    var img = root.querySelector('img');
    var go = function () { setTimeout(function () { window.print(); setTimeout(function () { if (document.body.classList.contains('printing') && !window.matchMedia('print').matches) done(); }, 1500); }, 50); };
    if (img && !img.complete) { img.onload = go; img.onerror = go; } else go();
  }

  PR.candidate = function (id) {
    var c = S.get(id);
    var i = L.info(c);
    var s = S.settings();
    var ready = i.overall === 'ready';
    var status = i.overall === 'started' ? 'STARTED' : i.overall === 'archived' ? 'ARCHIVED' : ready ? 'READY TO START' : 'NOT READY';
    var html = header('Candidate Summary') +
      '<div class="p-title"><div><h1>' + esc(U.fullName(c)) + '</h1><div class="id">' + esc(c.id) + ' · ' + esc(c.position || '—') + ' · ' + esc(c.project || '—') + (c.station ? ' · ' + esc(c.station) : '') + '</div></div>' +
      '<span class="p-status ' + (ready || i.overall === 'started' ? 'ok' : 'no') + '">' + status + '</span></div>' +
      '<div class="p-grid">' +
      '<div class="p-sec"><h3>Contact details</h3>' + kv([['Phone', c.phone || 'Pending'], ['Email', c.email || 'Pending'], ['Address', [c.address, c.city].filter(Boolean).join(', ') || 'Pending'], ['Date of birth', U.fmtDate(c.dob) || 'Pending'], ['Nationality', c.nationality || 'Pending'], ['Preferred language', c.language || 'Pending']]) + '</div>' +
      '<div class="p-sec"><h3>Employment</h3>' + kv([['Position', c.position], ['Project', c.project], ['Station', c.station || 'Pending'], ['Employment type', c.employmentType], ['Planned start date', c.startDate ? U.fmtDate(c.startDate) + ' (' + U.weekday(c.startDate) + ')' : 'Pending'], ['Tax class', c.taxClass], ['Working hours / week', c.hoursPerWeek != null ? c.hoursPerWeek + ' h' : '']]) + '</div>' +
      '<div class="p-sec"><h3>Salary information</h3>' + kv([['Standard salary reference', c.salaryReference != null ? U.fmtMoney(c.salaryReference) + ' ' + c.salaryBasis : ''], ['Candidate expectation', L.salaryText(c)], ['Contract salary', c.contract.salary != null ? U.fmtMoney(c.contract.salary) : '']]) + '</div>' +
      '<div class="p-sec"><h3>Readiness</h3>' + kv([
        ['Candidate availability', '<span class="p-mark ' + (i.willing ? 'ok' : 'mid') + '">' + esc(L.availability(c.availability).short) + '</span>', true],
        ['Administrative readiness', '<span class="p-mark ' + (i.admin.ready ? 'ok' : 'no') + '">' + (i.admin.ready ? 'Complete' : 'Not ready – ' + i.admin.reasons.length + ' outstanding') + '</span>', true],
        ['Recruitment status', L.stage(c.stage).label], ['Recruiter', c.recruiter || 'Unassigned']]) +
      (i.admin.reasons.length ? '<ul class="p-list">' + i.admin.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      '</div>' +
      '<div class="p-sec"><h3>Document checklist · ' + i.docs.complete + ' / ' + i.docs.total + ' (' + i.docs.pct + '%)</h3><table><tr><th>Document</th><th>Status</th><th>Issued</th><th>Expires</th><th>Note</th></tr>' +
      s.documents.map(function (d) {
        var e = c.documents[d.key] || { status: d.required ? 'missing' : 'not_required' };
        var st = e.status;
        return '<tr><td>' + esc(d.label) + '</td><td><span class="p-mark ' + (st === 'verified' || st === 'received' ? 'ok' : st === 'not_required' ? '' : st === 'requested' ? 'mid' : 'no') + '">' + (st === 'verified' || st === 'received' ? '✓ ' : st === 'missing' ? '✗ ' : '') + esc(L.docStatus(st).label) + '</span></td><td>' + (U.fmtDate(e.issueDate) || '') + '</td><td>' + (U.fmtDate(e.expiryDate) || '') + '</td><td>' + esc(e.note || '') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="p-grid">' +
      '<div class="p-sec"><h3>Contract</h3>' + kv([['Status', L.contractStatus(c.contract.status).label], ['Type', c.contract.type], ['Weekly hours', c.contract.hours != null ? c.contract.hours + ' h' : ''], ['Start', U.fmtDate(c.contract.startDate)], ['End', c.contract.endDate ? U.fmtDate(c.contract.endDate) : 'Unlimited / not set'], ['Signed', U.fmtDate(c.contract.signedDate)]]) + '</div>' +
      '<div class="p-sec"><h3>Onboarding · ' + i.onboarding.done + ' / ' + i.onboarding.total + ' (' + i.onboarding.pct + '%)</h3><table>' +
      i.onboarding.steps.map(function (st) { return '<tr><td>' + (st.done ? '☑' : '☐') + ' ' + esc(st.label) + '</td><td>' + (st.done && st.date ? U.fmtDate(st.date) : '') + '</td></tr>'; }).join('') + '</table></div>' +
      '</div>' +
      '<div class="p-sec"><h3>Next action & follow-up</h3>' + kv([['Next action', c.nextAction], ['Next follow-up', c.followUpDate ? U.fmtDate(c.followUpDate) + (c.followUpNote ? ' – ' + c.followUpNote : '') : '']]) + '</div>' +
      '<div class="p-sec"><h3>Internal notes</h3><div class="p-note">' + esc(c.notes || '—') + '</div></div>' +
      footer();
    doPrint(html);
  };

  PR.list = function (list, title) {
    var html = header(title) + '<div class="p-sec"><h3>' + list.length + ' candidates</h3><table><tr><th>ID</th><th>Name</th><th>Position</th><th>Station</th><th>Type</th><th>Start</th><th>Docs</th><th>Contract</th><th>Status</th></tr>' +
      list.map(function (c) {
        var i = L.info(c);
        return '<tr><td>' + esc(c.id) + '</td><td><b>' + esc(U.fullName(c)) + '</b></td><td>' + esc(c.position) + '</td><td>' + esc(c.station) + '</td><td>' + esc(c.employmentType) + '</td><td>' + U.fmtDate(c.startDate) + '</td><td>' + i.docs.complete + '/' + i.docs.total + '</td><td>' + L.contractStatus(c.contract.status).label + '</td><td>' + C.OVERALL[i.overall].label + '</td></tr>';
      }).join('') + '</table></div>' + footer();
    doPrint(html);
  };

  PR.overview = function () {
    var list = L.scoped();
    var k = L.kpis(list), t = L.target(list);
    var att = L.attention(list).filter(function (x) { return x.w.priority !== 'low'; }).slice(0, 25);
    var html = header('Recruiting Overview') +
      '<div class="p-kpis">' + [['Total candidates', k.total], ['Ready to start', k.ready], ['In recruitment', k.inRecruitment], ['Documents missing', k.docsMissing], ['Contract pending', k.contractPending], ['Onboarding', k.onboarding], ['Starting this month', k.startMonth], ['Starting next 7 days', k.start7]]
        .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="p-sec"><h3>Driver recruitment target</h3>' + kv([['Required drivers', t.required], ['Candidates', t.candidates], ['Ready / started', t.secured], ['Remaining', t.remaining], ['Readiness rate', t.readinessRate + '%'], ['Document completion rate', t.docRate + '%'], ['Contract completion rate', t.contractRate + '%']]) + '</div>' +
      '<div class="p-sec"><h3>Attention required (high & medium priority)</h3>' + (att.length ? '<table><tr><th>Candidate</th><th>Problem</th><th>Start</th><th>Priority</th></tr>' +
        att.map(function (x) { return '<tr><td>' + esc(U.fullName(x.c)) + '</td><td>' + esc(x.w.problem) + '</td><td>' + (U.fmtDate(x.c.startDate) || '—') + '</td><td>' + x.w.priority.toUpperCase() + '</td></tr>'; }).join('') + '</table>' : '<p>No open issues.</p>') + '</div>' +
      footer();
    doPrint(html);
  };

  PR.starting = function () {
    var list = L.scoped().filter(function (c) { var d = L.info(c).daysToStart; return d !== null && d >= -7 && d <= 45; }).sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
    var html = header('Starting Soon') + '<div class="p-sec"><h3>Candidates starting within 45 days</h3><table><tr><th>Start</th><th>Days</th><th>Name</th><th>Station</th><th>Type</th><th>Status</th><th>Open issues</th></tr>' +
      list.map(function (c) {
        var i = L.info(c);
        return '<tr><td>' + U.fmtDate(c.startDate) + '</td><td>' + i.daysToStart + '</td><td><b>' + esc(U.fullName(c)) + '</b><br>' + esc(c.id) + '</td><td>' + esc(c.station) + '</td><td>' + esc(c.employmentType) + '</td><td>' + C.OVERALL[i.overall].label + '</td><td>' + esc(i.admin.reasons.join('; ') + (i.willing ? '' : (i.admin.reasons.length ? '; ' : '') + 'Availability: ' + L.availability(c.availability).short)) + '</td></tr>';
      }).join('') + '</table></div>' + footer();
    doPrint(html);
  };

  PR.report = function (r, label) {
    var m = L.report(r);
    var period = label || ((r.from ? U.fmtDate(r.from) : '…') + ' – ' + (r.to ? U.fmtDate(r.to) : '…'));
    var srcKeys = Object.keys(m.sources).filter(function (k) { return m.sources[k].candidates; });
    var maxS = Math.max(1, Math.max.apply(null, srcKeys.map(function (k) { return m.sources[k].candidates; }).concat([1])));
    var html = header('Recruitment Report') + '<div class="p-title"><h1>Recruitment Report</h1><div class="id">Period: ' + esc(period) + '</div></div>' +
      '<div class="p-kpis">' + [['Candidates added', m.added.length], ['Interviews', m.interviews], ['Became ready', m.ready], ['Started', m.started], ['Rejected / withdrawn', m.negative], ['Missing documents (now)', m.missingDocs], ['Contracts signed', m.signed], ['Target secured', m.target.secured + ' / ' + m.target.required]]
        .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="p-grid"><div class="p-sec"><h3>Pipeline (active candidates)</h3><table>' + C.STAGES.map(function (s) { return '<tr><td>' + s.label + '</td><td>' + (m.stages[s.key] || 0) + '</td></tr>'; }).join('') + '</table></div>' +
      '<div class="p-sec"><h3>Rates (current)</h3>' + kv([['Readiness rate', m.target.readinessRate + '%'], ['Document completion', m.target.docRate + '%'], ['Contract completion', m.target.contractRate + '%'], ['Remaining drivers to target', m.target.remaining]]) + '</div></div>' +
      '<div class="p-sec"><h3>Source performance</h3>' + (srcKeys.length ? '<table><tr><th>Source</th><th>Candidates</th><th></th><th>Ready</th><th>Started</th><th>Conversion</th></tr>' +
        srcKeys.map(function (k) { var x = m.sources[k]; return '<tr><td>' + esc(k) + '</td><td>' + x.candidates + '</td><td><span class="p-bar" style="width:' + Math.round(x.candidates / maxS * 120) + 'px"></span></td><td>' + x.ready + '</td><td>' + x.started + '</td><td>' + U.pct(x.ready + x.started, x.candidates) + '%</td></tr>'; }).join('') + '</table>' : '<p>No candidates added in this period.</p>') + '</div>' +
      footer();
    doPrint(html);
  };

  A['print-candidate'] = function (el) { PR.candidate(el.getAttribute('data-id')); };
})();
