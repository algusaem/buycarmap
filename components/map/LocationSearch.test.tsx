import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MotionGlobalConfig } from "motion/react";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { renderWithI18n } from "@/test/utils/render";
import type { SelectedLocation } from "@/interfaces/location";
import { LocationSearch } from "./LocationSearch";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Real timers here, deliberately. useLocationSearch debounces by 400ms, but
// userEvent deadlocks under vi.useFakeTimers(): Testing Library's async wrapper
// waits on a setTimeout it only advances when it detects *jest's* fake clock,
// which Vitest does not expose. `findBy*` (1s default) covers the debounce.
const MADRID: SelectedLocation = {
  placeId: 1,
  displayName: "Madrid, Comunidad de Madrid",
  lat: 40.4168,
  lng: -3.7038,
};

// The distance trigger is also a combobox, so the text field is addressed by
// its placeholder.
const QUERY_PLACEHOLDER = /^City or address/;
const queryBox = () => screen.getByPlaceholderText(QUERY_PLACEHOLDER);
const madridOption = () => screen.findByRole("option", { name: MADRID.displayName });

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

/**
 * Runs `run` with Motion's real exit animation enabled instead of the
 * jsdom-wide `skipAnimations` from `test/setup.jsdom.ts`, restoring it
 * afterwards even if `run` throws.
 *
 * A frozen clock (`vi.useFakeTimers({ toFake: ["requestAnimationFrame",
 * "cancelAnimationFrame", "performance"] })`) was tried so the 0.3s exit
 * could never complete mid-test, but Motion's exit timing in jsdom rides a
 * real `setTimeout`, not the faked rAF/performance clock: a probe that waited
 * a real second with the clock frozen still found the option gone. So this
 * only toggles `skipAnimations`; the three tests below stay correct because
 * their assertions run synchronously, before the real 0.3s exit can finish.
 */
async function withAnimations(run: () => Promise<void>) {
  MotionGlobalConfig.skipAnimations = false;
  try {
    await run();
  } finally {
    MotionGlobalConfig.skipAnimations = true;
  }
}

function renderLocationSearch(
  overrides: Partial<React.ComponentProps<typeof LocationSearch>> = {},
) {
  const props = {
    selectedLocation: undefined,
    distanceInKm: 50,
    onLocationChange: vi.fn(),
    onDistanceChange: vi.fn(),
    ...overrides,
  };
  return { props, ...renderWithI18n(<LocationSearch {...props} />) };
}

describe("LocationSearch suggestions", () => {
  it("stays closed for a one-character query", async () => {
    renderLocationSearch();

    await userEvent.type(queryBox(), "M");

    // Below the two-character threshold the panel is closed by construction,
    // so there is no debounce to wait out.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(queryBox()).toHaveAttribute("aria-expanded", "false");
  });

  it("lists geocoded suggestions once the query settles", async () => {
    renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");

    expect(await madridOption()).toBeInTheDocument();
    expect(queryBox()).toHaveAttribute("aria-expanded", "true");
  });

  it("says so when the geocoder finds nothing", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    renderLocationSearch();

    await userEvent.type(queryBox(), "Nowhereville");

    // The text renders twice: the always-mounted sr-only status region and
    // the visible, aria-hidden line inside the dropdown.
    const matches = await screen.findAllByText("No locations found");
    expect(matches).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("No locations found");
    expect(matches.some((el) => el.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("reports the full location when a suggestion is clicked", async () => {
    const { props } = renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");
    await userEvent.click(await madridOption());

    expect(props.onLocationChange).toHaveBeenCalledWith(MADRID);
  });

  it("selects with the keyboard alone", async () => {
    const { props } = renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");
    const option = await madridOption();
    expect(option).toHaveAttribute("aria-selected", "false");

    await userEvent.keyboard("{ArrowDown}");
    expect(option).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");
    expect(props.onLocationChange).toHaveBeenCalledWith(MADRID);
  });

  it("ignores Enter while nothing is highlighted", async () => {
    const { props } = renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");
    await madridOption();
    await userEvent.keyboard("{Enter}");

    expect(props.onLocationChange).not.toHaveBeenCalled();
  });

  it("dismisses the list on Escape without choosing", async () => {
    const { props } = renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");
    await madridOption();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(props.onLocationChange).not.toHaveBeenCalled();
  });
});

describe("LocationSearch selected state", () => {
  it("shows the chosen place instead of the search box", () => {
    renderLocationSearch({ selectedLocation: MADRID });

    expect(screen.getByText(MADRID.displayName)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(QUERY_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("clears the chosen place", async () => {
    const { props } = renderLocationSearch({ selectedLocation: MADRID });

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(props.onLocationChange).toHaveBeenCalledWith(undefined);
  });
});

describe("LocationSearch distance", () => {
  it("reports the radius as a number", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { props } = renderLocationSearch();

    await user.click(screen.getByRole("combobox", { name: "Distance" }));
    await user.click(await screen.findByRole("option", { name: /100/ }));

    expect(props.onDistanceChange).toHaveBeenCalledWith(100);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderLocationSearch();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("LocationSearch suggestions accessibility", () => {
  it("MAP-20: has no accessibility violations with a result showing", async () => {
    const { container } = renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");
    await madridOption();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("MAP-20: has no accessibility violations with no results", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    const { container } = renderLocationSearch();

    await userEvent.type(queryBox(), "Nowhereville");
    await screen.findAllByText("No locations found");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("MAP-20: renders no listbox when the search has no results", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    renderLocationSearch();

    await userEvent.type(queryBox(), "Nowhereville");
    await screen.findAllByText("No locations found");

    expect(queryBox()).toHaveAttribute("aria-expanded", "false");
    expect(queryBox()).not.toHaveAttribute("aria-controls");
    expect(screen.getByRole("status")).toHaveTextContent("No locations found");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("MAP-20: points the combobox at the listbox once results arrive", async () => {
    renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");
    await madridOption();

    expect(queryBox()).toHaveAttribute("aria-controls", "location-listbox");
    expect(queryBox()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toHaveAttribute("id", "location-listbox");
  });

  it("MAP-20: the status region is mounted before any search", async () => {
    renderLocationSearch();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await userEvent.type(queryBox(), "Madrid");
    await madridOption();

    expect(screen.getByRole("status")).toBe(status);
  });

  it("MAP-20: while loading, no listbox and the status reads Loading…", async () => {
    holdNominatimPending();
    renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(queryBox()).toHaveAttribute("aria-expanded", "false");
    expect(queryBox()).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("MAP-20: typing again hides the previous options while the new search loads", async () => {
    renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");
    await madridOption();

    holdNominatimPending();
    await userEvent.type(queryBox(), " y");

    expect(queryBox()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("MAP-20: while a new search loads, ArrowDown then Enter selects nothing", async () => {
    const { props } = renderLocationSearch();

    await userEvent.type(queryBox(), "Madrid");
    await madridOption();

    holdNominatimPending();
    await userEvent.type(queryBox(), " y");

    await userEvent.keyboard("{ArrowDown}{Enter}");

    // The hidden options from the previous search are not selectable, so no
    // location is ever reported back — the chip that would replace this box
    // is driven entirely by that call.
    expect(props.onLocationChange).not.toHaveBeenCalled();
    expect(queryBox()).toHaveValue("Madrid y");
  });

  it("MAP-20: while the previous options animate out, they are not a listbox and a click selects nothing", async () => {
    // The other tests in this file run with Motion's animations skipped
    // (test/setup.jsdom.ts), so an exiting element is unmounted at once and
    // there is nothing mid-fade to assert against. This is the one test that
    // needs the exit to actually still be in flight.
    await withAnimations(async () => {
      const { props } = renderLocationSearch();

      await userEvent.type(queryBox(), "Madrid");
      const option = await madridOption();

      holdNominatimPending();
      await userEvent.type(queryBox(), " y");

      expect(screen.queryByRole("listbox")).toBeNull();

      // `option` still points at the fading node: same element, mid-exit.
      expect(option).toBeInTheDocument();
      fireEvent.mouseDown(option);

      expect(props.onLocationChange).not.toHaveBeenCalled();
    });
  });

  it("MAP-20: after Escape, the fading options are not a listbox and a click selects nothing", async () => {
    await withAnimations(async () => {
      const { props } = renderLocationSearch();

      await userEvent.type(queryBox(), "Madrid");
      const option = await madridOption();

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).toBeNull();
      // `option` still points at the fading node: same element, mid-exit.
      expect(option).toBeInTheDocument();
      fireEvent.mouseDown(option);

      expect(props.onLocationChange).not.toHaveBeenCalled();
    });
  });

  it("MAP-20: after selecting an option, the fading dropdown is not a listbox", async () => {
    await withAnimations(async () => {
      function ControlledLocationSearch() {
        const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | undefined>();
        return (
          <LocationSearch
            selectedLocation={selectedLocation}
            distanceInKm={50}
            onLocationChange={setSelectedLocation}
            onDistanceChange={vi.fn()}
          />
        );
      }
      renderWithI18n(<ControlledLocationSearch />);

      await userEvent.type(queryBox(), "Madrid");
      const option = await madridOption();

      await userEvent.click(option);

      // The chip has replaced the search box…
      expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
      // …but the dropdown is still fading out: the same node is still in the
      // document, no longer a listbox, until its exit animation finishes.
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(option).toBeInTheDocument();
    });
  });
});
