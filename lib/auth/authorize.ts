import { prisma } from "@/lib/prisma";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/hash";

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

// Credentials-provider authorization, extracted from the NextAuth route so it
// can be unit-tested in isolation. Returns the user on success, null otherwise.
// Never throws and never reveals whether the email exists.
export async function authorizeCredentials(
  credentials: Record<"email" | "password", string> | undefined
): Promise<AuthorizedUser | null> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const email = credentials.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Equalize timing with the found-user path (see DUMMY_PASSWORD_HASH).
    await verifyPassword(credentials.password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const isValidPassword = await verifyPassword(
    credentials.password,
    user.password
  );

  if (!isValidPassword) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.avatarUrl,
  };
}
