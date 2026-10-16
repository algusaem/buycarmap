import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { ALERT_ID } from "@/test/fixtures/alert-listings";
import { useOpenAlert } from "./useOpenAlert";

// docs/specs/redesign-alerts.md (ALERTUI-12; Contracts › URL; worked example
// "Open alert"): pressing a folded card writes the URL's `alert`. The newest
// is the default, which writes no parameter; any other writes its id. Each
// press is a history entry, and the write is not shallow, so the server reads
// the newly open alert's matches. Which alert is open is resolved on the
// server (server/alerts/service.ts's resolveOpenAlertId, in schema.test.ts).

const NEWEST = ALERT_ID.corolla;

function harness(searchParams: string) {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter hasMemory searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
      {children}
    </NuqsTestingAdapter>
  );
  const { result } = renderHook(() => useOpenAlert(NEWEST), { wrapper });
  return { result, onUrlUpdate };
}

describe("ALERTUI-12: the open alert written to the URL", () => {
  it("ALERTUI-12: on /alerts, opening Golf TDI writes alert=<Golf's id> as a new, non-shallow history entry", async () => {
    const { result, onUrlUpdate } = harness("");

    act(() => result.current.openAlert(ALERT_ID.golf));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const event = onUrlUpdate.mock.lastCall?.[0];
    expect(event?.searchParams.get("alert")).toBe(ALERT_ID.golf);
    expect(event?.options.history).toBe("push");
    expect(event?.options.shallow).toBe(false);
  });

  it("ALERTUI-12: from /alerts?alert=<Clio's id>, opening the newest, Corolla híbrido, removes the parameter as a new entry", async () => {
    const { result, onUrlUpdate } = harness(`?alert=${ALERT_ID.clio}`);

    act(() => result.current.openAlert(NEWEST));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const event = onUrlUpdate.mock.lastCall?.[0];
    expect(event?.searchParams.has("alert")).toBe(false);
    expect(event?.queryString).toBe("");
    expect(event?.options.history).toBe("push");
  });

  it("ALERTUI-12: rendering alone never writes the URL, whatever `alert` holds", async () => {
    const { onUrlUpdate } = harness("?alert=not-a-uuid");

    // Let any effect run before looking.
    await act(async () => {
      await Promise.resolve();
    });
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe("ALERTUI-35: the URL after a delete", () => {
  it("ALERTUI-35: with no `alert` in the URL, clearAfterDelete returns false and writes nothing", async () => {
    const { result, onUrlUpdate } = harness("");

    let cleared: boolean | undefined;
    act(() => {
      cleared = result.current.clearAfterDelete();
    });

    expect(cleared).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("ALERTUI-35: from ?alert=<Clio's id>, clearAfterDelete returns true and removes the parameter, replacing the entry", async () => {
    const { result, onUrlUpdate } = harness(`?alert=${ALERT_ID.clio}`);

    let cleared: boolean | undefined;
    act(() => {
      cleared = result.current.clearAfterDelete();
    });

    expect(cleared).toBe(true);
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const event = onUrlUpdate.mock.lastCall?.[0];
    expect(event?.searchParams.has("alert")).toBe(false);
    expect(event?.options.history).toBe("replace");
  });
});
