import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AppConfigProvider } from '../api/config.js';

/** Tests that need a session keep their existing useSession mock. */
export function renderWithProviders(ui: ReactNode) {
  return render(
    <MemoryRouter>
      <AppConfigProvider>{ui}</AppConfigProvider>
    </MemoryRouter>,
  );
}
