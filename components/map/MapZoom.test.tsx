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

// docs/specs/motion.md (Key MOTION, Approved), MOTION-6: the zoom buttons gain
// a press state alongside their existing hover.
describe("MOTION-6: MapZoom — press state", () => {
  it("MOTION-6: both buttons carry active:scale-97, off under reduced motion", () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <MapZoom />
      </NextIntlClientProvider>,
    );

    for (const name of ["Acercar", "Alejar"]) {
      const className = screen.getByRole("button", { name }).className;
      expect(className).toContain("active:scale-97");
      expect(className).toContain("motion-reduce:active:scale-none");
    }
  });
});
