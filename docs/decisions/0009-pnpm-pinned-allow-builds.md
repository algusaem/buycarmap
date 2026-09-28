# 0009 — One build-script allowlist once pnpm is pinned

Supersedes [0008](0008-pnpm-11-allow-builds.md).

## Decided

`package.json` pins pnpm in `packageManager`, so every install — on a development machine, in CI
and on Vercel — runs that exact pnpm 11. The packages allowed to run dependency build scripts are
listed once, under `allowBuilds` in `pnpm-workspace.yaml`, a map of package → `true`. The
`onlyBuiltDependencies` list 0008 kept for pnpm 10 is gone. A new native dependency goes into
`allowBuilds`; the fix for `ERR_PNPM_IGNORED_BUILDS` is in
[Getting started](../../README.md#when-something-is-wrong).

## What it beat

**Keeping both lists, as 0008 did.** They existed only because development machines still ran
pnpm 10. With `packageManager` set, pnpm 10 hands the install to the pinned version, so no install
reads `onlyBuiltDependencies` any more: the second list would be dead configuration that must
still be kept in step.

## What it costs

Upgrading pnpm is a `package.json` change, reviewed like any other; Renovate proposes it.

## What would change our mind

pnpm renaming or reshaping the setting again, or an environment that cannot run the pinned
version.
