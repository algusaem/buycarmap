import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createFavorite } from "@/test/factories/favorite";
import { createUser } from "@/test/factories/user";

// TEST-6 (docs/specs/core-testing.md), worked examples:
//   - Test A creates a favorite, then test B in the same file lists
//     favorites -> B sees none (truncated before each test).
//   - Two files running at the same time each create a user with the email
//     `ana@example.test` -> neither fails on the unique constraint (each
//     Vitest worker owns its own database, copied from the migrated
//     template).
//
// Paired with isolation-b.integration.test.ts, which Vitest may run
// concurrently with this file. This file is not matched by any Vitest
// project today — the `integration` project, its global setup and its
// per-file setup do not exist yet. See the report.

describe("integration test isolation (file A)", () => {
  it("TEST-6: the first test creates a favorite", async () => {
    const user = await createUser();
    await createFavorite({ user: { connect: { id: user.id } } });

    const favorites = await prisma.favorite.findMany();
    expect(favorites).toHaveLength(1);
  });

  it("TEST-6: the next test in this file sees zero favorites", async () => {
    // If the row created above survived, every test after it would inherit
    // whatever the previous one left behind, and failures would depend on
    // run order instead of on what each test itself does.
    const favorites = await prisma.favorite.findMany();
    expect(favorites).toEqual([]);
  });

  it("TEST-6: creating a fixed-email user here does not collide with file B's", async () => {
    await expect(
      prisma.user.create({ data: { email: "ana@example.test" } }),
    ).resolves.toMatchObject({ email: "ana@example.test" });
  });
});
