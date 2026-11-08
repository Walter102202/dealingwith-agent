import type { ClientAgent } from '@dealingwith/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { ConnectAgent } from './ConnectAgent.js';

const token = `dwa_${'a'.repeat(43)}`;
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

  it('issues a token once and shows the three connection snippets', async () => {
    apiMock.post.mockResolvedValue({
      token,
      agent,
      snippets: {
        claudeDesktop: 'desktop snippet',
        claudeCode: 'code snippet',
        cursor: 'cursor snippet',
      },
    });
    const onChange = vi.fn(async () => {});
    render(<ConnectAgent agents={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect my agent' }));
    fireEvent.change(screen.getByLabelText('Name for this agent'), {
      target: { value: "Mara's assistant" },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText(token)).toBeInTheDocument();
    expect(screen.getByText('Copy it now; it is not shown again.')).toBeInTheDocument();
    expect(screen.getByText('Claude Desktop')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Cursor')).toBeInTheDocument();
    expect(apiMock.post).toHaveBeenCalledWith(
      '/api/agents',
      { label: "Mara's assistant" },
      expect.anything(),
    );
    expect(onChange).toHaveBeenCalled();
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
