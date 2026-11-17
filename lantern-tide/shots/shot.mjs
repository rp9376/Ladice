// Dev helper: node shots/shot.mjs "<query or path>" out.png [waitMs] [js-to-eval]
import { chromium } from '@playwright/test';
const [, , query = '', out = 'shots/out.png', wait = '2500', js = ''] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 600)));
await page.goto('http://localhost:5173/' + query);
await page.waitForTimeout(Number(wait));
if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log(JSON.stringify(r)); await page.waitForTimeout(600); }
await page.screenshot({ path: out });
await browser.close();
