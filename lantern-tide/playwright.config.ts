import { defineConfig } from '@playwright/test';

// Uses the system Chrome (no browser download). Set PW_CHANNEL='' to use Playwright's bundled Chromium.
const channel = process.env.PW_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    ...(channel ? { channel } : {}),
    // PW_GL=swiftshader forces software rendering (CI without a GPU); the default tries the real GPU first.
    launchOptions: { args: [...(process.env.PW_GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=gl', '--enable-gpu']), '--ignore-gpu-blocklist', '--mute-audio'] },
  },
  webServer: {
    command: 'corepack npm run build && corepack npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
