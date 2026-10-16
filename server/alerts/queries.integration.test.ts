import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createAlert } from "@/test/factories/alert";
import { createAlertCriteria } from "@/test/factories/alert-criteria";
import { createUser } from "@/test/factories/user";
import { createAlertMatch } from "@/test/factories/alert-match";
import {
  ADA_ALERT_ORDER,
  type AdaAlert,
  ALERT_CREATED_AT,
  ALERT_CRITERIA,
  ALERT_LABEL,
  ALERT_PLACE_NAME,
} from "@/test/fixtures/alert-listings";

// TEST-8 (docs/specs/core-testing.md): the alerts/[id] read, run against a
// real database, for a signed-in user who is not the alert's owner. This is
// a new file — server/alerts/queries.node.test.ts already covers
// getAlertWithMatches against a mocked @/server/alerts/service and stays as
// it is; this proves the same property end to end, through the real
// database-backed findAlertWithMatches.

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAlertWithMatches, listAlertsForPage } from "./queries";

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(notFound).mockClear();
});

describe("getAlertWithMatches", () => {
  it("TEST-8: user B reading user A's alert gets notFound(), and A's alert is unchanged", async () => {
    const userA = await createUser({ email: "ada@example.com" });
    const userB = await createUser({ email: "grace@example.com" });
    const criteria = await createAlertCriteria();
    const adasAlert = await createAlert({
      user: { connect: { id: userA.id } },
      criteria: { connect: { id: criteria.id } },
      label: "Ada's search",
    });
    vi.mocked(getCurrentUser).mockResolvedValue(userB);

    await expect(getAlertWithMatches(adasAlert.id)).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledTimes(1);
    const stillThere = await prisma.alert.findUnique({ where: { id: adasAlert.id } });
    expect(stillThere).toMatchObject({ id: adasAlert.id, userId: userA.id, label: "Ada's search" });
  });

  it("TEST-8: user A can still read their own alert", async () => {
    const userA = await createUser({ email: "ada@example.com" });
    const criteria = await createAlertCriteria();
    const adasAlert = await createAlert({
      user: { connect: { id: userA.id } },
      criteria: { connect: { id: criteria.id } },
      label: "Ada's search",
    });
    vi.mocked(getCurrentUser).mockResolvedValue(userA);

    const alert = await getAlertWithMatches(adasAlert.id);

    expect(alert).toMatchObject({ id: adasAlert.id, label: adasAlert.label });
  });
});

// DATA-10 (docs/specs/core-data-model.md): `deletedAt` does not exist on
// Alert yet, so the update below is expected to fail until DATA-8 adds it.
describe("listAlertsForPage", () => {
  it("DATA-10: excludes a soft-deleted alert", async () => {
    const userA = await createUser({ email: "ada@example.com" });
    const criteria = await createAlertCriteria();
    const adasAlert = await createAlert({
      user: { connect: { id: userA.id } },
      criteria: { connect: { id: criteria.id } },
      label: "Ada's search",
    });
    await prisma.alert.update({ where: { id: adasAlert.id }, data: { deletedAt: new Date() } });
    vi.mocked(getCurrentUser).mockResolvedValue(userA);

    const { alerts: summaries } = await listAlertsForPage();

    expect(summaries.map((row) => row.id)).not.toContain(adasAlert.id);
  });
});

// docs/specs/redesign-alerts.md (ALERTUI-44, ALERTUI-45; worked example "Page
// queries"), against real Postgres. Ada holds the four alerts of "Open
// alert", newest first; Corolla híbrido has four matches and Serie 3 diésel
// twelve; Grace holds «Grace's search» with two. These are the
// permission-filtered reads RULES.md §10 asks to prove: Ada never receives
// Grace's alerts or matches.
describe("ALERTUI-44 and ALERTUI-45: the alerts pages' queries", () => {
  let ada: { id: string; email: string };
  let grace: { id: string; email: string };
  const ids: Record<AdaAlert | "grace", string> = {
    corolla: "",
    golf: "",
    clio: "",
    serie3: "",
    grace: "",
  };

  /** `count` matches for `alertId`, one minute apart, the first the newest. */
  async function seedMatches(alertId: string, prefix: string, count: number) {
    const newest = Date.parse("2026-10-14T10:00:00.000Z");
    for (let n = 1; n <= count; n++) {
      await createAlertMatch({
        alert: { connect: { id: alertId } },
        listingId: `${prefix}-${String(n).padStart(2, "0")}`,
        createdAt: new Date(newest - n * 60_000),
      });
    }
  }

  beforeEach(async () => {
    ada = await createUser({ email: "ada@example.com" });
    grace = await createUser({ email: "grace@example.com" });
    // Written oldest first, so insertion order cannot pass for the newest-first order.
    for (const which of [...ADA_ALERT_ORDER].reverse()) {
      const criteria = await createAlertCriteria({ criteria: ALERT_CRITERIA[which] });
      const alert = await createAlert({
        user: { connect: { id: ada.id } },
        criteria: { connect: { id: criteria.id } },
        label: ALERT_LABEL[which],
        placeName: ALERT_PLACE_NAME[which],
        createdAt: new Date(ALERT_CREATED_AT[which]),
      });
      ids[which] = alert.id;
    }
    const graceCriteria = await createAlertCriteria({
      criteria: { brand: "Audi", maxPrice: 9000 },
    });
    const graces = await createAlert({
      user: { connect: { id: grace.id } },
      criteria: { connect: { id: graceCriteria.id } },
      label: "Grace's search",
      createdAt: new Date("2026-10-10T10:00:00.000Z"),
    });
    ids.grace = graces.id;
    await seedMatches(ids.corolla, "corolla", 4);
    await seedMatches(ids.serie3, "serie3", 12);
    await seedMatches(ids.grace, "grace", 2);
  });

  it("ALERTUI-44: Ada's /alerts gets her four alerts newest first, each with its name, place name, criteria, state, date and count, and Corolla híbrido's four matches, newest first", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ada);

    const page = await listAlertsForPage(null);

    expect(page.alerts.map((alert) => alert.label)).toEqual([
      "Corolla híbrido",
      "Golf TDI",
      "Clio barato",
      "Serie 3 diésel",
    ]);
    expect(page.alerts[0]).toEqual({
      id: ids.corolla,
      label: "Corolla híbrido",
      placeName: "Madrid",
      criteria: ALERT_CRITERIA.corolla,
      matchCount: 4,
      active: true,
      createdAt: new Date("2026-10-02T10:00:00.000Z"),
    });
    expect(page.alerts.map((alert) => alert.placeName)).toEqual(["Madrid", "Valencia", null, null]);
    expect(page.alerts.map((alert) => alert.matchCount)).toEqual([4, 0, 0, 12]);
    expect(page.openAlertId).toBe(ids.corolla);
    expect(page.matches.map((match) => match.id)).toEqual([
      "corolla-01",
      "corolla-02",
      "corolla-03",
      "corolla-04",
    ]);
  });

  it("ALERTUI-44: alert=<Serie 3's id> gets the same four alerts and Serie 3's twelve matches, newest first", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ada);

    const page = await listAlertsForPage(ids.serie3);

    expect(page.alerts.map((alert) => alert.id)).toEqual([
      ids.corolla,
      ids.golf,
      ids.clio,
      ids.serie3,
    ]);
    expect(page.openAlertId).toBe(ids.serie3);
    expect(page.matches.map((match) => match.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `serie3-${String(index + 1).padStart(2, "0")}`),
    );
  });

  it("ALERTUI-44: alert=<Grace's id> opens Ada's newest and reads none of Grace's matches; Ada never receives Grace's alert", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ada);

    const page = await listAlertsForPage(ids.grace);

    expect(page.openAlertId).toBe(ids.corolla);
    expect(page.alerts.map((alert) => alert.id)).not.toContain(ids.grace);
    expect(page.matches.map((match) => match.id)).toEqual([
      "corolla-01",
      "corolla-02",
      "corolla-03",
      "corolla-04",
    ]);
    expect(page.matches.some((match) => match.id.startsWith("grace-"))).toBe(false);
  });

  it.each([
    ["a malformed id", "not-a-uuid"],
    ["an empty id", ""],
  ])(
    "ALERTUI-44: alert=<%s> opens Ada's newest and reads its matches",
    async (_case, requested) => {
      vi.mocked(getCurrentUser).mockResolvedValue(ada);

      const page = await listAlertsForPage(requested);

      expect(page.openAlertId).toBe(ids.corolla);
      expect(page.matches.map((match) => match.id)).toEqual([
        "corolla-01",
        "corolla-02",
        "corolla-03",
        "corolla-04",
      ]);
    },
  );

  it("ALERTUI-44: a match carries only its snapshot, as a listing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ada);

    const page = await listAlertsForPage(null);

    expect(page.matches).toHaveLength(4);
    expect(Object.keys(page.matches[0]).sort()).toEqual([
      "brand",
      "fuel",
      "id",
      "image",
      "lat",
      "lng",
      "location",
      "mileage",
      "model",
      "price",
      "source",
      "subtitle",
      "title",
      "url",
      "year",
    ]);
  });

  it("ALERTUI-44: two alerts created in the same millisecond come in one order, the higher id first, on every read", async () => {
    const sameInstant = new Date("2026-10-12T10:00:00.000Z");
    // The lower id is written first, so insertion order cannot pass for the tie-break.
    const lower = await createAlert({
      id: "01999a00-0000-7000-8000-0000000000e1",
      user: { connect: { id: grace.id } },
      criteria: { connect: { id: (await createAlertCriteria({ criteria: { brand: "Kia" } })).id } },
      label: "Lower id",
      createdAt: sameInstant,
    });
    const higher = await createAlert({
      id: "01999a00-0000-7000-8000-0000000000e2",
      user: { connect: { id: grace.id } },
      criteria: {
        connect: { id: (await createAlertCriteria({ criteria: { brand: "Seat" } })).id },
      },
      label: "Higher id",
      createdAt: sameInstant,
    });
    vi.mocked(getCurrentUser).mockResolvedValue(grace);

    const first = await listAlertsForPage(null);
    const second = await listAlertsForPage(null);

    expect(first.alerts.map((alert) => alert.id)).toEqual([higher.id, lower.id, ids.grace]);
    expect(second.alerts.map((alert) => alert.id)).toEqual([higher.id, lower.id, ids.grace]);
  });

  it("ALERTUI-44: after Ada deletes Golf TDI her /alerts lists three alerts and /alerts/<Golf's id> is a 404", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ada);
    await prisma.alert.update({ where: { id: ids.golf }, data: { deletedAt: new Date() } });

    const page = await listAlertsForPage(ids.golf);

    expect(page.alerts.map((alert) => alert.label)).toEqual([
      "Corolla híbrido",
      "Clio barato",
      "Serie 3 diésel",
    ]);
    expect(page.openAlertId).toBe(ids.corolla);
    await expect(getAlertWithMatches(ids.golf)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("ALERTUI-45: Ada's /alerts/<Serie 3's id> gets the alert with every match, newest first, and none of the alert row's secrets or audit columns", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ada);

    const alert = await getAlertWithMatches(ids.serie3);

    expect(alert).toMatchObject({
      id: ids.serie3,
      label: "Serie 3 diésel",
      placeName: null,
      active: true,
    });
    expect(alert.createdAt).toEqual(new Date("2026-09-14T10:00:00.000Z"));
    expect(alert.matches.map((match) => match.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `serie3-${String(index + 1).padStart(2, "0")}`),
    );
    for (const field of [
      "userId",
      "unsubscribeTokenHash",
      "unsubscribeSubject",
      "updatedAt",
      "createdById",
      "updatedById",
      "deletedAt",
      "version",
    ]) {
      expect(alert, field).not.toHaveProperty(field);
    }
    for (const field of [
      "alertId",
      "listingId",
      "createdAt",
      "notifiedAt",
      "updatedAt",
      "deletedAt",
      "version",
    ]) {
      expect(alert.matches[0], field).not.toHaveProperty(field);
    }
  });

  it("ALERTUI-45: the place name and the stored criteria reach the page — Corolla híbrido, «Madrid»", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ada);

    const alert = await getAlertWithMatches(ids.corolla);

    expect(alert).toMatchObject({ placeName: "Madrid", criteria: ALERT_CRITERIA.corolla });
  });

  it.each([
    ["Grace's alert, read by Ada", "grace"],
    ["Ada's alert, read by Grace", "corolla"],
  ] as const)("ALERTUI-45: %s is a 404, and nothing of it is returned", async (_case, which) => {
    vi.mocked(getCurrentUser).mockResolvedValue(which === "grace" ? ada : grace);

    await expect(getAlertWithMatches(ids[which])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([
    ["an unknown id", "0199a000-0000-7000-8000-0000000dead1"],
    ["a malformed id", "not-a-uuid"],
  ])("ALERTUI-45: %s is a 404", async (_case, id) => {
    vi.mocked(getCurrentUser).mockResolvedValue(ada);

    await expect(getAlertWithMatches(id)).rejects.toThrow("NEXT_NOT_FOUND");
  });
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

/** A plan's nodes, and a one-line summary of them for the failure message. */
function readPlan(explained: { "QUERY PLAN": { Plan: PlanNode }[] } | undefined) {
  const root = explained?.["QUERY PLAN"][0]?.Plan;
  expect(root, "the plan's root node").toBeDefined();
  const nodes = root ? planNodes(root) : [];
  const summary = nodes
    .map((node) =>
      [node["Node Type"], node["Relation Name"], node["Index Name"]].filter(Boolean).join(" "),
    )
    .join(" > ");
  return { nodes, summary };
}

const PLAN_USERS = 200;
const MATCHES_PER_ALERT = 50;

// STACK.md §16: the two alert page reads checked at a realistic volume with
// EXPLAIN, as SAVED-34 checks the saved cars' list. Raw SQL is approved for
// this test (owner, 2026-10-16, redesign-alerts.md › Decisions › Raw SQL in
// the e2e fixture): Prisma has no EXPLAIN, and direct inserts seed 10 000
// matches in one statement instead of 10 000 round trips.
describe("ALERTUI-44/45: the page reads' plans at a realistic volume", () => {
  it("ALERTUI-44/45: at a realistic volume the alerts list and an alert's matches read through an index, never a Seq Scan", async () => {
    await prisma.user.createMany({
      data: Array.from({ length: PLAN_USERS }, (_, index) => ({
        email: `plan-${index}@example.test`,
      })),
    });
    const owner = await prisma.user.findFirst({
      select: { id: true },
      where: { email: "plan-0@example.test" },
    });
    expect(owner, "the first seeded user").not.toBeNull();

    // One shared criteria set, one alert per seeded user, fifty matches per
    // alert, found a minute apart.
    await prisma.$executeRaw`
      INSERT INTO alert_criteria (id, criteria_hash, criteria, updated_at)
      VALUES (gen_random_uuid(), 'plan-criteria', '{"brand":"Audi"}'::jsonb, now())
    `;
    await prisma.$executeRaw`
      INSERT INTO alerts (
        id, user_id, criteria_id, label, unsubscribe_token_hash, unsubscribe_subject,
        created_at, updated_at
      )
      SELECT
        gen_random_uuid(), u.id, c.id, 'Audi A3', 'plan-token-' || u.id, 'plan-subject-' || u.id,
        timestamptz '2026-10-01T10:00:00Z', timestamptz '2026-10-01T10:00:00Z'
      FROM users u CROSS JOIN alert_criteria c
      WHERE u.email LIKE 'plan-%' AND c.criteria_hash = 'plan-criteria'
    `;
    await prisma.$executeRaw`
      INSERT INTO alert_matches (
        id, alert_id, listing_id, source, title, subtitle, image, brand, model,
        location, fuel, url, price, mileage, year, lat, lng, created_at, updated_at
      )
      SELECT
        gen_random_uuid(), a.id, 'wallapop-plan-' || n, 'Wallapop', 'Audi A3 2.0 TDI',
        'Great condition', 'https://example.test/car.jpg', 'Audi', 'A3', 'Madrid',
        'gasoil', 'https://example.test/car', 14500, 95000, 2018, 40.4168, -3.7038,
        timestamptz '2026-10-01T10:00:00Z' + n * interval '1 minute',
        timestamptz '2026-10-01T10:00:00Z' + n * interval '1 minute'
      FROM alerts a CROSS JOIN generate_series(1, ${MATCHES_PER_ALERT}) AS n
      WHERE a.label = 'Audi A3'
    `;
    await prisma.$executeRaw`ANALYZE alerts`;
    await prisma.$executeRaw`ANALYZE alert_matches`;
    expect(await prisma.alertMatch.count()).toBe(PLAN_USERS * MATCHES_PER_ALERT);
    const alert = await prisma.alert.findFirst({
      select: { id: true },
      where: { userId: owner?.id },
    });
    expect(alert, "the owner's alert").not.toBeNull();

    // The SQL shape of findAlertSummaries (server/alerts/service.ts): the
    // owner's alerts, not soft-deleted, newest first with `id` as the
    // tie-break.
    const [summaries] = await prisma.$queryRaw<{ "QUERY PLAN": { Plan: PlanNode }[] }[]>`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM alerts
      WHERE user_id = ${owner?.id}::uuid AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
    `;
    const summariesPlan = readPlan(summaries);
    expect(
      summariesPlan.nodes.filter(
        (node) => node["Node Type"] === "Seq Scan" && node["Relation Name"] === "alerts",
      ),
      summariesPlan.summary,
    ).toEqual([]);
    expect(
      summariesPlan.nodes.some((node) => node["Index Name"]?.startsWith("alerts_")),
      summariesPlan.summary,
    ).toBe(true);

    // The SQL shape of findOpenAlertMatches and of findAlertWithMatches'
    // matches: one alert's matches, the alert scoped to its owner and not
    // soft-deleted, newest first with `id` as the tie-break.
    const [matches] = await prisma.$queryRaw<{ "QUERY PLAN": { Plan: PlanNode }[] }[]>`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM alert_matches
      WHERE alert_id = ${alert?.id}::uuid
        AND alert_id IN (
          SELECT id FROM alerts WHERE user_id = ${owner?.id}::uuid AND deleted_at IS NULL
        )
      ORDER BY created_at DESC, id DESC
    `;
    const matchesPlan = readPlan(matches);
    expect(
      matchesPlan.nodes.filter(
        (node) =>
          node["Node Type"] === "Seq Scan" &&
          (node["Relation Name"] === "alert_matches" || node["Relation Name"] === "alerts"),
      ),
      matchesPlan.summary,
    ).toEqual([]);
    expect(
      matchesPlan.nodes.some((node) => node["Index Name"]?.startsWith("alert_matches_")),
      matchesPlan.summary,
    ).toBe(true);
  });
});
