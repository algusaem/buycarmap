# Documentation

Start at [Getting started](getting-started.md) if you want the app running.
Everything else is indexed below.

Most of this documentation **does not exist yet**. The plan that builds it, and
its current status, is [documentation-plan.md](documentation-plan.md). Areas with
no governing doc are declared as gaps in the ownership map rather than quietly
omitted — `pnpm docs:check` lists them on every run.

## What lives where

Four artifacts, four jobs. Mixing them is how two sources of truth start
disagreeing, so the boundary is worth knowing before you write in any of them.

| | Owns | Enforced by |
| --- | --- | --- |
| [`docs/specs/`](specs/README.md) | What the software does, and why it is built that way | `pnpm spec:check` |
| `docs/` guides | How it fits together, how to run it, how to operate it | `pnpm docs:check` + `/check-all` |
| [`CLAUDE.md`](../CLAUDE.md) | Rules an agent must follow | `/check` |
| Code comments | Why *this line* is strange | Review |

**Every fact lives in exactly one file; everywhere else links to it.** When a doc
and a spec would say the same thing, the doc links to the spec — the enforced
copy wins.

## Index

| Doc | Covers |
| --- | --- |
| [getting-started.md](getting-started.md) | Clone to running app, env vars, worktrees and branch databases, commands, troubleshooting |
| [architecture.md](architecture.md) | How the pieces fit: the search fan-out, sign-in and revocation, the write path, and the patterns that apply everywhere |
| [data-model.md](data-model.md) | The eleven Prisma models, what each defends against, and the migration rules |
| [frontend.md](frontend.md) | Map component structure, the design system and palette, theming, animation, i18n |
| [auth.md](auth.md) | One-page orientation on authentication. The detail is in the spec, by design |
| [operations.md](operations.md) | Deployment, security headers, the full env reference, Neon branch lifecycle, CI jobs and runbooks |
| [testing.md](testing.md) | The five test levels, MSW conventions, the environment traps, e2e and the coverage ratchet |
| [integrations/wallapop.md](integrations/wallapop.md) | The Wallapop contract, required headers, and the behaviour that is not in any response |
| [integrations/cochesnet.md](integrations/cochesnet.md) | The coches.net contract, taxonomy translation, and why its pins are approximate |
| [integrations/milanuncios.md](integrations/milanuncios.md) | Scraping `__INITIAL_PROPS__`, the Spanish-label tags, and the image size rule |
| [specs/README.md](specs/README.md) | The spec workflow, when one is required, the spec index |
| [decisions/](decisions/README.md) | ADRs for choices no single spec owns — and what each one beat |
| [documentation-plan.md](documentation-plan.md) | What documentation is planned, in what order, and why |
| [sdd-adoption-plan.md](sdd-adoption-plan.md) | How spec- and test-driven development were adopted. Complete; kept as the record of what was decided |

## Ownership map

Which doc governs a change to which source. `/check-all`'s documentation phase
reads this to answer "which docs does this change need?", and `pnpm docs:check`
asserts that every pattern matches real files, every named doc exists, and
**every tracked source file is claimed by at least one row** — not merely every
top-level directory, which was the original rule and let 38 files including
`proxy.ts` and every page route go unclaimed while the check stayed green.

A colocated test inherits its subject's row, so `lib/env.ts` covers
`lib/env.test.ts` without a second entry.

A **—** means the area has no governing doc yet. That is a tracked gap, not an
oversight: see [documentation-plan.md](documentation-plan.md) for which step
closes it. Do not point a gap at a loosely related file to make it look covered.

| Source | Governing doc |
| --- | --- |
| `app/api/wallapop/**` | [integrations/wallapop.md](integrations/wallapop.md) |
| `app/api/cochesnet/**` | [integrations/cochesnet.md](integrations/cochesnet.md) |
| `app/api/milanuncios/**` | [integrations/milanuncios.md](integrations/milanuncios.md) |
| `lib/wallapop/**` | [integrations/wallapop.md](integrations/wallapop.md) |
| `lib/cochesnet/**` | [integrations/cochesnet.md](integrations/cochesnet.md) |
| `lib/milanuncios/**` | [integrations/milanuncios.md](integrations/milanuncios.md) |
| `components/map/**` | [specs/map-and-search.md](specs/map-and-search.md) |
| `lib/hooks/**` | [specs/map-and-search.md](specs/map-and-search.md) |
| `app/favorites/**` | [specs/favorites.md](specs/favorites.md) |
| `components/favorites/**` | [specs/favorites.md](specs/favorites.md) |
| `app/actions/favorites.ts` | [specs/favorites.md](specs/favorites.md) |
| `lib/auth/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `lib/rate-limit.ts` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `lib/email/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `components/auth/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `components/account/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `lib/i18n/**` | [specs/cross-cutting.md](specs/cross-cutting.md) |
| `lib/geo/**` | [specs/cross-cutting.md](specs/cross-cutting.md) |
| `scripts/**` | [getting-started.md](getting-started.md) |
| `prisma/**` | [data-model.md](data-model.md) |
| `test/**` | [testing.md](testing.md) |
| `e2e/**` | [testing.md](testing.md) |
| `components/ui/**` | [frontend.md](frontend.md) |
| `components/hero/**` | [frontend.md](frontend.md) |
| `components/legal/**` | [frontend.md](frontend.md) |
| `app/globals.css` | [frontend.md](frontend.md) |
| `lib/validations/**` | [architecture.md](architecture.md) |
| `interfaces/**` | [architecture.md](architecture.md) |
| `types/**` | [architecture.md](architecture.md) |
| `app/actions/**` | [architecture.md](architecture.md) |
| `lib/env.ts` | [architecture.md](architecture.md) |
| `proxy.ts` | [architecture.md](architecture.md) |
| `lib/mock/**` | [architecture.md](architecture.md) |
| `lib/prisma.ts` | [data-model.md](data-model.md) |
| `prisma.config.ts` | [data-model.md](data-model.md) |
| `app/map/page.tsx` | [specs/map-and-search.md](specs/map-and-search.md) |
| `app/api/auth/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `app/login/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `app/register/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `app/account/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `app/forgot-password/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `app/reset-password/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `app/verify-email/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `app/confirm-email/**` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `components/AuthProvider.tsx` | [specs/auth-email-and-oauth.md](specs/auth-email-and-oauth.md) |
| `app/page.tsx` | [frontend.md](frontend.md) |
| `app/layout.tsx` | [frontend.md](frontend.md) |
| `app/palette/**` | [frontend.md](frontend.md) |
| `app/typography/**` | [frontend.md](frontend.md) |
| `app/privacy/**` | [frontend.md](frontend.md) |
| `app/terms/**` | [frontend.md](frontend.md) |
| `components/*.tsx` | [frontend.md](frontend.md) |
| `lib/animations.ts` | [frontend.md](frontend.md) |
| `lib/utils.ts` | [frontend.md](frontend.md) |
| `next.config.ts` | [operations.md](operations.md) |
| `vitest.config.ts` | [testing.md](testing.md) |
| `playwright.config.ts` | [testing.md](testing.md) |
| `eslint.config.mjs` | [getting-started.md](getting-started.md) |
| `postcss.config.mjs` | [getting-started.md](getting-started.md) |
| `.env.example` | [operations.md](operations.md) |
| `.github/**` | [operations.md](operations.md) |
| `.claude/commands/**` | [specs/README.md](specs/README.md) |
| `.claude/settings.json` | [getting-started.md](getting-started.md) |

## Contributing

The loop, end to end. Claude drives it; the one place it stops and waits is your
approval at step 2.

1. **Spec.** `/spec <feature>` drafts one from
   [`specs/_template.md`](specs/_template.md). Status `Draft`. No code yet.
2. **Approve it.** Status `Approved`. This is the only checkpoint where being
   wrong is still cheap.
3. **Failing tests.** `/spec-tests` writes one per acceptance criterion, each
   titled with its id (`FAV-3: …`). Confirm each fails *for the right reason*.
4. **Implement** until green. Change a test only to fix an expectation that was
   wrong, never to make a failure go away.
5. **Close the loop.** Fill in "Verified by", set Status `Implemented`, run
   `/check-all`.

Full conventions in [specs/README.md](specs/README.md).

### What CI enforces

`.github/workflows/test.yml`, on every push to master and every pull request:

| Step | Fails when |
| --- | --- |
| `pnpm lint` | ESLint complains |
| `pnpm spec:check` | An approved criterion has no test, or a test names a criterion no spec declares |
| `pnpm docs:check` | A doc link or referenced source path is broken, a doc is orphaned, or the ownership map does not resolve |
| `pnpm test:coverage` | A test fails, or coverage drops below the ratchet |

Pull requests also run Playwright. A nightly job runs the contract tests against
the real upstream APIs, which is the alarm for a source changing shape.

**`pnpm test:e2e:db` is not in CI.** Those round trips need a branch database and
a `NEON_API_KEY` secret, so they are a local pre-merge check — a green CI says
nothing about persistence.
