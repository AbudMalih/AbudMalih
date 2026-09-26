/* Archive: archived candidates with restore and permanent delete. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon, t = J.t;
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

      var canRestore = J.auth.can('candidate.write') && J.auth.can('candidate.archive');
      var canDelete = J.auth.can('candidate.delete');
      var head = '<div class="page-head"><div><h1>' + esc(t('Archive')) + '</h1><div class="sub">' + esc(canDelete ? t('Archived candidates are kept for reference and can be restored at any time. Permanent deletion requires confirmation.') : t('Archived candidates are kept for reference and can be restored at any time.')) + '</div></div>' +
        '<div class="actions">' + (J.auth.can('export') ? '<button class="btn" data-action="archive-export">' + icon('download', 'sm') + esc(t('Export archive')) + '</button>' : '') + '</div></div>';
      var tb = '<div class="toolbar"><div class="search-input">' + icon('search') + '<input type="search" id="arch-q" placeholder="' + esc(t('Search archive…')) + '" value="' + esc(f.q) + '" data-input="arch-q" aria-label="' + esc(t('Search archive')) + '"></div>' +
        '<div class="row wrap" style="gap:6px"><button class="chip toggle ' + (!f.reason ? 'on' : '') + '" data-action="arch-reason" data-r="">' + esc(t('All · {0}', archived.length)) + '</button>' +
        C.ARCHIVE_REASONS.filter(function (r) { return counts[r]; }).map(function (r) { return '<button class="chip toggle ' + (f.reason === r ? 'on' : '') + '" data-action="arch-reason" data-r="' + esc(r) + '">' + esc(t(r)) + ' · ' + counts[r] + '</button>'; }).join('') + '</div></div>';

      var table = list.length ? '<div class="table-wrap" data-keep-scroll="arch"><table class="data"><thead><tr><th>' + esc(t('Candidate')) + '</th><th>' + esc(t('ID')) + '</th><th>' + esc(t('Reason')) + '</th><th>' + esc(t('Archived on')) + '</th><th>' + esc(t('Last stage')) + '</th><th>' + esc(t('Position')) + '</th><th>' + esc(t('Note')) + '</th><th></th></tr></thead><tbody>' +
        list.map(function (c) {
          return '<tr data-action="open-candidate" data-id="' + esc(c.id) + '"><td class="name-cell">' + esc(U.fullName(c)) + '</td><td class="mono">' + esc(c.id) + '</td>' +
            '<td>' + ui.badge(c.archiveReason ? t(c.archiveReason) : '—', c.archiveReason === 'Started / Completed' ? 'green' : NEG(c.archiveReason) ? 'red' : '') + '</td>' +
            '<td>' + U.fmtDate(c.archiveDate) + '</td><td>' + ui.stageBadge(c.stage) + '</td><td>' + ui.val(c.position) + '</td>' +
            '<td style="max-width:260px;overflow:hidden;text-overflow:ellipsis" title="' + esc(c.archiveNote) + '">' + ui.val(c.archiveNote) + '</td>' +
            '<td class="actions-cell"><div class="row" style="justify-content:flex-end">' +
            (canRestore ? '<button class="btn xs" data-action="restore-candidate" data-id="' + esc(c.id) + '" data-stop>' + icon('restore', 'sm') + esc(t('Restore')) + '</button>' : '') +
            (canDelete ? '<button class="icon-btn" data-action="delete-candidate" data-id="' + esc(c.id) + '" data-stop aria-label="' + esc(t('Delete permanently')) + '" data-tip="' + esc(t('Delete permanently')) + '">' + icon('trash', 'sm') + '</button>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>'
        : ui.empty('archive', archived.length ? t('No archived candidates match') : t('Archive is empty'), esc(t('Candidates you archive (started, rejected, withdrawn, no response …) appear here.')));
      return head + '<div class="card">' + tb + table + '</div>';
    }
  };
  function NEG(r) { return r === 'Rejected' || r === 'Candidate Withdrew' || r === 'Not Suitable' || r === 'No Response'; }

  var deb = U.debounce(function () { J.app.rerenderView(); }, 140);
  A['arch-q'] = function (el) { f.q = el.value; deb(); };
  A['arch-reason'] = function (el) { f.reason = el.getAttribute('data-r'); J.app.rerenderView(); };
  A['archive-export'] = function (el) { J.io.exportMenu(el, L.scoped(true).filter(function (c) { return c.archived; }), 'archive'); };
})();
