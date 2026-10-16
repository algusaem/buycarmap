import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import { ALERT_ID } from "@/test/fixtures/alert-listings";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/alerts/actions", () => ({ deleteAlert: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { deleteAlert } from "@/server/alerts/actions";
import {
  ARRIVAL_FOCUS_MS,
  focusAlertsOnArrival,
  takeArrivalFocus,
  useAlertDelete,
} from "./useAlertDelete";

// docs/specs/redesign-alerts.md (ALERTUI-35, ALERTUI-36): after a delete on an
// alert's page, /alerts' heading takes the focus once, as it mounts — within
// one navigation, never on a later, unrelated visit. A delete that throws is
// reported to Sentry and resolves to the generic copy (PLAT-12).

afterEach(() => {
  // Drops any mark a test left behind.
  takeArrivalFocus();
  vi.useRealTimers();
});

describe("ALERTUI-35: the heading's focus on arriving at /alerts", () => {
  it("ALERTUI-35: after a delete on an alert's page, the next /alerts mount takes the focus once", () => {
    focusAlertsOnArrival();

    expect(takeArrivalFocus()).toBe(true);
    expect(takeArrivalFocus()).toBe(false);
  });

  it("ALERTUI-35: with no delete, /alerts mounting takes no focus", () => {
    expect(takeArrivalFocus()).toBe(false);
  });

  it("ALERTUI-35: when /alerts has not mounted within one navigation (10 s), the mark is dropped and a later visit takes no focus", () => {
    vi.useFakeTimers();
    expect(ARRIVAL_FOCUS_MS).toBe(10_000);
    focusAlertsOnArrival();

    vi.advanceTimersByTime(10_000);

    expect(takeArrivalFocus()).toBe(false);
  });

  it("ALERTUI-35: an /alerts mount just inside the window still takes the focus — 9,999 ms", () => {
    vi.useFakeTimers();
    focusAlertsOnArrival();

    vi.advanceTimersByTime(9_999);

    expect(takeArrivalFocus()).toBe(true);
  });
});

describe("ALERTUI-36: a delete that throws", () => {
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="es" messages={esMessages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    );
  }

  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(deleteAlert).mockReset();
  });

  it("ALERTUI-36: reports the error to Sentry, closes the confirmation and resolves to «Algo ha salido mal. Inténtalo de nuevo.»", async () => {
    const error = new Error("connection refused");
    vi.mocked(deleteAlert).mockRejectedValue(error);
    const { result } = renderHook(() => useAlertDelete(), { wrapper });
    act(() => result.current.ask(ALERT_ID.clio, document.body));

    let outcome: Awaited<ReturnType<typeof result.current.confirm>> = null;
    await act(async () => {
      outcome = await result.current.confirm();
    });

    expect(outcome).toEqual({ failure: "Algo ha salido mal. Inténtalo de nuevo." });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(result.current.open).toBe(false);
    expect(result.current.deleting).toBe(false);
  });
});

describe("ALERTUI-35: one delete at a time", () => {
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="es" messages={esMessages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    );
  }

  beforeEach(() => {
    vi.mocked(deleteAlert).mockReset();
  });

  it("ALERTUI-35: a second «Eliminar» while the delete runs sends nothing — deleteAlert is called once", async () => {
    let answer: (value: { ok: true; value: undefined }) => void = () => undefined;
    vi.mocked(deleteAlert).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = renderHook(() => useAlertDelete(), { wrapper });
    act(() => result.current.ask(ALERT_ID.golf, document.body));

    let first: Promise<unknown> = Promise.resolve();
    let second: unknown;
    await act(async () => {
      first = result.current.confirm();
      second = await result.current.confirm();
    });

    expect(second).toBeNull();
    expect(deleteAlert).toHaveBeenCalledTimes(1);
    expect(deleteAlert).toHaveBeenCalledWith(ALERT_ID.golf);
    await act(async () => {
      answer({ ok: true, value: undefined });
      await first;
    });
    expect(deleteAlert).toHaveBeenCalledTimes(1);
  });
});
