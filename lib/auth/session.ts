import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

/**
 * The signed-in user, or null.
 *
 * Every server action that touches user data must call this rather than trust
 * middleware: middleware only decodes the JWT, while `getServerSession` runs
 * the `jwt` callback and therefore honours revocation (deleted account, changed
 * password). Middleware is a redirect for humans, not an authorization check.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
