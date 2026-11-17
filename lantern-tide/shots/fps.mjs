// Dev helper: measures real frames per second and how fast the simulation advances, per GL backend and resolution.
import { chromium } from '@playwright/test';
const configs = { swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], gpu: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'], default: [] };
for (const [name, args] of Object.entries(configs)) {
  const browser = await chromium.launch({ channel: 'chrome', args: [...args, '--mute-audio'] });
  for (const q of ['?leg=patrol&bot', '?leg=patrol&bot&res=960']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto('http://localhost:5173/' + q);
    try {
      await page.waitForFunction(() => window.__LT?.sim, null, { timeout: 15000 });
      const r = await page.evaluate(() => new Promise((res) => {
        let n = 0; const t0 = performance.now(); const s0 = window.__LT.sim.time;
        const f = () => { n++; if (performance.now() - t0 > 3000) res({ realFps: Math.round(n / 3), simSpeed: +((window.__LT.sim.time - s0) / 3).toFixed(2), gl: (() => { const c = document.createElement('canvas').getContext('webgl'); const e = c?.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL).slice(0, 60) : 'n/a'; })() }); else requestAnimationFrame(f); };
        requestAnimationFrame(f);
      }));
      console.log(name.padEnd(12), q.padEnd(28), JSON.stringify(r));
    } catch (e) { console.log(name, q, 'failed:', String(e).slice(0, 120)); }
    await page.close();
  }
  await browser.close();
}
