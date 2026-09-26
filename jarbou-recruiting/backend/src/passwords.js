/* Password hashing with Argon2id (memory-hard). Hashes never leave this module's callers' DB rows. */
'use strict';
const argon2 = require('argon2');
const config = require('./config');

const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

async function hash(password) { return argon2.hash(password, OPTIONS); }
async function verify(hashValue, password) {
  try { return await argon2.verify(hashValue, password); } catch (e) { return false; }
}

/** Returns an error message (English key) or null when the password is acceptable. */
function policyError(password, username) {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < config.passwordMinLength) return `Password must be at least ${config.passwordMinLength} characters.`;
  if (password.length > 200) return 'Password is too long.';
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain letters and numbers.';
  if (username && password.toLowerCase().includes(String(username).toLowerCase())) return 'Password must not contain the username.';
  if (/^(password|passwort|jarbou|admin|123456)/i.test(password)) return 'Password is too easy to guess.';
  return null;
}

// A dummy hash used to keep login timing similar for unknown usernames.
let dummy = null;
async function dummyVerify(password) {
  if (!dummy) dummy = await hash('dummy-password-for-timing-1');
  await verify(dummy, password || 'x');
  return false;
}

module.exports = { hash, verify, policyError, dummyVerify };
