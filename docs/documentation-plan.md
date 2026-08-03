# Plan: documenting BuyCarMap

Status: **Complete. All 13 steps done 2026-08-03.**
Last updated: 2026-08-03.

> The document set exists and `pnpm docs:check` is green with no declared gaps.
> What remains is the thing this plan cannot do for itself: **keeping it true.**
> See §6 — the audit pass in Step 13 was done by the same session that wrote the
> docs, which is the weakest possible audit. The first genuinely useful one is
> after the next feature ships through the full loop.

> Changed during implementation: the ownership map allows a row to declare a gap
> (**—**) instead of naming a doc. Without it, Step 1 could only pass
> `docs:check` by pointing undocumented areas at some loosely related file —
> which would make the map lie, and the map is exactly what `/check-all` reads to
> decide which docs a change must touch. Nine areas are declared gaps today and
> `docs:check` lists them on every run, so the number is visible and countable
> down rather than quietly absent.

This plan is the companion to [`sdd-adoption-plan.md`](sdd-adoption-plan.md).
That one made behaviour written down and enforced; this one makes the *system*
written down — how to get into it, how it fits together, how to operate it when
something upstream breaks at 9pm.

---

## 1. What is already written, and what is missing

Nothing here starts from zero. The problem is not absence, it is **placement**.

| Artifact | Lines | Audience | Health |
| --- | --- | --- | --- |
| `CLAUDE.md` | 585 | Claude | Excellent content, wrong container — see §2 |
| `docs/specs/*` (5 specs) | 950 | Both | Current, enforced by `pnpm spec:check` |
| `docs/sdd-adoption-plan.md` | 272 | Both | Current, process complete |
| `README.md` | 14 | Humans, first contact | A bulleted tech list. Names Shadcn twice. Says nothing about what the product is |
| Everything else | 0 | Humans | Does not exist |

So: a contributor who is not Claude has **one meaningful entry point** — a
14-line list of technologies — and behind it a 585-line instruction file
addressed to somebody else.

## 2. The core observation: `CLAUDE.md` is two documents

It is doing two incompatible jobs at once.

**Job one: rules.** "Never use `any`." "Prefer server actions over API routes."
"Never run `prisma migrate reset`." Imperative, addressed to an agent, and it
must stay in `CLAUDE.md` — that is the file every session loads.

**Job two: reference.** The Wallapop endpoint contract. The eleven Prisma
models. The OKLCH colour table. The map architecture. The testing environment
gotchas. This is descriptive, it is what a *human* needs, and it is the majority
of the file.

Splitting them by section:

| Job | Sections | Lines | Where it belongs |
| --- | --- | --- | --- |
| Rules | Rules for Claude, UI Quality Bar, Spec-Driven Development, Scraping | 310 | Stays in `CLAUDE.md` |
| Reference | Tech Stack, Project Structure, Map Architecture, Wallapop Integration, Database Models, Data Sources, i18n, Design System, Testing | 245 | Moves to `docs/`, replaced by a pointer |
| Both | Project Overview, Commands | 28 | Short summary stays, detail moves |

**This is what makes the work worth doing rather than busywork.** Three payoffs,
in order of how much they matter:

1. **Humans get documentation at all.** Today the honest onboarding instruction
   is "read the 585-line file we wrote for the AI."
2. **`CLAUDE.md` gets shorter and sharper.** It is loaded in full at the start of
   every session. Roughly 40% of it is reference material an agent can read on
   demand, and every line of it competes for attention with the rules that
   actually constrain behaviour. A rules file that is mostly not rules is a
   rules file that gets skimmed.
3. **Facts get one home.** The Wallapop contract is currently in `CLAUDE.md`, in
   the `wallapop` memory file, and in `docs/specs/data-sources.md` §5. Three
   copies drift at three different rates, and none of them is marked as the one
   to trust.

> The extraction must **not** be mechanical cut-and-paste. Each section moves,
> then gets rewritten for a human reader — CLAUDE.md's compressed telegraphic
> style is right for an agent that reads it every session and wrong for a person
> meeting the codebase for the first time. Moving prose without rewriting it
> produces documentation nobody wants to read, which is the same as none.

## 3. The boundary: what is a doc, what is a spec, what is a rule

This is the part to get right before writing anything. The SDD adoption already
established one artifact with a clear job; adding a second overlapping one is
how both become untrustworthy.

| | `docs/specs/` | `docs/` guides | `CLAUDE.md` | Code comments |
| --- | --- | --- | --- | --- |
| Answers | What must it do, and why that way | How does it fit together, how do I run it | What must I never do | Why is *this line* strange |
| Voice | Contract | Explanation | Instruction | Aside |
| Scope | One feature | One subsystem or task | Whole repo | One file |
| Enforced by | `pnpm spec:check` | `pnpm docs:check` (Step 2) + `/check-all` | `/check` | Review |
| Changes when | Behaviour changes | Structure or operations change | A rule changes | The line changes |

**The single-source rule: every fact lives in exactly one file; everywhere else
links to it.** When a doc and a spec would say the same thing, the doc links to
the spec — specs are enforced and docs are not, so the enforced copy wins.

Worked examples, because the boundary is easy to state and easy to violate:

- *"A save with a blank listing id is rejected with an error code"* → spec
  (`FAV-7`). It is behaviour, it is tested, it has an id.
- *"Favorites store a snapshot rather than a reference, because no source client
  can fetch a listing by id"* → spec §4. Rationale for a specific behaviour.
- *"Server actions live in `app/actions/`, validate with Zod, and return
  `{ success, error? }`"* → doc (`architecture.md`). A pattern across features,
  owned by no single spec.
- *"Run `pnpm db:branch` before any Prisma command in a worktree"* → both, and
  that is correct: `CLAUDE.md` gives the imperative (an agent must not forget)
  and `docs/getting-started.md` gives the explanation (a human must understand
  why the guard exists). The doc holds the reasoning; `CLAUDE.md` links to it.

## 4. The document set

Twelve files. Ordered by value to someone who has never seen the repo.

### Tier 1 — Nobody can start without these

**`README.md`** — the front door, and the only file a stranger is guaranteed to
open. What BuyCarMap is in two sentences, a screenshot of `/map`, the five-command
quickstart, and links onward. Everything else is a link, not a paragraph: the
README is an index that happens to have a headline, and the moment it starts
explaining things it starts going stale. *Replaces the current tech list.*

**`docs/getting-started.md`** — clone to running app. `pnpm install`,
`pnpm db:branch`, `pnpm exec prisma generate`, env vars, `pnpm dev`. The
non-obvious parts get the space: why `prisma generate` is a separate step
(without `app/generated/prisma`, four test files fail at *import* while every
test that runs passes — which reads like an unrelated breakage), why worktrees
need their own database, and what "Refusing to run" means when the hook fires.
This file is the one with the highest ratio of pain saved to words written.

**`docs/README.md`** — the documentation index, and the **ownership map** that
Step 2's checker and `/check-all` both read: source glob → governing doc. Without
it, "which docs govern this change?" is answered by vibes.

### Tier 2 — Needed to change anything safely

**`docs/architecture.md`** — the system in one read. Three request paths traced
end to end, because tracing a real request teaches more than any component
inventory: a search (filters → `useSearchFilters` → `useListingsSearch` →
three proxy routes → three normalizers → interleaved `CarListing[]` → cards +
map), a sign-in (credentials → `authorize` → JWT → the `passwordChangedAt`
revocation clock), and a favorite (optimistic toggle → server action →
reconciliation into search results). Plus the cross-cutting patterns no spec
owns: server-actions-over-API-routes, error codes not prose, hooks own all
fetching. Diagrams in Mermaid so they diff in review.

**`docs/data-model.md`** — the eleven Prisma models, what each is for, and the
relationships between them. Then the migration workflow, which is the part that
has actually cost time: the branch-database rule, why `migrate status` does not
catch cross-worktree drift, how to repair a stale checksum without a reset.
*Absorbs the `prisma-migrate-dev-drift` memory.*

**`docs/integrations/{wallapop,cochesnet,milanuncios}.md`** — one per source.
The reverse-engineered contract: endpoint, required headers, request shape,
response shape, the normalizer's mapping, and — most valuable — the accumulated
folklore. Wallapop's proximity bias. The 2000km limit. The old `/cars/search`
endpoint returning randomized coordinates. coches.net carrying no coordinates at
all. This is knowledge that exists nowhere but `CLAUDE.md`, two memory files, and
whoever last debugged it, and it is unrecoverable from the source code because
the source is *someone else's* undocumented API. Each links to `data-sources.md`
for the behaviour we guarantee; the doc covers what upstream actually does.

**`docs/testing.md`** — the five levels and when to use each, the two Vitest
projects and why the split exists, MSW conventions, and the environment gotchas
that currently live in `CLAUDE.md` (fake timers vs `userEvent`, Radix Select
pointer plumbing, `<input type="email">` native validation, Leaflet in jsdom, the
`maxDiffPixels: 300` calibration). Every entry is a trap someone already fell
into; that is what earns them the space.

### Tier 3 — Needed to keep it alive

**`docs/frontend.md`** — the map feature's component structure, the hook
contracts, i18n key conventions, theming and the View Transitions switch, and
the design system (the OKLCH palette, the two fonts, semantic colour usage).
*Absorbs the Design System and Map Architecture sections.*

**`docs/auth.md`** — deliberately **thin**. `docs/specs/auth-email-and-oauth.md`
already covers this at 247 rationale-dense lines and is enforced. This file is a
one-page orientation — the pieces, the threat model in a paragraph, a diagram —
that hands off to the spec for everything else. **If it grows past a page, delete
it and link the spec directly.** Writing a second auth document is the single
most likely way this whole effort produces something misleading.

**`docs/operations.md`** — deployment (Vercel), the full env-var reference
(`.env.example` has 94 lines and no prose), Neon branch lifecycle, what each CI
job does and when it runs, and runbooks for the failures that will actually
happen: an upstream API changes shape (the nightly contract test is the alarm),
HIBP is down (fails open — here is how to confirm that is what happened), the
rate limiter locks someone out, a Neon branch needs deleting.

**`docs/decisions/`** — short ADRs for choices that no single spec owns and that
someone will otherwise re-litigate: no data-fetching library, pnpm over npm,
proxy routes over direct calls, JWT sessions over database sessions, Postgres
rate limiting over in-memory. One page each, in the "what was decided / what it
beat / what would change our mind" shape. These are cheap to write now and
expensive to reconstruct later.

**`docs/contributing.md`** — the loop end to end: `/spec` → approve →
`/spec-tests` → implement → `/check-all` → commit. Where each artifact lives,
what CI enforces, and the commit-message convention.

## 5. Steps

Each step is independently shippable and leaves the repo better than it found
it. Stop after any of them without leaving a mess.

### Phase 0 — Foundations

**Step 1 — The front door.** `README.md` rewritten, `docs/README.md` created
with the index and ownership map, `docs/getting-started.md` written.
*Exit:* a stranger clones the repo and has it running without reading
`CLAUDE.md`. *Size:* M.

**Step 2 — `pnpm docs:check`.** `scripts/docs-check.mjs`, in the same shape as
`spec-check.mjs` — dependency-free, fast, in CI next to `pnpm spec:check`. It
asserts four things, all mechanical:

1. Every internal link in `docs/` and `README.md` resolves — file exists, anchor
   exists.
2. Every source path a doc names in backticks exists. *This is the check that
   would have caught the two stale claims found in the 2026-08-03 audit:
   `/spec` telling future authors the e2e database round trip was a `test.skip`
   stub months after it became real, and `CLAUDE.md` saying the auth spec had no
   criteria table after Wave C gave it one.*
3. Every `.md` under `docs/` is reachable from `docs/README.md`. Orphans are how
   a doc stops being read and starts being wrong.
4. Every glob in the ownership map resolves to at least one file, and **every
   tracked source file is claimed by at least one row**.

   The first version of this check only asserted that each top-level *directory*
   was claimed, which a single `app/api/wallapop/**` row satisfied. Thirty-eight
   files — `proxy.ts`, every page route, every config — were governed by nothing
   while `docs:check` reported zero gaps. Tightened to per-file on 2026-08-03,
   with colocated tests inheriting their subject's row.

What it deliberately does **not** do is fail a commit for not touching a doc.
That is the "spec-first, enforced" rule `docs/specs/README.md` already
considered and rejected — *"it sounds disciplined and gets routed around, and a
rule people route around teaches them the whole process is optional."* The same
reasoning applies here, so judgment stays in `/check-all`'s documentation phase
and the script only catches what a script can actually know.
*Exit:* renaming a file that a doc references turns CI red. *Size:* M.

### Phase 1 — Extract and rewrite

One wave per document. Each wave: write the doc from the code (not from
`CLAUDE.md` — verify every claim against the source, because the audit found
`CLAUDE.md` itself carrying stale ones), then replace the `CLAUDE.md` section
with a two-line pointer, then update the ownership map.

| Step | Document | Absorbs from `CLAUDE.md` | Size |
| --- | --- | --- | --- |
| 3 | `architecture.md` | Project Structure, Map Architecture | L |
| 4 | `integrations/*.md` (×3) | Wallapop Integration, Data Sources | L |
| 5 | `data-model.md` | Database Models, the worktree/migration rules | M |
| 6 | `testing.md` | Testing (all of it) | M |
| 7 | `frontend.md` | Design System, i18n | M |
| 8 | `operations.md` | — (new; env, deploy, runbooks) | M |
| 9 | `auth.md` + `contributing.md` | Commands | S |
| 10 | `decisions/` (×5 ADRs) | Tech Stack rationale | M |

Order is not arbitrary. Steps 3–5 are the ones with knowledge that is
**unrecoverable from the code** — the upstream folklore and the migration traps.
If the effort stalls halfway, it should stall having captured those.

### Phase 2 — Make it stick

**Step 11 — Reconcile the memory files.** `wallapop`, `cochesnet-api` and
`prisma-migrate-dev-drift` become the third copy of facts that now live in
`docs/`. Cut each down to a pointer at the doc that owns it. *Size:* S.

**Step 12 — Prune `CLAUDE.md`.** With the extraction done, read the remainder as
a rules file and cut what is no longer rules. Target: under 350 lines, all of it
imperative. *Size:* S.

**Step 13 — Audit pass.** Re-read every doc against the code, the way this plan's
own audit re-read the SDD setup. Do it once the first feature has shipped through
the full loop, when drift is small enough to fix and recent enough to remember.
*Size:* M.

## 6. Risks, stated plainly

- **Twelve documents is a lot of prose to keep true**, and this is the same risk
  `sdd-adoption-plan.md` §5 named about fourteen specs. It was right then. The
  mitigations are the single-source rule (§3), `docs:check` catching mechanical
  rot, and `auth.md`'s explicit instruction to delete itself if it grows.
- **Extraction can lose information.** `CLAUDE.md`'s compression is dense —
  parenthetical asides carry real content, and a rewrite for readability can
  quietly drop them. Diff each extracted section against its replacement before
  deleting the original.
- **The `/check-all` documentation phase is judgment, not verification.** It
  catches "you changed an env var and touched no doc." It cannot catch a doc that
  is confidently wrong. Step 13 is the only thing that catches that, and it only
  works if it actually happens.
- **Docs and specs will overlap anyway.** §3's boundary is clear in principle and
  will be argued over in practice. When in doubt the answer is the enforced
  artifact: put it in the spec and link from the doc.
- **This plan competes with feature work.** Thirteen steps is weeks of writing
  that ships no product. The tiers exist so it can be stopped after Phase 0
  (front door + checker) and still have paid for itself.

## 7. Summary

| Step | Deliverable | Size | Status |
| --- | --- | --- | --- |
| 1 | `README.md`, `docs/README.md`, `getting-started.md` | M | **done 2026-08-03** |
| 2 | `pnpm docs:check` + CI wiring | M | **done 2026-08-03** |
| 3 | `architecture.md` | L | **done 2026-08-03** |
| 4 | `integrations/{wallapop,cochesnet,milanuncios}.md` | L | **done 2026-08-03** |
| 5 | `data-model.md` | M | **done 2026-08-03** |
| 6 | `testing.md` | M | **done 2026-08-03** |
| 7 | `frontend.md` | M | **done 2026-08-03** |
| 8 | `operations.md` | M | **done 2026-08-03** |
| 9 | `auth.md` | S | **done 2026-08-03** — `contributing.md` folded into `docs/README.md`, see below |
| 10 | `decisions/` (5 ADRs) | M | **done 2026-08-03** |
| 11 | Reconcile memory files | S | **done 2026-08-03** |
| 12 | Prune `CLAUDE.md` to rules only | S | **done 2026-08-03** — 619 → 432 lines |
| 13 | Full audit pass against the code | M | **done 2026-08-03** |

### Deviations from the plan as written

**`contributing.md` was not created.** The content — the spec loop and what CI
enforces — went into `docs/README.md` as a section instead. A separate file would
have been thirty lines duplicating the index's own purpose, and the single-source
rule in §3 applies to this plan as much as to anything else.

**`CLAUDE.md` landed at 432 lines, not the 350 target.** What remains is
`Rules for Claude` (138), the UI quality bar (47), spec-driven development (75)
and documentation (33) — 293 lines of pure instruction, plus orientation,
commands, invariants and current state. Hitting 350 would have meant deleting
rules to satisfy a number. The reference extraction, which was the actual goal,
is complete: every `## ` section that was description is now a pointer.

**Step 12 found drift the 2026-08-03 SDD audit missed.** `CLAUDE.md` listed
Milanuncios under "Planned" and `Favorite` under "not yet modeled", both
contradicted eight lines earlier in the same file, and the search-flow summary
still described a single-source fan-out. All three vanished with the sections
that carried them — which is the argument for extraction stated more plainly than
§2 managed.

**The `README.md` has no screenshot.** Linking an image that does not exist is
exactly the rot `docs:check` is built to catch, so the slot was left empty rather
than filled with a broken link. Add a PNG under `docs/` and wire it in.

The `/check-all` documentation phase is live and applies to the next commit.

## 8. What was verified, and what was not

### Verified against source, not copied from `CLAUDE.md`

Every number and named constant asserted anywhere in `docs/` was re-read from the
code it describes:

| Claim | Checked against |
| --- | --- |
| Rate limits — 20/15 min per IP, 8 failures/15 min per account, and the rest | `lib/rate-limit.ts` `RATE_LIMITS` |
| 7-day session, 5-minute revalidation interval | `lib/auth/options.ts` |
| Prune probabilities — 2% tokens, 1% rate-limit rows | `lib/auth/cleanup.ts`, `lib/rate-limit.ts` |
| Password length 12–72 | `lib/auth/password-strength.ts` |
| 60-second search cache | `lib/wallapop/cache.ts` |
| Spain centre 40.0/−3.5, Madrid fallback, 1000 km default | `lib/wallapop/client.ts`, `normalize.ts` |
| coches.net page size 40, flat `vehicles: [{makeId, modelId}]` | `lib/cochesnet/client.ts` |
| Milanuncios `?rule=hw396_70`, `isReserved` filter | `lib/milanuncios/normalize.ts` |
| Coverage thresholds 89/85/84/89 | `vitest.config.ts` |
| OKLCH palette values | `app/globals.css` |
| `DEFAULT_LOCALE = "es"` | `lib/i18n/config.ts` |
| Build-script allowlist — five packages | `pnpm-workspace.yaml` |
| Eleven Prisma models | `prisma/schema.prisma` |

**One claim was verified by experiment rather than by reading.** `getting-started.md`
says that without `app/generated/prisma`, "four test files fail at *import* while
every test that does run passes". Moving the generated client aside produced
exactly that: `4 failed | 93 passed` files, `797 passed | 3 skipped` tests, and
**zero test failures** — the misleading signature the doc warns about.

### Found by being asked "are you sure?"

Two defects survived the Step 13 audit and were caught only when the work was
challenged after it had been declared finished:

- **The ownership check was measuring the wrong thing** (see Step 2 above). It
  reported zero gaps across 186 files while 38 of them were governed by nothing.
  A green check on a weak rule is worse than no check, because it is quoted as
  evidence.
- **A flaky e2e test was a real product bug.** `FAV-3` failed two runs in three;
  the cause was `useSession()` reporting `"loading"` being treated as signed out,
  which pushed a signed-in user to `/login` and — via `proxy.ts`'s guest-only
  redirect — dumped them on the home page with their click lost. Fixed as FAV-18.

Both are the same lesson: **the checks were passing, and the checks were wrong.**

### Still true, and not fixable by a script

- **`docs:check` cannot read.** It proves links resolve, referenced paths exist,
  no doc is orphaned and the ownership map is complete. A doc can be fluent,
  well-organised and wrong while every check stays green.
- **Prose judgements were not independently challenged.** The tables above cover
  the checkable claims. Explanations of *why* something is the way it is — the
  reasoning in the ADRs especially — rest on one reading of the code.
- **Twelve documents is a real maintenance surface.** The mitigation is the
  ownership map plus `/check-all` asking on every commit, both of which depend on
  someone answering the question rather than typing "no docs needed".
