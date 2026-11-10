import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingHeader } from './LandingHeader.js';

type Callback = (entries: Array<{ target: { id: string }; isIntersecting: boolean }>) => void;

/** Captures the header's observer callback so a test can move sections in and out of the band. */
function fakeObserver() {
  const holder: { callback: Callback | null } = { callback: null };
  class FakeIntersectionObserver {
    constructor(callback: Callback) {
      holder.callback = callback;
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  return (id: string, isIntersecting: boolean) =>
    act(() => holder.callback?.([{ target: { id }, isIntersecting }]));
}

describe('LandingHeader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const node of document.querySelectorAll('body > section')) node.remove();
  });

  it('marks the section in view and clears it when the reader leaves every section', () => {
    for (const id of ['how-it-works', 'for-agents', 'paypal', 'for-providers']) {
      const node = document.createElement('section');
      node.id = id;
      document.body.append(node);
    }
    const move = fakeObserver();
    render(
      <MemoryRouter>
        <LandingHeader cta={{ to: '/login', label: 'Try the live demo' }} />
      </MemoryRouter>,
    );
    const how = screen.getByRole('link', { name: 'How it works' });

    move('how-it-works', true);
    expect(how).toHaveAttribute('aria-current', 'location');

    // Back up to the hero: nothing is in the band.
    move('how-it-works', false);
    expect(how).not.toHaveAttribute('aria-current');

    // Past the last section, into the invitation and the footer.
    move('for-providers', true);
    expect(screen.getByRole('link', { name: 'Providers' })).toHaveAttribute('aria-current');
    move('for-providers', false);
    expect(screen.getByRole('link', { name: 'Providers' })).not.toHaveAttribute('aria-current');
  });
});
