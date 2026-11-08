# Hosted on Render first, dealingwith.si later, demo mode until the submission

## Context

The hosted service was planned on a Render URL with `DEMO_MODE=true` (design section 10, plan Task I4). On 2026-11-08 Walter stated that the product will live on the domain he bought, `dealingwith.si`, and must work end to end as real use, test cases allowed; the domain is attached after the first deploy, not before (who configures it is settled when David's part is defined). An automated security review had flagged `DEMO_MODE=true` on a public host: it enables the password-less "Enter as client" and "Enter as provider" logins and the provider's "Reset demo data".

Two facts frame the decision. First, demo logins are the only way to sign in: the approved design left self-service onboarding and real authentication out of the MVP (design section 3; `docs/roadmap.md`). Switching `DEMO_MODE` off would lock everyone out, judges included. Second, PayPal sandbox moves test money only; live mode needs a PayPal Chile business account and is also in the roadmap.

## Decision

1. The first deploy runs on the Render URL. `APP_URL` is a dashboard-owned variable (`sync: false` in `render.yaml`): it is set to the Render URL after the first deploy names the service, and later to `https://dealingwith.si` when the domain is attached. A Blueprint-managed `value:` would be rewritten on every Blueprint sync and would have to guess the subdomain Render assigns.
2. Attaching the domain is a documented, separate step (`infra/README.md`, "Attaching the domain later"): custom domain in Render, DNS records, `APP_URL` changed, the PayPal webhook re-registered to the domain URL because PayPal ties a webhook to its URL, README links updated.
3. Until the hackathon submission (2026-11-12) and through judging (2026-12-01 to 2026-12-15) the service runs with `DEMO_MODE=true`: demo logins, demo seed, "Reset demo data", PayPal sandbox. Every flow is the real one; only the money and the identities are test data.
4. The model API keys used by the service carry hard spend limits in the Anthropic and OpenAI consoles, because anyone who finds the URL can create requests that call a model. The keys are revoked when judging ends.
5. After the submission, the first post-hackathon work is real authentication and onboarding, then PayPal live. `DEMO_MODE` is switched off the day real authentication ships.

## Alternatives considered

- **Domain attached before the first deploy, `APP_URL` fixed to it in the Blueprint.** Proposed first and rejected by Walter: the domain comes later and the first deploy must not wait for it.
- **`DEMO_MODE=false` on the public host now.** Rejected: nobody could sign in; the hackathon README promises one-click demo logins and a reset to the scripted state.
- **Build real authentication before the submission.** Rejected for now: about a day of work the plan does not have before 2026-11-12, and judges would still need the demo path. Walter chose "demo now, authentication after".
- **Two services, a demo one and a real one.** Rejected: the second one would have no users until authentication exists; one service with a documented mode switch is simpler.

## Consequences

- `render.yaml`: `APP_URL` is `sync: false`; `infra/README.md` gains step 0 (capped keys), the `APP_URL` step after the first deploy, and the section for attaching the domain later, which includes re-registering the webhook.
- Until the domain is attached, every hosted URL in the README, the video and the Devpost entry is the Render URL; attaching the domain means updating them, so it is best done before the video is recorded if it happens at all before the submission.
- The README's "Known limits" keep saying sandbox only and demo sessions; nothing there changes.
- `docs/roadmap.md`: real authentication and live mode move to the top of the post-hackathon list; the custom domain stays listed until it is attached.
- Review finding on `DEMO_MODE` closed as accepted risk with mitigation, by Walter's decision.
