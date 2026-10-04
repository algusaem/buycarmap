import { describe, expect, it, vi } from "vitest";
import { createUser } from "@/test/factories/user";

// BAUTH-13 (docs/specs/core-better-auth.md): the migration switches
// two-factor off for every user who had it on at cutover
// (prisma/better-auth-migration.integration.test.ts); this is meant to mail
// each of them once, asking them to enrol again. `notifyTwoFactorReset` is a
// new stub (server/two-factor/reenrol.ts) declared for this phase — nothing
// calls it yet, and it throws "not implemented", so this is red at that call.

vi.mock("@/lib/platform/email", () => ({ sendEmail: vi.fn(async () => true) }));

import { sendEmail } from "@/lib/platform/email";
import { notifyTwoFactorReset } from "./reenrol";

describe("BAUTH-13: notifyTwoFactorReset", () => {
  it("BAUTH-13: sends exactly one email per affected user", async () => {
    const ada = await createUser({ email: "ada@example.test", locale: "en" });
    const bea = await createUser({ email: "bea@example.test", locale: "es" });

    await notifyTwoFactorReset([
      { id: ada.id, email: ada.email, locale: ada.locale },
      { id: bea.id, email: bea.email, locale: bea.locale },
    ]);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const recipients = vi.mocked(sendEmail).mock.calls.map(([call]) => call.to);
    expect(recipients.sort()).toEqual(["ada@example.test", "bea@example.test"]);
  });
});
