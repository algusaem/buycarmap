import type { ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import enMessages from "@/messages/en.json";

// Renders with the English locale so tests can query by stable English labels.
// FRONT-10 (docs/specs/core-frontend.md): wraps `NextIntlClientProvider` with
// the English messages instead of the removed hand-rolled `I18nProvider`.
// FRONT-13: also wraps nuqs's testing adapter — `hasMemory` so a component
// that both reads and writes URL state (filters, location, radius) round-trips
// within one test the way a real adapter would, rather than the URL being
// frozen to its initial value.
export function renderWithI18n(ui: ReactNode, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
        <NuqsTestingAdapter hasMemory>{children}</NuqsTestingAdapter>
      </NextIntlClientProvider>
    ),
    ...options,
  });
}
