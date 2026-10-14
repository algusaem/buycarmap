import { describe, expect, it } from "vitest";
import { EN_COPY, ES_COPY } from "@/test/utils/copy";
import { resultsHeading } from "./results-heading";

// docs/specs/redesign-map.md (MAPUI-33, worked example under "Results
// heading"). One test per row of the table.

describe("MAPUI-33: resultsHeading", () => {
  it("MAPUI-33: the first page loading reads BUSCANDO COCHES…", () => {
    expect(resultsHeading({ status: "loading", count: 0, hasMore: false }, ES_COPY)).toBe(
      "BUSCANDO COCHES…",
    );
  });

  it("MAPUI-33: a failed search reads COCHES, with no count", () => {
    expect(resultsHeading({ status: "error", count: 0, hasMore: false }, ES_COPY)).toBe("COCHES");
  });

  it("MAPUI-33: sources exhausted with no cars reads NINGÚN COCHE", () => {
    expect(resultsHeading({ status: "ready", count: 0, hasMore: false }, ES_COPY)).toBe(
      "NINGÚN COCHE",
    );
  });

  it("MAPUI-33: exhausted with 1 car reads 1 COCHE (singular)", () => {
    expect(resultsHeading({ status: "ready", count: 1, hasMore: false }, ES_COPY)).toBe("1 COCHE");
  });

  it("MAPUI-33: exhausted with 24 cars reads 24 COCHES (plural)", () => {
    expect(resultsHeading({ status: "ready", count: 24, hasMore: false }, ES_COPY)).toBe(
      "24 COCHES",
    );
  });

  it("MAPUI-33: 40 cars listed with more pages left reads MÁS DE 40 COCHES", () => {
    expect(resultsHeading({ status: "ready", count: 40, hasMore: true }, ES_COPY)).toBe(
      "MÁS DE 40 COCHES",
    );
  });

  it("MAPUI-33: a ready heading with no more pages never carries the 'MÁS DE' prefix", () => {
    // Distinguishes hasMore from count: 40 results with nothing left to page
    // through reads the exact count, not "MÁS DE 40".
    expect(resultsHeading({ status: "ready", count: 40, hasMore: false }, ES_COPY)).toBe(
      "40 COCHES",
    );
  });
});

describe("MAPUI-33: resultsHeading — one car with more pages left", () => {
  it("MAPUI-33: 1 car listed with more pages left reads MÁS DE 1 COCHE (singular)", () => {
    expect(resultsHeading({ status: "ready", count: 1, hasMore: true }, ES_COPY)).toBe(
      "MÁS DE 1 COCHE",
    );
  });

  it("MAPUI-33: in English, MORE THAN 1 CAR and MORE THAN 40 CARS", () => {
    expect(resultsHeading({ status: "ready", count: 1, hasMore: true }, EN_COPY)).toBe(
      "MORE THAN 1 CAR",
    );
    expect(resultsHeading({ status: "ready", count: 40, hasMore: true }, EN_COPY)).toBe(
      "MORE THAN 40 CARS",
    );
  });
});
