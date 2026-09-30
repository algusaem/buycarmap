import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { assertLocalDatabase, main } from "./seed";

// Never dereferenced: `seedFn` is faked in every `main` test below, so this
// only stands in for the identity `loadPrisma` would resolve to.
const FAKE_PRISMA = {} as PrismaClient;

// TEST-12 (docs/specs/core-testing.md), worked examples:
//   - DATABASE_URL host `localhost` -> seeds.
//   - DATABASE_URL host `ep-…-pooler….neon.tech` -> exits 1 with a message
//     containing `ep-…-pooler….neon.tech`, and writes nothing.
// assertLocalDatabase is the guard that decision is built on: it must throw,
// naming the host, for anything but localhost/127.0.0.1 — currently it always
// throws "not implemented", so every case here fails until it exists.

describe("assertLocalDatabase", () => {
  it("TEST-12: allows a localhost URL", () => {
    expect(() =>
      assertLocalDatabase("postgresql://postgres:postgres@localhost:5433/buycarmap_dev"),
    ).not.toThrow();
  });

  it("TEST-12: allows a 127.0.0.1 URL", () => {
    expect(() =>
      assertLocalDatabase("postgresql://postgres:postgres@127.0.0.1:5433/buycarmap_dev"),
    ).not.toThrow();
  });

  it("TEST-12: refuses the Neon pooler host, naming it in the message", () => {
    const url = "postgresql://u:p@ep-dawn-recipe-pooler.c-2.eu-central-1.aws.neon.tech/neondb";

    expect(() => assertLocalDatabase(url)).toThrow(
      /ep-dawn-recipe-pooler\.c-2\.eu-central-1\.aws\.neon\.tech/,
    );
  });
});

// TEST-12: `main`, with `env`/`loadPrisma`/`seedFn` injected so the guard and
// the happy path can both be driven without ever loading `@/lib/db/prisma`
// (and so without `lib/env.ts`'s required variables) or touching a database.
describe("main", () => {
  it("TEST-12: refuses a non-local DATABASE_URL and never loads the Prisma client", async () => {
    const loadPrisma = vi.fn().mockResolvedValue(FAKE_PRISMA);
    const seedFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      main({
        env: { DATABASE_URL: "postgresql://u:p@ep-dawn-recipe.c-2.eu-central-1.aws.neon.tech/db" },
        loadPrisma,
        seedFn,
      }),
    ).rejects.toThrow(/ep-dawn-recipe\.c-2\.eu-central-1\.aws\.neon\.tech/);

    expect(loadPrisma).not.toHaveBeenCalled();
    expect(seedFn).not.toHaveBeenCalled();
  });

  it("TEST-11: loads the Prisma client and seeds it for a local DATABASE_URL", async () => {
    const loadPrisma = vi.fn().mockResolvedValue(FAKE_PRISMA);
    const seedFn = vi.fn().mockResolvedValue(undefined);

    await main({
      env: { DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/buycarmap_dev" },
      loadPrisma,
      seedFn,
    });

    expect(loadPrisma).toHaveBeenCalledTimes(1);
    expect(seedFn).toHaveBeenCalledWith(FAKE_PRISMA);
  });

  it("refuses when DATABASE_URL is unset, the same as an empty string", async () => {
    const loadPrisma = vi.fn().mockResolvedValue(FAKE_PRISMA);
    const seedFn = vi.fn().mockResolvedValue(undefined);

    await expect(main({ env: {}, loadPrisma, seedFn })).rejects.toThrow();
    expect(loadPrisma).not.toHaveBeenCalled();
  });
});
