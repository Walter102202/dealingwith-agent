import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '../session.js';

const sessionMock = vi.hoisted(() => ({ current: {} as unknown }));
vi.mock('../session.js', () => ({ useSession: () => sessionMock.current }));
vi.mock('./Layout.js', () => ({ Layout: ({ children }: { children: ReactNode }) => children }));

import { RequireSession } from './RequireSession.js';

describe('RequireSession', () => {
  it.each([
    { role: null, as: 'client', status: 'ready', expected: '/login' },
    { role: 'provider', as: 'client', status: 'ready', expected: '/dashboard' },
    { role: 'client', as: 'provider', status: 'ready', expected: '/store' },
    { role: 'client', as: 'client', status: 'ready', expected: 'Protected content' },
    { role: null, as: 'client', status: 'loading', expected: 'Loading…' },
  ] as const)('$role / $as / $status → $expected', ({ role, as, status, expected }) => {
    sessionMock.current = { session: role ? { role } : null, status };
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={<RequireSession as={as as Role}>Protected content</RequireSession>}
          />
          <Route path="/login" element={<p>/login</p>} />
          <Route path="/dashboard" element={<p>/dashboard</p>} />
          <Route path="/store" element={<p>/store</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
