import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/es.json";
import { MapZoom } from "./MapZoom";

// docs/design/system/components/MapZoom/README.md: hovering either button
// takes its background to surface-strong.
vi.mock("react-leaflet", () => ({
  useMap: () => ({ zoomIn: vi.fn(), zoomOut: vi.fn() }),
}));

describe("MAPUI-29: MapZoom — hover state", () => {
  it("MAPUI-29: both buttons take surface-strong on hover, and the wrapper does not clip the focus ring", () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <MapZoom />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Acercar" }).className).toContain(
      "hover:bg-surface-strong",
    );
    expect(screen.getByRole("button", { name: "Alejar" }).className).toContain(
      "hover:bg-surface-strong",
    );
    expect(screen.getByRole("button", { name: "Acercar" }).parentElement?.className).not.toMatch(
      /\boverflow-hidden\b/,
    );
  });
});
