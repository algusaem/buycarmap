# Review protocol

Every `check-*` review command follows this file. It says **how** to review; each command says
**what** it reviews — the rules it owns and the files it applies to. `/check-all` runs every review
in parallel, each in a fresh subagent; each one can also be run on its own. The coverage map in
`check-all.md` says which check owns each rule.

## 1. Scope first

1. **The change set** is what the brief names: by default the working changes (`git status`,
   `git diff --name-only`, `git diff --cached --name-only` — changed, staged and untracked files); a
   commit or a range (`git diff <base>...HEAD`) when the brief says so. Run on your own with a clean
   tree, say so and stop — never review an empty diff.
2. **Map the paths.** The command's "Applies to" list uses the `STACK.md` §6 layout (`src/app`,
   `src/server`, `src/lib`…). If the project's layout differs (no `src/`, hooks in `lib/hooks/`,
   strings outside `messages/`), map each path to its equivalent and say how. The layout deviation
   itself is `check-stack`'s.
3. Keep the files your check applies to. **If none of them changed, report "Not applicable —
   no <domain> changes" and stop** — no rules to load, no other sections except "Outside my lane"
   if you noticed something while scoping.
4. Read each of those files in full. Read what they import or what consumes them when you need it to
   judge the change; an unchanged file whose behaviour the change alters (a component rendering a
   hook's new result) is in scope for that consequence.
5. **What counts as changed**: added or modified logic. Code moved or extracted verbatim counts as
   pre-existing, unless the change gives it a new call path — then the new call path is changed.
   Violations in untouched code go in a separate **Pre-existing** list and never block.
6. **Pre-existing, widened by the change**: a defect whose root is untouched but that the change
   makes more likely or more harmful (a missing guard around a loop the change adds, a race the change
   makes wider) is a finding, not Pre-existing — say where the root is. Its severity is judged as if it
   were new. **Reusing an existing component or pattern as it is doesn't widen its defects**: a new
   use of a shared checkbox that lacks a focus ring, or a new chip in an unanimated chip list, leaves
   that defect Pre-existing — fixing a shared component is its own task, outside this change's scope.

## 2. Load the rules

Where to look: in the repo under review first, then at the workspace root above it (a folder holding
several repos keeps `CLAUDE.md`, `RULES.md` and `STACK.md` there, and each repo keeps its own docs).

Only once something is in scope. Read in full the rulesets whose sections your check owns; consult
the others where you need them:

1. `RULES.md` — the development rules.
2. `CLAUDE.md` (root, plus any subdirectory `CLAUDE.md` / `AGENTS.md` covering changed files) — also
   when git ignores them: many projects keep `CLAUDE.md` out of version control.
3. `STACK.md`.
4. `STACK-ERP.md` only if it is in the project **or** `CLAUDE.md` says the project follows it (tenants, legal entities, money, fiscal documents — a module called "CRM" is not enough). A copy
   in the core repo doesn't make a project ERP.
5. `docs/decisions/` — list the ADRs. A deviation from `STACK.md` / `STACK-ERP.md` is allowed **only**
   if an ADR covers it; cite the ADR when you accept one.
6. `docs/specs/` — the spec(s) for the features touched by the changes.

**A project that hasn't adopted the core** (no `RULES.md` / `STACK.md`, or `CLAUDE.md` doesn't
reference them): load them from the core repo when the brief says where, and say so in the Rulesets
line — `check-process` alone reports the missing adoption as a NOTE. An **adoption ADR** in
`docs/decisions/` can accept named legacy deviations (the layout, the spec template, missing
tooling) until they are migrated; a change that only extends a deviation the adoption ADR accepts
is a NOTE citing that ADR, not a BLOCKER. For the deviations it names, the ADR wins over `RULES.md`,
`STACK.md` and the project-rule precedence below. Without one, the rules apply as written.

State in one line which rulesets apply.

**Project `CLAUDE.md` rules** belong to the check whose domain they cover — a testing rule to
`check-tests`, a UI rule to `check-front`, and so on; `check-good-practices` takes the rest. Review
the ones in your domain with the same severity rules. When a project rule and `RULES.md` or the
stack disagree, and the change touches that rule, apply `RULES.md` / the stack — unless the adoption
ADR accepts the project's rule — and add a NOTE naming both; don't repeat project-wide
contradictions the change doesn't touch.

## 3. Stay in your lane

Report only the rules your check owns; what another check owns, that check reports. This keeps a
`/check-all` run free of duplicate findings. Where a command says otherwise (`check-correctness`
reports a defect even when it also breaks another check's rule), the command wins.

**Outside your lane**: a real defect you notice that your check doesn't own — a bug, a race, a rule
another check owns — goes in its own short list with the owner you'd suggest, never as a finding.
`/check-all` routes it; nothing seen is silently dropped.

**APPROVAL findings belong to `check-process` only.** If the fix you'd recommend would itself need
approval under `RULES.md` §1, say so in the finding ("the fix touches auth — needs approval").

## 4. Review as if someone else wrote it

Especially if the code was written in this same session. Having the rules in context while writing
proves nothing: most misses are rules that were in context and slipped. Check each rule against the
code on disk, never against a memory of writing it.

## 5. Severities

- **BLOCKER** — breaks a mandatory rule in `RULES.md` (anything not marked SHOULD or phrased as a
  preference) or in the project's `CLAUDE.md`, or a rule in `STACK.md` / `STACK-ERP.md` without an
  ADR. The change is not ready to commit.
- **APPROVAL** — (`check-process` only) the change falls under `RULES.md` §1 or uses an escape hatch
  from §3. The diff can't prove it was approved. Accept it only if the approval is on record — an
  ADR, the spec as it stood before this change set, or the user approving it (quoted in the brief, or
  in this session) — and cite where. A spec amended inside the change set does not approve itself.
  Otherwise the verdict can't be READY until the user confirms it.
- **ISSUE** — breaks a SHOULD rule, a preference, a rule stated only in a command file, or a clear
  good practice.
- **NOTE** — worth knowing, no action required.

## 6. Evidence and limits

- Every finding: `file:line`, a literal quote of the offending code, the rule (`RULES.md §11`,
  `STACK.md §6`, `CLAUDE.md › Section`) and how to fix it.
- **A review is read-only**: no edits, no git writes, no installs. It reports; fixing is decided
  afterwards (by `/check-all`, or by the user when the check runs on its own). `check-tests` is the
  only command with writing phases, and they say so.
- Do not invent data: if a fact is missing, say so instead of assuming it.

## 7. Output

Not applicable → one line, `### <check name> — NOT APPLICABLE (<reason>)`, plus "Outside my lane" if you noticed anything. Otherwise:

```
### <check name> — PASS | ISSUES FOUND
Rulesets: <which apply> · Change set: <working changes | commit | range> · Files in scope: <n changed files in your lane; context files listed separately>
Path mapping: <how the Applies-to paths map to this project, or "standard layout">

#### <section of the check>
- **BLOCKER** `path/file.ts:42` — `<quote>` — what's wrong, which rule, how to fix it
- **APPROVAL** … / **ISSUE** … / **NOTE** …

#### Definition of done
<each `RULES.md` §22 item this check owns: done (evidence) | missing (BLOCKER) | n/a (reason)>

#### <sections the command adds to the output, e.g. check-tests' cases to write>

#### Outside my lane
<defects owned by another check, with the suggested owner — or "None">

#### Pre-existing
<violations in untouched code, non-blocking>

**Verdict:** N blockers, A approvals, M issues.
```
