# APP_URL falls back to Render's own URL and must be https on Render

## Context

`APP_URL` drives the PayPal return and cancel URLs and the session cookie's `Secure` flag (`apps/backend/src/api/routes/session.ts`). The Blueprint decision of 2026-11-08 made it dashboard-owned (`sync: false`) because the first deploy runs on a Render URL that is only known once the service exists, and the domain comes later. An automated security review pointed out the fail-open edge: a forgotten or blank `APP_URL` would fall back to `http://localhost:3000`, which silently drops the cookie's `Secure` flag and skips the default-session-secret check, on a public host.

## Decision

1. `APP_URL` resolves in this order: the explicit value, then Render's `RENDER_EXTERNAL_URL` (the service's own `https://<service>.onrender.com`, injected by Render), then the local default `http://localhost:3000`.
2. When `RENDER_EXTERNAL_URL` is present the resolved `APP_URL` must be https; otherwise the backend refuses to start with `invalid_env` naming `APP_URL`.
3. `loadEnv` treats an empty string as unset for every variable, so `APP_URL=` in a `.env` or a blank dashboard field behaves like a missing variable instead of failing URL validation or disabling a default.
4. `RENDER_EXTERNAL_URL` is Render's variable, not ours: a trailing slash is normalised rather than refused, so the service can never be locked out by the shape of an injected value. `APP_URL`, which the operator types, keeps the strict no-trailing-slash rule.

## Alternatives considered

- **Keep `APP_URL` as a committed Blueprint value.** Rejected: the first deploy's URL is assigned by Render, and a Blueprint value is rewritten on every sync, so the later domain change would fight the file.
- **Derive the cookie's `Secure` flag from a separate production flag.** Rejected: one more variable to forget; the public origin already says whether the service is on https, and Render tells us when we are hosted.
- **Require https whenever `PAYPAL_MODE=sandbox`.** Rejected: Track I runs sandbox locally on `http://localhost` behind a tunnel, and PayPal accepts http localhost return URLs in sandbox.

## Consequences

On Render nothing needs to be typed for `APP_URL` until the domain is attached; the Blueprint keeps the variable dashboard-owned for that moment. Local behaviour is unchanged except for two variables whose empty value stopped being an error: `SESSION_SECRET=` falls back to the development default (still refused over https, so only plain-http local runs notice) and `PORT=` falls back to 3000 (before, it coerced to 0 and failed). `Env` gains an optional `RENDER_EXTERNAL_URL`; tests pin the fallback, the https rule, the blank-secret refusal on Render, the slash normalisation and the empty-means-unset rule. `infra/README.md`, `render.yaml` and `.env.example` describe the behaviour.
