# BuyCarMap

Second-hand car listings from several Spanish marketplaces, merged into one
search and plotted on a map. Filter by location, price, make, model, year,
mileage, horsepower, fuel, transmission and recency; browse the results as a card
list and a map that stay in sync.

Live sources are **Wallapop**, **coches.net** and **Milanuncios** — none of them
offer a public API, so each is reached through a proxy route and normalised into
one shared listing shape. If a source is down, the others still render.

![The map view: listings from three sources beside a map of Spain](docs/images/map.png)

## Quickstart

```bash
pnpm install
cp .env.example .env      # fill in DATABASE_URL and NEXTAUTH_SECRET
pnpm exec prisma generate
pnpm dev
```

The product is at `http://localhost:3000/map`.

Only those two environment variables are required; everything else disables a
feature rather than blocking the app. Working in a git worktree needs one extra
step — see [Getting started](docs/getting-started.md), which also covers why
`prisma generate` is separate and what to do when a command refuses to run.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL on Neon via Prisma 7
· NextAuth 4 · Tailwind CSS 4 with Radix primitives · Leaflet · Vitest ·
Playwright.

## Documentation

| | |
| --- | --- |
| [Getting started](docs/getting-started.md) | Setup, env vars, worktrees, commands, troubleshooting |
| [Docs index](docs/README.md) | Everything else, plus which doc governs which part of the code |
| [Specs](docs/specs/README.md) | What the software does and why — the enforced source of truth for behaviour |
| [CLAUDE.md](CLAUDE.md) | House conventions, written as rules for an AI agent |

The project is developed spec-first: a feature starts as a spec with numbered
acceptance criteria, each criterion becomes a failing test before any
implementation, and CI fails if a criterion loses its test.
