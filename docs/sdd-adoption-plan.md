# Plan: moving BuyCarMap to spec-driven + test-driven development

Status: **Complete. All 12 steps done 2026-08-02.**
Last updated: 2026-08-02.

> Changed during implementation: acceptance criteria are prefixed with a
> per-spec **key** (`FAV-1`, `MAP-4`) rather than a bare `AC-1`. A plain `AC-1`
> is not unique across specs, so the conformance check could not tell one
> spec's first criterion from another's. Sections below use the key form.

---

## 1. Baseline

What already exists, so the plan doesn't re-buy it:

- **Test infrastructure is complete.** 85 files, 722 passing tests. Vitest split
  into `unit` (jsdom) and `node` projects, MSW with `onUnhandledRequest: "error"`,
  typed fixtures, contract tests against the three upstream APIs, Playwright for
  e2e and visual, all gated in CI by `.github/workflows/test.yml`.
- **A coverage ratchet.** Thresholds in `vitest.config.ts` (87/82/81/87), set one
  point under the measured figure. CI fails on a drop.
- **One spec**, `docs/specs/auth-email-and-oauth.md`. Excellent content — dense,
  rationale-first — but written *after* the code as documentation. It records
  what was built; it never constrained what got built.

So the gap is not tooling. It is **order of work**, plus a written artifact that
does not exist for any feature except auth.

## 2. What changes, concretely

| | Today | After |
| --- | --- | --- |
| Where work starts | A prompt or an idea | A spec with numbered acceptance criteria |
| First code written | Implementation | A failing test per acceptance criterion |
| What review checks | Does the diff look right | Does the diff satisfy the spec's ACs |
| What a spec is for | Explaining finished code | Agreeing on behaviour before it exists |
| Traceability | None | Every AC names the test that proves it |

**TDD needs no migration.** There is nothing to convert — the next feature simply
starts with a failing test. The work below is almost entirely about SDD: creating
the artifact, the workflow around it, and the enforcement that stops it rotting.

## 3. The unit of work: a spec

Every spec lives at `docs/specs/<area>.md` and follows one template:

```markdown
# Spec: <feature>

Key: <2-8 uppercase letters, unique across all specs>
Status: Draft | Approved | Implemented | Superseded
Last updated: YYYY-MM-DD

## 1. Problem
What a user cannot do today, and why that matters. No solution here.

## 2. Scope
In scope. Out of scope — explicitly, so "while we're in there" has an answer.

## 3. Acceptance criteria
A table of numbered, independently testable statements. See rules below.

## 4. Decisions and rationale
Every non-obvious choice, and the alternative it beat. This is the section
that survives longest and the reason to keep specs at all.

## 5. Data and contracts
Schema changes, external API shapes, error codes, env vars.

## 6. Open questions
Anything unresolved. An empty section is a signal the spec is ready.
```

### Acceptance criteria rules

1. **Keyed and stable.** Each spec declares a unique `Key` (2–8 uppercase
   letters); criteria are `KEY-1`, `KEY-2`, … Append new ones; **never
   renumber** — the id is a permanent handle that test names point at.
2. **Independently testable.** One observable behaviour each. If you cannot name
   the test that would fail, the AC is too vague.
3. **Includes negative paths.** Invalid input, empty result, upstream failure.
   These are where the bugs are, and they are what a spec written from the happy
   path always forgets.
4. **Names its test level** — `unit`, `node`, `component`, `contract`, or `e2e`.
   Deciding this in the spec is what stops everything drifting into slow e2e.
5. **Carries a "Verified by" cell**, filled in when the test goes green.

Example row:

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| MAP-4 | A search that returns nothing from every source renders the empty state, not an error | component | `MapView.test.tsx › shows the empty state when no source has anything` |

### Traceability

Tests derived from an AC carry the id in their title:

```ts
it("MAP-4: shows the empty state when no source has anything", async () => {
```

That makes the link greppable in both directions, which is what lets Step 4's
check script stay short instead of a parser.

---

## 4. Steps

### Phase 0 — Foundations — **DONE**

Mechanics only. No feature work, no behaviour change.

**Step 1 — Spec template and index.** Add `docs/specs/_template.md` and
`docs/specs/README.md` (what a spec is, when one is required, the current index
with statuses). *Deliverable:* two files. *Exit:* someone can write a spec
without asking how. *Size:* S.

**Step 2 — `/spec` command.** A `.claude/commands/spec.md` in the same shape as
the existing `/check` family: takes a feature description, interrogates the
codebase, produces a spec at `docs/specs/<area>.md` with ACs already levelled.
Add a second command `/spec-tests` that turns an approved spec's ACs into failing
tests — the TDD step, kept separate so the spec can be reviewed before any code.
*Deliverable:* two command files. *Exit:* `/spec favorites` produces a reviewable
draft. *Size:* M.

**Step 3 — CLAUDE.md rules.** A "Spec-driven development" section: no feature
work without an approved spec; ACs become failing tests before implementation;
changing behaviour means editing the spec first. Also add the spec step to
`/check-all`'s pipeline. *Deliverable:* CLAUDE.md edit + `check-all.md` edit.
*Exit:* the rules are in the file every session loads. *Size:* S.

**Step 4 — The conformance check.** `scripts/spec-check.mjs` + a `pnpm spec:check`
script: for every `KEY-n` declared in an `Approved` or `Implemented` spec, assert the id
appears in at least one test title, and that no test names an id no spec declares. Wire it into the CI unit
job next to `pnpm lint`. *Deliverable:* script, package.json entry, workflow edit.
*Exit:* deleting a test that covers an AC turns CI red. *Size:* M.

> Phase 0 exit criteria: `pnpm spec:check` passes green against the seeded specs,
> and the workflow is documented well enough that the next feature can follow it.

### Phase 1 — Prove the loop on one real feature — **DONE**

Do not backfill anything yet. Run the full cycle once, end to end, on something
genuinely wanted, and fix what the process gets wrong before it is applied 12 more
times.

**Step 5 — Pilot: favorites.** The pilot needs to be small, self-contained,
and still touch every layer the process has to cover. Favorites qualifies:
Prisma model, server action, hook, component, e2e — one pass through all of
them, with little that can go wrong outside the process itself.
`CarListingCard` already renders a favorite button wired only to local state,
so the UI half exists and the spec is about persistence. Substitute whatever
you actually want to build next; the sequence below is the part that matters.

Sequence, strictly in this order:

1. `/spec favorites` → review and approve the spec. **No code yet.**
2. `/spec-tests` → one failing test per AC. Confirm each fails *for the right
   reason* — a test that fails on a missing import proves nothing.
3. Implement until green. No test edits except to fix a wrong expectation.
4. Fill in "Verified by", flip status to Implemented, run `/check-all`.

*Exit:* favorites ships, and we have a written list of what the process got wrong.
*Size:* L.

**Step 6 — Retune. Done 2026-08-02**, from what the favorites pilot actually
did. Answers to the five questions this step exists to ask:

1. **Did the trigger fire on its own? Yes — zero interventions.** Both times the
   user said only "keep going" / "go", and `/spec` then `/spec-tests` ran as the
   first action without being named. The `How this triggers` table in
   `CLAUDE.md` is left exactly as written.
2. **The `PreToolUse` hook is therefore NOT built**, per item 1's own rule. The
   cheap behavioural layer did not measurably fail, so buying the false
   positives would be paying a cost for a problem that has not appeared.
3. **Granularity was right.** 15 criteria produced 32 tests — a little over two
   each, which is the ratio you want: enough that negative paths get their own
   case, not so many that criteria are restating single assertions. 15 sits at
   the guideline ceiling, so it stands unchanged.
4. **`Approved`-is-enforced stays.** In practice the spec and its 32 failing
   tests landed together and the suite went green in one implementation pass.
   The friction was real but never blocking, which is the intended cost.
5. **No spec section went unused.** Open questions earned its place — it held
   the one decision that changed a criterion (FAV-12) and two gaps that would
   otherwise have gone unrecorded.

Three findings folded back into the commands rather than left as lessons:

- `/spec` Phase 2 now says to **derive stored fields from the type they must
  reconstruct**, not list them from memory. The favorites spec omitted `brand`
  and `model` from its data section; only the compiler caught it.
- `/spec` Phase 2 now names the **no-test-database constraint** explicitly, so
  criteria stop being written for things Postgres alone can prove. Discovered
  when the cascade-delete criterion had to be dropped mid-draft.
- `/spec-tests` gained **Phase 3b: expect sibling fallout.** Adding a session
  check to `CarListingCard` broke seven `MapView` tests, because `MapView`
  renders cards. Real breakage from a real change — the phase says to fix the
  siblings, never to weaken the new test.

### Phase 2 — Backfill the whole app

You want full coverage, so this is the bulk of the work. Ordered by risk, not by
convenience — the areas where a spec would have caught something come first.

Each wave is the same three moves: **write the spec from the code → list ACs with
no test → write the missing tests**. The second move is the point of the exercise;
the spec is a by-product. Waves are independent and can pause between.

| Wave | Area | Source files | Existing tests | Why this order | Size |
| --- | --- | --- | --- | --- | --- |
| A | Map and search — `components/map`, `lib/hooks` | 16 | 13 | The core product, and until this week it had almost no tests. Highest chance of finding real gaps. | L |
| B | Data sources — `lib/{wallapop,cochesnet,milanuncios}`, `app/api/*` | 20 | 17 | Three reverse-engineered upstreams that change without warning. The contract tests exist; what is unwritten is *which* behaviours we actually depend on. | L |
| C | Auth — `lib/auth`, `app/actions`, `components/{auth,account}` | 46 | 36 | Best-covered area and already has a spec. Work is converting it to the template and extracting ACs, not discovery. | M |
| D | Cross-cutting — `lib/i18n`, `lib/geo`, `lib/email`, `components/ui`, theming | 24 | 6 | Thin test coverage but low blast radius. i18n key parity across locales is the one real gap. | M |

Ordering note: A and B both touch `useListingsSearch`. Do A first and B second, or
the source specs will keep restating search behaviour.

### Phase 3 — Make it stick

**Step 7 — Raise the ratchet.** Backfill will push coverage up. Re-measure and
raise the thresholds once, at the end of Phase 2. *Size:* S.

**Step 8 — Decide the standing rule for spec drift.** The failure mode for SDD is
not skipping specs; it is specs that quietly stop matching the code. Two
candidate rules, pick one:
- *Spec-first, enforced:* any PR touching a spec'd area must show a spec diff or
  state why none is needed. Strong, adds friction.
- *Spec-on-change, audited:* update as you go, plus a quarterly `/check-claudemd`-
  style audit pass over `docs/specs`. Weaker, cheaper.

Recommendation: the second. The first sounds disciplined and gets routed around.
*Size:* S.

---

## 5. Risks, stated plainly

- **Backfilled specs describe what is, not what should be.** A spec reverse-
  engineered from working code cannot disagree with that code — that is the one
  thing a real spec is for. Their value is the AC list exposing untested
  behaviour and the rationale section capturing why things are the way they are.
  Treat Phase 2 as a **test-gap audit that produces documents**, not as SDD.
  Genuine SDD starts at Step 5 and applies only to new work.
- **Fourteen specs is a lot of prose to keep true.** Every one is a file that can
  go stale and mislead. This is the argument for backfilling only what you'll
  touch — you overrode it deliberately; Step 8 is the mitigation.
- **AC granularity will be wrong at first**, most likely too fine. Step 6 exists
  for this.
- **`spec:check` can be satisfied by a bad test.** It proves an id is mentioned,
  not that the assertion is meaningful. `/check-tests`'s quality bar remains the
  real gate.

## 6. Summary

| Step | Deliverable | Size | Status |
| --- | --- | --- | --- |
| 1 | `docs/specs/_template.md`, `README.md` | S | done |
| 2 | `/spec`, `/spec-tests` commands | M | done |
| 3 | CLAUDE.md rules, `/check-all` integration | S | done |
| 4 | `pnpm spec:check` + CI wiring | M | done |
| 5 | Pilot: favorites, full cycle | L | done |
| 6 | Retune: trigger self-fired, granularity held, 3 fixes folded in | S | done |
| 7 | Wave A — map and search | L | done: 6 gaps closed, 2 defects fixed |
| 8 | Wave B — data sources | L | done: 4 gaps, 2 defects fixed |
| 9 | Wave C — auth | M | done: converted, 1 gap closed |
| 10 | Wave D — cross-cutting | M | done: 10 criteria, 5 new test files |
| 11 | Raise coverage thresholds | S | done: 87/82/81/87 → 89/85/84/89 |
| 12 | Adopt a drift rule | S | done: spec-on-change, audited |

Phase 0 (steps 1–4) is a single sitting. Everything after is one step at a time.
