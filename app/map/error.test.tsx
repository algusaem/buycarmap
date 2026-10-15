import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => "/map",
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { captureException } from "@sentry/nextjs";
import MapError from "./error";

afterEach(() => vi.clearAllMocks());

// docs/specs/redesign-map.md (MAPUI-34): "The error file renders the
// page-error state with an action that retries the route" — the page-error
// state (components/ui/PageError.tsx).

describe("MAPUI-34: /map error.tsx", () => {
  it("MAPUI-34: shows a retry control that resets the boundary and refreshes the route", async () => {
    const reset = vi.fn();
    renderWithI18n(<MapError error={new Error("x")} reset={reset} />);

    const retry = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(retry);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("MAPUI-34: /map error.tsx — Sentry", () => {
  it("MAPUI-34: reports the thrown error to Sentry", () => {
    const error = new Error("map boundary error");
    renderWithI18n(<MapError error={error} reset={vi.fn()} />);

    expect(captureException).toHaveBeenCalledWith(error);
  });
});

describe("MAPUI-34: /map error.tsx — the page-error state", () => {
  it("MAPUI-34: the headline is the page's h1 and the line is the map's own", () => {
    renderWithI18n(<MapError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "¿Se ha roto algo?No es culpa tuya",
    );
    expect(
      screen.getByText("Error al cargar el mapa. Vuelve a intentarlo más tarde."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("MAPUI-34: /map error.tsx accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<MapError error={new Error("x")} reset={vi.fn()} />, {
      locale: "es",
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
