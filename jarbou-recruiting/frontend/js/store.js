/* Central data store (NAS edition).
   PostgreSQL on the server is the single source of truth. This module keeps an in-memory
   working copy for fast screens, synchronises incrementally (only changed candidates) and
   sends every change to the server as field-level changes:

     {path, from, to}  – the server applies a change only if nobody else changed that field
                         in the meantime; otherwise it answers 409 and nothing is overwritten.

   The public interface (all, get, put, settings, saveSettings …) is the same one the pages
   used with the former browser database, so the existing screens keep working unchanged. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config;
  var S = (J.store = {});
  var t = J.t;

  var cache = new Map();   // id -> candidate (working copy used by the UI)
  var bases = new Map();   // id -> last version confirmed by the server (for diffs)
  var settings = null;     // shared settings from the server merged with personal preferences
  var sharedSnapshot = {};
  var prefsSnapshot = '';
  var serverTime = null;
  var live = { mode: 'offline', source: null, lastSync: 0 };

  var PREF_KEYS = ['language', 'activeProject', 'tableColumns', 'pageSize', 'sidebarCollapsed'];
  var SHARED_KEYS = ['companyName', 'defaultProject', 'defaultStation', 'defaultPosition', 'targetPosition', 'standardSalaryReference',
    'standardSalaryBasis', 'expiryWarningDays', 'contractWarningDays', 'idPrefix'];
  var SKIP = { id: 1, version: 1, createdAt: 1, updatedAt: 1, createdBy: 1, updatedBy: 1, documents: 1, contract: 1, onboarding: 1, activities: 1,
    noteLog: 1, attachments: 1, followUps: 1, detail: 1, followUpTime: 1, followUpType: 1, followUpId: 1 };
  var DOC_F = ['status', 'issueDate', 'expiryDate', 'note'];
  var CONTRACT_F = ['status', 'type', 'salary', 'hours', 'startDate', 'endDate', 'signedDate', 'note'];

  /* ------------------------------------------------------------ helpers */
  function norm(v) { return v === undefined || v === null || v === '' || v === false ? null : v; }
  function same(a, b) {
    a = norm(a); b = norm(b);
    if (a === null || b === null) return a === b;
    if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
    return String(a) === String(b);
  }
  function remember(c) {
    cache.set(c.id, c);
    bases.set(c.id, U.clone(c));
  }

  /** Field-level diff between the server version and the edited working copy. */
  function diff(base, cur) {
    var changes = [];
    function cmp(path, a, b) { if (!same(a, b)) changes.push({ path: path, from: norm(a), to: b === undefined ? null : b }); }
    var keys = {};
    Object.keys(base).concat(Object.keys(cur)).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      if (SKIP[k]) return;
      var a = base[k], b = cur[k];
      if ((a !== null && typeof a === 'object') || (b !== null && typeof b === 'object')) return;
      cmp(k, a, b);
    });
    var bd = base.documents || {}, cd = cur.documents || {};
    Object.keys(Object.assign({}, bd, cd)).forEach(function (k) {
      DOC_F.forEach(function (f) { cmp('documents.' + k + '.' + f, (bd[k] || {})[f], (cd[k] || {})[f]); });
    });
    var bc = base.contract || {}, cc = cur.contract || {};
    CONTRACT_F.forEach(function (f) { cmp('contract.' + f, bc[f], cc[f]); });
    var bo = base.onboarding || {}, co = cur.onboarding || {};
    Object.keys(Object.assign({}, bo, co)).forEach(function (k) {
      cmp('onboarding.' + k + '.done', !!(bo[k] || {}).done, !!(co[k] || {}).done);
      cmp('onboarding.' + k + '.date', (bo[k] || {}).date, (co[k] || {}).date);
    });
    function setDiff(a, b) {
      var ai = {}; (a || []).forEach(function (x) { ai[x.id] = 1; });
      var bi = {}; (b || []).forEach(function (x) { bi[x.id] = 1; });
      return { added: (b || []).filter(function (x) { return !ai[x.id]; }), removed: a ? a.filter(function (x) { return !bi[x.id]; }).map(function (x) { return x.id; }) : [] };
    }
    var acts = setDiff(base.activities, cur.activities);
    var notes = setDiff(base.noteLog, cur.noteLog);
    return {
      changes: changes,
      addActivities: acts.added.map(function (a) { return { type: a.type, date: a.date, text: a.text }; }),
      removeActivities: base.activities ? acts.removed : [],
      addNotes: notes.added.map(function (n) { return { text: n.text }; }),
      removeNotes: base.noteLog ? notes.removed : []
    };
  }

  function applySettings(s) {
    var prefs = (J.auth && J.auth.user && J.auth.user.preferences) || {};
    var def = C.defaultSettings();
    var merged = Object.assign({}, def, s);
    merged.language = prefs.language || (settings && settings.language) || J.i18n.lang || 'de';
    merged.activeProject = prefs.activeProject || (settings && settings.activeProject) || 'all';
    if (merged.activeProject !== 'all' && merged.projects.indexOf(merged.activeProject) === -1) merged.activeProject = 'all';
    merged.tableColumns = prefs.tableColumns || (settings && settings.tableColumns) || def.tableColumns;
    merged.pageSize = prefs.pageSize || (settings && settings.pageSize) || def.pageSize;
    settings = merged;
    sharedSnapshot = {};
    SHARED_KEYS.forEach(function (k) { sharedSnapshot[k] = settings[k]; });
    prefsSnapshot = JSON.stringify(pickPrefs());
    if (J.logic && J.logic.bump) J.logic.bump();
  }
  function pickPrefs() {
    var p = {};
    PREF_KEYS.forEach(function (k) { if (settings[k] !== undefined) p[k] = settings[k]; });
    return p;
  }

  /* ------------------------------------------------------------ public API (unchanged interface) */
  S.mode = function () { return 'server'; };
  S.all = function () { return Array.from(cache.values()); };
  S.get = function (id) { return cache.get(id); };
  S.count = function () { return cache.size; };
  S.settings = function () { return settings; };
  S.meta = function () { return null; };
  S.liveMode = function () { return live.mode; };

  S.init = function () {
    return Promise.all([J.api.get('/api/settings'), J.api.get('/api/candidates')]).then(function (r) {
      applySettings(r[0]);
      cache.clear(); bases.clear();
      r[1].items.forEach(remember);
      serverTime = r[1].serverTime;
      live.lastSync = Date.now();
      startLive();
    });
  };

  /** Save a changed candidate (working copy). Resolves with the server version. */
  S.put = function (c) {
    var base = bases.get(c.id);
    if (!base) return S.create(c);
    var d = diff(base, c);
    if (!d.changes.length && !d.addActivities.length && !d.removeActivities.length && !d.addNotes.length && !d.removeNotes.length) return Promise.resolve(c);
    return J.api.patch('/api/candidates/' + encodeURIComponent(c.id), d).then(function (server) {
      remember(server);
      return server;
    }, function (err) {
      // Never keep unsaved local edits after a failed save – show the real server state again.
      if (err.status === 409) {
        return S.reload(c.id).then(function () { S.showConflict(err); throw err; }, function () { throw err; });
      }
      if (base) cache.set(c.id, U.clone(base));
      throw err;
    });
  };

  S.create = function (c) {
    var body = U.clone(c);
    delete body.id;
    return J.api.post('/api/candidates', body).then(function (server) { remember(server); return server; });
  };

  S.remove = function (id) {
    return J.api.del('/api/candidates/' + encodeURIComponent(id)).then(function () { cache.delete(id); bases.delete(id); });
  };

  /** Fetch the full candidate (timeline, notes, attachments, follow-ups). */
  S.loadDetail = function (id) {
    return J.api.get('/api/candidates/' + encodeURIComponent(id)).then(function (full) { remember(full); return full; });
  };
  S.reload = S.loadDetail;
  /** Store a server response (e.g. after uploads or follow-up actions). */
  S.accept = function (server) { remember(server); return server; };

  S.showConflict = function (err) {
    var who = err && err.details && err.details.updatedBy ? err.details.updatedBy : '';
    J.ui.modal({
      title: t('Updated by another user'),
      body: '<div class="banner amber" style="margin:0">' + U.icon('alert') + '<div class="grow">' + U.esc(t('This candidate was updated by another user. Please reload the latest version before saving.')) +
        (who ? '<div class="small mt-8">' + U.esc(t('Last change by {0}.', who)) + '</div>' : '') + '</div></div>' +
        '<p class="small muted-2 mt-12">' + U.esc(t('The latest version is now shown. Your change was not saved – please enter it again if it is still needed.')) + '</p>',
      foot: '<button class="btn primary" data-close>' + U.esc(t('OK')) + '</button>'
    });
    if (J.app) J.app.refresh();
  };

  /* ------------------------------------------------------------ settings */
  S.reloadSettings = function () {
    return J.api.get('/api/settings').then(function (s) { applySettings(s); return settings; });
  };
  S.acceptSettings = function (s) { applySettings(s); return settings; };

  /** Persist personal preferences (language, project scope, columns …) and – for admins – changed shared settings. */
  S.saveSettings = function () {
    var jobs = [];
    var prefs = pickPrefs();
    var pj = JSON.stringify(prefs);
    if (pj !== prefsSnapshot) {
      prefsSnapshot = pj;
      if (J.auth && J.auth.user) J.auth.user.preferences = prefs;
      jobs.push(J.api.put('/api/me/preferences', prefs));
    }
    var shared = {};
    SHARED_KEYS.forEach(function (k) { if (!same(settings[k], sharedSnapshot[k])) shared[k] = settings[k]; });
    if (Object.keys(shared).length && J.auth.can('settings.write')) {
      jobs.push(J.api.put('/api/settings', shared).then(function (s) { applySettings(s); }));
    }
    return Promise.all(jobs);
  };

  /* ------------------------------------------------------------ live updates */
  var syncing = null;
  var pendingSync = false;
  S.sync = function (full) {
    if (syncing) { pendingSync = true; return syncing; }
    var since = serverTime && !full ? new Date(new Date(serverTime).getTime() - 30000).toISOString() : '';
    syncing = J.api.get('/api/candidates' + (since ? '?since=' + encodeURIComponent(since) : '')).then(function (r) {
      var changed = 0;
      if (r.full) {
        var seen = {};
        r.items.forEach(function (c) { seen[c.id] = 1; });
        Array.from(cache.keys()).forEach(function (id) { if (!seen[id]) { cache.delete(id); bases.delete(id); changed++; } });
      }
      r.items.forEach(function (item) {
        var old = cache.get(item.id);
        if (old && old.version === item.version && old.updatedAt === item.updatedAt) return;
        if (old && old.detail && J.profile && J.profile.currentId() === item.id) {
          changed++;
          S.loadDetail(item.id).then(function () { J.app.refresh(); });
          return;
        }
        remember(item);
        changed++;
      });
      (r.deleted || []).forEach(function (id) { if (cache.has(id)) { cache.delete(id); bases.delete(id); changed++; } });
      serverTime = r.serverTime;
      live.lastSync = Date.now();
      if (changed && J.app) J.app.refresh();
      return changed;
    }).finally(function () {
      syncing = null;
      if (pendingSync) { pendingSync = false; S.sync(); }
    });
    return syncing;
  };

  var syncSoon = U.debounce(function () { S.sync().catch(function () {}); }, 250);
  var settingsSoon = U.debounce(function () {
    S.reloadSettings().then(function () { if (J.app) J.app.refresh(); }).catch(function () {});
  }, 250);

  function startLive() {
    if (window.EventSource && !live.source) {
      var es = new EventSource('/api/events');
      live.source = es;
      es.addEventListener('open', function () { live.mode = 'live'; indicator(); syncSoon(); });
      es.addEventListener('error', function () { live.mode = 'polling'; indicator(); });
      es.addEventListener('candidates', function (e) {
        var data = {};
        try { data = JSON.parse(e.data); } catch (x) { /* ignore */ }
        if (data.reload) S.sync(true).catch(function () {}); else syncSoon();
      });
      es.addEventListener('settings', settingsSoon);
      es.addEventListener('session', function () { J.api.get('/api/auth/me', { noRedirect: true }).catch(function () { J.api.toLogin(true); }); });
    }
    // Fallback / safety net: re-sync every 60 s and when the window becomes visible again.
    setInterval(function () { if (!document.hidden) S.sync().catch(function () {}); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - live.lastSync > 5000) S.sync().catch(function () {}); });
  }
  function indicator() {
    var el = document.getElementById('live-indicator');
    if (!el) return;
    el.className = 'live-dot ' + live.mode;
    el.setAttribute('data-tip', live.mode === 'live' ? t('Live – changes from colleagues appear automatically') : t('Reconnecting… data is refreshed every minute'));
  }
  S.indicator = indicator;
})();
