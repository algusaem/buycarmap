import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAlertStore, makeCriteria } from "@/test/fixtures/alerts";

let store: ReturnType<typeof createAlertStore>;

vi.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return store.client;
  },
}));

// The endpoint is reached from an inbox, so it must work with no session at
// all. Mocked to prove the handler never consults it.
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { GET } from "./route";

const ADA = { id: "user-ada", email: "ada@example.com" };

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

function visit(token: string | null): Promise<Response> {
  const url = new URL("http://localhost:3000/api/alerts/unsubscribe");
  if (token !== null) url.searchParams.set("token", token);
  return GET(new NextRequest(url));
}

/** An active alert whose emailed unsubscribe token is `raw`. */
function seedAlertWithToken(raw: string) {
  const criteria = store.seedCriteria({ criteria: makeCriteria() });
  return store.seedAlert({
    userId: ADA.id,
    criteriaId: criteria.id,
    active: true,
    unsubscribeTokenHash: hashOf(raw),
  });
}

beforeEach(() => {
  store = createAlertStore();
  store.seedUser({ id: ADA.id, email: ADA.email, locale: "en" });
  vi.mocked(getCurrentUser).mockReset();
});

describe("GET /api/alerts/unsubscribe", () => {
  it("ALERT-26: deactivates the alert the token belongs to", async () => {
    const alert = seedAlertWithToken("raw-token-ada");

    const response = await visit("raw-token-ada");

    expect(response.status).toBe(200);
    expect(store.alerts().find((row) => row.id === alert.id)?.active).toBe(false);
  });

  it("ALERT-26: works with no session, because it is followed from an inbox", async () => {
    seedAlertWithToken("raw-token-ada");
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await visit("raw-token-ada");

    expect(response.status).toBe(200);
    expect(store.alerts()[0].active).toBe(false);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("ALERT-26: leaves the user's other alerts alone", async () => {
    const target = seedAlertWithToken("raw-token-one");
    const untouched = seedAlertWithToken("raw-token-two");

    await visit("raw-token-one");

    const rows = store.alerts();
    expect(rows.find((row) => row.id === target.id)?.active).toBe(false);
    expect(rows.find((row) => row.id === untouched.id)?.active).toBe(true);
  });

  it("ALERT-26: keeps the criteria set, so the matches page still renders", async () => {
    seedAlertWithToken("raw-token-ada");

    await visit("raw-token-ada");

    // Unsubscribing deactivates; only deleting the alert releases the criteria.
    expect(store.criteria()).toHaveLength(1);
  });

  it("ALERT-26: the token is stored hashed, never in the clear", async () => {
    seedAlertWithToken("raw-token-ada");

    // The raw token exists only in the email, so a database leak does not hand
    // over working unsubscribe links.
    expect(store.alerts()[0].unsubscribeTokenHash).not.toContain("raw-token-ada");
    expect(store.alerts()[0].unsubscribeTokenHash).toBe(hashOf("raw-token-ada"));
  });

  it("ALERT-27: an unknown token changes nothing", async () => {
    seedAlertWithToken("raw-token-ada");

    const response = await visit("some-token-nobody-issued");

    expect(response.status).toBe(200);
    expect(store.alerts()[0].active).toBe(true);
  });

  it("ALERT-27: a missing token changes nothing", async () => {
    seedAlertWithToken("raw-token-ada");

    const response = await visit(null);

    expect(response.status).toBe(200);
    expect(store.alerts()[0].active).toBe(true);
  });

  it("ALERT-27: an already-used token changes nothing further", async () => {
    const alert = seedAlertWithToken("raw-token-ada");
    await visit("raw-token-ada");

    const response = await visit("raw-token-ada");

    expect(response.status).toBe(200);
    expect(store.alerts().find((row) => row.id === alert.id)?.active).toBe(false);
  });

  it("ALERT-27: an invalid token is answered identically to a valid one", async () => {
    seedAlertWithToken("raw-token-ada");
    const valid = await visit("raw-token-ada");
    const invalid = await visit("garbage");

    // Differing responses would turn the endpoint into an oracle for which
    // tokens exist, which is the enumeration resistance the auth surfaces hold.
    expect(invalid.status).toBe(valid.status);
    expect(await invalid.text()).toBe(await valid.text());
  });
});
