import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

// FRONT-14 (docs/specs/core-frontend.md): /alerts/[id] needs the same
// loading skeleton treatment as /favorites (app/favorites/loading.test.tsx),
// mirroring AlertMatchesList's card grid. `app/alerts/[id]/loading.tsx` does
// not exist yet, so this import fails until it is created.
import Loading from "./loading";

describe("AlertMatchesLoading", () => {
  it("FRONT-14: shows a loading skeleton that mirrors the matches grid", () => {
    const { container } = render(<Loading />);

    // Not role="status": CardGridSkeleton is aria-busy, not a live region
    // (MAP-20 — see app/favorites/loading.test.tsx's comment).
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});
