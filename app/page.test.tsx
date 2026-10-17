import { describe, expect, it, vi } from "vitest";
import { ES_COPY } from "@/test/utils/copy";
import { generateMetadata } from "./page";

// docs/specs/redesign-entry.md (ENTRY-20). "Buy Car Map" is `meta.title`
// (messages/en.json, messages/es.json), read through `generateMetadata` —
// its real implementation only resolves under the "react-server" module
// condition Next.js sets at build time, absent here, so it is stubbed with
// `ES_COPY.t` (test/utils/copy.ts), the same real Spanish messages a
// component reads through `useTranslations()`.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

describe("ENTRY-20: the landing's browser title", () => {
  it("ENTRY-20: is exactly Buy Car Map", async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Buy Car Map");
  });
});
