import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { JWT } from "next-auth/jwt";

// getToken is the dependency — it reads and verifies the cookie. What this file
// exercises is the routing decision taken once that answer is known.
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { getToken } from "next-auth/jwt";
import { config, proxy } from "./proxy";

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
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

    expect(new URL(response.headers.get("location") as string).pathname).toBe(
      "/login",
    );
  });

  it("does not guard a route that merely starts with the same characters", async () => {
    // "/accounts-help" is not under "/account" — matching on raw string prefix
    // would wrongly gate it.
    signedOut();

    expect(await proxy(request("/accounts-help"))).toMatchObject({
      status: 200,
    });
    expect(
      (await proxy(request("/accounts-help"))).headers.get("location"),
    ).toBeNull();
  });

  it("lets a signed-in user through", async () => {
    signedIn();

    expect(
      (await proxy(request("/account"))).headers.get("location"),
    ).toBeNull();
  });
});

describe("proxy guest-only routes", () => {
  beforeEach(() => vi.mocked(getToken).mockReset());

  it("redirects a signed-in user away from the sign-in page", async () => {
    signedIn();

    const response = await proxy(request("/login"));

    expect(new URL(response.headers.get("location") as string).pathname).toBe(
      "/",
    );
  });

  it("leaves the sign-in page reachable while signed out", async () => {
    signedOut();

    expect((await proxy(request("/login"))).headers.get("location")).toBeNull();
  });

  it("keeps /reset-password reachable while signed in", async () => {
    // Someone signed in on this device can still be following a reset link from
    // their inbox; bouncing them home would strand the reset.
    signedIn();

    expect(
      (await proxy(request("/reset-password"))).headers.get("location"),
    ).toBeNull();
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
    expect(new URL(response.headers.get("location") as string).pathname).toBe(
      "/login",
    );
  });

  it("FAV-15: carries the favorites path so sign-in returns them there", async () => {
    signedOut();

    const response = await proxy(request("/favorites"));

    expect(response.status).toBe(307);
    expect(
      new URL(
        response.headers.get("location") as string,
      ).searchParams.get("callbackUrl"),
    ).toBe("/favorites");
  });

  it("FAV-15: lets a signed-in user through", async () => {
    signedIn();

    expect(
      (await proxy(request("/favorites"))).headers.get("location"),
    ).toBeNull();
  });

  it("FAV-15: the matcher covers favorites, or the guard never runs", () => {
    expect(
      config.matcher.some((pattern) => pattern.startsWith("/favorites")),
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
    expect(new URL(response.headers.get("location") as string).pathname).toBe(
      "/login",
    );
  });

  it("ALERT-30: carries the alerts path so sign-in returns them there", async () => {
    signedOut();

    const response = await proxy(request("/alerts"));

    expect(response.status).toBe(307);
    expect(
      new URL(
        response.headers.get("location") as string,
      ).searchParams.get("callbackUrl"),
    ).toBe("/alerts");
  });

  it("ALERT-30: guards a single alert's matches page too", async () => {
    signedOut();

    const response = await proxy(request("/alerts/alert-1"));

    expect(response.status).toBe(307);
    expect(
      new URL(
        response.headers.get("location") as string,
      ).searchParams.get("callbackUrl"),
    ).toBe("/alerts/alert-1");
  });

  it("ALERT-30: lets a signed-in user through", async () => {
    signedIn();

    expect(
      (await proxy(request("/alerts"))).headers.get("location"),
    ).toBeNull();
  });

  it("ALERT-30: leaves the emailed unsubscribe endpoint unguarded", async () => {
    // It is followed from an inbox with no session; gating it would make every
    // unsubscribe link land on the sign-in page.
    signedOut();

    expect(
      config.matcher.some((pattern) => pattern.startsWith("/api/alerts")),
    ).toBe(false);
  });

  it("ALERT-30: the matcher covers alerts, or the guard never runs", () => {
    expect(
      config.matcher.some((pattern) => pattern.startsWith("/alerts")),
    ).toBe(true);
  });
});

describe("proxy matcher", () => {
  it("runs on exactly the paths the handler makes decisions about", () => {
    // A path the handler gates but the matcher omits is an unguarded route;
    // the two lists have to be kept in step by hand.
    expect(config.matcher).toEqual([
      "/account/:path*",
      "/favorites/:path*",
      "/alerts/:path*",
      "/login",
      "/register",
      "/forgot-password",
    ]);
  });
});
