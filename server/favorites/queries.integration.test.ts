import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { makeFavoriteInput, toSnapshot } from "@/test/fixtures/favorite-listings";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { removeFavorite, saveFavorite } from "./actions";
import { listFavoritesForPage } from "./queries";

// docs/specs/redesign-saved.md (SAVED-34), against real Postgres
// (Testcontainers, test/setup.integration.ts): the page query is the
// signed-in user's saved cars only, newest saved first, in one fixed order
// even for cars saved in the same instant, soft-deleted ones left out. This
// is the permission-filtered query RULES.md §10 asks to prove: Ada never
// receives Grace's cars.

let ADA: { id: string; email: string };
let GRACE: { id: string; email: string };

function signedInAs(user: { id: string; email: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

/** A saved car written directly, with its own pinned save time. */
async function seedFavorite(user: { id: string }, listingId: string, createdAt: string) {
  await prisma.favorite.create({
    data: {
      user: { connect: { id: user.id } },
      listingId,
      ...toSnapshot(),
      createdAt: new Date(createdAt),
    },
  });
}

beforeEach(async () => {
  ADA = await createUser({ email: "ada@example.com" });
  GRACE = await createUser({ email: "grace@example.com" });
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(redirect).mockClear();
});

/** One node of `EXPLAIN (FORMAT JSON)`'s tree, with only the fields read here. */
interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  Plans?: PlanNode[];
}

/** Every node of a plan, the root first. */
function planNodes(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(planNodes)];
}

const PLAN_USERS = 200;
const FAVORITES_PER_USER = 50;

describe("SAVED-34: the page query", () => {
  it("SAVED-34: Ada sees only her three cars, newest saved first, while Grace holds one (worked example «Page query»)", async () => {
    // Seeded directly with distinct save times, a minute apart, so the order
    // cannot hinge on two saves landing in the same millisecond.
    await seedFavorite(ADA, "wallapop-first", "2026-10-01T10:00:00.000Z");
    await seedFavorite(ADA, "wallapop-second", "2026-10-01T10:01:00.000Z");
    await seedFavorite(ADA, "wallapop-third", "2026-10-01T10:02:00.000Z");
    await seedFavorite(GRACE, "wallapop-graces-car", "2026-10-01T10:03:00.000Z");

    signedInAs(ADA);
    const adas = await listFavoritesForPage();
    signedInAs(GRACE);
    const graces = await listFavoritesForPage();

    expect(adas.map((listing) => listing.id)).toEqual([
      "wallapop-third",
      "wallapop-second",
      "wallapop-first",
    ]);
    expect(graces.map((listing) => listing.id)).toEqual(["wallapop-graces-car"]);
  });

  it("SAVED-34: a removed car is left out — after Ada removes wallapop-second, she gets third, first", async () => {
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput({ id: "wallapop-first" }));
    await saveFavorite(makeFavoriteInput({ id: "wallapop-second" }));
    await saveFavorite(makeFavoriteInput({ id: "wallapop-third" }));

    await removeFavorite("wallapop-second");

    expect((await listFavoritesForPage()).map((listing) => listing.id)).toEqual([
      "wallapop-third",
      "wallapop-first",
    ]);
  });

  it("SAVED-34: cars saved in the same instant come in one fixed order, the higher id first, on every read", async () => {
    // Two rows with one createdAt. The row ids are UUIDv7s, time-ordered.
    // Contracts › Server: createdAt descending, then id descending, so the
    // higher id comes first whatever order the rows were written in. A read
    // ordered by createdAt alone leaves the tie to Postgres, which promises
    // no order for it.
    const sameInstant = new Date("2026-10-01T10:00:00.000Z");
    // The lower id is written first, so insertion order cannot pass for the tie-break.
    await prisma.favorite.create({
      data: {
        id: "01999a00-0000-7000-8000-000000000001",
        user: { connect: { id: ADA.id } },
        listingId: "wallapop-lower-id",
        ...toSnapshot(),
        createdAt: sameInstant,
      },
    });
    await prisma.favorite.create({
      data: {
        id: "01999a00-0000-7000-8000-000000000002",
        user: { connect: { id: ADA.id } },
        listingId: "wallapop-higher-id",
        ...toSnapshot(),
        createdAt: sameInstant,
      },
    });
    signedInAs(ADA);

    const first = await listFavoritesForPage();
    const second = await listFavoritesForPage();

    expect(first.map((listing) => listing.id)).toEqual(["wallapop-higher-id", "wallapop-lower-id"]);
    expect(second.map((listing) => listing.id)).toEqual(first.map((listing) => listing.id));
  });

  it("SAVED-34: Ada's empty page is an empty list, with Grace's car left out", async () => {
    signedInAs(GRACE);
    await saveFavorite(makeFavoriteInput({ id: "wallapop-graces-car" }));
    signedInAs(ADA);

    expect(await listFavoritesForPage()).toEqual([]);
  });

  it("SAVED-34: signed out, the page redirects to /login?callbackUrl=%2Ffavorites and reads nothing (FAV-15)", async () => {
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput({ id: "wallapop-first" }));
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const findMany = vi.spyOn(prisma.favorite, "findMany");

    await expect(listFavoritesForPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=%2Ffavorites");
    expect(findMany).not.toHaveBeenCalled();
    findMany.mockRestore();
  });
});

// STACK.md §16: the saved-cars list query checked at a realistic volume with
// EXPLAIN. Raw SQL is approved for this test only (owner, 2026-10-15,
// redesign-saved.md › Decisions): Prisma has no EXPLAIN, and a direct insert
// seeds 10 000 rows in one statement instead of 10 000 round trips.
describe("SAVED-34: the page query's plan at a realistic volume", () => {
  it("SAVED-34: with 200 users × 50 saved cars, one user's list reads favorites through an index, never a Seq Scan", async () => {
    await prisma.user.createMany({
      data: Array.from({ length: PLAN_USERS }, (_, index) => ({
        email: `plan-${index}@example.test`,
      })),
    });
    const [owner, ...others] = await prisma.user.findMany({
      select: { id: true },
      where: { email: { startsWith: "plan-" } },
      orderBy: { email: "asc" },
    });
    expect(owner, "the first seeded user").toBeDefined();
    expect(others).toHaveLength(PLAN_USERS - 1);

    // Each seeded user (not the beforeEach Ada and Grace) saves one car a
    // minute; every tenth is soft-deleted, so the `deleted_at IS NULL` filter
    // has rows to drop.
    await prisma.$executeRaw`
      INSERT INTO favorites (
        id, user_id, listing_id, source, title, subtitle, image, brand, model,
        location, fuel, url, price, mileage, year, lat, lng,
        created_at, updated_at, deleted_at
      )
      SELECT
        gen_random_uuid(), u.id, 'wallapop-plan-' || n, 'Wallapop', 'Audi A3 2.0 TDI',
        'Great condition', 'https://example.test/car.jpg', 'Audi', 'A3', 'Madrid',
        'gasoil', 'https://example.test/car', 14500, 95000, 2018, 40.4168, -3.7038,
        timestamptz '2026-10-01T10:00:00Z' + n * interval '1 minute',
        timestamptz '2026-10-01T10:00:00Z' + n * interval '1 minute',
        CASE WHEN n % 10 = 0 THEN timestamptz '2026-10-02T10:00:00Z' END
      FROM users u CROSS JOIN generate_series(1, ${FAVORITES_PER_USER}) AS n
      WHERE u.email LIKE 'plan-%'
    `;
    await prisma.$executeRaw`ANALYZE favorites`;
    expect(await prisma.favorite.count()).toBe(PLAN_USERS * FAVORITES_PER_USER);

    // The SQL shape of findFavorites (server/favorites/service.ts): the
    // owner's rows, not soft-deleted, newest first with `id` as the tie-break.
    const [explained] = await prisma.$queryRaw<{ "QUERY PLAN": { Plan: PlanNode }[] }[]>`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM favorites
      WHERE user_id = ${owner?.id}::uuid AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
    `;
    const root = explained?.["QUERY PLAN"][0]?.Plan;
    expect(root, "the plan's root node").toBeDefined();
    const nodes = root ? planNodes(root) : [];
    const summary = nodes
      .map((node) =>
        [node["Node Type"], node["Relation Name"], node["Index Name"]].filter(Boolean).join(" "),
      )
      .join(" > ");

    expect(
      nodes.filter(
        (node) => node["Node Type"] === "Seq Scan" && node["Relation Name"] === "favorites",
      ),
      summary,
    ).toEqual([]);
    expect(
      nodes.some((node) => node["Index Name"]?.startsWith("favorites_")),
      summary,
    ).toBe(true);
  });
});
