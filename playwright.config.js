import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: ".local/playwright-results",
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    trace: "off",
    screenshot: "off",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
