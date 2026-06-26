import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{js,mjs,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/backup/**']
  }
});
