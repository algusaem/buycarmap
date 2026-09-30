import { beforeEach, describe, expect, it, vi } from "vitest";

// PLAT-6 worked example (docs/specs/core-platform.md):
//   VERCEL="1"  -> PrismaNeon over the pooled DATABASE_URL
//   VERCEL unset -> PrismaPg over DATABASE_URL
// PLAT-7: the globalThis dev-reload cache is used only when NODE_ENV !== "production".

declare global {
  // Mirrors the PLAT-7 `declare global` augmentation once it exists, so this
  // test can reset the cache between cases without an unsafe cast.
  var prisma: unknown;
}

const neonCalls: Array<{ connectionString: string }> = [];
const pgCalls: Array<{ connectionString: string }> = [];
const clientCalls: Array<{ adapter: unknown }> = [];

// Named function declarations rather than arrow functions: production code
// calls each of these with `new`, which an arrow function cannot satisfy (no
// [[Construct]] slot) — and unlike a function *expression*, a declaration
// isn't rewritten to an arrow function by Biome's useArrowFunction rule.
function neonAdapterCtor(config: { connectionString: string }) {
  neonCalls.push(config);
  return { __kind: "neon" };
}

function pgAdapterCtor(config: { connectionString: string }) {
  pgCalls.push(config);
  return { __kind: "pg" };
}

function prismaClientCtor(config: { adapter: unknown }) {
  clientCalls.push(config);
  return { __kind: "client" };
}

vi.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: vi.fn().mockImplementation(neonAdapterCtor),
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn().mockImplementation(pgAdapterCtor),
}));

vi.mock("@/app/generated/prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(prismaClientCtor),
}));

const POOLED_URL = "postgresql://user:pass@ep-abc-pooler.eu-central-1.aws.neon.tech/db";

async function loadPrisma() {
  vi.resetModules();
  return import("./prisma");
}

beforeEach(() => {
  neonCalls.length = 0;
  pgCalls.length = 0;
  clientCalls.length = 0;
  globalThis.prisma = undefined;
  vi.unstubAllEnvs();
  vi.stubEnv("DATABASE_URL", POOLED_URL);
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret-at-least-32-characters-long");
});

describe("createPrismaClient adapter selection", () => {
  it("PLAT-6: VERCEL=1 builds the client with PrismaNeon over the pooled DATABASE_URL", async () => {
    vi.stubEnv("VERCEL", "1");

    await loadPrisma();

    expect(neonCalls).toEqual([{ connectionString: POOLED_URL }]);
    expect(pgCalls).toEqual([]);
  });

  it("PLAT-6: no VERCEL builds the client with PrismaPg over DATABASE_URL", async () => {
    vi.stubEnv("VERCEL", "");

    await loadPrisma();

    expect(pgCalls).toEqual([{ connectionString: POOLED_URL }]);
    expect(neonCalls).toEqual([]);
  });

  it("PLAT-6: nothing else instantiates the generated PrismaClient", async () => {
    vi.stubEnv("VERCEL", "");

    await loadPrisma();

    expect(clientCalls.length).toBe(1);
  });
});

describe("dev-reload cache", () => {
  it("PLAT-7: is populated outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");

    await loadPrisma();

    expect(globalThis.prisma).toBeDefined();
  });

  it("PLAT-7: stays undefined in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");

    await loadPrisma();

    expect(globalThis.prisma).toBeUndefined();
  });
});
