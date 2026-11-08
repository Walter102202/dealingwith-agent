import { defineProject } from 'vitest/config';
export default defineProject({
  test: {
    name: '@dealingwith/scenarios',
    include: ['scenarios/**/*.test.ts'],
    maxWorkers: 2,
    sequence: { groupOrder: 2 },
  },
});
