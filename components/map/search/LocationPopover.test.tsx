import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { withAnimations } from "@/test/utils/animations";
import { renderWithI18n } from "@/test/utils/render";
import { makeNominatimResult } from "@/test/fixtures/nominatim";
import { LocationPopover, type LocationPopoverProps } from "./LocationPopover";

// docs/specs/redesign-map.md (MAPUI-3, MAPUI-4, MAPUI-5). Network through MSW
// (test/msw/handlers.ts already defaults Nominatim to one result); a case
// that needs a specific shape overrides with server.use.

const BASE: LocationPopoverProps = {
  value: null,
  radiusKm: 50,
  onSelect: vi.fn(),
  onClear: vi.fn(),
  onRadiusChange: vi.fn(),
};

describe("MAPUI-3: LocationPopover — Nominatim results", () => {
  it("MAPUI-3: typing two or more characters lists the places Nominatim returns, each with its region on a second line", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json([
          makeNominatimResult({
            place_id: 1,
            display_name: "Madrid, Comunidad de Madrid, España",
            // No address parts, so the option is split from the display name itself.
            address: {},
          }),
        ]),
      ),
    );
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Ma");

    const option = await screen.findByRole("option");
    // The place on the first line, its region on the second, and no «España».
    expect(within(option).getByText("Madrid")).toBeInTheDocument();
    expect(within(option).getByText("Comunidad de Madrid")).toBeInTheDocument();
    expect(option.textContent).toBe("MadridComunidad de Madrid");
    expect(option).not.toHaveTextContent("España");
  });

  it("MAPUI-3: a place whose display name has no comma shows no second line", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json([makeNominatimResult({ display_name: "Madrid", address: {} })]),
      ),
    );
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Ma");

    const option = await screen.findByRole("option", { name: "Madrid" });
    expect(option.textContent).toBe("Madrid");
  });

  it("MAPUI-3: announces N resultados in a polite status", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json([makeNominatimResult(), makeNominatimResult({ place_id: 2 })]),
      ),
    );
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Ma");

    // Not findByRole("status"): the status region is mounted from the start
    // (MAP-20), so that query would resolve on its first, still-empty render
    // instead of waiting for the count.
    expect(await screen.findByText("2 resultados")).toBeInTheDocument();
  });

  it("MAPUI-3: choosing a place applies it with the radius in force", async () => {
    const onSelect = vi.fn();
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json([makeNominatimResult()]),
      ),
    );
    renderWithI18n(<LocationPopover {...BASE} radiusKm={50} onSelect={onSelect} />, {
      locale: "es",
    });

    await userEvent.type(screen.getByRole("combobox"), "Ma");
    await userEvent.click(await screen.findByRole("option", { name: "MadridComunidad de Madrid" }));

    expect(onSelect).toHaveBeenCalledWith({
      placeId: 1,
      displayName: "Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("MAPUI-3: one character lists nothing and asks Nominatim nothing, even past the debounce (negative path)", async () => {
    const requested: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      if (request.url.startsWith("https://nominatim.openstreetmap.org/"))
        requested.push(request.url);
    };
    server.events.on("request:start", onRequest);
    try {
      renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

      await userEvent.type(screen.getByRole("combobox"), "M");
      // Past useLocationSearch's 400ms debounce.
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(requested).toEqual([]);
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
    } finally {
      server.events.removeListener("request:start", onRequest);
    }
  });
});

describe("MAPUI-4: LocationPopover — radius group", () => {
  it("MAPUI-4: offers 10, 25, 50, 100 and 200 km as a single-choice group", () => {
    renderWithI18n(
      <LocationPopover
        {...BASE}
        value={{ placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 }}
      />,
      { locale: "es" },
    );

    const group = screen.getByRole("radiogroup", { name: "Radio" });
    expect(group).toBeInTheDocument();
    for (const km of ["10 km", "25 km", "50 km", "100 km", "200 km"]) {
      expect(screen.getByRole("radio", { name: km })).toBeInTheDocument();
    }
  });

  it("MAPUI-4: choosing a radius applies it", async () => {
    const onRadiusChange = vi.fn();
    renderWithI18n(
      <LocationPopover
        {...BASE}
        value={{ placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 }}
        onRadiusChange={onRadiusChange}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("radio", { name: "100 km" }));

    expect(onRadiusChange).toHaveBeenCalledWith(100);
  });

  it("MAPUI-4: the radius group is disabled while no place is chosen", () => {
    renderWithI18n(<LocationPopover {...BASE} value={null} />, { locale: "es" });

    expect(screen.getByRole("radio", { name: "50 km" })).toBeDisabled();
  });
});

describe("MAPUI-5: LocationPopover — Toda España", () => {
  it("MAPUI-5: Toda España clears the chosen place", async () => {
    const onClear = vi.fn();
    renderWithI18n(
      <LocationPopover
        {...BASE}
        value={{ placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 }}
        onClear={onClear}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Toda España" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

// MAP-20 (docs/specs/map-and-search.md, amended by MAPUI-3): the cases of the
// removed LocationSearch whose behaviour lives on in «Dónde»'s field
// (PlaceField), moved here with their titles. They render in English, as they
// did there.
// The fixture's place and region; jsdom computes no CSS, so the option's two
// lines join with no space in its accessible name.
const madridOption = () => screen.findByRole("option", { name: "MadridComunidad de Madrid" });

/**
 * Presses an option the way a pointer does: mousedown, then the click the
 * option chooses on (ComboOption), both dispatched synchronously.
 */
function pressOption(option: HTMLElement) {
  fireEvent.mouseDown(option);
  fireEvent.click(option);
}

/** A search that never resolves, so the caller stays in its loading state. */
function holdNominatimPending() {
  server.use(
    http.get(
      "https://nominatim.openstreetmap.org/search",
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    ),
  );
}

describe("LocationSearch suggestions accessibility", () => {
  it("MAP-20: has no accessibility violations with a result showing", async () => {
    const { container } = renderWithI18n(<LocationPopover {...BASE} />);

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await madridOption();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("MAP-20: has no accessibility violations with no results", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    const { container } = renderWithI18n(<LocationPopover {...BASE} />);

    await userEvent.type(screen.getByRole("combobox"), "Nowhereville");
    await screen.findAllByText("No place by that name");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("MAP-20: renders no listbox when the search has no results", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    renderWithI18n(<LocationPopover {...BASE} />);

    await userEvent.type(screen.getByRole("combobox"), "Nowhereville");
    await screen.findAllByText("No place by that name");

    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-controls");
    expect(screen.getByRole("status").textContent).toBe("No place by that name");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("MAP-20: while a new search loads, ArrowDown then Enter selects nothing", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await madridOption();

    server.use(
      http.get(
        "https://nominatim.openstreetmap.org/search",
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      ),
    );
    await userEvent.type(screen.getByRole("combobox"), " y");

    await userEvent.keyboard("{ArrowDown}{Enter}");

    // The hidden options from the previous search are not selectable, so no
    // place is ever reported back.
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveValue("Madrid y");
  });

  it("MAP-20: the status region is mounted before any search", async () => {
    renderWithI18n(<LocationPopover {...BASE} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await madridOption();

    // Same node throughout — not torn down and remounted once a search
    // resolves — and it now announces the result count.
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe("1 result");
  });

  it("MAP-20: while loading, no listbox and the status reads Loading…", async () => {
    holdNominatimPending();
    renderWithI18n(<LocationPopover {...BASE} />);

    await userEvent.type(screen.getByRole("combobox"), "Madrid");

    expect(screen.getByRole("status").textContent).toBe("Loading…");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("MAP-20: typing again hides the previous options while the new search loads", async () => {
    renderWithI18n(<LocationPopover {...BASE} />);

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await madridOption();

    holdNominatimPending();
    await userEvent.type(screen.getByRole("combobox"), " y");

    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Loading…");
  });

  it("MAP-20: while the previous options animate out, they are not a listbox and a click selects nothing", async () => {
    // The other tests in this file run with Motion's animations skipped
    // (test/setup.jsdom.ts), so an exiting element is unmounted at once and
    // there is nothing mid-fade to assert against. This is the one test that
    // needs the exit to actually still be in flight — a frozen clock cannot
    // stand in for `withAnimations` here, because PlaceField's exit timing in
    // jsdom rides a real `setTimeout`, not a fakeable rAF/performance clock.
    await withAnimations(async () => {
      const onSelect = vi.fn();
      renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      const option = await madridOption();

      // An exit from opacity 0 is instant in Motion (0 to 0 is nothing to
      // animate), so the options would vanish before this test can observe
      // them mid-fade. Wait for the enter animation to have reached its
      // first frame before typing again and triggering the exit.
      await waitFor(() =>
        expect(Number(screen.getByRole("listbox").style.opacity)).toBeGreaterThan(0),
      );

      holdNominatimPending();
      await userEvent.type(screen.getByRole("combobox"), " y");

      expect(screen.queryByRole("listbox")).toBeNull();

      // `option` still points at the fading node: same element, mid-exit.
      expect(option).toBeInTheDocument();
      pressOption(option);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it("MAP-20: after clicking outside, the fading options are not a listbox and a click selects nothing", async () => {
    await withAnimations(async () => {
      const onSelect = vi.fn();
      renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      const option = await madridOption();
      // As above: let the enter animation start, so the exit has something to fade.
      await waitFor(() =>
        expect(Number(screen.getByRole("listbox").style.opacity)).toBeGreaterThan(0),
      );

      fireEvent.mouseDown(document.body);

      expect(screen.queryByRole("listbox")).toBeNull();
      // `option` still points at the fading node: same element, mid-exit.
      expect(option).toBeInTheDocument();
      pressOption(option);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it("MAP-20: after Escape, the fading options are not a listbox and a click selects nothing", async () => {
    await withAnimations(async () => {
      const onSelect = vi.fn();
      renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      const option = await madridOption();
      // As above: let the enter animation start, so the exit has something to fade.
      await waitFor(() =>
        expect(Number(screen.getByRole("listbox").style.opacity)).toBeGreaterThan(0),
      );

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).toBeNull();
      // `option` still points at the fading node: same element, mid-exit.
      expect(option).toBeInTheDocument();
      pressOption(option);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it("MAP-20: after selecting an option, the fading dropdown is not a listbox", async () => {
    await withAnimations(async () => {
      function ControlledLocationPopover() {
        const [value, setValue] = useState<LocationPopoverProps["value"]>(null);
        return <LocationPopover {...BASE} value={value} onSelect={setValue} />;
      }
      renderWithI18n(<ControlledLocationPopover />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      const option = await madridOption();

      // An option selects on click. Dispatched synchronously, so the 0.3s
      // exit cannot finish before the check below, however loaded the run is.
      fireEvent.click(option);

      // The dropdown is still fading out: the same node is still in the
      // document, no longer a listbox, until its exit animation finishes.
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(option).toBeInTheDocument();
    });
  });

  it("MAP-20: points the combobox at the listbox once results arrive", async () => {
    renderWithI18n(<LocationPopover {...BASE} />);

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await madridOption();

    // The id is generated (useId), not the removed LocationSearch's
    // hard-coded "location-listbox" — only the relationship is asserted.
    const listbox = screen.getByRole("listbox");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-controls", listbox.id);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
  });
});

// MAP-20's other cases from the removed LocationSearch (docs/specs/
// map-and-search.md, amended by MAPUI-3 and MAPUI-56), retargeted at «Dónde»'s
// field with their titles.
describe("LocationSearch suggestions", () => {
  it("selects with the keyboard alone", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    const option = await madridOption();
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", option.id);

    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      placeId: 1,
      displayName: "Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("dismisses the list on Escape without choosing", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await madridOption();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("combobox")).toHaveValue("Madrid");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("says so when the geocoder finds nothing", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Nowhereville");

    // The text renders twice: the always-mounted sr-only status region and
    // the visible, aria-hidden line in the list's place.
    const matches = await screen.findAllByText("No existe ningún lugar con ese nombre");
    expect(matches).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("No existe ningún lugar con ese nombre");
    expect(matches.some((element) => element.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<LocationPopover {...BASE} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("MAPUI-56: LocationPopover — a place Nominatim does not know", () => {
  it("MAPUI-56: «Villarriba» shows «No existe ningún lugar con ese nombre» in the polite status, with no listbox", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Villarriba");

    // Not findByRole("status"): the status is mounted from the start (MAP-20).
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("No existe ningún lugar con ese nombre"),
    );
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });
});

// docs/specs/redesign-map.md (MAPUI-56, amended 2026-10-14): when Nominatim
// itself is down, «Dónde» says so instead of claiming the place does not
// exist — a different message from the one above.
describe("MAPUI-56: LocationPopover — the place search is down", () => {
  it("MAPUI-56: a 500 from Nominatim shows «El buscador de lugares no responde. Prueba otra vez.», never the no-match line", async () => {
    server.use(
      http.get(
        "https://nominatim.openstreetmap.org/search",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Madrid");

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "El buscador de lugares no responde. Prueba otra vez.",
      ),
    );
    expect(screen.queryByText("No existe ningún lugar con ese nombre")).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("MAPUI-56: a network error shows the same search-down message", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.error()));
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Madrid");

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "El buscador de lugares no responde. Prueba otra vez.",
      ),
    );
    expect(screen.queryByText("No existe ningún lugar con ese nombre")).toBeNull();
  });

  it("MAPUI-56: an ok response finding nothing still shows the plain no-match line", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Villarriba");

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("No existe ningún lugar con ese nombre"),
    );
  });
});
