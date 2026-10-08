# Processors

Every external service that receives personal data from BuyCarMap, and what it
receives. What is stored, and for how long, is in
[data-inventory.md](data-inventory.md).

Neon's region was measured through the Neon API, 2026-09-28. Every other region and DPA cell was
measured on 2026-10-04, against each processor's own published documentation or legal notice
(ENV-7, `docs/specs/core-environments.md`) — the Resend dashboard for Resend, and
official docs or a legal notice for the rest.

| Processor | Region | Data received | DPA |
| --- | --- | --- | --- |
| Neon | `aws-eu-central-1` | The whole database: every field in the inventory | [neon.com/dpa](https://neon.com/dpa) |
| Vercel | Functions pinned to `fra1` (Frankfurt, `vercel.json`, ENV-2); the edge network (static assets, routing) is global | Hosting: every request, including the client IP the rate limiter reads (`server/rate-limit/service.ts`) | [vercel.com/legal/dpa](https://vercel.com/legal/dpa) |
| Resend | `us-east-1` (North Virginia), the region of the verified sending domain `algusaem.com` as shown in the Resend dashboard on 2026-10-05. A Resend domain's region is fixed when it is created | The recipient's email address and the email content: account emails and alert digests | [resend.com/legal/dpa](https://resend.com/legal/dpa) |
| Google | Not published for OAuth sign-in specifically (operator: Google Ireland Limited, Ireland, for EEA/UK/Swiss users; Google LLC, United States, otherwise) | OAuth sign-in, for users who choose it | [Google Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum) |
| GitHub | Not published (operator: GitHub, Inc., United States) | OAuth sign-in, for users who choose it | [GitHub Data Protection Agreement](https://github.com/customer-terms/github-data-protection-agreement) |
| Have I Been Pwned | Not published (served from Cloudflare's global edge network; operator: Superlative Enterprises Pty Ltd, Australia) | The first 5 hex characters of the SHA-1 of a new password, never the password (`lib/auth/pwned.ts`) | [haveibeenpwned.com/DPA](https://haveibeenpwned.com/DPA) |
| OpenStreetMap Nominatim | Not published (operator: OpenStreetMap Foundation, United Kingdom) | The location the user types, sent straight from the browser (`lib/geo/nominatim.ts`) | Not applicable — the free community instance has no customer agreement to attach one to |
| CARTO | Not published (this project uses the basemap tile CDN, `cartocdn.com`, with a Basemaps API key — not a CARTO Cloud account with a selectable region) | Map tile requests from the browser, which reveal the area being viewed and carry the project's Basemaps API key (`components/map/ListingsMap.tsx`) | [CARTO Personal Data Processing Agreement](https://carto.com/legal/pdpa) — applies to Basemap Services use with no separate signature |
| Wallapop | Not published (operator: Wallapop, S.L., Spain) | The search filters, and `latitude`/`longitude` on every search: the chosen location, the browser's position or the Spain-centre fallback (`lib/wallapop/client.ts`) | Not applicable — a public API call, no processor agreement with this project |
| coches.net | Not published (operator: Adevinta Spain, S.L.U., Spain) | The search filters | Not applicable — a public API call, no processor agreement with this project |
| Milanuncios | Not published (operator: Adevinta Spain, S.L.U., Spain) | The search filters | Not applicable — a public API call, no processor agreement with this project |
| Sentry | EU (Frankfurt, Germany) | Error events: stack traces, the request URL and the `request_id` correlation tag only. No cookies, headers, request bodies, query strings, user identity (session, email, IP), database query data or stack-frame local variables are sent — `dataCollection` (`lib/sentry-privacy.ts`, `lib/sentry.ts`) turns all of them off, SDK 11's replacement for `sendDefaultPii: false`. Retention is Sentry's plan default. Inert with no `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` set | [sentry.io/legal/dpa/5.0.0](https://sentry.io/legal/dpa/5.0.0) |
| Upstash | EU (Frankfurt) | **Redis** (`lib/platform/rate-limit.ts`): the client IP on every rate-limit key, and an `:email:` segment as the sha256 hex of the lowercased address — never the address itself. Kept at most the longest rule's window (1 hour, `RATE_LIMITS.resetRequestPerIp`/`resetRequestPerEmail`/`changePasswordPerUser` etc. in `server/rate-limit/service.ts`), since each key carries its own TTL. **QStash** (`scripts/qstash-schedule.mjs`, `lib/platform/qstash.ts`): only the alert runner's schedule (cron, destination URL, retry count) and, per invocation, the fact that `/api/alerts/run` was called — no user fields ever reach it. [ADR 0017](../decisions/0017-upstash-qstash-react-email.md) | [upstash.com/trust/dpa.pdf](https://upstash.com/trust/dpa.pdf) |

Cloudinary, which `STACK.md` §12 lists, is not used by this project.

The upstream marketplaces are reached through this app's proxy routes, so they
see the server's address, not the user's.

**The in-app privacy page is incomplete.** It does not list Resend, Vercel,
Google, GitHub or Have I Been Pwned
([#22](https://github.com/algusaem/buycarmap/issues/22)).
