# 0011 — Keep criterion ids, spec:check and extra spec sections

Status: Accepted · Date: 2026-09-28

## Context

[ADR 0007](0007-adopt-core-rules.md) row 8 lists the `KEY-n` criterion ids and `pnpm spec:check` as
a deviation for phase 4 to remove. The core spec format, however, has no way to tie a criterion to
the test that proves it. Retiring the ids would strip 375 test titles of their link to the spec,
and removing `spec:check` would take a step out of `pnpm lint`, which `RULES.md` §3 forbids as
weakening verification. The owner decided on 2026-09-28 to keep both, as a project addition to the
core. ADR 0007 is never edited, so this record says where BuyCarMap keeps more than the core asks
for.

## Decided

**The core section order.** Every spec has these `##` sections, in this order: Problem, Acceptance
criteria, Worked examples, Data model, Permissions, Edge cases, Out of scope.

**Optional sections after the fixed seven.** Contracts, Decisions and rationale, and Open
questions may follow, in that order, only when they have content. They hold what the core sections
have no home for: route shapes, env vars and upstream APIs; the reason a thing is built the strange
way it is; and what is still unresolved.

**Criteria are checklist items with the id first and the level.** Each one reads
`- [ ] KEY-n · <level> — <statement>`, where the level is `unit`, `node`, `component`, `contract` or
`e2e`, or several joined with ` + ` when a criterion is proven at more than one level (`node + e2e`).
Ids stay append-only, and test titles keep naming them (`it("FAV-3: …")`).

**The box replaces the "Verified by" column.** A ticked box means the criterion's test is green on
the branch that ticked it. The column duplicated what `spec:check` proves from test titles, nothing
checked it, and it drifted.

**`spec:check` stays, and is extended.** It keeps every check it had — a duplicate key, an enforced
spec with no criteria, a criterion no test title names, a test naming an undeclared id — and now
also fails on a criterion with no level and on an unchecked box in an `Implemented` spec.

**The `Key:`, `Status:` and `Last updated:` lines stay**, because `spec:check` and `docs-check`
(`isUnbuiltSpec`) read Status.

**`docs/specs/_template.md` stays as the scaffold** until plop arrives in phase 5.

**The root `README.md` is the docs index.** The core tree has no `docs/README.md`, so the index, the
spec index and the ownership map live in the root README, and `docs-check` reads them there.

**`docs/images/` holds the README screenshot** and is not a document.

## What it beat

**Retiring the ids and `spec:check`, as ADR 0007 row 8 planned.** Nothing would tie a criterion to
its test any more; a dropped criterion would go unnoticed, where today the test naming it becomes a
dangling reference that `spec:check` fails on. And `lint` would lose a step.

**Moving each spec's rationale into ADRs.** An ADR is for a choice no single spec owns. The reason
behind one feature's strange shape — MAP-16..19, among others — belongs next to the criteria it
explains, where the next person to simplify that feature will read it.

## What it costs

Three optional sections and a script the core does not have, both to maintain.

## What would change our mind

The core gaining its own link between a criterion and its test. Then the ids and `spec:check` go in
its favour.
