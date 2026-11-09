# The product landing page lives at `/`, the demo storefront moves to `/store`

## Context

The design (section 7.7) put the storefront of the demo business, Andes Data Studio, at `/`. With the hosted demo at `https://dealingwith.si`, that made a fictional consultancy's shop the first thing a visitor or a judge sees: nothing on the page says what DealingWith is, why it matters or where PayPal fits. Judging weighs Design, Potential Impact, Innovation and Presentation as much as Technological Implementation, and judges are not required to run the project, so the product has to explain itself in the first screen.

## Decision

`/` is a landing page for the product (`apps/web/src/pages/LandingPage.tsx`, sections in `apps/web/src/landing/`): the promise, the change-order problem, how it works, the MCP door and the mandate outcomes, the PayPal flows, the provider dashboard, and doors into the demo. Its hero renders the real `QuoteCard` in a new read-only `preview` mode with the quote of demo request 1 (included US$0.00, extra US$80.00), typed once in `landing/demo-quote.ts` and parsed by `QuoteSchema` in a test, so the picture is the same object the product shows. The animation is CSS only and resolves to its final frame; with reduced motion only the final frame shows.

The storefront keeps its behaviour and moves to `/store`. Every link and redirect that meant "the storefront" (`RequireSession` for a client on a provider page, `session.tsx` for a client without projects, the "Back to the storefront" links) now points at `/store`; the header gains a "Storefront" link. The backend needs no change: the static fallback already serves `index.html` for any path.

The landing loads no AG Studio code and shows no dashboard screenshot: a local screenshot has no data and AG Studio's edit panels, and a picture with numbers we typed would not be the product. The four widgets are described in words.

## Alternatives considered

- **Landing at `/about`, storefront stays at `/`.** Rejected: zero risk to the demo, but a visitor never sees it.
- **Static mockups or illustrations in the hero.** Rejected: they drift from the product; the real component cannot.
- **A live request against the API from the landing.** Rejected: it depends on the model and the backend at the first paint, and spends model calls on every visit.

## Consequences

`docs/demo-script.md` shot 1 opens on the landing page instead of the storefront. Track W's rule "a client who opens a provider page goes to their own home" keeps its meaning with home = `/store`. A dashboard screenshot can be added later from the hosted demo once it holds the demo script's data.
