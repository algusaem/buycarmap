import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { buildAlert, createAlert } from "./alert";
import { buildAlertCriteria, createAlertCriteria } from "./alert-criteria";
import { buildAlertMatch, createAlertMatch } from "./alert-match";
import {
  buildEmailVerificationToken,
  buildPasswordResetToken,
  buildPendingRegistration,
  createEmailVerificationToken,
  createPasswordResetToken,
  createPendingRegistration,
} from "./auth-tokens";
import { buildFavorite, createFavorite } from "./favorite";
import { buildUser, createUser } from "./user";

// TEST-10 (docs/specs/core-testing.md): every factory under test/factories/
// returns valid data for its Prisma `create`, takes overrides, and is
// deterministic under the integration harness's seeded faker (assumed to seed
// faker once per test file — see test/setup.integration.ts, not written yet).
// This file is not matched by any Vitest project today: `prisma/schema.prisma`
// has no such config, and test/integration.global-setup.ts and
// test/setup.integration.ts do not exist yet. See the report.

describe("user factory", () => {
  it("TEST-10: createUser inserts a row readable back by id", async () => {
    const user = await createUser();

    const found = await prisma.user.findUnique({ where: { id: user.id } });

    expect(found?.email).toBe(user.email);
  });

  it("TEST-10: an override wins over the generated value", async () => {
    const user = buildUser({ email: "factory-override@example.test" });

    expect(user.email).toBe("factory-override@example.test");
  });

  it("TEST-10: two builds under the same seed give equal output", () => {
    expect(buildUser()).toEqual(buildUser());
  });
});

describe("favorite factory", () => {
  it("TEST-10: createFavorite inserts a row readable back by id", async () => {
    const user = await createUser();
    const favorite = await createFavorite({ user: { connect: { id: user.id } } });

    const found = await prisma.favorite.findUnique({ where: { id: favorite.id } });

    expect(found?.listingId).toBe(favorite.listingId);
  });

  it("TEST-10: an override wins over the generated value", async () => {
    const user = await createUser();
    const favorite = buildFavorite({
      user: { connect: { id: user.id } },
      listingId: "wallapop-factory-override",
    });

    expect(favorite.listingId).toBe("wallapop-factory-override");
  });

  it("TEST-10: two builds under the same seed give equal output", async () => {
    const user = await createUser();
    const connect = { user: { connect: { id: user.id } } };

    expect(buildFavorite(connect)).toEqual(buildFavorite(connect));
  });
});

describe("alert-criteria factory", () => {
  it("TEST-10: createAlertCriteria inserts a row readable back by id", async () => {
    const criteria = await createAlertCriteria();

    const found = await prisma.alertCriteria.findUnique({ where: { id: criteria.id } });

    expect(found?.criteriaHash).toBe(criteria.criteriaHash);
  });

  it("TEST-10: an override wins over the generated value", () => {
    const criteria = buildAlertCriteria({ criteriaHash: "factory-override-hash" });

    expect(criteria.criteriaHash).toBe("factory-override-hash");
  });

  it("TEST-10: two builds under the same seed give equal output", () => {
    expect(buildAlertCriteria()).toEqual(buildAlertCriteria());
  });
});

describe("alert factory", () => {
  it("TEST-10: createAlert inserts a row readable back by id", async () => {
    const user = await createUser();
    const criteria = await createAlertCriteria();
    const alert = await createAlert({
      user: { connect: { id: user.id } },
      criteria: { connect: { id: criteria.id } },
    });

    const found = await prisma.alert.findUnique({ where: { id: alert.id } });

    expect(found?.label).toBe(alert.label);
  });

  it("TEST-10: an override wins over the generated value", async () => {
    const user = await createUser();
    const criteria = await createAlertCriteria();
    const alert = buildAlert({
      user: { connect: { id: user.id } },
      criteria: { connect: { id: criteria.id } },
      label: "Factory override label",
    });

    expect(alert.label).toBe("Factory override label");
  });

  it("TEST-10: two builds under the same seed give equal output", async () => {
    const user = await createUser();
    const criteria = await createAlertCriteria();
    const connect = {
      user: { connect: { id: user.id } },
      criteria: { connect: { id: criteria.id } },
    };

    expect(buildAlert(connect)).toEqual(buildAlert(connect));
  });
});

describe("alert-match factory", () => {
  it("TEST-10: createAlertMatch inserts a row readable back by id", async () => {
    const user = await createUser();
    const criteria = await createAlertCriteria();
    const alert = await createAlert({
      user: { connect: { id: user.id } },
      criteria: { connect: { id: criteria.id } },
    });
    const match = await createAlertMatch({ alert: { connect: { id: alert.id } } });

    const found = await prisma.alertMatch.findUnique({ where: { id: match.id } });

    expect(found?.listingId).toBe(match.listingId);
  });

  it("TEST-10: an override wins over the generated value", async () => {
    const user = await createUser();
    const criteria = await createAlertCriteria();
    const alert = await createAlert({
      user: { connect: { id: user.id } },
      criteria: { connect: { id: criteria.id } },
    });
    const match = buildAlertMatch({
      alert: { connect: { id: alert.id } },
      listingId: "wallapop-factory-override",
    });

    expect(match.listingId).toBe("wallapop-factory-override");
  });

  it("TEST-10: two builds under the same seed give equal output", async () => {
    const user = await createUser();
    const criteria = await createAlertCriteria();
    const alert = await createAlert({
      user: { connect: { id: user.id } },
      criteria: { connect: { id: criteria.id } },
    });
    const connect = { alert: { connect: { id: alert.id } } };

    expect(buildAlertMatch(connect)).toEqual(buildAlertMatch(connect));
  });
});

describe("auth-token factories", () => {
  it("TEST-10: createPasswordResetToken inserts a row readable back by id", async () => {
    const user = await createUser();
    const token = await createPasswordResetToken({ user: { connect: { id: user.id } } });

    const found = await prisma.passwordResetToken.findUnique({ where: { id: token.id } });

    expect(found?.tokenHash).toBe(token.tokenHash);
  });

  it("TEST-10: createPasswordResetToken's override wins", async () => {
    const user = await createUser();
    const token = buildPasswordResetToken({
      user: { connect: { id: user.id } },
      tokenHash: "factory-override-hash",
    });

    expect(token.tokenHash).toBe("factory-override-hash");
  });

  it("TEST-10: createEmailVerificationToken inserts a row readable back by id", async () => {
    const user = await createUser();
    const token = await createEmailVerificationToken({ user: { connect: { id: user.id } } });

    const found = await prisma.emailVerificationToken.findUnique({ where: { id: token.id } });

    expect(found?.tokenHash).toBe(token.tokenHash);
  });

  it("TEST-10: createEmailVerificationToken's override wins", async () => {
    const user = await createUser();
    const token = buildEmailVerificationToken({
      user: { connect: { id: user.id } },
      newEmail: "factory-override@example.test",
    });

    expect(token.newEmail).toBe("factory-override@example.test");
  });

  it("TEST-10: createPendingRegistration inserts a row readable back by id", async () => {
    const pending = await createPendingRegistration();

    const found = await prisma.pendingRegistration.findUnique({ where: { id: pending.id } });

    expect(found?.tokenHash).toBe(pending.tokenHash);
  });

  it("TEST-10: createPendingRegistration's override wins", () => {
    const pending = buildPendingRegistration({ email: "factory-override@example.test" });

    expect(pending.email).toBe("factory-override@example.test");
  });
});
