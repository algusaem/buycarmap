import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { checkPasswordBreached } from "./pwned";

// SHA-1 of "password", the canonical example from HIBP's own documentation.
// Hand-written rather than computed here, so the test would catch the module
// hashing something other than the raw password.
const PASSWORD_SHA1 = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";
const PASSWORD_PREFIX = "5BAA6";
const PASSWORD_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

describe("checkPasswordBreached k-anonymity", () => {
  it("sends only the first five hash characters, never the password or full hash", async () => {
    let requestedUrl = "";

    server.use(
      http.get("https://api.pwnedpasswords.com/range/:prefix", ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.text("");
      }),
    );

    await checkPasswordBreached("password");

    expect(requestedUrl).toBe(`https://api.pwnedpasswords.com/range/${PASSWORD_PREFIX}`);

    // Assert on the path, not the whole URL: the host "pwnedpasswords.com"
    // contains the literal "password" and would make a naive check pass here
    // for the wrong reason. The privacy guarantee of the range API rests on
    // exactly what does and does not appear after the host.
    const { pathname, search } = new URL(requestedUrl);
    expect(pathname + search).toBe(`/range/${PASSWORD_PREFIX}`);
    expect(pathname + search).not.toContain("password");
    expect(pathname + search).not.toContain(PASSWORD_SUFFIX);
    expect(pathname + search).not.toContain(PASSWORD_SHA1);
  });

  it("requests padded responses so response size leaks nothing", async () => {
    let padding: string | null = null;

    server.use(
      http.get("https://api.pwnedpasswords.com/range/*", ({ request }) => {
        padding = request.headers.get("Add-Padding");
        return HttpResponse.text("");
      }),
    );

    await checkPasswordBreached("password");

    expect(padding).toBe("true");
  });
});

describe("checkPasswordBreached matching", () => {
  it("reports a breach when the suffix appears in the range", async () => {
    server.use(
      http.get("https://api.pwnedpasswords.com/range/*", () =>
        HttpResponse.text(
          `0018A45C4D1DEF81644B54AB7F969B88D65:1\n${PASSWORD_SUFFIX}:19075998\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2`,
        ),
      ),
    );

    expect(await checkPasswordBreached("password")).toEqual({
      breached: true,
      occurrences: 19075998,
      checked: true,
    });
  });

  it("reports clean when the range holds only other suffixes", async () => {
    server.use(
      http.get("https://api.pwnedpasswords.com/range/*", () =>
        HttpResponse.text("0018A45C4D1DEF81644B54AB7F969B88D65:1"),
      ),
    );

    expect(await checkPasswordBreached("password")).toEqual({
      breached: false,
      occurrences: 0,
      checked: true,
    });
  });

  it("does not match on a partial suffix", async () => {
    // A prefix of our suffix must not count as a hit, or unrelated passwords
    // would be rejected.
    server.use(
      http.get("https://api.pwnedpasswords.com/range/*", () =>
        HttpResponse.text(`${PASSWORD_SUFFIX.slice(0, 20)}:5`),
      ),
    );

    expect((await checkPasswordBreached("password")).breached).toBe(false);
  });

  it("handles the CRLF line endings HIBP actually returns", async () => {
    server.use(
      http.get("https://api.pwnedpasswords.com/range/*", () =>
        HttpResponse.text(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${PASSWORD_SUFFIX}:42\r\n`),
      ),
    );

    expect(await checkPasswordBreached("password")).toEqual({
      breached: true,
      occurrences: 42,
      checked: true,
    });
  });
});

describe("checkPasswordBreached failure handling", () => {
  it("fails open when the API errors", async () => {
    server.use(
      http.get("https://api.pwnedpasswords.com/range/*", () =>
        HttpResponse.text("upstream on fire", { status: 500 }),
      ),
    );

    // `checked: false` is the signal that the answer is "unknown", not "safe".
    // Registration must not break because a third-party API is down.
    expect(await checkPasswordBreached("password")).toEqual({
      breached: false,
      occurrences: 0,
      checked: false,
    });
  });

  it("fails open when the request throws", async () => {
    server.use(http.get("https://api.pwnedpasswords.com/range/*", () => HttpResponse.error()));

    expect(await checkPasswordBreached("password")).toEqual({
      breached: false,
      occurrences: 0,
      checked: false,
    });
  });

  it("skips the request entirely for an empty password", async () => {
    let called = false;

    server.use(
      http.get("https://api.pwnedpasswords.com/range/*", () => {
        called = true;
        return HttpResponse.text("");
      }),
    );

    expect(await checkPasswordBreached("")).toEqual({
      breached: false,
      occurrences: 0,
      checked: false,
    });
    expect(called).toBe(false);
  });
});
