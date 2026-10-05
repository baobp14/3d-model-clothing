import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: './.qa/results',
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', channel: 'msedge', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: { command: 'npm run build -- --outDir .qa/site && npm run preview -- --host 127.0.0.1 --port 5174 --strictPort --outDir .qa/site', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 120000, env: { VITE_SUPABASE_URL: 'http://127.0.0.1:9999', VITE_SUPABASE_ANON_KEY: 'isolated-qa-key' } },
})
