import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { withAnimations } from "@/test/utils/animations";
import { renderWithI18n } from "@/test/utils/render";
import { makeNominatimResult } from "@/test/fixtures/nominatim";
import { LocationPopover, type LocationPopoverProps } from "./LocationPopover";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

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

// docs/specs/redesign-map.md (MAPUI-77, owner report 2026-10-31): «Dónde»
// shows «Ciudad…» when empty and is named «Ciudad» (never mentioning postal
// codes), on the map and the landing, desktop and phone; a postal code typed
// there still lists what Nominatim answers.
describe("MAPUI-77: LocationPopover — the field is named Ciudad, not Ciudad o código postal", () => {
  it("MAPUI-77: the field is named Ciudad in Spanish", () => {
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /código postal/i })).toBeNull();
  });

  it("MAPUI-77: the field is named City in English, with no mention of a postcode", () => {
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "en" });

    expect(screen.getByRole("combobox", { name: "City" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /postcode|postal/i })).toBeNull();
  });

  it("MAPUI-77: a postal code typed there still lists what Nominatim answers (worked example «28013» → Madrid)", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json([makeNominatimResult()]),
      ),
    );
    renderWithI18n(<LocationPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox", { name: "Ciudad" }), "28013");

    expect(
      await screen.findByRole("option", { name: "MadridComunidad de Madrid" }),
    ).toBeInTheDocument();
  });
});

// docs/specs/redesign-map.md (MAPUI-78, bug fix, owner report 2026-10-31):
// Enter chooses the highlighted option or, with none highlighted, the first
// listed — exactly the worked example «Enter in «Dónde»».
describe("MAPUI-78: LocationPopover — Enter chooses the highlighted option or the first", () => {
  function twoPlaces() {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () =>
        HttpResponse.json([
          makeNominatimResult(),
          makeNominatimResult({
            place_id: 2,
            display_name: "Barcelona, España",
            lat: "41.3851",
            lon: "2.1734",
            address: { city: "Barcelona", state: "Cataluña" },
          }),
        ]),
      ),
    );
  }

  it("MAPUI-78: with two places listed and none highlighted, Enter chooses the first (worked example «28013» → Madrid)", async () => {
    const onSelect = vi.fn();
    twoPlaces();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "28013");
    await screen.findAllByRole("option");

    await userEvent.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      placeId: 1,
      displayName: "Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("MAPUI-78: ArrowDown twice then Enter chooses the second listed place", async () => {
    const onSelect = vi.fn();
    twoPlaces();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "28013");
    await screen.findAllByRole("option");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      placeId: 2,
      displayName: "Barcelona",
      lat: 41.3851,
      lng: 2.1734,
    });
  });

  it("MAPUI-78: the list closed with Escape, ArrowDown reopens it and Enter chooses the first listed", async () => {
    const onSelect = vi.fn();
    twoPlaces();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "28013");
    await screen.findAllByRole("option");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      placeId: 1,
      displayName: "Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });
});

// docs/specs/redesign-map.md (MAPUI-79): Enter chooses nothing, and the field
// keeps its text and any message, when no search is running and nothing is
// listed — under two characters, no place found, the place search down, or
// the list closed with Escape.
describe("MAPUI-79: LocationPopover — Enter chooses nothing when nothing is listed", () => {
  it("MAPUI-79: under two characters, Enter chooses nothing", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });
    const combobox = screen.getByRole("combobox");

    await userEvent.type(combobox, "M");
    await userEvent.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(combobox).toHaveValue("M");
  });

  it("MAPUI-79: no place found, Enter chooses nothing and keeps the no-match message", async () => {
    const onSelect = vi.fn();
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });
    const combobox = screen.getByRole("combobox");

    await userEvent.type(combobox, "Villarriba");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("No existe ningún lugar con ese nombre"),
    );

    await userEvent.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(combobox).toHaveValue("Villarriba");
    expect(screen.getByRole("status").textContent).toBe("No existe ningún lugar con ese nombre");
  });

  it("MAPUI-79: the place search down, Enter chooses nothing and keeps the down message", async () => {
    const onSelect = vi.fn();
    server.use(
      http.get(
        "https://nominatim.openstreetmap.org/search",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });
    const combobox = screen.getByRole("combobox");

    await userEvent.type(combobox, "Madrid");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "El buscador de lugares no responde. Prueba otra vez.",
      ),
    );

    await userEvent.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(combobox).toHaveValue("Madrid");
    expect(screen.getByRole("status").textContent).toBe(
      "El buscador de lugares no responde. Prueba otra vez.",
    );
  });

  it("MAPUI-79: the list closed with Escape, a further Enter chooses nothing and keeps the text", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });
    const combobox = screen.getByRole("combobox");

    await userEvent.type(combobox, "Madrid");
    await screen.findByRole("option");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();

    await userEvent.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(combobox).toHaveValue("Madrid");
  });
});

// docs/specs/redesign-map.md (MAPUI-81, amends MAP-20): Enter while the
// search for the typed text is running chooses nothing yet, and chooses the
// first place once that search lists one — never an earlier search's places,
// and never once the text changed, the search found nothing or failed, or
// the field was left.
describe("MAPUI-81: LocationPopover — Enter while the search is running", () => {
  // The exposed `server.events` type only carries "on"/"removeListener"/
  // "removeAllListeners", not "once", so a single-fire subscription needs
  // manual unsubscribing. Mirrors lib/hooks/useLocationSearch.test.tsx.
  function waitForNextMockedResponse(): Promise<void> {
    return new Promise((resolve) => {
      const onMocked = () => {
        server.events.removeListener("response:mocked", onMocked);
        resolve();
      };
      server.events.on("response:mocked", onMocked);
    });
  }

  /** One controllable Nominatim request per call, resolved in the order made. */
  function controllableNominatim() {
    const resolvers: Array<(response: Response) => void> = [];
    server.use(
      http.get(
        "https://nominatim.openstreetmap.org/search",
        () =>
          new Promise<Response>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    );
    return {
      pendingCount: () => resolvers.length,
      resolveNext(results: ReturnType<typeof makeNominatimResult>[]) {
        const resolve = resolvers.shift();
        if (!resolve) throw new Error("no pending Nominatim request to resolve");
        resolve(HttpResponse.json(results));
      },
      resolveNextWithStatus(status: number) {
        const resolve = resolvers.shift();
        if (!resolve) throw new Error("no pending Nominatim request to resolve");
        resolve(new HttpResponse(null, { status }));
      },
    };
  }

  it("MAPUI-81: Enter while pending chooses nothing yet, then the first place once the search answers", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));

    await userEvent.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();

    nominatim.resolveNext([makeNominatimResult()]);

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect).toHaveBeenCalledWith({
      placeId: 1,
      displayName: "Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("MAPUI-81: changing the text after Enter drops the pending choice, and the new search's answer is not auto-chosen either", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Mad");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    await userEvent.keyboard("{Enter}");

    await userEvent.type(screen.getByRole("combobox"), "r");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(2));

    nominatim.resolveNext([makeNominatimResult()]);
    nominatim.resolveNext([
      makeNominatimResult({
        place_id: 3,
        display_name: "Madridejos, España",
        address: { city: "Madridejos", state: "Toledo" },
      }),
    ]);

    // Neither the superseded search's answer nor the new one's is ever
    // auto-chosen: the Enter pressed before the text changed does not carry
    // over to it.
    await screen.findByRole("option", { name: /^Madridejos/ });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("MAPUI-81: the pending search finding nothing drops the Enter, with the no-match message shown", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Villarriba");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    await userEvent.keyboard("{Enter}");

    nominatim.resolveNext([]);

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("No existe ningún lugar con ese nombre"),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("MAPUI-81: the pending search failing drops the Enter, with the down message shown", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    await userEvent.keyboard("{Enter}");

    nominatim.resolveNextWithStatus(500);

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "El buscador de lugares no responde. Prueba otra vez.",
      ),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("MAPUI-81: leaving the field after Enter drops it — nothing is chosen once the answer arrives", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });
    const combobox = screen.getByRole("combobox");

    await userEvent.type(combobox, "Madrid");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    await userEvent.keyboard("{Enter}");
    fireEvent.blur(combobox);

    nominatim.resolveNext([makeNominatimResult()]);

    await screen.findByRole("option", { name: "MadridComunidad de Madrid" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("MAPUI-81: with «Mad» already listed, typing another character and pressing Enter immediately chooses only the new search's first place", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Mad");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    nominatim.resolveNext([makeNominatimResult()]);
    await screen.findByRole("option");

    await userEvent.type(screen.getByRole("combobox"), "r");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    await userEvent.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();

    nominatim.resolveNext([
      makeNominatimResult({
        place_id: 3,
        display_name: "Madridejos, España",
        lat: "39.4668",
        lon: "-3.5323",
        address: { city: "Madridejos", state: "Toledo" },
      }),
    ]);

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect).toHaveBeenCalledWith({
      placeId: 3,
      displayName: "Madridejos",
      lat: 39.4668,
      lng: -3.5323,
    });
  });

  it("MAPUI-81: Madrid{Enter} typed in one go, inside the debounce, chooses the first place once the request resolves", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Madrid{Enter}");
    expect(onSelect).not.toHaveBeenCalled();

    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    nominatim.resolveNext([makeNominatimResult()]);

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect).toHaveBeenCalledWith({
      placeId: 1,
      displayName: "Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("MAPUI-81: ArrowDown while pending does nothing — Enter still resolves to the first of two answers", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();

    nominatim.resolveNext([
      makeNominatimResult(),
      makeNominatimResult({
        place_id: 4,
        display_name: "Barcelona, Catalunya",
        lat: "41.3874",
        lon: "2.1686",
        address: { city: "Barcelona", state: "Catalunya" },
      }),
    ]);

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect).toHaveBeenCalledWith({
      placeId: 1,
      displayName: "Madrid",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("MAPUI-81: unmounting after Enter while pending drops the choice once the search answers", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    const { unmount } = renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, {
      locale: "es",
    });

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    await userEvent.keyboard("{Enter}");

    unmount();
    const responseMocked = waitForNextMockedResponse();
    nominatim.resolveNext([makeNominatimResult()]);
    await responseMocked;

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("MAPUI-81: pressing Enter twice during a search still chooses only once", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));

    await userEvent.keyboard("{Enter}{Enter}");
    nominatim.resolveNext([makeNominatimResult()]);

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
  });

  it("MAPUI-81: Borrar texto after Enter drops the pending choice, even once the new search finds a place", async () => {
    const onSelect = vi.fn();
    const nominatim = controllableNominatim();
    renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Madrid");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(1));
    await userEvent.keyboard("{Enter}");

    await userEvent.click(screen.getByRole("button", { name: "Borrar texto" }));
    await userEvent.type(screen.getByRole("combobox"), "Ba");
    await waitFor(() => expect(nominatim.pendingCount()).toBe(2));

    // The superseded "Madrid" request, resolved first, then "Ba"'s own.
    nominatim.resolveNext([makeNominatimResult()]);
    nominatim.resolveNext([
      makeNominatimResult({
        place_id: 4,
        display_name: "Barcelona, Catalunya",
        lat: "41.3874",
        lon: "2.1686",
        address: { city: "Barcelona", state: "Catalunya" },
      }),
    ]);

    await screen.findByRole("option", { name: /^Barcelona/ });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// MAP-20 (docs/specs/map-and-search.md, amended by MAPUI-3): the cases of the
// removed LocationSearch whose behaviour lives on in «Dónde»'s field
// (PlaceField), moved here with their titles. They render in English, as they
// did there.
// The fixture's place and region; jsdom computes no CSS, so the option's two
// lines join with no space in its accessible name.
const madridOption = () => screen.findByRole("option", { name: "MadridComunidad de Madrid" });

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

  // docs/specs/motion.md (MOTION-13, amends this case and the three below):
  // the type-ahead list is driven by typing and the arrow keys, so it never
  // animates — its options are gone at once, with nothing left mid-fade to
  // press.
  it("MOTION-13: typing that finds a result shows the listbox and its option with no inline opacity below 1, even with animations enabled", async () => {
    await withAnimations(async () => {
      renderWithI18n(<LocationPopover {...BASE} />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");

      const option = await madridOption();
      const listbox = screen.getByRole("listbox");
      for (const el of [listbox, option]) {
        const opacity = el.style.opacity;
        expect(opacity === "" || Number(opacity) >= 1).toBe(true);
      }
    });
  });

  it("MOTION-13: a pointerdown before the results arrive still shows them with no inline opacity below 1", async () => {
    await withAnimations(async () => {
      renderWithI18n(<LocationPopover {...BASE} />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      window.dispatchEvent(new PointerEvent("pointerdown"));

      const option = await madridOption();
      const listbox = screen.getByRole("listbox");
      for (const el of [listbox, option]) {
        const opacity = el.style.opacity;
        expect(opacity === "" || Number(opacity) >= 1).toBe(true);
      }
    });
  });

  it("MOTION-13: once the previous options are replaced by a new search, they are gone at once — no fading option left to press", async () => {
    await withAnimations(async () => {
      const onSelect = vi.fn();
      renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      const option = await madridOption();

      holdNominatimPending();
      await userEvent.type(screen.getByRole("combobox"), " y");

      expect(option).not.toBeInTheDocument();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.queryByRole("option")).toBeNull();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it("MOTION-13: after clicking outside, the options are gone at once — no fading option left to press", async () => {
    await withAnimations(async () => {
      const onSelect = vi.fn();
      renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      const option = await madridOption();

      await userEvent.click(document.body);

      expect(option).not.toBeInTheDocument();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.queryByRole("option")).toBeNull();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it("MOTION-13: after Escape, the options are gone at once — no fading option left to press", async () => {
    await withAnimations(async () => {
      const onSelect = vi.fn();
      renderWithI18n(<LocationPopover {...BASE} onSelect={onSelect} />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      const option = await madridOption();

      await userEvent.keyboard("{Escape}");

      expect(option).not.toBeInTheDocument();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.queryByRole("option")).toBeNull();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it("MOTION-13: after selecting an option, the dropdown is gone at once", async () => {
    await withAnimations(async () => {
      function ControlledLocationPopover() {
        const [value, setValue] = useState<LocationPopoverProps["value"]>(null);
        return <LocationPopover {...BASE} value={value} onSelect={setValue} />;
      }
      renderWithI18n(<ControlledLocationPopover />);

      await userEvent.type(screen.getByRole("combobox"), "Madrid");
      const option = await madridOption();

      await userEvent.click(option);

      expect(option).not.toBeInTheDocument();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.queryByRole("option")).toBeNull();
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
