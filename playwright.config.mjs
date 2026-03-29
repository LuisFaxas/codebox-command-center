import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3099',
  },
  webServer: {
    command: 'node server.js',
    port: 3099,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
