import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// FRONT-10 (docs/specs/core-frontend.md). next-intl is not installed yet
// (migration phase 9), so a component calling `useTranslations` cannot be
// imported or rendered today — `renderWithI18n` still wraps `I18nProvider`
// from the hand-rolled `lib/i18n/client.tsx` (test/utils/render.tsx). This
// test is structural: it reads the file as text rather than exercising it,
// and stays a text assertion only until next-intl lands.
describe("renderWithI18n", () => {
  it("FRONT-10: wraps NextIntlClientProvider with the English messages", () => {
    const source = readFileSync(join(__dirname, "render.tsx"), "utf-8");

    expect(source).toContain("NextIntlClientProvider");
    expect(source).toContain("messages/en.json");
  });
});
