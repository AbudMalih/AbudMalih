/* HTTP client for the central server API: JSON, session cookie, CSRF header,
   and translated, user-friendly error messages. */
(function () {
  'use strict';
  var J = window.J, t = J.t;
  var api = (J.api = { csrf: '' });

  function ApiError(status, code, message, details) {
    var e = new Error(message || code);
    e.status = status; e.code = code; e.details = details;
    return e;
  }

  /** Translated message for an API error (shown in toasts/dialogs). */
  api.message = function (err) {
    if (!err) return t('Unable to save. Please try again.');
    switch (err.code) {
      case 'network': return t('Connection to the server failed. Please check your network connection.');
      case 'unauthorized': case 'session_expired': return t('Your session has expired. Please sign in again.');
      case 'forbidden': return t('You do not have permission for this action.');
      case 'csrf': return t('Security token missing or invalid. Please reload the page.');
      case 'conflict': return err.message && err.message.indexOf('updated by another user') === -1 ? t(err.message) : t('This candidate was updated by another user. Please reload the latest version before saving.');
      case 'db_unavailable': return t('Database temporarily unavailable. Please try again in a moment.');
      case 'maintenance': return t('A backup is being restored. Please wait a moment.');
      case 'rate_limited': return t(err.message);
      case 'too_large': return t('The request is too large.');
      case 'internal': return t('An unexpected error occurred. Please try again.');
      default: return err.message ? t(err.message) : t('Unable to save. Please try again.');
    }
  };

  function toLogin(expired) {
    var target = 'login.html' + (expired ? '?expired=1' : '');
    if (location.pathname.indexOf('login.html') === -1) location.href = target;
  }
  api.toLogin = toLogin;

  api.request = function (method, url, body, opts) {
    opts = opts || {};
    var headers = { Accept: 'application/json' };
    var payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    if (method !== 'GET' && api.csrf) headers['X-CSRF-Token'] = api.csrf;
    return fetch(url, { method: method, headers: headers, body: payload, credentials: 'same-origin', cache: 'no-store' })
      .catch(function () { throw ApiError(0, 'network', 'Network error'); })
      .then(function (res) {
        var ct = res.headers.get('content-type') || '';
        var parse = ct.indexOf('application/json') !== -1 ? res.json().catch(function () { return {}; }) : Promise.resolve({});
        return parse.then(function (data) {
          if (res.ok) return data;
          var err = ApiError(res.status, data.error || (res.status === 401 ? 'unauthorized' : res.status === 403 ? 'forbidden' : 'error'), data.message || res.statusText, data.details);
          if (res.status === 401 && !opts.noRedirect) toLogin(err.code === 'session_expired');
          if (err.code === 'password_change_required' && J.app && J.app.forcePasswordChange) J.app.forcePasswordChange();
          throw err;
        });
      });
  };
  api.get = function (url, opts) { return api.request('GET', url, undefined, opts); };
  api.post = function (url, body, opts) { return api.request('POST', url, body === undefined ? {} : body, opts); };
  api.put = function (url, body) { return api.request('PUT', url, body); };
  api.patch = function (url, body) { return api.request('PATCH', url, body); };
  api.del = function (url, body) { return api.request('DELETE', url, body); };
})();
