import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The task-specific procedure files under `skills/` (spec section 7.3). */
export const SKILLS = ['contract-service', 'analyze-additional', 'explain-quote'] as const;
export type SkillName = (typeof SKILLS)[number];

/**
 * Prompts are Markdown next to this file, read relative to `import.meta.url`
 * so the same code works from `src/` (tsx) and from `dist/` (after
 * `scripts/copy-prompts.mjs`). Each file is read once per process.
 */
const cache = new Map<string, string>();

function readPrompt(relativePath: string): string {
  const cached = cache.get(relativePath);
  if (cached !== undefined) {
    return cached;
  }
  const text = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
  cache.set(relativePath, text);
  return text;
}

/** The system prompt: role and the rules that never bend. */
export function loadInstructions(): string {
  return readPrompt('./instructions.md');
}

/** The procedure for one task type, appended to the system prompt. */
export function loadSkill(skill: SkillName): string {
  if (!SKILLS.includes(skill)) {
    throw new Error(`unknown skill "${skill}"; expected one of ${SKILLS.join(', ')}`);
  }
  return readPrompt(`./skills/${skill}.md`);
}

let promptVersion: string | undefined;

/**
 * What `agent_runs.prompt_version` records: the git short SHA of the running
 * checkout, or `dev` when git is not available (a Render image has no .git).
 */
export function resolvePromptVersion(): string {
  if (promptVersion === undefined) {
    try {
      promptVersion = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2000,
      }).trim();
    } catch {
      promptVersion = 'dev';
    }
    if (!/^[0-9a-f]{7,40}$/.test(promptVersion)) {
      promptVersion = 'dev';
    }
  }
  return promptVersion;
}
