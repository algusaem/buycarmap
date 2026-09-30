import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAlert } from "@/test/factories/alert";
import { createAlertCriteria } from "@/test/factories/alert-criteria";
import { createUser } from "@/test/factories/user";

// The endpoint is reached from an inbox, so it must work with no session at
// all. Mocked to prove the handler never consults it — this is not a database
// dependency, so it stays mocked here.
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { GET } from "./route";

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

function visit(token: string | null): Promise<Response> {
  const url = new URL("http://localhost:3000/api/alerts/unsubscribe");
  if (token !== null) url.searchParams.set("token", token);
  return GET(new NextRequest(url));
}

/** An active alert whose emailed unsubscribe token is `raw`. */
async function seedAlertWithToken(raw: string) {
  const user = await createUser();
  const criteria = await createAlertCriteria();
  return createAlert({
    user: { connect: { id: user.id } },
    criteria: { connect: { id: criteria.id } },
    active: true,
    unsubscribeTokenHash: hashOf(raw),
  });
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
});

describe("GET /api/alerts/unsubscribe", () => {
  it("ALERT-26: deactivates the alert the token belongs to", async () => {
    const alert = await seedAlertWithToken("raw-token-ada");

    const response = await visit("raw-token-ada");

    expect(response.status).toBe(200);
    const found = await prisma.alert.findUnique({ where: { id: alert.id } });
    expect(found?.active).toBe(false);
  });

  it("ALERT-26: works with no session, because it is followed from an inbox", async () => {
    await seedAlertWithToken("raw-token-ada");
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await visit("raw-token-ada");

    expect(response.status).toBe(200);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("ALERT-26: leaves the user's other alerts alone", async () => {
    const target = await seedAlertWithToken("raw-token-one");
    const untouched = await seedAlertWithToken("raw-token-two");

    await visit("raw-token-one");

    const targetRow = await prisma.alert.findUnique({ where: { id: target.id } });
    const untouchedRow = await prisma.alert.findUnique({ where: { id: untouched.id } });
    expect(targetRow?.active).toBe(false);
    expect(untouchedRow?.active).toBe(true);
  });

  it("ALERT-26: keeps the criteria set, so the matches page still renders", async () => {
    const alert = await seedAlertWithToken("raw-token-ada");

    await visit("raw-token-ada");

    // Unsubscribing deactivates; only deleting the alert releases the criteria.
    const criteria = await prisma.alertCriteria.findUnique({ where: { id: alert.criteriaId } });
    expect(criteria).not.toBeNull();
  });

  it("ALERT-26: the token is stored hashed, never in the clear", async () => {
    const alert = await seedAlertWithToken("raw-token-ada");

    const found = await prisma.alert.findUnique({ where: { id: alert.id } });
    expect(found?.unsubscribeTokenHash).not.toContain("raw-token-ada");
    expect(found?.unsubscribeTokenHash).toBe(hashOf("raw-token-ada"));
  });

  it("ALERT-27: an unknown token changes nothing", async () => {
    const alert = await seedAlertWithToken("raw-token-ada");

    const response = await visit("some-token-nobody-issued");

    expect(response.status).toBe(200);
    const found = await prisma.alert.findUnique({ where: { id: alert.id } });
    expect(found?.active).toBe(true);
  });

  it("ALERT-27: a missing token changes nothing", async () => {
    const alert = await seedAlertWithToken("raw-token-ada");

    const response = await visit(null);

    expect(response.status).toBe(200);
    const found = await prisma.alert.findUnique({ where: { id: alert.id } });
    expect(found?.active).toBe(true);
  });

  it("ALERT-27: an already-used token changes nothing further", async () => {
    const alert = await seedAlertWithToken("raw-token-ada");
    await visit("raw-token-ada");

    const response = await visit("raw-token-ada");

    expect(response.status).toBe(200);
    const found = await prisma.alert.findUnique({ where: { id: alert.id } });
    expect(found?.active).toBe(false);
  });

  it("ALERT-27: an invalid token is answered identically to a valid one", async () => {
    await seedAlertWithToken("raw-token-ada");
    const valid = await visit("raw-token-ada");
    const invalid = await visit("garbage");

    // Differing responses would turn the endpoint into an oracle for which
    // tokens exist, which is the enumeration resistance the auth surfaces hold.
    expect(invalid.status).toBe(valid.status);
    expect(await invalid.text()).toBe(await valid.text());
  });
});
