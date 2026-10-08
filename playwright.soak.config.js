import { defineConfig } from '@playwright/test';
import correctness from './playwright.correctness.config.js';
export default defineConfig({ ...correctness, testDir: './e2e/soak', outputDir: './artifacts/soak', timeout: 900000,
  reporter: [['list']], use: { ...correctness.use, baseURL: 'http://127.0.0.1:4176' },
  webServer: { ...correctness.webServer, command: 'npx vite --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176' } });
