import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the data + hashing dependencies; the action's own logic is the SUT.
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
}));

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { register } from "./register";

function formData(
  fields: Record<string, string | undefined>,
): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

const valid = {
  name: "Ada",
  email: "ada@example.com",
  password: "longenough",
  confirmPassword: "longenough",
};

describe("register action", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.user.create).mockReset();
  });

  it("rejects invalid input without touching the database", async () => {
    const result = await register(
      formData({ ...valid, confirmPassword: "different" }),
    );

    expect(result).toEqual({
      success: false,
      error: "Passwords do not match",
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email and does not create a user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "1" } as never);

    const result = await register(formData(valid));

    expect(result).toEqual({
      success: false,
      error: "An account with this email already exists",
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates the user with a hashed password on success", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "1" } as never);

    const result = await register(formData(valid));

    expect(result).toEqual({ success: true });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "ada@example.com",
        password: "hashed:longenough",
        name: "Ada",
      },
    });
  });

  it("normalizes the email (trim + lowercase) before storing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "1" } as never);

    await register(formData({ ...valid, email: "  ADA@Example.COM " }));

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "ada@example.com" }),
    });
  });

  it("stores a null name when the field is submitted empty", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "1" } as never);

    // The form always submits the name field; empty means "no name".
    await register(formData({ ...valid, name: "" }));

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: null }),
    });
  });

  it("maps a unique-constraint race (P2002) to the duplicate-email error", async () => {
    // findUnique says the email is free, but a concurrent signup won the insert.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await register(formData(valid));

    expect(result).toEqual({
      success: false,
      error: "An account with this email already exists",
    });
  });

  it("returns a generic failure (no message) on an unexpected DB error", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockRejectedValue(new Error("connection lost"));

    const result = await register(formData(valid));

    expect(result).toEqual({ success: false });
  });
});
