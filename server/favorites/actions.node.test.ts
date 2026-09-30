import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFavoriteStore, makeFavoriteInput } from "@/test/fixtures/favorites";

// TEST-7 (docs/specs/core-testing.md): every other case in this file moved to
// ./actions.integration.test.ts, which runs against a real database. A Prisma
// mock survives only here, where the point is PLAT-12 — a database failure
// rejecting instead of returning an error Result — which needs a call that
// can be made to fail on demand.

let store: ReturnType<typeof createFavoriteStore>;

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    favorite: {
      create: (args: never) => store.client.create(args),
      upsert: (args: never) => store.client.upsert(args),
      deleteMany: (args: never) => store.client.deleteMany(args),
      findMany: (args: never) => store.client.findMany(args),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { listFavorites, removeFavorite, saveFavorite } from "./actions";

const ADA = { id: "user-ada", email: "ada@example.com" };

function signedInAs(user: { id: string; email: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

beforeEach(() => {
  store = createFavoriteStore();
  vi.mocked(getCurrentUser).mockReset();
});

describe("saveFavorite", () => {
  it("PLAT-12: a database failure rejects instead of returning an error Result", async () => {
    signedInAs(ADA);
    vi.mocked(store.client.upsert).mockRejectedValueOnce(new Error("connection refused"));

    await expect(saveFavorite(makeFavoriteInput())).rejects.toThrow();
  });
});

describe("removeFavorite", () => {
  it("PLAT-12: a database failure rejects instead of returning an error Result", async () => {
    signedInAs(ADA);
    vi.mocked(store.client.deleteMany).mockRejectedValueOnce(new Error("connection refused"));

    await expect(removeFavorite("wallapop-abc123")).rejects.toThrow();
  });
});

describe("listFavorites", () => {
  it("PLAT-12: a database failure rejects instead of returning an error Result", async () => {
    signedInAs(ADA);
    vi.mocked(store.client.findMany).mockRejectedValueOnce(new Error("connection refused"));

    await expect(listFavorites()).rejects.toThrow();
  });
});
