import type { ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const MESSAGES_BY_LOCALE = { en: enMessages, es: esMessages };

export interface RenderWithI18nOptions extends Omit<RenderOptions, "wrapper"> {
  /** The specs' worked examples quote the Spanish copy (`es` is the default
   * locale), so a test asserting that copy word for word renders with
   * `locale: "es"` instead of the English default. */
  locale?: "en" | "es";
  /** The page's query when it opens, as `?sort=price` would put it in the URL. */
  searchParams?: string;
  /** Called on every URL write, so a test can assert what a control wrote. */
  onUrlUpdate?: OnUrlUpdateFunction;
  /** The `NextIntlClientProvider` timezone, so a worked example that depends
   * on local time (a month boundary) renders in the zone its input assumes.
   * Defaults to UTC, this provider's existing default. */
  timeZone?: string;
}

// Renders with the English locale by default so tests can query by stable
// English labels; pass `{ locale: "es" }` to assert the Spanish copy a
// spec's worked example quotes. FRONT-10 (docs/specs/core-frontend.md): wraps
// `NextIntlClientProvider` with the chosen locale's messages instead of the
// removed hand-rolled `I18nProvider`. FRONT-13: also wraps nuqs's testing
// adapter — `hasMemory` so a component that both reads and writes URL state
// (filters, location, radius) round-trips within one test the way a real
// adapter would, rather than the URL being frozen to its initial value.
export function renderWithI18n(
  ui: ReactNode,
  {
    locale = "en",
    searchParams,
    onUrlUpdate,
    timeZone = "UTC",
    ...options
  }: RenderWithI18nOptions = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES_BY_LOCALE[locale]}
        timeZone={timeZone}
      >
        <NuqsTestingAdapter hasMemory searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
          {children}
        </NuqsTestingAdapter>
      </NextIntlClientProvider>
    ),
    ...options,
  });
}
