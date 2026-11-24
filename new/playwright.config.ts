import { defineConfig } from '@playwright/test';

// Prohlížečové specy proti běžící appce (npm run dev / next start) a workeru (npm run worker).
// Druhou instanci ověříš přes QA_BASE_URL=http://localhost:3001.
export default defineConfig({
  testDir: 'tests/cloud',
  timeout: 120_000,
  workers: 1,
  use: { baseURL: process.env.QA_BASE_URL ?? 'http://localhost:3000' },
});
