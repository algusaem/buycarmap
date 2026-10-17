import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { Toaster } from "@/components/Toaster";
import type { CarListing } from "@/interfaces/listing";
import {
  SORT_EXAMPLE_LETTERS,
  SORT_EXAMPLE_TITLE,
  type SortExampleLetter,
  sortExampleFavorites,
} from "@/test/fixtures/favorite-listings";
import { type RenderWithI18nOptions, renderWithI18n } from "@/test/utils/render";

// The /favorites list as components/favorites/FavoritesList.test.tsx (desktop)
// and FavoritesList.phone.test.tsx (phone) render it and look it up: the cars
// of docs/specs/redesign-saved.md's worked example "Sort", by their letter.

type RenderOptions = Pick<RenderWithI18nOptions, "searchParams" | "onUrlUpdate">;

/** The page's list with the app's Toaster, in Spanish, opened at `searchParams`. */
export function renderSaved(
  favorites: CarListing[] = sortExampleFavorites(),
  options: RenderOptions = {},
) {
  return renderWithI18n(
    <>
      <FavoritesList favorites={favorites} />
      <Toaster />
    </>,
    { locale: "es", ...options },
  );
}

/** The car an element shows, by the title it holds. */
export function letterOf(element: HTMLElement): SortExampleLetter | undefined {
  return SORT_EXAMPLE_LETTERS.find((letter) =>
    element.textContent?.includes(SORT_EXAMPLE_TITLE[letter]),
  );
}

function find(elements: HTMLElement[], letter: SortExampleLetter, what: string): HTMLElement {
  const found = elements.find((element) => letterOf(element) === letter);
  expect(found, `the ${what} of ${SORT_EXAMPLE_TITLE[letter]}`).toBeDefined();
  return found as HTMLElement;
}

/** The Guardados cards (desktop): every article but the map's preview, which carries a name. */
export function cards(): HTMLElement[] {
  return screen.queryAllByRole("article").filter((article) => !article.hasAttribute("aria-label"));
}

export function cardOrder(): (SortExampleLetter | undefined)[] {
  return cards().map(letterOf);
}

export function card(letter: SortExampleLetter): HTMLElement {
  return find(cards(), letter, "card");
}

/** The compact rows (phone): buttons that open the car sheet. */
export function rows(): HTMLElement[] {
  return screen
    .queryAllByRole("button")
    .filter((button) => button.getAttribute("aria-haspopup") === "dialog");
}

export function rowOrder(): (SortExampleLetter | undefined)[] {
  return rows().map(letterOf);
}

export function row(letter: SortExampleLetter): HTMLElement {
  return find(rows(), letter, "row");
}
