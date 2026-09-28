# Spec format and docs tree (migration phase 4)

Key: DOCS
Status: Implemented
Last updated: 2026-09-28

---

## Problem

The specs and the documentation still follow BuyCarMap's own shape, not the core's. The specs have
no Worked examples, Permissions or Edge cases sections, so the critical-path values the core
requires (`RULES.md` §4, `STACK.md` §15–16) are scattered through prose or missing. The docs tree
has guides and a single `operations.md` that the core tree has no place for, and no
`docs/privacy/` at all, so nobody can answer "which personal data do we hold, for how long, and who
receives it" without reading the schema and the code. This is phase 4 of
`docs/decisions/0007-adopt-core-rules.md` (rows 8 and 9).

In scope:

- Every spec in `docs/specs/` is rewritten in the core section order, and so is `_template.md`.
  That includes this spec, once it is `Implemented`.
- `pnpm spec:check` is adapted to the new criteria checklist.
- The guides are folded into `docs/ARCHITECTURE.md`, the root `README.md` and the specs, and the
  two finished plans are deleted.
- `docs/privacy/` and `docs/operations/backups.md` are written from what the code and Neon do
  today.
- `docs-check` follows the index to its new home.
- `/spec`, `/spec-tests`, `/check-docs`, `/check-sources` and `CLAUDE.md` are updated to the new
  paths and format.
- ADR 0011 records where BuyCarMap keeps more than the core asks for.

## Acceptance criteria

`unit` means a `*.node.test.ts` under `scripts/` that reads the working tree or runs the script
under test on fixtures.

- [x] DOCS-1 · unit — Every spec in `docs/specs/` except `_template.md` has the title `# <Feature>`, then the `Key:`, `Status:` and `Last updated:` lines, then exactly these `##` headings in this order: `Problem`, `Acceptance criteria`, `Worked examples`, `Data model`, `Permissions`, `Edge cases`, `Out of scope`, optionally followed by `Contracts`, `Decisions and rationale`, `Open questions` in that order. No section is empty, and no heading is numbered. `_template.md` has the same headings.
- [x] DOCS-2 · unit — Criteria are checklist items `- [ ] KEY-n · <level> — <statement>` or `- [x] KEY-n · <level> — <statement>`, where `<level>` is one of `unit`, `node`, `component`, `contract`, `e2e`, or several of them joined by ` + ` when a criterion is proven at more than one level (the owner's decision, 2026-09-28). No spec keeps a criteria table. `spec:check` declares a criterion only from such an item.
- [x] DOCS-3 · unit — `spec:check` fails when an `Implemented` spec has an unchecked criterion, and accepts one in a `Draft` or `Approved` spec.
- [x] DOCS-4 · unit — `spec:check` keeps every check it has today: a duplicate key, an enforced spec with no criteria, a criterion no test title names, and a test title naming an undeclared id of a known key each fail. The existing `spec-check.node.test.ts` cases keep their assertions, with only their spec fixtures rewritten from table rows to checklist items.
- [x] DOCS-5 · unit — Every criterion on the critical list (Contracts › the critical list: permission boundaries and bug fixes) has at least one worked example under `## Worked examples` in its spec. The example names the criterion id and carries an exact input and an exact result.
- [x] DOCS-6 · unit — Every file under `docs/` is `docs/ARCHITECTURE.md`, `docs/decisions/NNNN-<title>.md`, `docs/specs/<feature>.md`, `docs/specs/_template.md`, `docs/privacy/{data-inventory,processors,deletion}.md`, `docs/operations/backups.md` or `docs/images/*`. So `architecture.md`, `auth.md`, `data-model.md`, `frontend.md`, `getting-started.md`, `operations.md`, `testing.md`, `integrations/`, both plans, `docs/README.md`, `docs/specs/README.md` and `docs/decisions/README.md` are gone.
- [x] DOCS-7 · unit — `docs-check` uses the root `README.md` as its index. Every `.md` under `docs/` is reachable by links from it, and the ownership map is read from its "Ownership map" section.
- [x] DOCS-8 · unit — `docs/privacy/data-inventory.md` has a table with the columns Model · Field · Purpose · Retention and one row per personal field listed under Contracts. `processors.md` has a table with the columns Processor · Region · Data received · DPA and one row per processor listed under Contracts. `deletion.md` describes erasure through the account deletion action, what survives it, and Neon's restore window of 6 hours.
- [x] DOCS-9 · unit — `docs/operations/backups.md` gives the Neon point-in-time-restore procedure. It names the project region `aws-eu-central-1` and the 6-hour history window.
- [x] DOCS-10 · unit — `/spec`, `/spec-tests`, `_template.md` and `CLAUDE.md` describe the checklist format. None of them mentions a criteria table or a "Verified by" column, and every doc path they name exists.

## Worked examples

- **DOCS-2** — `- [ ] FAV-3 · node — x` declares FAV-3; a table row `| FAV-3 | x | node | — |` declares nothing; `- [x] FAV-3 — x` (no level) fails, naming FAV-3; `- [x] FAV-3 · node + e2e — x` declares FAV-3; `- [x] FAV-3 · node + api — x` fails, naming FAV-3.
- **DOCS-3** — `Status: Implemented` with `- [ ] FAV-3 · node — x` and a test titled `FAV-3: x` fails, naming FAV-3 as unchecked; the same item under `Status: Approved` passes.
- **DOCS-7** — a `docs/` file linked from nowhere fails, naming it; a map row whose doc does not exist fails.

## Data model

None: this phase adds or changes no table or column.

## Permissions

None: this phase changes specs, docs and their check scripts only; it adds no user data and
changes no authorization (see Out of scope: no behaviour change).

## Edge cases

- DOCS-2 — a checklist item with no level fails, naming the criterion; a table row declares nothing.
- DOCS-3 — an unchecked criterion in an `Implemented` spec fails.
- DOCS-4 — a duplicate key, an enforced spec with no criteria, a criterion no test title names, and a test title naming an undeclared id each fail.
- DOCS-7 — a `docs/` file linked from nowhere, and a map row whose doc does not exist, each fail.
- A dropped criterion: see Decisions › Ids and `spec:check` stay (owner's decision, 2026-09-28).
- A critical criterion with no exact value in any test: see Decisions › The Worked examples come from the tests, and the owner confirms them.

## Out of scope

**Out of scope.** Each of these becomes a GitHub issue once this spec is approved, not part of
this diff.

- **No behaviour change.** No criterion changes meaning, no id is renumbered, and no test other
  than the fixtures of `spec-check` and `docs-check` changes.
- **The privacy gaps the inventory exposes are recorded, not fixed.**
  - There is no account data export (`RULES.md` §12).
  - `AlertCriteria` rows, which can hold the user's coordinates, survive account deletion.
  - The in-app privacy page (`lib/i18n/locales/*.ts`) does not list Resend, Vercel, Google, GitHub
    or Have I Been Pwned.
  - `SearchHistory` is never written.
- `docs/operations/staging.md` belongs to phase 12. There is no staging environment until then
  (ADR 0007 row 26).
- Processor DPA links and the regions of processors other than Neon also belong to phase 12
  (row 26). This phase records only the Neon region measured below.
- Pino `redact` paths belong to phase 6, which brings Pino.
- `docs/images/map.png` is an image, not a document. It stays where the root `README.md` links it.

## Contracts

**The critical list for DOCS-5.**
- Permission boundaries:
  - ALERT-4, ALERT-5, ALERT-9, ALERT-26, ALERT-27;
  - FAV-5, FAV-6, FAV-8;
  - AUTH-1, AUTH-2, AUTH-5, AUTH-6, AUTH-7, AUTH-8, AUTH-10, AUTH-11, AUTH-12, AUTH-13, AUTH-14.
- Redirects for signed-out users (ALERT-30, FAV-12, FAV-15) are UX, not authorization
  (`CLAUDE.md` › Authentication), and navbar visibility is too. None of them is on the list.
- Bug fixes (anything that broke once): MAP-7, MAP-16, MAP-17, MAP-18, MAP-19, FAV-18, SRC-12,
  SRC-14.

**Personal fields for DOCS-8,** from `prisma/schema.prisma`:
- `User`: `email`, `password`, `name`, `image`, `emailVerified`, `locale`, `twoFactorSecret`,
  `twoFactorEnabledAt`, `twoFactorLastStep`, `passwordChangedAt`, `createdAt`.
- `TwoFactorRecoveryCode`: `codeHash`, `usedAt`.
- `Account`: `providerAccountId`, `refresh_token`, `access_token`, `id_token`.
- `Session`: `sessionToken`.
- `VerificationToken`: `identifier`, `token`.
- `PasswordResetToken`: `tokenHash`.
- `PendingRegistration`: `email`, `password`, `name`, `tokenHash`.
- `EmailVerificationToken`: `tokenHash`, `newEmail`.
- `RateLimit`: `key`, which embeds IPs and emails.
- `Favorite`: `userId`, plus the listing snapshot.
- `AlertCriteria`: `criteria`, which may hold coordinates.
- `Alert`: `label`, `unsubscribeTokenHash`.
- `AlertMatch`: the listing snapshot.
- `SearchHistory`: `query`.

Retention is recorded as the code and the published privacy page define it today:
- The account's data lives while the account does, and is removed on deletion by cascade.
- Tokens are kept until they expire and are pruned.
- `RateLimit` rows are kept for their window.

Where the code defines no retention (`AlertCriteria` after account deletion), the inventory says so
and links the issue.

**Processors for DOCS-8.**
- Neon: `aws-eu-central-1`, measured through the Neon API on 2026-09-28.
- Vercel.
- Resend.
- Google and GitHub, as OAuth providers.
- Have I Been Pwned: a 5-character SHA-1 prefix.
- OpenStreetMap Nominatim: the typed location query.
- CARTO: map tiles.
- Wallapop, coches.net and Milanuncios: search filters and the chosen coordinates.
- GitHub Actions: the alert cron, which receives no user fields.

Regions other than Neon's, and every DPA link, read "phase 12".

**Neon, as measured on 2026-09-28:** the project is `buycarmap`, in region `aws-eu-central-1`, with
`history_retention_seconds` 21600 (6 hours), on the `free_v3` plan.

**Fixtures.** The new `spec-check` and `docs-check` cases use checklist items. No existing
assertion changes; the only edits to existing test lines are the two import statements that drop
`as unknown as` (the owner's decision, 2026-09-28).

## Decisions and rationale

**Ids and `spec:check` stay (owner's decision, 2026-09-28).** ADR 0007 row 8 lists `KEY-n` ids and
`spec:check` as the deviation to remove. The core, however, has no way to tie a criterion to its
test. Removing the ids would strip 375 test titles of their link to the spec. Removing `spec:check`
would take a step out of `lint`, which `RULES.md` §3 forbids as weakening verification. The core
format is kept, with the id at the head of each checklist item. ADR 0011 records this as a project
addition, because ADR 0007 is never edited. A dropped criterion is still caught: the test that
names its id becomes a dangling reference, and `spec:check` already fails on that.

**The checkbox replaces "Verified by".** The column duplicated what `spec:check` proves from test
titles, and nothing checked it, so it drifted. A checked box means the criterion's test is green
on the branch that set it. `Implemented` with an unchecked box is the one contradiction a script can
see (DOCS-3).

**Extra sections are optional, after the fixed ones.** The core's seven sections have no home for
three things: why a thing is built the strange way it is, which is the part that outlives the code;
contracts such as route shapes, env vars and upstream APIs; and open questions. Dropping them would
lose the reason behind MAP-16..19, among others. So they come after the seven fixed sections, where
the fixed ones stay intact and the checks can still find them.

**The guides are folded, not kept (owner's decision, 2026-09-28).**
- `ARCHITECTURE.md` takes the system and its environments:
  - `architecture.md`;
  - the orientation in `auth.md`;
  - the model overview, cascades and migration rules in `data-model.md`;
  - `frontend.md`;
  - `testing.md`;
  - `operations.md` (deploy, env vars, Neon branches, CI, alerts operations, runbooks).
- The root `README.md` takes getting started, the docs index and the ownership map.
- The upstream contracts in `integrations/` go into `data-sources.md` under `## Contracts`, because
  the old template's "Data and contracts" section is where external API shapes always belonged.
- Where a guide repeats something a spec already says, the spec keeps it and `ARCHITECTURE.md`
  links to it ("every fact lives in exactly one file").
- The two plans say they are complete and live on in git history, so they are deleted, not
  folded.

**The Worked examples come from the tests, and the owner confirms them.** `RULES.md` §4 forbids
inventing expected values. The critical list is already covered by green tests with hand-derived
values, so the conversion lifts each example from the test that verifies the criterion. All of them
go to the owner as one list before the PR opens. Where no test carries an exact value, the item is
asked for, not made up.

**One PR with separate commits.** The phase rule is one branch and one PR. The spec format and the
docs tree are separate commits, so the review can read them apart.
