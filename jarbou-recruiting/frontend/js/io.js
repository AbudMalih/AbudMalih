/* Export: CSV, Excel (.xlsx, generated locally), JSON, print list; server backup shortcut.
   Backup/restore of the central database is managed in Settings → Backups. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var t = J.t;
  var IO = (J.io = {});

  /* ------------------------------------------------------------ Flat rows */
  IO.rows = function (list) {
    var s = S.settings();
    var docs = s.documents;
    var header = [t('Candidate ID'), t('First Name'), t('Family Name'), t('Phone'), t('Email'), t('Date of Birth'), t('Address'), t('City'), t('Nationality'), t('Preferred Language'),
      t('Position'), t('Project'), t('Station / Location'), t('Employment Type'), t('Planned Start Date'), t('Tax Class'), t('Standard Salary Reference (EUR)'), t('Salary Basis'),
      t('Salary Expectation From (EUR)'), t('Salary Expectation To (EUR)'), t('Working Hours / Week'), t('Candidate Availability'),
      t('Application Date'), t('Source'), t('Interview Date'), t('Interview Status'), t('Recruiter'), t('Recruitment Status'), t('Overall Status'), t('Administrative Readiness'),
      t('Outstanding Requirements'), t('Documents Complete'), t('Documents Required'), t('Document Completion %')]
      .concat(docs.map(function (d) { return t('Doc: {0}', t(d.label)); }))
      .concat([t('Contract Status'), t('Contract Type'), t('Contract Salary (EUR)'), t('Contract Hours / Week'), t('Contract Start'), t('Contract End'), t('Contract Signed Date'),
        t('Onboarding Done'), t('Onboarding Steps'), t('Onboarding %'), t('Next Action'), t('Next Follow-up'), t('Follow-up Note'), t('Last Contact'), t('Internal Notes'),
        t('Archived'), t('Archive Reason'), t('Archive Date'), t('Created'), t('Last Updated')]);
    var rows = [header];
    list.forEach(function (c) {
      var i = L.info(c);
      rows.push([c.id, c.firstName, c.lastName, c.phone, c.email, U.fmtDate(c.dob), c.address, c.city, c.nationality, c.language,
        c.position, c.project, c.station, t(c.employmentType), U.fmtDate(c.startDate), t(c.taxClass), c.salaryReference, t(c.salaryBasis),
        c.salaryExpectationMin, c.salaryExpectationMax, c.hoursPerWeek, t(L.availability(c.availability).short),
        U.fmtDate(c.applicationDate), t(c.source), U.fmtDate(c.interviewDate), t(c.interviewStatus), c.recruiter, t(L.stage(c.stage).label), t(C.OVERALL[i.overall].label),
        i.admin.ready ? t('Complete') : t('Not ready'), i.admin.reasons.join('; '), i.docs.complete, i.docs.total, i.docs.pct]
        .concat(docs.map(function (d) { var e = c.documents[d.key]; var st = e ? e.status : (d.required ? 'missing' : 'not_required'); return e && e.expiryDate ? t('{0} (exp. {1})', t(L.docStatus(st).label), U.fmtDate(e.expiryDate)) : t(L.docStatus(st).label); }))
        .concat([t(L.contractStatus(c.contract.status).label), t(c.contract.type), c.contract.salary, c.contract.hours, U.fmtDate(c.contract.startDate), U.fmtDate(c.contract.endDate), U.fmtDate(c.contract.signedDate),
          i.onboarding.done, i.onboarding.total, i.onboarding.pct, c.nextAction, U.fmtDate(c.followUpDate), c.followUpNote, U.fmtDate(c.lastContact), c.notes,
          c.archived ? t('Yes') : t('No'), t(c.archiveReason), U.fmtDate(c.archiveDate), U.fmtDateTime(c.createdAt), U.fmtDateTime(c.updatedAt)]));
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
    ui.toast(t('CSV exported ({0} rows).', rows.length - 1));
  };

  /* ------------------------------------------------------------ XLSX (minimal OOXML + stored ZIP) */
  var CRC_TABLE = (function () {
    var tbl = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tbl[n] = c >>> 0; }
    return tbl;
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
    var cdSize = central.reduce(function (sum, a) { return sum + a.length; }, 0);
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
    if (!list.length) { ui.toast(t('Nothing to export – the list is empty.'), 'warn'); return; }
    if (fmt === 'csv') return IO.downloadCSV(IO.rows(list), base + '.csv');
    if (fmt === 'xlsx') { U.download(base + '.xlsx', IO.toXLSX(IO.rows(list), t('Candidates'))); ui.toast(t('Excel file exported ({0} candidates).', list.length)); return; }
    if (fmt === 'json') {
      U.download(base + '.json', JSON.stringify({ app: C.APP_ID, type: 'candidate-export', exportedAt: new Date().toISOString(), candidates: list }, null, 2), 'application/json');
      ui.toast(t('JSON exported ({0} candidates).', list.length));
    }
  };

  IO.exportMenu = function (anchor, list, label) {
    var all = S.all();
    var title = label === 'filtered' ? t('Candidate list (filtered)') : label === 'archive' ? t('Archived candidates') : t('Candidate list');
    var print = { label: t('Print list / PDF'), icon: 'printer', onClick: function () { J.print.list(list, title); } };
    if (!J.auth.can('export')) { ui.menu(anchor, [print]); return; }
    ui.menu(anchor, [
      { header: (label === 'filtered' ? t('Current view') : label === 'archive' ? t('Archive') : t('Active candidates')) + ' · ' + list.length },
      { label: t('CSV (Excel, semicolon)'), icon: 'download', onClick: function () { IO.exportList(list, 'csv', label); } },
      { label: t('Excel (.xlsx)'), icon: 'excel', onClick: function () { IO.exportList(list, 'xlsx', label); } },
      { label: 'JSON', icon: 'database', onClick: function () { IO.exportList(list, 'json', label); } },
      { sep: true }, { header: t('All candidates incl. archive · {0}', all.length) },
      { label: t('All – CSV'), icon: 'download', onClick: function () { IO.exportList(all, 'csv', 'all'); } },
      { label: t('All – Excel (.xlsx)'), icon: 'excel', onClick: function () { IO.exportList(all, 'xlsx', 'all'); } },
      { sep: true },
      print
    ]);
  };

  /* ------------------------------------------------------------ Server backup (NAS) */
  /** Create a backup of the central database on the NAS (admins only). */
  IO.serverBackup = function () {
    if (!J.auth.can('backup.manage')) { ui.toast(t('You do not have permission for this action.'), 'error'); return Promise.resolve(null); }
    ui.toast(t('Creating backup on the NAS…'), 'info');
    return J.api.post('/api/backups', {}).then(function (r) {
      ui.toast(t('Backup created on the NAS: {0}', r.name));
      return r;
    }, function (err) { ui.toast(J.api.message(err), 'error'); return null; });
  };

  A['backup-now'] = function () { IO.serverBackup(); };
  A['export-all'] = function (el) {
    if (!J.auth.can('export')) { ui.toast(t('You do not have permission for this action.'), 'error'); return; }
    IO.exportList(S.all(), el.getAttribute('data-fmt'), 'all');
  };
})();
