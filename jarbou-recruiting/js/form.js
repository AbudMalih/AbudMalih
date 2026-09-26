/* Add / Edit candidate form. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui;
  var esc = U.esc;
  var t = J.t;
  var F = (J.form = {});

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
    var c = editing ? U.clone(S.get(id)) : C.emptyCandidate(s);
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
    var submit = function (e) { if (e) e.preventDefault(); save(m, form, c, editing); };
    form.addEventListener('submit', submit);
    m.q('#cand-save').addEventListener('click', submit);
    form.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e); });
    form.addEventListener('input', function (e) { if (e.target.classList.contains('invalid')) { e.target.classList.remove('invalid'); var er = form.querySelector('[data-err="' + e.target.name + '"]'); if (er) er.textContent = ''; } });
  };

  function save(m, form, c, editing) {
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

    var prevStage = c.stage, prevStart = c.startDate, prevFU = c.followUpDate;
    ['firstName', 'lastName', 'phone', 'email', 'dob', 'address', 'city', 'nationality', 'language', 'position', 'project', 'station',
      'employmentType', 'startDate', 'taxClass', 'salaryBasis', 'availability', 'applicationDate', 'source', 'recruiter', 'interviewDate',
      'interviewStatus', 'stage', 'followUpDate', 'followUpNote', 'nextAction', 'notes'].forEach(function (k) { c[k] = v[k] || ''; });
    c.salaryReference = U.num(v.salaryReference);
    c.salaryExpectationMin = U.num(v.salaryExpectationMin);
    c.salaryExpectationMax = U.num(v.salaryExpectationMax);
    c.hoursPerWeek = U.num(v.hoursPerWeek);
    if (!c.contract.type && c.employmentType) c.contract.type = c.employmentType;
    if (c.contract.hours == null && c.hoursPerWeek != null) c.contract.hours = c.hoursPerWeek;

    var proceed = Promise.resolve(true);
    if (!editing) {
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
    }
    proceed.then(function (ok) {
      if (!ok) return;
      if (!editing) {
        c.id = S.nextId();
        c.createdAt = new Date().toISOString();
        L.log(c, 'system', t('Candidate created.'));
        if (c.stage !== 'new') L.log(c, 'system', t('Pipeline stage set to {0}.', t(L.stage(c.stage).label)));
        if (c.followUpDate) L.log(c, 'system', c.followUpNote ? t('Follow-up scheduled for {0}: {1}.', U.fmtDate(c.followUpDate), c.followUpNote) : t('Follow-up scheduled for {0}.', U.fmtDate(c.followUpDate)));
      } else {
        if (prevStage !== c.stage) L.log(c, 'system', t('Moved from {0} to {1}.', t(L.stage(prevStage).label), t(L.stage(c.stage).label)));
        if (prevStart !== c.startDate) L.log(c, 'system', c.startDate ? t('Planned start date set to {0}.', U.fmtDate(c.startDate)) : t('Planned start date removed.'));
        if (prevFU !== c.followUpDate && c.followUpDate) L.log(c, 'system', c.followUpNote ? t('Follow-up scheduled for {0}: {1}.', U.fmtDate(c.followUpDate), c.followUpNote) : t('Follow-up scheduled for {0}.', U.fmtDate(c.followUpDate)));
        L.log(c, 'system', t('Candidate details updated.'));
      }
      J.app.save(c, editing ? t('Candidate successfully updated.') : t('Candidate {0} created ({1}).', U.fullName(c), c.id)).then(function () {
        if (!editing) S.saveSettings();
        m.close();
        if (!editing) J.profile.open(c.id);
        if (c.stage === 'ready') J.app.warnIfNotReady(c);
      });
    });
  }

  /** Quick follow-up modal (can pick candidate if none given). */
  F.followUp = function (id) {
    var list = L.scoped().sort(function (a, b) { return U.fullName(a).localeCompare(U.fullName(b)); });
    if (!list.length) { ui.toast(t('Add a candidate first.'), 'info'); return; }
    var c = id ? S.get(id) : null;
    var m = ui.modal({
      title: t('Add Follow-up'),
      subtitle: t('Schedule the next contact. It will appear under Follow-ups on the dashboard.'),
      body: '<form id="fu-form" class="fgrid two" novalidate>' +
        '<div class="field span-3"><label>' + t('Candidate') + '</label><select name="cid" ' + (c ? 'disabled' : '') + '>' +
        list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (c && c.id === x.id ? ' selected' : '') + '>' + esc(U.fullName(x)) + ' · ' + esc(x.id) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>' + t('Follow-up date') + ' <span class="req">*</span></label><input type="date" name="date" value="' + esc((c && c.followUpDate) || U.addDays(U.todayISO(), 1)) + '" required></div>' +
        '<div class="field"><label>' + t('Quick pick') + '</label><div class="row wrap">' +
        [[t('Today'), 0], [t('Tomorrow'), 1], [t('+3 days'), 3], [t('+1 week'), 7]].map(function (p) { return '<button type="button" class="btn xs" data-days="' + p[1] + '">' + p[0] + '</button>'; }).join('') + '</div></div>' +
        '<div class="field span-3"><label>' + t('Follow-up note') + '</label><input type="text" name="note" value="' + esc((c && c.followUpNote) || '') + '" placeholder="' + esc(t('What needs to happen?')) + '"></div>' +
        '</form>',
      foot: (c && c.followUpDate ? '<button class="btn ghost" id="fu-clear" style="margin-inline-end:auto">' + t('Mark as done / clear') + '</button>' : '') + '<button class="btn" data-close>' + t('Cancel') + '</button><button class="btn primary" id="fu-save">' + t('Save Follow-up') + '</button>'
    });
    m.qa('[data-days]').forEach(function (b) { b.addEventListener('click', function () { m.q('[name=date]').value = U.addDays(U.todayISO(), +b.getAttribute('data-days')); }); });
    var clr = m.q('#fu-clear');
    if (clr) clr.addEventListener('click', function () {
      var cc = S.get(c.id);
      L.log(cc, 'system', t('Follow-up of {0} completed / cleared.', U.fmtDate(cc.followUpDate)));
      cc.followUpDate = ''; cc.followUpNote = '';
      J.app.save(cc, t('Follow-up cleared.')).then(m.close);
    });
    m.q('#fu-save').addEventListener('click', function () {
      var date = m.q('[name=date]').value;
      if (!date) { m.q('[name=date]').classList.add('invalid'); return; }
      var cc = S.get(c ? c.id : m.q('[name=cid]').value);
      cc.followUpDate = date;
      cc.followUpNote = m.q('[name=note]').value.trim();
      L.log(cc, 'system', cc.followUpNote ? t('Follow-up scheduled for {0}: {1}.', U.fmtDate(date), cc.followUpNote) : t('Follow-up scheduled for {0}.', U.fmtDate(date)));
      J.app.save(cc, t('Follow-up saved for {0}.', U.fullName(cc))).then(m.close);
    });
  };
})();
