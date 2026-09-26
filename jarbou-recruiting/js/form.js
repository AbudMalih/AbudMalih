/* Add / Edit candidate form. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui;
  var esc = U.esc;
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
      '<div class="form-section"><h4><span class="n">1</span>Personal Information</h4><div class="fgrid">' +
      field('First Name', input('firstName', c.firstName, 'text', 'required autofocus'), { id: 'firstName', req: true }) +
      field('Family Name', input('lastName', c.lastName, 'text', 'required'), { id: 'lastName', req: true }) +
      field('Phone', input('phone', c.phone, 'tel', 'placeholder="+49 …"'), { id: 'phone' }) +
      field('Email', input('email', c.email, 'email', 'placeholder="name@example.com"'), { id: 'email' }) +
      field('Date of Birth', input('dob', c.dob, 'date', 'max="' + U.todayISO() + '"'), { id: 'dob' }) +
      field('Nationality', input('nationality', c.nationality, 'text', 'list="dl-nat"'), { id: 'nationality' }) +
      field('Address', input('address', c.address, 'text', 'placeholder="Street, No., Postcode"'), { id: 'address', span: 'span-2' }) +
      field('City', input('city', c.city), { id: 'city' }) +
      field('Preferred Language', input('language', c.language, 'text', 'list="dl-lang"'), { id: 'language' }) +
      '</div></div>' +

      '<div class="form-section"><h4><span class="n">2</span>Employment</h4><div class="fgrid">' +
      field('Position', select('position', ui.options(s.positions, c.position, { blank: 'Select…' })), { id: 'position' }) +
      field('Project', select('project', ui.options(s.projects, c.project, { blank: 'Select…' })), { id: 'project' }) +
      field('Station / Location', select('station', ui.options(s.stations, c.station, { blank: 'Pending / not assigned' })), { id: 'station', help: 'Add new stations in Settings.' }) +
      field('Employment Type', select('employmentType', ui.options(C.EMPLOYMENT_TYPES, c.employmentType, { blank: 'Select…' })), { id: 'employmentType' }) +
      field('Planned Start Date', input('startDate', c.startDate, 'date'), { id: 'startDate' }) +
      field('Tax Class / Steuerklasse', select('taxClass', ui.options(C.TAX_CLASSES, c.taxClass, { blank: 'Select…' })), { id: 'taxClass' }) +
      field('Standard Salary Reference (€ / month)', '<div class="inline-pair">' + input('salaryReference', c.salaryReference, 'number', 'min="0" step="10"') +
        '<select name="salaryBasis" style="width:92px">' + ui.options([{ key: 'net', label: 'net' }, { key: 'gross', label: 'gross' }], c.salaryBasis) + '</select></div>', { id: 'salaryReference' }) +
      field('Candidate Salary Expectation (€ / month)', '<div class="inline-pair">' + input('salaryExpectationMin', c.salaryExpectationMin, 'number', 'min="0" step="10" placeholder="from"') +
        '<span class="muted">–</span>' + input('salaryExpectationMax', c.salaryExpectationMax, 'number', 'min="0" step="10" placeholder="to (optional)"') + '</div>', { id: 'salaryExpectationMin', help: 'Same basis (net/gross) as the reference.' }) +
      field('Working Hours / Week', input('hoursPerWeek', c.hoursPerWeek, 'number', 'min="0" max="60" step="0.5"'), { id: 'hoursPerWeek' }) +
      field('Candidate Availability', select('availability', ui.options(C.AVAILABILITY.filter(function (a) { return a.key; }), c.availability, { blank: 'Pending / unknown' })), { id: 'availability', help: 'Willingness of the candidate – separate from administrative readiness.' }) +
      '</div></div>' +

      '<div class="form-section"><h4><span class="n">3</span>Recruitment</h4><div class="fgrid">' +
      field('Application Date', input('applicationDate', c.applicationDate, 'date'), { id: 'applicationDate' }) +
      field('Source', select('source', ui.options(s.sources, c.source, { blank: 'Select…' })), { id: 'source' }) +
      field('Responsible Recruiter', select('recruiter', ui.options(s.recruiters, c.recruiter, { blank: 'Unassigned' })), { id: 'recruiter', help: s.recruiters.length ? '' : 'Add recruiters in Settings.' }) +
      field('Interview Date', input('interviewDate', c.interviewDate, 'date'), { id: 'interviewDate' }) +
      field('Interview Status', select('interviewStatus', ui.options(C.INTERVIEW_STATUSES, c.interviewStatus)), { id: 'interviewStatus' }) +
      field('Candidate Status (Pipeline Stage)', select('stage', ui.options(stageOpts, c.stage)), { id: 'stage' }) +
      field('Next Follow-up Date', input('followUpDate', c.followUpDate, 'date'), { id: 'followUpDate' }) +
      field('Follow-up Note', input('followUpNote', c.followUpNote, 'text', 'placeholder="e.g. Call about Führungszeugnis"'), { id: 'followUpNote', span: 'span-2' }) +
      field('Next Action', input('nextAction', c.nextAction, 'text'), { id: 'nextAction', span: 'span-3' }) +
      '</div></div>' +

      '<div class="form-section"><h4><span class="n">4</span>Notes</h4><div class="fgrid">' +
      field('Internal Notes', '<textarea id="f-notes" name="notes" rows="4" placeholder="Internal notes – visible to recruiting team only">' + esc(c.notes) + '</textarea>', { id: 'notes', span: 'span-3' }) +
      '</div></div>' +
      '<datalist id="dl-lang">' + C.LANGUAGES.map(function (l) { return '<option value="' + esc(l) + '">'; }).join('') + '</datalist>' +
      '<datalist id="dl-nat"></datalist>' +
      '<button type="submit" hidden></button>' +
      '</form>';

    var m = ui.modal({
      title: editing ? 'Edit Candidate' : 'Add Candidate',
      subtitle: editing ? esc(U.fullName(c)) + ' · <span class="mono">' + esc(c.id) + '</span>' : 'Fields marked <span style="color:var(--brand)">*</span> are required. Everything else can be completed later.',
      wide: true, sticky: true,
      body: body,
      foot: '<span class="left">Tip: press Ctrl+Enter to save</span><button class="btn" data-close>Cancel</button><button class="btn primary" id="cand-save">' + U.icon('check') + (editing ? 'Save Changes' : 'Create Candidate') + '</button>'
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
    if (!v.firstName) errors.firstName = 'First name is required.';
    if (!v.lastName) errors.lastName = 'Family name is required.';
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Please enter a valid email address.';
    if (v.phone && !/^[+()\d\s\-\/.]{5,}$/.test(v.phone)) errors.phone = 'Please enter a valid phone number.';
    ['salaryReference', 'salaryExpectationMin', 'salaryExpectationMax', 'hoursPerWeek'].forEach(function (k) {
      if (v[k] !== '' && (U.num(v[k]) === null || U.num(v[k]) < 0)) errors[k === 'salaryExpectationMax' ? 'salaryExpectationMin' : k] = 'Please enter a valid positive number.';
    });
    if (U.num(v.hoursPerWeek) > 60) errors.hoursPerWeek = 'Maximum 60 hours per week.';
    if (U.num(v.salaryExpectationMin) !== null && U.num(v.salaryExpectationMax) !== null && U.num(v.salaryExpectationMax) < U.num(v.salaryExpectationMin)) errors.salaryExpectationMin = '"To" must be greater than or equal to "from".';
    if (v.dob && v.dob > U.todayISO()) errors.dob = 'Date of birth cannot be in the future.';

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
      ui.toast('Please check the highlighted fields.', 'error');
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
        proceed = ui.confirm({
          title: 'Possible duplicate',
          message: 'A candidate with the same ' + (U.normalize(dup.lastName) === U.normalize(c.lastName) ? 'name' : 'phone number') + ' already exists: <b>' + esc(U.fullName(dup)) + '</b> (' + esc(dup.id) + (dup.archived ? ', archived' : '') + ').<br>Create a new candidate anyway?',
          ok: 'Create anyway'
        });
      }
    }
    proceed.then(function (ok) {
      if (!ok) return;
      if (!editing) {
        c.id = S.nextId();
        c.createdAt = new Date().toISOString();
        L.log(c, 'system', 'Candidate created.');
        if (c.stage !== 'new') L.log(c, 'system', 'Pipeline stage set to ' + L.stage(c.stage).label + '.');
        if (c.followUpDate) L.log(c, 'system', 'Follow-up scheduled for ' + U.fmtDate(c.followUpDate) + (c.followUpNote ? ': ' + c.followUpNote : '') + '.');
      } else {
        if (prevStage !== c.stage) L.log(c, 'system', 'Moved from ' + L.stage(prevStage).label + ' to ' + L.stage(c.stage).label + '.');
        if (prevStart !== c.startDate) L.log(c, 'system', 'Planned start date ' + (c.startDate ? 'set to ' + U.fmtDate(c.startDate) : 'removed') + '.');
        if (prevFU !== c.followUpDate && c.followUpDate) L.log(c, 'system', 'Follow-up scheduled for ' + U.fmtDate(c.followUpDate) + (c.followUpNote ? ': ' + c.followUpNote : '') + '.');
        L.log(c, 'system', 'Candidate details updated.');
      }
      J.app.save(c, editing ? 'Candidate successfully updated.' : 'Candidate ' + U.fullName(c) + ' created (' + c.id + ').').then(function () {
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
    if (!list.length) { ui.toast('Add a candidate first.', 'info'); return; }
    var c = id ? S.get(id) : null;
    var m = ui.modal({
      title: 'Add Follow-up',
      subtitle: 'Schedule the next contact. It will appear under Follow-ups on the dashboard.',
      body: '<form id="fu-form" class="fgrid two" novalidate>' +
        '<div class="field span-3"><label>Candidate</label><select name="cid" ' + (c ? 'disabled' : '') + '>' +
        list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (c && c.id === x.id ? ' selected' : '') + '>' + esc(U.fullName(x)) + ' · ' + esc(x.id) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Follow-up date <span class="req">*</span></label><input type="date" name="date" value="' + esc((c && c.followUpDate) || U.addDays(U.todayISO(), 1)) + '" required></div>' +
        '<div class="field"><label>Quick pick</label><div class="row wrap">' +
        [['Today', 0], ['Tomorrow', 1], ['+3 days', 3], ['+1 week', 7]].map(function (p) { return '<button type="button" class="btn xs" data-days="' + p[1] + '">' + p[0] + '</button>'; }).join('') + '</div></div>' +
        '<div class="field span-3"><label>Follow-up note</label><input type="text" name="note" value="' + esc((c && c.followUpNote) || '') + '" placeholder="What needs to happen?"></div>' +
        '</form>',
      foot: (c && c.followUpDate ? '<button class="btn ghost" id="fu-clear" style="margin-right:auto">Mark as done / clear</button>' : '') + '<button class="btn" data-close>Cancel</button><button class="btn primary" id="fu-save">Save Follow-up</button>'
    });
    m.qa('[data-days]').forEach(function (b) { b.addEventListener('click', function () { m.q('[name=date]').value = U.addDays(U.todayISO(), +b.getAttribute('data-days')); }); });
    var clr = m.q('#fu-clear');
    if (clr) clr.addEventListener('click', function () {
      var cc = S.get(c.id);
      L.log(cc, 'system', 'Follow-up of ' + U.fmtDate(cc.followUpDate) + ' completed / cleared.');
      cc.followUpDate = ''; cc.followUpNote = '';
      J.app.save(cc, 'Follow-up cleared.').then(m.close);
    });
    m.q('#fu-save').addEventListener('click', function () {
      var date = m.q('[name=date]').value;
      if (!date) { m.q('[name=date]').classList.add('invalid'); return; }
      var cc = S.get(c ? c.id : m.q('[name=cid]').value);
      cc.followUpDate = date;
      cc.followUpNote = m.q('[name=note]').value.trim();
      L.log(cc, 'system', 'Follow-up scheduled for ' + U.fmtDate(date) + (cc.followUpNote ? ': ' + cc.followUpNote : '') + '.');
      J.app.save(cc, 'Follow-up saved for ' + U.fullName(cc) + '.').then(m.close);
    });
  };
})();
