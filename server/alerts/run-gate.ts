import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { redisKey, sharedKeyValueStore } from "@/lib/platform/rate-limit";

// The alert runner's "nothing due" gate (docs/specs/alerts.md, ALERT-51 to
// ALERT-55; Decisions › A Redis "nothing due" gate in front of the database).
//
// One Redis key holds the earliest moment, in epoch milliseconds, a run can
// have work. A run before that moment never touches Postgres, so the Neon
// compute can suspend between runs. The key holds a timestamp and nothing
// else — no personal data, no job state; the queue stays in Postgres.
//
// Redis failing never stops alerts: every failure here is logged, reported to
// Sentry and answered as if the gate were off.

const NEXT_DUE_KEY = "alerts:next-due-at";
/** The furthest ahead the key is ever set (ALERT-52). */
const GATE_CEILING_MS = 6 * 60 * 60_000;

export interface RunGate {
  /** The stored moment is later than the run's clock (ALERT-51). */
  nothingDue: boolean;
  /**
   * What the run read, compared again before writing (ALERT-54). Absent when
   * the gate is off or its read failed, so the run writes nothing.
   */
  observed?: number | null;
}

export interface NextDueInput {
  now: number;
  intervalMs: number;
  leaseTimeoutMs: number;
  /** A match of an active alert is still un-notified after the run. */
  undelivered: boolean;
  /** Every actively subscribed criteria set. */
  criteria: { id: string; lastPolledAt: Date | null }[];
  /** Every poll job, whatever its status. */
  jobs: {
    criteriaId: string;
    status: "pending" | "running" | "failed";
    availableAt: Date;
    lockedAt: Date | null;
  }[];
}

function jobDueAt(job: NextDueInput["jobs"][number], input: NextDueInput): number {
  // ALERT-19: a failed job is never claimed, reclaimed or re-enqueued again.
  if (job.status === "failed") return Number.POSITIVE_INFINITY;
  if (job.status === "pending") return job.availableAt.getTime();
  // ALERT-48: a lease is reclaimed only once strictly older than the timeout.
  if (!job.lockedAt) return input.now;
  return job.lockedAt.getTime() + input.leaseTimeoutMs + 1;
}

/**
 * The earliest moment a run can have work (ALERT-52), never later than the
 * ceiling. A criteria set with a job is the job's business: the enqueue
 * leaves an existing job as it is, so its `lastPolledAt` brings nothing
 * forward.
 */
export function nextDueAt(input: NextDueInput): number {
  if (input.undelivered) return input.now;

  const withJob = new Set(input.jobs.map((job) => job.criteriaId));
  const criteriaMoments = input.criteria
    .filter((criteria) => !withJob.has(criteria.id))
    .map((criteria) =>
      criteria.lastPolledAt ? criteria.lastPolledAt.getTime() + input.intervalMs : input.now,
    );
  const jobMoments = input.jobs.map((job) => jobDueAt(job, input));

  return [...criteriaMoments, ...jobMoments].reduce(
    (earliest, moment) => Math.min(earliest, moment),
    input.now + GATE_CEILING_MS,
  );
}

/** Upstash answers a number for a number it stored; anything else is no moment. */
function parseMoment(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function reportGateFailure(error: unknown, operation: "read" | "write" | "mark"): void {
  logger.error({ err: error, operation }, "alert run gate unavailable");
  Sentry.captureException(error);
}

/** Reads the key at the start of a run (ALERT-51, ALERT-55). */
export async function openRunGate(now: Date): Promise<RunGate> {
  const store = sharedKeyValueStore();
  if (!store) return { nothingDue: false };

  try {
    const observed = parseMoment(await store.get(redisKey(NEXT_DUE_KEY)));
    return { nothingDue: observed !== null && now.getTime() < observed, observed };
  } catch (error) {
    reportGateFailure(error, "read");
    return { nothingDue: false };
  }
}

/**
 * Stores the next moment at the end of a run, expiring at that moment
 * (ALERT-52) — unless the key changed since the run read it, which means a
 * write landed during the run and the run's reading of the database is older
 * than it (ALERT-54).
 */
export async function closeRunGate(gate: RunGate, now: Date, nextDue: number): Promise<void> {
  if (gate.observed === undefined || nextDue <= now.getTime()) return;
  const store = sharedKeyValueStore();
  if (!store) return;

  try {
    const key = redisKey(NEXT_DUE_KEY);
    const current = parseMoment(await store.get(key));
    if (current !== gate.observed) return;
    await store.set(key, nextDue, { pxat: nextDue });
  } catch (error) {
    reportGateFailure(error, "write");
  }
}

/**
 * Sets the key to the moment of a write that can bring work forward, so the
 * next run queries the database (ALERT-53). Set rather than deleted, so a run
 * in progress sees the change (ALERT-54). Never throws: the write it follows
 * has already succeeded (ALERT-55).
 */
export async function markAlertsChanged(): Promise<void> {
  const store = sharedKeyValueStore();
  if (!store) return;

  const changedAt = Date.now();
  try {
    await store.set(redisKey(NEXT_DUE_KEY), changedAt, { pxat: changedAt + GATE_CEILING_MS });
  } catch (error) {
    reportGateFailure(error, "mark");
  }
}
