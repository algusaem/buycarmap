import { ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/client";

// Renders with the English locale so tests can query by stable English labels.
// Components that consume `useTranslation` without a provider fall back to
// Spanish, so wrap explicitly wherever label text matters.
export function renderWithI18n(ui: ReactNode, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => <I18nProvider locale="en">{children}</I18nProvider>,
    ...options,
  });
}
