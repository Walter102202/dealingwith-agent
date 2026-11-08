import { ProjectViewSchema, QuoteSchema } from '@dealingwith/contracts';
import { expect, test } from 'vitest';
import { DEMO } from '../../apps/backend/src/db/demo-data.js';
import { createScenario, post } from './helpers.js';

test('Information missing changes the price: ask a question without publishing or paying', async () => {
  const s = await createScenario();
  try {
    const path = `/api/projects/${DEMO.project.id}`;
    const q = QuoteSchema.parse(
      await (
        await s.request(`${path}/requests`, post({ text: 'Make the dashboard load faster.' }))
      ).json(),
    );
    expect(q.status).toBe('needs_info');
    expect(q).not.toHaveProperty('publishedAt');
    expect(q.needsInfo[0]?.question).toBe(
      'Is the slowness caused by data volume or by the dashboard design?',
    );
    expect(await (await s.request(`/api/quotes/${q.id}/versions`)).json()).toHaveLength(1);
    expect(
      await (await s.request(`/api/quotes/${q.id}/accept`, post({ version: 1 }))).json(),
    ).toMatchObject({ status: 'denied', reason: 'not_acceptable' });
    expect(
      ProjectViewSchema.parse(await (await s.request(path)).json()).project.scopeClauses,
    ).toHaveLength(3);
  } finally {
    await s.close();
  }
});
