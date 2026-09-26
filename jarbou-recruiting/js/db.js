/* Local persistence.
   Primary: IndexedDB (database "jarbou-recruiting", stores "candidates" + "meta").
   Fallback: localStorage (only if IndexedDB is unavailable, e.g. some private windows).
   All data is kept in memory for fast rendering and written through on every change.
   Nothing is ever sent over the network. */
(function () {
  'use strict';
  var J = window.J, U = J.util, C = J.config;
  var DB_NAME = 'jarbou-recruiting';
  var DB_VERSION = 1;
  var LS_KEY = 'jarbou-recruiting-fallback-v1';

  var db = null;          // IDBDatabase
  var mode = 'indexeddb'; // or 'localstorage' / 'memory'
  var cache = { candidates: new Map(), meta: {} };

  var S = (J.store = {});

  function openIDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('IndexedDB not available'));
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { return reject(e); }
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('candidates')) d.createObjectStore('candidates', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('Database blocked by another open tab')); };
    });
  }

  function idbAll(storeName) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readonly');
      var req = tx.objectStore(storeName).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbWrite(fn) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(['candidates', 'meta'], 'readwrite');
      fn(tx.objectStore('candidates'), tx.objectStore('meta'));
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Transaction aborted')); };
    });
  }

  function lsSave() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ candidates: Array.from(cache.candidates.values()), meta: cache.meta }));
      return Promise.resolve();
    } catch (e) { return Promise.reject(e); }
  }

  function persistErr(e) {
    console.error(e);
    if (J.ui && J.ui.toast) J.ui.toast(J.t('Could not save to local storage: {0}', e && e.message ? e.message : e), 'error');
    throw e;
  }

  S.mode = function () { return mode; };

  S.init = function () {
    return openIDB().then(function (d) {
      db = d;
      db.onversionchange = function () { db.close(); alert(J.t('The recruiting database was updated in another tab. Please reload this page.')); };
      return Promise.all([idbAll('candidates'), idbAll('meta')]);
    }).then(function (res) {
      res[0].forEach(function (c) { cache.candidates.set(c.id, c); });
      res[1].forEach(function (m) { cache.meta[m.key] = m.value; });
    }).catch(function (err) {
      console.warn('IndexedDB unavailable, falling back to localStorage', err);
      mode = 'localstorage';
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) {
          var data = JSON.parse(raw);
          (data.candidates || []).forEach(function (c) { cache.candidates.set(c.id, c); });
          cache.meta = data.meta || {};
        }
      } catch (e) { mode = 'memory'; }
    }).then(function () {
      // Ask the browser not to evict our storage under pressure.
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(function (granted) { cache.persisted = granted; }).catch(function () {});
      }
      var first = !cache.meta.settings;
      if (first) {
        var settings = C.defaultSettings();
        var seeds = C.seedCandidates(settings);
        settings.nextNumber = seeds.length + 1;
        cache.meta.settings = settings;
        cache.meta.createdAt = new Date().toISOString();
        seeds.forEach(function (c) { cache.candidates.set(c.id, c); });
        return S.saveMeta('settings', settings).then(function () {
          return S.saveMeta('createdAt', cache.meta.createdAt);
        }).then(function () { return S.putMany(seeds); });
      }
      S.migrateSettings();
    });
  };

  /** Fill in settings keys added in newer versions without touching user data. */
  S.migrateSettings = function () {
    var def = C.defaultSettings();
    var s = cache.meta.settings;
    var changed = false;
    Object.keys(def).forEach(function (k) { if (s[k] === undefined) { s[k] = def[k]; changed = true; } });
    (s.documents || []).forEach(function (d) {
      var def0 = C.DEFAULT_DOCUMENTS.filter(function (x) { return x.key === d.key; })[0];
      if (def0 && !d.short && d.label === def0.label) { d.short = def0.short; changed = true; }
    });
    if (changed) S.saveMeta('settings', s);
  };

  S.all = function () { return Array.from(cache.candidates.values()); };
  S.get = function (id) { return cache.candidates.get(id); };
  S.count = function () { return cache.candidates.size; };
  S.meta = function (key) { return cache.meta[key]; };
  S.settings = function () { return cache.meta.settings; };

  S.put = function (c) {
    cache.candidates.set(c.id, c);
    if (mode === 'indexeddb') return idbWrite(function (cs) { cs.put(c); }).catch(persistErr);
    if (mode === 'localstorage') return lsSave().catch(persistErr);
    return Promise.resolve();
  };
  S.putMany = function (list) {
    list.forEach(function (c) { cache.candidates.set(c.id, c); });
    if (mode === 'indexeddb') return idbWrite(function (cs) { list.forEach(function (c) { cs.put(c); }); }).catch(persistErr);
    if (mode === 'localstorage') return lsSave().catch(persistErr);
    return Promise.resolve();
  };
  S.remove = function (id) {
    cache.candidates.delete(id);
    if (mode === 'indexeddb') return idbWrite(function (cs) { cs.delete(id); }).catch(persistErr);
    if (mode === 'localstorage') return lsSave().catch(persistErr);
    return Promise.resolve();
  };
  S.saveMeta = function (key, value) {
    cache.meta[key] = value;
    if (mode === 'indexeddb') return idbWrite(function (cs, ms) { ms.put({ key: key, value: value }); }).catch(persistErr);
    if (mode === 'localstorage') return lsSave().catch(persistErr);
    return Promise.resolve();
  };
  S.saveSettings = function () { return S.saveMeta('settings', cache.meta.settings); };

  /** Replace the entire database (used by Restore Backup). */
  S.replaceAll = function (candidates, meta) {
    cache.candidates = new Map();
    candidates.forEach(function (c) { cache.candidates.set(c.id, c); });
    var keepBackup = cache.meta.lastBackup;
    cache.meta = meta || {};
    if (!cache.meta.lastBackup && keepBackup) cache.meta.lastBackup = keepBackup;
    if (mode === 'indexeddb') {
      return idbWrite(function (cs, ms) {
        cs.clear(); ms.clear();
        candidates.forEach(function (c) { cs.put(c); });
        Object.keys(cache.meta).forEach(function (k) { ms.put({ key: k, value: cache.meta[k] }); });
      }).catch(persistErr);
    }
    if (mode === 'localstorage') return lsSave().catch(persistErr);
    return Promise.resolve();
  };

  S.exportAll = function () {
    return {
      app: C.APP_ID,
      schemaVersion: C.SCHEMA_VERSION,
      appVersion: C.APP_VERSION,
      exportedAt: new Date().toISOString(),
      candidateCount: cache.candidates.size,
      meta: {
        settings: cache.meta.settings,
        createdAt: cache.meta.createdAt || ''
      },
      candidates: S.all()
    };
  };

  /** Next free candidate ID, e.g. JRB-0003. */
  S.nextId = function () {
    var s = cache.meta.settings;
    var n = Math.max(1, s.nextNumber || 1);
    var id;
    do { id = (s.idPrefix || 'JRB') + '-' + U.pad(n, 4); n++; } while (cache.candidates.has(id));
    s.nextNumber = n;
    return id;
  };
})();
