import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";

// `next-intl/server`'s real implementation only resolves under the
// "react-server" module condition Next.js sets at build time — absent here,
// stubbed with `ES_COPY.t` (test/utils/copy.ts) instead, as
// app/login/page.test.tsx does for `generateMetadata`.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

// components/legal/LegalContent.test.tsx's own mock, needed here too now
// that MAPLIBRE-13 renders the page's body (LegalContent): the app router
// must be mocked even though this page only reads translations.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import * as pageModule from "./page";

// docs/specs/redesign-pages.md (PAGES-69, worked example "Browser titles").
describe("PAGES-69: /privacy's browser title", () => {
  it("PAGES-69: is exactly Privacidad · Buy Car Map", async () => {
    const metadata = await pageModule.generateMetadata();

    expect(metadata.title).toBe("Privacidad · Buy Car Map");
  });
});

// docs/specs/map-maplibre.md (MAPLIBRE-13), worked example "Privacy page
// (MAPLIBRE-13)": the third-party section's CARTO clause becomes the
// OpenFreeMap sentence below, in both locales, with nothing else in that
// body changed.
const OPENFREEMAP_EN =
  "OpenFreeMap (map tiles) receives tile requests straight from your browser, which show the area you are viewing;";
const OPENFREEMAP_ES =
  "OpenFreeMap (teselas del mapa) recibe las peticiones de teselas directamente desde tu navegador, que revelan la zona que estás viendo;";

describe("MAPLIBRE-13 (docs/specs/map-maplibre.md): /privacy names OpenFreeMap where it named CARTO", () => {
  it("MAPLIBRE-13: the English third-party body carries the OpenFreeMap sentence and no longer names CARTO", () => {
    renderWithI18n(<pageModule.default />);

    const heading = screen.getByRole("heading", { level: 2, name: "Third-party services" });
    const body = heading.nextElementSibling?.textContent ?? "";

    expect(body).toContain(OPENFREEMAP_EN);
    expect(body).not.toContain("CARTO");
  });

  it("MAPLIBRE-13: the Spanish third-party body carries the OpenFreeMap sentence and no longer names CARTO", () => {
    renderWithI18n(<pageModule.default />, { locale: "es" });

    const heading = screen.getByRole("heading", { level: 2, name: "Servicios de terceros" });
    const body = heading.nextElementSibling?.textContent ?? "";

    expect(body).toContain(OPENFREEMAP_ES);
    expect(body).not.toContain("CARTO");
  });

  it("MAPLIBRE-13: docs/privacy/processors.md has an OpenFreeMap row in place of CARTO's", () => {
    const processors = readFileSync(join(process.cwd(), "docs/privacy/processors.md"), "utf8");
    const rows = processors.split("\n").map((row) => row.trim());

    expect(rows.some((row) => row.startsWith("| OpenFreeMap |"))).toBe(true);
    expect(rows.some((row) => row.startsWith("| CARTO |"))).toBe(false);
  });
});
