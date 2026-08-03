import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Next 16 renamed the `middleware` file convention to `proxy`; the exported
// function must match the filename. Behaviour is unchanged.

// Routes that require a signed-in user.
const PROTECTED_PREFIXES = ["/account", "/favorites"];

// Routes that make no sense once signed in.
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

// Read directly from process.env rather than lib/env.ts: this runs on the Edge
// runtime, where `dotenv` and Node built-ins are unavailable.
const secureCookie = (
  process.env.APP_URL ??
  process.env.NEXTAUTH_URL ??
  ""
).startsWith("https://");

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Note: `/reset-password` is deliberately absent from GUEST_ONLY_PATHS — a
// signed-in user who clicked a reset link from their inbox should still be able
// to complete it.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // This only decodes and verifies the JWT signature; it does not run the
  // `jwt` callback, so it cannot see revocations. That is fine for a redirect —
  // every server action independently re-checks via `getCurrentUser()`, which
  // does honour revocation. This layer is UX, not authorization.
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  });

  if (isProtected(pathname) && !token) {
    const loginUrl = new URL("/login", request.url);
    // Preserve where they were headed so sign-in can return them there.
    // Only the path is carried over, never the full URL, and the sign-in form
    // re-validates it, so this cannot become an open redirect.
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (GUEST_ONLY_PATHS.includes(pathname) && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/account/:path*",
    "/favorites/:path*",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
