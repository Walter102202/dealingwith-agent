/** Full-page navigation (PayPal approval pages leave the app). One place, so tests can spy on it. */
export function assign(url: string): void {
  window.location.assign(url);
}
