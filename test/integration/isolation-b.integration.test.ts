import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";

// TEST-6 (docs/specs/core-testing.md), worked examples — see
// isolation-a.integration.test.ts for the full explanation. This file exists
// so the "two files at once" half of the second worked example is a real
// pair of files, not a single one asserting on itself. This file is not
// matched by any Vitest project today — the `integration` project, its
// global setup and its per-file setup do not exist yet. See the report.

describe("integration test isolation (file B)", () => {
  it("TEST-6: this file starts with no favorites left over from file A", async () => {
    const favorites = await prisma.favorite.findMany();
    expect(favorites).toEqual([]);
  });

  it("TEST-6: creating the same fixed-email user as file A does not collide", async () => {
    await expect(
      prisma.user.create({ data: { email: "ana@example.test" } }),
    ).resolves.toMatchObject({ email: "ana@example.test" });
  });
});
