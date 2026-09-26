/* Typed HTTP errors. The frontend maps `error` codes to translated, professional messages. */
'use strict';

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  HttpError,
  badRequest: (message, details) => new HttpError(400, 'validation', message || 'Invalid input', details),
  unauthorized: (message) => new HttpError(401, 'unauthorized', message || 'Authentication required'),
  forbidden: (message) => new HttpError(403, 'forbidden', message || 'You do not have permission for this action'),
  notFound: (message) => new HttpError(404, 'not_found', message || 'Not found'),
  conflict: (message, details) => new HttpError(409, 'conflict', message || 'This record was updated by another user', details),
  tooMany: (message) => new HttpError(429, 'rate_limited', message || 'Too many attempts. Please wait and try again.'),
  /** Wrap async route handlers so rejected promises reach the error middleware. */
  wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
};
