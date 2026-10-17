import { describe, expect, it } from "vitest";
import {
  classifyFuel,
  FUEL_GROUPS,
  groupsFromEngine,
  isGroupedEngineValue,
  toEngineValues,
} from "./fuel-groups";

// docs/specs/redesign-map.md (MAPUI-15, worked examples under "Acceptance
// criteria"). The five fuel choices map onto the shared `engine` filter
// values one-to-one, except "Híbrido" which covers two values together.

describe("MAPUI-15: FUEL_GROUPS declares the five choices and their engine values", () => {
  it("MAPUI-15: Gasolina maps to gasoline", () => {
    const group = FUEL_GROUPS.find((entry) => entry.group === "gasoline");
    expect(group?.values).toEqual(["gasoline"]);
  });

  it("MAPUI-15: Diésel maps to gasoil", () => {
    const group = FUEL_GROUPS.find((entry) => entry.group === "gasoil");
    expect(group?.values).toEqual(["gasoil"]);
  });

  it("MAPUI-15: Híbrido maps to hybride and hybride_plugin together", () => {
    const group = FUEL_GROUPS.find((entry) => entry.group === "hybrid");
    expect(group?.values).toEqual(["hybride", "hybride_plugin"]);
  });

  it("MAPUI-15: Eléctrico maps to electric-hybrid", () => {
    const group = FUEL_GROUPS.find((entry) => entry.group === "electric");
    expect(group?.values).toEqual(["electric-hybrid"]);
  });

  it("MAPUI-15: GLP maps to lpg", () => {
    const group = FUEL_GROUPS.find((entry) => entry.group === "lpg");
    expect(group?.values).toEqual(["lpg"]);
  });

  it("MAPUI-15: declares exactly five groups, no more and no fewer", () => {
    expect(FUEL_GROUPS.map((entry) => entry.group).sort()).toEqual(
      ["electric", "gasoil", "gasoline", "hybrid", "lpg"].sort(),
    );
  });
});

describe("MAPUI-15: toEngineValues", () => {
  it("MAPUI-15: a single group maps to its one value", () => {
    expect(toEngineValues(["gasoil"])).toEqual(["gasoil"]);
  });

  it("MAPUI-15: hybrid expands to both hybrid engine values", () => {
    expect(toEngineValues(["hybrid"])).toEqual(["hybride", "hybride_plugin"]);
  });

  it("MAPUI-15: several groups concatenate their values", () => {
    expect(toEngineValues(["gasoline", "gasoil"]).sort()).toEqual(["gasoil", "gasoline"]);
  });

  it("MAPUI-15: no groups chosen gives no engine values", () => {
    expect(toEngineValues([])).toEqual([]);
  });
});

describe("MAPUI-15: groupsFromEngine", () => {
  it("MAPUI-15: engine=gasoil reads as Diésel chosen", () => {
    expect(groupsFromEngine(["gasoil"])).toEqual(["gasoil"]);
  });

  it("MAPUI-15: either hybrid value alone reads Híbrido as chosen (edge case)", () => {
    // docs/specs/redesign-map.md › Edge cases: "engine=hybride_plugin alone
    // reads «Híbrido» chosen."
    expect(groupsFromEngine(["hybride_plugin"])).toEqual(["hybrid"]);
  });

  it("MAPUI-15: both hybrid values together still read as one Híbrido group, not two", () => {
    expect(groupsFromEngine(["hybride", "hybride_plugin"])).toEqual(["hybrid"]);
  });

  it("MAPUI-15: engine=cng reads as no group chosen, since CNG has no choice (MAPUI-18)", () => {
    expect(groupsFromEngine(["cng"])).toEqual([]);
  });

  it("MAPUI-15: no engine values read as no group chosen", () => {
    expect(groupsFromEngine([])).toEqual([]);
  });
});

describe("MAPUI-15/MAPUI-18: isGroupedEngineValue", () => {
  it("MAPUI-15: gasoil belongs to a fuel group", () => {
    expect(isGroupedEngineValue("gasoil")).toBe(true);
  });

  it("MAPUI-18: cng belongs to no fuel group, since CNG has no choice", () => {
    expect(isGroupedEngineValue("cng")).toBe(false);
  });
});

// docs/specs/redesign-map.md (MAPUI-35, bug fix). The car card's meta line
// must show a localized fuel label instead of the raw upstream token
// (bug: Wallapop's "gasoil"/"gasolina" reached the card unreadable). Values
// hand-derived from the upstream tokens each source actually sends
// (lib/wallapop/normalize.ts, lib/cochesnet/normalize.ts,
// lib/milanuncios/normalize.ts).
describe("MAPUI-35: classifyFuel recognizes both the filter codes and the Spanish words coches.net/Milanuncios send", () => {
  it("MAPUI-35: the filter codes ('gasoline', 'gasoil'…) classify into their group", () => {
    expect(classifyFuel("gasoline")).toBe("gasoline");
    expect(classifyFuel("gasoil")).toBe("gasoil");
    expect(classifyFuel("hybride")).toBe("hybrid");
    expect(classifyFuel("hybride_plugin")).toBe("hybrid");
    expect(classifyFuel("electric-hybrid")).toBe("electric");
    expect(classifyFuel("lpg")).toBe("lpg");
  });

  it("MAPUI-35: coches.net/Milanuncios' Spanish display words classify the same way", () => {
    expect(classifyFuel("Diésel")).toBe("gasoil");
    expect(classifyFuel("Gasolina")).toBe("gasoline");
    expect(classifyFuel("híbrido")).toBe("hybrid");
    expect(classifyFuel("Eléctrico")).toBe("electric");
    expect(classifyFuel("GLP")).toBe("lpg");
  });

  it("MAPUI-35: matching ignores case and diacritics", () => {
    expect(classifyFuel("DIESEL")).toBe("gasoil");
    expect(classifyFuel("diesel")).toBe("gasoil");
    expect(classifyFuel("  Diésel  ")).toBe("gasoil");
  });

  it("MAPUI-35: a token none of the sources' known fuel words match returns undefined", () => {
    expect(classifyFuel("cng")).toBeUndefined();
    expect(classifyFuel("")).toBeUndefined();
  });

  it("MAPUI-35: the worked example's «vapor», a token no group recognises, returns undefined", () => {
    expect(classifyFuel("vapor")).toBeUndefined();
  });
});

// docs/specs/redesign-map.md (MAPUI-35, MAPUI-55), worked example "Fuel
// vocabulary": every fuel string a live probe of the three sources returned
// on 2026-10-13 (docs/specs/data-sources.md › Contracts), and the group each
// one belongs to. CNG belongs to no group.
describe("MAPUI-35 / MAPUI-55: the sources' recorded fuel strings classify into their groups", () => {
  it.each([
    ["Gasoline", "gasoline"],
    ["Diesel", "gasoil"],
    ["Hybrid", "hybrid"],
    ["Hybrid Plug-in", "hybrid"],
    ["Electric", "electric"],
    ["LPG", "lpg"],
  ])("MAPUI-35: Wallapop's «%s» classifies as %s", (raw, group) => {
    expect(classifyFuel(raw)).toBe(group);
  });

  it.each([
    ["Gasolina", "gasoline"],
    ["Diésel", "gasoil"],
    ["Eléctrico", "electric"],
    ["Híbrido", "hybrid"],
    ["Híbrido enchufable", "hybrid"],
    ["Gas licuado (GLP)", "lpg"],
  ])("MAPUI-35: coches.net's «%s» classifies as %s", (raw, group) => {
    expect(classifyFuel(raw)).toBe(group);
  });

  it.each([
    ["gasolina", "gasoline"],
    ["diesel", "gasoil"],
    ["eléctrico", "electric"],
    ["híbrido", "hybrid"],
  ])("MAPUI-35: Milanuncios' «%s» classifies as %s", (raw, group) => {
    expect(classifyFuel(raw)).toBe(group);
  });

  it("MAPUI-55: Wallapop's «CNG» and coches.net's «Gas natural (CNG)» belong to no group", () => {
    expect(classifyFuel("CNG")).toBeUndefined();
    expect(classifyFuel("Gas natural (CNG)")).toBeUndefined();
  });
});
