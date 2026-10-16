import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ALERT_ID } from "@/test/fixtures/alert-listings";
import { makeMatchListing } from "@/test/fixtures/alerts";
import { useColumnScroll, useSavedList } from "./useSavedList";

// docs/specs/redesign-saved.md (SAVED-27) and redesign-alerts.md (ALERTUI-53):
// the scroll Back restores is recorded per page and per history entry. jsdom
// has no Navigation API, so every visit to a path shares the entry key "tab";
// the path still keeps /favorites' record apart from each /alerts/[id]'s.

const SHOWN = ["a", "b", "c"].map((id) => makeMatchListing({ id }));

function List() {
  const list = useSavedList({ shown: SHOWN, columns: 1 });
  return (
    <div ref={list.scrollerRef} data-testid="scroller" onScroll={list.recordScroll}>
      <div ref={list.listRef} />
    </div>
  );
}

/** Renders the list on `path` and records its scroll at the top: the first car, index 0. */
function recordOn(path: string) {
  window.history.replaceState({}, "", path);
  const view = render(<List />);
  view.getByTestId("scroller").dispatchEvent(new Event("scroll"));
  view.unmount();
}

afterEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("SAVED-27 / ALERTUI-53: the restored scroll's record", () => {
  it("SAVED-27: /favorites records under buycarmap:saved-car:/favorites:tab", () => {
    recordOn("/favorites");

    expect(window.sessionStorage.getItem("buycarmap:saved-car:/favorites:tab")).toBe("0");
  });

  it("ALERTUI-53: /favorites and two alerts' pages keep three records, one per path", () => {
    recordOn("/favorites");
    recordOn(`/alerts/${ALERT_ID.corolla}`);
    recordOn(`/alerts/${ALERT_ID.serie3}`);

    expect(
      Object.keys(window.sessionStorage)
        .filter((key) => key.startsWith("buycarmap:saved-car:"))
        .sort(),
    ).toEqual(
      [
        "buycarmap:saved-car:/favorites:tab",
        `buycarmap:saved-car:/alerts/${ALERT_ID.corolla}:tab`,
        `buycarmap:saved-car:/alerts/${ALERT_ID.serie3}:tab`,
      ].sort(),
    );
  });
});

function Column({ ready }: { ready: boolean }) {
  const column = useColumnScroll(ready);
  return <div ref={column.scrollerRef} data-testid="column" onScroll={column.recordScroll} />;
}

/** Two animation frames: the restore waits one. */
async function nextFrames() {
  for (let frame = 0; frame < 2; frame++) {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }
}

// docs/specs/redesign-alerts.md (ALERTUI-56): /alerts' list column records its
// offset under buycarmap:list-scroll:<path>:<entry>, "tab" in jsdom.
describe("ALERTUI-56: /alerts' list column scroll", () => {
  it("ALERTUI-56: scrolled to 420, the column records 420 under buycarmap:list-scroll:/alerts:tab", () => {
    window.history.replaceState({}, "", "/alerts");
    const view = render(<Column ready />);
    const column = view.getByTestId("column");

    column.scrollTop = 420;
    fireEvent.scroll(column);

    expect(window.sessionStorage.getItem("buycarmap:list-scroll:/alerts:tab")).toBe("420");
  });

  it("ALERTUI-56: the next mount, once ready, restores the 420 recorded", async () => {
    window.history.replaceState({}, "", "/alerts");
    const first = render(<Column ready />);
    const scrolled = first.getByTestId("column");
    scrolled.scrollTop = 420;
    fireEvent.scroll(scrolled);
    first.unmount();

    const next = render(<Column ready />);

    await waitFor(() => expect(next.getByTestId("column").scrollTop).toBe(420));
  });

  it("ALERTUI-56: a mount that is not ready restores nothing", async () => {
    window.history.replaceState({}, "", "/alerts");
    window.sessionStorage.setItem("buycarmap:list-scroll:/alerts:tab", "420");

    const view = render(<Column ready={false} />);
    await nextFrames();

    expect(view.getByTestId("column").scrollTop).toBe(0);
  });
});
