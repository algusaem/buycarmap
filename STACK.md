# STACK.md

Technologies and code patterns for our web projects. Install these, follow these.

CRM/ERP projects also follow [`STACK-ERP.md`](STACK-ERP.md), which adds to this file and never
replaces it.

Deviations need an ADR in `docs/decisions/`.

---

## 0. How we work

**We develop spec-driven and test-driven: spec → tests → code.** Every feature starts as a
written spec approved before any code; its tests are written from the spec before the
implementation. **TDD applies to everything** — UI, CRUD and glue code included, not only the
critical list. Artifact definitions and templates are in **§15 — read it before writing the
first feature.**

This applies from the first commit, not once a project is "big enough." Retrofitting specs
and tests onto an existing surface never happens.

### Starting a new project

There is no template to clone. A new project is built from this core (`algusaem-claude`) by the
agent, with `/new-project` — installed at user level by `node install.mjs`, since the project
doesn't exist yet. It holds every step and its check: scaffold, baseline dependencies (§1), the
core, structure and tooling (§2–§16), Impeccable (§17), repository and deployment. The agent does
every step itself: where one needs an account, it uses the user's authenticated CLI or asks for
that login or key — it never skips the step or leaves it as a note. `pnpm check` and CI are green
on the empty project before the first feature, which starts with its spec (§15).

---

## 1. Dependencies

**This is a menu, not a manifest.** Install the baseline, then add from the on-demand list
when the feature that needs it is actually being built. An unused dependency is a security
surface, an upgrade cost, and a knip failure. When something *is* needed, take it from here
rather than picking an alternative.

### Baseline — every project, installed when it is created (§0)

```
# core
next react react-dom typescript
@prisma/client prisma @prisma/adapter-neon @prisma/adapter-pg
better-auth

# ui
tailwindcss @tailwindcss/postcss motion
# shadcn/ui via `pnpm dlx shadcn@latest init` — components live in-repo
class-variance-authority clsx tailwind-merge lucide-react sonner
@tanstack/react-table nuqs

# validation & config
zod react-hook-form @hookform/resolvers @t3-oss/env-nextjs

# i18n & formatting
next-intl date-fns @date-fns/tz

# rate limiting (also Better Auth's secondary storage)
@upstash/redis @upstash/ratelimit

# email (auth flows need it from day one)
resend react-email @react-email/components

# observability
@sentry/nextjs pino pino-pretty

# dev — tooling
@biomejs/biome dependency-cruiser knip type-coverage plop
husky lint-staged @commitlint/cli @commitlint/config-conventional
impeccable

# dev — testing
vitest @vitest/coverage-v8 @vitejs/plugin-react
testcontainers @testcontainers/postgresql
msw @faker-js/faker
@playwright/test @axe-core/playwright
```

### On-demand — install with the feature, not before

| Trigger | Install |
|---|---|
| First image upload | `cloudinary` |
| First non-image file (PDF, attachment, export) | `@aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (Cloudflare R2) |
| First job needing a queue, retries or a schedule | `@upstash/qstash` |
| First generated PDF | `@react-pdf/renderer` |
| First xlsx export / CSV import | `xlsx` / `papaparse` |
| First chart | `recharts` |
| Command palette | `cmdk` |
| Phone number fields | `libphonenumber-js` |
| Logic with invariants (money, allocation, ordering) | `fast-check` |
| Schema documentation wanted | `prisma-erd-generator` |

Package manager **pnpm**, version pinned in the `packageManager` field. Node pinned in
`.nvmrc` and `engines`, at 22.18 or later (Impeccable requires it). Deployment **Vercel**;
database **Neon**. No Dockerfile — `docker-compose.dev.yml` holds the local services only
(Postgres and whatever else the project needs), so anyone can run the project with just
Docker installed.

Anything not on either list needs an ADR before it goes in `package.json`.

### Do not install

| Instead of | Use | Why |
|---|---|---|
| next-auth / Auth.js | Better Auth | Sessions, rate limiting and MFA without glue code |
| Inngest, pg-boss, BullMQ | `after()` + QStash | Long-lived workers don't exist on Vercel; QStash only when a queue or retries are needed |
| In-memory rate limiting | Upstash Redis | Vercel functions don't share memory |
| Algolia, Elastic, Meilisearch | Postgres `pg_trgm` + `tsvector` | Adequate at our scale, nothing to sync |
| ECharts | Recharts | One charting library |
| AG Grid | TanStack Table | Licensed and heavy; only for genuine daily bulk inline editing |
| Vercel Blob | Cloudinary (images), Cloudflare R2 (other files) | No host lock-in, no egress fees on R2 |
| ESLint + Prettier | Biome | One tool, one config |
| lefthook | Husky + lint-staged | One hook runner |
| moment, dayjs | date-fns | Already here |
| neverthrow | hand-rolled `Result` | 20 lines, no API to learn |
| TanStack Query for server data | Server Components + Server Actions | Reads and mutations already live on the server |
| localStorage for server state | server + nuqs | |

---

## 2. Environments and deployment

| Environment | Deploys | Database |
|---|---|---|
| Production | `main` | Neon main branch |
| Staging | own Vercel environment | Neon branch with anonymized, production-shaped data |
| Preview | every PR, automatically | Neon branch per preview, created from a seed-only parent branch |
| Local | `pnpm dev` | Postgres in Docker Compose |

- **Previews and E2E never see real data.** Preview branches are created from the seed parent,
  never from production.
- **Staging never holds real personal data.** The anonymization procedure lives in
  `docs/operations/staging.md`. Staging exists to test migrations and queries at real volume.
- **EU regions on every provider that allows it**: Vercel functions, Neon, Upstash, Resend,
  Cloudinary, Sentry, and any on-demand provider (R2) once installed.
- The Postgres major version in Docker Compose and Testcontainers matches Neon's.
- **Backups and point-in-time restore via Neon.** The retention window depends on the plan and
  is documented in `docs/privacy/deletion.md`; the restore procedure in
  `docs/operations/backups.md`.
- **Health checks**: `/api/health` (app alive, never touches the DB) for the uptime monitor;
  `/api/health/db` checks the DB on demand only — frequent calls would stop Neon scaling to zero.

---

## 3. Migrations and seeds

Vercel build command: `prisma migrate deploy && next build`. Each preview applies its
migrations on its own Neon branch before building; production applies them when `main`
deploys. Migrations use the direct Neon connection (`DIRECT_URL`); runtime uses the pooled one
(`DATABASE_URL`).

**Production migrations are applied before the new code is live**, so every migration must be
compatible with the previous version of the code:

- **Expand/contract**: add nullable → backfill with an idempotent resumable job → write both →
  drop the old column in a *later* release. Never ship a destructive migration with the code
  that needs it.
- Migrations touching large tables are run on staging first.
- Never `prisma migrate dev` outside local.

**Seeds** via Prisma, generated with faker, populate local databases and the preview parent
branch. Never real data. Seed data is separate from test factories.

---

## 4. Git and workflow

- **Conventional Commits** (`feat`, `fix`, `chore`, `refactor`…) validated by commitlint in the
  `commit-msg` hook.
- **Squash merge only**, configured in the repo: the PR title is the commit that reaches `main`.
  The PR title is validated as Conventional Commits in CI
  (`amannn/action-semantic-pull-request`), as a required check.
- **Pre-commit** (Husky): lint-staged runs Biome on staged files, then
  `vitest related --run --project unit` on the touched files, then gitleaks. No Docker needed.
- **`main` is protected**: PR only, green CI, at least one approval, branch up to date with `main`.
- **PR template** (`.github/pull_request_template.md`), in English, with these sections in
  order: Description · Main changes · Impact · Tests · Validation · Decisions and open
  questions · Checklist. It carries the reviewer summary `RULES.md` §22 requires; `/check-pr`
  holds the default text and fills it.
- **CODEOWNERS** for automatic reviewers.
- **release-please** for changelog and versioning — mandatory.
- **Renovate** for dependency updates; **Dependabot** security alerts on.
- **gitleaks** in pre-commit and in CI.

---

## 5. Verification and CI

### `pnpm check`

The single verification command. It is the reference for the definition of done, for AI and
for CI, and must pass locally before opening a PR. Runs in order and stops at the first failure:

1. `lint` — Biome (lint and format), dependency-cruiser, knip, the Impeccable detector
   (`impeccable detect src`)
2. `typecheck` — `tsc`, type-coverage
3. `test` — unit and integration, with the coverage threshold
4. `build`

**`pnpm check:full`** = `pnpm check` + `test:e2e` (Playwright, accessibility tests included).
Locally it runs against the app Playwright starts with `webServer`; in CI it is split across
two workflows.

Every step is also its own script — `lint`, `typecheck`, `test`, `test:unit`,
`test:integration`, `test:e2e`, `build` — to run it on its own.

### Enforced config

**dependency-cruiser** — these are build failures, not conventions:

- `@prisma/client` and the Prisma adapters importable only from `src/server/**/service.ts` and
  `src/lib/db/**`
- `src/app/**` may import `queries.ts` and `actions.ts`, never `service.ts`
- `src/components/**` may import only `actions.ts` from `src/server/**`
- `src/lib/**` may not import `src/server/**` or `src/app/**`
- no circular dependencies
- feature folders under `src/server/` may not reach into each other's internals

**knip** fails on unused files, exports and dependencies.
**type-coverage** at 99% minimum, ratchets upward only.
**Vitest coverage threshold**: CI fails if coverage drops below it.
**Biome**: `any` banned, cognitive complexity capped, `console.log` banned, empty `catch`
banned, `TODO` without an issue reference banned.
**Impeccable detector**: any finding fails `lint` (exit 2). `detector.designSystem` stays
enabled and no rule is ignored as a whole. Waivers for a value or a file go only in
`.impeccable/config.json`, each with its reason — never in `config.local.json`, which CI
doesn't see (§17).

### CI (GitHub Actions)

CI runs the equivalent of `pnpm check:full`, split across two workflows. Both are required
checks to merge.

- **PR workflow** (`pull_request`): `pnpm check`, PR title validation, gitleaks.
- **E2E workflow** (`deployment_status`):
  - Runs only when `github.event.deployment_status.state == 'success'` and the environment is a
    preview — never on production deployments. Check the exact environment name Vercel sends.
  - `pnpm test:e2e` against the preview URL. The base URL comes from an env var: local by
    default, the preview in CI.
  - Vercel Deployment Protection is passed with the automation bypass: the
    `VERCEL_AUTOMATION_BYPASS_SECRET` secret sent in the `x-vercel-protection-bypass` header
    (Playwright `extraHTTPHeaders`).
  - Since the workflow waits for the deploy, the preview's migrations are already applied when
    E2E runs.
  - If Vercel doesn't deploy (failed or ignored build), the E2E check never appears and the PR
    stays blocked. That is intended: fix the build or redeploy. No Ignored Build Step on PR
    branches.

---

## 6. Structure

```
src/
  app/                    # routes only, no business logic
  components/ui/          # shadcn primitives
  components/<feature>/
  server/<feature>/
    queries.ts            # reads for Server Components: authenticate → authorize → service
    actions.ts            # Server Actions: authenticate → authorize → validate (Zod) → service
    service.ts            # business logic; ONLY file importing Prisma
    schema.ts             # Zod, shared with client
    <feature>.test.ts               # unit
    <feature>.integration.test.ts   # integration (Testcontainers)
  lib/                    # auth/ db/ platform/ env.ts logger.ts result.ts
  proxy.ts                # CSP nonce and request-level security
docs/                     # see "Docs" below
prisma/  tests/e2e/
```

- **Reads in Server Components** through `queries.ts`; **mutations through Server Actions** in
  `actions.ts`. Route handlers only for webhooks, health checks, Better Auth routes and public
  APIs.
- **`src/lib/db/` is the single database access module.** It picks the Prisma driver adapter
  from an env var validated with `@t3-oss/env-nextjs`: `@prisma/adapter-neon` with pooling on
  Vercel, `@prisma/adapter-pg` against Docker Compose or Testcontainers locally and in tests.
- Environment variables are read only through the validated env module, never `process.env`.
- Storage, email, queue and image services sit behind adapters in `src/lib/platform/` —
  business logic never imports a vendor SDK directly.
- Feature folders are the unit of ownership. Scaffold with `pnpm gen feature <name>` (plop)
  rather than inventing a structure.

### Docs

Mandatory, versioned in the repo, updated in the same PR as the change they describe. Every
document has exactly one home:

```
docs/
  ARCHITECTURE.md           # system overview, environments, main flows
  decisions/
    NNNN-<title>.md         # ADRs, numbered, never edited after acceptance — superseded by a new one
  specs/
    <feature>.md            # one per feature (§15)
  privacy/
    data-inventory.md       # personal data: model, field, purpose, retention
    processors.md           # providers: region, data received, DPA link
    deletion.md             # erasure procedure + Neon backup retention window
  operations/
    backups.md              # Neon point-in-time restore procedure
    staging.md              # staging anonymization procedure
```

A new kind of document needs a place in this tree first. Never docs outside `docs/`, except
`README.md`, `CLAUDE.md` / `AGENTS.md`, `RULES.md`, the stack files, and Impeccable's context
where the tool reads it: `PRODUCT.md` and `DESIGN.md` at the root, page briefs in
`.impeccable/surfaces/` (§17).

---

## 7. Types

```ts
type Brand<T, B> = T & { readonly __brand: B };
export type UserId = Brand<string, "UserId">;
```

Brand every entity ID. Passing a `UserId` where an `OrderId` belongs becomes a compile error
instead of a data bug.

- **Zod is the source of truth**; types via `z.infer`. Never a hand-written duplicate.
- **Discriminated unions over nullable-field soup** — a draft and a published record are
  different shapes.
- **Exhaustive switches** end in `assertNever(x)`, so a new enum member fails compilation
  everywhere it must be handled.
- Make illegal states unrepresentable before adding a runtime guard.
- `satisfies` over annotation for config. No `as` outside test factories and parser
  boundaries; `as unknown as` never.

---

## 8. Errors, logging and monitoring

- **Expected failures are values**: `Result<T, E>` discriminated union in `lib/result.ts`.
  Services return `Result`; actions and queries translate it into a uniform response shape.
- **Unexpected failures throw** and reach Sentry with context. Never caught, logged and
  swallowed.
- **Domain errors carry a machine code and a translation key**:
  `{ code: "ORDER_ALREADY_SHIPPED", messageKey: "errors.orderAlreadyShipped" }`. Never a raw
  English string thrown from a service — it ends up shown to a user in the wrong language.
- The UI never inspects exception messages.
- **Correlation id per request** via `AsyncLocalStorage`, attached to every log line, Sentry
  event, QStash message and outbound call.
- **Pino**, JSON to stdout (collected by Vercel). Structured fields, never interpolated
  strings. Context always carries user and correlation id. `redact` configured for passwords,
  tokens, auth headers and personal fields.
- **Sentry** (free plan, official Vercel integration) with `sendDefaultPii: false`.

---

## 9. Data model

- **UUIDv7** ids in `uuid` columns, branded in TypeScript.
- **snake_case in Postgres, camelCase in TypeScript** via `@map` / `@@map`.
- Standard columns: `id`, `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`,
  `version`.
- Prisma enums for fixed technical sets; lookup tables when users add values or need
  translated labels. Never a free-text status column.
- `timestamptz` always; `date` only for true calendar dates.
- FKs always constrained, `onDelete: Restrict` by default. Cascade only where the child is
  meaningless alone.
- Add the index with the query that needs it.
- **Optimistic locking**: `version` on every editable entity, asserted and incremented on
  update, conflict surfaced to the UI. Last-write-wins silently loses data.
- Soft delete via `deletedAt`. Personal data still gets erased per the documented procedure
  (§12).

---

## 10. Auth, authorization and rate limiting

**Better Auth** with server-side sessions, never stateless JWT — revocation and role changes
take effect on the next request. Sessions listable and revocable; a password or role change
revokes all others. Auth events audited.

**Login and signup rate limiting** stored in Upstash Redis through Better Auth's
`secondaryStorage`, never in memory.

`src/lib/auth/permissions.ts` is the only home for authorization logic; never
`role === "admin"` inline. Order, every time:
`authenticate → authorize → validate (Zod) → service`

**Rate limiting** with `@upstash/ratelimit` on emails, uploads and sensitive actions. A separate
Redis database or key prefix per environment, so previews and E2E never consume production's
limits.

---

## 11. Security and caching

- **CSP with nonces** set in `proxy.ts` (Next.js 16+). It forces dynamic rendering on every page
  — no static, no ISR. Accepted and recorded in an ADR.
- **HSTS** and the other security headers in `next.config`.
- Env vars validated at startup with `@t3-oss/env-nextjs`; a missing variable fails the build,
  not a request.

Pages are dynamic, but data caches and module scope are still shared:

- **Nothing user-derived in module scope** — module variables are shared across requests on a
  warm function.
- Cached data is keyed and tagged by everything it depends on, built by a helper, never an
  inline string.

---

## 12. Personal data and processors (GDPR)

- **Personal data inventory** in `docs/privacy/data-inventory.md`: model, field, purpose,
  retention.
- **Processor register** in `docs/privacy/processors.md`: Vercel, Neon, Upstash, Resend,
  Cloudinary and Sentry (plus any on-demand provider once installed), with region, data received
  and a link to their DPA.
- **Neon backups keep deleted data for their retention window.** That window is documented next
  to the deletion procedure, in `docs/privacy/deletion.md`.
- Personal data never reaches logs (Pino `redact`), Sentry (`sendDefaultPii: false`), previews,
  E2E or staging.

---

## 13. Background work and integrations

- **`after()`** for work that runs once the response is sent. **QStash** when it needs a queue,
  retries or a schedule.
- **Inbound webhooks verified then deduplicated by provider event id** in a `WebhookEvent`
  table *before* any business logic. Duplicate delivery is normal; double-processing is the
  failure mode.
- **Outbound mutating calls carry an idempotency key** derived from our own record id.
- Handlers acknowledge fast and hand off to QStash. No business logic in the handler.
- Sync jobs are resumable with a watermark — never "fetch everything since the beginning".
- **Public API** when needed: REST, OpenAPI generated from the Zod schemas, versioned under
  `/api/v1/`, scoped API keys (hashed, expiring, last-used tracked), rate limited, idempotency
  keys on mutations. Same authorization as the UI — a key is never a bypass.

---

## 14. UI

- **Server Components read, Server Actions mutate.** Forms with React Hook Form + Zod, sharing
  the schema in `schema.ts`.
- **Every list has four states**: loading (skeleton, not spinner), empty (with the primary
  action, written not generic), error (with retry), populated.
- **Optimistic updates only where rollback is safe.** Never on anything monetary or
  irreversible — those show pending and wait for the server.
- Toast (Sonner) for background success, inline for validation errors, dialog for errors
  needing a decision. Never a toast for a validation error.
- Destructive actions confirm with the object named; irreversible ones require typing it.
- Forms: validate on blur, submit disabled while pending, server errors mapped to the
  offending field, unsaved-changes guard on navigation.
- **next-intl always**, even at one locale; source language English. Locale and timezone are
  never hardcoded. Dates, numbers and currency through shared `Intl` formatters — never an
  inline `toFixed`.
- Tables: sticky header, column visibility persisted per user, selection preserved across
  pagination, bulk actions behind confirmation. URL state via nuqs.
- Motion for animation, honouring `prefers-reduced-motion`.
- **WCAG 2.2 AA** — axe in Playwright on main flows. Keyboard operable, real labels,
  programmatic error association, colour never the sole carrier of meaning.

---

## 15. Specs and test-first

Work starts from a spec, not a prompt.

### `docs/specs/<feature>.md`

Scaffolded by `pnpm gen feature <name>` alongside the code folder. Fixed sections:

```md
# <Feature>
## Problem            — what, for which role
## Acceptance criteria — checklist, each independently verifiable
## Worked examples    — concrete inputs with exact expected outputs
## Data model         — new/changed tables, columns, indexes
## Permissions        — who may do what, to which records
## Edge cases         — concurrency, empty states, limits
## Out of scope       — explicitly excluded
```

**Worked examples are mandatory for anything on the critical list (§16)** and must carry exact
values.

The reason is structural. When the same reasoning produces both the test and the
implementation, agreement between them proves nothing — a misread requirement yields a suite
that passes confidently. Values fixed in an approved spec come from outside that reasoning,
so a test written from them cannot quietly agree with the bug. **If worked examples are
missing for critical-path work, ask for them rather than inventing the expected values.**

The out-of-scope section is the second most load-bearing part: it's what prevents three
unrequested features arriving with the one that was asked for.

**Never modify, weaken, skip or delete a test to make a suite pass.** If a test looks wrong,
stop and raise it. The only change to an existing test follows a spec change (`RULES.md` §4).

### Test layout

- Unit: `src/server/<feature>/<feature>.test.ts` — Vitest project `unit`
- Integration: `src/server/<feature>/<feature>.integration.test.ts` — Vitest project
  `integration`
- Property tests: `<feature>.property.test.ts`
- E2E: `tests/e2e/<flow>.spec.ts`

---

## 16. Testing

**Always covered**: permissions · anything that broke once · whatever the domain file adds.
This is the critical list §15 refers to. "Anything that broke once" means every bug fix: its spec
gains one worked example reproducing the bug — the input that failed and the correct result —
and that example is the regression test.

**Authorization matrix** — role × resource × action, allow *and* deny, including record-level
conditions.

**Setup**

- **Vitest, two projects**: `unit` (no DB, no Docker, fast — the one pre-commit runs) and
  `integration` (Testcontainers Postgres — mocked Prisma proves nothing).
- **Transaction per test, rolled back.** Parallel-safe, order-independent.
- **Playwright** for E2E, with `webServer` starting the app locally; base URL from an env var.
  **@axe-core/playwright** for accessibility on main flows.
- **MSW** for every external API. Never a real endpoint.
- **Coverage threshold** in Vitest; CI fails if it drops.
- Factories built with faker, separate from seed data.
- List queries tested at realistic volume and checked with `EXPLAIN` for a sequential scan.

Do not test Prisma, shadcn or Next.js. No React snapshot tests. No blanket retries in CI; a
flaky test is a broken test.

---

## 17. AI

- **Development rules versioned in the repo**, mandatory: `RULES.md`, imported by `CLAUDE.md` /
  `AGENTS.md` so it is always in context.
- **`/check-all`** — the pre-commit pass: every `check-*` review (process, stack, data,
  security, ERP, front, design, good practices, correctness, tests, plus the project's own), `pnpm check` and Playwright screenshots of UI changes for the user to confirm, each in
  a fresh subagent that didn't write the code, then the commit message. **`/check-pr`** writes
  the PR text, with the title `/check-changelog` decides. Flow: plan → develop → `/check-all` →
  confirm the screenshots when the UI changed →
  commit → `/check-pr`.
- **Mastermind** — the main session (Opus 5.5, high effort) decides and reviews; `lacayo-sonnet`
  executes what is already decided and `lacayo-opus` handles audits. The main session never
  runs verifications itself; the `mastermind-guard.mjs` hook enforces it. Installed with
  `node install.mjs` from `algusaem-claude`, applied per project with `/mastermind`.
- **[Impeccable](https://impeccable.style)** — the design skill, detector and design context
  for every UI. Set up, used and reviewed as the next section says.
- **SDD + TDD**: spec in `docs/specs/` → tests → code (§15).

### Impeccable

Where its guidance differs from `RULES.md` or this file, ours wins: colours and tokens only
from the theme, Motion for whatever appears or disappears, a new token or visual pattern only
with approval (`RULES.md` §17). Its "go bold" default applies only when the spec asks for a new
direction; otherwise the existing visual patterns stay.

**Setup** — every project, done by the agent that creates or adopts it. Two pinned pieces
that must run the same engine: the npm package (the detector CLI) and the skill (commands,
agents, hook). Today: `impeccable@4.1.0` with the skill at tag `skill-v4.3.1`, both on engine
0.1.5. The skill is copied from its tag rather than with `impeccable install`, which installs
whatever skill is latest and whose download may fail.

1. `pnpm add -D -E impeccable@4.1.0`.
2. `git clone --depth 1 --branch skill-v4.3.1 https://github.com/pbakaus/impeccable.git` into
   a temporary folder outside the project.
3. From that clone, copy `.claude/skills/impeccable/` to the project's
   `.claude/skills/impeccable/`, and `.claude/agents/impeccable-*.md` to `.claude/agents/`.
4. Merge the `hooks` of the clone's `.claude/settings.json` into the project's committed
   `.claude/settings.json`, keeping every other key and hook. The hook runs the detector after
   every UI edit the agent makes and a deeper pass when it stops. Never in
   `.claude/settings.local.json`: it runs for everyone.
5. Append to `.gitignore` the block between `# impeccable-ignore-start` and
   `# impeccable-ignore-end` in the clone's `README.md`, and `.impeccable/critique/` (review
   output isn't committed). Then delete the clone.
6. Create `.impeccable/config.json`:
   `{ "buildPath": "code", "detector": { "designSystem": { "enabled": true } }, "hook": { "enabled": true, "quiet": false } }`.
7. Add `impeccable detect src` to the `lint` script (§5).
8. Check: `.claude/skills/impeccable/scripts/VERSION` equals the `@impeccable/cli-*` version in
   `node_modules/impeccable/package.json`; `sh .claude/skills/impeccable/scripts/impeccable context`
   exits 0; `pnpm exec impeccable detect src` exits 0 or 2 — 1 means it couldn't scan.
9. `/impeccable init` for `PRODUCT.md`: the agent interviews the user about the product.
   `/impeccable document` for `DESIGN.md` once the theme exists.

Updating is its own PR: a newer package and the skill tag running the same engine, the same
steps 1–5 and 8. Nothing else changes in that PR.

**Context.** `PRODUCT.md` (audience, goals, constraints) and `DESIGN.md` (the visual system)
at the root; a brief per surface in `.impeccable/surfaces/`, from `/impeccable shape`, before
a new page or flow is built, linked from its spec. They are binding: UI that contradicts them
is a defect. When a change alters them, they are updated in the same PR.

**Commands**, always within the task's scope:

- any time: `shape`, `critique`, `audit`, `polish`, `typeset`, `layout`, `clarify`, `adapt`,
  `harden`, `onboard`, `distill`, `optimize`, `extract`, `document`;
- only when the spec asks for it, because they change the aesthetic direction: `bolder`,
  `quieter`, `overdrive`, `colorize`, `delight`, `animate`. The same goes for any new
  direction (brutalist, a new typographic voice);
- not without an ADR: `live`, `generate` and comp-first work (`buildPath` stays `code`) —
  they inject a helper into the running page or send the design to an image model.

**Slop** is what an agent produces by default and nobody decided: it makes the product read as
generated. In changed UI it is a defect, unless the spec or the surface brief asks for that
exact thing — the fix names what goes instead and why. It covers:

- **Visual**: the "Refuse" list in the skill's `reference/craft-floor.md` — same-size cards of
  icon, heading and text as the page structure, nested cards, the hero-metric template, an
  eyebrow above a heading, decorative section numbers, gradient text, decorative glass and
  blur, coloured side borders on cards and alerts, hard offset shadows, monospace as a
  costume, emoji or Unicode glyphs as icons — plus whatever the detector reports.
- **Copy**, in every locale (the Spanish "¡Ups!" or "Desbloquea" count the same):
  - hype and filler: "Unlock", "Supercharge", "Elevate", "Seamless", "Effortless",
    "Powerful", "Revolutionize", "Harness the power of", "at your fingertips", "all-in-one",
    "in just a few clicks", "take it to the next level", "we've got you covered";
  - pep: "Welcome to your dashboard!", "Let's get started!", "You're all set! 🎉" —
    exclamation marks and emoji in routine messages;
  - errors that don't say what failed and how to recover: "Oops! Something went wrong",
    "An error occurred";
  - empty states that don't say which state it is and what to do next: "No data found",
    "Nothing here yet";
  - actions without their verb and object: "Submit", "OK", "Yes" / "No", "Click here",
    "Learn more";
  - rhythm instead of content: tricolons ("Fast, simple and secure"), em-dash asides, an
    intro that repeats the heading, helper text that repeats the label.

**Detector.** Runs in `pnpm check` (§5) and through the hook. Its waivers —
`impeccable-disable` comments and ignores in `.impeccable/config.json` — are escape hatches
(`RULES.md` §3).

**Review.** `/check-impeccable`, inside `/check-all`, reviews the changed UI and copy against
the context files and the slop list, and with Impeccable's critique.
