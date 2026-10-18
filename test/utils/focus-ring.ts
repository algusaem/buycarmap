import { expect } from "vitest";

// docs/specs/redesign-map.md (MAPUI-61, bug fix #134): the shared assertion
// for a card link's focus indicator — the photo's lime ring on
// `group-focus-visible/card`, with the global `focus-visible` outline
// suppressed on the link itself (`outline-hidden`, not `outline-none`, so
// forced-colors mode still draws one). Used by CarCard, SavedCard and
// AlertCard's tests instead of repeating the same block four times.
export function expectPhotoFocusRing(link: HTMLElement): void {
  const photo = link.firstElementChild;
  if (!(photo instanceof HTMLElement)) {
    throw new Error("expected the card's photo as the link's first child");
  }

  expect(link).toHaveClass("group/card");
  expect(link).toHaveClass("focus-visible:outline-hidden");
  expect(photo).toHaveClass("group-focus-visible/card:ring-2");
}
