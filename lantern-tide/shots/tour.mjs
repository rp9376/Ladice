// Dev helper: walks through the main screens and saves a screenshot of each into shots/.
import { chromium } from '@playwright/test';
const only = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `shots/${name}.png` }); console.log('shot', name); };
const want = (n) => !only || only.split(',').includes(n);
await page.goto('http://localhost:5173/?seed=7&notutorial');
await page.waitForFunction(() => window.__LT?.ready);
await page.waitForTimeout(800);
if (want('title')) await shot('title');
await page.click('#play');
await page.waitForTimeout(1500);
if (want('story')) await shot('story');
for (let i = 0; i < 6; i++) { await page.click('#continue'); await page.waitForTimeout(40); await page.click('#continue'); await page.waitForTimeout(40); }
await page.waitForTimeout(1200);
if (want('story')) await shot('story-moon');
await page.click('.skip');
if (want('chart')) await shot('chart');
if (want('leg')) {
  await page.click('button.node');
  await page.waitForTimeout(1200);
  await shot('leg-ready');
  await page.evaluate(() => { const a = window.__LT; a.bot = true; a.game.scene.getScene('leg').hooks.bot = true; });
  await page.waitForTimeout(9000);
  await shot('leg-play');
  await page.keyboard.press('Escape');
  await shot('pause');
  await page.click('#resume');
  await page.waitForFunction(() => window.__LT.screen === 'tally', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot('tally');
  await page.click('#continue');
  await shot('chart2');
}
if (want('harbour')) {
  await page.evaluate(() => { const a = window.__LT; a.run.col = 3; a.run.doubloons = 80; a.run.pearls = 5; a.run.planks = 2; a.run.crew = ['pingo', 'zabica']; a.run.equipped = ['pingo']; a.showChart(); });
  await shot('harbour');
}
if (want('menus')) {
  await page.evaluate(() => window.__LT.showTitle());
  await page.evaluate(() => { const l = window.__LT.profile.log; l.letters = [0, 2]; l.captains = ['frostbeard']; l.pirates = { dinghy: 31, sloop: 12 }; l.rescued = { pingo: 4 }; });
  for (const s of ['settings', 'achievements', 'museum', 'lunar', 'scores', 'logbook']) { await page.evaluate((n) => window.__LT.open(n), s); await shot(s); await page.evaluate(() => window.__LT.showTitle()); }
  await page.evaluate(() => { const a = window.__LT; a.run = null; a.startRun('voyage'); a.run.won = true; a.run.over = true; a.run.karma = 5; a.run.score = 48210; a.run.equipped = ['pingo', 'zabica', 'turtle']; a.endRun(); });
  await shot('ending');
}
await browser.close();
