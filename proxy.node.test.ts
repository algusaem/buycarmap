import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import type { JWT } from "next-auth/jwt";

// getToken is the dependency — it reads and verifies the cookie. What this file
// exercises is the routing decision taken once that answer is known.
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { getToken } from "next-auth/jwt";
import { config, proxy } from "./proxy";

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

function requestWithHeaders(pathname: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), { headers });
}

function signedIn() {
  vi.mocked(getToken).mockResolvedValue({ id: "user-1" } as JWT);
}

function signedOut() {
  vi.mocked(getToken).mockResolvedValue(null);
}

describe("proxy protected routes", () => {
  beforeEach(() => vi.mocked(getToken).mockReset());

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
  beforeEach(() => vi.mocked(getToken).mockReset());

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
  beforeEach(() => vi.mocked(getToken).mockReset());

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

describe("proxy alerts route", () => {
  beforeEach(() => vi.mocked(getToken).mockReset());

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
