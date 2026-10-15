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

// docs/specs/map-and-search.md (MAP-18, amended 2026-10-14, ENTRY —
// redesign-entry.md, owner decision): «SEAT León», «SEAT Leon», «Seat Leon»
// and «seaT LeON» must all match the same model, so the post-filter folds
// case and accents on both sides of the comparison.
describe("applyResultFilters — model, case- and accent-insensitive (MAP-18)", () => {
  it("MAP-18: model «León» keeps listings named «Leon», «LEON» or «SEAT León FR» in the title, and drops «Ibiza»", () => {
    const leon = makeFavoriteInput({ id: "leon", model: "Leon", title: "Seat Leon 1.6" });
    const leonUpper = makeFavoriteInput({ id: "leon-upper", model: "LEON", title: "Seat LEON FR" });
    const leonTitleOnly = makeFavoriteInput({ id: "leon-title", model: "", title: "SEAT León FR" });
    const leonLower = makeFavoriteInput({ id: "leon-lower", model: "león", title: "Seat león" });
    const ibiza = makeFavoriteInput({ id: "ibiza", model: "Ibiza", title: "Seat Ibiza 1.2" });
    const listings = [leon, leonUpper, leonTitleOnly, leonLower, ibiza];

    expect(ids(applyResultFilters(listings, { model: "León" }))).toEqual([
      "leon",
      "leon-upper",
      "leon-title",
      "leon-lower",
    ]);
  });

  it("MAP-18: model «Serie 3» keeps a listing modelled «serie 3» without any accent involved", () => {
    const serie3 = makeFavoriteInput({ id: "serie3", model: "serie 3", title: "BMW serie 3" });
    expect(ids(applyResultFilters([serie3], { model: "Serie 3" }))).toEqual(["serie3"]);
  });
});
