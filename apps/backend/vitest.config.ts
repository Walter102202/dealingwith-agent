import { defineProject } from 'vitest/config';
export default defineProject({
  test: {
    name: '@dealingwith/backend',
    include: ['src/**/*.test.ts'],
    maxWorkers: 2,
    sequence: { groupOrder: 1 },
  },
});
