import { describe, expect, it } from "vitest";
import { ES_COPY } from "@/test/utils/copy";
import { phoneSummary } from "./phone-summary";

// docs/specs/redesign-map.md (MAPUI-20). The expected prices carry the
// no-break space Intl writes between the amount and the euro sign.
const MADRID = { placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 };

describe("MAPUI-20: phoneSummary", () => {
  it("MAPUI-20: Madrid at 50 km with a maximum of 20.000 € reads «Madrid · 50 km» over «Cualquier marca · hasta 20.000 €»", () => {
    expect(phoneSummary({ maxPrice: 20000 }, MADRID, 50, ES_COPY)).toEqual({
      placeSummary: "Madrid · 50 km",
      carPriceSummary: "Cualquier marca · hasta 20.000\u00a0€",
    });
  });

  it("MAPUI-20: with no place the first line reads «Toda España»", () => {
    expect(phoneSummary({ maxPrice: 20000 }, null, 50, ES_COPY).placeSummary).toBe("Toda España");
  });

  it("MAPUI-20: with nothing chosen the second line reads «Cualquier marca · Cualquier precio»", () => {
    expect(phoneSummary({}, null, 50, ES_COPY).carPriceSummary).toBe(
      "Cualquier marca · Cualquier precio",
    );
  });
});

// docs/specs/map-description-search.md (DESC-18): the text shows in «…»
// after the car and before the price.
describe("DESC-18: phoneSummary shows the description text in «…» after the car", () => {
  it("DESC-18: BMW, maximum 20.000 €, text e46 reads «BMW · «e46» · hasta 20.000 €»", () => {
    expect(
      phoneSummary({ brand: "BMW", maxPrice: 20000, keywords: "e46" }, null, 50, ES_COPY)
        .carPriceSummary,
    ).toBe("BMW · «e46» · hasta 20.000 €");
  });

  it("DESC-18: with no brand, reads «Cualquier marca · «e46» · hasta 20.000 €»", () => {
    expect(
      phoneSummary({ maxPrice: 20000, keywords: "e46" }, null, 50, ES_COPY).carPriceSummary,
    ).toBe("Cualquier marca · «e46» · hasta 20.000 €");
  });
});
