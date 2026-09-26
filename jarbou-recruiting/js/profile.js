/* Candidate profile drawer with tabs: Overview, Documents, Contract,
   Onboarding, Activity, Notes. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var t = J.t;
  function tv(v) { return v ? t(v) : v; }
  function basis(c) { return c.salaryBasis === 'gross' ? t('gross') : t('net'); }
  var P = (J.profile = {});
  var state = { id: null, tab: 'overview' };

  P.isOpen = function () { return !!state.id; };
  P.currentId = function () { return state.id; };

  P.open = function (id, tab) {
    if (!S.get(id)) { ui.toast(t('Candidate not found.'), 'error'); return; }
    var same = state.id === id;
    state.id = id;
    state.tab = tab || (same ? state.tab : 'overview');
    render(true);
  };
  P.close = function () {
    state.id = null;
    document.getElementById('drawer-root').innerHTML = '';
    document.body.style.overflow = '';
  };
  P.refresh = function () { if (state.id) { if (!S.get(state.id)) P.close(); else render(false); } };

  function dl(rows) {
    return '<dl class="dl">' + rows.map(function (r) {
      var v = r[1];
      var empty = v === null || v === undefined || v === '';
      return '<dt>' + esc(r[0]) + '</dt><dd class="' + (empty ? 'pending' : '') + '">' + (empty ? esc(r[2] || t('Pending')) : (r[3] ? v : esc(v))) + '</dd>';
    }).join('') + '</dl>';
  }

  function render(fresh) {
    var c = S.get(state.id);
    if (!c) return P.close();
    var i = L.info(c);
    var root = document.getElementById('drawer-root');
    var prevBody = root.querySelector('.drawer-body');
    var scroll = prevBody && !fresh ? prevBody.scrollTop : 0;
    var focusSel = null;
    if (!fresh && document.activeElement && root.contains(document.activeElement) && document.activeElement.id) focusSel = '#' + document.activeElement.id;
    document.body.style.overflow = 'hidden';

    var tabs = [
      ['overview', t('Overview')],
      ['documents', t('Documents'), i.docs.complete + '/' + i.docs.total],
      ['contract', t('Contract')],
      ['onboarding', t('Onboarding'), i.onboarding.done + '/' + i.onboarding.total],
      ['activity', t('Activity'), (c.activities || []).length],
      ['notes', t('Notes'), (c.noteLog || []).length || '']
    ];

    var head =
      '<div class="drawer-head">' +
      '<div class="top"><div class="avatar lg">' + esc(U.initials(c)) + '</div>' +
      '<div style="flex:1;min-width:0"><h2>' + esc(U.fullName(c)) + '</h2>' +
      '<div class="ids"><span class="mono">' + esc(c.id) + '</span>' + ui.stageBadge(c.stage) + ui.overallBadge(i, true) + ui.projectPill(c.project) +
      (c.position ? '<span>' + esc(c.position) + '</span>' : '') + (c.station ? '<span>· ' + esc(c.station) + '</span>' : '') + '</div>' +
      '</div><button class="icon-btn" data-action="close-profile" aria-label="' + esc(t('Close profile')) + '" data-tip="' + esc(t('Close (Esc)')) + '">' + icon('x') + '</button></div>' +
      '<div class="contact">' +
      '<span>' + icon('phone', 'sm') + (c.phone ? esc(c.phone) : '<i class="pending">' + t('Phone pending') + '</i>') + '</span>' +
      '<span>' + icon('mail', 'sm') + (c.email ? esc(c.email) : '<i class="pending">' + t('Email pending') + '</i>') + '</span>' +
      '<span>' + icon('calendar', 'sm') + (c.startDate ? t('Start {0}', U.fmtDate(c.startDate)) + ' ' + ui.daysPill(i.daysToStart) : '<i class="pending">' + t('Start date pending') + '</i>') + '</span>' +
      '</div>' +
      '<div class="drawer-actions">' +
      '<button class="btn sm dark" data-action="edit-candidate" data-id="' + esc(c.id) + '">' + icon('edit', 'sm') + t('Edit') + '</button>' +
      (c.phone ? '<a class="btn sm" href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '">' + icon('phone', 'sm') + t('Call') + '</a>' : '<button class="btn sm" disabled data-tip="' + esc(t('No phone number recorded')) + '">' + icon('phone', 'sm') + t('Call') + '</button>') +
      '<button class="btn sm" data-action="copy-text" data-text="' + esc(c.phone) + '" data-what="' + esc(t('Phone number')) + '"' + (c.phone ? '' : ' disabled') + '>' + icon('copy', 'sm') + t('Copy Phone') + '</button>' +
      '<button class="btn sm" data-action="copy-text" data-text="' + esc(c.email) + '" data-what="' + esc(t('Email')) + '"' + (c.email ? '' : ' disabled') + '>' + icon('copy', 'sm') + t('Copy Email') + '</button>' +
      '<button class="btn sm" data-action="follow-up" data-id="' + esc(c.id) + '">' + icon('bell', 'sm') + t('Follow-up') + '</button>' +
      '<button class="btn sm" data-action="print-candidate" data-id="' + esc(c.id) + '">' + icon('printer', 'sm') + t('Print') + '</button>' +
      (c.archived
        ? '<button class="btn sm" data-action="restore-candidate" data-id="' + esc(c.id) + '">' + icon('restore', 'sm') + t('Restore') + '</button>'
        : '<button class="btn sm" data-action="archive-candidate" data-id="' + esc(c.id) + '">' + icon('archive', 'sm') + t('Archive') + '</button>') +
      '<button class="btn sm" data-action="profile-more" data-id="' + esc(c.id) + '" aria-label="' + esc(t('More actions')) + '">' + icon('more', 'sm') + '</button>' +
      '</div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (tb) {
        return '<button class="tab ' + (state.tab === tb[0] ? 'on' : '') + '" role="tab" data-action="profile-tab" data-tab="' + tb[0] + '">' + esc(tb[1]) + (tb[2] !== undefined && tb[2] !== '' ? '<span class="n">' + tb[2] + '</span>' : '') + '</button>';
      }).join('') + '</div></div>';

    var body = '<div class="drawer-body">' + (TABS[state.tab] || TABS.overview)(c, i) + '</div>';
    root.innerHTML = '<div class="overlay" data-action="close-profile"></div><aside class="drawer" role="dialog" aria-label="' + esc(t('Candidate profile')) + '">' + head + body + '</aside>';
    var nb = root.querySelector('.drawer-body');
    if (nb) nb.scrollTop = scroll;
    if (focusSel) { var f = root.querySelector(focusSel); if (f) f.focus(); }
  }

  /* ------------------------------------------------------------ Tabs */
  var TABS = {};

  TABS.overview = function (c, i) {
    var banner;
    if (i.overall === 'ready') banner = '<div class="overall-banner ok">' + icon('checkCircle', 'lg') + '<div><div class="t">' + t('READY TO START') + '</div><div class="d">' + t('Candidate is available and all administrative requirements are complete.') + '</div></div></div>';
    else if (i.overall === 'started') banner = '<div class="overall-banner started">' + icon('rocket', 'lg') + '<div><div class="t">' + t('STARTED') + (c.startedOn ? ' · ' + U.fmtDate(c.startedOn) : '') + '</div><div class="d">' + (i.admin.ready ? t('All administrative requirements complete.') : t('{0} administrative item(s) still open – see below.', i.admin.reasons.length)) + '</div></div></div>';
    else if (i.overall === 'archived') banner = '<div class="overall-banner archived">' + icon('archive', 'lg') + '<div><div class="t">' + t('ARCHIVED') + ' · ' + esc(tv(c.archiveReason)) + '</div><div class="d">' + t('Archived on {0}', U.fmtDate(c.archiveDate)) + (c.archiveNote ? ' – ' + esc(c.archiveNote) : '') + '</div></div></div>';
    else banner = '<div class="overall-banner no">' + icon('alertCircle', 'lg') + '<div><div class="t">' + t('NOT READY') + ' · ' + (i.outstanding === 1 ? t('{0} requirement outstanding', i.outstanding) : t('{0} requirements outstanding', i.outstanding)) + '</div><div class="d">' + t('Ready to start requires candidate availability AND complete administrative readiness.') + '</div></div></div>';

    var av = L.availability(c.availability);
    var readiness =
      '<div class="readiness">' +
      '<div><div class="rh">' + t('Candidate availability / willingness') + '</div>' +
      '<div class="verdict ' + (i.willing ? 'ok' : c.availability === 'not_available' ? 'no' : 'mid') + '">' + icon(i.willing ? 'checkCircle' : 'clock') + (i.willing ? t('AVAILABLE') : t(av.short).toUpperCase()) + '</div>' +
      '<div class="small muted mt-8">' + (i.willing ? t('Candidate confirmed they are ready and willing to start.') : t('Candidate availability not confirmed as ready.')) + '</div>' +
      '<div class="mt-8"><select class="sm" data-change="set-availability" data-id="' + esc(c.id) + '" aria-label="' + esc(t('Set availability')) + '">' + ui.options(C.AVAILABILITY.filter(function (a) { return a.key; }), c.availability, { blank: 'Pending / unknown' }) + '</select></div></div>' +
      '<div><div class="rh">' + t('Administrative readiness') + '</div>' +
      '<div class="verdict ' + (i.admin.ready ? 'ok' : 'no') + '">' + icon(i.admin.ready ? 'checkCircle' : 'xCircle') + (i.admin.ready ? t('COMPLETE') : t('NOT READY') + ' · ' + t('{0} outstanding', i.admin.reasons.length)) + '</div>' +
      (i.admin.ready ? '<div class="small muted mt-8">' + t('Documents, contract and required information are complete.') + '</div>' :
        '<ul>' + i.admin.reasons.slice(0, 12).map(function (r) { return '<li>' + icon('x', 'sm') + '<span>' + esc(r) + '</span></li>'; }).join('') + (i.admin.reasons.length > 12 ? '<li class="muted">' + t('+ {0} more', i.admin.reasons.length - 12) + '</li>' : '') + '</ul>') +
      '</div></div>';

    var warnings = i.warnings.length ? '<div class="mt-16"><div class="section-title">' + icon('alert', 'sm') + t('Smart warnings') + '</div><div class="warn-list">' +
      i.warnings.map(function (w) { return '<span class="warn-tag ' + w.priority + '">' + icon(w.priority === 'high' ? 'alert' : 'clock', 'sm') + esc(w.label) + '</span>'; }).join('') + '</div></div>' : '';

    var nextBox = '<div class="grid halves mt-16">' +
      '<div class="card"><div class="card-body"><div class="section-title">' + icon('flag', 'sm') + t('Next action') + '</div>' +
      (c.nextAction ? '<div>' + esc(c.nextAction) + '</div>' : '<div class="muted">' + t('No next action defined.') + '</div>') + '</div></div>' +
      '<div class="card"><div class="card-body"><div class="section-title">' + icon('bell', 'sm') + t('Next follow-up') + '</div>' +
      (c.followUpDate ? '<div class="row">' + '<b>' + U.fmtDate(c.followUpDate) + '</b>' + (i.followUp === 'overdue' ? ui.badge(t('Overdue'), 'red', 'alert') : i.followUp === 'today' ? ui.badge(t('Today'), 'amber', 'clock') : '') + '</div>' + (c.followUpNote ? '<div class="muted-2 small mt-8">' + esc(c.followUpNote) + '</div>' : '') : '<div class="muted">' + t('No follow-up scheduled.') + '</div>') +
      '<button class="btn xs mt-8" data-action="follow-up" data-id="' + esc(c.id) + '">' + (c.followUpDate ? t('Change') : t('Schedule follow-up')) + '</button></div></div></div>';

    var salaryRef = c.salaryReference != null ? U.fmtMoney(c.salaryReference) + ' ' + basis(c) : '';
    var personal = dl([
      [t('First name'), c.firstName], [t('Family name'), c.lastName], [t('Phone'), c.phone], [t('Email'), c.email],
      [t('Date of birth'), U.fmtDate(c.dob)], [t('Address'), c.address], [t('City'), c.city], [t('Nationality'), c.nationality], [t('Preferred language'), c.language]
    ]);
    var employment = dl([
      [t('Position'), c.position], [t('Project'), c.project ? ui.projectPill(c.project) : '', t('Pending'), true], [t('Station / Location'), c.station],
      [t('Employment type'), tv(c.employmentType)], [t('Tax class'), tv(c.taxClass)], [t('Standard salary reference'), salaryRef],
      [t('Salary expectation'), L.salaryText(c)], [t('Working hours / week'), c.hoursPerWeek != null ? t('{0} h', c.hoursPerWeek) : ''],
      [t('Availability'), ui.availBadge(c.availability), '', true]
    ]);
    var recruitment = dl([
      [t('Application date'), U.fmtDate(c.applicationDate)], [t('Source'), tv(c.source)], [t('Responsible recruiter'), c.recruiter, t('Unassigned')],
      [t('Interview date'), U.fmtDate(c.interviewDate)], [t('Interview status'), tv(c.interviewStatus)],
      [t('Pipeline stage'), ui.stageBadge(c.stage), '', true], [t('Last contact'), U.fmtDate(c.lastContact), t('No contact logged')],
      [t('Created'), U.fmtDateTime(c.createdAt)], [t('Last updated'), U.fmtDateTime(c.updatedAt)]
    ]);
    var start = dl([
      [t('Planned start date'), c.startDate ? U.fmtDate(c.startDate) + ' · ' + U.weekday(c.startDate) : ''],
      [t('Days remaining'), c.startDate ? ui.daysPill(i.daysToStart) : '', t('Pending'), true],
      [t('Documents'), ui.miniProgress(i.docs.complete, i.docs.total) , '', true],
      [t('Contract'), ui.contractBadge(c.contract.status), '', true],
      [t('Onboarding'), ui.miniProgress(i.onboarding.done, i.onboarding.total), '', true],
      [t('Next onboarding step'), tv(i.onboarding.next), t('All steps complete')]
    ]);
    function card(title, ic, html) { return '<div class="card"><div class="card-head"><h3>' + icon(ic, 'sm') + esc(title) + '</h3></div><div class="card-body" style="padding-top:6px;padding-bottom:6px">' + html + '</div></div>'; }

    return banner + readiness + warnings + nextBox +
      '<div class="grid halves mt-16">' + card(t('Personal information'), 'user', personal) + card(t('Employment'), 'briefcase', employment) +
      card(t('Recruitment'), 'users', recruitment) + card(t('Start information'), 'calendar', start) + '</div>';
  };

  TABS.documents = function (c, i) {
    var defs = S.settings().documents;
    var rows = defs.map(function (d) {
      var e = c.documents[d.key] || { status: d.required ? 'missing' : 'not_required' };
      var exp = '';
      if (d.expiry) {
        var dd = e.expiryDate ? U.daysUntil(e.expiryDate) : null;
        var warn = dd === null ? '' : dd < 0 ? '<span class="exp-bad">' + icon('alert', 'sm') + ' ' + t('Expired') + '</span>' : dd <= (S.settings().expiryWarningDays || 60) ? '<span class="exp-warn">' + icon('clock', 'sm') + ' ' + (dd === 1 ? t('Expires in {0} day', dd) : t('Expires in {0} days', dd)) + '</span>' : '';
        exp = '<label>' + t('Issued') + ' <input type="date" value="' + esc(e.issueDate) + '" data-change="doc-date" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" data-field="issueDate"></label>' +
          '<label>' + t('Expires') + ' <input type="date" value="' + esc(e.expiryDate) + '" data-change="doc-date" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" data-field="expiryDate"></label>' + warn;
      }
      return '<div class="doc-row"><div><div class="dn">' + esc(t(d.label)) + '</div>' +
        '<div class="small muted">' + (d.caseByCase ? t('Depends on candidate – mark "Not Required" if not applicable') : d.required ? t('Required by default') : t('Optional')) + '</div></div>' +
        '<select class="status-select s-' + e.status + '" data-change="doc-status" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" aria-label="' + esc(t('Status of {0}', t(d.label))) + '">' +
        ui.options(C.DOC_STATUSES, e.status) + '</select>' +
        '<div class="dates">' + exp + '<input type="text" placeholder="' + esc(t('Note')) + '" value="' + esc(e.note) + '" data-change="doc-note" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" style="height:28px;font-size:12px;flex:1;min-width:110px"></div></div>';
    }).join('');
    var pct = i.docs.pct;
    return '<div class="card mb-16"><div class="card-body"><div class="row between wrap"><div><div class="section-title" style="margin:0">' + t('Document completion') + '</div>' +
      '<div style="font-size:22px;font-weight:650;margin-top:2px">' + i.docs.complete + ' / ' + i.docs.total + ' <span class="muted" style="font-size:15px;font-weight:500">· ' + pct + '%</span></div></div>' +
      '<div class="row wrap">' + (i.docs.missing.length ? '<button class="btn sm" data-action="docs-request-all" data-id="' + esc(c.id) + '">' + icon('send', 'sm') + t('Mark all missing as requested') + '</button>' : '') + '</div></div>' +
      '<div class="mt-12">' + ui.progress(pct, 'lg ' + ui.pctClass(pct)) + '</div>' +
      '<div class="legend">' + C.DOC_STATUSES.map(function (s) {
        var n = s.key === 'not_required' ? defs.length - i.docs.total : (i.docs[s.key] || []).length;
        return '<span>' + ui.badge(t(s.label) + ' · ' + n, s.badge, s.icon) + '</span>';
      }).join('') + '</div></div></div>' +
      '<div class="card">' + rows + '</div>' +
      '<p class="small muted mt-12">' + t('"Received" and "Verified" count as complete. Documents past their expiry date count as outstanding. Changes are saved automatically.') + '</p>';
  };

  TABS.contract = function (c) {
    var ct = c.contract;
    var idx = C.CONTRACT_STATUSES.map(function (s) { return s.key; }).indexOf(ct.status);
    var steps = '<div class="row wrap" style="gap:6px">' + C.CONTRACT_STATUSES.map(function (s, k) {
      var on = k <= idx;
      return '<button class="btn sm ' + (k === idx ? 'dark' : '') + '" data-action="contract-status" data-id="' + esc(c.id) + '" data-status="' + s.key + '" style="' + (on && k !== idx ? 'color:var(--green);border-color:var(--green-bd);background:var(--green-bg)' : '') + '">' + (on && k !== idx ? icon('check', 'sm') : '') + esc(t(s.label)) + '</button>' + (k < C.CONTRACT_STATUSES.length - 1 ? '<span class="muted">' + icon('chevronRight', 'sm') + '</span>' : '');
    }).join('') + '</div>';
    var d = c.startDate ? U.daysUntil(c.startDate) : null;
    var warn = (ct.status !== 'signed' && ct.status !== 'completed' && d !== null && d >= 0 && d <= (S.settings().contractWarningDays || 14))
      ? '<div class="banner red mt-12">' + icon('alert') + '<div class="grow"><b>' + (d === 1 ? t('Starts in {0} day – contract not signed.', d) : t('Starts in {0} days – contract not signed.', d)) + '</b> ' + t('Please prioritise contract preparation and signature.') + '</div></div>' : '';
    return '<div class="card mb-16"><div class="card-head"><h3>' + icon('contract', 'sm') + t('Contract status') + '</h3>' + ui.contractBadge(ct.status) + '</div><div class="card-body">' + steps + warn + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>' + t('Contract details') + '</h3></div><div class="card-body"><form id="contract-form" class="fgrid" novalidate>' +
      '<div class="field"><label for="ct-type">' + t('Contract type') + '</label><select id="ct-type" name="type">' + ui.options(C.EMPLOYMENT_TYPES, ct.type, { blank: 'Select…', tr: true }) + '</select></div>' +
      '<div class="field"><label for="ct-salary">' + t('Contract salary (€ / month)') + '</label><input id="ct-salary" name="salary" type="number" min="0" step="10" value="' + esc(ct.salary == null ? '' : ct.salary) + '"></div>' +
      '<div class="field"><label for="ct-hours">' + t('Weekly hours') + '</label><input id="ct-hours" name="hours" type="number" min="0" max="60" step="0.5" value="' + esc(ct.hours == null ? '' : ct.hours) + '"></div>' +
      '<div class="field"><label for="ct-start">' + t('Contract start date') + '</label><input id="ct-start" name="startDate" type="date" value="' + esc(ct.startDate) + '"><div class="help">' + (c.startDate ? t('Planned start: {0}', U.fmtDate(c.startDate)) : '') + '</div></div>' +
      '<div class="field"><label for="ct-end">' + t('Contract end date') + '</label><input id="ct-end" name="endDate" type="date" value="' + esc(ct.endDate) + '"><div class="help">' + t('Leave empty for unlimited (unbefristet).') + '</div></div>' +
      '<div class="field"><label for="ct-signed">' + t('Signed date') + '</label><input id="ct-signed" name="signedDate" type="date" value="' + esc(ct.signedDate) + '"></div>' +
      '<div class="field span-3"><label for="ct-note">' + t('Contract notes') + '</label><textarea id="ct-note" name="note" rows="3" placeholder="' + esc(t('e.g. Final Teilzeit conditions to be confirmed')) + '">' + esc(ct.note) + '</textarea></div>' +
      '</form></div><div class="card-foot"><span>' + t('Salary reference: {0} · Candidate expectation: {1}', c.salaryReference != null ? U.fmtMoney(c.salaryReference) + ' ' + basis(c) : '—', esc(L.salaryText(c) || '—')) + '</span>' +
      '<button class="btn primary sm" data-action="contract-save" data-id="' + esc(c.id) + '">' + icon('check', 'sm') + t('Save contract details') + '</button></div></div>';
  };

  TABS.onboarding = function (c, i) {
    var ob = i.onboarding;
    return '<div class="card mb-16"><div class="card-body"><div class="row between"><div><div class="section-title" style="margin:0">' + t('Onboarding progress') + '</div>' +
      '<div style="font-size:22px;font-weight:650;margin-top:2px">' + ob.done + ' / ' + ob.total + ' <span class="muted" style="font-size:15px;font-weight:500">· ' + ob.pct + '%</span></div></div>' +
      (ob.complete ? ui.badge(t('Onboarding complete'), 'green', 'checkCircle') : ob.next ? '<div class="small muted">' + t('Next: {0}', '<b style="color:var(--text)">' + esc(t(ob.next)) + '</b>') + '</div>' : '') + '</div>' +
      '<div class="mt-12">' + ui.progress(ob.pct, 'lg ' + ui.pctClass(ob.pct)) + '</div></div></div>' +
      '<div class="card">' + ob.steps.map(function (st) {
        return '<div class="check-row ' + (st.done ? 'done' : '') + '">' +
          '<button class="ob-check ' + (st.done ? 'on' : '') + (st.auto ? ' auto' : '') + '" ' + (st.auto ? 'data-tip="' + esc(st.auto === 'documents' ? t('Updated automatically from the document checklist') : t('Updated automatically from the contract status')) + '"' : 'data-action="toggle-onboarding" data-id="' + esc(c.id) + '" data-step="' + st.key + '"') + ' aria-label="' + esc(t(st.label)) + '" id="ob-' + st.key + '">' + (st.done ? icon('check') : '') + '</button>' +
          '<label ' + (st.auto ? '' : 'for="ob-' + st.key + '"') + '>' + esc(t(st.label)) + '</label>' +
          (st.auto ? '<span class="auto-tag">' + t('Auto') + '</span>' : '') +
          (st.date && st.done ? '<span class="when">' + U.fmtDate(st.date) + '</span>' : '') + '</div>';
      }).join('') + '</div><p class="small muted mt-12">' + t('Onboarding steps can be customised in Settings → Onboarding Checklist.') + '</p>';
  };

  TABS.activity = function (c) {
    var types = C.ACTIVITY_TYPES.filter(function (ty) { return ty.key !== 'system'; });
    var acts = (c.activities || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var lastDay = '';
    var tl = acts.map(function (a) {
      var at = C.ACTIVITY_TYPES.filter(function (x) { return x.key === a.type; })[0] || C.ACTIVITY_TYPES[6];
      var day = U.fmtDate(a.date.slice(0, 10)) || U.fmtDateTime(a.date).slice(0, 10);
      var dayHead = '';
      var dd = new Date(a.date); var dayKey = isNaN(dd) ? a.date.slice(0, 10) : U.toISODate(dd);
      if (dayKey !== lastDay) { lastDay = dayKey; dayHead = '<div class="tl-date-head">' + U.fmtDate(dayKey) + ' · ' + U.weekday(dayKey) + '</div>'; }
      return dayHead + '<div class="tl-item"><div class="dot ' + (a.type === 'system' ? 'auto' : '') + '">' + icon(at.icon) + '</div>' +
        '<div class="tl-top"><span class="tl-type">' + esc(a.type === 'system' ? t('Update') : t(at.label)) + '</span><span class="tl-date">' + U.fmtTime(a.date) + '</span>' +
        (a.type !== 'system' ? '<button class="icon-btn tl-del" style="width:22px;height:22px" data-action="delete-activity" data-id="' + esc(c.id) + '" data-act="' + esc(a.id) + '" aria-label="' + esc(t('Delete entry')) + '" data-tip="' + esc(t('Delete entry')) + '">' + icon('trash', 'sm') + '</button>' : '') + '</div>' +
        '<div class="tl-text">' + esc(a.text) + '</div></div>';
      void day;
    }).join('');
    return '<div class="card mb-16"><div class="card-head"><h3>' + icon('plus', 'sm') + t('Log activity') + '</h3></div><div class="card-body">' +
      '<div class="fgrid"><div class="field"><label for="act-type">' + t('Type') + '</label><select id="act-type">' + types.map(function (ty) { return '<option value="' + ty.key + '">' + esc(t(ty.label)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="act-date">' + esc(t('Date & time')) + '</label><input id="act-date" type="datetime-local" value="' + U.localDateTimeValue() + '"></div>' +
      '<div class="field"><label>&nbsp;</label><button class="btn primary" data-action="add-activity" data-id="' + esc(c.id) + '">' + icon('plus', 'sm') + t('Add to timeline') + '</button></div>' +
      '<div class="field span-3"><label for="act-text">' + t('Description') + '</label><textarea id="act-text" rows="2" placeholder="' + esc(t('e.g. Phone call completed – candidate will send Führungszeugnis by Friday')) + '"></textarea></div></div>' +
      '<p class="small muted">' + t('Calls, WhatsApp, email and meetings automatically update "Last Contact".') + '</p></div></div>' +
      '<div class="card"><div class="card-head"><h3>' + icon('activity', 'sm') + t('Activity timeline') + '</h3><span class="hint">' + t('{0} entries', acts.length) + '</span></div><div class="card-body">' +
      (acts.length ? '<div class="timeline">' + tl + '</div>' : ui.empty('activity', t('No activity yet'), t('Log calls, messages and meetings to build the history.'))) + '</div></div>';
  };

  TABS.notes = function (c) {
    var notes = (c.noteLog || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    return '<div class="card mb-16"><div class="card-head"><h3>' + icon('note', 'sm') + t('Internal notes') + '</h3><span class="hint">' + t('Shown on the printed summary') + '</span></div><div class="card-body">' +
      '<textarea id="notes-main" rows="6" style="width:100%" placeholder="' + esc(t('General internal notes about this candidate')) + '">' + esc(c.notes) + '</textarea>' +
      '<div class="row mt-8" style="justify-content:flex-end"><button class="btn primary sm" data-action="save-notes" data-id="' + esc(c.id) + '">' + icon('check', 'sm') + t('Save notes') + '</button></div></div></div>' +
      '<div class="card mb-16"><div class="card-head"><h3>' + t('Add dated note') + '</h3></div><div class="card-body">' +
      '<textarea id="note-new" rows="3" style="width:100%" placeholder="' + esc(t('Write a note… (Ctrl+Enter to add)')) + '"></textarea>' +
      '<div class="row mt-8" style="justify-content:flex-end"><button class="btn sm" data-action="add-note" data-id="' + esc(c.id) + '">' + icon('plus', 'sm') + t('Add note') + '</button></div></div></div>' +
      (notes.length ? notes.map(function (n) {
        return '<div class="note-card"><div class="nh"><span>' + U.fmtDateTime(n.date) + '</span><button class="icon-btn" style="width:22px;height:22px" data-action="delete-note" data-id="' + esc(c.id) + '" data-note="' + esc(n.id) + '" aria-label="' + esc(t('Delete note')) + '">' + icon('trash', 'sm') + '</button></div><div class="nt">' + esc(n.text) + '</div></div>';
      }).join('') : '<p class="muted small">' + t('No dated notes yet.') + '</p>');
  };

  /* ------------------------------------------------------------ Actions */
  function cur(el) { return S.get(el.getAttribute('data-id')); }

  A['close-profile'] = function () { P.close(); };
  A['profile-tab'] = function (el) { state.tab = el.getAttribute('data-tab'); render(true); };
  A['open-candidate'] = function (el) { P.open(el.getAttribute('data-id'), el.getAttribute('data-tab') || undefined); };

  A['set-availability'] = function (el) {
    var c = cur(el);
    var prev = c.availability;
    c.availability = el.value;
    L.log(c, 'system', t('Candidate availability changed from "{0}" to "{1}".', t(L.availability(prev).short), t(L.availability(c.availability).short)));
    J.app.save(c, t('Availability updated.'));
  };

  A['doc-status'] = function (el) {
    var c = cur(el), k = el.getAttribute('data-doc');
    var e = c.documents[k] = c.documents[k] || { status: 'missing', issueDate: '', expiryDate: '', note: '' };
    var prev = e.status;
    e.status = el.value;
    L.log(c, 'document', t('{0}: {1} → {2}.', L.docLabel(k), t(L.docStatus(prev).label), t(L.docStatus(e.status).label)));
    J.app.save(c, t('{0} marked as {1}.', L.shortDocLabel(k), t(L.docStatus(e.status).label)));
  };
  A['doc-date'] = function (el) {
    var c = cur(el), k = el.getAttribute('data-doc'), f = el.getAttribute('data-field');
    var e = c.documents[k] = c.documents[k] || { status: 'missing', issueDate: '', expiryDate: '', note: '' };
    e[f] = el.value;
    if (f === 'expiryDate' && el.value) L.log(c, 'document', t('{0}: expiry date set to {1}.', L.docLabel(k), U.fmtDate(el.value)));
    J.app.save(c, t('Document date saved.'));
  };
  A['doc-note'] = function (el) {
    var c = cur(el), k = el.getAttribute('data-doc');
    var e = c.documents[k] = c.documents[k] || { status: 'missing', issueDate: '', expiryDate: '', note: '' };
    e.note = el.value.trim();
    J.app.save(c, t('Document note saved.'));
  };
  A['docs-request-all'] = function (el) {
    var c = cur(el);
    var n = 0;
    Object.keys(c.documents).forEach(function (k) { if (c.documents[k].status === 'missing') { c.documents[k].status = 'requested'; n++; } });
    L.log(c, 'document', t('{0} missing document(s) marked as requested.', n));
    J.app.save(c, t('{0} document(s) marked as requested.', n));
  };

  A['contract-status'] = function (el) {
    var c = cur(el), st = el.getAttribute('data-status');
    if (c.contract.status === st) return;
    var prev = c.contract.status;
    c.contract.status = st;
    if ((st === 'signed' || st === 'completed') && !c.contract.signedDate) c.contract.signedDate = U.todayISO();
    L.log(c, 'system', t('Contract status: {0} → {1}.', t(L.contractStatus(prev).label), t(L.contractStatus(st).label)));
    J.app.save(c, t('Contract marked as {0}.', t(L.contractStatus(st).label)));
  };
  A['contract-save'] = function (el) {
    var c = cur(el);
    var f = document.getElementById('contract-form');
    var get = function (n) { return f.querySelector('[name="' + n + '"]').value.trim(); };
    var sal = U.num(get('salary')), hrs = U.num(get('hours'));
    if ((get('salary') && (sal === null || sal < 0)) || (get('hours') && (hrs === null || hrs < 0 || hrs > 60))) { ui.toast(t('Please enter valid salary and hours.'), 'error'); return; }
    if (get('endDate') && get('startDate') && get('endDate') < get('startDate')) { ui.toast(t('Contract end date must be after the start date.'), 'error'); return; }
    c.contract.type = get('type'); c.contract.salary = sal; c.contract.hours = hrs;
    c.contract.startDate = get('startDate'); c.contract.endDate = get('endDate'); c.contract.signedDate = get('signedDate'); c.contract.note = get('note');
    L.log(c, 'system', t('Contract details updated.'));
    J.app.save(c, t('Contract details saved.'));
  };

  A['toggle-onboarding'] = function (el) {
    var c = cur(el), k = el.getAttribute('data-step');
    c.onboarding = c.onboarding || {};
    var rec = c.onboarding[k] || {};
    rec.done = !rec.done;
    rec.date = rec.done ? U.todayISO() : '';
    c.onboarding[k] = rec;
    var st = S.settings().onboardingSteps.filter(function (s) { return s.key === k; })[0];
    var stLabel = st ? t(st.label) : k;
    L.log(c, 'system', rec.done ? t('Onboarding: "{0}" completed.', stLabel) : t('Onboarding: "{0}" reopened.', stLabel));
    var stName = st ? t(st.label) : t('Step');
    J.app.save(c, rec.done ? t('{0} completed.', stName) : t('{0} reopened.', stName));
  };

  A['add-activity'] = function (el) {
    var c = cur(el);
    var text = document.getElementById('act-text').value.trim();
    var type = document.getElementById('act-type').value;
    var dt = document.getElementById('act-date').value;
    if (!text) { document.getElementById('act-text').classList.add('invalid'); document.getElementById('act-text').focus(); ui.toast(t('Please add a short description.'), 'error'); return; }
    var date = dt ? new Date(dt).toISOString() : new Date().toISOString();
    L.log(c, type, text, date);
    J.app.save(c, t('Activity added to timeline.'));
  };
  A['delete-activity'] = function (el) {
    var c = cur(el), aid = el.getAttribute('data-act');
    ui.confirm({ title: t('Delete activity entry?'), message: t('This timeline entry will be removed.'), ok: t('Delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      c.activities = c.activities.filter(function (a) { return a.id !== aid; });
      J.app.save(c, t('Activity entry deleted.'));
    });
  };
  A['save-notes'] = function (el) {
    var c = cur(el);
    c.notes = document.getElementById('notes-main').value;
    J.app.save(c, t('Notes saved.'));
  };
  A['add-note'] = function (el) {
    var c = cur(el);
    var ta = document.getElementById('note-new');
    if (!ta.value.trim()) { ta.classList.add('invalid'); ta.focus(); return; }
    c.noteLog = c.noteLog || [];
    c.noteLog.push({ id: U.uid(), date: new Date().toISOString(), text: ta.value.trim() });
    L.log(c, 'note', ta.value.trim());
    J.app.save(c, t('Note added.'));
  };
  A['delete-note'] = function (el) {
    var c = cur(el), nid = el.getAttribute('data-note');
    ui.confirm({ title: t('Delete note?'), message: t('This note will be permanently removed.'), ok: t('Delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      c.noteLog = (c.noteLog || []).filter(function (n) { return n.id !== nid; });
      J.app.save(c, t('Note deleted.'));
    });
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'note-new') { var b = document.querySelector('[data-action="add-note"]'); if (b) b.click(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'act-text') { var b2 = document.querySelector('[data-action="add-activity"]'); if (b2) b2.click(); }
  });

  A['profile-more'] = function (el) {
    var c = cur(el);
    var items = [{ header: t('Move to stage') }];
    C.STAGES.forEach(function (st) {
      items.push({ label: t(st.label), checked: c.stage === st.key, onClick: function () { J.app.moveStage(c.id, st.key); } });
    });
    items.push({ sep: true });
    items.push({ label: t('Log a call'), icon: 'phone', onClick: function () { state.tab = 'activity'; render(true); var s = document.getElementById('act-type'); if (s) { s.value = 'call'; document.getElementById('act-text').focus(); } } });
    if (c.archived) items.push({ label: t('Delete permanently…'), icon: 'trash', danger: true, onClick: function () { J.app.deleteForever(c.id); } });
    ui.menu(el, items);
  };
})();
