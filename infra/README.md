# Deployment on Render

The Blueprint is [`render.yaml`](../render.yaml) at the repository root: one web service running the single Node process (API, MCP endpoint, PayPal webhooks, built web) and one Postgres instance. This page lists every environment variable and the order of operations for the first deploy. Policy: [`CONSTITUTION.md`](../CONSTITUTION.md) Article VIII; CI gates and rollback: [`docs/ci-cd.md`](../docs/ci-cd.md).

The hosted service is a working simulation, not a mock-up: real PayPal sandbox orders, authorizations, captures and signed webhooks, real model calls, real data in Postgres. Only the money (PayPal sandbox) and the identities (demo logins) are test data, until real authentication and PayPal live ship after the submission (decision `docs/decisions/2026-11-08-hosted-at-dealingwith-si-demo-mode-until-submission.md`). It goes live on the Render URL first; the domain `dealingwith.si` is attached later (last section).

Render deploys `main` only after the three CI checks pass on that commit (`autoDeployTrigger: checksPass`). Nothing deploys from a branch or a laptop.

## Environment variables

Values live only in Render. `sync: false` means the dashboard owns the value: it asks for it when the Blueprint is applied and never overwrites it afterwards; nothing in this repository holds a secret.

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
| `ANTHROPIC_API_KEY` | yes | Walter, dashboard | capped key, step 0. Also turns on the dashboard assistant, whatever `LLM_PROVIDER` says |
| `OPENAI_API_KEY` | yes | Walter, dashboard | capped key, step 0 |
| `APP_URL` | no | dashboard, only when the domain is attached | public origin of the service, no trailing slash. Empty, the backend uses Render's own `RENDER_EXTERNAL_URL` (`https://<service>.onrender.com`) and refuses any non-https value on Render. Set to `https://dealingwith.si` in the last section. PayPal return and cancel URLs derive from it |
| `DEMO_MODE` | no | Blueprint | `true`: seed the demo data on boot, enable the password-less demo logins and "Reset demo data". Anyone with the URL can enter as the demo client or provider: that is the judges' path, and it is why the model keys carry spend limits. Switch to `false` the day real authentication ships |
| `VITE_API_MODE` | no | Blueprint | `http`; read at build time |
| `VITE_AG_STUDIO_LICENSE` | yes | Walter, dashboard | AG Studio trial key; read at build time, empty shows a watermark on the dashboard |

`PORT` is injected by Render and read by the backend. `LLM_MODEL` is unset: the defaults are `claude-opus-5-5` and `gpt-6.1-sol` (`apps/backend/src/agent/provider.ts`). The dashboard assistant reads two optional variables, unset on Render: `ASSISTANT_MODEL` (default `claude-sonnet-5-5`) and `ASSISTANT_DAILY_TURN_LIMIT` (turns per UTC day across all visitors, default `400`, `0` turns the assistant off; decision `docs/decisions/2026-11-10-assistant-daily-turn-cap.md`). Each turn logs one `assistant.turn` line with its token usage.

## First deploy, in order

0. **Cap the model keys.** In the Anthropic and OpenAI consoles create keys dedicated to this service with a hard monthly spend limit (US$20 is plenty for judging). Revoke them when judging ends.
1. **Apply the Blueprint.** Render dashboard → New → Blueprint → this repository, branch `main`. Render reads `render.yaml`, creates the database and the service, and asks for every `sync: false` value: copy them from the local `.env` (PayPal credentials and the capped model keys; paste the AG Studio key if it exists). Leave `PAYPAL_WEBHOOK_ID` and `APP_URL` empty (an empty value is fine; never type a placeholder URL, PayPal would send buyers to it): the first is set in step 3, the second only when the domain is attached. Wait for the first deploy.
2. **Check the service.** Render names it `https://<service>.onrender.com` and the backend adopts that URL on its own. `https://<service>.onrender.com/healthz` answers `{"ok":true}`; `/login` renders; `/api/config` reports `"paypalMode":"sandbox"`.
3. **Register the hosted webhook.** In the PayPal developer dashboard, on the sandbox REST app, add a webhook for `https://<service>.onrender.com/api/webhooks/paypal` with the six events the backend handles: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.AUTHORIZATION.CREATED`, `PAYMENT.AUTHORIZATION.VOIDED`. Paste its id into `PAYPAL_WEBHOOK_ID`; redeploy. Pay demo request 1 on the hosted URL; the service log shows `webhook.processed`.
4. **Fund the demo mandate once.** Signed in as Mara on the hosted URL, "Authorize with PayPal" US$2,000.00 with the sandbox personal account. The mandate reads `active` and "Backed by PayPal authorization". As the provider, "Reset demo data" and confirm the funding survives. A sandbox authorization lives 29 days: re-authorize on 2026-11-30 so it covers judging (2026-12-01 to 2026-12-15).
5. **Check MCP from outside.** Issue an agent token in the hosted portal, then from a laptop:

   ```bash
   MCP_URL=https://<service>.onrender.com/mcp MCP_TOKEN=<token> pnpm --filter @dealingwith/backend mcp:smoke
   claude mcp add --transport http dealingwith https://<service>.onrender.com/mcp --header "Authorization: Bearer <token>"
   ```

   The smoke lists the nine tools and three services; Claude Code completes demo request 3 as `paid`; Claude Desktop lists the tools through the capability URL `https://<service>.onrender.com/mcp/<token>`. Record the date in `docs/mcp.md` and revoke the token.

## Day to day

- **Deploys** happen on their own when a commit on `main` has green CI and touches a path outside `buildFilter.ignoredPaths` in `render.yaml`; a commit that changes only documentation, tests or CI files does not deploy, and the live deploy stays on the previous commit. Watch them in the service's Events tab. To deploy anyway: Manual Deploy → Deploy latest commit (manual deploys ignore the filter).
- **Rollback**: service → Deploys → the previous live deploy → Rollback. Migrations run at boot and are additive, so the previous code runs against the newer schema. Then fix forward through a pull request.
- **Logs** are JSON lines with a request id; they never contain tokens or secrets. Filter on `msg` (`server.listening`, `request.completed`, `webhook.processed`, `webhook.rejected`). A rejected webhook logs why (`webhook_id_missing`, `headers_missing`, `body_not_json` or `verification_failed` with PayPal's `verificationStatus`), the `host` it arrived on, PayPal's `transmissionId` (the delivery's id in the dashboard's attempt history) and the body size, never the body. `db.not_ready` means the service started before Postgres accepted connections (the first Blueprint sync does this); the backend retries up to ten times, three seconds apart, before giving up.
- **Secrets rotate in the dashboard**, never in the repository. After rotating PayPal credentials, redeploy; the token cache is in memory.
- **Plans**: `0.5c-512mb` for the service and `0.1c-256mb` for Postgres are the smallest always-on plans in the Blueprint spec on 2026-11-08 (free instances spin down and would cold-start in front of a judge). Both run on the sponsor credits.
- **After the submission**: real authentication and onboarding first, then PayPal live with a PayPal Chile business account; `DEMO_MODE` goes to `false` the day authentication ships, and the demo seed with it.

## Attaching the domain later

Done on 2026-11-08: DNS at Hostinger (A `@` → `216.24.57.1`, CNAME `www` → `dealingwith-agent.onrender.com`, no AAAA), both names verified, `APP_URL=https://dealingwith.si`. The PayPal webhook stays on the Render host (`https://dealingwith-agent.onrender.com/api/webhooks/paypal`, id in `PAYPAL_WEBHOOK_ID`) because PayPal's sender does not reach the domain. Checked on 2026-11-09 with the same webhook id and the same event: resent to `https://dealingwith.si/api/webhooks/paypal`, PayPal's attempt history shows FAIL_SOFT seven minutes later and no request reached the service in sixteen; resent to the Render host, the service verified and processed it seven seconds later. From outside the two hosts are indistinguishable: same address, same certificate chain (Google Trust Services WE1) and TLS settings, DNS answered by Google and Cloudflare resolvers without error, and a POST from a laptop reaches the service on both (it shows up as `webhook.rejected` with the `host`). The 400 responses seen on 2026-11-08 overlapped with retries of the Render-host webhook deleted that evening and cannot be attributed to the domain. PayPal does not require the webhook host to match `APP_URL`, and no payment depends on the webhook: pay-now captures complete on the browser return and mandate captures complete server-side. Before PayPal live, retry the domain after any DNS change (for example moving the zone to Cloudflare) or take the FAIL_SOFT timestamps to Render and PayPal support. The steps stay here for the record; step 3 is the one not applied.

`dealingwith.si` is attached after the service runs on the Render URL. Best done before the video is recorded, because every hosted URL in the README, the video and the Devpost entry changes with it.

1. Declare it in the Blueprint through a pull request: `domains: [dealingwith.si]` under the service in `render.yaml` (Render adds `www.` with a redirect to the root). After the sync, the service's Custom Domains page shows the DNS records to create at the registrar (A records for the apex, a CNAME for `www`); create them and wait for "Verified" and the certificate.
2. Set `APP_URL` to `https://dealingwith.si` in the dashboard; redeploy. PayPal return and cancel URLs now point at the domain.
3. PayPal ties a webhook to its URL: in the PayPal developer dashboard add a webhook for `https://dealingwith.si/api/webhooks/paypal` with the same six events, put its id in `PAYPAL_WEBHOOK_ID`, redeploy, and pay one demo request to see `webhook.processed`. Remove the old webhook afterwards.
4. Update the hosted URL in `README.md`, `docs/mcp.md` and `docs/demo-script.md` through a pull request; re-issue any agent token whose snippet carried the old host.
