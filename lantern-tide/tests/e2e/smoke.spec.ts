import { expect, test, type Page } from '@playwright/test';

// The game exposes window.__LT (see src/main.ts). Tests render at a low internal resolution so that
// software-rendered CI browsers keep up; the simulation runs on the wall clock either way.
interface LT { ready: boolean; screen: string; sim: { status: string; score: number; time: number } | null; run: { col: number; over: boolean; won: boolean; mode: string; depth: number } | null; setBot(on: boolean): void; profile: { achievements: Record<string, string>; scores: Record<string, { name: string; score: number }[]>; lunarFound: boolean } }
declare global { interface Window { __LT: LT } }

async function boot(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`/?res=640&seed=7&notutorial${query}`);
  await page.waitForFunction(() => window.__LT?.ready, null, { timeout: 30_000 });
  return errors;
}
const screen = (page: Page) => page.evaluate(() => window.__LT.screen);
const waitScreen = (page: Page, name: string, timeout = 75_000) => page.waitForFunction((n) => window.__LT.screen === n, name, { timeout });

test('boots to the title screen', async ({ page }, info) => {
  const errors = await boot(page);
  expect(await screen(page)).toBe('title');
  await expect(page.locator('.title-logo h1')).toHaveText('Ladice');
  await expect(page.locator('#play')).toHaveText('Set Sail');
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath('title.png') });
  expect(errors).toEqual([]);
});

test('a voyage leg can be played from chart to tally and back', async ({ page }, info) => {
  const errors = await boot(page);
  await page.click('#play');
  // A new voyage opens with the story: narrator, Old Jaka, then the Moon.
  await waitScreen(page, 'story', 5000);
  await expect(page.locator('.dialogue .say')).toContainText('Lantern Tide', { timeout: 8000 });
  await page.screenshot({ path: info.outputPath('story.png') });
  for (let i = 0; i < 40 && (await screen(page)) === 'story'; i++) { await page.click('#continue'); await page.waitForTimeout(60); }
  await waitScreen(page, 'chart', 5000);
  await page.screenshot({ path: info.outputPath('chart.png') });
  await page.click('button.node');
  await page.waitForFunction(() => window.__LT.sim?.status === 'ready');
  // Nothing moves until the player takes the helm (homage to "click the boat to start").
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__LT.sim!.time)).toBe(0);
  await page.evaluate(() => window.__LT.setBot(true));
  await page.waitForFunction(() => window.__LT.sim!.time > 6);
  await page.screenshot({ path: info.outputPath('leg.png') });
  // Pause and resume.
  await page.keyboard.press('Escape');
  await waitScreen(page, 'pause', 5000);
  const t0 = await page.evaluate(() => window.__LT.sim!.time);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__LT.sim!.time)).toBe(t0);
  await page.click('#resume');
  await waitScreen(page, 'tally');
  await page.waitForTimeout(900);
  await page.screenshot({ path: info.outputPath('tally.png') });
  const status = await page.evaluate(() => window.__LT.sim!.status);
  await page.click('#continue');
  if (status === 'lost') await waitScreen(page, 'over', 5000);
  else {
    await waitScreen(page, 'chart', 5000);
    expect(await page.evaluate(() => window.__LT.run!.col)).toBe(1);
  }
  expect(errors).toEqual([]);
});

test('the moon keeps its secret', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.getByText('Lunar Mode')).toHaveCount(0);
  // The moon sits at world (900, 104) in a 1120x630 view; the page is 1280x720.
  await page.mouse.click(900 * (1280 / 1120), 104 * (720 / 630), { button: 'middle' });
  await waitScreen(page, 'lunar', 5000);
  expect(await page.evaluate(() => window.__LT.profile.lunarFound)).toBe(true);
  expect(await page.evaluate(() => !!window.__LT.profile.achievements.moonstruck)).toBe(true);
  expect(errors).toEqual([]);
});

test('the game speaks Slovenian', async ({ page }) => {
  await boot(page);
  await page.locator('.title-foot .seg button', { hasText: 'SL' }).click();
  await expect(page.locator('#play')).toHaveText('Izpluj');
  await expect(page.locator('.title-logo .sub')).toHaveText('Plima svetilk');
});

test('classic mode: hitting an obstacle ends the game instead of advancing', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: 'Classic 2014' }).click();
  await page.waitForFunction(() => window.__LT.sim?.status === 'ready');
  // Force the original fail state: drive the boat straight into the first obstacle.
  await page.evaluate(() => {
    const s = window.__LT.sim as unknown as { status: string; player: { x: number; y: number; vx: number }; hazards: { x: number; y: number; r: number }[] };
    s.status = 'running';
    const h = s.hazards[0];
    s.player.x = h.x - h.r - 30; s.player.y = h.y; s.player.vx = 200;
  });
  await waitScreen(page, 'tally', 15_000);
  expect(await page.evaluate(() => window.__LT.sim!.status)).toBe('lost');
  await page.click('#continue');
  await waitScreen(page, 'over', 5000);
  expect(await page.evaluate(() => window.__LT.run!.depth)).toBe(0);
  // Scoreboard name entry happens in the game, not in a terminal.
  await page.fill('input.name', 'Pingo');
  await page.click('#save');
  await waitScreen(page, 'scores', 5000);
  await expect(page.locator('.board')).toContainText('Pingo');
  expect(errors).toEqual([]);
});

test('the tutorial can be finished and leads to the chart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?res=640&seed=7&bot');
  await page.waitForFunction(() => window.__LT?.ready, null, { timeout: 30_000 });
  await page.click('#play');
  await expect(page.locator('.hud .tutorial')).toBeVisible();
  // After the tutorial the story begins; skipping it lands on the chart.
  await waitScreen(page, 'story', 80_000);
  await page.click('.skip');
  await waitScreen(page, 'chart', 5000);
  expect(errors).toEqual([]);
});

test('captains tell their story and give back a stolen light', async ({ page }) => {
  const errors = await boot(page);
  await page.click('#play');
  await waitScreen(page, 'story', 5000);
  await page.click('.skip');
  await waitScreen(page, 'chart', 5000);
  // Jump to the captain of the first sea and let the autopilot fight him with a sturdy hull.
  await page.evaluate(() => {
    const a = window.__LT as unknown as { run: { col: number; planks: number; maxPlanks: number }; showChart(): void };
    a.run.col = 4; a.run.planks = 9; a.run.maxPlanks = 9; a.showChart();
  });
  await page.click('button.node[data-kind="boss"]');
  await waitScreen(page, 'story', 5000);
  await expect(page.locator('.dialogue .who')).toHaveText('Captain Frostbeard');
  await page.click('.skip');
  await page.waitForFunction(() => window.__LT.sim?.status === 'ready', null, { timeout: 10_000 });
  await page.evaluate(() => window.__LT.setBot(true));
  await waitScreen(page, 'tally', 150_000);
  if ((await page.evaluate(() => window.__LT.sim!.status)) === 'won') {
    await expect(page.locator('.joined.light')).toContainText('Aurora');
    await page.click('#continue');
    await waitScreen(page, 'story', 5000);
    await page.click('.skip');
    await waitScreen(page, 'story', 5000); // arrival in the Lily Swamp
    await expect(page.locator('.dialogue .say')).toContainText('Lily Swamp', { timeout: 8000 });
    expect(await page.evaluate(() => (window.__LT as unknown as { run: { lights: string[] } }).run.lights)).toEqual(['frostbeard']);
  }
  expect(errors).toEqual([]);
});

test('sinking on a voyage offers to restart the current sea', async ({ page }) => {
  const errors = await boot(page);
  await page.click('#play');
  await waitScreen(page, 'story', 5000);
  await page.click('.skip');
  await waitScreen(page, 'chart', 5000);
  await page.click('button.node');
  await page.waitForFunction(() => window.__LT.sim?.status === 'ready');
  // Scuttle the boat: one plank left, pointed at the nearest rock.
  await page.evaluate(() => {
    const s = window.__LT.sim as unknown as { status: string; player: { x: number; y: number; vx: number; planks: number }; hazards: { x: number; y: number; r: number; hurts: boolean }[] };
    const h = s.hazards.find((q) => q.hurts)!;
    s.status = 'running'; s.player.planks = 1;
    s.player.x = h.x - h.r - 30; s.player.y = h.y; s.player.vx = 220;
  });
  await waitScreen(page, 'tally', 15_000);
  await page.click('#continue');
  await waitScreen(page, 'over', 5000);
  await expect(page.locator('#retry')).toHaveText('Restart Ice Sea');
  await page.click('#retry');
  await waitScreen(page, 'chart', 5000);
  const run = await page.evaluate(() => { const r = (window.__LT as unknown as { run: { col: number; biome: number; over: boolean; retries: number; planks: number } }).run; return { col: r.col, biome: r.biome, over: r.over, retries: r.retries, planks: r.planks }; });
  expect(run).toEqual({ col: 0, biome: 0, over: false, retries: 1, planks: 3 });
  expect(errors).toEqual([]);
});
