# 0012 — Root layout and server layer

Status: Accepted · Date: 2026-09-29 · Amends ADR 0007 rows 2 and 10

## Context

[ADR 0007](0007-adopt-core-rules.md) row 10 lists the root layout (`app/`, `lib/`, `components/`,
`interfaces/`, `types/`, `e2e/`, root `proxy.ts`) as a phase-5 deviation from `RULES.md` §9, §13 and
`STACK.md` §6, §15, removed by moving the tree into `src/`. Row 2 lists the missing
dependency-cruiser, knip and plop, removed in part in phase 3 and in part in phase 5. Phase 5's spec,
[docs/specs/core-layout.md](../specs/core-layout.md), is what this record supports. Its first
version, approved 2026-09-28, moved the tree into `src/`; the owner then chose to keep the root
layout instead, which this record makes permanent, alongside the server-layer decisions the owner
took while approving that spec.

## Decided

**The root layout stays.** This is a permanent deviation from `STACK.md §6`, not a phase-5
deviation removed by a later move. `app/`, `components/`, `lib/`, `interfaces/`, `types/`, `e2e/`,
`test/` and root `proxy.ts` keep their current paths. Every core rule that names `src/` applies to
the root path instead, and the server layer the core places at `src/server/` sits at root `server/`
beside them.

**Components may import `schema.ts`.** `STACK.md` §6 says `schema.ts` is "shared with client",
while §5's dependency rule lets a component import only a feature's `actions.ts`. The two
contradict directly: a form needs the runtime schema for `zodResolver`, and `actions.ts` alone
cannot supply it. The rule is read to admit `schema.ts` too, and the contradiction is reported to
the core.

**Shared features are reached only through `service.ts` / `schema.ts`.** `rate-limit` and `auth`
are features several others depend on. Forbidding cross-feature imports outright would force
duplicating their logic (`RULES.md` §6); allowing only their `service.ts` and `schema.ts` keeps
each feature's internals private while letting the dependency stand.

**Route handlers may import a `service.ts`.** The alert cron and the unsubscribe link have no user
session — they authenticate with the cron secret and a hashed token, not `getCurrentUser()` — so
they cannot go through `actions.ts`. `RULES.md` §9 and `STACK.md` §13 already carve out route
handlers for exactly this case: a server entry point that validates and authorizes on its own.

**The NextAuth exception runs until phase 11.** `authOptions` needs the Prisma adapter and
`authorize`, and stays in `lib/auth/options.ts` so server components can import it without dragging
in the route (`CLAUDE.md`). The dependency-cruiser config carries one named exception for it:
`lib/auth/options.ts` may import `lib/db/**` and `server/auth/service.ts`, nothing else, and no
other file may use it. Row 25 of ADR 0007 removes NextAuth, and this exception with it, in phase 11.

**ADRs are dated records.** This phase moves files earlier ADRs cite by path — `app/actions/` in
ADR 0007, for one. An accepted ADR is never edited, so its paths describe the code as it stood when
the decision was taken, not as it stands now. `docs-check` stops requiring an ADR's backticked
paths to resolve; it still checks an ADR's links.

## What it beat

**The `src/` move**, the first version of this spec. A pure reading of `STACK.md §6` says `src/`
wins: Next.js supports `app/` at the root exactly as well as `src/app/`, so the move buys nothing
but consistency with other core projects, at the cost of moving roughly 300 files and every path
reference to them across the docs, tests and configs in one change. The owner judged that cost
higher than the value here, for a project with no sibling project to be consistent with yet.

## What would change our mind

A second project on this core sharing tooling or generated code with BuyCarMap closely enough that
`src/`'s absence causes real friction — a shared lint config assuming `src/`, for instance. Absent
that, the root layout stays permanently, unlike the other rows of ADR 0007, which fall away as
their phase lands.
