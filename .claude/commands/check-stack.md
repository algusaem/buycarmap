---
description: Review working changes against the stack — dependencies, structure and boundaries, Next.js data flow, env vars, errors and logging, background work and integrations
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Agent
---

Review the working changes against the **stack**. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `RULES.md` §5, §9 (except input validation and auth in actions/handlers → `check-security`; route states → `check-front`), §14, §15 (except what reaches logs → `check-security`; messages to the user → `check-front`), §3 (`console.log`); `STACK.md` §1, §2 (health checks, Postgres version parity), §11 (env validated at startup), §6 (structure, not "Docs"), §8, §13 (except webhook verification and API keys → `check-security`); `STACK-ERP.md` §1 (dependencies).
**Applies to:** `package.json` files and lockfiles, `src/app/**`, `src/server/**`, `src/lib/**`, route handlers, `.env.example`, `next.config.*`. If `STACK.md` doesn't exist, check only the `RULES.md` sections and say so.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
Run on its own, the main session does not review the stack rules itself, however capable it is of doing so:
- **The whole review → one `Agent` with `subagent_type: "lacayo-opus"`**, told it is the delegated agent and spawns no agents, and briefed with this file, `.claude/review-protocol.md`, the change set, the task in the user's words and the approvals the user gave, quoted; it returns the output of review protocol §7.
- **The mastermind** re-measures with its own eyes only the facts it will state (a quoted `file:line`, the changed files: single read-only commands), and writes the report; which findings get fixed is the user's decision when the check runs on its own (review protocol §6). The fixes the user asks for are dictated edits: direct for two or three steps in one file, `lacayo-sonnet` for anything longer.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## 1. Dependencies (`RULES.md` §5, `STACK.md` §1)

Run `git diff -- package.json pnpm-lock.yaml` (and every other `package.json` in the repo). A lockfile other than `pnpm-lock.yaml` added or changed → BLOCKER (install with pnpm). For **each added or changed dependency**:

- **On the "Do not install" list** (`STACK.md` or `STACK-ERP.md`) → BLOCKER, name the replacement the stack mandates.
- **Duplicates something the stack already provides** → BLOCKER. Compare by *purpose*, not by name. Typical offenders:
  - HTTP/data: axios, ky, SWR, TanStack Query for server data → Server Components + Server Actions
  - validation/forms: yup, joi, valibot, formik → Zod + React Hook Form
  - UI/feedback: react-hot-toast, react-toastify → Sonner; framer-motion, react-spring, GSAP → Motion
  - dates: moment, dayjs, luxon → date-fns + `@date-fns/tz`
  - utils: lodash/underscore for what the language already does; a second classnames helper next to `clsx` + `tailwind-merge`
  - tooling: ESLint, Prettier → Biome; Jest → Vitest; Cypress → Playwright; lefthook → Husky
  - auth/jobs/storage: next-auth, Inngest, BullMQ, Vercel Blob, in-memory rate limiters → Better Auth, `after()`/QStash, Cloudinary/R2, Upstash
  - i18n: react-i18next, react-intl → next-intl
- **Not in the baseline, the on-demand table, or an ADR** → BLOCKER ("needs an ADR in `docs/decisions/`"). (The APPROVAL is `check-process`'s.)
- **On-demand dependency without the feature that triggers it** in this change → ISSUE (the stack is a menu, not a manifest).
- **Wrong section**: runtime code in `devDependencies` or tooling in `dependencies` → ISSUE.
- **Baseline dependency removed** without an ADR → BLOCKER.
- `packageManager`, `engines` or `.nvmrc` changed → verify they still agree with each other and with CI.

Then scan the **imports** of every changed file:

- A package imported but not declared in `package.json` → BLOCKER.
- A vendor SDK (Cloudinary, R2/S3, Resend, QStash, Upstash) imported outside `src/lib/platform/` → BLOCKER.

When a `package.json` changed, list every dependency in it that the stack and ADRs don't cover as **Pre-existing**; otherwise skip that list.

## 2. Structure and boundaries (`STACK.md` §6)

Check by reading the imports; don't wait for dependency-cruiser.

- Files in their place: routes in `src/app/`, UI in `src/components/`, server code in `src/server/<feature>/` (`queries.ts`, `actions.ts`, `service.ts`, `schema.ts`). One folder per feature; never aggregated or global files (`brands.ts`, barrel `index.ts`).
- `@prisma/client` / Prisma adapters imported only from `service.ts` and `src/lib/db/**`.
- `src/app/**` never imports `service.ts`; `src/components/**` imports only `actions.ts` from `src/server/**`; `src/lib/**` never imports `src/server/**` or `src/app/**`; no feature reaching into another feature's internals; no cycles.
- Business logic lives only in `service.ts` — business logic (domain rules, filtering, pagination rules, calculations) written in a query, action, component, client hook or `lib/` helper → BLOCKER. (Duplicated logic in general is `check-good-practices`'.)
- **A project that hasn't adopted this layout** (review protocol §1): the layout itself is Pre-existing. A change that adds to it — a new file or new logic in the old structure — is judged against the rules like any other code; say in the finding that the fix is a migration that needs approval (`RULES.md` §1).
- The Postgres major version in `docker-compose.dev.yml` and the Testcontainers setup matches Neon's (`STACK.md` §2).

## 3. Next.js data flow (`RULES.md` §9)

- `"use client"` only where interactivity is needed, on the smallest component — a whole page or layout marked client to make one button work → BLOCKER.
- Reads through `queries.ts` in Server Components; mutations through Server Actions. `fetch` or Prisma inside a component, TanStack Query or `useEffect` for server data → BLOCKER.
- A Server Action used for reads from a Client Component without a justification (search, incremental loading) → BLOCKER.
- A route handler for anything other than a webhook, a health check, a Better Auth route or the public API → BLOCKER. Route handlers: one folder per resource, one file per endpoint.
- Health checks: `/api/health` never touches the DB; `/api/health/db` only on demand (`STACK.md` §2).

## 4. Environment variables (`RULES.md` §14)

- `process.env` read outside the validated env module → BLOCKER. The env schema is validated at startup, so a missing variable fails the build, not a request (`STACK.md` §11).
- A new variable must be in the `@t3-oss/env-nextjs` schema **and** in `.env.example` with an example value → otherwise BLOCKER.
- If it must be set in Vercel, say so in a NOTE — `/check-pr` puts it under Manual actions.

## 5. Errors and logging (`RULES.md` §15, `STACK.md` §8)

- No `console.log` in application code → BLOCKER (use Pino).
- No empty `catch`, no `catch` that logs and swallows → BLOCKER. Unexpected errors reach Sentry with context.
- Expected failures returned as `Result`; actions and queries translate it into the uniform response shape.
- Domain errors carry `code` + `messageKey`, never a raw string thrown from a service.
- Pino with structured fields, never interpolated strings; context carries user and correlation id.

## 6. Background work and integrations (`STACK.md` §13)

`after()` or QStash only; webhooks deduplicated by provider event id in `WebhookEvent` before any business logic; outbound mutating calls carry an idempotency key derived from our record id; handlers acknowledge fast and hand off to QStash with no business logic; sync jobs resumable with a watermark; public API versioned under `/api/v1/` with OpenAPI generated from the Zod schemas.

## Definition of done

Owns `RULES.md` §22 item 12 (env vars), and item 7 for `console.log`.
