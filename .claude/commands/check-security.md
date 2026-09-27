---
description: Review working changes for security — authentication and authorization, input validation, personal data (GDPR), logs, rate limiting, headers and CSP, caching, environments
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*)
---

Review the working changes for **security**. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `RULES.md` §6 (security), §9 (input validation and auth in every action/handler), §10 (the permission logic; its tests are `check-tests`'), §12, §15 (what reaches logs and Sentry), §16, §3 (checking roles by hand); `STACK.md` §2 (environment isolation, EU regions), §10, §11 (except env validation → `check-stack`), §12, §13 (webhook verification, API keys); secrets in the diff.

**In CRM/ERP projects**, the tenant-specific parts — tenant and legal entity in the auth chain, CASL abilities, tenant-prefixed cache tags — are `check-erp`'s; this check still reviews the base chain and caching.
**Applies to:** `src/server/**`, route handlers, `src/lib/auth/**`, `src/lib/logger.ts`, `proxy.ts`, `next.config.*`, Sentry config, `prisma/schema.prisma` (personal fields), `docs/privacy/**`, and any file that logs, caches or reads user data.

## 1. Authentication and authorization (`RULES.md` §9, §10, `STACK.md` §10)

- Every query and Server Action / route handler follows `authenticate → authorize → validate (Zod) → service`, on the server. A missing step → BLOCKER — including a Server Action "only called from a protected page": it is a public endpoint.
- Authorization only through `src/lib/auth/permissions.ts` (`can(user, action, resource)`); any inline role check (`role === "admin"`) → BLOCKER.
- Permission-filtered data filtered in the query (`where` built from the permission), never fetched and filtered afterwards → BLOCKER.
- Server-side sessions; a password or role change revokes the other sessions; auth events audited.

## 2. Input and exposure (`RULES.md` §6, §9)

- Every Server Action and route handler validates its input with Zod on the server. Unvalidated input, or validation only on the client → BLOCKER.
- Keys, tokens or real credentials in the diff; a `.env*` file committed other than `.env.example`; a secret in a `NEXT_PUBLIC_` variable → BLOCKER. (gitleaks itself runs in `check-verify`; full models returned to the client are `check-data`'s.)

## 3. Personal data (`RULES.md` §12, `STACK.md` §12)

A new field holding personal data → in this same change, all of: `docs/privacy/data-inventory.md` (model, field, purpose, retention), the export, the deletion/anonymization, and Pino's `redact` paths — any missing → BLOCKER. (Undefined retention is an APPROVAL: `check-process` asks for it.) A new provider or new personal data sent to one → `docs/privacy/processors.md` updated. Every provider configured in an EU region where it offers one (`STACK.md` §2). Personal data sent to an external service the feature doesn't need → BLOCKER. Collecting more than the feature needs → ISSUE.

## 4. Logs and Sentry (`RULES.md` §15, `STACK.md` §8)

No passwords, tokens, auth headers or personal data in log lines or Sentry context → BLOCKER. Sentry keeps `sendDefaultPii: false`.

## 5. Rate limiting (`RULES.md` §16)

A new action or handler that sends email, uploads files or is sensitive, without `@upstash/ratelimit` → BLOCKER. Better Auth rate limiting stays in Upstash via `secondaryStorage`, never in memory.

## 6. Headers, CSP and caching (`STACK.md` §11)

- CSP or security headers weakened (`unsafe-inline`, `unsafe-eval`, removed nonce, removed HSTS) → BLOCKER.
- Static rendering reintroduced (`force-static`, `revalidate`, `generateStaticParams` for static output) contradicts the CSP ADR → BLOCKER.
- User-derived data in module scope, or a cache key/tag missing something the data depends on → BLOCKER.
- A client-side module (a browser cache, a hook's module state) lives per browser, not per server instance: the module-scope rule doesn't apply to it, but what it stores still must not outlive the user's session in shared storage.
- A change that multiplies calls from the client to an existing unauthenticated or unthrottled handler (a loop, a retry) is an ISSUE under `RULES.md` §16 even when no handler is new; the rate-limiting fix needs approval (`check-process`).

## 7. Environments and integrations (`STACK.md` §2, §13)

- Nothing points previews, E2E or staging at production data; Redis keys prefixed per environment → otherwise BLOCKER.
- Inbound webhooks verified (signature) before anything else. API keys scoped, hashed, expiring, last use tracked; same authorization as the UI — a key is never a bypass.

## Definition of done

Owns `RULES.md` §22 item 11 (personal data: inventory, export, deletion, `redact`, retention).
