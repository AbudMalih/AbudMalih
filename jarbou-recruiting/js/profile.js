/* Candidate profile drawer with tabs: Overview, Documents, Contract,
   Onboarding, Activity, Notes. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var P = (J.profile = {});
  var state = { id: null, tab: 'overview' };

  P.isOpen = function () { return !!state.id; };
  P.currentId = function () { return state.id; };

  P.open = function (id, tab) {
    if (!S.get(id)) { ui.toast('Candidate not found.', 'error'); return; }
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
      return '<dt>' + esc(r[0]) + '</dt><dd class="' + (empty ? 'pending' : '') + '">' + (empty ? (r[2] || 'Pending') : (r[3] ? v : esc(v))) + '</dd>';
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
      ['overview', 'Overview'],
      ['documents', 'Documents', i.docs.complete + '/' + i.docs.total],
      ['contract', 'Contract'],
      ['onboarding', 'Onboarding', i.onboarding.done + '/' + i.onboarding.total],
      ['activity', 'Activity', (c.activities || []).length],
      ['notes', 'Notes', (c.noteLog || []).length || '']
    ];

    var head =
      '<div class="drawer-head">' +
      '<div class="top"><div class="avatar lg">' + esc(U.initials(c)) + '</div>' +
      '<div style="flex:1;min-width:0"><h2>' + esc(U.fullName(c)) + '</h2>' +
      '<div class="ids"><span class="mono">' + esc(c.id) + '</span>' + ui.stageBadge(c.stage) + ui.overallBadge(i, true) + ui.projectPill(c.project) +
      (c.position ? '<span>' + esc(c.position) + '</span>' : '') + (c.station ? '<span>· ' + esc(c.station) + '</span>' : '') + '</div>' +
      '</div><button class="icon-btn" data-action="close-profile" aria-label="Close profile" data-tip="Close (Esc)">' + icon('x') + '</button></div>' +
      '<div class="contact">' +
      '<span>' + icon('phone', 'sm') + (c.phone ? esc(c.phone) : '<i class="pending">Phone pending</i>') + '</span>' +
      '<span>' + icon('mail', 'sm') + (c.email ? esc(c.email) : '<i class="pending">Email pending</i>') + '</span>' +
      '<span>' + icon('calendar', 'sm') + (c.startDate ? 'Start ' + U.fmtDate(c.startDate) + ' ' + ui.daysPill(i.daysToStart) : '<i class="pending">Start date pending</i>') + '</span>' +
      '</div>' +
      '<div class="drawer-actions">' +
      '<button class="btn sm dark" data-action="edit-candidate" data-id="' + esc(c.id) + '">' + icon('edit', 'sm') + 'Edit</button>' +
      (c.phone ? '<a class="btn sm" href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '">' + icon('phone', 'sm') + 'Call</a>' : '<button class="btn sm" disabled data-tip="No phone number recorded">' + icon('phone', 'sm') + 'Call</button>') +
      '<button class="btn sm" data-action="copy-text" data-text="' + esc(c.phone) + '" data-what="Phone number"' + (c.phone ? '' : ' disabled') + '>' + icon('copy', 'sm') + 'Copy Phone</button>' +
      '<button class="btn sm" data-action="copy-text" data-text="' + esc(c.email) + '" data-what="Email"' + (c.email ? '' : ' disabled') + '>' + icon('copy', 'sm') + 'Copy Email</button>' +
      '<button class="btn sm" data-action="follow-up" data-id="' + esc(c.id) + '">' + icon('bell', 'sm') + 'Follow-up</button>' +
      '<button class="btn sm" data-action="print-candidate" data-id="' + esc(c.id) + '">' + icon('printer', 'sm') + 'Print</button>' +
      (c.archived
        ? '<button class="btn sm" data-action="restore-candidate" data-id="' + esc(c.id) + '">' + icon('restore', 'sm') + 'Restore</button>'
        : '<button class="btn sm" data-action="archive-candidate" data-id="' + esc(c.id) + '">' + icon('archive', 'sm') + 'Archive</button>') +
      '<button class="btn sm" data-action="profile-more" data-id="' + esc(c.id) + '" aria-label="More actions">' + icon('more', 'sm') + '</button>' +
      '</div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) {
        return '<button class="tab ' + (state.tab === t[0] ? 'on' : '') + '" role="tab" data-action="profile-tab" data-tab="' + t[0] + '">' + t[1] + (t[2] !== undefined && t[2] !== '' ? '<span class="n">' + t[2] + '</span>' : '') + '</button>';
      }).join('') + '</div></div>';

    var body = '<div class="drawer-body">' + (TABS[state.tab] || TABS.overview)(c, i) + '</div>';
    root.innerHTML = '<div class="overlay" data-action="close-profile"></div><aside class="drawer" role="dialog" aria-label="Candidate profile">' + head + body + '</aside>';
    var nb = root.querySelector('.drawer-body');
    if (nb) nb.scrollTop = scroll;
    if (focusSel) { var f = root.querySelector(focusSel); if (f) f.focus(); }
  }

  /* ------------------------------------------------------------ Tabs */
  var TABS = {};

  TABS.overview = function (c, i) {
    var banner;
    if (i.overall === 'ready') banner = '<div class="overall-banner ok">' + icon('checkCircle', 'lg') + '<div><div class="t">READY TO START</div><div class="d">Candidate is available and all administrative requirements are complete.</div></div></div>';
    else if (i.overall === 'started') banner = '<div class="overall-banner started">' + icon('rocket', 'lg') + '<div><div class="t">STARTED' + (c.startedOn ? ' · ' + U.fmtDate(c.startedOn) : '') + '</div><div class="d">' + (i.admin.ready ? 'All administrative requirements complete.' : i.admin.reasons.length + ' administrative item(s) still open – see below.') + '</div></div></div>';
    else if (i.overall === 'archived') banner = '<div class="overall-banner archived">' + icon('archive', 'lg') + '<div><div class="t">ARCHIVED · ' + esc(c.archiveReason) + '</div><div class="d">Archived on ' + U.fmtDate(c.archiveDate) + (c.archiveNote ? ' – ' + esc(c.archiveNote) : '') + '</div></div></div>';
    else banner = '<div class="overall-banner no">' + icon('alertCircle', 'lg') + '<div><div class="t">NOT READY · ' + i.outstanding + ' requirement' + (i.outstanding === 1 ? '' : 's') + ' outstanding</div><div class="d">Ready to start requires candidate availability AND complete administrative readiness.</div></div></div>';

    var av = L.availability(c.availability);
    var readiness =
      '<div class="readiness">' +
      '<div><div class="rh">Candidate availability / willingness</div>' +
      '<div class="verdict ' + (i.willing ? 'ok' : c.availability === 'not_available' ? 'no' : 'mid') + '">' + icon(i.willing ? 'checkCircle' : 'clock') + (i.willing ? 'AVAILABLE' : av.short.toUpperCase()) + '</div>' +
      '<div class="small muted mt-8">' + (i.willing ? 'Candidate confirmed they are ready and willing to start.' : 'Candidate availability not confirmed as ready.') + '</div>' +
      '<div class="mt-8"><select class="sm" data-change="set-availability" data-id="' + esc(c.id) + '" aria-label="Set availability">' + ui.options(C.AVAILABILITY.filter(function (a) { return a.key; }), c.availability, { blank: 'Pending / unknown' }) + '</select></div></div>' +
      '<div><div class="rh">Administrative readiness</div>' +
      '<div class="verdict ' + (i.admin.ready ? 'ok' : 'no') + '">' + icon(i.admin.ready ? 'checkCircle' : 'xCircle') + (i.admin.ready ? 'COMPLETE' : 'NOT READY · ' + i.admin.reasons.length + ' outstanding') + '</div>' +
      (i.admin.ready ? '<div class="small muted mt-8">Documents, contract and required information are complete.</div>' :
        '<ul>' + i.admin.reasons.slice(0, 12).map(function (r) { return '<li>' + icon('x', 'sm') + '<span>' + esc(r) + '</span></li>'; }).join('') + (i.admin.reasons.length > 12 ? '<li class="muted">+ ' + (i.admin.reasons.length - 12) + ' more</li>' : '') + '</ul>') +
      '</div></div>';

    var warnings = i.warnings.length ? '<div class="mt-16"><div class="section-title">' + icon('alert', 'sm') + 'Smart warnings</div><div class="warn-list">' +
      i.warnings.map(function (w) { return '<span class="warn-tag ' + w.priority + '">' + icon(w.priority === 'high' ? 'alert' : 'clock', 'sm') + esc(w.label) + '</span>'; }).join('') + '</div></div>' : '';

    var nextBox = '<div class="grid halves mt-16">' +
      '<div class="card"><div class="card-body"><div class="section-title">' + icon('flag', 'sm') + 'Next action</div>' +
      (c.nextAction ? '<div>' + esc(c.nextAction) + '</div>' : '<div class="muted">No next action defined.</div>') + '</div></div>' +
      '<div class="card"><div class="card-body"><div class="section-title">' + icon('bell', 'sm') + 'Next follow-up</div>' +
      (c.followUpDate ? '<div class="row">' + '<b>' + U.fmtDate(c.followUpDate) + '</b>' + (i.followUp === 'overdue' ? ui.badge('Overdue', 'red', 'alert') : i.followUp === 'today' ? ui.badge('Today', 'amber', 'clock') : '') + '</div>' + (c.followUpNote ? '<div class="muted-2 small mt-8">' + esc(c.followUpNote) + '</div>' : '') : '<div class="muted">No follow-up scheduled.</div>') +
      '<button class="btn xs mt-8" data-action="follow-up" data-id="' + esc(c.id) + '">' + (c.followUpDate ? 'Change' : 'Schedule follow-up') + '</button></div></div></div>';

    var salaryRef = c.salaryReference != null ? U.fmtMoney(c.salaryReference) + ' ' + (c.salaryBasis || 'net') : '';
    var personal = dl([
      ['First name', c.firstName], ['Family name', c.lastName], ['Phone', c.phone], ['Email', c.email],
      ['Date of birth', U.fmtDate(c.dob)], ['Address', c.address], ['City', c.city], ['Nationality', c.nationality], ['Preferred language', c.language]
    ]);
    var employment = dl([
      ['Position', c.position], ['Project', c.project ? ui.projectPill(c.project) : '', 'Pending', true], ['Station / Location', c.station],
      ['Employment type', c.employmentType], ['Tax class', c.taxClass], ['Standard salary reference', salaryRef],
      ['Salary expectation', L.salaryText(c)], ['Working hours / week', c.hoursPerWeek != null ? c.hoursPerWeek + ' h' : ''],
      ['Availability', ui.availBadge(c.availability), '', true]
    ]);
    var recruitment = dl([
      ['Application date', U.fmtDate(c.applicationDate)], ['Source', c.source], ['Responsible recruiter', c.recruiter, 'Unassigned'],
      ['Interview date', U.fmtDate(c.interviewDate)], ['Interview status', c.interviewStatus],
      ['Pipeline stage', ui.stageBadge(c.stage), '', true], ['Last contact', U.fmtDate(c.lastContact), 'No contact logged'],
      ['Created', U.fmtDateTime(c.createdAt)], ['Last updated', U.fmtDateTime(c.updatedAt)]
    ]);
    var start = dl([
      ['Planned start date', c.startDate ? U.fmtDate(c.startDate) + ' · ' + U.weekday(c.startDate) : ''],
      ['Days remaining', c.startDate ? ui.daysPill(i.daysToStart) : '', 'Pending', true],
      ['Documents', ui.miniProgress(i.docs.complete, i.docs.total) , '', true],
      ['Contract', ui.contractBadge(c.contract.status), '', true],
      ['Onboarding', ui.miniProgress(i.onboarding.done, i.onboarding.total), '', true],
      ['Next onboarding step', i.onboarding.next, 'All steps complete']
    ]);
    function card(title, ic, html) { return '<div class="card"><div class="card-head"><h3>' + icon(ic, 'sm') + esc(title) + '</h3></div><div class="card-body" style="padding-top:6px;padding-bottom:6px">' + html + '</div></div>'; }

    return banner + readiness + warnings + nextBox +
      '<div class="grid halves mt-16">' + card('Personal information', 'user', personal) + card('Employment', 'briefcase', employment) +
      card('Recruitment', 'users', recruitment) + card('Start information', 'calendar', start) + '</div>';
  };

  TABS.documents = function (c, i) {
    var defs = S.settings().documents;
    var rows = defs.map(function (d) {
      var e = c.documents[d.key] || { status: d.required ? 'missing' : 'not_required' };
      var exp = '';
      if (d.expiry) {
        var dd = e.expiryDate ? U.daysUntil(e.expiryDate) : null;
        var warn = dd === null ? '' : dd < 0 ? '<span class="exp-bad">' + icon('alert', 'sm') + ' Expired</span>' : dd <= (S.settings().expiryWarningDays || 60) ? '<span class="exp-warn">' + icon('clock', 'sm') + ' Expires in ' + dd + ' days</span>' : '';
        exp = '<label>Issued <input type="date" value="' + esc(e.issueDate) + '" data-change="doc-date" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" data-field="issueDate"></label>' +
          '<label>Expires <input type="date" value="' + esc(e.expiryDate) + '" data-change="doc-date" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" data-field="expiryDate"></label>' + warn;
      }
      return '<div class="doc-row"><div><div class="dn">' + esc(d.label) + '</div>' +
        '<div class="small muted">' + (d.caseByCase ? 'Depends on candidate – mark "Not Required" if not applicable' : d.required ? 'Required by default' : 'Optional') + '</div></div>' +
        '<select class="status-select s-' + e.status + '" data-change="doc-status" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" aria-label="Status of ' + esc(d.label) + '">' +
        ui.options(C.DOC_STATUSES, e.status) + '</select>' +
        '<div class="dates">' + exp + '<input type="text" placeholder="Note" value="' + esc(e.note) + '" data-change="doc-note" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" style="height:28px;font-size:12px;flex:1;min-width:110px"></div></div>';
    }).join('');
    var pct = i.docs.pct;
    return '<div class="card mb-16"><div class="card-body"><div class="row between wrap"><div><div class="section-title" style="margin:0">Document completion</div>' +
      '<div style="font-size:22px;font-weight:650;margin-top:2px">' + i.docs.complete + ' / ' + i.docs.total + ' <span class="muted" style="font-size:15px;font-weight:500">· ' + pct + '%</span></div></div>' +
      '<div class="row wrap">' + (i.docs.missing.length ? '<button class="btn sm" data-action="docs-request-all" data-id="' + esc(c.id) + '">' + icon('send', 'sm') + 'Mark all missing as requested</button>' : '') + '</div></div>' +
      '<div class="mt-12">' + ui.progress(pct, 'lg ' + ui.pctClass(pct)) + '</div>' +
      '<div class="legend">' + C.DOC_STATUSES.map(function (s) {
        var n = s.key === 'not_required' ? defs.length - i.docs.total : (i.docs[s.key] || []).length;
        return '<span>' + ui.badge(s.label + ' · ' + n, s.badge, s.icon) + '</span>';
      }).join('') + '</div></div></div>' +
      '<div class="card">' + rows + '</div>' +
      '<p class="small muted mt-12">"Received" and "Verified" count as complete. Documents past their expiry date count as outstanding. Changes are saved automatically.</p>';
  };

  TABS.contract = function (c) {
    var ct = c.contract;
    var idx = C.CONTRACT_STATUSES.map(function (s) { return s.key; }).indexOf(ct.status);
    var steps = '<div class="row wrap" style="gap:6px">' + C.CONTRACT_STATUSES.map(function (s, k) {
      var on = k <= idx;
      return '<button class="btn sm ' + (k === idx ? 'dark' : '') + '" data-action="contract-status" data-id="' + esc(c.id) + '" data-status="' + s.key + '" style="' + (on && k !== idx ? 'color:var(--green);border-color:var(--green-bd);background:var(--green-bg)' : '') + '">' + (on && k !== idx ? icon('check', 'sm') : '') + esc(s.label) + '</button>' + (k < C.CONTRACT_STATUSES.length - 1 ? '<span class="muted">' + icon('chevronRight', 'sm') + '</span>' : '');
    }).join('') + '</div>';
    var d = c.startDate ? U.daysUntil(c.startDate) : null;
    var warn = (ct.status !== 'signed' && ct.status !== 'completed' && d !== null && d >= 0 && d <= (S.settings().contractWarningDays || 14))
      ? '<div class="banner red mt-12">' + icon('alert') + '<div class="grow"><b>Starts in ' + d + ' day' + (d === 1 ? '' : 's') + ' – contract not signed.</b> Please prioritise contract preparation and signature.</div></div>' : '';
    return '<div class="card mb-16"><div class="card-head"><h3>' + icon('contract', 'sm') + 'Contract status</h3>' + ui.contractBadge(ct.status) + '</div><div class="card-body">' + steps + warn + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Contract details</h3></div><div class="card-body"><form id="contract-form" class="fgrid" novalidate>' +
      '<div class="field"><label for="ct-type">Contract type</label><select id="ct-type" name="type">' + ui.options(C.EMPLOYMENT_TYPES, ct.type, { blank: 'Select…' }) + '</select></div>' +
      '<div class="field"><label for="ct-salary">Contract salary (€ / month)</label><input id="ct-salary" name="salary" type="number" min="0" step="10" value="' + esc(ct.salary == null ? '' : ct.salary) + '"></div>' +
      '<div class="field"><label for="ct-hours">Weekly hours</label><input id="ct-hours" name="hours" type="number" min="0" max="60" step="0.5" value="' + esc(ct.hours == null ? '' : ct.hours) + '"></div>' +
      '<div class="field"><label for="ct-start">Contract start date</label><input id="ct-start" name="startDate" type="date" value="' + esc(ct.startDate) + '"><div class="help">' + (c.startDate ? 'Planned start: ' + U.fmtDate(c.startDate) : '') + '</div></div>' +
      '<div class="field"><label for="ct-end">Contract end date</label><input id="ct-end" name="endDate" type="date" value="' + esc(ct.endDate) + '"><div class="help">Leave empty for unlimited (unbefristet).</div></div>' +
      '<div class="field"><label for="ct-signed">Signed date</label><input id="ct-signed" name="signedDate" type="date" value="' + esc(ct.signedDate) + '"></div>' +
      '<div class="field span-3"><label for="ct-note">Contract notes</label><textarea id="ct-note" name="note" rows="3" placeholder="e.g. Final Teilzeit conditions to be confirmed">' + esc(ct.note) + '</textarea></div>' +
      '</form></div><div class="card-foot"><span>Salary reference: ' + (c.salaryReference != null ? U.fmtMoney(c.salaryReference) + ' ' + c.salaryBasis : '—') + ' · Candidate expectation: ' + (L.salaryText(c) || '—') + '</span>' +
      '<button class="btn primary sm" data-action="contract-save" data-id="' + esc(c.id) + '">' + icon('check', 'sm') + 'Save contract details</button></div></div>';
  };

  TABS.onboarding = function (c, i) {
    var ob = i.onboarding;
    return '<div class="card mb-16"><div class="card-body"><div class="row between"><div><div class="section-title" style="margin:0">Onboarding progress</div>' +
      '<div style="font-size:22px;font-weight:650;margin-top:2px">' + ob.done + ' / ' + ob.total + ' <span class="muted" style="font-size:15px;font-weight:500">· ' + ob.pct + '%</span></div></div>' +
      (ob.complete ? ui.badge('Onboarding complete', 'green', 'checkCircle') : ob.next ? '<div class="small muted">Next: <b style="color:var(--text)">' + esc(ob.next) + '</b></div>' : '') + '</div>' +
      '<div class="mt-12">' + ui.progress(ob.pct, 'lg ' + ui.pctClass(ob.pct)) + '</div></div></div>' +
      '<div class="card">' + ob.steps.map(function (st) {
        return '<div class="check-row ' + (st.done ? 'done' : '') + '">' +
          '<button class="ob-check ' + (st.done ? 'on' : '') + (st.auto ? ' auto' : '') + '" ' + (st.auto ? 'data-tip="Updated automatically from ' + (st.auto === 'documents' ? 'the document checklist' : 'the contract status') + '"' : 'data-action="toggle-onboarding" data-id="' + esc(c.id) + '" data-step="' + st.key + '"') + ' aria-label="' + esc(st.label) + '" id="ob-' + st.key + '">' + (st.done ? icon('check') : '') + '</button>' +
          '<label ' + (st.auto ? '' : 'for="ob-' + st.key + '"') + '>' + esc(st.label) + '</label>' +
          (st.auto ? '<span class="auto-tag">Auto</span>' : '') +
          (st.date && st.done ? '<span class="when">' + U.fmtDate(st.date) + '</span>' : '') + '</div>';
      }).join('') + '</div><p class="small muted mt-12">Onboarding steps can be customised in Settings → Onboarding Checklist.</p>';
  };

  TABS.activity = function (c) {
    var types = C.ACTIVITY_TYPES.filter(function (t) { return t.key !== 'system'; });
    var acts = (c.activities || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var lastDay = '';
    var tl = acts.map(function (a) {
      var t = C.ACTIVITY_TYPES.filter(function (x) { return x.key === a.type; })[0] || C.ACTIVITY_TYPES[6];
      var day = U.fmtDate(a.date.slice(0, 10)) || U.fmtDateTime(a.date).slice(0, 10);
      var dayHead = '';
      var dd = new Date(a.date); var dayKey = isNaN(dd) ? a.date.slice(0, 10) : U.toISODate(dd);
      if (dayKey !== lastDay) { lastDay = dayKey; dayHead = '<div class="tl-date-head">' + U.fmtDate(dayKey) + ' · ' + U.weekday(dayKey) + '</div>'; }
      return dayHead + '<div class="tl-item"><div class="dot ' + (a.type === 'system' ? 'auto' : '') + '">' + icon(t.icon) + '</div>' +
        '<div class="tl-top"><span class="tl-type">' + esc(a.type === 'system' ? 'Update' : t.label) + '</span><span class="tl-date">' + U.fmtTime(a.date) + '</span>' +
        (a.type !== 'system' ? '<button class="icon-btn tl-del" style="width:22px;height:22px" data-action="delete-activity" data-id="' + esc(c.id) + '" data-act="' + esc(a.id) + '" aria-label="Delete entry" data-tip="Delete entry">' + icon('trash', 'sm') + '</button>' : '') + '</div>' +
        '<div class="tl-text">' + esc(a.text) + '</div></div>';
      void day;
    }).join('');
    return '<div class="card mb-16"><div class="card-head"><h3>' + icon('plus', 'sm') + 'Log activity</h3></div><div class="card-body">' +
      '<div class="fgrid"><div class="field"><label for="act-type">Type</label><select id="act-type">' + types.map(function (t) { return '<option value="' + t.key + '">' + t.label + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="act-date">Date &amp; time</label><input id="act-date" type="datetime-local" value="' + U.localDateTimeValue() + '"></div>' +
      '<div class="field"><label>&nbsp;</label><button class="btn primary" data-action="add-activity" data-id="' + esc(c.id) + '">' + icon('plus', 'sm') + 'Add to timeline</button></div>' +
      '<div class="field span-3"><label for="act-text">Description</label><textarea id="act-text" rows="2" placeholder="e.g. Phone call completed – candidate will send Führungszeugnis by Friday"></textarea></div></div>' +
      '<p class="small muted">Calls, WhatsApp, email and meetings automatically update "Last Contact".</p></div></div>' +
      '<div class="card"><div class="card-head"><h3>' + icon('activity', 'sm') + 'Activity timeline</h3><span class="hint">' + acts.length + ' entries</span></div><div class="card-body">' +
      (acts.length ? '<div class="timeline">' + tl + '</div>' : ui.empty('activity', 'No activity yet', 'Log calls, messages and meetings to build the history.')) + '</div></div>';
  };

  TABS.notes = function (c) {
    var notes = (c.noteLog || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    return '<div class="card mb-16"><div class="card-head"><h3>' + icon('note', 'sm') + 'Internal notes</h3><span class="hint">Shown on the printed summary</span></div><div class="card-body">' +
      '<textarea id="notes-main" rows="6" style="width:100%" placeholder="General internal notes about this candidate">' + esc(c.notes) + '</textarea>' +
      '<div class="row mt-8" style="justify-content:flex-end"><button class="btn primary sm" data-action="save-notes" data-id="' + esc(c.id) + '">' + icon('check', 'sm') + 'Save notes</button></div></div></div>' +
      '<div class="card mb-16"><div class="card-head"><h3>Add dated note</h3></div><div class="card-body">' +
      '<textarea id="note-new" rows="3" style="width:100%" placeholder="Write a note… (Ctrl+Enter to add)"></textarea>' +
      '<div class="row mt-8" style="justify-content:flex-end"><button class="btn sm" data-action="add-note" data-id="' + esc(c.id) + '">' + icon('plus', 'sm') + 'Add note</button></div></div></div>' +
      (notes.length ? notes.map(function (n) {
        return '<div class="note-card"><div class="nh"><span>' + U.fmtDateTime(n.date) + '</span><button class="icon-btn" style="width:22px;height:22px" data-action="delete-note" data-id="' + esc(c.id) + '" data-note="' + esc(n.id) + '" aria-label="Delete note">' + icon('trash', 'sm') + '</button></div><div class="nt">' + esc(n.text) + '</div></div>';
      }).join('') : '<p class="muted small">No dated notes yet.</p>');
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
    L.log(c, 'system', 'Candidate availability changed from "' + L.availability(prev).short + '" to "' + L.availability(c.availability).short + '".');
    J.app.save(c, 'Availability updated.');
  };

  A['doc-status'] = function (el) {
    var c = cur(el), k = el.getAttribute('data-doc');
    var e = c.documents[k] = c.documents[k] || { status: 'missing', issueDate: '', expiryDate: '', note: '' };
    var prev = e.status;
    e.status = el.value;
    L.log(c, 'document', L.docLabel(k) + ': ' + L.docStatus(prev).label + ' → ' + L.docStatus(e.status).label + '.');
    J.app.save(c, L.shortDocLabel(k) + ' marked as ' + L.docStatus(e.status).label + '.');
  };
  A['doc-date'] = function (el) {
    var c = cur(el), k = el.getAttribute('data-doc'), f = el.getAttribute('data-field');
    var e = c.documents[k] = c.documents[k] || { status: 'missing', issueDate: '', expiryDate: '', note: '' };
    e[f] = el.value;
    if (f === 'expiryDate' && el.value) L.log(c, 'document', L.docLabel(k) + ': expiry date set to ' + U.fmtDate(el.value) + '.');
    J.app.save(c, 'Document date saved.');
  };
  A['doc-note'] = function (el) {
    var c = cur(el), k = el.getAttribute('data-doc');
    var e = c.documents[k] = c.documents[k] || { status: 'missing', issueDate: '', expiryDate: '', note: '' };
    e.note = el.value.trim();
    J.app.save(c, 'Document note saved.');
  };
  A['docs-request-all'] = function (el) {
    var c = cur(el);
    var n = 0;
    Object.keys(c.documents).forEach(function (k) { if (c.documents[k].status === 'missing') { c.documents[k].status = 'requested'; n++; } });
    L.log(c, 'document', n + ' missing document(s) marked as requested.');
    J.app.save(c, n + ' document(s) marked as requested.');
  };

  A['contract-status'] = function (el) {
    var c = cur(el), st = el.getAttribute('data-status');
    if (c.contract.status === st) return;
    var prev = c.contract.status;
    c.contract.status = st;
    if ((st === 'signed' || st === 'completed') && !c.contract.signedDate) c.contract.signedDate = U.todayISO();
    L.log(c, 'system', 'Contract status: ' + L.contractStatus(prev).label + ' → ' + L.contractStatus(st).label + '.');
    J.app.save(c, 'Contract marked as ' + L.contractStatus(st).label + '.');
  };
  A['contract-save'] = function (el) {
    var c = cur(el);
    var f = document.getElementById('contract-form');
    var get = function (n) { return f.querySelector('[name="' + n + '"]').value.trim(); };
    var sal = U.num(get('salary')), hrs = U.num(get('hours'));
    if ((get('salary') && (sal === null || sal < 0)) || (get('hours') && (hrs === null || hrs < 0 || hrs > 60))) { ui.toast('Please enter valid salary and hours.', 'error'); return; }
    if (get('endDate') && get('startDate') && get('endDate') < get('startDate')) { ui.toast('Contract end date must be after the start date.', 'error'); return; }
    c.contract.type = get('type'); c.contract.salary = sal; c.contract.hours = hrs;
    c.contract.startDate = get('startDate'); c.contract.endDate = get('endDate'); c.contract.signedDate = get('signedDate'); c.contract.note = get('note');
    L.log(c, 'system', 'Contract details updated.');
    J.app.save(c, 'Contract details saved.');
  };

  A['toggle-onboarding'] = function (el) {
    var c = cur(el), k = el.getAttribute('data-step');
    c.onboarding = c.onboarding || {};
    var rec = c.onboarding[k] || {};
    rec.done = !rec.done;
    rec.date = rec.done ? U.todayISO() : '';
    c.onboarding[k] = rec;
    var st = S.settings().onboardingSteps.filter(function (s) { return s.key === k; })[0];
    L.log(c, 'system', 'Onboarding: "' + (st ? st.label : k) + '" ' + (rec.done ? 'completed' : 'reopened') + '.');
    J.app.save(c, (st ? st.label : 'Step') + (rec.done ? ' completed.' : ' reopened.'));
  };

  A['add-activity'] = function (el) {
    var c = cur(el);
    var text = document.getElementById('act-text').value.trim();
    var type = document.getElementById('act-type').value;
    var dt = document.getElementById('act-date').value;
    if (!text) { document.getElementById('act-text').classList.add('invalid'); document.getElementById('act-text').focus(); ui.toast('Please add a short description.', 'error'); return; }
    var date = dt ? new Date(dt).toISOString() : new Date().toISOString();
    L.log(c, type, text, date);
    J.app.save(c, 'Activity added to timeline.');
  };
  A['delete-activity'] = function (el) {
    var c = cur(el), aid = el.getAttribute('data-act');
    ui.confirm({ title: 'Delete activity entry?', message: 'This timeline entry will be removed.', ok: 'Delete', danger: true }).then(function (ok) {
      if (!ok) return;
      c.activities = c.activities.filter(function (a) { return a.id !== aid; });
      J.app.save(c, 'Activity entry deleted.');
    });
  };
  A['save-notes'] = function (el) {
    var c = cur(el);
    c.notes = document.getElementById('notes-main').value;
    J.app.save(c, 'Notes saved.');
  };
  A['add-note'] = function (el) {
    var c = cur(el);
    var t = document.getElementById('note-new');
    if (!t.value.trim()) { t.classList.add('invalid'); t.focus(); return; }
    c.noteLog = c.noteLog || [];
    c.noteLog.push({ id: U.uid(), date: new Date().toISOString(), text: t.value.trim() });
    L.log(c, 'note', t.value.trim());
    J.app.save(c, 'Note added.');
  };
  A['delete-note'] = function (el) {
    var c = cur(el), nid = el.getAttribute('data-note');
    ui.confirm({ title: 'Delete note?', message: 'This note will be permanently removed.', ok: 'Delete', danger: true }).then(function (ok) {
      if (!ok) return;
      c.noteLog = (c.noteLog || []).filter(function (n) { return n.id !== nid; });
      J.app.save(c, 'Note deleted.');
    });
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'note-new') { var b = document.querySelector('[data-action="add-note"]'); if (b) b.click(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'act-text') { var b2 = document.querySelector('[data-action="add-activity"]'); if (b2) b2.click(); }
  });

  A['profile-more'] = function (el) {
    var c = cur(el);
    var items = [{ header: 'Move to stage' }];
    C.STAGES.forEach(function (st) {
      items.push({ label: st.label, checked: c.stage === st.key, onClick: function () { J.app.moveStage(c.id, st.key); } });
    });
    items.push({ sep: true });
    items.push({ label: 'Log a call', icon: 'phone', onClick: function () { state.tab = 'activity'; render(true); var s = document.getElementById('act-type'); if (s) { s.value = 'call'; document.getElementById('act-text').focus(); } } });
    if (c.archived) items.push({ label: 'Delete permanently…', icon: 'trash', danger: true, onClick: function () { J.app.deleteForever(c.id); } });
    ui.menu(el, items);
  };
})();
