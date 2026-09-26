/* Recruitment pipeline (Kanban) with drag & drop and a "Move to stage" control. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config, S = J.store, L = J.logic, ui = J.ui, A = J.actions;
  var esc = U.esc, icon = U.icon, t = J.t;
  var f = { q: '', station: '', recruiter: '' };
  var expanded = {};
  var PER_COL = 40;

  A.noop = function () {};

  function card(c) {
    var i = L.info(c);
    var missing = i.docs.outstanding.filter(function (k) { return k !== 'contract'; }).length;
    return '<div class="kcard" draggable="true" data-id="' + esc(c.id) + '" data-action="open-candidate" tabindex="0" aria-label="' + esc(U.fullName(c)) + '">' +
      '<div class="kname"><span>' + esc(U.fullName(c)) + '</span>' + (i.topPriority === 'high' ? '<span data-tip="' + esc(i.warnings[0].label) + '" style="color:var(--red)">' + icon('alert', 'sm') + '</span>' : '') + '</div>' +
      '<div class="kmeta">' +
      '<div>' + icon('briefcase', 'sm') + esc(c.position || '—') + (c.station ? ' · ' + esc(c.station) : '') + '</div>' +
      '<div>' + icon('calendar', 'sm') + (c.startDate ? U.fmtDate(c.startDate) + (i.daysToStart !== null && i.daysToStart >= 0 && i.daysToStart <= 30 ? ' <span class="muted">(' + U.relDays(i.daysToStart) + ')</span>' : '') : '<span class="muted">' + esc(t('Start pending')) + '</span>') + '</div>' +
      '<div>' + icon('phone', 'sm') + (c.phone ? esc(c.phone) : '<span class="muted">' + esc(t('Phone pending')) + '</span>') + '</div>' +
      '<div>' + icon('user', 'sm') + (c.recruiter ? esc(c.recruiter) : '<span class="muted">' + esc(t('Unassigned')) + '</span>') + '</div>' +
      '</div>' +
      '<div class="kfoot">' + (missing ? ui.badge(missing === 1 ? t('{0} doc missing', missing) : t('{0} docs missing', missing), 'red', 'file') : ui.badge(t('Docs complete'), 'green', 'check')) +
      '<select data-action="noop" data-change="pipe-move" data-id="' + esc(c.id) + '" aria-label="' + esc(t('Move to stage')) + '">' + C.STAGES.map(function (s) { return '<option value="' + s.key + '"' + (s.key === c.stage ? ' selected' : '') + '>' + esc(s.key === c.stage ? t('Move…') : '→ ' + t(s.label)) + '</option>'; }).join('') + '</select></div>' +
      '<div style="margin-top:6px">' + ui.overallBadge(i, true) + '</div>' +
      '</div>';
  }

  J.views.pipeline = {
    render: function () {
      var s = S.settings();
      var list = L.scoped().filter(function (c) {
        if (f.q && !L.matches(c, f.q)) return false;
        if (f.station && c.station !== f.station) return false;
        if (f.recruiter && (f.recruiter === '__none' ? c.recruiter : c.recruiter !== f.recruiter)) return false;
        return true;
      });
      var byStage = {};
      C.STAGES.forEach(function (st) { byStage[st.key] = []; });
      list.forEach(function (c) { (byStage[c.stage] || byStage.new).push(c); });
      Object.keys(byStage).forEach(function (k) {
        byStage[k].sort(function (a, b) { return (a.startDate || '9999').localeCompare(b.startDate || '9999') || U.fullName(a).localeCompare(U.fullName(b)); });
      });

      var head = '<div class="page-head"><div><h1>' + esc(t('Recruitment Pipeline')) + '</h1><div class="sub">' + esc(t('Drag cards between stages, or use the "Move…" menu on each card. Moving to Ready does not override administrative readiness.')) + '</div></div>' +
        '<div class="actions"><button class="btn primary" data-action="add-candidate">' + icon('plus') + esc(t('Add Candidate')) + '</button></div></div>';
      var tb = '<div class="card mb-16"><div class="toolbar" style="border:0">' +
        '<div class="search-input">' + icon('search') + '<input type="search" id="pipe-q" placeholder="' + esc(t('Filter cards…')) + '" value="' + esc(f.q) + '" data-input="pipe-q" aria-label="' + esc(t('Filter pipeline')) + '"></div>' +
        '<select class="sm" data-change="pipe-filter" data-k="station" aria-label="' + esc(t('Station')) + '">' + ui.options(s.stations, f.station, { blank: 'All stations' }) + '</select>' +
        '<select class="sm" data-change="pipe-filter" data-k="recruiter" aria-label="' + esc(t('Recruiter')) + '">' + ui.options([{ key: '__none', label: 'Unassigned' }].concat(s.recruiters), f.recruiter, { blank: 'All recruiters' }) + '</select>' +
        '<div style="flex:1"></div><span class="result-count">' + esc(list.length === 1 ? t('{0} candidate', list.length) : t('{0} candidates', list.length)) + '</span></div></div>';

      var board = '<div class="kanban" data-keep-scroll="kanban">' + C.STAGES.map(function (st) {
        var items = byStage[st.key];
        var lim = expanded[st.key] ? items.length : PER_COL;
        return '<section class="kcol" data-stage="' + st.key + '" aria-label="' + esc(t(st.label)) + '">' +
          '<div class="kcol-head"><span><span class="dot" style="background:' + st.color + '"></span>' + esc(t(st.label)) + '</span><span class="n">' + items.length + '</span></div>' +
          '<div class="kcol-body" data-keep-scroll="kcol-' + st.key + '">' + (items.length ? items.slice(0, lim).map(card).join('') : '<div class="small muted" style="text-align:center;padding:18px 6px">' + esc(t('Drop candidates here')) + '</div>') +
          (items.length > lim ? '<button class="btn sm ghost" data-action="pipe-more" data-k="' + st.key + '">' + esc(t('Show {0} more', items.length - lim)) + '</button>' : '') + '</div></section>';
      }).join('') + '</div>';
      return head + tb + board;
    },
    mount: function (root) {
      var dragId = null;
      root.querySelectorAll('.kcard').forEach(function (el) {
        el.addEventListener('dragstart', function (e) {
          dragId = el.getAttribute('data-id');
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* ignore */ }
          el.classList.add('dragging');
        });
        el.addEventListener('dragend', function () { el.classList.remove('dragging'); root.querySelectorAll('.drop-target').forEach(function (x) { x.classList.remove('drop-target'); }); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === el) J.profile.open(dragId = el.getAttribute('data-id')); });
      });
      root.querySelectorAll('.kcol').forEach(function (col) {
        col.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('drop-target'); });
        col.addEventListener('dragleave', function (e) { if (!col.contains(e.relatedTarget)) col.classList.remove('drop-target'); });
        col.addEventListener('drop', function (e) {
          e.preventDefault();
          col.classList.remove('drop-target');
          var id = dragId || e.dataTransfer.getData('text/plain');
          if (id) J.app.moveStage(id, col.getAttribute('data-stage'));
          dragId = null;
        });
      });
    }
  };

  var deb = U.debounce(function () { J.app.rerenderView(); }, 140);
  A['pipe-q'] = function (el) { f.q = el.value; deb(); };
  A['pipe-filter'] = function (el) { f[el.getAttribute('data-k')] = el.value; J.app.rerenderView(); };
  A['pipe-more'] = function (el) { expanded[el.getAttribute('data-k')] = true; J.app.rerenderView(); };
  A['pipe-move'] = function (el) { J.app.moveStage(el.getAttribute('data-id'), el.value); };
})();
