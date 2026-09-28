import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth";

// Schema messages are error *codes*, not prose — the same schemas run on the
// server, where the client's i18n context does not exist. The UI resolves them
// through `translateAuthError`.

// 20 characters of unrelated words: over the 12-char floor, and not a pattern
// the strength scorer flags.
const STRONG_PASSWORD = "harbour-lentil-quilt";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "secret" }).success).toBe(true);
  });

  it("accepts a short password that predates the current policy", () => {
    // Login must never apply strength rules: existing accounts may hold
    // passwords shorter than today's minimum, and a length hint on the sign-in
    // form would leak the policy to an attacker for free.
    expect(loginSchema.safeParse({ email: "a@b.com", password: "old" }).success).toBe(true);
  });

  it("rejects an invalid email address", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("emailInvalid");
    }
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("passwordRequired");
    }
  });

  it("trims and lowercases the email", () => {
    const result = loginSchema.safeParse({
      email: "  ADA@Example.COM ",
      password: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Ada",
    email: "ada@example.com",
    password: STRONG_PASSWORD,
    confirmPassword: STRONG_PASSWORD,
  };

  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("treats name as optional", () => {
    const withoutName = {
      email: valid.email,
      password: valid.password,
      confirmPassword: valid.confirmPassword,
    };
    expect(registerSchema.safeParse(withoutName).success).toBe(true);
  });

  it("rejects a password shorter than 12 characters", () => {
    // 11 characters — one below the floor, so this pins the boundary rather
    // than just testing something obviously short.
    const elevenChars = "abcdefghijk";
    expect(elevenChars).toHaveLength(11);

    const result = registerSchema.safeParse({
      ...valid,
      password: elevenChars,
      confirmPassword: elevenChars,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("passwordTooShort");
    }
  });

  it("accepts a password of exactly 12 characters", () => {
    const twelveChars = "abcdefghijkl";
    expect(twelveChars).toHaveLength(12);

    expect(
      registerSchema.safeParse({
        ...valid,
        password: twelveChars,
        confirmPassword: twelveChars,
      }).success,
    ).toBe(true);
  });

  it("rejects a password longer than 72 bytes (bcrypt truncation limit)", () => {
    const long = "a".repeat(73);
    const result = registerSchema.safeParse({
      ...valid,
      password: long,
      confirmPassword: long,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("passwordTooLong");
    }
  });

  it("rejects a name longer than 80 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      name: "a".repeat(81),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("nameTooLong");
    }
  });

  it("normalizes the email to lowercase on the parsed output", () => {
    const result = registerSchema.safeParse({
      ...valid,
      email: "  ADA@Example.COM ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });

  it("rejects mismatched passwords and attributes the error to confirmPassword", () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: "different-but-long",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.message).toBe("passwordsDoNotMatch");
      expect(issue.path).toEqual(["confirmPassword"]);
    }
  });
});

describe("resetPasswordSchema", () => {
  const valid = {
    token: "a-token",
    password: STRONG_PASSWORD,
    confirmPassword: STRONG_PASSWORD,
  };

  it("accepts a valid reset", () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty token", () => {
    const result = resetPasswordSchema.safeParse({ ...valid, token: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("tokenInvalid");
    }
  });

  it("applies the same length floor as registration", () => {
    const short = "abcdefghijk";
    const result = resetPasswordSchema.safeParse({
      ...valid,
      password: short,
      confirmPassword: short,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("passwordTooShort");
    }
  });
});

describe("changePasswordSchema", () => {
  it("requires the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      password: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("passwordRequired");
    }
  });

  it("does not constrain the current password's length", () => {
    // The account may predate the current policy; only the new password is
    // held to it.
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      }).success,
    ).toBe(true);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rejects an invalid email address", () => {
    const result = forgotPasswordSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("emailInvalid");
    }
  });

  it("rejects an empty email as required", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("emailRequired");
    }
  });

  it("trims and lowercases the email on the parsed output", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "  ADA@Example.COM ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });
});
