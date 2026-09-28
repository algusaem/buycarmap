## Description

<2–4 sentences of prose: what the PR does and why, for which role. Link the spec as `docs/specs/<feature>.md`. If the spec's "Out of scope" matters to a reviewer, say what the PR deliberately does not include.>

## Main changes

- **<Theme>**: <one sentence on what changed and why>.
  - `path/to/main-file.ts`
  - `path/to/other-file.ts`

## Impact

- **Routes and actions**: new or changed pages, queries, Server Actions, route handlers.
- **Database**: migrations, and which expand/contract step each one is; backfills.
- **Configuration**: new env vars (in the env schema and `.env.example`), new providers or dependencies.
- **Personal data**: new personal fields or processors, and the `docs/privacy/` updates.
- **Manual actions**: anything to do by hand before or after merging (env vars to set in Vercel, configuration in providers, QStash schedules, the later contract release of a migration).

## Tests

- <What is covered and at which level — unit, integration, E2E, accessibility. Mention the spec's worked examples when the tests use them.>

## Validation

- `pnpm check`: <result>
- `pnpm check:full` / E2E: <result locally, or "runs on the preview">
- Manual: <what was exercised by hand — responsive on mobile and desktop, keyboard use>
- Not verified: <what couldn't be verified and why, or "Nothing.">

## Decisions and open questions

- <Decision taken during the work that the reviewer should know, and why; where one needed approval, say it was approved.>
- <Question still open, or "None.">

## Checklist

- [ ] Tests written first, from the spec
- [ ] Unauthorized users rejected in tests (actions, route handlers, filtered queries)
- [ ] Docs updated (`docs/`), ADR for architectural decisions
- [ ] Migrations backward-compatible (expand/contract), seeds updated
- [ ] Personal data: inventory, export, deletion and Pino `redact` updated, retention defined
- [ ] New env vars in the env schema and `.env.example`
