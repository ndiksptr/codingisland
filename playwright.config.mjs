// playwright.config.mjs — tes end-to-end Coding Island (Chromium)
// Jalankan: npm run test:e2e   (BASE_URL bawaan http://localhost:8787; domain produksi ditolak)
import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL } from './tests/helper.mjs'; // memuat helper = memeriksa domain produksi

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  // Hasil (screenshot, trace) ditulis DI LUAR folder proyek: wrangler dev memantau folder proyek dan
  // memuat ulang server setiap ada berkas baru, sehingga permintaan yang sedang berjalan bisa macet.
  outputDir: join(tmpdir(), 'coding-island-test-results'),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // satu database bersama; berurutan agar hasil stabil
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'id-ID',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 850 } } }]
});
