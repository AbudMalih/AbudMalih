/* Add / Edit candidate form. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui;
  var esc = U.esc;
  var t = J.t;
  var F = (J.form = {});

  /* i18n: t('Phone') t('WhatsApp') t('Email') t('Meeting') t('Other') */
  F.FOLLOW_TYPES = [
    { key: 'phone', label: 'Phone', icon: 'phone' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'message' },
    { key: 'email', label: 'Email', icon: 'mail' },
    { key: 'meeting', label: 'Meeting', icon: 'meeting' },
    { key: 'other', label: 'Other', icon: 'bell' }
  ];
  function followTypeLabel(key) {
    var f = F.FOLLOW_TYPES.filter(function (x) { return x.key === key; })[0];
    return f ? t(f.label) : '';
  }
  var FIELDS = ['firstName', 'lastName', 'phone', 'email', 'dob', 'address', 'city', 'nationality', 'language', 'position', 'project', 'station',
    'employmentType', 'startDate', 'taxClass', 'salaryBasis', 'availability', 'applicationDate', 'source', 'recruiter', 'interviewDate',
    'interviewStatus', 'stage', 'followUpDate', 'followUpNote', 'nextAction', 'notes'];
  var NUM_FIELDS = ['salaryReference', 'salaryExpectationMin', 'salaryExpectationMax', 'hoursPerWeek'];
  function norm(v) { return v === undefined || v === null || v === '' ? null : v; }
  function sameVal(a, b) {
    a = norm(a); b = norm(b);
    if (a === null || b === null) return a === b;
    if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
    return String(a) === String(b);
  }

  function field(label, control, opts) {
    opts = opts || {};
    return '<div class="field ' + (opts.span || '') + '"><label for="f-' + opts.id + '">' + esc(label) + (opts.req ? ' <span class="req">*</span>' : '') + '</label>' + control +
      (opts.help ? '<div class="help">' + opts.help + '</div>' : '') + '<div class="err" data-err="' + opts.id + '"></div></div>';
  }
  function input(name, value, type, extra) {
    return '<input id="f-' + name + '" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '" ' + (extra || '') + '>';
  }
  function select(name, optionsHtml, extra) {
    return '<select id="f-' + name + '" name="' + name + '" ' + (extra || '') + '>' + optionsHtml + '</select>';
  }

  F.open = function (id, preset) {
    var s = S.settings();
    var editing = !!id;
    if (editing && !S.get(id)) { ui.toast(t('Candidate not found.'), 'error'); return; }
    // snapshot of what the form shows – used on save to detect colleagues' changes made in the meantime
    var orig = editing ? U.clone(S.get(id)) : null;
    var c = editing ? U.clone(orig) : C.emptyCandidate(s);
    if (preset) Object.keys(preset).forEach(function (k) { c[k] = preset[k]; });
    var stageOpts = C.STAGES.map(function (st) { return { key: st.key, label: st.label }; });

    var body =
      '<form id="cand-form" novalidate autocomplete="off">' +
      '<div class="form-section"><h4><span class="n">1</span>' + t('Personal Information') + '</h4><div class="fgrid">' +
      field(t('First Name'), input('firstName', c.firstName, 'text', 'required autofocus'), { id: 'firstName', req: true }) +
      field(t('Family Name'), input('lastName', c.lastName, 'text', 'required'), { id: 'lastName', req: true }) +
      field(t('Phone'), input('phone', c.phone, 'tel', 'placeholder="+49 …"'), { id: 'phone' }) +
      field(t('Email'), input('email', c.email, 'email', 'placeholder="name@example.com"'), { id: 'email' }) +
      field(t('Date of Birth'), input('dob', c.dob, 'date', 'max="' + U.todayISO() + '"'), { id: 'dob' }) +
      field(t('Nationality'), input('nationality', c.nationality, 'text', 'list="dl-nat"'), { id: 'nationality' }) +
      field(t('Address'), input('address', c.address, 'text', 'placeholder="' + esc(t('Street, No., Postcode')) + '"'), { id: 'address', span: 'span-2' }) +
      field(t('City'), input('city', c.city), { id: 'city' }) +
      field(t('Preferred Language'), input('language', c.language, 'text', 'list="dl-lang"'), { id: 'language' }) +
      '</div></div>' +

      '<div class="form-section"><h4><span class="n">2</span>' + t('Employment') + '</h4><div class="fgrid">' +
      field(t('Position'), select('position', ui.options(s.positions, c.position, { blank: 'Select…' })), { id: 'position' }) +
      field(t('Project'), select('project', ui.options(s.projects, c.project, { blank: 'Select…' })), { id: 'project' }) +
      field(t('Station / Location'), select('station', ui.options(s.stations, c.station, { blank: 'Pending / not assigned' })), { id: 'station', help: t('Add new stations in Settings.') }) +
      field(t('Employment Type'), select('employmentType', ui.options(C.EMPLOYMENT_TYPES, c.employmentType, { blank: 'Select…', tr: true })), { id: 'employmentType' }) +
      field(t('Planned Start Date'), input('startDate', c.startDate, 'date'), { id: 'startDate' }) +
      field(t('Tax Class / Steuerklasse'), select('taxClass', ui.options(C.TAX_CLASSES, c.taxClass, { blank: 'Select…', tr: true })), { id: 'taxClass' }) +
      field(t('Standard Salary Reference (€ / month)'), '<div class="inline-pair">' + input('salaryReference', c.salaryReference, 'number', 'min="0" step="10"') +
        '<select name="salaryBasis" style="width:92px">' + ui.options([{ key: 'net', label: 'net' }, { key: 'gross', label: 'gross' }], c.salaryBasis) + '</select></div>', { id: 'salaryReference' }) +
      field(t('Candidate Salary Expectation (€ / month)'), '<div class="inline-pair">' + input('salaryExpectationMin', c.salaryExpectationMin, 'number', 'min="0" step="10" placeholder="' + esc(t('from')) + '"') +
        '<span class="muted">–</span>' + input('salaryExpectationMax', c.salaryExpectationMax, 'number', 'min="0" step="10" placeholder="' + esc(t('to (optional)')) + '"') + '</div>', { id: 'salaryExpectationMin', help: t('Same basis (net/gross) as the reference.') }) +
      field(t('Working Hours / Week'), input('hoursPerWeek', c.hoursPerWeek, 'number', 'min="0" max="60" step="0.5"'), { id: 'hoursPerWeek' }) +
      field(t('Candidate Availability'), select('availability', ui.options(C.AVAILABILITY.filter(function (a) { return a.key; }), c.availability, { blank: 'Pending / unknown' })), { id: 'availability', help: t('Willingness of the candidate – separate from administrative readiness.') }) +
      '</div></div>' +

      '<div class="form-section"><h4><span class="n">3</span>' + t('Recruitment') + '</h4><div class="fgrid">' +
      field(t('Application Date'), input('applicationDate', c.applicationDate, 'date'), { id: 'applicationDate' }) +
      field(t('Source'), select('source', ui.options(s.sources, c.source, { blank: 'Select…', tr: true })), { id: 'source' }) +
      field(t('Responsible Recruiter'), select('recruiter', ui.options(s.recruiters, c.recruiter, { blank: 'Unassigned' })), { id: 'recruiter', help: s.recruiters.length ? '' : t('Add recruiters in Settings.') }) +
      field(t('Interview Date'), input('interviewDate', c.interviewDate, 'date'), { id: 'interviewDate' }) +
      field(t('Interview Status'), select('interviewStatus', ui.options(C.INTERVIEW_STATUSES, c.interviewStatus, { tr: true })), { id: 'interviewStatus' }) +
      field(t('Candidate Status (Pipeline Stage)'), select('stage', ui.options(stageOpts, c.stage)), { id: 'stage' }) +
      field(t('Next Follow-up Date'), input('followUpDate', c.followUpDate, 'date'), { id: 'followUpDate' }) +
      field(t('Follow-up Note'), input('followUpNote', c.followUpNote, 'text', 'placeholder="' + esc(t('e.g. Call about Führungszeugnis')) + '"'), { id: 'followUpNote', span: 'span-2' }) +
      field(t('Next Action'), input('nextAction', c.nextAction, 'text'), { id: 'nextAction', span: 'span-3' }) +
      '</div></div>' +

      '<div class="form-section"><h4><span class="n">4</span>' + t('Notes') + '</h4><div class="fgrid">' +
      field(t('Internal Notes'), '<textarea id="f-notes" name="notes" rows="4" placeholder="' + esc(t('Internal notes – visible to recruiting team only')) + '">' + esc(c.notes) + '</textarea>', { id: 'notes', span: 'span-3' }) +
      '</div></div>' +
      '<datalist id="dl-lang">' + C.LANGUAGES.map(function (l) { return '<option value="' + esc(l) + '">'; }).join('') + '</datalist>' +
      '<datalist id="dl-nat"></datalist>' +
      '<button type="submit" hidden></button>' +
      '</form>';

    var m = ui.modal({
      title: editing ? t('Edit Candidate') : t('Add Candidate'),
      subtitle: editing ? esc(U.fullName(c)) + ' · <span class="mono">' + esc(c.id) + '</span>' : t('Fields marked {0} are required. Everything else can be completed later.', '<span style="color:var(--brand)">*</span>'),
      wide: true, sticky: true,
      body: body,
      foot: '<span class="left">' + t('Tip: press Ctrl+Enter to save') + '</span><button class="btn" data-close>' + t('Cancel') + '</button><button class="btn primary" id="cand-save">' + U.icon('check') + (editing ? t('Save Changes') : t('Create Candidate')) + '</button>'
    });
    var form = m.q('#cand-form');
    var submit = function (e) { if (e) e.preventDefault(); save(m, form, c, editing, orig); };
    form.addEventListener('submit', submit);
    m.q('#cand-save').addEventListener('click', submit);
    form.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e); });
    form.addEventListener('input', function (e) { if (e.target.classList.contains('invalid')) { e.target.classList.remove('invalid'); var er = form.querySelector('[data-err="' + e.target.name + '"]'); if (er) er.textContent = ''; } });
  };

  function save(m, form, c, editing, orig) {
    var fd = new FormData(form);
    var v = {};
    fd.forEach(function (val, k) { v[k] = typeof val === 'string' ? val.trim() : val; });
    var errors = {};
    if (!v.firstName) errors.firstName = t('First name is required.');
    if (!v.lastName) errors.lastName = t('Family name is required.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = t('Please enter a valid email address.');
    if (v.phone && !/^[+()\d\s\-\/.]{5,}$/.test(v.phone)) errors.phone = t('Please enter a valid phone number.');
    ['salaryReference', 'salaryExpectationMin', 'salaryExpectationMax', 'hoursPerWeek'].forEach(function (k) {
      if (v[k] !== '' && (U.num(v[k]) === null || U.num(v[k]) < 0)) errors[k === 'salaryExpectationMax' ? 'salaryExpectationMin' : k] = t('Please enter a valid positive number.');
    });
    if (U.num(v.hoursPerWeek) > 60) errors.hoursPerWeek = t('Maximum 60 hours per week.');
    if (U.num(v.salaryExpectationMin) !== null && U.num(v.salaryExpectationMax) !== null && U.num(v.salaryExpectationMax) < U.num(v.salaryExpectationMin)) errors.salaryExpectationMin = t('"To" must be greater than or equal to "from".');
    if (v.dob && v.dob > U.todayISO()) errors.dob = t('Date of birth cannot be in the future.');

    form.querySelectorAll('.invalid').forEach(function (x) { x.classList.remove('invalid'); });
    form.querySelectorAll('[data-err]').forEach(function (x) { x.textContent = ''; });
    var keys = Object.keys(errors);
    if (keys.length) {
      keys.forEach(function (k) {
        var inp = form.querySelector('[name="' + k + '"]');
        if (inp) inp.classList.add('invalid');
        var er = form.querySelector('[data-err="' + k + '"]');
        if (er) er.textContent = errors[k];
      });
      var first = form.querySelector('[name="' + keys[0] + '"]');
      if (first) first.focus();
      ui.toast(t('Please check the highlighted fields.'), 'error');
      return;
    }

    var vals = {};
    FIELDS.forEach(function (k) { vals[k] = v[k] || ''; });
    NUM_FIELDS.forEach(function (k) { vals[k] = U.num(v[k]); });
    var btn = m.q('#cand-save');
    if (btn.disabled) return;

    if (editing) return saveEdit(m, btn, c.id, vals, orig);

    Object.keys(vals).forEach(function (k) { c[k] = vals[k]; });
    if (!c.contract.type && c.employmentType) c.contract.type = c.employmentType;
    if (c.contract.hours == null && c.hoursPerWeek != null) c.contract.hours = c.hoursPerWeek;

    var proceed = Promise.resolve(true);
    var dup = S.all().filter(function (o) {
      var sameName = U.normalize(o.firstName) === U.normalize(c.firstName) && U.normalize(o.lastName) === U.normalize(c.lastName);
      var samePhone = c.phone && o.phone && o.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, '');
      return sameName || samePhone;
    })[0];
    if (dup) {
      var dupName = '<b>' + esc(U.fullName(dup)) + '</b>';
      var dupId = dup.archived ? t('{0}, archived', esc(dup.id)) : esc(dup.id);
      proceed = ui.confirm({
        title: t('Possible duplicate'),
        message: (U.normalize(dup.lastName) === U.normalize(c.lastName) ? t('A candidate with the same name already exists: {0} ({1}).', dupName, dupId) : t('A candidate with the same phone number already exists: {0} ({1}).', dupName, dupId)) + '<br>' + t('Create a new candidate anyway?'),
        ok: t('Create anyway')
      });
    }
    proceed.then(function (ok) {
      if (!ok) return;
      c.activities = [];
      L.log(c, 'system', t('Candidate created.'));
      if (c.stage !== 'new') L.log(c, 'system', t('Pipeline stage set to {0}.', t(L.stage(c.stage).label)));
      if (c.followUpDate) L.log(c, 'system', c.followUpNote ? t('Follow-up scheduled for {0}: {1}.', U.fmtDate(c.followUpDate), c.followUpNote) : t('Follow-up scheduled for {0}.', U.fmtDate(c.followUpDate)));
      busy(btn);
      // the server assigns the candidate ID
      J.app.create(c).then(function (saved) {
        ui.toast(t('Candidate {0} created ({1}).', U.fullName(saved), saved.id), 'success');
        m.close();
        J.profile.open(saved.id);
        if (saved.stage === 'ready') J.app.warnIfNotReady(S.get(saved.id) || saved);
      });
    });
  }

  /** Disable the save button while a request runs (J.app.save/create never resolve on failure – re-enable after a moment). */
  function busy(btn) {
    btn.disabled = true;
    setTimeout(function () { btn.disabled = false; }, 4000);
  }

  /** Apply only the fields the user changed to the current (live) record. If a colleague changed one of those
      fields while the form was open, nothing is saved and the conflict dialog is shown (no silent overwrite). */
  function saveEdit(m, btn, id, vals, orig) {
    var live = S.get(id);
    if (!live) { ui.toast(t('Candidate not found.'), 'error'); m.close(); return; }
    var changed = Object.keys(vals).filter(function (k) { return !sameVal(vals[k], orig[k]); });
    var conflicts = changed.filter(function (k) { return !sameVal(live[k], orig[k]) && !sameVal(live[k], vals[k]); });
    if (conflicts.length) {
      m.close();
      var who = live.updatedBy;
      S.reload(id).then(function () { S.showConflict({ details: { updatedBy: who } }); }, function () { S.showConflict({ details: { updatedBy: who } }); });
      return;
    }
    if (!changed.length) { m.close(); ui.toast(t('No changes to save.'), 'info'); return; }
    var prevStage = live.stage, prevStart = live.startDate, prevFU = live.followUpDate;
    changed.forEach(function (k) { live[k] = vals[k]; });
    if (!live.contract.type && live.employmentType) live.contract.type = live.employmentType;
    if (live.contract.hours == null && live.hoursPerWeek != null) live.contract.hours = live.hoursPerWeek;
    if (prevStage !== live.stage) L.log(live, 'system', t('Moved from {0} to {1}.', t(L.stage(prevStage).label), t(L.stage(live.stage).label)));
    if (prevStart !== live.startDate) L.log(live, 'system', live.startDate ? t('Planned start date set to {0}.', U.fmtDate(live.startDate)) : t('Planned start date removed.'));
    if (prevFU !== live.followUpDate && live.followUpDate) L.log(live, 'system', live.followUpNote ? t('Follow-up scheduled for {0}: {1}.', U.fmtDate(live.followUpDate), live.followUpNote) : t('Follow-up scheduled for {0}.', U.fmtDate(live.followUpDate)));
    L.log(live, 'system', t('Candidate details updated.'));
    busy(btn);
    J.app.save(live, t('Candidate successfully updated.')).then(function () {
      m.close();
      if (live.stage === 'ready') J.app.warnIfNotReady(S.get(id) || live);
    });
  }

  /** Mark an open follow-up as done. Resolves with the updated candidate; on failure shows the error and never resolves. */
  F.completeFollowUp = function (id, fid) {
    var c = S.get(id);
    var f = c && ((c.followUps || []).filter(function (x) { return x.id === fid; })[0] || (c.followUpId === fid ? { date: c.followUpDate } : null));
    var date = f ? f.date : '';
    return J.api.post('/api/candidates/' + encodeURIComponent(id) + '/follow-ups/' + encodeURIComponent(fid) + '/complete', {
      activityText: t('Follow-up of {0} completed.', U.fmtDate(date))
    }).then(function (resp) {
      S.accept(resp);
      J.app.refresh();
      ui.toast(t('Follow-up marked as done.'), 'success');
      return resp;
    }, function (err) {
      ui.toast(J.api.message(err), 'error');
      if (err.status === 404) S.reload(id).then(function () { J.app.refresh(); }, function () {});
      else J.app.refresh();
      return new Promise(function () {});
    });
  };

  /** Follow-up modal (candidate can be picked if none given): date, optional time, type and note. */
  F.followUp = function (id) {
    var c = id ? S.get(id) : null;
    if (id && !c) { ui.toast(t('Candidate not found.'), 'error'); return; }
    var list = c ? [c] : L.scoped().sort(function (a, b) { return U.fullName(a).localeCompare(U.fullName(b)); });
    if (!list.length) { ui.toast(t('Add a candidate first.'), 'info'); return; }
    var first = c || list[0];
    var quick = [[t('Today'), 0], [t('Tomorrow'), 1], [t('+3 days'), 3], [t('+1 week'), 7]];
    var m = ui.modal({
      title: t('Add Follow-up'),
      subtitle: esc(t('Schedule the next contact. It will appear under Follow-ups on the dashboard.')),
      body: '<form id="fu-form" class="fgrid two" novalidate autocomplete="off">' +
        '<div class="field span-3"><label for="fu-cid">' + esc(t('Candidate')) + '</label>' +
        (c ? '<input id="fu-cid" type="text" value="' + esc(U.fullName(c) + ' · ' + c.id) + '" disabled>'
          : '<select id="fu-cid" name="cid">' + list.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(U.fullName(x)) + ' · ' + esc(x.id) + '</option>'; }).join('') + '</select>') + '</div>' +
        '<div class="field"><label for="fu-date">' + esc(t('Follow-up date')) + ' <span class="req">*</span></label><input id="fu-date" type="date" name="date" required></div>' +
        '<div class="field"><label for="fu-time">' + esc(t('Time (optional)')) + '</label><input id="fu-time" type="time" name="time"></div>' +
        '<div class="field span-3"><label>' + esc(t('Quick pick')) + '</label><div class="row wrap">' +
        quick.map(function (p) { return '<button type="button" class="btn xs" data-days="' + p[1] + '">' + esc(p[0]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="fu-type">' + esc(t('Type')) + '</label><select id="fu-type" name="type">' + ui.options(F.FOLLOW_TYPES, 'phone', { keepUnknown: false }) + '</select></div>' +
        '<div class="field"><label for="fu-note">' + esc(t('Follow-up note')) + '</label><input id="fu-note" type="text" name="note" maxlength="500" placeholder="' + esc(t('What needs to happen?')) + '"></div>' +
        '<div class="field span-3" id="fu-open-wrap" hidden><div class="help" id="fu-open-info"></div>' +
        '<label style="display:flex;gap:8px;align-items:center;font-weight:500;margin-top:6px"><input type="checkbox" id="fu-replace" name="replaceOpen" style="width:auto;height:auto"> ' + esc(t('Replace the current open follow-up')) + '</label></div>' +
        '<div class="field span-3"><div class="err" id="fu-err"></div></div>' +
        '<button type="submit" hidden></button></form>',
      foot: '<button class="btn ghost" id="fu-done" style="margin-inline-end:auto" hidden>' + U.icon('check', 'sm') + esc(t('Mark as done')) + '</button>' +
        '<button class="btn" data-close>' + esc(t('Cancel')) + '</button><button class="btn primary" id="fu-save">' + esc(t('Save Follow-up')) + '</button>'
    });
    var q = m.q;
    function selected() { return c ? S.get(c.id) : S.get(q('#fu-cid').value); }
    /** Prefill from the candidate's open follow-up (if any) and show the replace / done options. */
    function sync() {
      var cc = selected();
      var open = cc && cc.followUpId;
      q('#fu-date').value = (open && cc.followUpDate) || U.addDays(U.todayISO(), 1);
      q('#fu-time').value = (open && cc.followUpTime) || '';
      q('#fu-type').value = (open && cc.followUpType) || 'phone';
      q('#fu-note').value = (open && cc.followUpNote) || '';
      q('#fu-open-wrap').hidden = !open;
      q('#fu-replace').checked = !!open;
      q('#fu-done').hidden = !open;
      q('#fu-open-info').textContent = open ? t('Current open follow-up: {0}', U.fmtDate(cc.followUpDate) + (cc.followUpTime ? ' ' + cc.followUpTime : '') + ' · ' + followTypeLabel(cc.followUpType) + (cc.followUpNote ? ' – ' + cc.followUpNote : '')) : '';
    }
    sync();
    if (!c) q('#fu-cid').addEventListener('change', sync);
    m.qa('[data-days]').forEach(function (b) { b.addEventListener('click', function () { q('#fu-date').value = U.addDays(U.todayISO(), +b.getAttribute('data-days')); q('#fu-date').classList.remove('invalid'); }); });
    q('#fu-done').addEventListener('click', function () {
      var cc = selected();
      if (!cc || !cc.followUpId) return;
      q('#fu-done').disabled = true;
      F.completeFollowUp(cc.id, cc.followUpId).then(m.close);
    });
    var save = function (e) {
      if (e) e.preventDefault();
      var cc = selected();
      var date = q('#fu-date').value, time = (q('#fu-time').value || '').slice(0, 5), type = q('#fu-type').value, note = q('#fu-note').value.trim();
      if (!cc) { ui.toast(t('Candidate not found.'), 'error'); return; }
      if (!date) { q('#fu-date').classList.add('invalid'); q('#fu-err').textContent = t('Please choose a follow-up date.'); q('#fu-date').focus(); return; }
      var when = U.fmtDate(date) + (time ? ' ' + time : '') + ' (' + followTypeLabel(type) + ')';
      var btn = q('#fu-save');
      btn.disabled = true;
      J.api.post('/api/candidates/' + encodeURIComponent(cc.id) + '/follow-ups', {
        date: date, time: time, type: type, note: note,
        replaceOpen: !!(cc.followUpId && q('#fu-replace').checked),
        activityText: note ? t('Follow-up scheduled for {0}: {1}.', when, note) : t('Follow-up scheduled for {0}.', when)
      }).then(function (resp) {
        S.accept(resp);
        m.close();
        J.app.refresh();
        ui.toast(t('Follow-up saved for {0}.', U.fullName(resp)), 'success');
      }, function (err) {
        btn.disabled = false;
        ui.toast(J.api.message(err), 'error');
      });
    };
    q('#fu-form').addEventListener('submit', save);
    q('#fu-save').addEventListener('click', save);
  };
})();
