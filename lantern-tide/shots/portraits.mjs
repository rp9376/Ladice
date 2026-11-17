// Dev helper: renders every character portrait on one sheet (shots/portraits.png).
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 400 } });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__LT?.ready);
await page.evaluate(async () => {
  const { ART } = await import('/src/render/art.ts');
  document.body.innerHTML = '<div style="display:flex;gap:14px;padding:20px;background:#16214d;flex-wrap:wrap">' + Object.keys(ART).filter((k) => /^p[A-Z]/.test(k)).map((k) => `<img width="140" height="140" style="border-radius:50%;background:radial-gradient(#3f5fa0,#14224f);border:3px solid #161a33" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(ART[k].svg)}">`).join('') + '</div>';
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/portraits.png' });
await browser.close();
