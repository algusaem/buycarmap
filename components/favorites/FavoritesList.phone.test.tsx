import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { TabBar } from "@/components/nav/TabBar";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { letterOf, renderSaved, row, rowOrder, rows } from "@/test/utils/saved";
import { restoreMatchMedia, stubLayoutBox, stubPhoneWidth } from "@/test/utils/viewport";
import {
  FAVORITE_INVALID_LISTING,
  FAVORITE_OK,
  SAVED_COPY,
  unanswered,
} from "@/test/fixtures/favorites";
import {
  makeSortExampleCar,
  SORT_EXAMPLE_ORDER,
  SORT_EXAMPLE_TITLE,
  type SortExampleLetter,
  sortExampleFavorites,
} from "@/test/fixtures/favorite-listings";
import { removeFavorite, saveFavorite } from "@/server/favorites/actions";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// docs/specs/redesign-saved.md (SAVED-2, SAVED-8, SAVED-18 to SAVED-22,
// SAVED-31) at phone width: matchMedia reports `(width < 64rem)`, the query
// useIsPhone (lib/hooks/useIsPhone.ts) reads, so the page renders the
// compact rows and the car sheet. The desktop composition is
// FavoritesList.test.tsx's; the measured sizes (SAVED-3, SAVED-23) are
// e2e/saved.spec.ts's.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/favorites",
  useSearchParams: () => new URLSearchParams(),
}));
interface SessionState {
  data: { user: { id: string; name: string } } | null;
  isPending: boolean;
}
const SIGNED_IN: SessionState = {
  data: { user: { id: "user-ada", name: "Ada" } },
  isPending: false,
};
// Signed in unless a test says otherwise; FAV-18's case makes it still resolving.
const useSession = vi.fn<() => SessionState>(() => SIGNED_IN);
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));
vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavorites: vi.fn(),
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("maplibre-gl", () => import("@/test/utils/maplibre"));

// jsdom has no layout: every element reports a tall box (test/utils/viewport.ts),
// so the virtualised list (SAVED-25) mounts all of these few rows.
stubLayoutBox({ width: 390 });

beforeEach(() => {
  stubPhoneWidth();
  useSession.mockImplementation(() => SIGNED_IN);
  vi.mocked(removeFavorite).mockReset();
  vi.mocked(removeFavorite).mockResolvedValue(FAVORITE_OK);
  vi.mocked(saveFavorite).mockReset();
  vi.mocked(saveFavorite).mockResolvedValue(FAVORITE_OK);
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  restoreMatchMedia();
});

const TITLE = SORT_EXAMPLE_TITLE;

const RECENT = SORT_EXAMPLE_ORDER.recent;
const REMOVED = SAVED_COPY.removed;
const UNDO = SAVED_COPY.undo;
const REMOVE = SAVED_COPY.remove;
const UNEXPECTED = SAVED_COPY.unexpected;

async function openSheet(letter: SortExampleLetter): Promise<HTMLElement> {
  await userEvent.click(row(letter));
  return screen.findByRole("dialog", { name: TITLE[letter] });
}

async function removeFromSheet(letter: SortExampleLetter) {
  const sheet = await openSheet(letter);
  await userEvent.click(within(sheet).getByRole("button", { name: REMOVE }));
}

describe("SAVED-2: the page at phone width", () => {
  it("SAVED-2: shows the heading «Guardados» and the saved cars as compact rows, with no map, no chips and no cards", () => {
    renderSaved();

    expect(screen.getByRole("heading", { level: 1, name: "Guardados" })).toBeInTheDocument();
    expect(rows()).toHaveLength(7);
    expect(screen.queryByRole("region", { name: "Mapa de tus guardados" })).not.toBeInTheDocument();
    expect(document.querySelector(".maplibregl-map")).toBeNull();
    expect(screen.queryByRole("button", { name: "Recientes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Precio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Km" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toEqual([]);
  });

  it("SAVED-2: the tab bar beside it has «Guardados» current", () => {
    renderWithI18n(<TabBar />, { locale: "es" });

    expect(screen.getByRole("link", { name: /Guardados/ })).toHaveAttribute("aria-current", "page");
  });
});

describe("SAVED-8: the phone ignores the sort", () => {
  it("SAVED-8: /favorites?sort=price at phone width lists newest saved first — C, E, B, D, A, G, F", () => {
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=price" });

    expect(rowOrder()).toEqual(RECENT);
  });

  it("SAVED-8: the page leaves the URL's sort as it is", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderSaved(sortExampleFavorites(), { searchParams: "?sort=km", onUrlUpdate });

    await waitFor(() => expect(rows()).toHaveLength(7));
    expect(rowOrder()).toEqual(RECENT);
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe("SAVED-19: the compact row", () => {
  it("SAVED-19: is one button that opens a dialog, holding the thumbnail, the name, «año · km · ciudad» and the price", () => {
    const audi = makeSortExampleCar("A");
    renderSaved([audi]);
    const audiRow = row("A");

    expect(audiRow.tagName).toBe("BUTTON");
    expect(audiRow).toHaveAttribute("aria-haspopup", "dialog");
    expect(audiRow.querySelector("img")).toHaveAttribute("src", audi.image);
    expect(within(audiRow).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    expect(within(audiRow).getByText("2018 · 95.000 km · Madrid")).toBeInTheDocument();
    expect(within(audiRow).getByText("14.500 €")).toBeInTheDocument();
  });

  it("SAVED-19: the thumbnail carries no source badge and no heart", () => {
    renderSaved([makeSortExampleCar("A")]);
    const audiRow = row("A");

    expect(within(audiRow).queryByText("Wallapop")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REMOVE })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("SAVED-19: «año · km · ciudad» shows only the parts that are known", () => {
    renderSaved([makeSortExampleCar("D")]);

    // D's km is unknown (0).
    expect(within(row("D")).getByText("2018 · Sevilla")).toBeInTheDocument();
  });

  it("SAVED-19: with no photo the thumbnail is the car's tint with the car icon", () => {
    renderSaved([makeSortExampleCar("A", { image: "" })]);
    const audiRow = row("A");

    expect(audiRow.querySelector("img")).toBeNull();
    expect(audiRow.querySelector(".lucide-car")).not.toBeNull();
  });
});

// docs/specs/motion.md (MOTION-9): the saved phone list's hover rows turn on
// and off with no transition.
describe("MOTION-9: FavoritesList (phone) — the row's hover has no transition", () => {
  it("MOTION-9: the row carries no transition class at all", () => {
    renderSaved([makeSortExampleCar("A")]);

    expect(row("A").className).not.toMatch(/(^|\s)transition(-|\s|$)/);
  });
});

describe("SAVED-20: the car sheet", () => {
  it("SAVED-20: pressing a row opens a dialog named by the car, with «Cerrar», the photo and badge, name and city, «año · km · combustible», the price, «Quitar de guardados» and «Ver anuncio»", async () => {
    const audi = makeSortExampleCar("A");
    renderSaved([audi]);

    const sheet = await openSheet("A");

    expect(within(sheet).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(sheet.querySelector("img")).toHaveAttribute("src", audi.image);
    expect(within(sheet).getByText("Wallapop")).toBeInTheDocument();
    expect(within(sheet).getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    expect(within(sheet).getByText("Madrid")).toBeInTheDocument();
    // makeFavoriteInput's fuel is "gasoil", «Diésel» under MAPUI-35.
    expect(within(sheet).getByText("2018 · 95.000 km · Diésel")).toBeInTheDocument();
    expect(within(sheet).getByText("14.500 €")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: REMOVE })).toBeInTheDocument();
    const viewListing = within(sheet).getByRole("link", { name: /Ver anuncio/ });
    expect(viewListing).toHaveAttribute("href", audi.url);
    expect(viewListing).toHaveAttribute("target", "_blank");
    expect(viewListing).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("SAVED-20: with no photo the sheet shows the car's tint with the car icon", async () => {
    renderSaved([makeSortExampleCar("A", { image: "" })]);

    const sheet = await openSheet("A");

    expect(sheet.querySelector("img")).toBeNull();
    expect(sheet.querySelector(".lucide-car")).not.toBeNull();
  });
});

describe("SAVED-21: opening and closing the car sheet", () => {
  it("SAVED-21: «Cerrar» closes it, fading out with Motion, and focus returns to its row", async () => {
    renderSaved();

    await withAnimations(async (clock) => {
      const sheet = await openSheet("B");
      await clock.finish();
      await userEvent.click(within(sheet).getByRole("button", { name: "Cerrar" }));

      // Still mounted while its exit plays, then gone.
      expect(screen.getByRole("dialog", { name: TITLE.B })).toBeInTheDocument();
      await clock.finish();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    expect(row("B")).toHaveFocus();
  });

  it("SAVED-21: Escape closes it and focus returns to its row", async () => {
    renderSaved();
    await openSheet("B");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(row("B")).toHaveFocus();
  });

  it("SAVED-21: a press outside it closes it and focus returns to its row", async () => {
    renderSaved();
    await openSheet("B");

    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(row("B")).toHaveFocus();
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-12: the phone sheet
// appears at once when opened from the keyboard, and disappears at once when
// closed with Escape; opened or closed with a pointer, it still slides
// (amends SAVED-21, whose pointer-close test above is the kept pointer twin).
describe("MOTION-12: FavoritesList (phone) — the car sheet opens and closes at once from the keyboard", () => {
  it("MOTION-12: Enter on a row opens the sheet with no inline transform left at its off-screen offset, even with animations enabled", async () => {
    await withAnimations(async () => {
      renderSaved();
      row("B").focus();

      await userEvent.keyboard("{Enter}");

      const sheet = await screen.findByRole("dialog", { name: TITLE.B });
      expect(sheet.style.transform).not.toContain("100%");
    });
  });

  it("MOTION-12: Escape closes the sheet in the same tick, with no exit animation to wait for", async () => {
    await withAnimations(async () => {
      renderSaved();
      await openSheet("B");

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
  it("MOTION-12: «Cerrar» activated with Enter closes the sheet in the same tick", async () => {
    await withAnimations(async () => {
      renderSaved();
      row("B").focus();
      await userEvent.keyboard("{Enter}");
      const sheet = await screen.findByRole("dialog", { name: TITLE.B });
      within(sheet).getByRole("button", { name: "Cerrar" }).focus();

      await userEvent.keyboard("{Enter}");

      expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    });
  });

  it("MOTION-12: «Cerrar» activated with Space closes the sheet in the same tick", async () => {
    await withAnimations(async () => {
      renderSaved();
      row("B").focus();
      await userEvent.keyboard("{Enter}");
      const sheet = await screen.findByRole("dialog", { name: TITLE.B });
      within(sheet).getByRole("button", { name: "Cerrar" }).focus();

      await userEvent.keyboard(" ");

      expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    });
  });

  it("MOTION-12: a press on a row still slides the sheet up — right after it, the sheet is mid-slide", async () => {
    await withAnimations(async () => {
      renderSaved();

      const sheet = await openSheet("B");

      expect(sheet.style.transform).toContain("translateY(");
      expect(sheet.style.transform).not.toMatch(/^(none|translateY\(0px\))$/);
    });
  });
});

describe("SAVED-41: the car sheet's «Cerrar» is visually hidden", () => {
  it("SAVED-41: «Cerrar» is a named button, visually hidden until keyboard focus, reached with Tab, and pressing it closes the sheet with focus back on its row", async () => {
    renderSaved();
    const sheet = await openSheet("B");
    const close = within(sheet).getByRole("button", { name: "Cerrar" });

    expect(close).toHaveClass(
      "sr-only",
      "not-focus-visible:size-px",
      "focus-visible:not-sr-only",
      "focus-visible:size-10",
    );
    for (let press = 0; press < 20 && document.activeElement !== close; press++) {
      await userEvent.tab();
    }
    expect(close).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(row("B")).toHaveFocus();
  });
});

describe("SAVED-22: removing from the car sheet", () => {
  it("SAVED-22: «Quitar de guardados» closes the sheet, removes the row at once and toasts «Quitado de guardados» with «Deshacer»", async () => {
    vi.mocked(removeFavorite).mockReturnValue(unanswered());
    renderSaved();

    await removeFromSheet("A");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(rowOrder()).toEqual(["C", "E", "B", "D", "G", "F"]);
    expect(removeFavorite).toHaveBeenCalledWith("wallapop-a");
    expect(await screen.findByText(REMOVED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: UNDO })).toBeInTheDocument();
  });

  it("SAVED-22: «Deshacer» brings the row back in its place", async () => {
    renderSaved();
    await removeFromSheet("A");

    await userEvent.click(await screen.findByRole("button", { name: UNDO }));

    expect(saveFavorite).toHaveBeenCalledWith(makeSortExampleCar("A"));
    expect(rowOrder()).toEqual(RECENT);
  });

  it("SAVED-22: a removal that throws puts the row back, with «Algo ha salido mal. Inténtalo de nuevo.» (SAVED-16)", async () => {
    vi.mocked(removeFavorite).mockRejectedValue(new Error("connection reset"));
    renderSaved();

    await removeFromSheet("A");

    expect(await screen.findByText(UNEXPECTED)).toBeInTheDocument();
    await waitFor(() => expect(rowOrder()).toEqual(RECENT));
  });

  it("SAVED-22: a refused undo ends with the row out, with «No se pudo guardar ese anuncio.» (SAVED-17)", async () => {
    vi.mocked(saveFavorite).mockResolvedValue(FAVORITE_INVALID_LISTING);
    renderSaved();
    await removeFromSheet("A");

    await userEvent.click(await screen.findByRole("button", { name: UNDO }));

    expect(await screen.findByText("No se pudo guardar ese anuncio.")).toBeInTheDocument();
    await waitFor(() => expect(rowOrder()).toEqual(["C", "E", "B", "D", "G", "F"]));
  });
});

describe("SAVED-18: where focus goes after a removal (phone)", () => {
  it("SAVED-18: to the next row", async () => {
    renderSaved();

    await removeFromSheet("A");

    // Recientes: … D, A, G, F — G follows A.
    await waitFor(() => expect(row("G")).toHaveFocus());
  });

  it("SAVED-18: to the previous row when the removed row was the last", async () => {
    renderSaved();

    await removeFromSheet("F");

    await waitFor(() => expect(row("G")).toHaveFocus());
  });

  it("SAVED-18: to the empty state's heading when none is left", async () => {
    renderSaved([makeSortExampleCar("A")]);

    await removeFromSheet("A");

    await waitFor(() => expect(screen.getByRole("heading", { level: 2 })).toHaveFocus());
  });
});

describe("SAVED-31: the empty state (phone)", () => {
  it("SAVED-31: shows «Guardados», «¿Aún nada?» over «Guarda alguno», the phone line and «Buscar coches» to /map", () => {
    renderSaved([]);

    expect(screen.getByRole("heading", { level: 1, name: "Guardados" })).toBeInTheDocument();
    const empty = screen.getByRole("heading", { level: 2 });
    expect(empty).toHaveTextContent("¿Aún nada?");
    expect(empty).toHaveTextContent("Guarda alguno");
    expect(
      screen.getByText("Pulsa el corazón en cualquier coche y aparecerá aquí."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Pulsa el corazón en cualquier coche y aparecerá aquí, con su precio del día.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buscar coches" })).toHaveAttribute("href", "/map");
    expect(screen.queryByRole("button", { name: "Recientes" })).not.toBeInTheDocument();
  });
});

describe("SAVED-19, SAVED-20: a photo that fails to load", () => {
  it("SAVED-19: the row's thumbnail gives way to the car's tint with the car icon", () => {
    renderSaved([makeSortExampleCar("A")]);
    const photo = row("A").querySelector("img");
    expect(photo).not.toBeNull();

    fireEvent.error(photo as HTMLImageElement);

    expect(row("A").querySelector("img")).toBeNull();
    expect(row("A").querySelector(".lucide-car")).not.toBeNull();
  });

  it("SAVED-20: the sheet's photo gives way to the car's tint with the car icon, the badge still over it", async () => {
    renderSaved([makeSortExampleCar("A")]);
    const sheet = await openSheet("A");
    const photo = sheet.querySelector("img");
    expect(photo).not.toBeNull();

    fireEvent.error(photo as HTMLImageElement);

    expect(sheet.querySelector("img")).toBeNull();
    expect(sheet.querySelector(".lucide-car")).not.toBeNull();
    expect(within(sheet).getByText("Wallapop")).toBeInTheDocument();
  });
});

describe("FAV-18: the car sheet while the session is still resolving", () => {
  it("FAV-18: «Quitar de guardados» does nothing — no removal, the rows unchanged, no toast — and the sheet stays open", async () => {
    useSession.mockImplementation(() => ({ data: null, isPending: true }));
    renderSaved();

    await removeFromSheet("A");
    await act(async () => {
      // Lets any toast the press might have scheduled land.
    });

    expect(removeFavorite).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: TITLE.A })).toBeInTheDocument();
    // Read from the DOM: the open modal hides the rows from the accessibility tree.
    const drawn = Array.from(
      document.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]'),
    ).map(letterOf);
    expect(drawn).toEqual(RECENT);
    expect(screen.queryByText(REMOVED)).not.toBeInTheDocument();
  });
});
