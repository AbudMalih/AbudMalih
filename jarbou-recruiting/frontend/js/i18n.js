/* Internationalisation: German (default), English, Arabic (right-to-left).
   Texts in the code are written in English and passed through J.t().
   Dictionaries live in js/lang/de.js and js/lang/ar.js, keyed by the English text.
   Placeholders: J.t('Starts in {0} days', 5). Unknown keys fall back to English. */
(function () {
  'use strict';
  var J = window.J;
  var I = (J.i18n = { dict: { de: {}, ar: {}, en: {} }, lang: 'de', missing: {} });

  I.LANGS = [
    { key: 'de', label: 'Deutsch', short: 'DE', locale: 'de-DE' },
    { key: 'en', label: 'English', short: 'EN', locale: 'en-GB' },
    { key: 'ar', label: 'العربية', short: 'AR', locale: 'ar-u-nu-latn', rtl: true }
  ];
  var LS_KEY = 'jarbou-recruiting-lang';

  I.info = function (k) { return I.LANGS.filter(function (l) { return l.key === (k || I.lang); })[0] || I.LANGS[0]; };
  I.locale = function () { return I.info().locale; };
  I.isRTL = function () { return !!I.info().rtl; };

  var has = Object.prototype.hasOwnProperty;
  J.t = function (key) {
    if (key === null || key === undefined) return '';
    var s = String(key);
    var out = s;
    if (I.lang !== 'en' && s) {
      var d = I.dict[I.lang];
      if (has.call(d, s)) out = d[s];
      else if (/[A-Za-z]/.test(s)) I.missing[s] = (I.missing[s] || 0) + 1;
    }
    if (arguments.length > 1) {
      var a = arguments;
      out = out.replace(/\{(\d+)\}/g, function (m, n) { var v = a[+n + 1]; return v === null || v === undefined ? '' : v; });
    }
    return out;
  };

  /** Apply language to <html> (lang + dir) and remember it. */
  I.set = function (lang) {
    I.lang = I.info(lang).key;
    var html = document.documentElement;
    html.lang = I.lang;
    html.dir = I.isRTL() ? 'rtl' : 'ltr';
    try { localStorage.setItem(LS_KEY, I.lang); } catch (e) { /* ignore */ }
    I.applyStatic(document);
  };

  /** Translate static markup: data-i18n (text) and data-i18n-attr="placeholder:Key;title:Key". */
  I.applyStatic = function (root) {
    root.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = J.t(el.getAttribute('data-i18n')); });
    root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':');
        if (p.length === 2) el.setAttribute(p[0].trim(), J.t(p[1].trim()));
      });
    });
  };

  // Use the last chosen language immediately (before the database has loaded).
  var initial = 'de';
  try { initial = localStorage.getItem(LS_KEY) || 'de'; } catch (e) { /* ignore */ }
  I.lang = I.info(initial).key;
  document.documentElement.lang = I.lang;
  document.documentElement.dir = I.isRTL() ? 'rtl' : 'ltr';
})();
