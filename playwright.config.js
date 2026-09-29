const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173', trace: 'on-first-retry',
    // Tuỳ chọn: dùng Chromium có sẵn thay vì bản Playwright tự tải (vd. CHROMIUM_PATH=/opt/pw-browsers/chromium)
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  webServer: { command: 'npm start --silent', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(smoke|a11y)\.spec\.js/ },
  ],
});
