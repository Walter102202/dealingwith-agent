// Copies the agent's Markdown prompts into dist/, because tsc emits no .md files.
// Runs as part of `pnpm --filter @dealingwith/backend build`. Decision: 2026-11-07-agent-under-src.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'src', 'agent');
const target = join(root, 'dist', 'agent');

if (!existsSync(source)) {
  console.error(`copy-prompts: ${source} does not exist`);
  process.exit(1);
}
mkdirSync(target, { recursive: true });
cpSync(source, target, {
  recursive: true,
  filter: (path) => {
    const relative = path.slice(source.length);
    // Keep directories (so the walk continues) and every .md file.
    return relative === '' || !/\.[^./\\]+$/.test(relative) || relative.endsWith('.md');
  },
});
console.log(`copy-prompts: Markdown prompts copied to ${target}`);
