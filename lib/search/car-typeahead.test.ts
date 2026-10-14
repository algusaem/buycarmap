import { describe, expect, it } from "vitest";
import { BRANDS } from "@/components/map/search-filter-options";
import { matchNames } from "./car-typeahead";

// docs/specs/redesign-map.md (MAPUI-6, worked example under "Coche
// type-ahead"). `matchNames` is the local, no-network half of the "Marcas"
// group: every brand whose name, or a word of it, starts with the text,
// ignoring case and accents. It returns every match — the ">3 matches, no
// models" rule (edge case) is CarPopover's job, not this pure function's.

describe("MAPUI-6: matchNames — the worked example", () => {
  it('MAPUI-6: "Toy" lists Toyota', () => {
    expect(matchNames("Toy", BRANDS)).toEqual(["Toyota"]);
  });
});

describe("MAPUI-6: matchNames — case and accents", () => {
  it('MAPUI-6: lowercase "toyota" still matches Toyota', () => {
    expect(matchNames("toyota", BRANDS)).toEqual(["Toyota"]);
  });

  it('MAPUI-6: "citroen" (no diaeresis) matches Citroën', () => {
    expect(matchNames("citroen", BRANDS)).toEqual(["Citroën"]);
  });

  it('MAPUI-6: "CITRO" (uppercase, no diaeresis) still matches Citroën', () => {
    expect(matchNames("CITRO", BRANDS)).toEqual(["Citroën"]);
  });
});

describe("MAPUI-6: matchNames — matching a word, not only the start of the name", () => {
  it('MAPUI-6: "Benz" matches Mercedes-Benz by its second word', () => {
    expect(matchNames("Benz", BRANDS)).toEqual(["Mercedes-Benz"]);
  });

  it('MAPUI-6: "Rover" matches Land Rover by its second word', () => {
    expect(matchNames("Rover", BRANDS)).toEqual(["Land Rover"]);
  });
});

describe("MAPUI-6: matchNames — several matches and no matches", () => {
  it('MAPUI-6: "A" matches every brand starting with A (Alfa Romeo, Aston Martin, Audi)', () => {
    expect(matchNames("A", BRANDS)).toEqual(["Alfa Romeo", "Aston Martin", "Audi"]);
  });

  it("MAPUI-6: an empty query lists no brands", () => {
    expect(matchNames("", BRANDS)).toEqual([]);
  });

  it("MAPUI-6: a query only of spaces lists no brands", () => {
    expect(matchNames("   ", BRANDS)).toEqual([]);
  });

  it('MAPUI-6: "Corolla" lists no brands, since it matches no brand name or word', () => {
    expect(matchNames("Corolla", BRANDS)).toEqual([]);
  });
});

describe("MAPUI-7: matchNames — a brand's models in its brand step", () => {
  it('MAPUI-7: "cor" lists Corolla among Corolla, Yaris and C-HR', () => {
    expect(matchNames("cor", ["Corolla", "Yaris", "C-HR"])).toEqual(["Corolla"]);
  });

  it('MAPUI-7: "hr" lists C-HR, matching the word after the hyphen', () => {
    expect(matchNames("hr", ["Corolla", "Yaris", "C-HR"])).toEqual(["C-HR"]);
  });
});
