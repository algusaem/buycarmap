import { describe, expect, it } from "vitest";
import { extractInitialProps } from "./parse";
import {
  makeMilanunciosAd,
  makeMilanunciosHtml,
  makeMilanunciosResponse,
} from "@/test/fixtures/milanuncios";

describe("extractInitialProps", () => {
  it("extracts ads and pagination from the embedded __INITIAL_PROPS__", () => {
    const response = makeMilanunciosResponse(
      [makeMilanunciosAd({ id: "1" }), makeMilanunciosAd({ id: "2" })],
      7,
    );
    const result = extractInitialProps(makeMilanunciosHtml(response));

    expect(result.ads.map((a) => a.id)).toEqual(["1", "2"]);
    expect(result.pagination.totalPages).toBe(7);
  });

  it("survives escaped quotes inside the embedded JSON", () => {
    // A title with a double quote must round-trip through the double-decode.
    const html = makeMilanunciosHtml(
      makeMilanunciosResponse([
        makeMilanunciosAd({ title: 'BMW 320d "M Sport"' }),
      ]),
    );
    expect(extractInitialProps(html).ads[0].title).toBe('BMW 320d "M Sport"');
  });

  it("returns an empty result when the marker is absent", () => {
    const result = extractInitialProps("<html><body>no props here</body></html>");
    expect(result.ads).toEqual([]);
    expect(result.pagination.totalPages).toBe(0);
  });

  it("returns an empty result when the embedded JSON is malformed", () => {
    const html = `<script>window.__INITIAL_PROPS__ = JSON.parse("{not valid")</script>`;
    expect(extractInitialProps(html).ads).toEqual([]);
  });
});
