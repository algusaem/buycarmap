import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

// FRONT-14 (docs/specs/core-frontend.md): /favorites needs a loading state —
// a skeleton mirroring the final card grid (RULES.md §19: "Skeletons mirror
// final content to avoid layout shift") — alongside the error state
// app/favorites/error.tsx already has (PLAT-14) and the empty/populated
// states FavoritesList already renders. `app/favorites/loading.tsx` does not
// exist yet, so this import fails until it is created.
import Loading from "./loading";

describe("FavoritesLoading", () => {
  it("FRONT-14: shows a loading skeleton that mirrors the card grid", () => {
    const { container } = render(<Loading />);

    // aria-busy, not colour alone, marks the region as loading for assistive
    // tech (RULES.md §19 "redundant status cues"). Not role="status": that
    // would clash with LocationSearch's own live region on the map's results
    // list under strict mode (MAP-20).
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});
