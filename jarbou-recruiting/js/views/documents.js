/* Documents: status overview per document type, expiry monitor and matrix. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var st = { only: 'all', doc: '', q: '', page: 0 };
  var SIZE = 100;
  var SYM = { missing: 'x', requested: 'clock', received: 'download', verified: 'check', not_required: 'minus' };

  J.views.documents = {
    onEnter: function (p) { if (p && p.only) { st.only = p.only; st.doc = p.doc || ''; st.page = 0; } },
    render: function () {
      var s = S.settings();
      var defs = s.documents;
      var all = L.scoped();

      // Per-document summary
      var sum = {};
      defs.forEach(function (d) { sum[d.key] = { missing: 0, requested: 0, received: 0, verified: 0, not_required: 0 }; });
      var expiry = [];
      all.forEach(function (c) {
        var i = L.info(c);
        defs.forEach(function (d) { var e = c.documents[d.key]; var k = e ? e.status : (d.required ? 'missing' : 'not_required'); sum[d.key][k]++; });
        i.docs.expired.concat(i.docs.expiring).forEach(function (e) { expiry.push({ c: c, e: e }); });
      });
      expiry.sort(function (a, b) { return a.e.days - b.e.days; });

      var summary = '<div class="card mb-16"><div class="card-head"><h3>' + icon('file', 'sm') + 'Status by document</h3><span class="hint">Click a row to filter the matrix</span></div>' +
        '<div class="table-wrap" style="max-height:none;min-height:0"><table class="data compact"><thead><tr><th>Document</th><th class="center">Missing</th><th class="center">Requested</th><th class="center">Received</th><th class="center">Verified</th><th class="center">Not required</th><th style="width:26%">Completion</th></tr></thead><tbody>' +
        defs.map(function (d) {
          var x = sum[d.key];
          var req = x.missing + x.requested + x.received + x.verified;
          var done = x.received + x.verified;
          return '<tr data-action="docs-pick" data-doc="' + d.key + '" class="' + (st.doc === d.key ? 'sel' : '') + '"><td class="strong" title="' + esc(d.label) + '">' + (st.doc === d.key ? icon('chevronRight', 'sm') + ' ' : '') + esc(L.shortOf(d)) + '</td>' +
            '<td class="center">' + (x.missing ? '<span class="badge red">' + x.missing + '</span>' : '<span class="muted">0</span>') + '</td>' +
            '<td class="center">' + (x.requested ? '<span class="badge amber">' + x.requested + '</span>' : '<span class="muted">0</span>') + '</td>' +
            '<td class="center">' + (x.received || '<span class="muted">0</span>') + '</td><td class="center">' + (x.verified || '<span class="muted">0</span>') + '</td><td class="center muted">' + x.not_required + '</td>' +
            '<td>' + ui.miniProgress(done, req) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';

      var exp = '<div class="card mb-16"><div class="card-head"><h3>' + icon('clock', 'sm') + 'Expiry monitor</h3><span class="hint">Expired or expiring within ' + (s.expiryWarningDays || 60) + ' days</span></div>' +
        (expiry.length ? '<div class="card-body flush">' + expiry.slice(0, 30).map(function (x) {
          return '<div class="list-item clickable" data-action="open-candidate" data-id="' + esc(x.c.id) + '" data-tab="documents"><div class="grow"><div class="title">' + esc(U.fullName(x.c)) + '</div><div class="desc">' + esc(x.e.label) + '</div></div>' +
            (x.e.days < 0 ? ui.badge('Expired ' + Math.abs(x.e.days) + 'd ago', 'red', 'alert') : ui.badge('Expires in ' + x.e.days + 'd', x.e.days <= 14 ? 'red' : 'amber', 'clock')) + '</div>';
        }).join('') + '</div>' : '<div class="card-body small muted">No documents expired or expiring soon. Add issue/expiry dates in each candidate\'s Documents tab.</div>') + '</div>';

      // Matrix
      var list = all.filter(function (c) {
        if (st.q && !L.matches(c, st.q)) return false;
        var i = L.info(c);
        if (st.doc) {
          var e = c.documents[st.doc];
          if (st.only === 'missing' && !(e && (e.status === 'missing' || e.status === 'requested'))) return false;
        } else if (st.only === 'missing' && !i.docs.outstanding.length && !i.docs.expired.length) return false;
        return true;
      }).sort(function (a, b) { return L.info(a).docs.pct - L.info(b).docs.pct || (a.startDate || '9999').localeCompare(b.startDate || '9999'); });
      var pages = Math.max(1, Math.ceil(list.length / SIZE));
      if (st.page >= pages) st.page = pages - 1;
      var slice = list.slice(st.page * SIZE, st.page * SIZE + SIZE);

      var tb = '<div class="toolbar"><div class="seg-tabs"><button class="' + (st.only === 'all' ? 'on' : '') + '" data-action="docs-only" data-v="all">All candidates</button><button class="' + (st.only === 'missing' ? 'on' : '') + '" data-action="docs-only" data-v="missing">Missing / outstanding only</button></div>' +
        '<select class="sm" data-change="docs-doc" aria-label="Document">' + ui.options(defs.map(function (d) { return { key: d.key, label: d.label }; }), st.doc, { blank: 'All documents' }) + '</select>' +
        '<div class="search-input">' + icon('search') + '<input type="search" id="docs-q" placeholder="Search candidate…" value="' + esc(st.q) + '" data-input="docs-q" aria-label="Search"></div>' +
        '<div style="flex:1"></div><span class="result-count">' + list.length + ' candidates</span></div>';
      var legend = '<div class="chips" style="gap:12px">' + C.DOC_STATUSES.map(function (x) { return '<span class="row small" style="gap:5px"><span class="doc-cell s-' + x.key + '" style="cursor:default;width:22px;height:20px">' + icon(SYM[x.key], 'sm') + '</span>' + x.label + '</span>'; }).join('') +
        '<span class="small muted">Click a cell to change status.</span></div>';

      var matrix = list.length ? '<div class="table-wrap" data-keep-scroll="docs"><table class="data compact matrix"><thead><tr><th class="sticky-col">Candidate</th><th>Start</th><th>Complete</th>' +
        defs.map(function (d) { return '<th class="rot center" title="' + esc(d.label) + '">' + esc(L.shortOf(d)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        slice.map(function (c) {
          var i = L.info(c);
          var expSet = {}; i.docs.expiring.forEach(function (e) { expSet[e.key] = 'exp'; }); i.docs.expired.forEach(function (e) { expSet[e.key] = 'expd'; });
          return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '" data-tab="documents"><td class="name-cell sticky-col">' + esc(U.fullName(c)) + '<div class="sub">' + esc(c.id) + '</div></td>' +
            '<td>' + (c.startDate ? U.fmtDate(c.startDate) : '<span class="muted">—</span>') + '</td><td>' + ui.miniProgress(i.docs.complete, i.docs.total) + '</td>' +
            defs.map(function (d) {
              var e = c.documents[d.key] || { status: d.required ? 'missing' : 'not_required' };
              return '<td class="center"><button class="doc-cell s-' + e.status + ' ' + (expSet[d.key] || '') + '" data-action="docs-cell" data-id="' + esc(c.id) + '" data-doc="' + d.key + '" data-tip="' + esc(L.shortOf(d) + ': ' + L.docStatus(e.status).label + (e.expiryDate ? ' · expires ' + U.fmtDate(e.expiryDate) : '')) + '" aria-label="' + esc(d.label + ': ' + L.docStatus(e.status).label) + '">' + icon(SYM[e.status], 'sm') + '</button></td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        (pages > 1 ? '<div class="pager"><span>Page ' + (st.page + 1) + ' of ' + pages + '</span><div class="row"><button class="btn sm" data-action="docs-page" data-d="-1"' + (st.page === 0 ? ' disabled' : '') + '>Previous</button><button class="btn sm" data-action="docs-page" data-d="1"' + (st.page >= pages - 1 ? ' disabled' : '') + '>Next</button></div></div>' : '')
        : ui.empty('checkCircle', st.only === 'missing' ? 'No outstanding documents' : 'No candidates', st.only === 'missing' ? 'All documents for the selected scope are received or verified.' : '');

      return '<div class="page-head"><div><h1>Documents</h1><div class="sub">Document checklist across all active candidates. Residence and work permits can be marked "Not Required" per candidate.</div></div></div>' +
        '<div class="grid two">' + summary + exp + '</div>' +
        '<div class="card">' + tb + legend + matrix + '</div>';
    }
  };

  var deb = U.debounce(function () { J.app.rerenderView(); }, 140);
  A['docs-q'] = function (el) { st.q = el.value; st.page = 0; deb(); };
  A['docs-only'] = function (el) { st.only = el.getAttribute('data-v'); st.page = 0; J.app.rerenderView(); };
  A['docs-doc'] = function (el) { st.doc = el.value; st.page = 0; J.app.rerenderView(); };
  A['docs-pick'] = function (el) { var d = el.getAttribute('data-doc'); st.doc = st.doc === d ? '' : d; if (st.doc) st.only = 'missing'; st.page = 0; J.app.rerenderView(); };
  A['docs-page'] = function (el) { st.page += +el.getAttribute('data-d'); J.app.rerenderView(); };
  A['docs-cell'] = function (el, e) {
    e.stopPropagation();
    var c = S.get(el.getAttribute('data-id')), k = el.getAttribute('data-doc');
    var cur = (c.documents[k] || {}).status;
    ui.menu(el, [{ header: L.shortDocLabel(k) + ' – ' + U.fullName(c) }].concat(C.DOC_STATUSES.map(function (s) {
      return {
        label: s.label, icon: SYM[s.key], checked: s.key === cur, onClick: function () {
          if (s.key === cur) return;
          c.documents[k] = c.documents[k] || { status: 'missing', issueDate: '', expiryDate: '', note: '' };
          c.documents[k].status = s.key;
          L.log(c, 'document', L.docLabel(k) + ': ' + L.docStatus(cur).label + ' → ' + s.label + '.');
          J.app.save(c, L.shortDocLabel(k) + ' for ' + U.fullName(c) + ' marked as ' + s.label + '.');
        }
      };
    })));
  };
})();
