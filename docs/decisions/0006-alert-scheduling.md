# 0006 — Scheduling the alert runner

## Decided

A GitHub Actions cron (`.github/workflows/alerts.yml`) on `*/5 * * * *`, running
a matrix of parallel jobs that each POST to `app/api/alerts/run/route.ts` with a
shared secret. The queue itself lives in Postgres (`AlertPollJob`), claimed with
`SELECT … FOR UPDATE SKIP LOCKED`.

## This does not contradict 0005

[0005](0005-postgres-rate-limiting.md) says, under "Rows accumulate", that there
is no scheduler and no cron should be added. That is scoped to **pruning
expired rate-limit rows** — work that is cheap, can be arbitrarily late, and is
therefore better done opportunistically on incoming requests, the way
`lib/auth/cleanup.ts` prunes tokens.

Alerts are neither cheap nor late-tolerant, and that is the whole difference.
0005's line has been amended to say what it governs.

## What it beat

**An in-process `setInterval`.** Fails for exactly the reason 0005 rejected an
in-memory rate limiter: Vercel gives no long-lived process, each request may
land on a different and possibly cold instance, and several instances each
running their own timer would send the same alert two or three times. Duplicate
mail to users is a worse failure than late mail.

**Opportunistic work on user traffic.** Free, no new infrastructure, and the
pattern this codebase already uses twice. Wrong here: it fires only when someone
visits, it makes an unlucky visitor's request wait on N criteria × 3 upstream
APIs, and an app with no overnight traffic sends no overnight alerts. Cleanup
tolerates all three; a feature whose entire value is speed does not.

**Vercel Cron.** Native to the deploy target and the obvious first choice, but
the Hobby plan caps cron at **once per day** — a sub-daily expression fails the
deployment outright rather than degrading. Daily is useless here: a well-priced
car is gone within hours, so a next-morning digest is mostly a list of cars
already sold. Reaching five-minute cadence means a paid plan.

**pg_cron in Neon.** Available on all plans now, and appealingly self-contained.
Two problems: jobs run only while the compute is active and Neon recommends
disabling scale-to-zero to use it, which is the cost we were avoiding; and
pg_cron runs SQL, while this job must make HTTP calls to three
reverse-engineered APIs and normalise their JSON.

**Moving off Vercel to a VPS.** The honest answer to "why not do it ourselves",
and it works — a real process, `node-cron`, full control. It is a hosting
migration driven by one feature, and it trades a YAML file for owning uptime,
deploys and TLS.

## Why GitHub Actions specifically

Actions minutes are unlimited on public repositories, so five-minute polling is
free at any alert count — the workflow makes **one HTTP request per job**
regardless of how many alerts exist, because the fan-out happens inside our
handler. On a private repository the free tier's 2,000 Linux minutes/month
covers hourly but not five-minute polling.

Five minutes is also GitHub's floor; nothing shorter is expressible.

There is precedent: `.github/workflows/test.yml` already runs the nightly
`contract-live` job on a cron.

## What this costs

**Scheduled runs drift under load**, sometimes by several minutes. The cadence
is approximate and the ten-minute freshness target is a design goal measured by
the run's `oldestPendingAgeMs`, not a guarantee. The UI copy says "every few
minutes" rather than promising five.

**Scheduled workflows are disabled after 60 days of repository inactivity.**

**The trigger lives outside the app** and calls a public endpoint, so that
endpoint needs its own shared secret (`ALERTS_CRON_SECRET`) and a constant-time
comparison.

## Why this is the least committing part of the design

The workflow is a file that runs `curl`. Moving to Vercel Cron, a VPS crontab or
anything else means deleting it and pointing something else at the same URL —
the route handler and everything behind it does not change. Treating the
scheduler choice as reversible is what makes it safe to start here.

## What would change our mind

- **The repository going private**, which makes five-minute polling cost money.
- **Drift becoming user-visible**, which would argue for a paid scheduler with
  tighter guarantees.
- **The runner outgrowing one invocation's timeout** even with the queue, which
  would mean real workers rather than an HTTP-triggered drain.

## See also

- [`specs/alerts.md`](../specs/alerts.md) — the criteria this serves
- [ARCHITECTURE.md › Alerts](../ARCHITECTURE.md#alerts)
- [0005](0005-postgres-rate-limiting.md) — the Postgres-over-a-service reasoning
  this reuses
