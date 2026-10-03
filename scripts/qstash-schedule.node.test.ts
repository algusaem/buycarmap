import { describe, expect, it, vi } from "vitest";
import { main } from "./qstash-schedule.mjs";

// docs/specs/core-integrations.md, INT-8. scripts/qstash-schedule.mjs's
// `main` is a stub (returns 0 without touching `env` or `client`), so every
// case below fails as an assertion rather than on import.

interface FakeSchedule {
  scheduleId: string;
  destination: string;
  cron: string;
}

function makeFakeClient(initial: FakeSchedule[] = []) {
  const schedules: FakeSchedule[] = [...initial];
  let nextId = initial.length + 1;

  return {
    schedules: {
      list: vi.fn(async () => [...schedules]),
      create: vi.fn(
        async (opts: { destination: string; cron: string; retries: number; method: string }) => {
          const created = { scheduleId: `sched_${nextId++}`, ...opts };
          schedules.push(created);
          return { scheduleId: created.scheduleId };
        },
      ),
      delete: vi.fn(async (scheduleId: string) => {
        const index = schedules.findIndex((schedule) => schedule.scheduleId === scheduleId);
        if (index >= 0) schedules.splice(index, 1);
      }),
    },
  };
}

const ENV = { QSTASH_TOKEN: "t", APP_URL: "https://buycarmap.vercel.app" };

describe("main", () => {
  it("INT-8: creates the five-minute schedule with 3 retries on the first run", async () => {
    const client = makeFakeClient();

    const code = await main({ env: ENV, client });

    expect(code).toBe(0);
    expect(client.schedules.create).toHaveBeenCalledTimes(1);
    expect(client.schedules.create).toHaveBeenCalledWith({
      destination: "https://buycarmap.vercel.app/api/alerts/run",
      cron: "*/5 * * * *",
      retries: 3,
      method: "POST",
    });
  });

  it("INT-8: a second run with the schedule already listed creates no duplicate", async () => {
    const client = makeFakeClient([
      {
        scheduleId: "sched_1",
        destination: "https://buycarmap.vercel.app/api/alerts/run",
        cron: "*/5 * * * *",
      },
    ]);

    await main({ env: ENV, client });

    expect(client.schedules.create).not.toHaveBeenCalled();
    expect(await client.schedules.list()).toHaveLength(1);
  });

  it("INT-8: exits 1 with a message when QSTASH_TOKEN is missing", async () => {
    const client = makeFakeClient();
    const errors: string[] = [];

    const code = await main({
      env: { APP_URL: ENV.APP_URL },
      client,
      error: (message: string) => errors.push(message),
    });

    expect(code).toBe(1);
    expect(errors.join("\n")).toContain("QSTASH_TOKEN is required");
  });
});
