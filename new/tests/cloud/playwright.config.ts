import { defineConfig } from '@playwright/test';

// Proti běžícímu `npm run dev` (http://localhost:3000, DB = sourozenecká služba db).
export default defineConfig({
    testDir: '.',
    timeout: 60_000,
    workers: 1,
    use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000' },
});
