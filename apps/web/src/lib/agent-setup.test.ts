import { connectionSnippets } from '@dealingwith/contracts';
import { describe, expect, it } from 'vitest';
import { claudeCodeMessage, connectorUrl } from './agent-setup.js';

const token = `dwa_${'a'.repeat(43)}`;
const appUrl = 'https://dealingwith.example';
const snippets = connectionSnippets({ appUrl, token });

describe('claudeCodeMessage', () => {
  it('says what DealingWith is for, carries the exact command and the next step', () => {
    const message = claudeCodeMessage(snippets);
    expect(message).toContain('request quotes for me and pay them within the budget I approved');
    expect(message).toContain(
      `claude mcp add --transport http dealingwith ${appUrl}/mcp --header "Authorization: Bearer ${token}"`,
    );
    expect(message).toContain('`claude mcp remove dealingwith -s local`');
    expect(message).toContain('secret key');
    expect(message).toContain(
      'tell me in one sentence that I need to close Claude Code and open it again in this same folder',
    );
  });

  it('puts the command on a line of its own so it pastes as one block', () => {
    const lines = claudeCodeMessage(snippets).split('\n');
    expect(lines).toContain(snippets.claudeCode);
  });

  it('carries the token once, inside the command', () => {
    expect(claudeCodeMessage(snippets).split(token)).toHaveLength(2);
  });
});

describe('connectorUrl', () => {
  it('returns only the capability URL, without the instructions', () => {
    expect(connectorUrl(snippets)).toBe(`${appUrl}/mcp/${token}`);
  });
});
