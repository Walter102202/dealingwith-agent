import type { Quote } from '@dealingwith/contracts';
import { DEMO_QUOTES } from '../api/fixtures/quotes.js';

/** The first request of the demo script, word for word. */
export const DEMO_REQUEST = 'I need a per-branch view and a summary email every Monday.';

/** The fixture key for that request: the same substring the backend's demo agent matches. */
const DEMO_QUOTE_KEY = 'summary email every Monday';

const scripted = DEMO_QUOTES[DEMO_QUOTE_KEY];
if (!scripted) throw new Error(`The web fixtures lost the demo quote "${DEMO_QUOTE_KEY}".`);

/**
 * The quote that request produces (`docs/demo-script.md`, shot 3), taken from
 * the web fixtures so the landing and the in-browser demo cannot disagree. The
 * replay ends on it paid. It is a picture of the product, not a price: the
 * hosted engine computes the real one.
 */
export const DEMO_QUOTE: Quote = { ...scripted, status: 'paid' };

export const REPO_URL = 'https://github.com/Walter102202/dealingwith-agent';
export const MCP_GUIDE_URL = `${REPO_URL}/blob/main/docs/mcp.md`;
