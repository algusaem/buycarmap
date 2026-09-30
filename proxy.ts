import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { env, isDevelopmentRuntime } from "@/lib/env";

// Next 16 renamed the `middleware` file convention to `proxy`; the exported
// function must match the filename. Behaviour is unchanged.

// Routes that require a signed-in user.
// `/api/alerts/*` is deliberately absent: the unsubscribe link is followed from
// an inbox with no session, and gating it would land every one on /login.
const PROTECTED_PREFIXES = ["/account", "/favorites", "/alerts"];

// Routes that make no sense once signed in.
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

// lib/env.ts is Edge-safe (no dotenv, no node: imports), so the proxy reads
// its configuration through it rather than the raw environment directly
// (PLAT-5, docs/specs/core-platform.md).
const secureCookie = (env.APP_URL ?? env.NEXTAUTH_URL ?? "").startsWith("https://");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The correlation id for this request (PLAT-17, docs/specs/core-platform.md):
 * a valid incoming `x-request-id` is kept so a caller's own trace carries
 * through; anything else — missing, or not a UUID — is replaced, so a client
 * cannot inject arbitrary text into the logs.
 */
function requestIdFor(request: NextRequest): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && UUID_RE.test(incoming) ? incoming : crypto.randomUUID();
}

function generateNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/**
 * The Content-Security-Policy for this response (PLAT-21). `script-src` needs
 * a fresh nonce per request, which forces every page to render dynamically —
 * see docs/decisions/0013-platform-runtime.md — so this replaces the static
 * header next.config.ts used to send (PLAT-24). Every other directive keeps
 * its value from before that move.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
    "font-src 'self' data:",
    "connect-src 'self' https://nominatim.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// Note: `/reset-password` is deliberately absent from GUEST_ONLY_PATHS — a
// signed-in user who clicked a reset link from their inbox should still be able
// to complete it.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestId = requestIdFor(request);
  const nonce = generateNonce();
  const csp = buildCsp(nonce, isDevelopmentRuntime());

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-request-id", requestId);
  forwardedHeaders.set("x-nonce", nonce);
  forwardedHeaders.set("content-security-policy", csp);

  function withResponseHeaders(response: NextResponse): NextResponse {
    response.headers.set("x-request-id", requestId);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  // This only decodes and verifies the JWT signature; it does not run the
  // `jwt` callback, so it cannot see revocations. That is fine for a redirect —
  // every server action independently re-checks via `getCurrentUser()`, which
  // does honour revocation. This layer is UX, not authorization.
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET,
    secureCookie,
  });

  if (isProtected(pathname) && !token) {
    const loginUrl = new URL("/login", request.url);
    // Preserve where they were headed so sign-in can return them there.
    // Only the path is carried over, never the full URL, and the sign-in form
    // re-validates it, so this cannot become an open redirect.
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withResponseHeaders(NextResponse.redirect(loginUrl));
  }

  if (GUEST_ONLY_PATHS.includes(pathname) && token) {
    return withResponseHeaders(NextResponse.redirect(new URL("/", request.url)));
  }

  return withResponseHeaders(NextResponse.next({ request: { headers: forwardedHeaders } }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
