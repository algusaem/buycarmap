---
description: Review working changes for data access and schema — Prisma usage, N+1, transactions, data model, expand/contract migrations, seeds
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Agent
---

Review the working changes for **data access and the schema**. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `RULES.md` §11, §3 (editing applied migrations, real data in seeds); `STACK.md` §3, §9.
**Applies to:** `prisma/**` (schema, migrations, seeds), `src/server/**/service.ts`, `src/lib/db/**` (or the project's Prisma client module), and any file with a Prisma call.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
Run on its own, the main session does not review data access and the schema itself, however capable it is of doing so:
- **The whole review → one `Agent` with `subagent_type: "lacayo-opus"`**, told it is the delegated agent and spawns no agents, and briefed with this file, `.claude/review-protocol.md`, the change set, the task in the user's words and the approvals the user gave, quoted; it returns the output of review protocol §7.
- **The mastermind** re-measures with its own eyes only the facts it will state (a quoted `file:line`, the changed files: single read-only commands), and writes the report; which findings get fixed is the user's decision when the check runs on its own (review protocol §6). The fixes the user asks for are dictated edits: direct for two or three steps in one file, `lacayo-sonnet` for anything longer.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## 1. Access (`RULES.md` §11)

- Database access only through Prisma and `src/lib/db/`. `PrismaClient` or a driver adapter instantiated anywhere else → BLOCKER.
- Raw SQL (`$queryRaw`, `$executeRaw`, `Prisma.sql`) carries a comment justifying it; without it → BLOCKER. (The APPROVAL is `check-process`'s.)
- `select` only the fields needed. A full model — or one with sensitive fields — returned to the client → BLOCKER.
- N+1: a database query inside a loop, `.map` or per-row `await` → BLOCKER; use `include` or a grouped query. (Loops over external APIs are `check-correctness`'s and `check-stack`'s.)
- Writes touching several related tables outside `$transaction` → BLOCKER.
- Editable entities: `version` asserted and incremented on update, conflict surfaced (`STACK.md` §9).

## 2. Data model (`STACK.md` §9)

For every changed model: UUIDv7 ids in `uuid` columns; `@map` / `@@map` to snake_case; standard columns (`id`, `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `version`); `timestamptz` (`date` only for true calendar dates); FKs constrained, `onDelete: Restrict` unless the child is meaningless alone; the index added with the query that needs it; Prisma enums for fixed technical sets, lookup tables when users add values or need translated labels — never a free-text status column.

## 3. Migrations (`RULES.md` §11, `STACK.md` §3)

- **Expand/contract**: the migration must work with the *previous* version of the code, because production applies it before the new code is live. Dropping or renaming a column/table, adding `NOT NULL` without a default, or narrowing a type in the same change as the code that stops using it → BLOCKER.
- Generated with `prisma migrate dev` and committed; schema and migration agree. An already-applied migration edited → BLOCKER — every schema change is a new migration.
- Vercel build command stays `prisma migrate deploy && next build`; migrations use `DIRECT_URL`, runtime the pooled `DATABASE_URL`.
- A backfill is an idempotent, resumable job. Migrations touching large tables → NOTE: run on staging first.

## 4. Seeds

- Updated when the schema change requires it.
- Generated with faker, never real data → otherwise BLOCKER. Seed data separate from test factories.

## Definition of done

Owns `RULES.md` §22 item 10 (schema change: new migration, backward-compatible, seeds updated).
