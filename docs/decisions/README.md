# Decisions

Short records of choices that **no single spec owns** and that someone will
otherwise re-litigate — usually by proposing the thing that was already rejected.

A spec's §4 explains why *that feature* works the way it does. These are the
decisions that sit underneath every feature.

Each one answers three questions and nothing else:

- **What was decided**
- **What it beat**, and why that alternative is worse *here* rather than in
  general
- **What would change our mind** — the observation that should reopen it

A decision with no plausible alternative did not need writing down. If you cannot
name what it beat, it is a fact, and facts belong in the doc for that area.

## Index

| Decision | Summary |
| --- | --- |
| [0001 — No data-fetching library](0001-no-data-fetching-library.md) | Hooks own their own request lifecycles |
| [0002 — pnpm](0002-pnpm.md) | pnpm 11, with an explicit build-script allowlist (the allowlist's keys: 0009) |
| [0003 — Proxy routes for every source](0003-proxy-routes.md) | The browser never calls an upstream marketplace |
| [0004 — JWT sessions](0004-jwt-sessions.md) | Stateless sessions plus a revocation clock |
| [0005 — Rate limiting in Postgres](0005-postgres-rate-limiting.md) | Not in memory, because serverless has no memory to speak of |
| [0006 — Scheduling the alert runner](0006-alert-scheduling.md) | A GitHub Actions cron draining a Postgres queue |
| [0007 — Adopt the shared rules and checks](0007-adopt-core-rules.md) | `RULES.md`, `STACK.md` and the core checks; the legacy deviations and the phase that removes each |
| [0008 — The build-script allowlist under pnpm 11](0008-pnpm-11-allow-builds.md) | `allowBuilds` for pnpm 11 next to `onlyBuiltDependencies` for pnpm 10; supersedes that paragraph of 0002 (superseded by 0009) |
| [0009 — One build-script allowlist once pnpm is pinned](0009-pnpm-pinned-allow-builds.md) | `packageManager` pins pnpm 11; `allowBuilds` is the only allowlist; supersedes 0008 |
