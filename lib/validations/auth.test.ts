import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, loginSchema, registerSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "secret" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email address", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid email address");
    }
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Password is required");
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
    password: "longenough",
    confirmPassword: "longenough",
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

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Password must be at least 8 characters",
      );
    }
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
      expect(result.error.issues[0].message).toBe(
        "Password must be at most 72 characters",
      );
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
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.message).toBe("Passwords do not match");
      expect(issue.path).toEqual(["confirmPassword"]);
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(
      true,
    );
  });

  it("rejects an invalid email address", () => {
    const result = forgotPasswordSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid email address");
    }
  });

  it("rejects an empty email as required", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Email is required");
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
