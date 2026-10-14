import { describe, expect, it } from "vitest";
import { makeFavoriteInput } from "@/test/fixtures/favorites";
import { applyResultFilters } from "./merge";

// docs/specs/redesign-map.md (MAPUI-55), worked example "Fuel": four
// listings, all 2019 with 71.000 km, with the fuels `gasoil`, `gasoline`,
// none and `vapor` (a token no group recognises). No place is chosen, so the
// radius post-filter leaves them all; only `fuel` and `id` vary.
const DIESEL = makeFavoriteInput({ id: "diesel", fuel: "gasoil", year: 2019, mileage: 71000 });
const PETROL = makeFavoriteInput({ id: "petrol", fuel: "gasoline", year: 2019, mileage: 71000 });
const NO_FUEL = makeFavoriteInput({ id: "none", fuel: "", year: 2019, mileage: 71000 });
const VAPOR = makeFavoriteInput({ id: "vapor", fuel: "vapor", year: 2019, mileage: 71000 });
const ALL = [DIESEL, PETROL, NO_FUEL, VAPOR];

const ids = (listings: { id: string }[]) => listings.map((listing) => listing.id);

describe("applyResultFilters — fuel (MAPUI-55)", () => {
  it("MAPUI-55: with no fuel criterion every listing stays", () => {
    expect(ids(applyResultFilters(ALL, {}))).toEqual(["diesel", "petrol", "none", "vapor"]);
    expect(ids(applyResultFilters(ALL, { engine: [] }))).toEqual([
      "diesel",
      "petrol",
      "none",
      "vapor",
    ]);
  });

  it("MAPUI-55: engine=gasoil keeps only the diesel, dropping the one with no fuel and the unrecognised one", () => {
    expect(ids(applyResultFilters(ALL, { engine: ["gasoil"] }))).toEqual(["diesel"]);
  });

  it("MAPUI-55: engine=hybride,hybride_plugin keeps none of the four", () => {
    expect(applyResultFilters(ALL, { engine: ["hybride", "hybride_plugin"] })).toEqual([]);
  });

  it("MAPUI-55: a source's Spanish fuel word counts as its group (coches.net «Diésel»)", () => {
    const cochesNet = makeFavoriteInput({ id: "cn-diesel", fuel: "Diésel" });
    expect(ids(applyResultFilters([cochesNet, PETROL], { engine: ["gasoil"] }))).toEqual([
      "cn-diesel",
    ]);
  });

  it("MAPUI-55: an engine value no group offers (engine=cng, MAPUI-18) chooses no group, so nothing is dropped", () => {
    // The source already filtered by it upstream; dropping every listing here
    // would also keep MAP-19's loop fetching until the sources ran out.
    expect(ids(applyResultFilters(ALL, { engine: ["cng"] }))).toEqual([
      "diesel",
      "petrol",
      "none",
      "vapor",
    ]);
  });

  it("MAPUI-55: a criterion holding a value no group offers (engine=gasoil,cng) applies no fuel post-filter", () => {
    // Owner decision 2026-10-13: the `cng` value cannot be confirmed here, so
    // the whole fuel post-filter is skipped and the sources' own filter
    // stands — the CNG listing and the diesel one both stay.
    const cng = makeFavoriteInput({ id: "cng", fuel: "Gas natural (CNG)" });
    const diesel = makeFavoriteInput({ id: "cn-diesel", fuel: "Diésel" });
    expect(ids(applyResultFilters([cng, diesel], { engine: ["gasoil", "cng"] }))).toEqual([
      "cng",
      "cn-diesel",
    ]);
  });

  it("MAPUI-55: two chosen groups keep the listings of either", () => {
    expect(ids(applyResultFilters(ALL, { engine: ["gasoline", "gasoil"] }))).toEqual([
      "diesel",
      "petrol",
    ]);
  });
});
