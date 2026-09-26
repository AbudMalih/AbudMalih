/* Used by run-stack-tests.sh: `create` stores a marker candidate, `verify` checks it still exists. */
'use strict';
const fs = require('fs');
const { admin, newCandidate } = require('./api/helpers');
const FILE = process.env.MARKER_FILE || '/tmp/jrc-persistence-marker.json';
(async () => {
  const A = await admin();
  if (process.argv[2] === 'create') {
    const c = await newCandidate(A, { lastName: 'Persistenz-Test', phone: '+49 511 000000' });
    const up = await A.patch('/api/candidates/' + c.id, { changes: [{ path: 'documents.licence.status', from: 'missing', to: 'verified' }] });
    fs.writeFileSync(FILE, JSON.stringify({ id: c.id, version: up.data.version }));
    console.log('created marker candidate ' + c.id);
  } else {
    const m = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const r = await A.get('/api/candidates/' + m.id);
    if (r.status !== 200 || r.data.lastName !== 'Persistenz-Test' || r.data.documents.licence.status !== 'verified') {
      console.error('PERSISTENCE FAILED', r.status, r.data); process.exit(1);
    }
    console.log('marker candidate ' + m.id + ' still present ✓');
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
