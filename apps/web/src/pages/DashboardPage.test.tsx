import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const sessionMock = vi.hoisted(() => ({ name: 'Andes Data Studio' }));
vi.mock('../session.js', () => ({
  useSession: () => ({
    session: { role: 'provider', businessId: 'business', name: sessionMock.name },
    status: 'ready',
  }),
}));
vi.mock('../components/Layout.js', () => ({
  Layout: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../api/client.js', () => ({
  api: { get: vi.fn(async () => null) },
  errorMessage: String,
}));
vi.mock('ag-studio-react', () => ({ AgStudio: () => null, AgStudioProvider: () => null }));
vi.mock('../dashboard/assistant/useDashboardAssistant.js', () => ({
  useDashboardAssistant: () => ({}),
}));

import DashboardPage from './DashboardPage.js';

describe('DashboardPage header', () => {
  it.each(['Andes Data Studio', 'Other Studio'])('uses the provider session name: %s', (name) => {
    sessionMock.name = name;
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(name);
  });
});
