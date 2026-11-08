import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type AgentOutput, ruleRefLabel } from '@dealingwith/contracts';
import { eq } from 'drizzle-orm';
import { type AgentPort, createAgentPort } from '../../apps/backend/src/agent/port.js';
import {
  describeModel,
  type LlmEnv,
  type LlmProvider,
} from '../../apps/backend/src/agent/provider.js';
import { closeDb, type Db } from '../../apps/backend/src/db/client.js';
import { DEMO } from '../../apps/backend/src/db/demo-data.js';
import * as schema from '../../apps/backend/src/db/schema.js';
import { seedDemo } from '../../apps/backend/src/db/seed.js';
import { createTestDb } from '../../apps/backend/src/db/test-db.js';
import { type ClassificationGrade, gradeClassification } from '../graders/classification.js';
import { CASES, type EvalCase } from './cases.js';

/**
 * Live eval (spec section 7.8): the five demo requests against the configured
 * provider, graded on classification only. Reads `.env` at the repo root,
 * seeds a fresh in-memory database, prints one line per request and exits 1
 * when any request fails. Not part of CI: `pnpm eval:live`.
 */

const C4_QUOTE_ID = '5b4b6a1e-0d7e-4a51-9f2a-2d3b1c8e9a99';

type Line = {
  id: string;
  grade: ClassificationGrade | null;
  refs: string[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
};

function readEnv(): LlmEnv {
  const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const provider = (process.env.LLM_PROVIDER ?? 'mock') as LlmProvider;
  if (!['anthropic', 'openai', 'mock'].includes(provider)) {
    throw new Error(`LLM_PROVIDER must be anthropic, openai or mock, got "${provider}"`);
  }
  const env: LlmEnv = { LLM_PROVIDER: provider };
  if (process.env.LLM_MODEL) env.LLM_MODEL = process.env.LLM_MODEL;
  if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  return env;
}

function refsOf(output: AgentOutput): string[] {
  const refs = output.lineItems.map((line) =>
    line.kind === 'included' ? line.scopeRef : ruleRefLabel(line.ref),
  );
  if (output.needsInfo.length > 0) refs.push('needs_info');
  return refs;
}

/** Simulates "request 1 was paid": appends clause C4 exactly as the capture workflow does. */
async function appendPaidClauseC4(db: Db): Promise<void> {
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, DEMO.project.id));
  if (!project || project.scopeClauses.some((c) => c.id === 'C4')) return;
  await db
    .update(schema.projects)
    .set({
      scopeClauses: [
        ...project.scopeClauses,
        {
          id: 'C4',
          text: 'Weekly Monday summary email',
          included: true,
          source: { kind: 'quote', quoteId: C4_QUOTE_ID, version: 1 },
        },
      ],
    })
    .where(eq(schema.projects.id, DEMO.project.id));
}

async function runCase(db: Db, port: AgentPort, evalCase: EvalCase): Promise<Line> {
  const pack = await port.buildContextPack(db, {
    clientId: DEMO.client.id,
    projectId: DEMO.project.id,
  });
  const [request] = await db
    .insert(schema.requests)
    .values({
      clientId: DEMO.client.id,
      projectId: DEMO.project.id,
      channel: 'web',
      text: evalCase.text,
    })
    .returning({ id: schema.requests.id });
  const requestId = request?.id ?? '';
  const startedAt = Date.now();
  try {
    const { output, runId } = await port.runAgent(
      { db },
      { pack, text: evalCase.text, skill: 'analyze-additional', requestId },
    );
    const [run] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId));
    return {
      id: evalCase.id,
      grade: gradeClassification(output, evalCase.expected),
      refs: refsOf(output),
      latencyMs: run?.latencyMs ?? Date.now() - startedAt,
      inputTokens: run?.inputTokens ?? 0,
      outputTokens: run?.outputTokens ?? 0,
    };
  } catch (error) {
    const [run] = await db
      .select()
      .from(schema.agentRuns)
      .where(eq(schema.agentRuns.requestId, requestId));
    return {
      id: evalCase.id,
      grade: null,
      refs: [],
      latencyMs: run?.latencyMs ?? Date.now() - startedAt,
      inputTokens: run?.inputTokens ?? 0,
      outputTokens: run?.outputTokens ?? 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatLine(line: Line): string {
  const status = line.grade?.pass ? 'PASS' : 'FAIL';
  const detail = line.error
    ? `error: ${line.error}`
    : [
        `refs=${line.refs.join(',') || '-'}`,
        line.grade && line.grade.missing.length > 0
          ? `missing=${line.grade.missing.join(',')}`
          : '',
        line.grade && line.grade.extra.length > 0 ? `extra=${line.grade.extra.join(',')}` : '',
      ]
        .filter(Boolean)
        .join('  ');
  return `${status}  ${line.id.padEnd(28)} ${String(line.latencyMs).padStart(6)} ms  in=${line.inputTokens} out=${line.outputTokens}  ${detail}`;
}

async function main(): Promise<number> {
  const env = readEnv();
  const { provider, model } = describeModel(env);
  console.log(`DealingWith Agent live eval — provider=${provider} model=${model}`);

  const db = await createTestDb();
  try {
    await seedDemo(db);
    const port = createAgentPort(env);
    const lines: Line[] = [];
    for (const evalCase of CASES) {
      if (evalCase.afterFirstPayment) await appendPaidClauseC4(db);
      const line = await runCase(db, port, evalCase);
      console.log(formatLine(line));
      lines.push(line);
    }
    const passed = lines.filter((l) => l.grade?.pass).length;
    console.log(`${passed}/${lines.length} passed`);
    return passed === lines.length ? 0 : 1;
  } finally {
    await closeDb(db);
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
