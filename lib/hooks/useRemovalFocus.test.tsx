import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { makeFavoriteInput } from "@/test/fixtures/favorite-listings";
import { cardDomId } from "@/lib/map/card-dom-id";
import { useRemovalFocus } from "./useRemovalFocus";

// docs/specs/redesign-saved.md (SAVED-18): after a removal the focus goes to
// the neighbour's first control, once the virtualised list has mounted it. A
// neighbour that mounts only later must not take the focus back from wherever
// the buyer has put it meanwhile: the pending target expires on the buyer's
// next focus elsewhere, or a press or a wheel in the list.

const NEIGHBOUR = makeFavoriteInput({ id: "wallapop-b", title: "SEAT León 1.5 TSI" });

interface HarnessApi {
  focusAfterRemoval: (neighbour: typeof NEIGHBOUR | undefined) => void;
}

/** The list with the neighbour's card mounted or not, a control outside it, and the hook. */
function Harness({
  mounted,
  scrollToCar,
  api,
}: {
  mounted: boolean;
  scrollToCar: (index: number) => void;
  api: { current: HarnessApi | null };
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const { focusAfterRemoval } = useRemovalFocus({
    shown: [NEIGHBOUR],
    scrollToCar,
    returnFocusRef,
    listRef,
  });
  api.current = { focusAfterRemoval };

  return (
    <>
      <div ref={listRef} data-testid="list">
        {mounted && (
          <article id={cardDomId(NEIGHBOUR.id)}>
            <a href="/car/b">{NEIGHBOUR.title}</a>
          </article>
        )}
      </div>
      <button type="button">Elsewhere</button>
    </>
  );
}

function setUp() {
  const scrollToCar = vi.fn();
  const api: { current: HarnessApi | null } = { current: null };
  const view = render(<Harness mounted={false} scrollToCar={scrollToCar} api={api} />);
  // A removal whose neighbour the list has not mounted: it is scrolled to first.
  act(() => api.current?.focusAfterRemoval(NEIGHBOUR));
  view.rerender(<Harness mounted={false} scrollToCar={scrollToCar} api={api} />);
  const mountNeighbour = () =>
    view.rerender(<Harness mounted scrollToCar={scrollToCar} api={api} />);
  return { scrollToCar, mountNeighbour };
}

describe("SAVED-18: a pending removal focus", () => {
  it("SAVED-18: an unmounted neighbour is scrolled to, and takes the focus once it mounts", () => {
    const { scrollToCar, mountNeighbour } = setUp();
    expect(scrollToCar).toHaveBeenCalledWith(0);

    mountNeighbour();

    expect(screen.getByRole("link", { name: "SEAT León 1.5 TSI" })).toHaveFocus();
  });

  it("SAVED-18: once the buyer has focused something else, the neighbour mounting later does not take the focus", () => {
    const { mountNeighbour } = setUp();
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });

    act(() => elsewhere.focus());
    mountNeighbour();

    expect(elsewhere).toHaveFocus();
    expect(screen.getByRole("link", { name: "SEAT León 1.5 TSI" })).not.toHaveFocus();
  });

  it("SAVED-18: once the buyer has wheeled the list, the neighbour mounting later does not take the focus", () => {
    const { mountNeighbour } = setUp();

    fireEvent.wheel(screen.getByTestId("list"));
    mountNeighbour();

    expect(screen.getByRole("link", { name: "SEAT León 1.5 TSI" })).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });
});
