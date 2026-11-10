import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * `BrowserRouter` keeps the window's scroll position across routes, so a link
 * clicked halfway down the landing opened the next page halfway down. This
 * puts every new path at the top; a link to a `#section` keeps its anchor.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new path resets the scroll.
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
