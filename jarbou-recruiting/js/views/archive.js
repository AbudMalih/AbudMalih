/* Archive: archived candidates with restore and permanent delete. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon;
  var f = { q: '', reason: '' };

  J.views.archive = {
    render: function () {
      var archived = L.scoped(true).filter(function (c) { return c.archived; });
      var counts = {};
      archived.forEach(function (c) { counts[c.archiveReason] = (counts[c.archiveReason] || 0) + 1; });
      var list = archived.filter(function (c) {
        if (f.reason && c.archiveReason !== f.reason) return false;
        if (f.q && !L.matches(c, f.q)) return false;
        return true;
      }).sort(function (a, b) { return (b.archiveDate || '').localeCompare(a.archiveDate || ''); });

      var head = '<div class="page-head"><div><h1>Archive</h1><div class="sub">Archived candidates are kept for reference and can be restored at any time. Permanent deletion requires confirmation.</div></div>' +
        '<div class="actions"><button class="btn" data-action="archive-export">' + icon('download', 'sm') + 'Export archive</button></div></div>';
      var tb = '<div class="toolbar"><div class="search-input">' + icon('search') + '<input type="search" id="arch-q" placeholder="Search archive…" value="' + esc(f.q) + '" data-input="arch-q" aria-label="Search archive"></div>' +
        '<div class="row wrap" style="gap:6px"><button class="chip toggle ' + (!f.reason ? 'on' : '') + '" data-action="arch-reason" data-r="">All · ' + archived.length + '</button>' +
        C.ARCHIVE_REASONS.filter(function (r) { return counts[r]; }).map(function (r) { return '<button class="chip toggle ' + (f.reason === r ? 'on' : '') + '" data-action="arch-reason" data-r="' + esc(r) + '">' + esc(r) + ' · ' + counts[r] + '</button>'; }).join('') + '</div></div>';

      var table = list.length ? '<div class="table-wrap" data-keep-scroll="arch"><table class="data"><thead><tr><th>Candidate</th><th>ID</th><th>Reason</th><th>Archived on</th><th>Last stage</th><th>Position</th><th>Note</th><th></th></tr></thead><tbody>' +
        list.map(function (c) {
          return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '"><td class="name-cell">' + esc(U.fullName(c)) + '</td><td class="mono">' + esc(c.id) + '</td>' +
            '<td>' + ui.badge(c.archiveReason || '—', c.archiveReason === 'Started / Completed' ? 'green' : NEG(c.archiveReason) ? 'red' : '') + '</td>' +
            '<td>' + U.fmtDate(c.archiveDate) + '</td><td>' + ui.stageBadge(c.stage) + '</td><td>' + ui.val(c.position) + '</td>' +
            '<td style="max-width:260px;overflow:hidden;text-overflow:ellipsis" title="' + esc(c.archiveNote) + '">' + ui.val(c.archiveNote) + '</td>' +
            '<td class="actions-cell"><div class="row" style="justify-content:flex-end"><button class="btn xs" data-action="restore-candidate" data-id="' + esc(c.id) + '">' + icon('restore', 'sm') + 'Restore</button>' +
            '<button class="icon-btn" data-action="delete-candidate" data-id="' + esc(c.id) + '" aria-label="Delete permanently" data-tip="Delete permanently">' + icon('trash', 'sm') + '</button></div></td></tr>';
        }).join('') + '</tbody></table></div>'
        : ui.empty('archive', archived.length ? 'No archived candidates match' : 'Archive is empty', 'Candidates you archive (started, rejected, withdrawn, no response …) appear here.');
      return head + '<div class="card">' + tb + table + '</div>';
    }
  };
  function NEG(r) { return r === 'Rejected' || r === 'Candidate Withdrew' || r === 'Not Suitable' || r === 'No Response'; }

  var deb = U.debounce(function () { J.app.rerenderView(); }, 140);
  A['arch-q'] = function (el) { f.q = el.value; deb(); };
  A['arch-reason'] = function (el) { f.reason = el.getAttribute('data-r'); J.app.rerenderView(); };
  A['archive-export'] = function (el) { J.io.exportMenu(el, L.scoped(true).filter(function (c) { return c.archived; }), 'archive'); };
})();
