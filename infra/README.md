# Deployment on Render

The service is public at **https://dealingwith.si**. Until the submission it runs in demo mode: password-less demo logins, demo seed, "Reset demo data", PayPal sandbox; every flow is the real one, only the money and the identities are test data. Real authentication and PayPal live come right after the submission (decision `docs/decisions/2026-11-08-hosted-at-dealingwith-si-demo-mode-until-submission.md`).

The Blueprint is [`render.yaml`](../render.yaml) at the repository root: one web service running the single Node process (API, MCP endpoint, PayPal webhooks, built web) and one Postgres instance. This page lists every environment variable and the order of operations for the first deploy. Policy: [`CONSTITUTION.md`](../CONSTITUTION.md) Article VIII; CI gates and rollback: [`docs/ci-cd.md`](../docs/ci-cd.md).

Render deploys `main` only after the three CI checks pass on that commit (`autoDeployTrigger: checksPass`). Nothing deploys from a branch or a laptop.

## Environment variables

Values live only in Render. `sync: false` means the dashboard asks for the value when the Blueprint is applied; nothing in this repository holds a secret.

| Variable | Secret | Set by | Value |
|---|---|---|---|
| `NODE_VERSION` | no | Blueprint | `22` |
| `COREPACK_ENABLE_DOWNLOAD_PROMPT` | no | Blueprint | `0`, so corepack installs the pinned pnpm without asking |
| `DATABASE_URL` | yes | Render, from the database | internal connection string (`postgresql://…`, no SSL needed inside Render) |
| `SESSION_SECRET` | yes | Render, generated | random; the backend refuses the development default over HTTPS |
| `PAYPAL_MODE` | no | Blueprint | `sandbox` |
| `PAYPAL_CLIENT_ID` | yes | Walter, dashboard | REST app of the sandbox US business account |
| `PAYPAL_CLIENT_SECRET` | yes | Walter, dashboard | same REST app |
| `PAYPAL_WEBHOOK_ID` | yes | Walter, dashboard, after step 3 | id of the webhook registered to the hosted URL; while empty every webhook is rejected and the boot log warns `paypal.webhook_id_missing` |
| `LLM_PROVIDER` | no | Blueprint | `anthropic` (switch to `openai` to demo the other provider; both keys stay set) |
| `ANTHROPIC_API_KEY` | yes | Walter, dashboard | |
| `OPENAI_API_KEY` | yes | Walter, dashboard | |
| `APP_URL` | no | Blueprint | `https://dealingwith.si`, no trailing slash; PayPal return and cancel URLs derive from it |
| `DEMO_MODE` | no | Blueprint | `true`: seed the demo data on boot, enable the password-less demo logins and "Reset demo data". Anyone with the URL can enter as the demo client or provider: that is the judges' path, and it is why the model keys carry spend limits. Switch to `false` the day real authentication ships |
| `VITE_API_MODE` | no | Blueprint | `http`; read at build time |
| `VITE_AG_STUDIO_LICENSE` | yes | Walter, dashboard | AG Studio trial key; read at build time, empty shows a watermark on the dashboard |

`PORT` is injected by Render and read by the backend. `LLM_MODEL` is unset: the defaults are `claude-opus-5-5` and `gpt-6.1-sol` (`apps/backend/src/agent/provider.ts`).

## First deploy, in order

0. **Cap the model keys.** In the Anthropic and OpenAI consoles create keys dedicated to this service with a hard monthly spend limit (US$20 is plenty for judging). Revoke them when judging ends.
1. **Apply the Blueprint.** Render dashboard → New → Blueprint → this repository, branch `main`. Render reads `render.yaml`, creates the database and the service, and asks for every `sync: false` value: copy them from the local `.env` (PayPal credentials and the capped model keys; leave `PAYPAL_WEBHOOK_ID` empty for now, paste the AG Studio key if it exists). Wait for the first deploy.
2. **Attach the domain.** Service → Settings → Custom Domains → add `dealingwith.si` and `www.dealingwith.si`. Render shows the DNS records to create at the registrar: A records for the apex and a CNAME for `www` pointing at the service; create them and wait for "Verified" and the certificate. `APP_URL` is already `https://dealingwith.si`, so nothing else changes.
3. **Check the service.** `https://dealingwith.si/healthz` answers `{"ok":true}`; `/login` renders; `/api/config` reports `"paypalMode":"sandbox"`.
4. **Register the hosted webhook.** In the PayPal developer dashboard, on the sandbox REST app, add a webhook for `https://dealingwith.si/api/webhooks/paypal` with the same six events as the local one (`docs/paypal-notes.md`). Paste its id into `PAYPAL_WEBHOOK_ID`; redeploy. Pay demo request 1 on the hosted URL; the service log shows `webhook.processed`.
5. **Fund the demo mandate once.** Signed in as Mara on the hosted URL, "Authorize with PayPal" US$2,000.00 with the sandbox personal account. The mandate reads `active` and "Backed by PayPal authorization". As the provider, "Reset demo data" and confirm the funding survives. A sandbox authorization lives 29 days: re-authorize on 2026-11-30 so it covers judging (2026-12-01 to 2026-12-15).
6. **Check MCP from outside.** Issue an agent token in the hosted portal, then from a laptop:

   ```bash
   MCP_URL=https://dealingwith.si/mcp MCP_TOKEN=<token> pnpm --filter @dealingwith/backend mcp:smoke
   claude mcp add --transport http dealingwith https://dealingwith.si/mcp --header "Authorization: Bearer <token>"
   ```

   The smoke lists the nine tools and three services; Claude Code completes demo request 3 as `paid`; Claude Desktop lists the tools through the capability URL `https://dealingwith.si/mcp/<token>`. Record the date in `docs/mcp.md` and revoke the token.

## Day to day

- **Deploys** happen on their own when a commit on `main` has green CI. Watch them in the service's Events tab.
- **Rollback**: service → Deploys → the previous live deploy → Rollback. Migrations run at boot and are additive, so the previous code runs against the newer schema. Then fix forward through a pull request.
- **Logs** are JSON lines with a request id; they never contain tokens or secrets. Filter on `msg` (`server.listening`, `request.completed`, `webhook.processed`).
- **Secrets rotate in the dashboard**, never in the repository. After rotating PayPal credentials, redeploy; the token cache is in memory.
- **After the submission**: real authentication and onboarding first, then PayPal live with a PayPal Chile business account; `DEMO_MODE` goes to `false` the day authentication ships, and the demo seed with it.
- **Plans**: `0.5c-512mb` for the service and `0.1c-256mb` for Postgres are the smallest always-on plans in the Blueprint spec on 2026-11-08 (free instances spin down and would cold-start in front of a judge). Both run on the sponsor credits.
