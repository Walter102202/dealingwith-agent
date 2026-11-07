# DealingWith Agent

**Turn service requests into paid work.**

A service business publishes its services and pricing rules once. Clients, or their AI agents, ask for work in plain language. The DealingWith Agent interprets the request against the contracted scope, prices it with deterministic rules, explains the price, and the client pays with PayPal. Humans use the web; agents use our MCP server. Both operate on the same versioned quotes and payments.

Built for the PayPal AI Hackathon (November 2026).

> **Status: work in progress.** The hosted demo, video and judge instructions will land here before submission.

## Documents

- Design: [`docs/design/2026-11-07-dealingwith-agent-mvp-design.md`](docs/design/2026-11-07-dealingwith-agent-mvp-design.md)
- Implementation plan: [`docs/plans/2026-11-07-dealingwith-agent-mvp-plan.md`](docs/plans/2026-11-07-dealingwith-agent-mvp-plan.md)
- Milestones: [`docs/milestones.md`](docs/milestones.md)
- Decisions: [`docs/decisions/`](docs/decisions/)
- Conventions for coding agents: [`AGENTS.md`](AGENTS.md)

## Development

```bash
pnpm install
pnpm dev        # backend with tsx watch
pnpm test       # vitest, all workspaces
pnpm lint       # biome
pnpm typecheck  # tsc --noEmit in every package
```

Everything runs locally without credentials: `PAYPAL_MODE=mock`, `LLM_PROVIDER=mock` and an embedded PostgreSQL (PGlite). Copy `.env.example` to `.env` to change defaults.

## License

MIT. See [`LICENSE`](LICENSE).
