# Configuration consumer tests use the shared provider

## Context

W3 makes useAppConfig require AppConfigProvider. In addition to Layout and PayWithPayPal, the existing QuoteCard and StorefrontPage tests render payment controls. The storefront regression fails without the new provider.

## Decision

Use the plan's shared renderWithProviders helper in all four affected test files. Keep their assertions and existing session mocks. Group fixture project reads with catalog and quote request methods with quotes; configuration stays with session handlers.

## Alternatives considered

- Mock useAppConfig in the additional tests: hides the real consumer/provider integration.
- Allow a fallback fetch outside the provider: violates W3's explicit missing-provider error contract.

## Consequences

The existing storefront payment regression remains intact and exercises the shared configuration. No production behavior or fixture method changes are needed beyond the planned context and domain extraction.
