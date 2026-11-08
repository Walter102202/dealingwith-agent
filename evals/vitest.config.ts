import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['graders/**/*.test.ts'],
  },
});
