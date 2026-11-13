const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/preview.html'); await p.waitForTimeout(1300);
  const dev = await p.$('#device'); const shot = async n => { await dev.screenshot({ path: n }); };
  const txt = async s => (await p.textContent(s)).replace(/\s+/g, ' ').trim();
  await shot('Driver_Heute_dunkel.png');
  await p.click('[data-act="continue"]'); await p.waitForTimeout(1200); await shot('Driver_Karte_dunkel.png');
  // 1 deliver without proof
  await p.click('#sheet [data-act="deliver"]'); await p.waitForTimeout(400); await shot('Driver_Zugestellt_Animation.png'); await p.waitForTimeout(1100);
  console.log('after deliver 1:', await txt('#sheet .addr'), '|', await txt('.toast'));
  // undo
  await p.click('.toast button'); await p.waitForTimeout(500); console.log('after undo:', await txt('#sheet .addr'));
  await p.click('#sheet [data-act="deliver"]'); await p.waitForTimeout(1600);
  // 2 needs photo
  await p.click('#sheet [data-act="deliver"]'); await p.waitForTimeout(600); await shot('Driver_Foto_Nachweis.png');
  await p.click('#shut'); await p.waitForTimeout(300); await p.click('#usep'); await p.waitForTimeout(1600);
  // 3 COD + signature
  await p.click('#sheet [data-act="deliver"]'); await p.waitForTimeout(600); await p.click('#codok'); await p.waitForTimeout(600);
  const c = await (await p.$('#sigc')).boundingBox(); await p.mouse.move(c.x + 30, c.y + 150); await p.mouse.down(); for (let k = 0; k < 20; k++) await p.mouse.move(c.x + 30 + k * 12, c.y + 150 - Math.sin(k / 2) * 50); await p.mouse.up();
  await shot('Driver_Unterschrift.png'); await p.click('#sigok'); await p.waitForTimeout(1600);
  console.log('now next:', await txt('#sheet .sub'));
  // expand sheet + fail
  await p.click('#grab'); await p.waitForTimeout(500); await shot('Driver_Stopp_Details.png');
  await p.click('#sheet .bigbtns [data-act="fail"]'); await p.waitForTimeout(500); await p.click('[data-reason="rNotHome"]'); await p.waitForTimeout(200); await shot('Driver_Nicht_zugestellt.png');
  await p.click('#freport'); await p.waitForTimeout(1600); console.log('fail toast:', await txt('.toast'));
  // navigation
  await p.click('#sheet [data-act="nav"]'); await p.waitForTimeout(500); await shot('Driver_Navigation_Wahl.png'); await p.click('[data-navapp="gmaps"]'); await p.waitForTimeout(400); await shot('Driver_Navigation_Uebergabe.png'); await p.click('[data-act="arrived"]'); await p.waitForTimeout(600);
  // optimize
  await p.click('#mctrl [data-act="optimize"]'); await p.waitForTimeout(2400); await shot('Driver_Optimierung.png'); console.log('opt:', await txt('#full .cmpx').catch(() => 'already optimal'));
  await p.click('[data-act="applyopt"]').catch(() => {}); await p.waitForTimeout(800);
  // scanner
  await p.click('.tb[data-tab="scan"]'); await p.waitForTimeout(600); await shot('Driver_Scan_Ziel.png'); await p.click('[data-target="active"]'); await p.waitForTimeout(500);
  for (let k = 0; k < 5; k++) { await p.click('[data-act="scanone"]'); await p.waitForTimeout(350); }
  await shot('Driver_Scanner.png'); console.log('tray:', await txt('#tray > div'));
  await p.click('[data-act="addscanned"]'); await p.waitForTimeout(900); await shot('Driver_Reopt_Frage.png'); await p.click('#msheet [data-act="optimize"]'); await p.waitForTimeout(2400); console.log('opt2:', await txt('#full .cmpx').catch(() => 'already'));
  await p.click('[data-act="closeopt"]'); await p.waitForTimeout(400);
  // stops
  await p.click('.tb[data-tab="stops"]'); await p.waitForTimeout(500); await shot('Driver_Stopps.png');
  // offline + sync
  await p.click('.tb[data-tab="more"]'); await p.waitForTimeout(500); await p.click('#p-off', { force: true }); await p.waitForTimeout(300);
  await p.click('.tb[data-tab="map"]'); await p.waitForTimeout(900); await p.click('#sheet [data-act="deliver"]'); await p.waitForTimeout(1700); await p.click('.syncpill'); await p.waitForTimeout(500); await shot('Driver_Offline_Sync.png');
  await p.keyboard.press('Escape'); await p.click('.tb[data-tab="more"]'); await p.waitForTimeout(400); await p.click('#p-off', { force: true }); await p.waitForTimeout(2200); console.log('sync pill:', await txt('.syncpill'));
  await shot('Driver_Mehr.png');
  // languages
  for (const l of ['en', 'ro', 'ar']) { await p.click('[data-act="lang"]'); await p.waitForTimeout(400); await p.click(`[data-lang="${l}"]`); await p.waitForTimeout(500); await p.click('.tb[data-tab="today"]'); await p.waitForTimeout(500); await shot(`Driver_Heute_${l}.png`); await p.click('.tb[data-tab="more"]'); await p.waitForTimeout(400); }
  // light
  await p.click('#theme'); await p.waitForTimeout(900); await p.click('.tb[data-tab="map"]'); await p.waitForTimeout(1000); await shot('Driver_Karte_hell_ar.png');
  await p.click('.tb[data-tab="more"]'); await p.waitForTimeout(300); await p.click('[data-act="lang"]'); await p.waitForTimeout(300); await p.click('[data-lang="de"]'); await p.waitForTimeout(400); await p.click('.tb[data-tab="today"]'); await p.waitForTimeout(500); await shot('Driver_Heute_hell.png');
  console.log('errors', errs); await b.close();
})();
