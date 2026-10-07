import { defineConfig } from "@playwright/test";
const port = Number(process.env.SMARTQUOTE_WEB_PORT || 5173);
const localUrl = `http://localhost:${port}`;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: ".local/playwright-results",
  use: {
    baseURL: localUrl,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    trace: "off",
    screenshot: "off",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: localUrl,
    reuseExistingServer: !process.env.CI && !process.env.SMARTQUOTE_WEB_PORT,
    timeout: 30000,
  },
});
