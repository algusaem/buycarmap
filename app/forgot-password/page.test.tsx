import { describe, expect, it, vi } from "vitest";
import { ES_COPY } from "@/test/utils/copy";

// `next-intl/server`'s real implementation only resolves under the
// "react-server" module condition Next.js sets at build time — absent here,
// stubbed with `ES_COPY.t` (test/utils/copy.ts), as app/privacy/page.test.tsx does.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

import * as pageModule from "./page";

// docs/specs/redesign-pages.md (PAGES-69, worked example "Browser titles").
describe("PAGES-69: /forgot-password's browser title", () => {
  it("PAGES-69: is exactly Recuperar contraseña · Buy Car Map", async () => {
    const metadata = await pageModule.generateMetadata();

    expect(metadata.title).toBe("Recuperar contraseña · Buy Car Map");
  });
});
