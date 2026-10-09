import { describe, expect, it } from "vitest";
import { EMPTY_SEARCH_CURSORS, searchCursorsSchema } from "./schema";

describe("searchCursorsSchema", () => {
  it("MAP-24: defaults wallapopRequested to [] when a client omits it", () => {
    // A client built before this change, still open during a deploy, hands
    // back cursors with no wallapopRequested field at all — it must keep
    // validating (docs/specs/map-and-search.md › A repeated Wallapop cursor
    // ends Wallapop).
    const parsed = searchCursorsSchema.parse({ wallapop: "c1", cochesNet: 2, milanuncios: 0 });

    expect(parsed.wallapopRequested).toEqual([]);
  });

  it("MAP-24: EMPTY_SEARCH_CURSORS starts wallapopRequested at []", () => {
    expect(EMPTY_SEARCH_CURSORS.wallapopRequested).toEqual([]);
  });
});
