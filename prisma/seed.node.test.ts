import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { assertLocalDatabase, assertSeedTarget, main } from "./seed";

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

// ENV-4 worked examples (docs/specs/core-environments.md): amends TEST-12 so
// the shared `preview` Neon branch can be seeded deliberately, by naming its
// exact host in SEED_TARGET_HOST.
//   localhost, no SEED_TARGET_HOST                       -> allowed
//   127.0.0.1, no SEED_TARGET_HOST                       -> allowed
//   a Neon host, no SEED_TARGET_HOST                     -> refused, naming the host
//   the same Neon host, SEED_TARGET_HOST = that host      -> allowed
//   the same Neon host, SEED_TARGET_HOST = a different host -> refused
describe("ENV-4: assertSeedTarget", () => {
  const NEON_URL = "postgresql://u:p@ep-quiet-sea-a1b2c3.eu-central-1.aws.neon.tech/neondb";
  const NEON_HOST = "ep-quiet-sea-a1b2c3.eu-central-1.aws.neon.tech";

  it("ENV-4: allows a localhost URL with no SEED_TARGET_HOST set", () => {
    expect(() => assertSeedTarget("postgresql://u:p@localhost:5433/db", undefined)).not.toThrow();
  });

  it("ENV-4: allows a 127.0.0.1 URL with no SEED_TARGET_HOST set", () => {
    expect(() => assertSeedTarget("postgresql://u:p@127.0.0.1:5432/db", undefined)).not.toThrow();
  });

  it("ENV-4: refuses a Neon host with no SEED_TARGET_HOST set, naming the host", () => {
    expect(() => assertSeedTarget(NEON_URL, undefined)).toThrow(
      new RegExp(NEON_HOST.replace(/\./g, "\\.")),
    );
  });

  it("ENV-4: allows the same Neon host when SEED_TARGET_HOST names it exactly", () => {
    expect(() => assertSeedTarget(NEON_URL, NEON_HOST)).not.toThrow();
  });

  it("ENV-4: refuses the Neon host when SEED_TARGET_HOST names a different host", () => {
    expect(() => assertSeedTarget(NEON_URL, "ep-other.eu-central-1.aws.neon.tech")).toThrow(
      /ep-quiet-sea-a1b2c3\.eu-central-1\.aws\.neon\.tech/,
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
