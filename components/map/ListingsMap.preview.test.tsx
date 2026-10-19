import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import type { CarListing } from "@/interfaces/listing";
import { ListingsMap } from "./ListingsMap";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// docs/specs/redesign-map.md (MAPUI-25, MAPUI-27). Unlike ListingsMap.test.tsx,
// this file runs the real Leaflet and react-leaflet: opening, closing and the
// focus of the preview popup are Leaflet's own events, which a stand-in
// would only repeat. Leaflet lays nothing out in jsdom, so nothing here
// asserts a position or a size.

vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_CARTO_API_KEY: undefined } }));

function makeListing(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: "wallapop-1",
    image: "https://cdn.wallapop.com/car.jpg",
    title: "Audi A3 2.0 TDI",
    subtitle: "Great condition",
    price: 14500,
    mileage: 95000,
    year: 2018,
    fuel: "gasoil",
    brand: "Audi",
    model: "A3",
    location: "Madrid",
    source: "Wallapop",
    lat: 40.4168,
    lng: -3.7038,
    url: "https://es.wallapop.com/item/audi-a3-1",
    ...overrides,
  };
}

const AUDI = makeListing();
const SEAT = makeListing({
  id: "wallapop-2",
  title: "Seat Leon FR",
  price: 9500,
  lat: 41.3879,
  lng: 2.1699,
});

// The pins' accessible names: «{title}, {price}», the price with the no-break
// space Intl writes before «€».
const AUDI_PIN = "Audi A3 2.0 TDI, 14.500 €";
const SEAT_PIN = "Seat Leon FR, 9.500 €";

function renderMap(props: Partial<Parameters<typeof ListingsMap>[0]> = {}) {
  return renderWithI18n(<ListingsMap listings={[AUDI, SEAT]} {...props} />, { locale: "es" });
}

function preview() {
  return screen.queryByRole("article", { name: "Vista previa del coche" });
}

describe("MAPUI-27: ListingsMap — opening the preview from the keyboard", () => {
  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "MAPUI-27: %s on a pin opens its preview, activates its car and moves focus into it",
    async (_key, keys) => {
      const onActivate = vi.fn();
      renderMap({ onActivate });

      screen.getByRole("button", { name: AUDI_PIN }).focus();
      await userEvent.keyboard(keys);

      const card = await screen.findByRole("article", { name: "Vista previa del coche" });
      expect(within(card).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
      expect(onActivate).toHaveBeenCalledWith("wallapop-1");
      await waitFor(() =>
        expect(within(card).getByRole("button", { name: "Cerrar vista previa" })).toHaveFocus(),
      );
    },
  );
});

describe("MAPUI-27: ListingsMap — closing the preview", () => {
  async function openAudi(onPreviewClose = vi.fn()) {
    renderMap({ onPreviewClose });
    const pin = screen.getByRole("button", { name: AUDI_PIN });
    pin.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("article", { name: "Vista previa del coche" });
    return { pin, onPreviewClose };
  }

  it("MAPUI-27: Escape inside the preview closes it and returns focus to the pin", async () => {
    const { pin, onPreviewClose } = await openAudi();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(pin).toHaveFocus());
  });

  it("MAPUI-27: Escape on the pin closes its preview", async () => {
    const { pin, onPreviewClose } = await openAudi();

    pin.focus();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
    expect(pin).toHaveFocus();
  });

  it("MAPUI-27: the close button closes it and returns focus to the pin", async () => {
    const { pin, onPreviewClose } = await openAudi();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar vista previa" }));

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(pin).toHaveFocus());
  });

  it("MAPUI-27: a press on the map outside the preview closes it and returns focus to the pin", async () => {
    const { pin, onPreviewClose } = await openAudi();
    const mapContainer = document.querySelector<HTMLElement>(".leaflet-container");
    if (!mapContainer) throw new Error("The map container did not render.");

    fireEvent.pointerDown(mapContainer);

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(pin).toHaveFocus());
  });

  it("MAPUI-27: a press on the page outside the map closes it too", async () => {
    const outside = document.createElement("button");
    outside.textContent = "Fuera del mapa";
    document.body.appendChild(outside);

    try {
      const { onPreviewClose } = await openAudi();

      fireEvent.pointerDown(outside);

      await waitFor(() => expect(preview()).not.toBeInTheDocument());
      expect(onPreviewClose).toHaveBeenCalledTimes(1);
    } finally {
      outside.remove();
    }
  });

  it("MAPUI-27: a press inside the preview leaves it open", async () => {
    const { onPreviewClose } = await openAudi();
    const card = screen.getByRole("article", { name: "Vista previa del coche" });

    fireEvent.pointerDown(within(card).getByText("Audi A3 2.0 TDI"));

    expect(preview()).toBeInTheDocument();
    expect(onPreviewClose).not.toHaveBeenCalled();
  });

  it("MAPUI-27: reopened and closed again, one Escape still closes it once", async () => {
    const { pin, onPreviewClose } = await openAudi();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(pin).toHaveFocus());

    await userEvent.keyboard("{Enter}");
    await screen.findByRole("article", { name: "Vista previa del coche" });
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(onPreviewClose).toHaveBeenCalledTimes(2);
  });

  it("MAPUI-27: opening another pin's preview leaves the focus in that preview, not on the first pin", async () => {
    const { pin } = await openAudi();

    screen.getByRole("button", { name: SEAT_PIN }).focus();
    await userEvent.keyboard("{Enter}");

    const card = await screen.findByRole("article", { name: "Vista previa del coche" });
    await waitFor(() => expect(within(card).getByText("Seat Leon FR")).toBeInTheDocument());
    // Past the tick the closed preview waits before returning focus.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pin).not.toHaveFocus();
    expect(within(card).getByRole("button", { name: "Cerrar vista previa" })).toHaveFocus();
  });

  it("MAPUI-39: focus that moved out of the map stays where it went when the preview closes", async () => {
    const outside = document.createElement("button");
    outside.textContent = "Crear alerta";
    document.body.appendChild(outside);

    try {
      // The map page clears the preview id when «Crear alerta» opens, and
      // the card it opens takes the focus.
      const { rerender } = renderMap({ previewId: "wallapop-1" });
      screen.getByRole("button", { name: AUDI_PIN }).focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("article", { name: "Vista previa del coche" });
      outside.focus();

      rerender(<ListingsMap listings={[AUDI, SEAT]} previewId={null} />);

      await waitFor(() => expect(preview()).not.toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(outside).toHaveFocus();
    } finally {
      outside.remove();
    }
  });
});

// docs/specs/redesign-map.md (MAPUI-27, amended: "Opening another pin while a
// preview is open closes the first and opens the second, which stays open").
// Every close goes through the pin's own requestClose(), so these need real
// animations: the fade is the thing under test, and the global jsdom setup
// skips it instantly otherwise (test/setup.jsdom.ts).
describe("MAPUI-27: ListingsMap — one open preview at a time", () => {
  it("MAPUI-27: pressing another pin fades the first out and opens the second, which survives the first's exit", async () => {
    await withAnimations(async () => {
      renderMap();
      await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
      await screen.findByText("Audi A3 2.0 TDI");

      // A delay beyond jsdom's double-click window, so the two presses on
      // different pins are not read as one double-click (which would hand
      // the event to Leaflet's own double-click zoom instead).
      await new Promise((resolve) => setTimeout(resolve, 500));
      await userEvent.click(screen.getByRole("button", { name: SEAT_PIN }));

      await screen.findByText("Seat Leon FR");
      await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());
      // The first one's exit finishing must not have taken the second with it.
      expect(screen.getByText("Seat Leon FR")).toBeInTheDocument();
    });
  });

  it("MAPUI-27: reopening a pin after closing it by the toggle focuses the preview again", async () => {
    await withAnimations(async () => {
      renderMap();
      const pin = screen.getByRole("button", { name: AUDI_PIN });
      await userEvent.click(pin);
      await screen.findByRole("article", { name: "Vista previa del coche" });

      await userEvent.click(pin);
      await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());

      // Past jsdom's double-click window: this is a fresh press, not the
      // second half of a double-click Leaflet would hand to its own zoom.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await userEvent.click(pin);
      const card = await screen.findByRole("article", { name: "Vista previa del coche" });
      await waitFor(() =>
        expect(within(card).getByRole("button", { name: "Cerrar vista previa" })).toHaveFocus(),
      );
    });
  });

  // MOTION-11 (docs/specs/motion.md): Escape closes the keyboard way, at
  // once — the "Escape" row this it.each used to carry assumed an exit still
  // playing after Escape, which is no longer true, so it moved to its own
  // "closes at once" test below. Its pointer twins (an outside press, the
  // close button pressed with a pointer) still animate and stay here.
  it.each([
    [
      "an outside press",
      async () => {
        const mapContainer = document.querySelector<HTMLElement>(".leaflet-container");
        if (!mapContainer) throw new Error("The map container did not render.");
        fireEvent.pointerDown(mapContainer);
      },
    ],
    [
      "the close button",
      async () => {
        await userEvent.click(screen.getByRole("button", { name: "Cerrar vista previa" }));
      },
    ],
  ])(
    "MAPUI-27: %s keeps the card mounted until the exit finishes, then removes it",
    async (_name, act) => {
      await withAnimations(async () => {
        renderMap();
        await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
        await screen.findByText("Audi A3 2.0 TDI");

        // Past jsdom's double-click window, so a click-based close below is
        // not read as the second half of a double-click Leaflet would hand to
        // its own zoom instead of to this one's own click handling.
        await new Promise((resolve) => setTimeout(resolve, 500));
        await act();

        expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());
      });
    },
  );

  // MOTION-11: Escape now closes at once (its own test below), so there is no
  // exit left to cancel when it triggers the close — this reopens mid-fade
  // from a pointer close instead (a click on the pin toggles it shut), which
  // still animates and keeps the cancel-the-exit behaviour this test covers.
  it("MAPUI-27: reopening a pin mid-fade cancels the exit, leaving the preview open and focused", async () => {
    await withAnimations(async () => {
      renderMap();
      const pin = screen.getByRole("button", { name: AUDI_PIN });
      await userEvent.click(pin);
      const opened = await screen.findByRole("article", { name: "Vista previa del coche" });
      // An exit from opacity 0 is instant in Motion (0 to 0 is nothing to
      // animate), so the preview would close before it can be reopened
      // mid-fade. Wait for the enter animation to have reached its first
      // frame before pressing Escape and triggering the exit.
      await waitFor(() => expect(Number(opened.style.opacity)).toBeGreaterThan(0));

      // Past jsdom's double-click window, so this press is not read as the
      // second half of a double-click.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await userEvent.click(pin);
      expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();

      await userEvent.click(pin);

      const card = screen.getByRole("article", { name: "Vista previa del coche" });
      expect(within(card).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
      await waitFor(() =>
        expect(within(card).getByRole("button", { name: "Cerrar vista previa" })).toHaveFocus(),
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    });
  });

  it("MAPUI-27: a pin unmounting mid-exit throws nothing and leaves no popup open", async () => {
    await withAnimations(async () => {
      function Wrapper() {
        const [listings, setListings] = useState<CarListing[]>([AUDI, SEAT]);
        return (
          <>
            <button type="button" onClick={() => setListings([SEAT])}>
              Drop Audi
            </button>
            <ListingsMap listings={listings} />
          </>
        );
      }
      renderWithI18n(<Wrapper />, { locale: "es" });

      const pin = screen.getByRole("button", { name: AUDI_PIN });
      await userEvent.click(pin);
      const opened = await screen.findByRole("article", { name: "Vista previa del coche" });
      // As in the mid-fade reopen above: wait for the enter animation's first
      // frame, or the exit from opacity 0 is instant and nothing is mid-exit.
      await waitFor(() => expect(Number(opened.style.opacity)).toBeGreaterThan(0));

      // MOTION-11: Escape now closes at once, leaving nothing mid-exit for
      // this unmount to interrupt — a pointer close (a click on the pin)
      // still animates, which is what this test needs.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await userEvent.click(pin);
      expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Drop Audi" }));

      await waitFor(() => expect(screen.queryByText("Audi A3 2.0 TDI")).toBeNull());
      expect(document.querySelector(".leaflet-popup")).toBeNull();
    });
  });
});

// docs/specs/motion.md (MOTION-11, amends MAPUI-27): a keyboard open or close
// (Enter/Space, Escape) skips the fade; a pointer open or close still plays
// it. The pointer side is already proven by the MAPUI-27 tests above (opacity
// above 0 once opened, still mounted right after a pointer close) — these
// four are what MOTION-11 adds or changes.
describe("MOTION-11: ListingsMap — the preview opens and closes at once from the keyboard, but still fades for a pointer", () => {
  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "MOTION-11: %s on a pin opens the preview with no inline opacity below 1, even with animations enabled",
    async (_key, keys) => {
      await withAnimations(async () => {
        renderMap();
        screen.getByRole("button", { name: AUDI_PIN }).focus();

        await userEvent.keyboard(keys);

        const card = await screen.findByRole("article", { name: "Vista previa del coche" });
        const opacity = card.style.opacity;
        expect(opacity === "" || Number(opacity) >= 1).toBe(true);
      });
    },
  );

  it("MOTION-11: Escape closes the preview in the same tick, with no exit animation to wait for", async () => {
    await withAnimations(async () => {
      renderMap();
      const pin = screen.getByRole("button", { name: AUDI_PIN });
      pin.focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("article", { name: "Vista previa del coche" });

      await userEvent.keyboard("{Escape}");

      expect(
        screen.queryByRole("article", { name: "Vista previa del coche" }),
      ).not.toBeInTheDocument();
    });
  });

  it("MOTION-11: a pointer open still fades in, with an inline opacity below 1 right after the click", async () => {
    await withAnimations(async () => {
      renderMap();

      await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));

      const card = await screen.findByRole("article", { name: "Vista previa del coche" });
      expect(Number(card.style.opacity)).toBeLessThan(1);
    });
  });
});

// docs/specs/motion.md (Edge cases, MOTION-11): a close nobody triggered — the
// open preview's car leaves the results — always happens at once, whatever
// the last input: the preview leaves with its pin, and pins never animate.
describe("MOTION-11: ListingsMap — a preview whose car leaves the results", () => {
  it("MOTION-11: after a key press («a»), the preview is gone in the same tick when its car leaves the results", async () => {
    await withAnimations(async () => {
      const { rerender } = renderMap();
      await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
      await screen.findByRole("article", { name: "Vista previa del coche" });

      fireEvent.keyDown(window, { key: "a" });
      await act(async () => {
        rerender(<ListingsMap listings={[SEAT]} />);
      });

      expect(preview()).not.toBeInTheDocument();
    });
  });

  it("MOTION-11: even after pointer input, the preview is gone in the same tick when its car leaves the results", async () => {
    await withAnimations(async () => {
      const { rerender } = renderMap();
      await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));
      await screen.findByRole("article", { name: "Vista previa del coche" });

      await act(async () => {
        rerender(<ListingsMap listings={[SEAT]} />);
      });

      expect(preview()).not.toBeInTheDocument();
    });
  });
});

// docs/specs/motion.md (MOTION-9): a price pin's active state turns on and
// off with no transition.
describe("MOTION-9: ListingsMap — the pin's active state has no transition", () => {
  it("MOTION-9: the pin's span carries no transition- class", () => {
    renderMap();

    const pin = screen.getByRole("button", { name: AUDI_PIN });
    const span = pin.querySelector("span");
    expect(span?.className ?? "").not.toMatch(/\btransition-/);
  });
});

// docs/specs/motion.md (MOTION-17): the preview's close button and «Ver
// anuncio» gain a hover and a press state, in the state transition.
describe("MOTION-17: ListingsMap — hover and press on the preview's close button and «Ver anuncio»", () => {
  it.each([
    ["the close button", "button", "Cerrar vista previa", "hover:bg-surface-strong"],
    ["«Ver anuncio»", "link", /Ver anuncio/, "hover:brightness-108"],
  ] as const)(
    "MOTION-17: %s carries its hover class and active:scale-97, off under reduced motion",
    async (_what, role, name, hover) => {
      renderMap();
      screen.getByRole("button", { name: AUDI_PIN }).focus();
      await userEvent.keyboard("{Enter}");
      const card = await screen.findByRole("article", { name: "Vista previa del coche" });

      const className = within(card).getByRole(role, { name }).className;
      expect(className).toContain(hover);
      expect(className).toContain("active:scale-97");
      expect(className).toContain("motion-reduce:active:scale-none");
      expect(className).toMatch(/transition-\[[^\]]+\]/);
    },
  );
});

describe("MAPUI-24: ListingsMap — a grouped pin", () => {
  it("MAPUI-24: activating a grouped pin activates the group's lowest-price car", async () => {
    const onActivate = vi.fn();
    const cheaper = makeListing({ id: "wallapop-3", title: "Seat Ibiza", price: 9500 });
    renderWithI18n(<ListingsMap listings={[AUDI, cheaper]} onActivate={onActivate} />, {
      locale: "es",
    });

    screen.getByRole("button", { name: "2 coches · desde 9.500 €" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(onActivate).toHaveBeenCalledWith("wallapop-3");
  });
});

describe("MAPUI-25: ListingsMap — the pin's accessible name", () => {
  it("MAPUI-25: follows a new price on the same pin", () => {
    const { rerender } = renderMap();
    expect(screen.getByRole("button", { name: AUDI_PIN })).toBeInTheDocument();

    rerender(<ListingsMap listings={[{ ...AUDI, price: 13000 }, SEAT]} />);

    expect(screen.getByRole("button", { name: "Audi A3 2.0 TDI, 13.000 €" })).toBeInTheDocument();
  });
});

describe("MAPUI-27: ListingsMap — accessibility", () => {
  it("MAPUI-27: the open preview card has no axe violations", async () => {
    renderMap();
    screen.getByRole("button", { name: AUDI_PIN }).focus();
    await userEvent.keyboard("{Enter}");

    const card = await screen.findByRole("article", { name: "Vista previa del coche" });

    expect(await axe(card)).toHaveNoViolations();
  });
});

/** The map wired as the map page wires it: the open preview's car is the active one. */
function MapWithPage() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  return (
    <ListingsMap
      listings={[AUDI, SEAT]}
      activeId={previewId}
      previewId={previewId}
      onActivate={setPreviewId}
      onPreviewClose={() => setPreviewId(null)}
    />
  );
}

describe("MAPUI-27, MAPUI-28: ListingsMap — the active pin", () => {
  it("MAPUI-27/MAPUI-28: marks only the active car's pin, and follows activeId", () => {
    const { rerender } = renderMap({ activeId: AUDI.id });
    const audi = screen.getByRole("button", { name: AUDI_PIN });
    const seat = screen.getByRole("button", { name: SEAT_PIN });
    expect(audi).toHaveAttribute("data-active", "true");
    expect(seat).toHaveAttribute("data-active", "false");

    rerender(<ListingsMap listings={[AUDI, SEAT]} activeId={SEAT.id} />);
    expect(audi).toHaveAttribute("data-active", "false");
    expect(seat).toHaveAttribute("data-active", "true");

    rerender(<ListingsMap listings={[AUDI, SEAT]} activeId={null} />);
    expect(audi).toHaveAttribute("data-active", "false");
    expect(seat).toHaveAttribute("data-active", "false");
  });

  it("MAPUI-27: activating the pin of an open preview again closes it and leaves the pin inactive", async () => {
    renderWithI18n(<MapWithPage />, { locale: "es" });
    const pin = screen.getByRole("button", { name: AUDI_PIN });
    pin.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("article", { name: "Vista previa del coche" });
    expect(pin).toHaveAttribute("data-active", "true");

    pin.focus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(preview()).not.toBeInTheDocument());
    expect(pin).toHaveAttribute("data-active", "false");
  });
});

describe("MAPUI-27: ListingsMap — a grouped pin's preview", () => {
  it("MAPUI-27: is named by the group's pin label", async () => {
    const cheaper = makeListing({ id: "wallapop-3", title: "Seat Ibiza", price: 9500 });
    renderWithI18n(<ListingsMap listings={[AUDI, cheaper]} />, { locale: "es" });

    screen.getByRole("button", { name: "2 coches · desde 9.500 €" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(
      await screen.findByRole("article", { name: "2 coches · desde 9.500 €" }),
    ).toBeInTheDocument();
  });
});

// docs/specs/redesign-map.md (MAPUI-62, #133): the real Leaflet container is
// needed here because a pin's own click handler stops the event reaching the
// map's - a mocked MapContainer (ListingsMap.test.tsx) renders no such
// propagation to prove the pin case against.
describe("MAPUI-62: ListingsMap - reporting a map interaction", () => {
  it("MAPUI-62: clicking the map container calls onMapInteract once", () => {
    const onMapInteract = vi.fn();
    const { container } = renderMap({ onMapInteract });

    const mapContainer = container.querySelector(".leaflet-container");
    if (!mapContainer) throw new Error("the Leaflet container was not rendered");
    fireEvent.click(mapContainer);

    expect(onMapInteract).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-62: clicking a pin never calls onMapInteract", async () => {
    const onMapInteract = vi.fn();
    renderMap({ onMapInteract });

    await userEvent.click(screen.getByRole("button", { name: AUDI_PIN }));

    expect(onMapInteract).not.toHaveBeenCalled();
  });
});
