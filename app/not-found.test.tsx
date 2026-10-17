import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";

// I18nProvider (via renderWithI18n) calls useRouter, so the app router must be
// mocked even though this page reads no router state of its own.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
// `next-intl/server`'s real implementation only resolves under the
// "react-server" module condition Next.js sets at build time — absent here,
// stubbed with `ES_COPY.t` (test/utils/copy.ts) instead, as
// app/login/page.test.tsx does for `generateMetadata`.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));

import * as notFoundModule from "./not-found";

const NotFound = notFoundModule.default;

// docs/specs/redesign-pages.md (PAGES-65, PAGES-66, PAGES-69). An address
// that leads to no page, and every notFound(), render this. The header and
// tab bar are drawn by the root layout from the route's own pathname and
// session, not by this component (components/nav/SiteHeader.test.tsx,
// components/nav/TabBar.test.tsx: PAGES-66).
describe("PAGES-65: the not-found page", () => {
  it("PAGES-65: shows exactly one h1 and one action, linking to /map", () => {
    renderWithI18n(<NotFound />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const mapLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/map");
    expect(mapLinks).toHaveLength(1);
  });

  it("PAGES-65: «¿Te has perdido?» over «Esto no existe», the line and «Volver al mapa», in Spanish", () => {
    renderWithI18n(<NotFound />, { locale: "es" });

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("¿Te has perdido?");
    expect(headings[0]).toHaveTextContent("Esto no existe");
    expect(
      screen.getByText(
        "Esta dirección no lleva a ninguna página. Vuelve al mapa y sigue buscando.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al mapa" })).toHaveAttribute("href", "/map");
  });

  it("PAGES-65: offers no second action", () => {
    renderWithI18n(<NotFound />, { locale: "es" });

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("PAGES-69: the not-found page's browser title", () => {
  it("PAGES-69: is exactly Esto no existe · Buy Car Map", async () => {
    const metadata = await notFoundModule.generateMetadata();

    expect(metadata.title).toBe("Esto no existe · Buy Car Map");
  });
});

// docs/specs/redesign-pages.md (PAGES-65): at desktop width the empty map sits
// beside the state, drawn for the eye only (CSS shows it from `lg`).
describe("PAGES-65: the empty map beside the not-found page", () => {
  it("PAGES-65: the page's main holds a decorative map column shown from lg", () => {
    renderWithI18n(<NotFound />, { locale: "es" });

    const map = screen.getByRole("main").querySelector(':scope > div[aria-hidden="true"]');
    expect(map).not.toBeNull();
    expect(map).toHaveClass("hidden", "lg:flex");
  });
});
