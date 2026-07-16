const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.spec.js',
  outputDir: '/tmp/startpage-playwright-results',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python -m http.server 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  }
});
