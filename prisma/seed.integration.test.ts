import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/auth/hash";
import { prisma } from "@/lib/db/prisma";
import { ensureTwoFactorUser, seed, SEED_PASSWORD } from "./seed";

// TEST-11 (docs/specs/core-testing.md), run by the `integration` project
// against a real per-worker database (docs/decisions/0014-local-database-and-integration-tests.md).

describe("seed", () => {
  it("TEST-11: fills an empty database with 3 users, 10 favorites and 3 alerts, each alert with at least one match", async () => {
    await seed(prisma);

    const users = await prisma.user.findMany();
    const favorites = await prisma.favorite.findMany();
    const alerts = await prisma.alert.findMany({ include: { matches: true } });

    expect(users).toHaveLength(3);
    expect(favorites).toHaveLength(10);
    expect(alerts).toHaveLength(3);
    for (const alert of alerts) {
      expect(alert.matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("TEST-11: exactly one user has two-factor enabled, with its secret printed by the seed", async () => {
    await seed(prisma);

    const withTwoFactor = await prisma.user.findMany({
      where: { twoFactorEnabledAt: { not: null } },
    });

    expect(withTwoFactor).toHaveLength(1);
    expect(withTwoFactor[0].twoFactorSecret).not.toBeNull();
  });

  it("TEST-11: every seeded user's password verifies against SEED_PASSWORD", async () => {
    await seed(prisma);

    const users = await prisma.user.findMany();
    expect(users).not.toHaveLength(0);
    for (const user of users) {
      if (!user.password) throw new Error(`expected ${user.email} to have a password set`);
      expect(await verifyPassword(SEED_PASSWORD, user.password)).toBe(true);
    }
  });

  it("TEST-11: rerunning on an already-seeded database leaves every count unchanged", async () => {
    await seed(prisma);
    const before = {
      users: await prisma.user.count(),
      favorites: await prisma.favorite.count(),
      alerts: await prisma.alert.count(),
      matches: await prisma.alertMatch.count(),
    };

    await seed(prisma);

    expect({
      users: await prisma.user.count(),
      favorites: await prisma.favorite.count(),
      alerts: await prisma.alert.count(),
      matches: await prisma.alertMatch.count(),
    }).toEqual(before);
  });

  it("TEST-11: leaves users it did not create alone on a non-empty database", async () => {
    const stranger = await prisma.user.create({ data: { email: "not-seeded@example.test" } });

    await seed(prisma);

    const found = await prisma.user.findUnique({ where: { id: stranger.id } });
    expect(found).not.toBeNull();
  });

  it("TEST-11: two runs on fresh databases produce the same user emails (determinism)", async () => {
    await seed(prisma);
    const firstRunEmails = (await prisma.user.findMany()).map((user) => user.email).sort();

    // The seed identifies its own rows by fixed emails (edge case in the
    // spec), so clearing and reseeding stands in for a second fresh database.
    await prisma.user.deleteMany();
    await seed(prisma);
    const secondRunEmails = (await prisma.user.findMany()).map((user) => user.email).sort();

    expect(secondRunEmails).toEqual(firstRunEmails);
  });
});

describe("ensureTwoFactorUser", () => {
  it("TEST-11: with no configured encryption key, still enrols the user and logs that the secret will not survive the process", async () => {
    const user = await prisma.user.create({ data: { email: "no-key@example.test" } });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await ensureTwoFactorUser(prisma, user, undefined);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.twoFactorEnabledAt).not.toBeNull();
    expect(updated?.twoFactorSecret).not.toBeNull();
    expect(log.mock.calls.flat().join("\n")).toContain("TWO_FACTOR_ENCRYPTION_KEY is not set");

    log.mockRestore();
  });

  it("TEST-11: a user already enrolled is left alone and logged as already enabled", async () => {
    const user = await prisma.user.create({ data: { email: "already-2fa@example.test" } });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await ensureTwoFactorUser(prisma, user, undefined);
    log.mockClear();
    const afterFirst = await prisma.user.findUnique({ where: { id: user.id } });

    await ensureTwoFactorUser(prisma, user, undefined);
    const afterSecond = await prisma.user.findUnique({ where: { id: user.id } });

    expect(afterSecond?.twoFactorSecret).toBe(afterFirst?.twoFactorSecret);
    expect(log.mock.calls.flat().join("\n")).toContain("two-factor already enabled");

    log.mockRestore();
  });
});
