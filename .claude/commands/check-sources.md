---
description: Review working changes against the upstream-source invariants — no marketplace call from the browser, Wallapop coordinates always sent, one shared filter set, the merge post-filter and its fetch-until-non-empty loops
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Agent
---

Review the working changes against the **upstream sources** — the project check for the three marketplaces BuyCarMap aggregates (Wallapop, coches.net, Milanuncios). Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

Every rule here fails silently: the app keeps working and quietly shows the wrong cars. Read the governing contract doc (`docs/integrations/<source>.md`) and the specs `docs/specs/data-sources.md` and `docs/specs/map-and-search.md` before judging.

**Owns:** `CLAUDE.md` › Upstream sources. Logic defects in these files that break no rule below stay with `check-correctness`; the proxy routes' input validation and secrets with `check-security`.
**Applies to:** any client code that could reach an upstream (`"use client"` files, `components/**`, `lib/hooks/**`); any server code that could call one (`app/api/**`, `app/actions/**`, server components under `app/**`, `lib/alerts/**`); every source's `app/api/<source>/**` and `lib/<source>/**`, new sources included; `lib/geo/**`; `lib/validations/search.ts` (where `SearchInput` is defined), `lib/validations/alerts.ts` (which rebuilds it), `interfaces/wallapop.ts`, `interfaces/cochesnet.ts`, `interfaces/milanuncios.ts` (the upstream shapes), `interfaces/alert.ts`, `interfaces/listing.ts` (the normalized listing and its pin), `.github/workflows/alerts.yml` and the `contract-live` job in `.github/workflows/test.yml` (the scheduled callers of the real upstreams), `next.config.ts` (its CSP `connect-src` and `images.remotePatterns`, the browser's allowed hosts), `prisma/schema.prisma`, `lib/hooks/useListingsSearch.ts` and any other hook or component that builds a `SearchInput`, `components/map/**`, `test/contract/**`, `test/fixtures/**` and `e2e/fixtures/network.ts` for the sources.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
Run on its own, the main session does not review the upstream-source rules itself, however capable it is of doing so:
- **The whole review → one `Agent` with `subagent_type: "lacayo-opus"`**, told it is the delegated agent and spawns no agents, and briefed with this file, `.claude/review-protocol.md`, the change set, the task in the user's words and the approvals the user gave, quoted; it returns the output of review protocol §7.
- **The mastermind** re-measures with its own eyes only the facts it will state (a quoted `file:line`, the changed files: single read-only commands), and writes the report; which findings get fixed is the user's decision when the check runs on its own (review protocol §6). The fixes the user asks for are dictated edits: direct for two or three steps in one file, `lacayo-sonnet` for anything longer.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## 1. Where upstream calls happen

- Any request to a marketplace host (`wallapop.com`, `coches.net`, `milanuncios.com`, or their API subdomains) from client code — a component, a hook, a file with `"use client"` — → BLOCKER. Upstreams are only called from `app/api/<source>/` route handlers and from server code the alert runner uses.
- Server code (the alert runner, a route handler) calling a function that resolves URLs against `window.location.origin` — `searchWallapop`, `searchCochesNet`, `searchMilanuncios`, or anything in `lib/wallapop/filters.ts` and `lib/cochesnet/models.ts` — → BLOCKER: it throws outside the browser. Importing the pure query builders from `lib/<source>/client.ts` is fine; `lib/alerts/search.ts` does exactly that.
- Server code other than the `app/api/<source>/` proxies and `lib/alerts/search.ts` — a Server Action, a server component, another route handler — calling a marketplace host directly → ISSUE: it skips the proxies' headers and error handling. Add it to a proxy or to the alert runner's search instead.

## 2. Wallapop coordinates

- A Wallapop search built without `latitude` / `longitude` — including the "no location chosen" path — → BLOCKER. Without them Wallapop geo-filters by the server's IP and a Spanish user gets US listings from Vercel. Trace every path that builds the request, including defaults and the alert runner.

## 3. One shared filter set

- A filter added to one source's UI or request builder without going through the shared `SearchInput` → BLOCKER. Each client translates the shared input; the UI never gets per-source filters.
- A new field in `SearchInput` that one source's translator ignores without saying so → ISSUE: the source then returns results the filter should have excluded. The merge post-filter (§4) or a comment explaining why the upstream enforces it must cover it.

## 4. The merge post-filter and its loops

- `applyResultFilters` in `lib/hooks/useListingsSearch.ts` removed, bypassed, or narrowed so it no longer filters by radius and model → BLOCKER (MAP-16..18). Only Wallapop enforces the radius; Milanuncios matches the model as free text.
- The first search or `loadMore` collapsed to a single fetch per round, so a page the filter empties ends the search → BLOCKER (MAP-19).
- A fetch-until-non-empty loop with a round in which a source's cursor or page number doesn't advance and its has-more flag isn't cleared → BLOCKER: the loop then fetches the same page forever. The loops are deliberately not capped at N rounds (MAP-19 in `docs/specs/map-and-search.md`: a cap is the same dead end further away) — a cap is a spec change, not a fix.

## 5. Coordinates and pins

- coches.net or Milanuncios pins, or Wallapop pins placed by the SRC-3 fallback, presented as exact positions (precise-pin UI, distance to the metre, clustering that assumes exactness) → BLOCKER. Their items carry no coordinates; pins are city- or province-level approximations.
- A change that makes marker rendering or listing detail cost performance — more markers drawn with no clustering or limit, detail loaded eagerly for every result — without clustering, limiting or lazy-loading → BLOCKER (`CLAUDE.md` › Upstream sources). Today's unclustered map is pre-existing.

## 6. Scraping etiquette

- A new upstream endpoint, request pattern or scheduled cadence (`.github/workflows/alerts.yml`, the `contract-live` job), or a marketplace host added to the browser's CSP `connect-src`, that ignores robots.txt or the source's rate limits → BLOCKER.
- A change that multiplies requests per user action beyond what the sources' own pagination bounds → ISSUE. (The MAP-19 loops are bounded by the sources' page counts; that is by design.)
- Cross-source deduplication is out of scope (`docs/specs/data-sources.md`): a change that adds it without its own spec → BLOCKER (`RULES.md` §4); a merge that doesn't deduplicate is correct today.
- A listing store (the `Car` persistence, not built yet — not the `Favorite` / `AlertMatch` display snapshots) that doesn't keep the raw upstream payload apart from the normalized record, or doesn't track when each listing was last seen and whether it is still available → BLOCKER.
- A new upstream response shape consumed without a contract test in `test/contract/` → ISSUE (the nightly live contract job is the alarm when a source changes shape).

## Definition of done

Owns no `RULES.md` §22 item; its BLOCKERs make the `/check-all` verdict NOT READY like any other.
