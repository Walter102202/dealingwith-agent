import { type ClientAgent, connectionSnippets } from '@dealingwith/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...actual,
    api: { ...actual.api, get: apiMock.get, post: apiMock.post, del: apiMock.del },
  };
});

import { DEMO_IDS } from '../api/fixtures/demo-ids.js';
import { claudeCodeMessage } from '../lib/agent-setup.js';
import { ConnectAgent } from './ConnectAgent.js';

const token = `dwa_${'a'.repeat(43)}`;
const appUrl = 'https://dealingwith.example';
const snippets = connectionSnippets({ appUrl, token });
const agent: ClientAgent = {
  id: 'e0000000-0000-4000-8000-000000000001',
  clientId: DEMO_IDS.client,
  label: "Mara's assistant",
  scopes: ['quote:request', 'quote:accept'],
  createdAt: '2026-11-08T10:00:00.000Z',
};

describe('ConnectAgent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides agents the API returns as revoked', () => {
    const revoked: ClientAgent = { ...agent, revokedAt: '2026-11-08T11:00:00.000Z' };
    render(<ConnectAgent agents={[revoked]} onChange={vi.fn(async () => {})} />);
    expect(screen.queryByText("Mara's assistant")).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Connected agents' })).not.toBeInTheDocument();
  });

  const issue = async () => {
    apiMock.post.mockResolvedValue({ token, agent, snippets });
    const onChange = vi.fn(async () => {});
    render(<ConnectAgent agents={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect my agent' }));
    fireEvent.change(screen.getByLabelText('Name for this agent'), {
      target: { value: "Mara's assistant" },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    await screen.findByText('Copy it now; it is not shown again.');
    return onChange;
  };

  it('issues a token once and leads with the message for Claude Code', async () => {
    const onChange = await issue();
    expect(screen.getByRole('heading', { name: 'Claude Code' })).toBeInTheDocument();
    expect(screen.getByText('Message for Claude Code')).toBeInTheDocument();
    const message = screen.getByText(/Please connect yourself to DealingWith/);
    expect(message.textContent).toBe(claudeCodeMessage(snippets));
    expect(message.textContent).toContain(snippets.claudeCode);
    expect(apiMock.post).toHaveBeenCalledWith(
      '/api/agents',
      { label: "Mara's assistant" },
      expect.anything(),
    );
    expect(onChange).toHaveBeenCalled();
  });

  it('gives Claude Desktop and claude.ai the connector link alone', async () => {
    await issue();
    expect(
      screen.getByRole('heading', { name: 'Claude Desktop or claude.ai' }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${appUrl}/mcp/${token}`)).toBeInTheDocument();
  });

  it('keeps the command, the Cursor JSON and the raw token behind the technical disclosure', async () => {
    await issue();
    const disclosure = screen
      .getByText('Technical setup (terminal, Cursor, raw token)')
      .closest('details');
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute('open');
    const inside = within(disclosure as HTMLElement);
    expect(inside.getByText('Claude Code command')).toBeInTheDocument();
    expect(inside.getByText(snippets.claudeCode)).toBeInTheDocument();
    expect(inside.getByText('Cursor (mcp.json)')).toBeInTheDocument();
    expect(inside.getByText(token)).toBeInTheDocument();
  });

  it('copies the message exactly as shown', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await issue();
    const field = screen.getByText('Message for Claude Code').parentElement as HTMLElement;
    fireEvent.click(within(field).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(claudeCodeMessage(snippets)));
  });

  it('revokes an agent and tells the page to refresh', async () => {
    apiMock.del.mockResolvedValue({ ...agent, revokedAt: '2026-11-08T11:00:00.000Z' });
    const onChange = vi.fn(async () => {});
    const { rerender } = render(<ConnectAgent agents={[agent]} onChange={onChange} />);
    expect(screen.getByText("Mara's assistant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(apiMock.del).toHaveBeenCalledWith(`/api/agents/${agent.id}`, expect.anything()),
    );
    expect(onChange).toHaveBeenCalled();
    rerender(<ConnectAgent agents={[]} onChange={onChange} />);
    expect(screen.queryByText("Mara's assistant")).toBeNull();
  });
});
