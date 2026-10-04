import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "./proxy";

// BAUTH-5 (docs/specs/core-better-auth.md), harness change: proxy.ts now
// decides from the Better Auth session cookie's mere presence
// (`getSessionCookie`), not from decoding a NextAuth JWT, so there is no
// `getToken` left to mock. `signedIn()`/`signedOut()` instead toggle whether
// that cookie rides along on every `request()`/`requestWithHeaders()` call
// below, so the existing cases keep exercising the same routing decisions
// through the new mechanism. The redirect/no-redirect assertions themselves
// are unchanged.
let sessionCookiePresent = false;

function withSessionCookie(headers: Record<string, string> = {}): Record<string, string> {
  if (!sessionCookiePresent) return headers;
  const existing = headers.cookie ? `${headers.cookie}; ` : "";
  return { ...headers, cookie: `${existing}better-auth.session_token=abc123` };
}

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers: withSessionCookie(),
  });
}

function requestWithHeaders(pathname: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers: withSessionCookie(headers),
  });
}

function signedIn() {
  sessionCookiePresent = true;
}

function signedOut() {
  sessionCookiePresent = false;
}

describe("proxy protected routes", () => {
  beforeEach(() => {
    sessionCookiePresent = false;
  });

  it("sends an anonymous visitor to sign in", async () => {
    signedOut();

    const response = await proxy(request("/account"));
    const location = new URL(response.headers.get("location") as string);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
  });

  it("carries the requested path so sign-in can return them there", async () => {
    signedOut();

    const response = await proxy(request("/account"));
    const location = new URL(response.headers.get("location") as string);

    expect(location.searchParams.get("callbackUrl")).toBe("/account");
  });

  it("guards nested paths under a protected prefix", async () => {
    // A prefix check that only matched exactly would leave every sub-route open.
    signedOut();

    const response = await proxy(request("/account/security"));

    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
  });

  it("does not guard a route that merely starts with the same characters", async () => {
    // "/accounts-help" is not under "/account" — matching on raw string prefix
    // would wrongly gate it.
    signedOut();

    expect(await proxy(request("/accounts-help"))).toMatchObject({
      status: 200,
    });
    expect((await proxy(request("/accounts-help"))).headers.get("location")).toBeNull();
  });

  it("lets a signed-in user through", async () => {
    signedIn();

    expect((await proxy(request("/account"))).headers.get("location")).toBeNull();
  });
});

describe("proxy guest-only routes", () => {
  beforeEach(() => {
    sessionCookiePresent = false;
  });

  it("redirects a signed-in user away from the sign-in page", async () => {
    signedIn();

    const response = await proxy(request("/login"));

    expect(new URL(response.headers.get("location") as string).pathname).toBe("/");
  });

  it("leaves the sign-in page reachable while signed out", async () => {
    signedOut();

    expect((await proxy(request("/login"))).headers.get("location")).toBeNull();
  });

  it("keeps /reset-password reachable while signed in", async () => {
    // Someone signed in on this device can still be following a reset link from
    // their inbox; bouncing them home would strand the reset.
    signedIn();

    expect((await proxy(request("/reset-password"))).headers.get("location")).toBeNull();
  });

  it("keeps the emailed confirmation pages reachable while signed in", async () => {
    signedIn();

    for (const path of ["/verify-email", "/confirm-email"]) {
      expect((await proxy(request(path))).headers.get("location")).toBeNull();
    }
  });
});

describe("proxy favorites route", () => {
  beforeEach(() => {
    sessionCookiePresent = false;
  });

  it("FAV-15: sends an anonymous visitor from favorites to sign in", async () => {
    signedOut();

    const response = await proxy(request("/favorites"));

    // Asserted before parsing the header: an unguarded route returns 200 with
    // no location, and `new URL(null)` would report that as "Invalid URL".
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
  });

  it("FAV-15: carries the favorites path so sign-in returns them there", async () => {
    signedOut();

    const response = await proxy(request("/favorites"));

    expect(response.status).toBe(307);
    expect(
      new URL(response.headers.get("location") as string).searchParams.get("callbackUrl"),
    ).toBe("/favorites");
  });

  it("FAV-15: lets a signed-in user through", async () => {
    signedIn();

    expect((await proxy(request("/favorites"))).headers.get("location")).toBeNull();
  });

  it("FAV-15: the matcher covers favorites, or the guard never runs", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/favorites" })).toBe(
      true,
    );
    expect(
      unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/favorites/abc" }),
    ).toBe(true);
  });
});

describe("proxy BAUTH-5 (docs/specs/core-better-auth.md): Better Auth session cookie presence", () => {
  beforeEach(() => {
    sessionCookiePresent = false;
  });

  function requestWithCookie(pathname: string, cookie?: string): NextRequest {
    return new NextRequest(new URL(pathname, "http://localhost:3000"), {
      headers: cookie ? { cookie } : undefined,
    });
  }

  // proxy.ts decides from a presence check on the Better Auth cookie via
  // `getSessionCookie` (`better-auth/cookies`). `signedOut()` only resets
  // this file's own `sessionCookiePresent` flag, which `requestWithCookie`
  // below ignores in favour of the literal cookie header it is given.
  it("BAUTH-5: does not redirect /favorites when the Better Auth session cookie is present", async () => {
    signedOut();

    const response = await proxy(
      requestWithCookie("/favorites", "better-auth.session_token=abc123"),
    );

    expect(response.headers.get("location")).toBeNull();
  });

  it("BAUTH-5: redirects /favorites to /login when the Better Auth session cookie is absent", async () => {
    signedOut();

    const response = await proxy(requestWithCookie("/favorites"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
  });
});

describe("proxy alerts route", () => {
  beforeEach(() => {
    sessionCookiePresent = false;
  });

  it("ALERT-30: sends an anonymous visitor from alerts to sign in", async () => {
    signedOut();

    const response = await proxy(request("/alerts"));

    // Asserted before parsing the header: an unguarded route returns 200 with
    // no location, and `new URL(null)` would report that as "Invalid URL".
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
  });

  it("ALERT-30: carries the alerts path so sign-in returns them there", async () => {
    signedOut();

    const response = await proxy(request("/alerts"));

    expect(response.status).toBe(307);
    expect(
      new URL(response.headers.get("location") as string).searchParams.get("callbackUrl"),
    ).toBe("/alerts");
  });

  it("ALERT-30: guards a single alert's matches page too", async () => {
    signedOut();

    const response = await proxy(request("/alerts/alert-1"));

    expect(response.status).toBe(307);
    expect(
      new URL(response.headers.get("location") as string).searchParams.get("callbackUrl"),
    ).toBe("/alerts/alert-1");
  });

  it("ALERT-30: lets a signed-in user through", async () => {
    signedIn();

    expect((await proxy(request("/alerts"))).headers.get("location")).toBeNull();
  });

  it("ALERT-30: leaves the emailed unsubscribe endpoint unguarded", async () => {
    // It is followed from an inbox with no session; gating it would make every
    // unsubscribe link land on the sign-in page.
    signedOut();

    expect(config.matcher.some((pattern) => pattern.startsWith("/api/alerts"))).toBe(false);
  });

  it("ALERT-30: the matcher covers alerts, or the guard never runs", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/alerts" })).toBe(
      true,
    );
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/alerts/abc" })).toBe(
      true,
    );
  });
});

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("proxy correlation id (PLAT-17)", () => {
  beforeEach(() => {
    signedOut();
  });

  it("PLAT-17: keeps a valid incoming x-request-id on the response", async () => {
    const incoming = "0f8f2b1e-6a3c-4c1e-9d7a-2b5e8f1c3a4d";

    const response = await proxy(requestWithHeaders("/", { "x-request-id": incoming }));

    expect(response.headers.get("x-request-id")).toBe(incoming);
  });

  it("PLAT-17: replaces a non-UUID x-request-id with a newly generated UUID", async () => {
    const response = await proxy(requestWithHeaders("/", { "x-request-id": "hello" }));

    const id = response.headers.get("x-request-id");
    expect(id).not.toBe("hello");
    expect(id).toMatch(UUID_V4);
  });

  it("PLAT-17: generates a UUID when no x-request-id is sent", async () => {
    const response = await proxy(request("/"));

    expect(response.headers.get("x-request-id")).toMatch(UUID_V4);
  });

  it("PLAT-17: forwards the id to the app as a request header", async () => {
    const incoming = "0f8f2b1e-6a3c-4c1e-9d7a-2b5e8f1c3a4d";

    const response = await proxy(requestWithHeaders("/", { "x-request-id": incoming }));

    // Next encodes an overridden *request* header this way on the response
    // returned by NextResponse.next({ request: { headers } }).
    expect(response.headers.get("x-middleware-request-x-request-id")).toBe(incoming);
  });
});

describe("proxy Content-Security-Policy (PLAT-21)", () => {
  beforeEach(() => {
    signedOut();
    vi.unstubAllEnvs();
  });

  it("PLAT-21: sends a Content-Security-Policy header on a page response", async () => {
    const response = await proxy(request("/"));

    expect(response.headers.get("content-security-policy")).not.toBeNull();
  });

  it("PLAT-21: production script-src has no 'unsafe-inline' and carries a >=128-bit nonce with 'strict-dynamic'", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await proxy(request("/"));
    const csp = response.headers.get("content-security-policy") ?? "";
    const scriptSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"));

    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).toContain("'strict-dynamic'");

    const nonce = scriptSrc?.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeDefined();
    expect(Buffer.from(nonce ?? "", "base64").length).toBeGreaterThanOrEqual(16);
  });

  it("PLAT-21: development script-src carries 'unsafe-eval'", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await proxy(request("/"));
    const csp = response.headers.get("content-security-policy") ?? "";
    const scriptSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"));

    expect(scriptSrc).toContain("'unsafe-eval'");
  });

  it("PLAT-21: style-src keeps 'self' 'unsafe-inline'", async () => {
    const response = await proxy(request("/"));
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("PLAT-21: two requests get two different nonces", async () => {
    const first = await proxy(request("/"));
    const second = await proxy(request("/"));

    const nonceOf = (response: Response) =>
      (response.headers.get("content-security-policy") ?? "").match(/'nonce-([^']+)'/)?.[1];

    expect(nonceOf(first)).toBeDefined();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });
});

describe("proxy matcher coverage (PLAT-22)", () => {
  it.each(["/", "/map", "/api/health", "/favorites"])("PLAT-22: matches %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${url}` })).toBe(true);
  });

  it.each(["/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/monitoring"])(
    "PLAT-22: skips %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${url}` })).toBe(
        false,
      );
    },
  );

  it("PLAT-22: / stays reachable with no token", async () => {
    signedOut();

    const response = await proxy(request("/"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("PLAT-22: /favorites still redirects to /login with no token", async () => {
    signedOut();

    const response = await proxy(request("/favorites"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
  });
});
