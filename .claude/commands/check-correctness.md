---
description: Review working changes for logic defects — code that doesn't do what its spec says — races and out-of-order responses, loops that don't terminate, error paths, edge cases, inconsistent state
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*)
---

Review the working changes for **correctness**: does the code do what its spec says, in every path? Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

Every other check compares the code against rules. This one reads it as a bug hunter: it traces what the code does and compares it with what the spec and the acceptance criteria say it should do.

**Owns:** the behaviour of the changed code against its spec (`RULES.md` §4) and against the application's integrity (`RULES.md` §6: "never introduce changes that compromise the application, its users or their data"). Report the defect even when it also breaks a rule another check owns (a swallowed error, a guard a project rule requires): `/check-all` merges findings by root cause.
**Applies to:** every changed source file (`.ts`, `.tsx`), and the unchanged code whose behaviour the change alters (review protocol §1).

## 1. Trace the change

For each changed function, hook, action or component: read it with its callers and callees, and write down — for yourself — what it does on the happy path, on each error path, and at the edges. Then compare with the spec's acceptance criteria, worked examples and edge cases. Every mismatch is a finding.

## 2. What to hunt for

- **Concurrency and ordering**: out-of-order responses overwriting newer state; a second call starting while the first is in flight; missing version refs, `AbortController`s or cancelled flags; state written after unmount; shared refs mutated by two paths.
- **Termination and bounds**: loops or retries whose exit depends on an external API behaving; recursion without a base case; unbounded work per user action.
- **Error paths**: failures swallowed or turned into a normal-looking result (an empty list that really means "everything failed"); partial failure leaving state half-updated; a cache storing an error or an empty failure as a valid result; a `catch` that can never be reached.
- **Edge cases**: empty, single and very large inputs; `null` / `undefined`; boundaries (0, 1, the limit, the limit + 1); duplicates; time zones and dates; rounding.
- **State consistency**: two sources of truth that can disagree (a ref and a state, a cache and the server); derived values not recomputed; stale closures.
- **Data integrity**: writes that can lose or duplicate data under concurrency; a missing transaction around related writes; idempotency where retries happen.
- **Contract mismatches**: a caller relying on something the callee no longer guarantees; types that say one thing while runtime values say another.

## 3. Severity

- **BLOCKER** — the code contradicts its spec or its acceptance criteria, or can corrupt data or state, in a scenario you can describe step by step.
- **ISSUE** — a likely defect you can't fully prove from the code (it depends on an external API's behaviour, on timing you can't pin down), or a path the spec doesn't cover where the code's choice is questionable — the spec gap itself goes to `check-process`.
- **NOTE** — hardening worth considering; no defect.

Every finding carries **the failure scenario**: the inputs or sequence of events, what the code does, and what it should do instead. No scenario, no finding.

## Definition of done

Owns no `RULES.md` §22 item; its BLOCKERs make the `/check-all` verdict NOT READY like any other.
