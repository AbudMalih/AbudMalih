#!/usr/bin/env node
/* Administration commands (run inside the app container):
     docker compose exec app node src/cli.js <command>

   create-admin <username> "<Full Name>" [email]   create an administrator (asks for the password)
   reset-password <username>                       set a new password (asks), user must change it at next sign-in
   list-users                                      show users (no passwords)
   migrate                                         apply database migrations
   backup                                          create a backup now
   list-backups                                    list backup files
   restore <backup-file-name>                      restore a backup (asks for confirmation)
*/
'use strict';
const readline = require('readline');
const db = require('./db');
const passwords = require('./passwords');
const audit = require('./audit');
const { migrate } = require('./migrate');

function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = function (s) { if (s.includes(question)) rl.output.write(s); else rl.output.write('*'); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

async function askPassword(username) {
  const fromEnv = process.env.CLI_PASSWORD;
  if (fromEnv) return fromEnv;
  for (;;) {
    const a = await ask('New password: ', true);
    const policy = passwords.policyError(a, username);
    if (policy) { console.log('  ✗ ' + policy); continue; }
    const b = await ask('Repeat password: ', true);
    if (a !== b) { console.log('  ✗ Passwords do not match.'); continue; }
    return a;
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  await db.waitForDatabase(60);
  switch (cmd) {
    case 'migrate':
      await migrate();
      break;
    case 'create-admin': {
      const username = String(args[0] || '').toLowerCase();
      const fullName = args[1] || 'Administrator';
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Usage: create-admin <username> "<Full Name>" [email]');
      await migrate();
      if ((await db.query('SELECT 1 FROM users WHERE lower(username) = $1', [username])).rows.length) throw new Error('This username already exists.');
      const pw = await askPassword(username);
      const policy = passwords.policyError(pw, username);
      if (policy) throw new Error(policy);
      await db.query("INSERT INTO users (username, email, full_name, role, password_hash, must_change_password) VALUES ($1,$2,$3,'admin',$4,false)",
        [username, args[2] || null, fullName, await passwords.hash(pw)]);
      await audit.write(null, null, { action: 'user.created', entityType: 'user', summary: `Administrator "${username}" created via command line`, actorName: 'Command line' });
      console.log(`✓ Administrator "${username}" created.`);
      break;
    }
    case 'reset-password': {
      const username = String(args[0] || '').toLowerCase();
      const u = (await db.query('SELECT id, full_name FROM users WHERE lower(username) = $1', [username])).rows[0];
      if (!u) throw new Error('User not found.');
      const pw = await askPassword(username);
      await db.query('UPDATE users SET password_hash = $2, must_change_password = true, is_active = true, password_changed_at = now() WHERE id = $1', [u.id, await passwords.hash(pw)]);
      await db.query('DELETE FROM sessions WHERE user_id = $1', [u.id]);
      await audit.write(null, null, { action: 'user.password_reset', entityType: 'user', entityId: u.id, summary: `Password reset for ${u.full_name} via command line`, actorName: 'Command line' });
      console.log(`✓ Password for "${username}" reset. The user must change it at the next sign-in.`);
      break;
    }
    case 'list-users': {
      const r = await db.query('SELECT username, full_name, role, is_active, last_login_at FROM users ORDER BY username');
      console.table(r.rows);
      break;
    }
    case 'backup': {
      const r = await require('./backup').createBackup(args[0] === 'pre-update' ? 'pre-update' : 'manual', 'Command line');
      console.log(`✓ Backup created: ${r.name} (${Math.round(r.size / 1024)} KB)`);
      break;
    }
    case 'list-backups':
      console.table(require('./backup').listFiles().map((f) => ({ name: f.name, kind: f.kind, sizeKB: Math.round(f.size / 1024) })));
      break;
    case 'restore': {
      const name = args[0];
      if (!name) throw new Error('Usage: restore <backup-file-name>   (see list-backups)');
      const b = require('./backup');
      const m = await b.readManifest(b.fileFor(name));
      console.log(`Backup from ${m.createdAt} – ${m.counts ? m.counts.candidates : '?'} candidates, app version ${m.appVersion}.`);
      console.log('WARNING: Restoring this backup will replace the current recruitment database.');
      const ok = process.env.CLI_CONFIRM === 'RESTORE' ? 'RESTORE' : await ask('Type RESTORE to continue: ');
      if (ok !== 'RESTORE') { console.log('Cancelled.'); break; }
      const r = await b.restoreBackup(name, 'Command line');
      await audit.write(null, null, { action: 'backup.restored', entityType: 'backup', entityId: name, summary: `Database restored from ${name} via command line (safety backup ${r.safetyBackup})`, actorName: 'Command line' });
      console.log(`✓ Restored. Safety backup of the previous state: ${r.safetyBackup}. All users must sign in again.`);
      break;
    }
    default:
      console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(1, 14).join('\n').replace(/^\/\*|\*\/$/gm, ''));
  }
}

main().then(() => db.pool.end()).catch((err) => { console.error('✗ ' + err.message); db.pool.end().finally(() => process.exit(1)); });
