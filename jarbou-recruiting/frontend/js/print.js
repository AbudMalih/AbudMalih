/* Printable documents (browser print → "Save as PDF"). */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, A = J.actions;
  var esc = U.esc;
  var t = J.t;
  var PR = (J.print = {});

  function header(title) {
    var s = S.settings();
    var proj = s.activeProject !== 'all' ? s.activeProject : s.defaultProject;
    return '<div class="p-head"><img src="assets/jarbou-logo.svg" alt="JARBOU Logistik GmbH"><div class="r"><b>' + esc(title) + '</b>' + esc(s.companyName) + ' · ' + t('Recruiting Command Center') + '<br>' + (proj ? t('{0} Project', esc(proj)) + ' · ' : '') + t('Printed {0}', U.fmtDateTime(new Date().toISOString())) + '</div></div>';
  }
  function footer() {
    return '<div class="p-foot"><span>' + t('{0} – INTERNAL USE ONLY – contains personal data (DSGVO)', esc(S.settings().companyName)) + '</span><span>' + t('Printed {0}', U.fmtDateTime(new Date().toISOString())) + '</span></div>';
  }
  function kv(rows) {
    return '<table>' + rows.map(function (r) { return '<tr><td class="k">' + esc(r[0]) + '</td><td>' + (r[2] ? r[1] : esc(r[1] === '' || r[1] == null ? '—' : r[1])) + '</td></tr>'; }).join('') + '</table>';
  }

  function doPrint(html) {
    var root = document.getElementById('print-root');
    root.innerHTML = '<div class="p-doc" dir="' + (J.i18n.isRTL() ? 'rtl' : 'ltr') + '">' + html + '</div>';
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
    var status = i.overall === 'started' ? t('STARTED') : i.overall === 'archived' ? t('ARCHIVED') : ready ? t('READY TO START') : t('NOT READY');
    var html = header(t('Candidate Summary')) +
      '<div class="p-title"><div><h1>' + esc(U.fullName(c)) + '</h1><div class="id">' + esc(c.id) + ' · ' + esc(c.position || '—') + ' · ' + esc(c.project || '—') + (c.station ? ' · ' + esc(c.station) : '') + '</div></div>' +
      '<span class="p-status ' + (ready || i.overall === 'started' ? 'ok' : 'no') + '">' + status + '</span></div>' +
      '<div class="p-grid">' +
      '<div class="p-sec"><h3>' + t('Contact details') + '</h3>' + kv([[t('Phone'), c.phone || t('Pending')], [t('Email'), c.email || t('Pending')], [t('Address'), [c.address, c.city].filter(Boolean).join(', ') || t('Pending')], [t('Date of birth'), U.fmtDate(c.dob) || t('Pending')], [t('Nationality'), c.nationality || t('Pending')], [t('Preferred language'), c.language || t('Pending')]]) + '</div>' +
      '<div class="p-sec"><h3>' + t('Employment') + '</h3>' + kv([[t('Position'), c.position], [t('Project'), c.project], [t('Station'), c.station || t('Pending')], [t('Employment type'), t(c.employmentType)], [t('Planned start date'), c.startDate ? U.fmtDate(c.startDate) + ' (' + U.weekday(c.startDate) + ')' : t('Pending')], [t('Tax class'), t(c.taxClass)], [t('Working hours / week'), c.hoursPerWeek != null ? c.hoursPerWeek + ' h' : '']]) + '</div>' +
      '<div class="p-sec"><h3>' + t('Salary information') + '</h3>' + kv([[t('Standard salary reference'), c.salaryReference != null ? U.fmtMoney(c.salaryReference) + ' ' + t(c.salaryBasis) : ''], [t('Candidate expectation'), L.salaryText(c)], [t('Contract salary'), c.contract.salary != null ? U.fmtMoney(c.contract.salary) : '']]) + '</div>' +
      '<div class="p-sec"><h3>' + t('Readiness') + '</h3>' + kv([
        [t('Candidate availability'), '<span class="p-mark ' + (i.willing ? 'ok' : 'mid') + '">' + esc(t(L.availability(c.availability).short)) + '</span>', true],
        [t('Administrative readiness'), '<span class="p-mark ' + (i.admin.ready ? 'ok' : 'no') + '">' + (i.admin.ready ? t('Complete') : t('Not ready – {0} outstanding', i.admin.reasons.length)) + '</span>', true],
        [t('Recruitment status'), t(L.stage(c.stage).label)], [t('Recruiter'), c.recruiter || t('Unassigned')]]) +
      (i.admin.reasons.length ? '<ul class="p-list">' + i.admin.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      '</div>' +
      '<div class="p-sec"><h3>' + t('Document checklist · {0} / {1} ({2}%)', i.docs.complete, i.docs.total, i.docs.pct) + '</h3><table><tr><th>' + t('Document') + '</th><th>' + t('Status') + '</th><th>' + t('Issued') + '</th><th>' + t('Expires') + '</th><th>' + t('Note') + '</th></tr>' +
      s.documents.map(function (d) {
        var e = c.documents[d.key] || { status: d.required ? 'missing' : 'not_required' };
        var st = e.status;
        return '<tr><td>' + esc(t(d.label)) + '</td><td><span class="p-mark ' + (st === 'verified' || st === 'received' ? 'ok' : st === 'not_required' ? '' : st === 'requested' ? 'mid' : 'no') + '">' + (st === 'verified' || st === 'received' ? '✓ ' : st === 'missing' ? '✗ ' : '') + esc(t(L.docStatus(st).label)) + '</span></td><td>' + (U.fmtDate(e.issueDate) || '') + '</td><td>' + (U.fmtDate(e.expiryDate) || '') + '</td><td>' + esc(e.note || '') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="p-grid">' +
      '<div class="p-sec"><h3>' + t('Contract') + '</h3>' + kv([[t('Status'), t(L.contractStatus(c.contract.status).label)], [t('Type'), t(c.contract.type)], [t('Weekly hours'), c.contract.hours != null ? c.contract.hours + ' h' : ''], [t('Start'), U.fmtDate(c.contract.startDate)], [t('End'), c.contract.endDate ? U.fmtDate(c.contract.endDate) : t('Unlimited / not set')], [t('Signed'), U.fmtDate(c.contract.signedDate)]]) + '</div>' +
      '<div class="p-sec"><h3>' + t('Onboarding · {0} / {1} ({2}%)', i.onboarding.done, i.onboarding.total, i.onboarding.pct) + '</h3><table>' +
      i.onboarding.steps.map(function (st) { return '<tr><td>' + (st.done ? '☑' : '☐') + ' ' + esc(t(st.label)) + '</td><td>' + (st.done && st.date ? U.fmtDate(st.date) : '') + '</td></tr>'; }).join('') + '</table></div>' +
      '</div>' +
      '<div class="p-sec"><h3>' + t('Next action & follow-up') + '</h3>' + kv([[t('Next action'), c.nextAction], [t('Next follow-up'), c.followUpDate ? U.fmtDate(c.followUpDate) + (c.followUpNote ? ' – ' + c.followUpNote : '') : '']]) + '</div>' +
      '<div class="p-sec"><h3>' + t('Internal notes') + '</h3><div class="p-note">' + esc(c.notes || '—') + '</div></div>' +
      footer();
    doPrint(html);
  };

  PR.list = function (list, title) {
    var html = header(title) + '<div class="p-sec"><h3>' + t('{0} candidates', list.length) + '</h3><table><tr><th>' + t('ID') + '</th><th>' + t('Name') + '</th><th>' + t('Position') + '</th><th>' + t('Station') + '</th><th>' + t('Type') + '</th><th>' + t('Start') + '</th><th>' + t('Docs') + '</th><th>' + t('Contract') + '</th><th>' + t('Status') + '</th></tr>' +
      list.map(function (c) {
        var i = L.info(c);
        return '<tr><td>' + esc(c.id) + '</td><td><b>' + esc(U.fullName(c)) + '</b></td><td>' + esc(c.position) + '</td><td>' + esc(c.station) + '</td><td>' + esc(t(c.employmentType)) + '</td><td>' + U.fmtDate(c.startDate) + '</td><td>' + i.docs.complete + '/' + i.docs.total + '</td><td>' + esc(t(L.contractStatus(c.contract.status).label)) + '</td><td>' + esc(t(C.OVERALL[i.overall].label)) + '</td></tr>';
      }).join('') + '</table></div>' + footer();
    doPrint(html);
  };

  PR.overview = function () {
    var list = L.scoped();
    var k = L.kpis(list), tgt = L.target(list);
    var PRIO = { high: t('HIGH'), medium: t('MEDIUM'), low: t('LOW') };
    var att = L.attention(list).filter(function (x) { return x.w.priority !== 'low'; }).slice(0, 25);
    var html = header(t('Recruiting Overview')) +
      '<div class="p-kpis">' + [[t('Total candidates'), k.total], [t('Ready to start'), k.ready], [t('In recruitment'), k.inRecruitment], [t('Documents missing'), k.docsMissing], [t('Contract pending'), k.contractPending], [t('Onboarding'), k.onboarding], [t('Starting this month'), k.startMonth], [t('Starting next 7 days'), k.start7]]
        .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="p-sec"><h3>' + t('Driver recruitment target') + '</h3>' + kv([[t('Required drivers'), tgt.required], [t('Candidates'), tgt.candidates], [t('Ready / started'), tgt.secured], [t('Remaining'), tgt.remaining], [t('Readiness rate'), tgt.readinessRate + '%'], [t('Document completion rate'), tgt.docRate + '%'], [t('Contract completion rate'), tgt.contractRate + '%']]) + '</div>' +
      '<div class="p-sec"><h3>' + t('Attention required (high & medium priority)') + '</h3>' + (att.length ? '<table><tr><th>' + t('Candidate') + '</th><th>' + t('Problem') + '</th><th>' + t('Start') + '</th><th>' + t('Priority') + '</th></tr>' +
        att.map(function (x) { return '<tr><td>' + esc(U.fullName(x.c)) + '</td><td>' + esc(x.w.problem) + '</td><td>' + (U.fmtDate(x.c.startDate) || '—') + '</td><td>' + (PRIO[x.w.priority] || x.w.priority.toUpperCase()) + '</td></tr>'; }).join('') + '</table>' : '<p>' + t('No open issues.') + '</p>') + '</div>' +
      footer();
    doPrint(html);
  };

  PR.starting = function () {
    var list = L.scoped().filter(function (c) { var d = L.info(c).daysToStart; return d !== null && d >= -7 && d <= 45; }).sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
    var html = header(t('Starting Soon')) + '<div class="p-sec"><h3>' + t('Candidates starting within 45 days') + '</h3><table><tr><th>' + t('Start') + '</th><th>' + t('Days') + '</th><th>' + t('Name') + '</th><th>' + t('Station') + '</th><th>' + t('Type') + '</th><th>' + t('Status') + '</th><th>' + t('Open issues') + '</th></tr>' +
      list.map(function (c) {
        var i = L.info(c);
        return '<tr><td>' + U.fmtDate(c.startDate) + '</td><td>' + i.daysToStart + '</td><td><b>' + esc(U.fullName(c)) + '</b><br>' + esc(c.id) + '</td><td>' + esc(c.station) + '</td><td>' + esc(t(c.employmentType)) + '</td><td>' + esc(t(C.OVERALL[i.overall].label)) + '</td><td>' + esc(i.admin.reasons.join('; ') + (i.willing ? '' : (i.admin.reasons.length ? '; ' : '') + t('Availability: {0}', t(L.availability(c.availability).short)))) + '</td></tr>';
      }).join('') + '</table></div>' + footer();
    doPrint(html);
  };

  PR.report = function (r, label) {
    var m = L.report(r);
    var period = label || ((r.from ? U.fmtDate(r.from) : '…') + ' – ' + (r.to ? U.fmtDate(r.to) : '…'));
    var srcKeys = Object.keys(m.sources).filter(function (k) { return m.sources[k].candidates; });
    var maxS = Math.max(1, Math.max.apply(null, srcKeys.map(function (k) { return m.sources[k].candidates; }).concat([1])));
    var html = header(t('Recruitment Report')) + '<div class="p-title"><h1>' + t('Recruitment Report') + '</h1><div class="id">' + t('Period: {0}', esc(period)) + '</div></div>' +
      '<div class="p-kpis">' + [[t('Candidates added'), m.added.length], [t('Interviews'), m.interviews], [t('Became ready'), m.ready], [t('Started'), m.started], [t('Rejected / withdrawn'), m.negative], [t('Missing documents (now)'), m.missingDocs], [t('Contracts signed'), m.signed], [t('Target secured'), m.target.secured + ' / ' + m.target.required]]
        .map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="p-grid"><div class="p-sec"><h3>' + t('Pipeline (active candidates)') + '</h3><table>' + C.STAGES.map(function (s) { return '<tr><td>' + esc(t(s.label)) + '</td><td>' + (m.stages[s.key] || 0) + '</td></tr>'; }).join('') + '</table></div>' +
      '<div class="p-sec"><h3>' + t('Rates (current)') + '</h3>' + kv([[t('Readiness rate'), m.target.readinessRate + '%'], [t('Document completion'), m.target.docRate + '%'], [t('Contract completion'), m.target.contractRate + '%'], [t('Remaining drivers to target'), m.target.remaining]]) + '</div></div>' +
      '<div class="p-sec"><h3>' + t('Source performance') + '</h3>' + (srcKeys.length ? '<table><tr><th>' + t('Source') + '</th><th>' + t('Candidates') + '</th><th></th><th>' + t('Ready') + '</th><th>' + t('Started') + '</th><th>' + t('Conversion') + '</th></tr>' +
        srcKeys.map(function (k) { var x = m.sources[k]; return '<tr><td>' + esc(t(k)) + '</td><td>' + x.candidates + '</td><td><span class="p-bar" style="width:' + Math.round(x.candidates / maxS * 120) + 'px"></span></td><td>' + x.ready + '</td><td>' + x.started + '</td><td>' + U.pct(x.ready + x.started, x.candidates) + '%</td></tr>'; }).join('') + '</table>' : '<p>' + t('No candidates added in this period.') + '</p>') + '</div>' +
      footer();
    doPrint(html);
  };

  A['print-candidate'] = function (el) { PR.candidate(el.getAttribute('data-id')); };
})();
