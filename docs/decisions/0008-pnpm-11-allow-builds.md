# 0008 — The build-script allowlist under pnpm 11

Supersedes what [0002](0002-pnpm.md) says about the allowlist — its Decided paragraph and the
`onlyBuiltDependencies` mention under What it costs; the rest of 0002 stands.

## Decided

The packages allowed to run dependency build scripts are listed twice in `pnpm-workspace.yaml`:
under `allowBuilds`, a map of package → `true`, which pnpm 11 reads, and under
`onlyBuiltDependencies`, which the pnpm 10 still used on development machines reads. Both lists
hold the same packages — currently prisma, `@prisma/engines`, msw, sharp and `unrs-resolver` — and
a new native dependency goes into both. The fix for `ERR_PNPM_IGNORED_BUILDS` is in
[Getting started](../getting-started.md).

## What it beat

**Keeping only `onlyBuiltDependencies`**, as 0002 described. pnpm 11 removed that setting: CI,
which installs the latest pnpm 11, ignored the list and refused every one of those build scripts,
so `pnpm install --frozen-lockfile` failed before any check ran.

**Keeping only `allowBuilds`.** It would drop the allowlist for the pnpm 10 installs still in use
locally, which would then skip prisma's and sharp's build steps.

## What it costs

Two lists that must stay in step, with nothing but review to catch a drift.

## What would change our mind

Pinning pnpm in `package.json`'s `packageManager` (migration phase 3, ADR 0007 row 5). With every
install on pnpm 11, `onlyBuiltDependencies` goes and this ADR is superseded in turn.
