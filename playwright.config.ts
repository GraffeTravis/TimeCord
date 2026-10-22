import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3101",
    browserName: "chromium",
    timezoneId: "UTC",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/serve-preview.mjs",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
