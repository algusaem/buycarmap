---
description: Review working changes against STACK-ERP.md — multi-tenancy, legal entities and abilities, auth hardening, tenant caching, money and tax, fiscal documents, international data, ERP tests. Only for CRM/ERP projects.
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*)
---

Review the working changes against the **CRM/ERP rules**. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Applies only when the project is CRM/ERP in `STACK-ERP.md`'s sense** — tenants, legal entities, money or fiscal documents: `STACK-ERP.md` is in the project, or `CLAUDE.md` says the project follows it. A product or module called "CRM" is not enough. Otherwise report "Not applicable — not a CRM/ERP project" and stop.
**Owns:** `STACK-ERP.md` §2–§11, except its dependencies (§1 → `check-stack`) and golden files updated to make a test pass (→ `check-tests`' tampering). Cite the section in every finding. The base rules these extend stay with their owners: the base auth chain and caching with `check-security`, the base data model with `check-data`.

## 1. Structure, types and data model (§2, §3)

`tenantId` joins the standard columns; compound indexes start with `tenantId`; fiscal documents are never soft-deleted; log context also carries tenant and legal entity. Adapters and shared code live in their `platform` package (`packages/core`, `packages/fiscal`, `packages/testing`), never copy-pasted into a repo.

## 2. Multi-tenancy (§4)

Tenant scoping through the Prisma extension — a query bypassing it, or a manual `tenantId` filter standing in for it → BLOCKER. Tenant resolved from the session, never the URL, params or body. A new tenant-owned table has `tenantId` and compound indexes starting with it.

## 3. Authorization and auth (§5)

- The ERP steps of the chain are present: `authenticate → tenant → legal entity → ability → authorize → validate → service` — report the missing tenant, legal-entity or ability step (a missing base step is `check-security`'s).
- CASL abilities only in `permissions.ts`; list filters built from the same ability (`accessibleBy`).
- TOTP MFA available, required for admin roles; recovery codes single-use and never stored in plain text; absolute session 30 days and idle 12 hours, tenant-configurable; failed-login throttling per account and per IP.

## 4. Caching (§6)

Every cache tag tenant-prefixed through the helper; nothing tenant-derived in module scope; only tenant-independent reference data cached globally.

## 5. Money and tax (§7)

Amounts as integer minor units / `Decimal`, never `number`; minor-unit exponent from ISO 4217, never a hardcoded two decimals; every amount carries its currency; arithmetic only in `lib/money.ts`; tax from the rules function, never a typed-in field; VAT numbers validated against VIES with the response stored.

## 6. Fiscal (§8)

Issued documents never updated or soft-deleted — corrections are new chained records; numbering from the transactional counter per series per legal entity, never `count() + 1`; chain written in the same transaction, submission async via QStash; signing certificates encrypted at rest per legal entity, with expiry alerts; fiscal adapters in `packages/fiscal`; fiscal PDFs/XML stored in R2, never Cloudinary; no certificates or full fiscal bodies in logs.

## 7. International data (§9)

Country-aware addresses (no required `piso` / `provincia`); tax ids as `{country, type, value}`; phones E.164; one `name` field; GDPR erasure anonymizes contacts and preserves fiscal records, never a raw `DELETE`.

## 8. UI and integrations (§10)

Optimistic updates never on anything fiscal → BLOCKER. Public API keys scoped per legal entity and checked through the same CASL abilities.

## 9. ERP tests (§11)

Money, tax, numbering/chaining and tenant isolation changes come with the four non-negotiables that apply (isolation tests including the two-tenant Playwright run, authorization matrix with tenant and legal-entity conditions, golden files in `packages/fiscal/__fixtures__/<jurisdiction>/`, property tests); fixtures include a non-EUR currency, a non-Spanish address and a reverse-charge invoice; MSW handlers for tax authorities, VIES, Peppol providers and rate feeds; factories from `packages/testing`, never redefined per repo.

## Definition of done

Owns no `RULES.md` §22 item; its BLOCKERs make the `/check-all` verdict NOT READY like any other.
