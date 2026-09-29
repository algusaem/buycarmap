import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { REGISTRATION_TTL_MS, generateToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/client";
import {
  renderExistingAccountEmail,
  renderVerifyRegistrationEmail,
} from "@/lib/email/templates/auth-emails";
import { appUrl } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";
import { maybePruneExpiredAuthRows } from "@/server/auth/service";

export interface RegisterResult {
  success: boolean;
  error?: AuthErrorCode;
  /**
   * True when the signup is awaiting email confirmation, so the form shows a
   * "check your inbox" panel instead of signing the user straight in.
   *
   * Deliberately identical for a free address and a taken one — the whole
   * point is that the response carries no information about which it was.
   */
  pending?: boolean;
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Removes every pending signup for an address. */
export async function deletePendingRegistrations(email: string): Promise<void> {
  await prisma.pendingRegistration.deleteMany({ where: { email } });
}

// Tells the owner of the address that someone tried to sign up with it.
export async function notifyExistingAccount(email: string): Promise<void> {
  const locale = await getLocale();
  const { subject, html, text } = renderExistingAccountEmail(locale, `${appUrl}/login`);
  await sendEmail({ to: email, subject, html, text });
}

// Stores the signup and emails a confirmation link. Nothing is written to
// `User` here, which is what keeps the two branches indistinguishable.
export async function issuePendingRegistration(
  email: string,
  hashedPassword: string,
  name: string | null,
): Promise<void> {
  // Opportunistic housekeeping, on a path that already writes a token row.
  await maybePruneExpiredAuthRows();

  const token = generateToken();

  await prisma.pendingRegistration.create({
    data: {
      email,
      password: hashedPassword,
      name,
      // Only the digest is stored; the raw token lives solely in the email.
      tokenHash: hashToken(token),
      expiresAt: tokenExpiry(REGISTRATION_TTL_MS),
    },
  });

  const locale = await getLocale();
  const { subject, html, text } = renderVerifyRegistrationEmail(
    locale,
    `${appUrl}/verify-email?token=${encodeURIComponent(token)}`,
  );

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Creates the account immediately and reports a taken address.
 *
 * Used only when email is not configured, because verify-first signup cannot
 * work without a way to deliver the link — the alternative would be a
 * deployment where nobody can register at all. This path leaks whether an
 * address is registered; the deployment fixes that by configuring email.
 */
export async function registerWithoutEmail(
  email: string,
  hashedPassword: string,
  name: string | null,
): Promise<RegisterResult> {
  console.warn(
    "[auth] Email is not configured, so registration is falling back to immediate account creation. This reveals whether an address is already registered. Set RESEND_API_KEY and EMAIL_FROM to enable verify-first signup.",
  );

  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    return { success: false, error: AUTH_ERROR.emailTaken };
  }

  try {
    await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });
  } catch (error) {
    // The check above is not atomic: the DB's unique index is the real guard.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: AUTH_ERROR.emailTaken };
    }
    return { success: false, error: AUTH_ERROR.generic };
  }

  return { success: true, pending: false };
}

export async function findPendingRegistration(tokenHash: string) {
  return prisma.pendingRegistration.findUnique({
    where: { tokenHash },
  });
}

interface ConfirmedRegistration {
  email: string;
  password: string;
  name: string | null;
}

/**
 * Creates the credential account a confirmed signup describes. Returns the
 * error code to report, or null — including when the address already has an
 * account.
 */
export async function createUserFromPendingRegistration(
  pending: ConfirmedRegistration,
): Promise<AuthErrorCode | null> {
  try {
    await prisma.user.create({
      data: {
        email: pending.email,
        // Already bcrypt-hashed at submit time, so confirmation never has to
        // ask for the password again.
        password: pending.password,
        name: pending.name,
        // Redeeming this link *is* the proof of address ownership.
        emailVerified: new Date(),
      },
    });
  } catch (error) {
    // The address was claimed between submit and confirmation — either by a
    // race, or because this link belongs to an attempt on an address that
    // already had an account. Either way the account exists and the holder of
    // this mailbox can sign in, so treat it as done rather than as an error.
    const isDuplicate =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

    if (!isDuplicate) {
      return AUTH_ERROR.generic;
    }
  }

  return null;
}

/**
 * Mints a fresh confirmation link for a live pending signup and emails it.
 * Does nothing when the address has no live pending signup.
 */
export async function reissueConfirmationLink(email: string): Promise<void> {
  const pending = await prisma.pendingRegistration.findFirst({
    where: { email, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (pending) {
    const token = generateToken();

    // Rotate the token rather than adding a row: the old link dies here, so
    // only ever one confirmation link is live per address.
    await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        tokenHash: hashToken(token),
        expiresAt: tokenExpiry(REGISTRATION_TTL_MS),
      },
    });

    const locale = await getLocale();
    const { subject, html, text } = renderVerifyRegistrationEmail(
      locale,
      `${appUrl}/verify-email?token=${encodeURIComponent(token)}`,
    );

    await sendEmail({ to: email, subject, html, text });
  }
}
