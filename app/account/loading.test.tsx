import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { ACCOUNT_COPY } from "@/test/fixtures/pages-account";

// docs/specs/redesign-pages.md (PAGES-56; amends FRONT-14): /account's loading
// state — the heading, the line and «Cerrar sesión» already in place, then
// eight AccountCard-shaped placeholders (the first with the avatar's circle;
// the rest with a title, a badge, two lines and a button; the last across two
// columns at desktop width, one column at phone width — both compositions are
// drawn and CSS picks one, as app/alerts/loading.tsx does), one busy region
// with a visually hidden «Cargando…» in a polite status.
import Loading from "./loading";

describe("PAGES-56: /account's loading.tsx", () => {
  it("PAGES-56: shows «Cuenta», the line and «Cerrar sesión» already in place", () => {
    renderWithI18n(<Loading />, { locale: "es" });

    expect(
      screen.getByRole("heading", { level: 1, name: ACCOUNT_COPY.heading }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: ACCOUNT_COPY.signOut }).length).toBeGreaterThan(0);
  });

  it("PAGES-56: shows eight placeholders — the first with the avatar's circle, the rest with a title, a badge, two lines and a button", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const busy = container.querySelector('[aria-busy="true"]') as HTMLElement;
    expect(busy).not.toBeNull();
    // The placeholders are the busy region's direct aria-hidden children
    // (app/alerts/loading.test.tsx's `placeholders()` convention); one grid
    // serves both widths, its columns picked by CSS.
    const placeholders = Array.from(busy.children).filter(
      (child) => child.getAttribute("aria-hidden") === "true",
    );
    expect(placeholders).toHaveLength(8);
    // The first with the avatar's circle; the last across two columns from `lg`.
    expect(placeholders[0].querySelector(".rounded-pill.size-12")).not.toBeNull();
    expect(placeholders[7]).toHaveClass("lg:col-span-2");
  });

  it("PAGES-56: the busy region holds a visually hidden «Cargando…» in a polite status", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const busy = container.querySelector('[aria-busy="true"]') as HTMLElement;
    const status = within(busy).getByRole("status");
    expect(status).toHaveTextContent("Cargando…");
    expect(status).toHaveClass("sr-only");
    expect(status.closest("[aria-live='off']")).toBeNull();
  });

  it("PAGES-56: every placeholder is aria-hidden, inside exactly one busy region", () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    const busyRegions = container.querySelectorAll('[aria-busy="true"]');
    expect(busyRegions).toHaveLength(1);
    for (const region of busyRegions) {
      for (const child of Array.from(region.children)) {
        if (child.getAttribute("role") === "status") continue;
        expect(child.getAttribute("aria-hidden")).toBe("true");
      }
    }
  });
});

describe("PAGES-56: /account's loading accessibility", () => {
  it("PAGES-56: has no accessibility violations", async () => {
    const { container } = renderWithI18n(<Loading />, { locale: "es" });

    expect(await axe(container)).toHaveNoViolations();
  });
});
