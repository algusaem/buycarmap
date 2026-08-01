import { describe, expect, it } from "vitest";
import { optionalString, requiredString } from "./form-data";

// These exist because `FormData.get` returns `string | File | null` and the
// server actions used to cast it straight to `string`. A blank optional field
// is omitted by the forms entirely, so `get` returned null, and Zod's
// `.optional()` rejects null — which surfaced a raw untranslated Zod message
// to the user instead of one of our error codes.

describe("optionalString", () => {
  it("passes a real string through untouched", () => {
    expect(optionalString("Ada")).toBe("Ada");
  });

  it("preserves an empty string rather than dropping it", () => {
    // "" and undefined mean different things: the first is "cleared", the
    // second "not submitted". Only the schema should decide what each implies.
    expect(optionalString("")).toBe("");
  });

  it("turns an absent field into undefined, which .optional() accepts", () => {
    expect(optionalString(null)).toBeUndefined();
  });

  it("turns a File into undefined rather than leaking it into the schema", () => {
    expect(optionalString(new File(["x"], "x.txt"))).toBeUndefined();
  });
});

describe("requiredString", () => {
  it("passes a real string through untouched", () => {
    expect(requiredString("ada@example.com")).toBe("ada@example.com");
  });

  it("turns an absent field into an empty string", () => {
    // So the schema's own min(1) rule fires and yields a proper error code,
    // instead of Zod complaining about the type.
    expect(requiredString(null)).toBe("");
  });

  it("turns a File into an empty string", () => {
    expect(requiredString(new File(["x"], "x.txt"))).toBe("");
  });
});
