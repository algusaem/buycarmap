import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import RootError from "./error";

// docs/specs/redesign-pages.md (PAGES-68). The route-level error boundary for
// every route with no error file of its own (the access pages, the legal
// pages, `/` and `/login`): the page-error state of PAGES-57
// (components/ui/PageError.tsx), as test/utils/alerts.tsx's
// describeAlertsRouteError already proves for the two alerts routes. The
// route's own header and tab bar persist underneath it, drawn by the root
// layout from the route's pathname — unaffected by which error boundary
// catches the throw, and already proven for every one of these routes by
// components/nav/SiteHeader.test.tsx's HEAD-6 cases and
// components/nav/TabBar.test.tsx's HEAD-8 cases.
describe("PAGES-68: the root error boundary", () => {
  it("PAGES-68: shows a retry control that calls reset", async () => {
    const reset = vi.fn();
    renderWithI18n(<RootError error={new Error("x")} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("PAGES-68: retry also refreshes the route's server data", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    renderWithI18n(<RootError error={new Error("x")} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("PAGES-68: «¿Se ha roto algo?» over «No es culpa tuya» is the page's h1, over its line, in Spanish", () => {
    renderWithI18n(<RootError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("¿Se ha roto algo?");
    expect(headings[0]).toHaveTextContent("No es culpa tuya");
    expect(
      screen.getByText(
        "Esta página no ha cargado. Vuelve a intentarlo y, si sigue, vuelve al mapa.",
      ),
    ).toBeInTheDocument();
  });

  it("PAGES-68: never shows the raw thrown error message", () => {
    renderWithI18n(
      <RootError error={new Error("relation users does not exist")} reset={vi.fn()} />,
    );

    expect(screen.queryByText(/relation users does not exist/)).not.toBeInTheDocument();
  });

  it("PAGES-68: its sides follow the session as the not-found page's do: the pages header's once the tab bar shows", () => {
    const { container } = renderWithI18n(<RootError error={new Error("x")} reset={vi.fn()} />);

    const column = container.querySelector("main > div");
    expect(column).toHaveClass("lg:px-12", "lg:with-tab-bar:px-8");
  });

  it("PAGES-68: reports the thrown error to Sentry", () => {
    captureException.mockClear();
    const error = new Error("x");
    renderWithI18n(<RootError error={error} reset={vi.fn()} />);

    expect(captureException).toHaveBeenCalledWith(error);
  });
});

// docs/specs/redesign-pages.md (PAGES-68): at desktop width the empty map sits
// beside the state, drawn for the eye only (CSS shows it from `lg`).
describe("PAGES-68: the empty map beside the root error", () => {
  it("PAGES-68: the page's main holds a decorative map column shown from lg", () => {
    renderWithI18n(<RootError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

    const map = screen.getByRole("main").querySelector(':scope > div[aria-hidden="true"]');
    expect(map).not.toBeNull();
    expect(map).toHaveClass("hidden", "lg:flex");
  });
});

describe("PAGES-68: the root error's accessibility", () => {
  it("PAGES-68: has no accessibility violations", async () => {
    const { container } = renderWithI18n(<RootError error={new Error("x")} reset={vi.fn()} />, {
      locale: "es",
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
