const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8080',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off'
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:8080/index.html',
    reuseExistingServer: true,
    timeout: 15000
  }
});
