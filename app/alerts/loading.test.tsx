import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

// FRONT-14 (docs/specs/core-frontend.md): /alerts needs the same loading
// skeleton treatment as /favorites (app/favorites/loading.test.tsx).
// `app/alerts/loading.tsx` does not exist yet, so this import fails until it
// is created.
import Loading from "./loading";

describe("AlertsLoading", () => {
  it("FRONT-14: shows a loading skeleton that mirrors the alert list", () => {
    render(<Loading />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
