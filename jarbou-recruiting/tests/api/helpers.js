/* Test helpers: a tiny HTTP client that keeps the session cookie and CSRF token like a browser. */
'use strict';
const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:18080';
const ADMIN_USER = process.env.TEST_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'Test-Chef-Pass-2026';

class Client {
  constructor(name) { this.name = name; this.cookie = ''; this.csrf = ''; }
  async req(method, path, body, opts = {}) {
    const headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    if (this.cookie && !opts.noCookie) headers.Cookie = this.cookie;
    if (method !== 'GET' && this.csrf && !opts.noCsrf) headers['X-CSRF-Token'] = this.csrf;
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const m = /jrc_session=([^;]*)/.exec(setCookie);
      if (m) this.cookie = m[1] ? 'jrc_session=' + m[1] : '';
      this.lastSetCookie = setCookie;
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  get(p, o) { return this.req('GET', p, undefined, o); }
  post(p, b, o) { return this.req('POST', p, b === undefined ? {} : b, o); }
  put(p, b, o) { return this.req('PUT', p, b, o); }
  patch(p, b, o) { return this.req('PATCH', p, b, o); }
  del(p, b, o) { return this.req('DELETE', p, b, o); }
  async login(username, password, remember) {
    const r = await this.post('/api/auth/login', { username, password, remember: !!remember });
    if (r.status === 200) this.csrf = r.data.csrfToken;
    return r;
  }
}

async function admin() {
  const c = new Client('admin');
  const r = await c.login(ADMIN_USER, ADMIN_PASS);
  if (r.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(r.data));
  return c;
}

/** Create (or reuse) a user with a role and return a signed-in client whose initial password was changed. */
async function userClient(adminClient, role, suffix) {
  const username = `test.${role}.${suffix || Date.now().toString(36)}`;
  const temp = 'Temp-Pass-12345';
  const finalPw = 'Final-Pass-67890';
  const r = await adminClient.post('/api/users', { username, fullName: `Test ${role} ${suffix || ''}`.trim(), email: '', role, password: temp });
  if (r.status !== 201) throw new Error('create user failed ' + JSON.stringify(r.data));
  const c = new Client(role);
  const l = await c.login(username, temp);
  if (l.status !== 200) throw new Error('login failed ' + JSON.stringify(l.data));
  const p = await c.post('/api/auth/password', { currentPassword: temp, newPassword: finalPw });
  if (p.status !== 200) throw new Error('password change failed ' + JSON.stringify(p.data));
  await c.login(username, finalPw);
  c.user = r.data; c.username = username; c.password = finalPw;
  return c;
}

async function newCandidate(client, extra) {
  const body = Object.assign({ firstName: 'Test', lastName: 'Kandidat ' + Math.random().toString(36).slice(2, 7), project: 'DHL Express', station: 'Hannover', position: 'Driver',
    employmentType: 'Vollzeit', startDate: '2026-12-01', availability: 'ready', stage: 'new', activities: [{ type: 'system', text: 'Candidate created.' }] }, extra || {});
  const r = await client.post('/api/candidates', body);
  if (r.status !== 201) throw new Error('create candidate failed ' + JSON.stringify(r.data));
  return r.data;
}

module.exports = { BASE, Client, admin, userClient, newCandidate, ADMIN_USER, ADMIN_PASS };
