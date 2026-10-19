import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MapLibreMap } from "maplibre-gl";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/es.json";
import { MapInstanceContext } from "./MapInstanceContext";
import { MapZoom } from "./MapZoom";

// docs/design/system/components/MapZoom/README.md: hovering either button
// takes its background to surface-strong. The map it zooms is the stand-in
// in test/utils/maplibre.ts: jsdom has no WebGL.
vi.mock("maplibre-gl", () => import("@/test/utils/maplibre"));

function renderZoom() {
  const map = new MapLibreMap({ container: document.createElement("div") });
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <MapInstanceContext.Provider value={map}>
        <MapZoom />
      </MapInstanceContext.Provider>
    </NextIntlClientProvider>,
  );
}

describe("MAPUI-29: MapZoom — hover state", () => {
  it("MAPUI-29: both buttons take surface-strong on hover, and the wrapper does not clip the focus ring", () => {
    renderZoom();

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
    renderZoom();

    for (const name of ["Acercar", "Alejar"]) {
      const className = screen.getByRole("button", { name }).className;
      expect(className).toContain("active:scale-97");
      expect(className).toContain("motion-reduce:active:scale-none");
    }
  });
});
