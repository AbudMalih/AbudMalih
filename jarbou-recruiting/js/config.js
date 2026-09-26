/* Static configuration, default settings and initial data. */
(function () {
  'use strict';
  var J = window.J;
  var C = (J.config = {});

  C.APP_ID = 'jarbou-recruiting';
  C.SCHEMA_VERSION = 1;
  C.APP_VERSION = '1.0.0';

  C.STAGES = [
    { key: 'new', label: 'New', color: '#8a8f97' },
    { key: 'contacted', label: 'Contacted', color: '#6b8fc7' },
    { key: 'interview', label: 'Interview', color: '#2a78d6' },
    { key: 'interested', label: 'Interested', color: '#4a3aa7' },
    { key: 'documents', label: 'Documents', color: '#d98a00' },
    { key: 'contract', label: 'Contract', color: '#c26a1b' },
    { key: 'ready', label: 'Ready', color: '#1c7a48' },
    { key: 'started', label: 'Started', color: '#16171a' }
  ];

  C.DOC_STATUSES = [
    { key: 'missing', label: 'Missing', badge: 'red', icon: 'xCircle' },
    { key: 'requested', label: 'Requested', badge: 'amber', icon: 'clock' },
    { key: 'received', label: 'Received', badge: 'blue', icon: 'download' },
    { key: 'verified', label: 'Verified', badge: 'green', icon: 'checkCircle' },
    { key: 'not_required', label: 'Not Required', badge: '', icon: 'minus' }
  ];

  C.CONTRACT_STATUSES = [
    { key: 'not_started', label: 'Not Started', badge: '', icon: 'circle' },
    { key: 'preparing', label: 'Preparing', badge: 'amber', icon: 'edit' },
    { key: 'prepared', label: 'Prepared', badge: 'blue', icon: 'file' },
    { key: 'sent', label: 'Sent', badge: 'blue', icon: 'send' },
    { key: 'signed', label: 'Signed', badge: 'green', icon: 'contract' },
    { key: 'completed', label: 'Completed', badge: 'green', icon: 'checkCircle' }
  ];

  C.EMPLOYMENT_TYPES = ['Vollzeit', 'Teilzeit', 'Minijob', 'Other'];
  C.TAX_CLASSES = ['Steuerklasse 1', 'Steuerklasse 2', 'Steuerklasse 3', 'Steuerklasse 4', 'Steuerklasse 5', 'Steuerklasse 6', 'Pending'];
  C.INTERVIEW_STATUSES = ['Not Scheduled', 'Scheduled', 'Completed', 'No Show', 'Cancelled'];
  C.AVAILABILITY = [
    { key: 'ready', label: 'Ready / willing to start', short: 'Ready', badge: 'green' },
    { key: 'later', label: 'Available later', short: 'Available later', badge: 'blue' },
    { key: 'undecided', label: 'Undecided', short: 'Undecided', badge: 'amber' },
    { key: 'not_available', label: 'Not available', short: 'Not available', badge: 'red' },
    { key: '', label: 'Pending / unknown', short: 'Pending', badge: '' }
  ];
  C.LANGUAGES = ['German', 'English', 'Arabic', 'Turkish', 'Polish', 'Romanian', 'Ukrainian', 'Russian', 'Kurdish', 'Persian', 'French', 'Spanish'];

  C.ARCHIVE_REASONS = ['Started / Completed', 'Rejected', 'Candidate Withdrew', 'No Response', 'Not Suitable', 'Duplicate', 'Other'];

  C.ACTIVITY_TYPES = [
    { key: 'call', label: 'Call', icon: 'phone' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'message' },
    { key: 'email', label: 'Email', icon: 'mail' },
    { key: 'meeting', label: 'Meeting', icon: 'meeting' },
    { key: 'document', label: 'Document Update', icon: 'file' },
    { key: 'note', label: 'Note', icon: 'note' },
    { key: 'other', label: 'Other', icon: 'activity' },
    { key: 'system', label: 'System', icon: 'activity' }
  ];

  C.OVERALL = {
    ready: { label: 'Ready to Start', badge: 'green', icon: 'checkCircle' },
    not_ready: { label: 'Not Ready', badge: 'red', icon: 'alertCircle' },
    started: { label: 'Started', badge: 'dark', icon: 'rocket' },
    archived: { label: 'Archived', badge: '', icon: 'archive' }
  };

  C.DEFAULT_DOCUMENTS = [
    { key: 'id_passport', short: 'ID / Passport', label: 'ID / Passport', required: true, expiry: true, builtin: true },
    { key: 'licence', short: 'Driving Licence', label: 'Driving Licence Class B', required: true, expiry: true, builtin: true },
    { key: 'fuehrungszeugnis', short: 'Führungszeugnis', label: 'Führungszeugnis', required: true, expiry: false, builtin: true },
    { key: 'tax_id', short: 'Tax ID', label: 'Tax ID / Steuer-ID', required: true, expiry: false, builtin: true },
    { key: 'social_security', short: 'Social Security No.', label: 'Social Security No. / Sozialversicherungsnummer', required: true, expiry: false, builtin: true },
    { key: 'health_insurance', short: 'Health Insurance', label: 'Health Insurance / Krankenkasse', required: true, expiry: false, builtin: true },
    { key: 'bank', short: 'Bank Details', label: 'Bank Details / IBAN', required: true, expiry: false, builtin: true },
    { key: 'residence_permit', short: 'Residence Permit', label: 'Residence Permit / Aufenthaltstitel', required: true, expiry: true, builtin: true, caseByCase: true },
    { key: 'work_permit', short: 'Work Permit', label: 'Work Permit / Arbeitserlaubnis', required: true, expiry: true, builtin: true, caseByCase: true },
    { key: 'contract', short: 'Employment Contract', label: 'Employment Contract', required: true, expiry: false, builtin: true },
    { key: 'other', short: 'Other Documents', label: 'Other Documents', required: false, expiry: false, builtin: true }
  ];

  C.DEFAULT_ONBOARDING = [
    { key: 'docs_complete', label: 'Documents Complete', auto: 'documents' },
    { key: 'contract_signed', label: 'Contract Signed', auto: 'contract' },
    { key: 'driver_info', label: 'Driver Information Complete' },
    { key: 'project_registration', label: 'DHL Project Registration' },
    { key: 'workwear', label: 'Uniform / Workwear' },
    { key: 'phone', label: 'Company Phone' },
    { key: 'vehicle', label: 'Vehicle Assignment' },
    { key: 'training_scheduled', label: 'Training Scheduled' },
    { key: 'training_completed', label: 'Training Completed' },
    { key: 'station_intro', label: 'Station Introduction' },
    { key: 'first_day', label: 'First Working Day Confirmed' }
  ];

  C.TABLE_COLUMNS = [
    { key: 'id', label: 'Candidate ID', sort: 'id' },
    { key: 'name', label: 'Name', sort: 'name', locked: true },
    { key: 'position', label: 'Position', sort: 'position' },
    { key: 'station', label: 'Location / Station', sort: 'station' },
    { key: 'project', label: 'Project', sort: 'project', hidden: true },
    { key: 'employmentType', label: 'Employment Type', sort: 'employmentType' },
    { key: 'salary', label: 'Salary', sort: 'salary' },
    { key: 'startDate', label: 'Start Date', sort: 'startDate' },
    { key: 'documents', label: 'Documents', sort: 'documents' },
    { key: 'contract', label: 'Contract', sort: 'contract' },
    { key: 'onboarding', label: 'Onboarding', sort: 'onboarding' },
    { key: 'stage', label: 'Recruitment Status', sort: 'stage' },
    { key: 'overall', label: 'Overall Status', sort: 'overall' },
    { key: 'lastContact', label: 'Last Contact', sort: 'lastContact' },
    { key: 'followUp', label: 'Next Follow-up', sort: 'followUp', hidden: true },
    { key: 'phone', label: 'Phone', hidden: true },
    { key: 'source', label: 'Source', sort: 'source', hidden: true },
    { key: 'recruiter', label: 'Responsible Recruiter', sort: 'recruiter' },
    { key: 'actions', label: 'Actions', locked: true }
  ];

  C.defaultSettings = function () {
    return {
      companyName: 'JARBOU Logistik GmbH',
      language: 'de',
      projects: ['DHL Express'],
      defaultProject: 'DHL Express',
      activeProject: 'all',
      stations: ['Hannover', 'Kassel', 'Haiger', 'Bremen'],
      defaultStation: '',
      positions: ['Driver'],
      defaultPosition: 'Driver',
      requiredDrivers: 30,
      targetPosition: 'Driver',
      recruiters: [],
      sources: ['Kleinanzeigen', 'Indeed', 'Facebook', 'Instagram', 'Recommendation', 'WhatsApp', 'Website', 'Other'],
      documents: J.util.clone(C.DEFAULT_DOCUMENTS),
      onboardingSteps: J.util.clone(C.DEFAULT_ONBOARDING),
      standardSalaryReference: 2160,
      standardSalaryBasis: 'net',
      backupReminderDays: 7,
      expiryWarningDays: 60,
      contractWarningDays: 14,
      idPrefix: 'JRB',
      nextNumber: 1,
      tableColumns: C.TABLE_COLUMNS.filter(function (c) { return !c.hidden; }).map(function (c) { return c.key; }),
      pageSize: 50
    };
  };

  /** Build an empty candidate with sensible defaults from settings. */
  C.emptyCandidate = function (settings) {
    var docs = {};
    settings.documents.forEach(function (d) {
      docs[d.key] = { status: d.required ? 'missing' : 'not_required', issueDate: '', expiryDate: '', note: '' };
    });
    return {
      id: '',
      createdAt: '',
      updatedAt: '',
      firstName: '', lastName: '', phone: '', email: '', dob: '', address: '', city: '', nationality: '', language: '',
      position: settings.defaultPosition || '', project: settings.defaultProject || '', station: settings.defaultStation || '',
      employmentType: '', startDate: '', taxClass: '',
      salaryReference: settings.standardSalaryReference || null, salaryBasis: settings.standardSalaryBasis || 'net',
      salaryExpectationMin: null, salaryExpectationMax: null,
      hoursPerWeek: null, availability: '',
      applicationDate: J.util.todayISO(), source: '', interviewDate: '', interviewStatus: 'Not Scheduled', recruiter: '',
      stage: 'new',
      nextAction: '', notes: '',
      followUpDate: '', followUpNote: '',
      lastContact: '',
      documents: docs,
      contract: { status: 'not_started', type: '', salary: null, hours: null, startDate: '', endDate: '', signedDate: '', note: '' },
      onboarding: {},
      activities: [],
      noteLog: [],
      readySince: '',
      archived: false, archiveReason: '', archiveDate: '', archiveNote: ''
    };
  };

  /** Initial candidates supplied by JARBOU. Unknown personal data is left blank on purpose. */
  C.seedCandidates = function (settings) {
    var U = J.util;
    var now = new Date().toISOString();
    function seedNote(salary) {
      return [J.t('Candidate availability: Ready.'), J.t('Administrative readiness: not fully ready – Führungszeugnis is outstanding.'),
        J.t('Desired net salary: {0} net (standard reference €2,160 net).', salary), J.t('Other personal details and document statuses not yet recorded – please update.')].join('\n');
    }
    function make(num, data) {
      var c = C.emptyCandidate(settings);
      Object.keys(data).forEach(function (k) { c[k] = data[k]; });
      c.id = settings.idPrefix + '-' + U.pad(num, 4);
      c.createdAt = now; c.updatedAt = now;
      c.applicationDate = '';
      c.station = '';
      c.documents.fuehrungszeugnis = { status: 'missing', issueDate: '', expiryDate: '', note: J.t('Not available – outstanding') };
      c.contract.type = data.employmentType;
      c.activities = [
        { id: U.uid(), type: 'system', date: now, text: J.t('Candidate record created (initial data import).') },
        { id: U.uid(), type: 'document', date: now, text: J.t('Führungszeugnis recorded as missing / not available.') }
      ];
      return c;
    }
    return [
      make(1, {
        firstName: 'Riber', lastName: 'Isso',
        position: 'Driver', project: 'DHL Express', employmentType: 'Teilzeit',
        salaryReference: 2160, salaryBasis: 'net', salaryExpectationMin: 1000, salaryExpectationMax: null,
        taxClass: 'Steuerklasse 1', startDate: '2026-10-01', availability: 'ready', stage: 'documents',
        nextAction: J.t('Request/receive Führungszeugnis and confirm final Teilzeit contractual conditions.'),
        notes: seedNote('€1,000')
      }),
      make(2, {
        firstName: 'Abdalrazaq', lastName: 'Al Shaer',
        position: 'Driver', project: 'DHL Express', employmentType: 'Teilzeit',
        salaryReference: 2160, salaryBasis: 'net', salaryExpectationMin: 700, salaryExpectationMax: 800,
        taxClass: 'Steuerklasse 1', startDate: '2026-11-01', availability: 'ready', stage: 'documents',
        nextAction: J.t('Request/receive Führungszeugnis and confirm final Teilzeit contractual conditions.'),
        notes: seedNote('€700–€800')
      })
    ];
  };
})();
