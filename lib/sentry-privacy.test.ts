import { describe, expect, it } from "vitest";
import { beforeBreadcrumb, beforeSend, withoutQuery } from "./sentry-privacy";

// docs/specs/map-description-search.md (DESC-32): a browser Sentry event or
// breadcrumb must never carry the typed description text through a query
// string embedded in a URL.

describe("DESC-32: withoutQuery", () => {
  it("DESC-32: strips the query and fragment from an absolute URL", () => {
    expect(withoutQuery("https://buycarmap.test/map?q=e46&lat=40.4")).toBe(
      "https://buycarmap.test/map",
    );
  });

  it("DESC-32: strips the query from a relative URL", () => {
    expect(withoutQuery("/map?q=e46")).toBe("/map");
  });

  it("DESC-32: leaves a URL with no query untouched", () => {
    expect(withoutQuery("/map")).toBe("/map");
  });

  it("DESC-32: returns an empty string unchanged", () => {
    expect(withoutQuery("")).toBe("");
  });

  it("DESC-32: strips the query and the fragment that follows it", () => {
    expect(withoutQuery("/map?q=e46#top")).toBe("/map");
  });

  it("DESC-32: strips a fragment with no query", () => {
    expect(withoutQuery("/map#top")).toBe("/map");
  });
});

describe("DESC-32: beforeSend strips the event's own request URL and Next.js request path", () => {
  it("DESC-32: strips the query from event.request.url", () => {
    const event = { request: { url: "https://buycarmap.test/map?q=e46" } };

    expect(beforeSend(event)).toEqual({ request: { url: "https://buycarmap.test/map" } });
  });

  it("DESC-32: strips the query from contexts.nextjs.request_path on a server event", () => {
    const event = { contexts: { nextjs: { request_path: "/map?q=e46" } } };

    expect(beforeSend(event)).toEqual({ contexts: { nextjs: { request_path: "/map" } } });
  });

  it("DESC-32: leaves an event with no request and no Next.js context untouched", () => {
    const event = {};

    expect(beforeSend(event)).toEqual({});
  });

  it("DESC-32: strips the query from an exception stack frame's filename and abs_path", () => {
    const event = {
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  filename: "https://buycarmap.test/map?q=e46&lat=40.4",
                  abs_path: "https://buycarmap.test/map?q=e46",
                },
              ],
            },
          },
        ],
      },
    };

    expect(beforeSend(event)).toEqual({
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  filename: "https://buycarmap.test/map",
                  abs_path: "https://buycarmap.test/map",
                },
              ],
            },
          },
        ],
      },
    });
  });

  it("DESC-32: leaves an exception value with no stacktrace untouched", () => {
    const event = { exception: { values: [{}] } };

    expect(beforeSend(event)).toEqual({ exception: { values: [{}] } });
  });
});

describe("DESC-32: beforeBreadcrumb strips from/to on navigation and url on fetch/xhr", () => {
  it("DESC-32: a navigation breadcrumb from /map?q=e46 to /map?q=gti strips both to /map", () => {
    const breadcrumb = {
      category: "navigation",
      data: { from: "/map?q=e46", to: "/map?q=gti" },
    };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({
      category: "navigation",
      data: { from: "/map", to: "/map" },
    });
  });

  it("DESC-32: a fetch breadcrumb's url is stripped", () => {
    const breadcrumb = {
      category: "fetch",
      data: { url: "https://buycarmap.test/map?q=e46" },
    };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({
      category: "fetch",
      data: { url: "https://buycarmap.test/map" },
    });
  });

  it("DESC-32: an xhr breadcrumb's url is stripped", () => {
    const breadcrumb = {
      category: "xhr",
      data: { url: "https://buycarmap.test/map?q=e46" },
    };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({
      category: "xhr",
      data: { url: "https://buycarmap.test/map" },
    });
  });

  it("DESC-32: a breadcrumb of another category is left untouched", () => {
    const breadcrumb = { category: "ui.click", data: { url: "https://buycarmap.test/map?q=e46" } };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({
      category: "ui.click",
      data: { url: "https://buycarmap.test/map?q=e46" },
    });
  });

  it("DESC-32: a breadcrumb with no data is left untouched", () => {
    const breadcrumb = { category: "navigation" };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({ category: "navigation" });
  });

  it("DESC-32: a console breadcrumb's message loses its query string and its arguments are dropped", () => {
    const breadcrumb = {
      category: "console",
      message: "Failed to fetch RSC payload for /map?q=e46.",
      data: { arguments: [new Error("boom")], extra: 1 },
    };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({
      category: "console",
      message: "Failed to fetch RSC payload for /map.",
      data: { extra: 1 },
    });
  });

  it("DESC-32: a console breadcrumb with no message is left with its arguments dropped", () => {
    const breadcrumb = { category: "console", data: { arguments: ["x"] } };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({ category: "console", data: {} });
  });

  it("DESC-32: a dot inside the query is part of the query, not the sentence's closing mark", () => {
    const breadcrumb = {
      category: "console",
      message: "Failed to fetch RSC payload for /map?lat=40.4168&lng=-3.7038&q=e46.",
    };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({
      category: "console",
      message: "Failed to fetch RSC payload for /map.",
    });
  });

  it("DESC-32: a dot inside the query leaves the sentence's own closing mark after it untouched", () => {
    const breadcrumb = {
      category: "console",
      message:
        "Failed to fetch RSC payload for /map?q=2.0+tdi. Falling back to browser navigation.",
    };

    expect(beforeBreadcrumb(breadcrumb)).toEqual({
      category: "console",
      message: "Failed to fetch RSC payload for /map. Falling back to browser navigation.",
    });
  });
});
