# Hosted at dealingwith.si from the first deploy, in demo mode until the submission

## Context

The hosted service was planned on a Render URL with `DEMO_MODE=true` (design section 10, plan Task I4). On 2026-11-08 Walter stated that the product is deployed on the domain he bought, `dealingwith.si`, and must work end to end as real use, test cases allowed. An automated security review had flagged `DEMO_MODE=true` on a public host: it enables the password-less "Enter as client" and "Enter as provider" logins and the provider's "Reset demo data".

Two facts frame the decision. First, demo logins are the only way to sign in: the approved design left self-service onboarding and real authentication out of the MVP (design section 3; `docs/roadmap.md`). Switching `DEMO_MODE` off would lock everyone out, judges included. Second, PayPal sandbox moves test money only; live mode needs a PayPal Chile business account and is also in the roadmap.

## Decision

1. The service lives at `https://dealingwith.si` from the first deploy: the custom domain is attached to the Render service before anything else is configured, so `APP_URL`, the PayPal return and cancel URLs and the webhook never change.
2. Until the hackathon submission (2026-11-12) and through judging (2026-12-01 to 2026-12-15) the service runs with `DEMO_MODE=true`: demo logins, demo seed, "Reset demo data", PayPal sandbox. Every flow is the real one; only the money and the identities are test data.
3. The model API keys used by the service carry hard spend limits in the Anthropic and OpenAI consoles, because anyone who finds the URL can create requests that call a model. The keys are revoked when judging ends.
4. After the submission, the first post-hackathon work is real authentication and onboarding, then PayPal live. `DEMO_MODE` is switched off the day real authentication ships.

## Alternatives considered

- **`DEMO_MODE=false` on the domain now.** Rejected: nobody could sign in; the hackathon README promises one-click demo logins and a reset to the scripted state.
- **Build real authentication before the submission.** Rejected for now: about a day of work that the plan does not have before 2026-11-12, and judges would still need the demo path. Walter chose "demo now, authentication after".
- **Two services, a demo one and a real one.** Rejected: the second one would have no users until authentication exists; one service with a documented mode switch is simpler.
- **Ship on the Render URL and move to the domain later.** Rejected: moving changes `APP_URL`, the webhook registration and every link in the README and the video.

## Consequences

- `render.yaml` sets `APP_URL=https://dealingwith.si`; `infra/README.md` gains the domain step (Render custom domain plus DNS records) before the webhook step, the spend-limit instruction, and the post-hackathon switch.
- The README's "Known limits" keep saying sandbox only and demo sessions; nothing there changes.
- `docs/roadmap.md`: the custom domain stops being a roadmap item; real authentication and live mode move to the top of the list.
- Review finding on `DEMO_MODE` closed as accepted risk with mitigation, by Walter's decision.
