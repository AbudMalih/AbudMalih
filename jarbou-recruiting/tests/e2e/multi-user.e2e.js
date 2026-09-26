/* End-to-end multi-user test with three real browser sessions (Admin, Recruiter, Viewer).
   Run against a running stack:  TEST_BASE_URL=http://127.0.0.1:18080 TEST_ADMIN_PASS=… node tests/e2e/multi-user.e2e.js
   Requires Playwright (chromium). */
'use strict';
const { chromium } = require('playwright');
const { BASE, admin, userClient } = require('../api/helpers');
const OUT = process.env.E2E_OUT || '/tmp/jrc-e2e';
require('fs').mkdirSync(OUT, { recursive: true });

let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) { passed++; console.log('  ✓ ' + msg); } else { failed++; console.log('  ✗ ' + msg); } }
async function waitFor(fn, ms) { const end = Date.now() + (ms || 10000); while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* retry */ } await new Promise((r) => setTimeout(r, 250)); } return false; }

async function session(browser, username, password, label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(label + ': ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/401|403|409|400/.test(m.text())) page.errors.push(label + ': ' + m.text()); });
  await page.goto(BASE + '/login.html');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('#login-btn');
  await page.waitForSelector('.kpi', { timeout: 15000 });
  await page.evaluate(() => J.app.setLanguage('en'));
  return page;
}

(async () => {
  const A = await admin();
  const s = Date.now().toString(36);
  const R = await userClient(A, 'recruiter', 'e2e' + s);
  const V = await userClient(A, 'viewer', 'e2e' + s);
  const browser = await chromium.launch();
  const pa = await session(browser, process.env.TEST_ADMIN_USER || 'admin', process.env.TEST_ADMIN_PASS, 'admin');
  const pr = await session(browser, R.username, R.password, 'recruiter');
  const pv = await session(browser, V.username, V.password, 'viewer');

  console.log('Recruiter creates a candidate → admin sees it live');
  const last = 'E2E-' + s;
  await pr.click('.topbar [data-action="add-candidate"]');
  await pr.fill('#f-firstName', 'Maria');
  await pr.fill('#f-lastName', last);
  await pr.fill('#f-phone', '+49 170 5550000');
  await pr.selectOption('#f-station', 'Hannover');
  await pr.fill('#f-startDate', '2026-12-01');
  await pr.click('#cand-save');
  await pr.waitForSelector('.drawer');
  const id = await waitFor(async () => (await pr.evaluate(() => J.profile.currentId())));
  const candId = await pr.evaluate(() => J.profile.currentId());
  ok(/^[A-Z]+-\d+$/.test(candId || ''), 'server assigned id ' + candId);
  await pa.goto(BASE + '/#/candidates');
  ok(await waitFor(() => pa.evaluate((n) => J.store.all().some((c) => c.lastName === n), last), 10000), 'admin sees the new candidate without reloading (live update)');

  console.log('Admin updates a document → recruiter sees it');
  await pa.evaluate((cid) => J.profile.open(cid, 'documents'), candId);
  await pa.waitForSelector('select[data-doc="fuehrungszeugnis"]');
  await pa.selectOption('select[data-doc="fuehrungszeugnis"]', 'received');
  ok(await waitFor(() => pr.evaluate((cid) => J.store.get(cid).documents.fuehrungszeugnis.status === 'received', candId), 10000), 'recruiter sees "received" within seconds');
  await pr.evaluate((cid) => J.profile.open(cid, 'documents'), candId);
  ok(await waitFor(async () => (await pr.locator('select[data-doc="fuehrungszeugnis"]').inputValue()) === 'received'), 'recruiter profile shows the admin change');

  console.log('Viewer sees but cannot edit');
  ok(await waitFor(() => pv.evaluate((cid) => !!J.store.get(cid), candId), 10000), 'viewer sees the candidate');
  await pv.evaluate((cid) => J.profile.open(cid), candId);
  await pv.waitForSelector('.drawer');
  ok(!(await pv.locator('.drawer [data-action="edit-candidate"]').isVisible().catch(() => false)), 'no Edit button for viewer');
  await pv.evaluate(() => J.profile.open(J.profile.currentId(), 'documents'));
  ok(await pv.locator('select[data-doc="fuehrungszeugnis"]').isDisabled(), 'document status disabled for viewer');
  const vPatch = await pv.evaluate((cid) => fetch('/api/candidates/' + cid, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': J.api.csrf }, body: JSON.stringify({ changes: [{ path: 'phone', from: '+49 170 5550000', to: 'hack' }] }) }).then((r) => r.status), candId);
  ok(vPatch === 403, 'viewer API write rejected by server (403)');
  ok(!(await pv.locator('.topbar [data-action="add-candidate"]').isVisible()), 'no Add Candidate button for viewer');

  console.log('Permissions for users & settings');
  const rUsers = await pr.evaluate(() => fetch('/api/users').then((r) => r.status));
  ok(rUsers === 403, 'recruiter cannot list users (403)');
  const aUsers = await pa.evaluate(() => fetch('/api/users').then((r) => r.status));
  ok(aUsers === 200, 'admin can manage users');
  await pr.goto(BASE + '/#/settings'); await pr.waitForTimeout(500);
  ok(!(await pr.locator('text=Create user').count()), 'recruiter settings page has no user management');
  await pa.goto(BASE + '/#/settings'); await pa.waitForTimeout(800);
  ok((await pa.locator('text=Create user').count()) > 0, 'admin settings page has user management');
  await pa.screenshot({ path: OUT + '/admin-settings.png', fullPage: true });
  ok(!(await pr.evaluate(() => [...document.querySelectorAll('#nav a')].some((a) => a.getAttribute('href') === '#/audit'))), 'audit log hidden for recruiter');
  ok(await pa.evaluate(() => [...document.querySelectorAll('#nav a')].some((a) => a.getAttribute('href') === '#/audit')), 'audit log visible for admin');

  console.log('Conflict: two users edit the same field');
  await pa.evaluate((cid) => J.form.open(cid), candId);
  await pr.evaluate((cid) => J.form.open(cid), candId);
  await pa.fill('#f-phone', '+49 170 1111111');
  await pr.fill('#f-phone', '+49 170 2222222');
  await pa.click('#cand-save');
  await waitFor(() => pr.evaluate((cid) => J.store.get(cid).phone === '+49 170 1111111', candId), 8000);
  await pr.click('#cand-save');
  ok(await waitFor(async () => (await pr.locator('.modal', { hasText: 'updated by another user' }).count()) > 0, 6000), 'second user gets the conflict warning');
  await pr.screenshot({ path: OUT + '/conflict.png' });
  await pr.click('.modal .modal-foot .btn.primary:has-text("OK")').catch(() => {});
  for (let k = 0; k < 3; k++) { if (await pr.locator('.modal').count()) await pr.keyboard.press('Escape'); }
  for (let k = 0; k < 3; k++) { if (await pa.locator('.modal').count()) await pa.keyboard.press('Escape'); }
  const phone = (await A.get('/api/candidates/' + candId)).data.phone;
  ok(phone === '+49 170 1111111', 'first user\'s value kept, nothing silently overwritten (' + phone + ')');

  console.log('Audit log shows who changed what');
  await pa.goto(BASE + '/#/audit'); await pa.waitForTimeout(1200);
  ok((await pa.locator('text=' + R.user.fullName).count()) > 0, 'audit log lists the recruiter');
  await pa.screenshot({ path: OUT + '/audit.png', fullPage: true });

  console.log('German and Arabic');
  await pr.evaluate(() => { J.i18n.missing = {}; J.logic.bump(); return J.app.setLanguage('de'); });
  for (const r of ['dashboard', 'candidates', 'pipeline', 'onboarding', 'documents', 'starting', 'reports', 'archive', 'settings']) { await pr.goto(BASE + '/#/' + r); await pr.waitForTimeout(250); }
  await pr.evaluate((cid) => J.profile.open(cid), candId); await pr.waitForTimeout(600);
  for (const tb of ['documents', 'contract', 'onboarding', 'activity', 'notes']) { await pr.click(`.tab[data-tab="${tb}"]`); await pr.waitForTimeout(150); }
  await pr.keyboard.press('Escape');
  await pa.evaluate(() => { J.i18n.missing = {}; J.logic.bump(); return J.app.setLanguage('ar'); });
  for (const r of ['dashboard', 'candidates', 'reports', 'settings', 'audit']) { await pa.goto(BASE + '/#/' + r); await pa.waitForTimeout(400); }
  ok(await pa.evaluate(() => document.documentElement.dir === 'rtl'), 'Arabic uses right-to-left layout');
  await pa.goto(BASE + '/#/dashboard'); await pa.waitForTimeout(600);
  await pa.screenshot({ path: OUT + '/arabic-dashboard.png', fullPage: true });
  const missDe = await pr.evaluate(() => Object.keys(J.i18n.missing));
  const missAr = await pa.evaluate(() => Object.keys(J.i18n.missing));
  const ignore = (k) => /^(Hannover|Kassel|Haiger|Bremen|Driver|DHL Express|Maria|E2E|Test|Riber|Isso|Abdalrazaq|Al Shaer|Fahrerkarte|Leipzig)/.test(k) || k.includes(s);
  const md = missDe.filter((k) => !ignore(k)), ma = missAr.filter((k) => !ignore(k));
  ok(md.length === 0, 'German: no untranslated texts' + (md.length ? ' – ' + md.slice(0, 15).join(' | ') : ''));
  ok(ma.length === 0, 'Arabic: no untranslated texts' + (ma.length ? ' – ' + ma.slice(0, 15).join(' | ') : ''));
  await pa.evaluate(() => J.app.setLanguage('de'));

  console.log('Export and print');
  await pr.goto(BASE + '/#/candidates'); await pr.waitForTimeout(400);
  const [dl] = await Promise.all([pr.waitForEvent('download', { timeout: 8000 }), (async () => { await pr.click('[data-action="cand-export"]'); await pr.click('.menu button:has-text("CSV")'); })()]);
  ok(/\.csv$/.test(dl.suggestedFilename()), 'CSV export downloaded (' + dl.suggestedFilename() + ')');
  await pr.evaluate((cid) => { window.print = () => {}; J.print.candidate(cid); }, candId);
  await pr.waitForTimeout(400);
  ok((await pr.locator('#print-root').innerText()).includes(last), 'printable candidate summary rendered');

  console.log('Sign out');
  await pv.keyboard.press('Escape');
  await pv.click('#user-btn'); await pv.click('.menu button:has-text("Sign out"), .menu button:has-text("Abmelden")');
  ok(await waitFor(() => pv.url().includes('login.html')), 'viewer signed out');
  ok((await pv.evaluate(() => fetch('/api/candidates').then((r) => r.status))) === 401, 'API rejects after sign out (401)');

  const errors = [].concat(pa.errors, pr.errors, pv.errors);
  ok(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  // cleanup
  await A.patch('/api/candidates/' + candId, { changes: [{ path: 'archived', from: false, to: true }] });
  await A.del('/api/candidates/' + candId);
  await A.patch('/api/users/' + R.user.id, { active: false });
  await A.patch('/api/users/' + V.user.id, { active: false });
  await browser.close();
  console.log(`\nE2E RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
