# Processors

Every external service that receives personal data from BuyCarMap, and what it
receives. What is stored, and for how long, is in
[data-inventory.md](data-inventory.md).

Only Neon's region has been measured (through the Neon API, 2026-09-28). The
regions of the other processors and every data processing agreement are recorded
in phase 12 of [ADR 0007](../decisions/0007-adopt-core-rules.md); until then
those cells read "phase 12".

| Processor | Region | Data received | DPA |
| --- | --- | --- | --- |
| Neon | `aws-eu-central-1` | The whole database: every field in the inventory | phase 12 |
| Vercel | phase 12 | Hosting: every request, including the client IP the rate limiter reads (`server/rate-limit/service.ts`) | phase 12 |
| Resend | phase 12 | The recipient's email address and the email content: account emails and alert digests | phase 12 |
| Google | phase 12 | OAuth sign-in, for users who choose it | phase 12 |
| GitHub | phase 12 | OAuth sign-in, for users who choose it | phase 12 |
| Have I Been Pwned | phase 12 | The first 5 hex characters of the SHA-1 of a new password, never the password (`lib/auth/pwned.ts`) | phase 12 |
| OpenStreetMap Nominatim | phase 12 | The location the user types, sent straight from the browser (`lib/geo/nominatim.ts`) | phase 12 |
| CARTO | phase 12 | Map tile requests from the browser, which reveal the area being viewed (`components/map/ListingsMap.tsx`) | phase 12 |
| Wallapop | phase 12 | The search filters, and `latitude`/`longitude` on every search: the chosen location, the browser's position or the Spain-centre fallback (`lib/wallapop/client.ts`) | phase 12 |
| coches.net | phase 12 | The search filters | phase 12 |
| Milanuncios | phase 12 | The search filters | phase 12 |
| GitHub Actions | phase 12 | Runs the alert cron, which POSTs to `/api/alerts/run`. The response it receives carries no user fields | phase 12 |

Upstash, Cloudinary and Sentry, which `STACK.md` §12 lists, are not used by
this project.

The upstream marketplaces are reached through this app's proxy routes, so they
see the server's address, not the user's.

**The in-app privacy page is incomplete.** It does not list Resend, Vercel,
Google, GitHub or Have I Been Pwned
([#22](https://github.com/algusaem/buycarmap/issues/22)).
