// Dev helper: node shots/watch.mjs "<query>" name t1,t2,... — screenshots one session at several times (seconds) and prints boss/leg state.
import { chromium } from '@playwright/test';
const [, , query = '', name = 'watch', times = '5,15,30'] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });
await page.goto('http://localhost:5173/' + query);
await page.waitForFunction(() => window.__LT?.ready);
const t0 = Date.now();
for (const t of times.split(',').map(Number)) {
  await page.waitForTimeout(Math.max(0, t * 1000 - (Date.now() - t0)));
  const st = await page.evaluate(() => { const a = window.__LT, s = a.sim; return s ? { screen: a.screen, status: s.status, t: +s.time.toFixed(0), planks: s.player.planks, score: s.score, boss: s.boss ? { hp: s.boss.hp, phase: s.boss.phase, state: s.boss.state, hidden: s.boss.hidden } : null, animals: s.animals.map((q) => q.type + ':' + q.state).slice(0, 4), beacons: s.beacons.map((q) => q.lit ? 1 : 0).join('') } : { screen: a.screen }; });
  console.log(t + 's', JSON.stringify(st));
  await page.screenshot({ path: `shots/${name}-${t}.png` });
}
await browser.close();
