import { describe, expect, it } from "vitest";
import { fold } from "./fold";

// docs/specs/redesign-map.md (MAPUI-6: "ignoring case and accents";
// MAPUI-35: a source's fuel word matched the same way).
describe("fold", () => {
  it("MAPUI-6: takes the accents off and lowers the case", () => {
    expect(fold("Citroën")).toBe("citroen");
    expect(fold("DIÉSEL")).toBe("diesel");
    expect(fold("Škoda")).toBe("skoda");
  });

  it("MAPUI-6: leaves text with no accents only lowered", () => {
    expect(fold("Mercedes-Benz")).toBe("mercedes-benz");
    expect(fold("")).toBe("");
  });
});
