/* Import / export: CSV, Excel (.xlsx, generated locally), JSON, backup & restore. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var IO = (J.io = {});

  /* ------------------------------------------------------------ Flat rows */
  IO.rows = function (list) {
    var s = S.settings();
    var docs = s.documents;
    var header = ['Candidate ID', 'First Name', 'Family Name', 'Phone', 'Email', 'Date of Birth', 'Address', 'City', 'Nationality', 'Preferred Language',
      'Position', 'Project', 'Station / Location', 'Employment Type', 'Planned Start Date', 'Tax Class', 'Standard Salary Reference (EUR)', 'Salary Basis',
      'Salary Expectation From (EUR)', 'Salary Expectation To (EUR)', 'Working Hours / Week', 'Candidate Availability',
      'Application Date', 'Source', 'Interview Date', 'Interview Status', 'Recruiter', 'Recruitment Status', 'Overall Status', 'Administrative Readiness',
      'Outstanding Requirements', 'Documents Complete', 'Documents Required', 'Document Completion %']
      .concat(docs.map(function (d) { return 'Doc: ' + d.label; }))
      .concat(['Contract Status', 'Contract Type', 'Contract Salary (EUR)', 'Contract Hours / Week', 'Contract Start', 'Contract End', 'Contract Signed Date',
        'Onboarding Done', 'Onboarding Steps', 'Onboarding %', 'Next Action', 'Next Follow-up', 'Follow-up Note', 'Last Contact', 'Internal Notes',
        'Archived', 'Archive Reason', 'Archive Date', 'Created', 'Last Updated']);
    var rows = [header];
    list.forEach(function (c) {
      var i = L.info(c);
      rows.push([c.id, c.firstName, c.lastName, c.phone, c.email, U.fmtDate(c.dob), c.address, c.city, c.nationality, c.language,
        c.position, c.project, c.station, c.employmentType, U.fmtDate(c.startDate), c.taxClass, c.salaryReference, c.salaryBasis,
        c.salaryExpectationMin, c.salaryExpectationMax, c.hoursPerWeek, L.availability(c.availability).short,
        U.fmtDate(c.applicationDate), c.source, U.fmtDate(c.interviewDate), c.interviewStatus, c.recruiter, L.stage(c.stage).label, C.OVERALL[i.overall].label,
        i.admin.ready ? 'Complete' : 'Not ready', i.admin.reasons.join('; '), i.docs.complete, i.docs.total, i.docs.pct]
        .concat(docs.map(function (d) { var e = c.documents[d.key]; var st = e ? e.status : (d.required ? 'missing' : 'not_required'); return L.docStatus(st).label + (e && e.expiryDate ? ' (exp. ' + U.fmtDate(e.expiryDate) + ')' : ''); }))
        .concat([L.contractStatus(c.contract.status).label, c.contract.type, c.contract.salary, c.contract.hours, U.fmtDate(c.contract.startDate), U.fmtDate(c.contract.endDate), U.fmtDate(c.contract.signedDate),
          i.onboarding.done, i.onboarding.total, i.onboarding.pct, c.nextAction, U.fmtDate(c.followUpDate), c.followUpNote, U.fmtDate(c.lastContact), c.notes,
          c.archived ? 'Yes' : 'No', c.archiveReason, U.fmtDate(c.archiveDate), U.fmtDateTime(c.createdAt), U.fmtDateTime(c.updatedAt)]));
    });
    return rows;
  };

  /* ------------------------------------------------------------ CSV (Excel-friendly: UTF-8 BOM, semicolon) */
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    // Prevent spreadsheet formula injection, but keep phone numbers like +49…
    if (/^[=@]/.test(s) || (/^[+\-]/.test(s) && !/^[+\-][\d\s()\/.-]+$/.test(s))) s = "'" + s;
    if (/[";\n\r,]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  IO.toCSV = function (rows) { return rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n'); };
  IO.downloadCSV = function (rows, name) {
    U.download(name, '﻿' + IO.toCSV(rows), 'text/csv;charset=utf-8');
    ui.toast('CSV exported (' + (rows.length - 1) + ' rows).');
  };

  /* ------------------------------------------------------------ XLSX (minimal OOXML + stored ZIP) */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) { var c = 0xffffffff; for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder();
    var chunks = [], central = [], offset = 0;
    var d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      chunks.push(new Uint8Array(h.buffer), name, data);
      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
      cd.setUint16(12, time, true); cd.setUint16(14, date, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (t, a) { return t + a.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(chunks.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function xmlEsc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  function colName(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  IO.toXLSX = function (rows, sheetName) {
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols>' + rows[0].map(function (h, k) { return '<col min="' + (k + 1) + '" max="' + (k + 1) + '" width="' + Math.min(48, Math.max(10, String(h).length + 2)) + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' +
      rows.map(function (r, ri) {
        return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) {
          var ref = colName(ci) + (ri + 1);
          if (v === null || v === undefined || v === '') return '';
          if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (ri === 0 ? ' s="1"' : '') + '><v>' + v + '</v></c>';
          return '<c r="' + ref + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
        }).join('') + '</row>';
      }).join('') + '</sheetData><autoFilter ref="A1:' + colName(rows[0].length - 1) + rows.length + '"/></worksheet>';
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xmlEsc((sheetName || 'Candidates').slice(0, 31)) + '" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'' + xmlEsc((sheetName || 'Candidates').slice(0, 31)) + '\'!$A$1:$' + colName(rows[0].length - 1) + '$' + rows.length + '</definedName></definedNames></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0EFEB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', data: sheet }
    ];
    return zip(files);
  };

  IO.exportList = function (list, fmt, label) {
    var base = 'jarbou-candidates_' + (label || 'export') + '_' + U.fileStamp();
    if (!list.length) { ui.toast('Nothing to export – the list is empty.', 'warn'); return; }
    if (fmt === 'csv') return IO.downloadCSV(IO.rows(list), base + '.csv');
    if (fmt === 'xlsx') { U.download(base + '.xlsx', IO.toXLSX(IO.rows(list), 'Candidates')); ui.toast('Excel file exported (' + list.length + ' candidates).'); return; }
    if (fmt === 'json') {
      U.download(base + '.json', JSON.stringify({ app: C.APP_ID, type: 'candidate-export', exportedAt: new Date().toISOString(), candidates: list }, null, 2), 'application/json');
      ui.toast('JSON exported (' + list.length + ' candidates).');
    }
  };

  IO.exportMenu = function (anchor, list, label) {
    var all = S.all();
    ui.menu(anchor, [
      { header: (label === 'filtered' ? 'Current view' : label === 'archive' ? 'Archive' : 'Active candidates') + ' · ' + list.length },
      { label: 'CSV (Excel, semicolon)', icon: 'download', onClick: function () { IO.exportList(list, 'csv', label); } },
      { label: 'Excel (.xlsx)', icon: 'excel', onClick: function () { IO.exportList(list, 'xlsx', label); } },
      { label: 'JSON', icon: 'database', onClick: function () { IO.exportList(list, 'json', label); } },
      { sep: true }, { header: 'All candidates incl. archive · ' + all.length },
      { label: 'All – CSV', icon: 'download', onClick: function () { IO.exportList(all, 'csv', 'all'); } },
      { label: 'All – Excel (.xlsx)', icon: 'excel', onClick: function () { IO.exportList(all, 'xlsx', 'all'); } },
      { sep: true },
      { label: 'Print list / PDF', icon: 'printer', onClick: function () { J.print.list(list, label === 'filtered' ? 'Candidate list (filtered)' : label === 'archive' ? 'Archived candidates' : 'Candidate list'); } }
    ]);
  };

  /* ------------------------------------------------------------ Backup & restore */
  IO.backup = function (quiet) {
    var data = S.exportAll();
    U.download('jarbou-recruiting-backup_' + U.fileStamp() + '.json', JSON.stringify(data, null, 2), 'application/json');
    var ts = new Date().toISOString();
    return S.saveMeta('lastBackup', ts).then(function () {
      if (!quiet) { ui.toast('Backup downloaded (' + data.candidateCount + ' candidates). Store the file in a safe place.'); J.app.refresh(); }
    });
  };

  function validate(data) {
    if (!data || typeof data !== 'object') return 'The file is not a valid backup.';
    if (data.app !== C.APP_ID) return 'This file is not a JARBOU Recruiting backup.';
    if (!Array.isArray(data.candidates)) return 'The backup contains no candidate list.';
    if (!data.meta || !data.meta.settings) return 'The backup contains no settings. Use a full "Backup Data" file.';
    var bad = data.candidates.filter(function (c) { return !c || typeof c.id !== 'string' || !c.id; }).length;
    if (bad) return bad + ' candidate record(s) in the file are invalid.';
    if ((data.schemaVersion || 1) > C.SCHEMA_VERSION) return 'This backup was created by a newer version of the application. Please update the application first.';
    return null;
  }

  /** Bring older/partial records up to the current structure. */
  function normalise(c, settings) {
    var base = C.emptyCandidate(settings);
    Object.keys(base).forEach(function (k) { if (c[k] === undefined) c[k] = base[k]; });
    c.contract = Object.assign(base.contract, c.contract || {});
    c.documents = c.documents || {};
    c.activities = Array.isArray(c.activities) ? c.activities : [];
    c.noteLog = Array.isArray(c.noteLog) ? c.noteLog : [];
    c.onboarding = c.onboarding || {};
    return c;
  }

  IO.restoreFile = function (file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { ui.toast('Could not read the file – it is not valid JSON.', 'error'); return; }
      var err = validate(data);
      if (err) { ui.toast(err, 'error'); return; }
      var m = ui.modal({
        title: 'Restore backup',
        subtitle: esc(file.name),
        body: '<div class="banner red" style="margin-bottom:14px">' + icon('alert') + '<div class="grow"><b>This will replace the current local database.</b></div></div>' +
          '<dl class="dl"><dt>Backup created</dt><dd>' + (data.exportedAt ? U.fmtDateTime(data.exportedAt) : 'unknown') + '</dd>' +
          '<dt>Candidates in backup</dt><dd>' + data.candidates.length + '</dd>' +
          '<dt>Candidates currently stored</dt><dd>' + S.count() + ' (will be replaced)</dd></dl>' +
          '<label class="check-inline mt-16"><input type="checkbox" id="rs-safety" checked> Download a safety backup of the current data first (recommended)</label>',
        foot: '<button class="btn" data-close>Cancel</button><button class="btn danger" id="rs-ok">' + icon('upload', 'sm') + 'Replace database</button>'
      });
      m.q('#rs-ok').addEventListener('click', function () {
        var pre = m.q('#rs-safety').checked ? IO.backup(true) : Promise.resolve();
        pre.then(function () {
          var settings = Object.assign(C.defaultSettings(), data.meta.settings);
          var cands = data.candidates.map(function (c) { return normalise(c, settings); });
          var lastBackup = S.meta('lastBackup');
          return S.replaceAll(cands, { settings: settings, createdAt: data.meta.createdAt || new Date().toISOString(), lastBackup: lastBackup, restoredAt: new Date().toISOString(), restoredFrom: file.name });
        }).then(function () {
          m.close();
          L.bump(); J.profile.close();
          J.app.refresh();
          ui.toast('Backup restored – ' + data.candidates.length + ' candidates loaded.', 'success');
        });
      });
    };
    reader.onerror = function () { ui.toast('Could not read the file.', 'error'); };
    reader.readAsText(file);
  };

  A['backup-now'] = function () { IO.backup(false); };
  A['restore-file'] = function (el) { var f = el.files && el.files[0]; IO.restoreFile(f); el.value = ''; };
  A['export-all'] = function (el) { IO.exportList(S.all(), el.getAttribute('data-fmt'), 'all'); };
})();
