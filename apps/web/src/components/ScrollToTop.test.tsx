import { act, render } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ScrollToTop } from './ScrollToTop.js';

describe('ScrollToTop', () => {
  it('scrolls to the top when the path changes', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { getByRole } = render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Link to="/store">Browse the storefront</Link>} />
          <Route path="/store" element={<p>Storefront</p>} />
        </Routes>
      </MemoryRouter>,
    );
    scrollTo.mockClear();
    act(() => getByRole('link').click());
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });
});
