import { cookies } from "next/headers";
import { auth, SESSION_COOKIE_NAME } from "@/lib/auth/auth";
import { asSessionId, type SessionId } from "@/lib/ids";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

/**
 * The signed-in `{ user, session }`, or null. Reads the cookie through
 * `next/headers`'s `cookies()` rather than calling `auth.api.getSession`
 * with `headers: await headers()`: `headers()` throws outside a real
 * request scope (a script, or a NextAuth-only cookie from before the
 * cutover — BAUTH-15), and every caller here needs "no session" for that,
 * not a thrown error.
 */
async function getCurrentSession(): Promise<Awaited<ReturnType<typeof auth.api.getSession>>> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const headers = new Headers({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
    return await auth.api.getSession({ headers });
  } catch {
    return null;
  }
}

/**
 * The signed-in user, or null.
 *
 * Every server action that touches user data must call this rather than trust
 * middleware: `proxy.ts`'s `getSessionCookie` only checks for the cookie's
 * presence, while `auth.api.getSession` above actually looks the session row
 * up — which is what makes revocation (`signOutEverywhere`, a password
 * change or reset) take effect on the very next request (BAUTH-2).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/**
 * The signed-in session's own id, or null. BAUTH-2: changing a password
 * revokes every *other* session, not this device's own — the action needs
 * this id to exclude it from that delete.
 */
export async function getCurrentSessionId(): Promise<SessionId | null> {
  const session = await getCurrentSession();
  return session ? asSessionId(session.session.id) : null;
}
