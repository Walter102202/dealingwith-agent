import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './client.js';
import { AppConfigProvider, useAppConfig } from './config.js';

vi.mock('./client.js', () => ({ api: { get: vi.fn() } }));

function Consumer() {
  const config = useAppConfig();
  return <p>{config.data?.appUrl ?? 'Loading'}</p>;
}

describe('AppConfigProvider', () => {
  afterEach(() => vi.clearAllMocks());

  it('fetches config once for two consumers', async () => {
    vi.mocked(api.get).mockResolvedValue({
      paypalMode: 'mock',
      appUrl: 'http://localhost:5174',
      demoMode: true,
    });
    render(
      <AppConfigProvider>
        <Consumer />
        <Consumer />
      </AppConfigProvider>,
    );
    expect(await screen.findAllByText('http://localhost:5174')).toHaveLength(2);
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/config', expect.anything());
  });

  it('requires a provider', () => {
    expect(() => render(<Consumer />)).toThrow(
      'useAppConfig must be used inside AppConfigProvider',
    );
  });
});
