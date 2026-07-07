import { beforeEach, describe, expect, it, vi } from "vitest";

// The DB and bcrypt are dependencies; authorizeCredentials' branching is the SUT.
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth/hash", () => ({
  verifyPassword: vi.fn(),
  DUMMY_PASSWORD_HASH: "$2b$12$dummy",
}));

import { prisma } from "@/lib/prisma";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/hash";
import { authorizeCredentials } from "./authorize";

const dbUser = {
  id: "u1",
  email: "ada@example.com",
  password: "$2b$12$storedhash",
  name: "Ada",
  avatarUrl: "https://img/ada.png",
};

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(verifyPassword).mockReset();
  });

  it("returns null and never queries when a field is missing", async () => {
    expect(await authorizeCredentials({ email: "", password: "x" })).toBeNull();
    expect(await authorizeCredentials(undefined)).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("normalizes the email (trim + lowercase) before lookup", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    await authorizeCredentials({ email: "  ADA@Example.COM ", password: "pw" });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
    });
  });

  it("runs a dummy bcrypt compare for an unknown email (timing safe)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const result = await authorizeCredentials({
      email: "ghost@example.com",
      password: "pw",
    });

    expect(result).toBeNull();
    // Must still hash against the dummy so timing matches the wrong-password path.
    expect(verifyPassword).toHaveBeenCalledWith("pw", DUMMY_PASSWORD_HASH);
  });

  it("returns null when the password does not match", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const result = await authorizeCredentials({
      email: "ada@example.com",
      password: "wrong",
    });

    expect(result).toBeNull();
    expect(verifyPassword).toHaveBeenCalledWith("wrong", dbUser.password);
  });

  it("returns the mapped user on a correct password (avatarUrl -> image)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await authorizeCredentials({
      email: "ada@example.com",
      password: "correct",
    });

    expect(result).toEqual({
      id: "u1",
      email: "ada@example.com",
      name: "Ada",
      image: "https://img/ada.png",
    });
  });
});
