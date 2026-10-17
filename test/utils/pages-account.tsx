import { screen, within } from "@testing-library/react";
import { AccountPage } from "@/components/account/AccountPage";
import { Toaster } from "@/components/Toaster";
import { type RenderWithI18nOptions, renderWithI18n } from "@/test/utils/render";
import type { AccountPageProps } from "@/components/account/AccountPage";
import { albaAccount } from "@/test/fixtures/pages-account";

// docs/specs/redesign-pages.md (PAGES-25 to PAGES-60, PAGES-71 to PAGES-73):
// /account renders with the app's Toaster, in Spanish, the copy the spec's
// worked examples quote — the same convention as test/utils/alerts.tsx.

type RenderOptions = Pick<RenderWithI18nOptions, "locale" | "timeZone">;

// Wraps the page in `<main>`, as app/account/page.tsx does, so a test can
// scope a region query to the page's own cards and leave out the `<Toaster/>`
// section rendered beside it (PAGES-25, PAGES-26) — the Toaster sits outside
// `<main>` in the root layout too.
export function renderAccount(data: AccountPageProps = albaAccount(), options: RenderOptions = {}) {
  return renderWithI18n(
    <>
      <main>
        <AccountPage {...data} />
      </main>
      <Toaster />
    </>,
    { locale: "es", ...options },
  );
}

/** The named card's region, by its visible title. */
function card(title: string): HTMLElement {
  return screen.getByRole("region", { name: title });
}

export function withinCard(title: string) {
  return within(card(title));
}
