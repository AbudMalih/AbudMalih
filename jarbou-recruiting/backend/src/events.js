/* Server-Sent Events: tells signed-in browsers that data changed so they re-sync.
   Only IDs/types are broadcast – never personal data. */
'use strict';
const clients = new Set();

function subscribe(req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 5000\n\n');
  const client = { res, userId: req.user.id };
  clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(client); });
}

function publish(type, payload) {
  const data = `event: ${type}\ndata: ${JSON.stringify(payload || {})}\n\n`;
  for (const c of clients) { try { c.res.write(data); } catch (e) { clients.delete(c); } }
}

/** Force-close streams of a user (e.g. after deactivation). */
function disconnectUser(userId) {
  for (const c of clients) if (c.userId === userId) { try { c.res.end(); } catch (e) { /* ignore */ } clients.delete(c); }
}

module.exports = { subscribe, publish, disconnectUser, count: () => clients.size };
