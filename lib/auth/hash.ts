import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// Pre-computed hash of a value no user can submit. When an account is not
// found we still run a real bcrypt comparison against this, so the response
// time matches the wrong-password path and an attacker cannot detect which
// emails are registered by timing (user enumeration).
export const DUMMY_PASSWORD_HASH = "$2b$12$5D38CDwN0TVA55Mpqk4vqOQd8CJxTKSQQsWSNhsIsq1P7C6ef9dnu";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
