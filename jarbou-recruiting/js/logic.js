/* Business logic: document completion, readiness, onboarding progress,
   smart warnings, KPIs and search. All derived values are computed from the
   stored candidate record, never stored themselves (except readySince). */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store;
  var L = (J.logic = {});

  var memo = new Map();
  var version = 0;
  L.bump = function () { version++; memo.clear(); };

  var KEY_DOCS = {
    fuehrungszeugnis: 'Führungszeugnis',
    licence: 'Driving licence',
    id_passport: 'ID / Passport',
    work_permit: 'Work permit',
    residence_permit: 'Residence permit',
    bank: 'Bank details / IBAN'
  };
  var SIGNED = { signed: 1, completed: 1 };
  var COMPLETE = { received: 1, verified: 1 };

  L.stageIndex = function (key) {
    for (var i = 0; i < C.STAGES.length; i++) if (C.STAGES[i].key === key) return i;
    return 0;
  };
  L.stage = function (key) { return C.STAGES[L.stageIndex(key)]; };
  L.docStatus = function (key) { return C.DOC_STATUSES.filter(function (s) { return s.key === key; })[0] || C.DOC_STATUSES[0]; };
  L.contractStatus = function (key) { return C.CONTRACT_STATUSES.filter(function (s) { return s.key === key; })[0] || C.CONTRACT_STATUSES[0]; };
  L.availability = function (key) { return C.AVAILABILITY.filter(function (s) { return s.key === (key || ''); })[0] || C.AVAILABILITY[4]; };
  L.docDefs = function () { return S.settings().documents; };
  L.docLabel = function (key) {
    var d = L.docDefs().filter(function (x) { return x.key === key; })[0];
    return d ? d.label : key;
  };
  L.shortOf = function (d) { return d.short || d.label.split(' / ')[0]; };
  L.shortDocLabel = function (key) {
    var d = L.docDefs().filter(function (x) { return x.key === key; })[0];
    return d ? L.shortOf(d) : key;
  };

  function priorityFor(days, base) {
    // base: default priority when there is no near start date
    if (days !== null && days <= 14) return 'high';
    if (days !== null && days <= 30) return base === 'low' ? 'medium' : base;
    return base;
  }
  var PRIO_RANK = { high: 0, medium: 1, low: 2 };

  /** Compute everything derived for a candidate (memoised). */
  L.info = function (c) {
    var today = U.todayISO();
    var key = c.id + '|' + c.updatedAt + '|' + today + '|' + version;
    var hit = memo.get(c.id);
    if (hit && hit.key === key) return hit.info;
    var info = compute(c, today);
    memo.set(c.id, { key: key, info: info });
    return info;
  };

  function compute(c, today) {
    var s = S.settings();
    var defs = s.documents;
    var docs = c.documents || {};
    var daysToStart = c.startDate ? U.daysUntil(c.startDate) : null;
    var stageIdx = L.stageIndex(c.stage);
    var started = c.stage === 'started';

    /* ---------- Documents */
    var total = 0, complete = 0, missing = [], requested = [], received = [], verified = [], expiring = [], expired = [];
    defs.forEach(function (d) {
      var e = docs[d.key] || { status: d.required ? 'missing' : 'not_required' };
      if (e.status === 'not_required') return;
      total++;
      var isExpired = false;
      if (d.expiry && e.expiryDate && COMPLETE[e.status]) {
        var dd = U.daysUntil(e.expiryDate);
        if (dd < 0) { expired.push({ key: d.key, label: d.label, days: dd }); isExpired = true; }
        else if (dd <= (s.expiryWarningDays || 60)) expiring.push({ key: d.key, label: d.label, days: dd });
      }
      if (COMPLETE[e.status] && !isExpired) complete++;
      if (e.status === 'missing') missing.push(d.key);
      else if (e.status === 'requested') requested.push(d.key);
      else if (e.status === 'received') received.push(d.key);
      else if (e.status === 'verified') verified.push(d.key);
    });
    var outstandingDocs = missing.concat(requested);
    var docInfo = {
      total: total, complete: complete, pct: U.pct(complete, total),
      missing: missing, requested: requested, received: received, verified: verified,
      outstanding: outstandingDocs, expiring: expiring, expired: expired,
      allComplete: complete === total
    };

    /* ---------- Contract */
    var ct = c.contract || { status: 'not_started' };
    var signed = !!SIGNED[ct.status];

    /* ---------- Administrative readiness (independent of candidate willingness) */
    var reasons = [];
    outstandingDocs.forEach(function (k) {
      if (k === 'contract') return; // covered by contract status below
      var st = (docs[k] || {}).status;
      reasons.push(L.shortDocLabel(k) + (st === 'requested' ? ' requested – not yet received' : ' missing'));
    });
    expired.forEach(function (e) { reasons.push(L.shortDocLabel(e.key) + ' expired'); });
    if (!signed) reasons.push('Contract not signed' + (ct.status && ct.status !== 'not_started' ? ' (' + L.contractStatus(ct.status).label + ')' : ''));
    var missingInfo = [];
    if (!c.phone) missingInfo.push('phone number');
    if (!c.startDate) missingInfo.push('start date');
    if (!c.station) missingInfo.push('station / location');
    if (!c.employmentType) missingInfo.push('employment type');
    missingInfo.forEach(function (m) { reasons.push(m.charAt(0).toUpperCase() + m.slice(1) + ' not recorded'); });
    var adminReady = reasons.length === 0;

    /* ---------- Willingness / availability */
    var willing = c.availability === 'ready';

    /* ---------- Onboarding */
    var steps = (s.onboardingSteps || []).map(function (st) {
      var rec = (c.onboarding || {})[st.key] || {};
      var done = st.auto === 'documents' ? docInfo.allComplete : st.auto === 'contract' ? signed : !!rec.done;
      return { key: st.key, label: st.label, auto: st.auto || '', done: done, date: rec.date || '' };
    });
    var obDone = steps.filter(function (x) { return x.done; }).length;
    var nextStep = steps.filter(function (x) { return !x.done; })[0];
    var manualDone = steps.filter(function (x) { return x.done && !x.auto; }).length;
    var obInfo = {
      total: steps.length, done: obDone, pct: U.pct(obDone, steps.length), steps: steps,
      next: nextStep ? nextStep.label : '', complete: obDone === steps.length && steps.length > 0,
      state: obDone === steps.length && steps.length ? 'complete' : (manualDone > 0 || obDone > 0) ? 'in_progress' : 'not_started'
    };

    /* ---------- Overall status */
    var overall = c.archived ? 'archived' : started ? 'started' : (adminReady && willing) ? 'ready' : 'not_ready';
    var outstandingCount = reasons.length + (willing ? 0 : 1);

    /* ---------- Follow-up */
    var fu = '';
    if (c.followUpDate && !c.archived) {
      var fd = U.daysUntil(c.followUpDate);
      fu = fd < 0 ? 'overdue' : fd === 0 ? 'today' : 'upcoming';
    }

    /* ---------- Smart warnings */
    var w = [];
    if (!c.archived) {
      var d = daysToStart;
      var startsTxt = d === null ? '' : d === 0 ? 'STARTS TODAY' : d > 0 ? 'STARTS IN ' + d + ' DAY' + (d === 1 ? '' : 'S') : '';
      if (d !== null && d < 0 && !started) {
        w.push({ code: 'start_passed', priority: 'high', label: 'START DATE PASSED – STATUS NOT UPDATED', problem: 'Start date passed (' + U.fmtDate(c.startDate) + ') – not marked as Started' });
      }
      var progressed = stageIdx >= L.stageIndex('interested') || (d !== null && d <= 45);
      if (progressed) {
        Object.keys(KEY_DOCS).forEach(function (k) {
          var e = docs[k];
          if (!e || (e.status !== 'missing' && e.status !== 'requested')) return;
          var pr = priorityFor(d, k === 'fuehrungszeugnis' || k === 'licence' || k === 'id_passport' || k === 'work_permit' ? 'medium' : 'low');
          w.push({
            code: 'doc_' + k, priority: pr,
            label: KEY_DOCS[k].toUpperCase() + (e.status === 'requested' ? ' REQUESTED – NOT RECEIVED' : ' MISSING'),
            problem: KEY_DOCS[k] + (e.status === 'requested' ? ' requested, not yet received' : ' missing')
          });
        });
        var others = outstandingDocs.filter(function (k) { return !KEY_DOCS[k] && k !== 'contract'; });
        if (others.length) {
          w.push({ code: 'doc_other', priority: priorityFor(d, 'low'), label: others.length + ' OTHER DOCUMENT' + (others.length > 1 ? 'S' : '') + ' OUTSTANDING', problem: others.map(L.shortDocLabel).join(', ') + ' outstanding' });
        }
      } else if (outstandingDocs.length) {
        w.push({ code: 'docs_open', priority: 'low', label: outstandingDocs.length + ' DOCUMENTS NOT YET COLLECTED', problem: outstandingDocs.length + ' documents not yet collected' });
      }
      var lic = docs.licence;
      if (lic && lic.status === 'received') {
        w.push({ code: 'licence_unverified', priority: d !== null && d <= 7 ? 'high' : 'medium', label: 'DRIVING LICENCE NOT VERIFIED', problem: 'Driving licence received but not verified' });
      }
      expired.forEach(function (e) {
        w.push({ code: 'expired_' + e.key, priority: 'high', label: L.shortDocLabel(e.key).toUpperCase() + ' EXPIRED', problem: L.shortDocLabel(e.key) + ' expired ' + Math.abs(e.days) + ' days ago' });
      });
      expiring.forEach(function (e) {
        w.push({ code: 'expiring_' + e.key, priority: e.days <= 14 ? 'high' : 'medium', label: L.shortDocLabel(e.key).toUpperCase() + ' EXPIRES IN ' + e.days + ' DAYS', problem: L.shortDocLabel(e.key) + ' expires ' + U.fmtDate(U.addDays(today, e.days)) });
      });
      if (!signed && (stageIdx >= L.stageIndex('documents') || (d !== null && d <= 30))) {
        var near = d !== null && d >= 0 && d <= (s.contractWarningDays || 14);
        w.push({
          code: 'contract', priority: near ? 'high' : priorityFor(d, 'medium'),
          label: near ? startsTxt + ' – CONTRACT NOT SIGNED' : 'CONTRACT PENDING',
          problem: 'Contract ' + (ct.status === 'not_started' ? 'not started' : L.contractStatus(ct.status).label.toLowerCase() + ', not signed')
        });
      }
      if (d !== null && d <= 14 && !obInfo.complete && (d >= 0 || started)) {
        w.push({ code: 'onboarding', priority: d <= 3 ? 'high' : 'medium', label: (startsTxt ? startsTxt + ' – ' : '') + 'ONBOARDING INCOMPLETE', problem: 'Onboarding ' + obInfo.done + '/' + obInfo.total + ' complete' + (obInfo.next ? ' – next: ' + obInfo.next : '') });
      }
      if (!started && d !== null && d <= 21 && (c.availability === 'undecided' || c.availability === 'not_available' || !c.availability)) {
        w.push({ code: 'availability', priority: 'medium', label: 'AVAILABILITY NOT CONFIRMED', problem: 'Candidate availability is "' + L.availability(c.availability).short + '"' });
      }
      if (missingInfo.length && !started) {
        w.push({ code: 'info', priority: priorityFor(d, 'low'), label: 'MISSING REQUIRED INFORMATION', problem: 'Missing: ' + missingInfo.join(', ') });
      }
      if (fu === 'overdue') {
        var od = Math.abs(U.daysUntil(c.followUpDate));
        w.push({ code: 'followup', priority: od > 3 ? 'high' : 'medium', label: 'FOLLOW-UP OVERDUE', problem: 'Follow-up overdue by ' + od + ' day' + (od === 1 ? '' : 's') + (c.followUpNote ? ' – ' + c.followUpNote : '') });
      } else if (fu === 'today') {
        w.push({ code: 'followup_today', priority: 'medium', label: 'FOLLOW-UP DUE TODAY', problem: 'Follow-up due today' + (c.followUpNote ? ' – ' + c.followUpNote : '') });
      }
      w.sort(function (a, b) { return PRIO_RANK[a.priority] - PRIO_RANK[b.priority]; });
    }

    return {
      docs: docInfo,
      contract: { status: ct.status, signed: signed },
      admin: { ready: adminReady, reasons: reasons },
      willing: willing,
      overall: overall,
      outstanding: outstandingCount,
      onboarding: obInfo,
      daysToStart: daysToStart,
      followUp: fu,
      warnings: w,
      topPriority: w.length ? w[0].priority : ''
    };
  }

  /** Apply automatic bookkeeping before saving (ready timestamp, contract doc sync). */
  L.beforeSave = function (c, prev) {
    c.updatedAt = new Date().toISOString();
    // Contract signed -> employment contract document received
    if (c.contract && SIGNED[c.contract.status] && c.documents.contract && (c.documents.contract.status === 'missing' || c.documents.contract.status === 'requested')) {
      c.documents.contract.status = 'received';
    }
    if (c.contract && SIGNED[c.contract.status] && !c.contract.signedDate) c.contract.signedDate = U.todayISO();
    var info = compute(c, U.todayISO());
    if ((info.overall === 'ready' || info.overall === 'started') && !c.readySince) c.readySince = U.todayISO();
    if (info.overall === 'not_ready') c.readySince = '';
    if (c.stage === 'started' && !c.startedOn) c.startedOn = c.startDate && c.startDate <= U.todayISO() ? c.startDate : U.todayISO();
    if (c.stage !== 'started') c.startedOn = '';
    memo.delete(c.id);
    return c;
  };

  /** Candidates within the active project scope. */
  L.scoped = function (includeArchived) {
    var s = S.settings();
    var proj = s.activeProject;
    return S.all().filter(function (c) {
      if (!includeArchived && c.archived) return false;
      if (proj && proj !== 'all' && c.project !== proj) return false;
      return true;
    });
  };

  /* ---------- Search */
  var hayMemo = new Map();
  L.haystack = function (c) {
    var h = hayMemo.get(c.id);
    if (h && h.u === c.updatedAt) return h.v;
    var v = U.normalize([c.id, c.firstName, c.lastName, c.firstName + ' ' + c.lastName, c.lastName + ' ' + c.firstName,
      c.phone, String(c.phone || '').replace(/[\s\-\/()]/g, ''), c.email, c.city, c.station, c.address, c.position, c.project,
      c.notes, c.nextAction, c.followUpNote, c.recruiter, c.source,
      (c.noteLog || []).map(function (n) { return n.text; }).join(' ')].join(' | '));
    hayMemo.set(c.id, { u: c.updatedAt, v: v });
    return v;
  };
  L.matches = function (c, q) {
    if (!q) return true;
    var hay = L.haystack(c);
    return U.normalize(q).split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) !== -1; });
  };

  /* ---------- KPIs */
  L.kpis = function (list) {
    var today = U.todayISO();
    var weekAgo = U.addDays(today, -7);
    var monthStart = U.startOfMonth(today), monthEnd = U.endOfMonth(today);
    var k = {
      total: 0, newThisWeek: 0, ready: 0, readyThisWeek: 0, inRecruitment: 0, inInterview: 0,
      docsMissing: 0, docsOutstandingTotal: 0, contractPending: 0, contractSent: 0,
      onboarding: 0, onboardingPctSum: 0, startMonth: 0, startMonthNotReady: 0, start7: 0, start7Action: 0,
      started: 0, docTotal: 0, docComplete: 0, signed: 0, followToday: 0, followOverdue: 0
    };
    list.forEach(function (c) {
      var i = L.info(c);
      k.total++;
      if (c.createdAt && c.createdAt.slice(0, 10) >= weekAgo) k.newThisWeek++;
      if (i.overall === 'started') k.started++;
      if (i.overall === 'ready') { k.ready++; if (c.readySince && c.readySince >= weekAgo) k.readyThisWeek++; }
      if (i.overall === 'not_ready') { k.inRecruitment++; if (c.stage === 'interview') k.inInterview++; }
      var docOut = i.docs.outstanding.filter(function (x) { return x !== 'contract'; }).length + i.docs.expired.length;
      if (docOut > 0) { k.docsMissing++; k.docsOutstandingTotal += docOut; }
      k.docTotal += i.docs.total; k.docComplete += i.docs.complete;
      if (i.contract.signed) k.signed++;
      else if (i.overall !== 'started') {
        if (L.stageIndex(c.stage) >= L.stageIndex('interested') || c.contract.status !== 'not_started') { k.contractPending++; if (c.contract.status === 'sent') k.contractSent++; }
      }
      var inOb = i.onboarding.state === 'in_progress' || ((c.stage === 'ready' || c.stage === 'started' || c.stage === 'contract') && !i.onboarding.complete);
      if (inOb) { k.onboarding++; k.onboardingPctSum += i.onboarding.pct; }
      if (c.startDate && c.startDate >= monthStart && c.startDate <= monthEnd) { k.startMonth++; if (i.overall === 'not_ready') k.startMonthNotReady++; }
      if (i.daysToStart !== null && i.daysToStart >= 0 && i.daysToStart <= 7) { k.start7++; if (i.overall === 'not_ready') k.start7Action++; }
      if (i.followUp === 'today') k.followToday++;
      if (i.followUp === 'overdue') k.followOverdue++;
    });
    k.onboardingAvg = k.onboarding ? Math.round(k.onboardingPctSum / k.onboarding) : 0;
    return k;
  };

  /** Driver recruitment target (uses target position; counts ready + started as secured). */
  L.target = function (list) {
    var s = S.settings();
    var pos = s.targetPosition || '';
    var pool = list.filter(function (c) { return !pos || c.position === pos; });
    var ready = 0, started = 0, pipeline = 0, docTotal = 0, docComplete = 0, signed = 0;
    pool.forEach(function (c) {
      var i = L.info(c);
      if (i.overall === 'ready') ready++;
      else if (i.overall === 'started') started++;
      else pipeline++;
      docTotal += i.docs.total; docComplete += i.docs.complete;
      if (i.contract.signed) signed++;
    });
    var required = Math.max(0, parseInt(s.requiredDrivers, 10) || 0);
    var secured = ready + started;
    return {
      required: required, candidates: pool.length, ready: ready, started: started, secured: secured, pipeline: pipeline,
      remaining: Math.max(0, required - secured),
      progressPct: required ? Math.min(100, U.pct(secured, required)) : 0,
      readinessRate: U.pct(secured, pool.length),
      docRate: U.pct(docComplete, docTotal),
      contractRate: U.pct(signed, pool.length),
      position: pos
    };
  };

  /** Flattened attention list across candidates, sorted by priority and start date. */
  L.attention = function (list) {
    var items = [];
    list.forEach(function (c) {
      var i = L.info(c);
      i.warnings.forEach(function (w) { items.push({ c: c, w: w, days: i.daysToStart }); });
    });
    items.sort(function (a, b) {
      var p = PRIO_RANK[a.w.priority] - PRIO_RANK[b.w.priority];
      if (p) return p;
      var da = a.days === null ? 9999 : a.days, db = b.days === null ? 9999 : b.days;
      return da - db;
    });
    return items;
  };

  /** Record an activity on a candidate (does not save). */
  L.log = function (c, type, text, date) {
    c.activities = c.activities || [];
    c.activities.push({ id: U.uid(), type: type || 'system', date: date || new Date().toISOString(), text: text });
    if (['call', 'whatsapp', 'email', 'meeting'].indexOf(type) !== -1) {
      var dd = (date || new Date().toISOString()).slice(0, 10);
      if (!c.lastContact || dd > c.lastContact) c.lastContact = dd;
    }
  };

  /** Display salary expectation. */
  L.salaryText = function (c) {
    var a = c.salaryExpectationMin, b = c.salaryExpectationMax;
    if (a == null && b == null) return '';
    var basis = c.salaryBasis === 'gross' ? ' gross' : ' net';
    if (a != null && b != null && b !== a) return U.fmtMoney(a) + '–' + U.fmtMoney(b).replace('€', '') + basis;
    return U.fmtMoney(a != null ? a : b) + basis;
  };
  L.salaryValue = function (c) {
    return c.salaryExpectationMin != null ? c.salaryExpectationMin : c.salaryExpectationMax != null ? c.salaryExpectationMax : (c.contract && c.contract.salary) || null;
  };
})();
