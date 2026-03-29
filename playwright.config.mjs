import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${process.env.TEST_PORT || 3099}`,
  },
  webServer: {
    command: `PORT=${process.env.TEST_PORT || 3099} node server.js`,
    port: Number(process.env.TEST_PORT || 3099),
    reuseExistingServer: true,
    timeout: 10000,
  },
});
