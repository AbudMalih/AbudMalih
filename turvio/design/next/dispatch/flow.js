const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/preview.html#planning'); await p.waitForTimeout(1300);
  await p.click('#dd-drv > button'); await p.click('[data-drv="d6"]'); await p.waitForTimeout(200);
  await p.click('#dd-veh > button'); await p.click('[data-veh="v6"]'); await p.waitForTimeout(200);
  await p.click('#optimize'); await p.waitForTimeout(2600);
  const save = await p.textContent('.cmp'); console.log('proposal:', save.replace(/\s+/g, ' ').trim());
  await p.screenshot({ path: 'f1.png' });
  await p.click('#apply'); await p.waitForTimeout(500);
  console.log('after apply km:', await p.textContent('#pm-km'), 'tag:', await p.textContent('.panel-h .tag'));
  await p.click('.toast button'); await p.waitForTimeout(300); console.log('after undo km:', await p.textContent('#pm-km'));
  await p.click('#optimize'); await p.waitForTimeout(2600); await p.click('#apply'); await p.waitForTimeout(400);
  // keyboard reorder
  await p.focus('#plist .srow[data-si="0"]'); await p.keyboard.down('Alt'); await p.keyboard.press('ArrowDown'); await p.keyboard.up('Alt'); await p.waitForTimeout(300);
  console.log('first row now:', (await p.textContent('#plist .srow[data-si="0"] .s-a')));
  // multi-select
  await p.click('#plist .srow[data-si="2"] .ck'); await p.click('#plist .srow[data-si="6"] .ck', { modifiers: ['Shift'] }); await p.waitForTimeout(200);
  console.log('bulk:', await p.textContent('.bulk span'));
  await p.click('#bulk-clear');
  await p.click('#publish'); await p.waitForTimeout(400); await p.screenshot({ path: 'f2.png' });
  await p.click('#pub-go'); await p.waitForTimeout(2300);
  console.log('published tag:', await p.textContent('.panel-h .tag'));
  // new tour + import
  await p.click('.panel-h [data-newtour]'); await p.waitForTimeout(300); await p.click('#nt-go'); await p.waitForTimeout(500);
  await p.click('#open-import'); await p.waitForTimeout(300); await p.click('#imp-sample'); await p.waitForTimeout(300); await p.screenshot({ path: 'f3.png' });
  await p.click('#imp-go'); await p.waitForTimeout(2200);
  console.log('imported stops:', await p.textContent('#pm-n'));
  await p.screenshot({ path: 'f4.png' });
  // light + arabic on overview
  await p.evaluate(() => { location.hash = 'overview'; }); await p.waitForTimeout(800);
  await p.evaluate(() => document.documentElement.dataset.theme = 'light'); await p.waitForTimeout(300);
  await p.click('[data-tc="t1"]'); await p.waitForTimeout(1000); await p.screenshot({ path: 'f5.png' });
  await p.click('#dd-lang > button'); await p.click('[data-lang="ar"]'); await p.waitForTimeout(1200); await p.screenshot({ path: 'f6.png' });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth); console.log('ar scrollWidth', sw);
  const t = await b.newPage({ viewport: { width: 820, height: 1100 } }); t.on('pageerror', e => errs.push(e.message));
  await t.goto('file://' + process.cwd() + '/preview.html#overview'); await t.waitForTimeout(1300); await t.screenshot({ path: 'f7.png' });
  console.log('tablet scrollWidth', await t.evaluate(() => document.documentElement.scrollWidth));
  console.log('errors', errs); await b.close();
})();
